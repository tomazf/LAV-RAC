// The student's activity over time, for the teacher's student page: answers per day, or per week on a long range.
// Pure functions of the events, so the page and the tests share one definition.
import { count, date, dayKey, dayLabel, NAMIGOV, ODGOVOROV, time } from './format.js';

export const RANGES = [
  { id: '7', label: '7 dni', days: 7 },
  { id: '30', label: '30 dni', days: 30 },
  { id: '90', label: '90 dni', days: 90 },
  { id: 'leto', label: 'Šolsko leto' },
  { id: 'vse', label: 'Vse' },
];
export const DEFAULT_RANGE = '30';
export const pickRange = (id) => RANGES.find((r) => r.id === id) ?? RANGES.find((r) => r.id === DEFAULT_RANGE);
// Up to this many days every day gets its own bar; a longer range is drawn per week.
export const MAX_DAILY = 92;
const MIN_ALL = 7;

// Day keys are "YYYY-MM-DD" in the portal's time zone; arithmetic on them goes through UTC midnights, so no day is ever 23 or 25 hours.
const DAY = 864e5;
const ms = (k) => Date.parse(`${k}T00:00:00Z`);
const keyOf = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (k, n) => keyOf(ms(k) + n * DAY);
export const weekStart = (k) => addDays(k, -((new Date(ms(k)).getUTCDay() + 6) % 7));
// The school year runs from 1 September.
export const schoolYearStart = (k) => `${Number(k.slice(5, 7)) >= 9 ? Number(k.slice(0, 4)) : Number(k.slice(0, 4)) - 1}-09-01`;
const schoolYearName = (k) => { const y = Number(k.slice(0, 4)); return `${y}/${String(y + 1).slice(2)}`; };

const OUTCOMES = [['correct', 'pravilno'], ['partial', 'pravilno z namigom'], ['wrong', 'napačno'], ['solution', 'ogledana rešitev'], ['self', 'sam preveril']];
const tasksText = (nums) => (nums.length === 1 ? `naloga ${nums[0]}` : nums.length <= 8 ? `naloge ${nums.join(', ')}` : count(nums.length, ['naloga', 'nalogi', 'naloge', 'nalog']));

/**
 * events: rows of task_events (kind, exercise_id, task_index, created_at).
 * exercises: [{ id, no, title, strip: [{ i, n }] }], which gives each task its number on the exercise.
 * today: day key of the current day.
 */
export function buildTimeline(events, exercises, rangeId, today) {
  const range = pickRange(rangeId);
  const numbers = new Map(exercises.map((e) => [e.id, new Map(e.strip.map((t) => [t.i, t.n]))]));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const dayOf = (ev) => dayKey(ev.created_at);

  let from;
  if (range.days) from = addDays(today, -(range.days - 1));
  else if (range.id === 'leto') from = schoolYearStart(today);
  else {
    const first = events.reduce((a, ev) => { const d = dayOf(ev); return !a || d < a ? d : a; }, null);
    from = first && first < addDays(today, -(MIN_ALL - 1)) ? first : addDays(today, -(MIN_ALL - 1));
  }
  const weekly = (ms(today) - ms(from)) / DAY + 1 > MAX_DAILY;
  if (weekly) from = weekStart(from);
  const step = weekly ? 7 : 1;

  const buckets = [];
  for (let k = from; k <= today; k = addDays(k, step)) {
    buckets.push({ start: k, end: weekly ? addDays(k, 6) : k, answers: 0, hints: 0, kinds: {}, tasks: new Map(), first: null, last: null });
  }
  for (const ev of events) {
    const d = dayOf(ev);
    if (d < from || d > today) continue;
    const b = buckets[Math.floor((ms(d) - ms(from)) / DAY / step)];
    if (ev.kind === 'hint') b.hints++;
    else { b.answers++; b.kinds[ev.kind] = (b.kinds[ev.kind] ?? 0) + 1; }
    const n = numbers.get(ev.exercise_id)?.get(ev.task_index);
    if (byId.has(ev.exercise_id) && n) {
      if (!b.tasks.has(ev.exercise_id)) b.tasks.set(ev.exercise_id, new Set());
      b.tasks.get(ev.exercise_id).add(n);
    }
    const t = new Date(ev.created_at).getTime();
    if (b.first === null || t < b.first) b.first = t;
    if (b.last === null || t > b.last) b.last = t;
  }

  const peak = Math.max(1, ...buckets.map((b) => b.answers));
  const shaped = buckets.map((b) => {
    const label = weekly ? `${date(b.start)} – ${date(b.end)}` : dayLabel(b.start);
    const exs = [...b.tasks].map(([id, set]) => { const nums = [...set].sort((x, y) => x - y); return { no: byId.get(id).no, title: byId.get(id).title, nums, text: tasksText(nums) }; })
      .sort((x, y) => String(x.no).localeCompare(String(y.no), 'sl', { numeric: true }));
    const outcomes = OUTCOMES.filter(([k]) => b.kinds[k]).map(([k, text]) => ({ text, n: b.kinds[k] }));
    const head = [b.answers ? count(b.answers, ODGOVOROV) : '', b.hints ? count(b.hints, NAMIGOV) : ''].filter(Boolean).join(', ');
    const hours = !weekly && b.first !== null ? (time(b.first) === time(b.last) ? time(b.first) : `${time(b.first)}–${time(b.last)}`) : '';
    const aria = [`${label}: ${head || 'brez odgovorov'}`,
      ...exs.map((e) => `vaja ${e.no}, ${e.text}`), outcomes.length ? outcomes.map((o) => `${o.text} ${o.n}`).join(', ') : ''].filter(Boolean).join('. ');
    return { start: b.start, end: b.end, label, answers: b.answers, hints: b.hints, head, hours, exs, outcomes, aria, short: `${label}: ${b.answers}`,
      height: b.answers ? Math.max(8, Math.round((b.answers / peak) * 100)) : 3 };
  });
  const title = range.days ? `Odgovori v zadnjih ${range.days} dneh`
    : range.id === 'leto' ? `Odgovori v šolskem letu ${schoolYearName(schoolYearStart(today))}` : 'Odgovori od začetka';
  return { range, weekly, unit: weekly ? 'teden' : 'dan', title, from, to: today, peak, buckets: shaped };
}
