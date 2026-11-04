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
    // 003: teacher resets are allowed; names from earlier deletions are cleared
    await c.query(`INSERT INTO audit_log(actor_name, action, detail) VALUES ('x','Izbrisal uporabnika in njegove podatke','Stari Dijak')`);
    await c.query(read('003_teacher_reset_erasure.sql'));
    await c.query(`INSERT INTO resets(user_id, exercise_id, attempt, score, done_count, reason) VALUES (2,'1.1',1,1,1,'teacher')`);
    assert.equal((await q(`SELECT count(*)::int n FROM audit_log WHERE detail='Stari Dijak'`))[0].n, 0);
    // 004: only the replaced 3.2 tasks are cleared
    await c.query(`INSERT INTO progress(user_id, exercise_id, content_version, attempt, state, score, done_count, hint_count, solution_count, completed_at) VALUES
      (2,'3.2',1,3,'{"p":"naloge","t":{"0":{"done":true,"pts":1,"hinted":false},"4":{"done":true,"pts":0.5,"hinted":true},"10":{"done":true,"pts":0,"sol":true,"hinted":false},"11":{"done":false,"pts":0,"hinted":true},"6":{"done":true,"pts":2,"hinted":false}}}',3.5,4,2,1,now()),
      (3,'3.2',1,1,'{}',0,0,0,0,NULL)`);
    await c.query(`INSERT INTO task_events(user_id, exercise_id, attempt, task_index, kind, points) VALUES (2,'3.2',3,4,'partial',0.5),(2,'3.2',3,0,'correct',1),(2,'3.2',2,4,'correct',1)`);
    await c.query(`INSERT INTO student_notes(user_id, exercise_id, task_index, body) VALUES (2,'3.2',4,'stara'),(2,'3.2',0,'ostane'),(2,'3.2',-1,'vaja')`);
    await c.query(read('004_replace_32_tasks.sql'));
    const [p2] = await q(`SELECT * FROM progress WHERE user_id='2' AND exercise_id='3.2'`);
    assert.deepEqual(Object.keys(p2.state.t).sort(), ['0', '6']);
    assert.equal(p2.state.p, 'naloge');
    assert.deepEqual([Number(p2.score), p2.done_count, p2.hint_count, p2.solution_count, p2.attempt, p2.completed_at], [3, 2, 0, 0, 4, null]);
    const [p3] = await q(`SELECT * FROM progress WHERE user_id='3' AND exercise_id='3.2'`);
    assert.deepEqual([Number(p3.score), p3.done_count, p3.attempt], [0, 0, 2]);
    assert.deepEqual((await q(`SELECT attempt, task_index FROM task_events WHERE exercise_id='3.2' ORDER BY attempt, task_index`)).map((e) => [e.attempt, e.task_index]), [[2, 4], [4, 0]]);
    assert.deepEqual((await q(`SELECT task_index FROM student_notes WHERE exercise_id='3.2' ORDER BY 1`)).map((n) => n.task_index), [-1, 0]);
    assert.equal(Number((await q(`SELECT score FROM progress WHERE exercise_id='1.1'`))[0].score), 1, 'other exercises untouched');
  } finally { await c.end(); }
});
