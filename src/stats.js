import { byId, CHAPTERS } from './catalog.js';
import { many } from './db.js';
import { readTask } from './progress.js';
import { num } from './format.js';

const STATUS = { correct: 'pravilno', partial: 'pravilno z namigom', wrong: 'napačno', solution: 'ogledana rešitev', hint: 'uporabljen namig, še ni odgovora', open: 'še ni rešeno' };
export function taskStatus(t) {
  if (t.done) {
    if (t.solution) return 'solution';
    if (t.points <= 0) return 'wrong';
    return t.hinted ? 'partial' : 'correct';
  }
  return t.hinted ? 'hint' : 'open';
}
// One entry per task, for the strip of task cells.
export function strip(ex, state) {
  const tasks = state?.t ?? {};
  return ex.tasks.map((task, n) => {
    const t = readTask(ex, tasks[task.i]);
    const status = taskStatus(t);
    return { n: n + 1, i: task.i, status, points: t.points, max: task.max, level: task.level, q: task.q, section: task.section, varied: task.varied,
      label: `Naloga ${n + 1}: ${STATUS[status]}${t.done ? `, ${num(t.points)} od ${task.max} t` : ''}` };
  });
}
export const statusText = STATUS;
const blank = () => ({ state: {}, score: 0, done: 0, hints: 0, solutions: 0, started: false, completedAt: null, updatedAt: null, attempt: 1, time: { Teorija: 0, Simulacija: 0, Naloge: 0 }, seconds: 0, prev: null, lastSeen: null });
// progress[userId][exerciseId] for a set of users
export async function progressFor(userIds) {
  const out = new Map(userIds.map((id) => [id, new Map()]));
  if (!userIds.length) return out;
  const get = (u, e) => {
    const m = out.get(u);
    if (!m.has(e)) m.set(e, blank());
    return m.get(e);
  };
  for (const p of await many('SELECT * FROM progress WHERE user_id = ANY($1)', [userIds])) {
    if (!byId.has(p.exercise_id)) continue;
    Object.assign(get(p.user_id, p.exercise_id), { state: p.state, score: p.score, done: p.done_count, hints: p.hint_count, solutions: p.solution_count, started: true, completedAt: p.completed_at, updatedAt: p.updated_at, attempt: p.attempt });
  }
  for (const r of await many('SELECT user_id, exercise_id, chapter, sum(seconds)::int AS s, max(last_seen) AS last FROM page_time WHERE user_id = ANY($1) GROUP BY 1,2,3', [userIds])) {
    if (!byId.has(r.exercise_id)) continue;
    const x = get(r.user_id, r.exercise_id);
    x.time[r.chapter] = r.s;
    x.seconds += r.s;
    if (!x.lastSeen || r.last > x.lastSeen) x.lastSeen = r.last;
  }
  // The score before the last reset counts until the student answers a task in the new attempt.
  for (const r of await many('SELECT user_id, exercise_id, score, done_count, created_at FROM resets WHERE user_id = ANY($1)', [userIds])) {
    if (!byId.has(r.exercise_id)) continue;
    const x = get(r.user_id, r.exercise_id);
    x.prev = { score: Number(r.score), done: r.done_count, at: r.created_at, counts: x.done === 0 };
    if (x.done === 0) { x.score = Number(r.score); x.done = r.done_count; }
  }
  return out;
}
export const cell = (map, exId) => map?.get(exId) ?? blank();
export const latest = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
// Points and tasks count only the given exercises (the ones open to the class); time counts everything.
export function rollup(map, onlyIds) {
  const r = { score: 0, done: 0, seconds: 0, last: null, time: { Teorija: 0, Simulacija: 0, Naloge: 0 } };
  for (const [id, c] of map?.entries() ?? []) {
    if (!onlyIds || onlyIds.has(id)) { r.score += c.score; r.done += c.done; }
    r.seconds += c.seconds;
    r.last = latest(r.last, latest(c.updatedAt, c.lastSeen));
    for (const ch of CHAPTERS) r.time[ch] += c.time[ch] || 0;
  }
  return r;
}
