// Pure rules for exercise state: tasks stay locked, hints stay used, points follow the series rules.
const FIELDS = {
  short: { done: 'd', points: 'p', hinted: 'h' },
  long: { done: 'done', points: 'pts', hinted: 'hinted' },
};
export const fieldsOf = (ex) => FIELDS[ex.format] || FIELDS.short;
export function readTask(ex, raw) {
  const f = fieldsOf(ex);
  const r = raw && typeof raw === 'object' ? raw : {};
  return { done: r[f.done] === true, points: Number(r[f.points]) || 0, hinted: r[f.hinted] === true, solution: r.sol === true };
}
function legalPoints(task, t) {
  if (!t.done || t.solution) return 0;
  const cap = t.hinted ? task.max / 2 : task.max;
  if (t.points >= cap) return cap;
  if (t.points >= task.max / 2) return task.max / 2;
  return 0;
}
function kindOf(task, t) {
  if (t.solution) return 'solution';
  if (t.points <= 0) return 'wrong';
  return t.points >= task.max ? 'correct' : 'partial';
}
export function summarize(ex, state) {
  const out = { score: 0, done: 0, hints: 0, solutions: 0 };
  const tasks = state && state.t && typeof state.t === 'object' ? state.t : {};
  for (const task of ex.tasks) {
    const t = readTask(ex, tasks[task.i]);
    if (t.hinted) out.hints++;
    if (t.done) { out.done++; out.score += t.points; if (t.solution) out.solutions++; }
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
export function merge(ex, stored, incoming) {
  const f = fieldsOf(ex);
  const prev = stored?.t && typeof stored.t === 'object' ? stored.t : {};
  const next = incoming?.t && typeof incoming.t === 'object' ? incoming.t : {};
  const state = { ...cleanTop(incoming ?? {}), t: {} };
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
