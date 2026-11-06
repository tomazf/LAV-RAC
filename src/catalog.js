import fs from 'node:fs';
import path from 'node:path';
import { asset } from './assets.js';
import { many, one, q } from './db.js';
import { portal } from './portal.js';

const root = path.resolve(import.meta.dirname, '..');
// The tests run on their own exercises (test/fixtures/content), because the portal's content changes.
const content = path.resolve(root, process.env.CONTENT_DIR || 'content');
const raw = JSON.parse(fs.readFileSync(path.join(content, 'catalog.json'), 'utf8'));
const PLACEHOLDER = '<!--LAVELS:BOOT-->';
const VARIANTS = '<!--LAVELS:VARIANTS-->';
const varied = JSON.parse(fs.readFileSync(path.join(content, 'variants.json'), 'utf8'));
export const modules = raw.modules;
export const exercises = raw.exercises.map((e) => ({
  ...e,
  // The number people see; the id stays the technical name (URLs, database, keys).
  no: e.no ?? e.id,
  hasVariants: !!varied[e.id],
  tasks: e.tasks.map((t) => ({ ...t, varied: !!varied[e.id]?.includes(t.i) })),
  pageMap: new Map(e.pages.map((p) => [p.id, p])),
  html: fs.readFileSync(path.join(content, 'exercises', `${e.id}.html`), 'utf8'),
}));
export const byId = new Map(exercises.map((e) => [e.id, e]));
export const CHAPTERS = ['Teorija', 'Simulacija', 'Naloge'];
export const totalPoints = exercises.reduce((a, e) => a + e.maxPoints, 0);
export const totalTasks = exercises.reduce((a, e) => a + e.tasks.length, 0);

export function renderExercise(ex, boot) {
  const json = JSON.stringify(boot).replace(/</g, '\\u003c');
  const variants = ex.hasVariants ? `<script src="${asset('js/variants/core.js')}"></script>\n<script src="${asset(`js/variants/${ex.id}.js`)}"></script>` : '';
  return ex.html.replace(PLACEHOLDER, () => `<script>window.__LAVELS=${json}</script>\n<script src="${asset('js/notes.js')}"></script>\n<script src="${asset('js/tracker.js')}"></script>`).replace(VARIANTS, () => variants);
}
// Chapters with a place in a group but no content yet; shown only to teachers and admins.
export const plannedExercises = raw.planned ?? [];
export const plannedIn = (moduleId) => plannedExercises.filter((p) => p.module === moduleId);
// Groups that are planned but have no content yet; shown only to teachers and admins.
export const plannedModules = portal.plannedModules.filter((id) => !modules.some((m) => m.id === id));

// Years: each class works on its year's group. Off when the portal has no years or none of their groups has content
// yet (the tests run on other content); then a class sees every group, as before.
export const YEARS = Object.entries(portal.years).map(([y, module]) => ({ year: Number(y), module })).sort((a, b) => a.year - b.year);
export const yearsOn = YEARS.some((y) => modules.some((m) => m.id === y.module));
export const finalYear = yearsOn ? YEARS.at(-1).year : null;
// What "sees past years" opens for a class: "2. letnik", "2. in 3. letnik"; empty when there is no lower year.
export const pastLabel = (year) => {
  const lower = YEARS.filter((y) => year && y.year < year).map((y) => `${y.year}.`);
  return lower.length ? `${lower.length > 1 ? `${lower.slice(0, -1).join(', ')} in ${lower.at(-1)}` : lower[0]} letnik` : '';
};
export const yearOf = (moduleId) => YEARS.find((y) => y.module === moduleId)?.year ?? null;
export const inYear = (year, moduleId) => !yearsOn || !year || yearOf(moduleId) === year;
// Groups of lower years, which a class may be allowed to revisit.
export const pastYear = (year, moduleId) => yearsOn && !!year && yearOf(moduleId) !== null && yearOf(moduleId) < year;

function grouped(items) {
  return modules
    .map((m) => ({ ...m, exercises: items.filter((e) => e.module === m.id) }))
    .filter((m) => m.exercises.length);
}
const light = (e, extra) => ({ ...e, html: undefined, ...extra });
// All exercises in the standard order, for teachers, admins and the overview.
export const standardGroups = () => grouped(exercises.map((e, i) => light(e, { visible: true, order: i })));
// Exercises in the order chosen for a class, with what is open to its students.
export async function classGroups(classId, { openOnly = false } = {}) {
  const year = (await one('SELECT year FROM classes WHERE id=$1', [classId]))?.year ?? null;
  const rows = await many('SELECT * FROM class_exercises WHERE class_id=$1', [classId]);
  const s = new Map(rows.map((r) => [r.exercise_id, r]));
  const items = exercises
    .map((e, i) => light(e, { visible: s.get(e.id)?.visible === true, order: s.get(e.id)?.sort_order ?? i }))
    .filter((e) => inYear(year, e.module) && (!openOnly || e.visible))
    .sort((a, b) => a.order - b.order);
  return grouped(items);
}
// Everything from lower years, in the standard order; open regardless of what the teachers opened.
export const pastGroups = (year) => grouped(exercises.filter((e) => pastYear(year, e.module)).map((e, i) => light(e, { visible: true, order: i })));
export async function ensureClassRows(classId) {
  for (const [i, e] of exercises.entries()) {
    await q('INSERT INTO class_exercises(class_id, exercise_id, sort_order) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [classId, e.id, i]);
  }
}
