// The update from the first version must keep all data and start every class with no exercises open.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DB = process.env.TEST_DATABASE_URL;
const dir = path.resolve(import.meta.dirname, '../src/migrations');
const read = (f) => readFileSync(path.join(dir, f), 'utf8');

test('migration 002 keeps data, one class per student, all exercises closed', async () => {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await c.query(read('001_init.sql'));
    await c.query(`INSERT INTO users(id, oid, username, name, role) VALUES
      (1,'t1','t1@x','Učitelj Ena','teacher'), (2,'s1','s1@x','Dijak Ena','user'), (3,'s2','s2@x','Dijak Dva','user'), (4,'t2','t2@x','Učitelj Dva','teacher')`);
    await c.query(`INSERT INTO classes(id, name, owner_id) VALUES (10,'A',1),(11,'B',1),(12,'C',NULL)`);
    await c.query(`INSERT INTO class_members(class_id, user_id, added_at) VALUES
      (10,2,'2026-01-01'), (11,2,'2026-02-01'), (11,3,'2026-01-01'), (10,4,'2026-01-01')`);
    await c.query(`INSERT INTO exercise_settings(exercise_id, visible, sort_order) VALUES ('1.1',true,5),('1.2',true,1),('2.2',false,2)`);
    await c.query(`INSERT INTO progress(user_id, exercise_id, content_version, state, score, done_count) VALUES (2,'1.1',1,'{"t":{"0":{"d":true,"p":1}}}',1,1)`);
    await c.query(read('002_class_sections_notes.sql'));
    const q = async (s) => (await c.query(s)).rows;
    assert.deepEqual(await q('SELECT class_id, user_id FROM class_teachers ORDER BY 1'), [{ class_id: '10', user_id: '1' }, { class_id: '11', user_id: '1' }]);
    assert.deepEqual(await q('SELECT class_id, user_id FROM class_members ORDER BY 2'), [{ class_id: '10', user_id: '2' }, { class_id: '11', user_id: '3' }]);
    assert.equal((await q('SELECT count(*)::int n FROM class_exercises WHERE visible'))[0].n, 0);
    assert.deepEqual(await q(`SELECT exercise_id, sort_order FROM class_exercises WHERE class_id=10 ORDER BY sort_order`), [{ exercise_id: '1.2', sort_order: 1 }, { exercise_id: '2.2', sort_order: 2 }, { exercise_id: '1.1', sort_order: 5 }]);
    assert.equal((await q('SELECT score FROM progress'))[0].score, '1.0');
    assert.equal((await q(`SELECT count(*)::int n FROM audit_log WHERE action LIKE 'Odstranil%'`))[0].n, 2);
    await assert.rejects(c.query(`INSERT INTO class_members(class_id, user_id) VALUES (10,3)`));
    await assert.rejects(c.query('SELECT owner_id FROM classes'));
  } finally { await c.end(); }
});
