import fs from 'node:fs';
import path from 'node:path';
import { many, q } from './db.js';

const root = path.resolve(import.meta.dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'content/catalog.json'), 'utf8'));
const PLACEHOLDER = '<!--LAVELS:BOOT-->';
export const modules = raw.modules;
export const exercises = raw.exercises.map((e) => ({
  ...e,
  pageMap: new Map(e.pages.map((p) => [p.id, p])),
  html: fs.readFileSync(path.join(root, 'content/exercises', `${e.id}.html`), 'utf8'),
}));
export const byId = new Map(exercises.map((e) => [e.id, e]));
export const CHAPTERS = ['Teorija', 'Simulacija', 'Naloge'];
export const totalPoints = exercises.reduce((a, e) => a + e.maxPoints, 0);
export const totalTasks = exercises.reduce((a, e) => a + e.tasks.length, 0);

export function renderExercise(ex, boot) {
  const json = JSON.stringify(boot).replace(/</g, '\\u003c');
  return ex.html.replace(PLACEHOLDER, () => `<script>window.__LAVELS=${json}</script>\n<script src="/static/js/tracker.js"></script>`);
}
export async function seedSettings() {
  for (const [i, e] of exercises.entries()) {
    await q('INSERT INTO exercise_settings(exercise_id, sort_order) VALUES($1,$2) ON CONFLICT DO NOTHING', [e.id, i]);
  }
}
// Exercises grouped by module, in the order set by the admin.
export async function arranged({ includeHidden = false } = {}) {
  const rows = await many('SELECT * FROM exercise_settings');
  const s = new Map(rows.map((r) => [r.exercise_id, r]));
  return modules.map((m) => ({
    ...m,
    exercises: exercises
      .filter((e) => e.module === m.id && byId.has(e.id) && (includeHidden || s.get(e.id)?.visible !== false))
      .map((e) => ({ ...e, html: undefined, visible: s.get(e.id)?.visible !== false, order: s.get(e.id)?.sort_order ?? 0 }))
      .sort((a, b) => a.order - b.order),
  })).filter((m) => m.exercises.length);
}
