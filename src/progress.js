// Pure rules for exercise state: tasks stay locked, hints stay used, points follow the series rules.
const FIELDS = {
  short: { done: 'd', points: 'p', hinted: 'h', full: 'f' },
  long: { done: 'done', points: 'pts', hinted: 'hinted', full: 'full' },
};
export const fieldsOf = (ex) => FIELDS[ex.format] || FIELDS.short;
export function readTask(ex, raw) {
  const f = fieldsOf(ex);
  const r = raw && typeof raw === 'object' ? raw : {};
  // `full` is written only as false: a task with several parts that was answered with some of them wrong (partial credit).
  return { done: r[f.done] === true, points: Number(r[f.points]) || 0, hinted: r[f.hinted] === true, solution: r.sol === true, partial: r[f.full] === false };
}
// A self task (»Sam preveri«) has no points and nothing in it can be wrong; the student only ticks it.
// A task with several parts may be answered partly right (agreed 16. 11. 2026): the points are then a share of the cap in
// halves of a point, below the cap. With a hint the cap is half of the points of the task.
function legalPoints(task, t) {
  if (task.self || !t.done || t.solution) return 0;
  const cap = t.hinted ? task.max / 2 : task.max;
  if (t.partial) {
    const p = Math.floor(Math.min(Math.max(t.points, 0), cap) * 2) / 2;
    return p >= cap ? Math.max(0, cap - 0.5) : p;
  }
  if (t.points >= cap) return cap;
  if (t.points >= task.max / 2) return task.max / 2;
  return 0;
}
function kindOf(task, t) {
  if (task.self) return 'self';
  if (t.solution) return 'solution';
  if (t.points <= 0) return 'wrong';
  if (t.partial) return 'part';
  return t.points >= task.max ? 'correct' : 'partial';
}
export function summarize(ex, state) {
  const out = { score: 0, done: 0, hints: 0, solutions: 0 };
  const tasks = state && state.t && typeof state.t === 'object' ? state.t : {};
  for (const task of ex.tasks) {
    const t = readTask(ex, tasks[task.i]);
    if (t.hinted) out.hints++;
    if (t.done) { out.done++; out.score += task.self ? 0 : t.points; if (t.solution && !task.self) out.solutions++; }
  }
  return out;
}
const MAX_FIELD = 20000;
function cleanTop(incoming) {
  const out = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 't') continue;
    if (JSON.stringify(v ?? null).length <= MAX_FIELD) out[k] = v;
  }
  return out;
}
// Pages the student has opened only ever grow, and only real pages of the exercise count.
function seenPages(ex, stored, incoming) {
  const ids = new Set((ex.pages || []).map((p) => p.id));
  const list = (s) => (Array.isArray(s?.seen) ? s.seen : []).map(String);
  return [...new Set([...list(stored), ...list(incoming)])].filter((id) => ids.has(id));
}
export function merge(ex, stored, incoming) {
  const f = fieldsOf(ex);
  const prev = stored?.t && typeof stored.t === 'object' ? stored.t : {};
  const next = incoming?.t && typeof incoming.t === 'object' ? incoming.t : {};
  const state = { ...cleanTop(incoming ?? {}), t: {} };
  // An exercise with a gate opens its tasks only after every listed page has been opened.
  if (ex.gate) {
    state.seen = seenPages(ex, stored, incoming);
    if (!state.seen.length) delete state.seen;
  }
  const gateOpen = !ex.gate || ex.gate.every((id) => state.seen?.includes(id));
  const events = [];
  for (const task of ex.tasks) {
    const key = String(task.i);
    const before = prev[key];
    const was = readTask(ex, before);
    let raw = next[key];
    if (raw && (typeof raw !== 'object' || JSON.stringify(raw).length > MAX_FIELD)) raw = undefined;
    if (was.done) {
      // A locked task never changes; only viewing the solution afterwards may be recorded.
      state.t[key] = raw?.v === true || raw?.viewed === true ? { ...before, ...(raw.v ? { v: true } : { viewed: true }) } : before;
      continue;
    }
    if (!raw) { if (before) state.t[key] = before; continue; }
    const now = readTask(ex, raw);
    if (now.done && !gateOpen) { if (before) state.t[key] = before; continue; }
    const hinted = was.hinted || now.hinted;
    const merged = { ...raw, [f.hinted]: hinted };
    if (hinted && !was.hinted) events.push({ task: task.i, kind: 'hint', points: 0 });
    if (now.done) {
      const t = { ...now, hinted };
      const pts = legalPoints(task, t);
      merged[f.points] = pts;
      merged[f.done] = true;
      events.push({ task: task.i, kind: kindOf(task, { ...t, points: pts }), points: pts });
    }
    state.t[key] = merged;
  }
  return { state, events, summary: summarize(ex, state) };
}

// A reset keeps only the score just before it, as a safety net for a reset by mistake: it counts until the student
// answers a task in the new attempt. A reset of an attempt with no answers keeps the score kept before.
export async function recordReset(c, { userId, exId, attempt, score, done, reason = 'student' }) {
  let keep = { score, done };
  if (done === 0) {
    const last = (await c.query('SELECT score, done_count FROM resets WHERE user_id=$1 AND exercise_id=$2 ORDER BY id DESC LIMIT 1', [userId, exId])).rows[0];
    if (last) keep = { score: Number(last.score), done: last.done_count };
  }
  await c.query('DELETE FROM resets WHERE user_id=$1 AND exercise_id=$2', [userId, exId]);
  await c.query('INSERT INTO resets(user_id, exercise_id, attempt, score, done_count, reason) VALUES($1,$2,$3,$4,$5,$6)', [userId, exId, attempt, keep.score, keep.done, reason]);
}
