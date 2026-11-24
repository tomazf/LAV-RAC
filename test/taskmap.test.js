// The task map: each exercise version is written once, and an old version reads back by position (students' answers are moved by it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { recordTaskMap, oldTasks } from '../src/taskmap.js';

const DB = process.env.TEST_DATABASE_URL;

test('the tasks of each exercise version are written once and read back by position', async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    // its own schema, so the other database tests (which reset the public schema) do not interfere
    await c.query('DROP SCHEMA IF EXISTS taskmap_test CASCADE; CREATE SCHEMA taskmap_test; SET search_path TO taskmap_test');
    await c.query(readFileSync(path.resolve(import.meta.dirname, '../src/migrations/014_task_map.sql'), 'utf8'));
    const v1 = [{ id: 'x', version: 1, tasks: [{ i: 0, q: 'Prva?' }, { i: 1, q: 'Druga <i>naloga</i>?' }] }];
    await recordTaskMap(c, v1);
    await recordTaskMap(c, v1); // a second start of the server writes nothing new
    await recordTaskMap(c, [{ id: 'x', version: 2, tasks: [{ i: 0, q: 'Druga naloga?' }] }]);
    assert.deepEqual(await oldTasks(c, 'x', 1), ['prva?', 'druga naloga?']);
    assert.deepEqual(await oldTasks(c, 'x', 2), ['druga naloga?']);
    assert.equal(await oldTasks(c, 'x', 3), null);
    assert.equal(Number((await c.query('SELECT COUNT(*) AS n FROM task_map')).rows[0].n), 3);
  } finally {
    await c.query('DROP SCHEMA IF EXISTS taskmap_test CASCADE').catch(() => {});
    await c.end();
  }
});

test('a student\'s progress moves to the new version: the answer of a task that stays follows it, the score follows the answers', async () => {
  const { moveProgress } = await import('../src/taskmap.js');
  const { fingerprint } = await import('../src/progress.js');
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query('DROP SCHEMA IF EXISTS taskmap_move CASCADE; CREATE SCHEMA taskmap_move; SET search_path TO taskmap_move');
    await c.query(readFileSync(path.resolve(import.meta.dirname, '../src/migrations/014_task_map.sql'), 'utf8'));
    await c.query(`CREATE TABLE progress (user_id INT, exercise_id TEXT, content_version INT, state JSONB, score NUMERIC, done_count INT,
      hint_count INT, solution_count INT, updated_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, PRIMARY KEY (user_id, exercise_id))`);
    // version 0 had an extra task at place 0 (removed since); the student answered the task that is now at place 0, which was at place 1
    await c.query(`INSERT INTO task_map(exercise_id, version, idx, fp) VALUES ('x',0,0,'odstranjena naloga'),('x',0,1,$1)`, [fingerprint({ q: 'Prva?' })]);
    await c.query(`INSERT INTO progress VALUES (1,'x',0,'{"t":{"1":{"d":true,"p":1}}}',1,1,0,0,now(),NULL)`);
    const ex = { id: 'x', version: 1, format: 'short', tasks: [{ i: 0, q: 'Prva?', max: 1 }, { i: 1, q: 'Nova?', max: 1 }] };
    const p = (await c.query(`SELECT * FROM progress WHERE user_id=1`)).rows[0];
    const row = await moveProgress(c, { id: 1 }, ex, p);
    assert.equal(row.content_version, 1);
    assert.deepEqual(row.state.t, { 0: { d: true, p: 1 } });
    assert.equal(Number(row.score), 1);
    assert.equal(row.done_count, 1);
    assert.equal(row.completed_at, null);
    // a version that was never recorded is not moved: the caller starts afresh
    assert.equal(await moveProgress(c, { id: 1 }, ex, { ...p, content_version: 5 }), null);
  } finally {
    await c.query('DROP SCHEMA IF EXISTS taskmap_move CASCADE').catch(() => {});
    await c.end();
  }
});
