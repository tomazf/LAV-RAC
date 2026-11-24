// One-off, before a new exercise version is deployed: writes the tasks of the versions in an older catalog, so that the answers
// students gave under those versions can be carried over. Get the old catalog from git, for example:
//   git show <commit>:content/catalog.json > /tmp/catalog-old.json && node scripts/seed-task-map.mjs /tmp/catalog-old.json
import fs from 'node:fs';
import { migrate, pool } from '../src/db.js';
import { recordTaskMap } from '../src/taskmap.js';

const file = process.argv[2];
if (!file) {
  console.error('Uporaba: node scripts/seed-task-map.mjs <catalog.json>');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
await migrate(); // creates task_map (migration 014) if the new code has not started yet
await recordTaskMap(pool, raw.exercises);
const { rows } = await pool.query('SELECT exercise_id, version, COUNT(*)::int AS tasks FROM task_map GROUP BY 1, 2 ORDER BY 1, 2');
console.table(rows);
await pool.end();
