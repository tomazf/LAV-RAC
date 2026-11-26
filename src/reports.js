// Reports (»Prijave«): a user tells the admin about a bug or a mistake. The page fills in where the user was.
import { byId, exercises, yearOf } from './catalog.js';
import { many, one } from './db.js';
import { byName } from './format.js';

export const MAX_TEXT = 2000;
// A student can send this many reports in 24 hours; a flood of reports helps nobody.
export const PER_DAY = 10;
const HASH = /^([a-z0-9_-]{1,40})(?:\/(\d{1,3}))?$/;
const LABEL = /^[A-Z]\.\d{1,3}$/;
// A path of this portal: one slash first (not //host), nothing but plain characters.
const PATH = /^\/(?!\/)[A-Za-z0-9_\-./]{0,118}$/;

// Everything the page says about its place is checked: an exercise must exist, a page must belong to it, a task label must look like one.
export function placeOf(input) {
  const src = input && typeof input === 'object' ? input : {};
  const ex = typeof src.exercise === 'string' ? byId.get(src.exercise) : null;
  if (!ex) {
    const path = String(src.path ?? '').split('?')[0].split('#')[0];
    return { exercise_id: null, exercise_version: null, page_id: null, task_label: null, task_no: null, path: PATH.test(path) ? path : null };
  }
  const m = HASH.exec(String(src.hash ?? '').replace(/^#/, ''));
  const page = m && ex.pageMap.has(m[1]) ? m[1] : null;
  const taskNo = page && m[2] ? Number(m[2]) : null;
  const label = page && taskNo && LABEL.test(String(src.label ?? '')) ? String(src.label) : null;
  return { exercise_id: ex.id, exercise_version: ex.version ?? null, page_id: page, task_label: label, task_no: taskNo, path: null };
}

export async function createReport(user, input) {
  const text = String(input?.text ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { status: 400, error: 'Vpiši besedilo prijave.' };
  if (text.length > MAX_TEXT) return { status: 400, error: `Besedilo je predolgo (največ ${MAX_TEXT} znakov).` };
  const recent = (await one(`SELECT count(*) AS n FROM reports WHERE user_id=$1 AND created_at > now() - interval '24 hours'`, [user.id])).n;
  if (recent >= PER_DAY) return { status: 429, error: 'Danes si že poslal veliko prijav. Poskusi jutri ali počakaj na odgovor skrbnika.' };
  const p = placeOf(input);
  const r = await one(
    `INSERT INTO reports(user_id, exercise_id, exercise_version, page_id, task_label, task_no, path, body)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [user.id, p.exercise_id, p.exercise_version, p.page_id, p.task_label, p.task_no, p.path, text],
  );
  return { status: 200, id: r.id, left: PER_DAY - recent - 1 };
}

// Where a report was written, as text and as a link back to the exact place.
export function describe(r) {
  const ex = r.exercise_id ? byId.get(r.exercise_id) : null;
  if (!ex) return { year: null, exNo: null, exTitle: null, where: r.path ? `Stran ${r.path}` : 'Splošno', link: r.path || null };
  const page = r.page_id ? ex.pageMap.get(r.page_id) : null;
  const parts = [page?.label, r.task_label ? `naloga ${r.task_label}` : null].filter(Boolean);
  return {
    year: yearOf(ex.module), exNo: ex.no, exTitle: ex.title, ex, where: parts.join(' · '),
    link: `/vaje/${ex.id}${r.page_id ? `#${r.page_id}${r.task_no ? `/${r.task_no}` : ''}` : ''}`,
  };
}

export const countOpenFor = async (user) => {
  if (user.isAdmin) return (await one(`SELECT count(*) AS n FROM reports WHERE status='open'`)).n;
  if (!user.isTeacher) return 0;
  return (await one(
    `SELECT count(*) AS n FROM reports r WHERE r.status='open' AND EXISTS (
       SELECT 1 FROM class_members m JOIN class_teachers t ON t.class_id=m.class_id WHERE m.user_id=r.user_id AND t.user_id=$1)`, [user.id],
  )).n;
};

const FILTERS = { odprte: `r.status='open'`, resene: `r.status='resolved'`, vse: 'TRUE' };
export const stateOf = (v) => (v in FILTERS ? v : 'odprte');
const LIMIT = 500;

// Reports with the author and the class the author is in now. scope: 'all' (admin) or { teacherId } (only the students of their classes).
export async function listReports({ scope, state = 'odprte', classId = null, year = null }) {
  const params = [];
  const where = [FILTERS[stateOf(state)]];
  if (scope !== 'all') { params.push(scope.teacherId); where.push(`m.class_id IN (SELECT class_id FROM class_teachers WHERE user_id=$${params.length})`); }
  if (classId) { params.push(classId); where.push(`m.class_id=$${params.length}`); }
  const rows = await many(
    `SELECT r.*, u.name AS user_name, u.role AS user_role, cl.id AS class_id, cl.name AS class_name, cl.year AS class_year
     FROM reports r JOIN users u ON u.id=r.user_id
     LEFT JOIN class_members m ON m.user_id=u.id LEFT JOIN classes cl ON cl.id=m.class_id
     WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT ${LIMIT + 1}`, params,
  );
  const more = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT).map((r) => ({ ...r, ...describe(r) })).filter((r) => !year || r.year === year);
  return { items, more };
}

const order = new Map(exercises.map((e, i) => [e.id, i]));
// By year of the exercise, then by chapter; reports without an exercise last.
export function byYear(items) {
  const years = new Map();
  for (const r of items) {
    const key = r.year ?? 0;
    if (!years.has(key)) years.set(key, { year: r.year, title: r.year ? `${r.year}. letnik` : 'Splošno (ni vezano na vajo)', chapters: new Map() });
    const g = years.get(key);
    const ck = r.exercise_id ?? '';
    if (!g.chapters.has(ck)) g.chapters.set(ck, { no: r.exNo, title: r.exTitle, id: r.exercise_id, items: [] });
    g.chapters.get(ck).items.push(r);
  }
  return [...years.values()]
    .sort((a, b) => (a.year ?? 99) - (b.year ?? 99))
    .map((g) => ({ ...g, count: [...g.chapters.values()].reduce((n, c) => n + c.items.length, 0), chapters: [...g.chapters.values()].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)) }));
}
// By class (lowest year first), then by student in Slovene alphabetical order; people without a class last.
export function byClass(items) {
  const classes = new Map();
  for (const r of items) {
    const key = r.class_id ?? 0;
    if (!classes.has(key)) classes.set(key, { id: r.class_id, name: r.class_name ?? 'Brez razreda (učitelji, nadzorni, dijaki brez razreda)', year: r.class_year, students: new Map() });
    const c = classes.get(key);
    if (!c.students.has(r.user_id)) c.students.set(r.user_id, { id: r.user_id, name: r.user_name, items: [] });
    c.students.get(r.user_id).items.push(r);
  }
  return [...classes.values()]
    .sort((a, b) => (a.id === null) - (b.id === null) || (a.year ?? 99) - (b.year ?? 99) || byName(a, b))
    .map((c) => ({ ...c, count: [...c.students.values()].reduce((n, s) => n + s.items.length, 0), students: [...c.students.values()].sort(byName) }));
}
