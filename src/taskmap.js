// Database side of the task map: the tasks of every exercise version, written once per version (see progress.js, migrateState).
import { fingerprint, migrateState } from './progress.js';

// Writes the tasks of the given exercises at their versions; a version that is already there is left alone.
export async function recordTaskMap(client, exercises) {
  for (const ex of exercises) {
    if (!ex.tasks?.length) continue;
    await client.query(
      `INSERT INTO task_map(exercise_id, version, idx, fp)
       SELECT $1, $2, x.idx, x.fp FROM unnest($3::int[], $4::text[]) AS x(idx, fp)
       ON CONFLICT DO NOTHING`,
      [ex.id, ex.version, ex.tasks.map((t) => t.i), ex.tasks.map(fingerprint)],
    );
  }
}
// The fingerprints of an old version, by position; null when that version was never recorded.
export async function oldTasks(client, exId, version) {
  const rows = (await client.query('SELECT idx, fp FROM task_map WHERE exercise_id=$1 AND version=$2 ORDER BY idx', [exId, version])).rows;
  if (!rows.length) return null;
  const fps = [];
  for (const r of rows) fps[r.idx] = r.fp;
  return Array.from(fps, (fp) => fp ?? null);
}

// Moves a student's progress from an old version to the current one, when the old version is recorded. Returns the new row, or null
// when the move is not possible (the caller then starts afresh).
export async function moveProgress(client, user, ex, p) {
  const oldFps = await oldTasks(client, ex.id, p.content_version);
  if (!oldFps) return null;
  const m = migrateState(ex, p.state, oldFps);
  console.log(`Naloga ${ex.id}: ${m.kept} nalog ohranjenih, ${m.dropped} odgovorov odstranjenih (različica ${p.content_version} -> ${ex.version}, uporabnik ${user.id})`);
  return (await client.query(
    `UPDATE progress SET content_version=$3, state=$4, score=$5, done_count=$6, hint_count=$7, solution_count=$8, updated_at=now(),
       completed_at=CASE WHEN $6::int >= $9::int THEN COALESCE(completed_at, now()) ELSE NULL END
     WHERE user_id=$1 AND exercise_id=$2 RETURNING *`,
    [user.id, ex.id, ex.version, m.state, m.summary.score, m.summary.done, m.summary.hints, m.summary.solutions, ex.tasks.length],
  )).rows[0];
}
