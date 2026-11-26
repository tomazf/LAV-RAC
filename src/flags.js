// Unusual answers are flagged for the teacher (agreed 26. 11. 2026). Nothing is refused and no points change: a flag is a
// record the teacher confirms or dismisses. The rules are pure functions of numbers, so they can be tested without a database.
import { many } from './db.js';

// Thresholds in one place, to be tuned after the first weeks of use.
export const LIMITS = {
  burst: 3,            // tasks that got points in one request; the page sends after every task (a pause of 0.4 s)
  fastTasks: 10,       // at least this many tasks with points in the attempt ...
  fastSeconds: 5,      // ... and fewer seconds than this per task on all the pages of the exercise
};
export const AWARDED = ['correct', 'partial', 'part'];
export const RULES = {
  burst: 'Več nalog naenkrat',
  fast: 'Prehitro reševanje',
};
export const STATUS = { open: 'Čaka na odločitev', confirmed: 'Potrjeno', dismissed: 'Razveljavljeno' };
const awarded = (events) => events.filter((e) => AWARDED.includes(e.kind)).length;

// events: what one request recorded; tasks: tasks with points in the attempt; seconds: time on all pages of the exercise.
export function evaluate({ events, tasks, seconds }) {
  const out = [];
  const now = awarded(events);
  if (now >= LIMITS.burst) out.push({ rule: 'burst', detail: { tasks: now } });
  if (now > 0 && tasks >= LIMITS.fastTasks && seconds < tasks * LIMITS.fastSeconds) out.push({ rule: 'fast', detail: { tasks, seconds } });
  return out;
}

// Called inside the transaction that records an answer. Students only: staff open exercises to look, not to be marked.
export async function detect(c, { user, ex, attempt, events }) {
  if (user.isTeacher || user.isObserver || !awarded(events)) return;
  const tasks = (await c.query(
    `SELECT count(*) AS n FROM task_events WHERE user_id=$1 AND exercise_id=$2 AND attempt=$3 AND kind = ANY($4)`,
    [user.id, ex.id, attempt, AWARDED],
  )).rows[0].n;
  const seconds = (await c.query('SELECT COALESCE(sum(seconds),0) AS s FROM page_time WHERE user_id=$1 AND exercise_id=$2', [user.id, ex.id])).rows[0].s;
  for (const f of evaluate({ events, tasks: Number(tasks), seconds: Number(seconds) })) {
    await c.query(
      'INSERT INTO flags(user_id, exercise_id, attempt, rule, detail) VALUES($1,$2,$3,$4,$5) ON CONFLICT (user_id, exercise_id, attempt, rule) DO NOTHING',
      [user.id, ex.id, attempt, f.rule, f.detail],
    );
  }
}

const mins = (s) => (s < 90 ? `${s} s` : `${Math.round(s / 60)} min`);
// The sentence the teacher reads; the student reads a neutral one (see `notice`).
export function describe(f) {
  const d = f.detail || {};
  if (f.rule === 'burst') return `${d.tasks} nalog je dobilo točke v enem samem zahtevku. Običajno se odgovor pošlje po vsaki nalogi posebej.`;
  if (f.rule === 'fast') return `${d.tasks} nalog s točkami, skupni čas na straneh vaje pa je le ${mins(d.seconds)}.`;
  return 'Nenavaden vzorec odgovorov.';
}
export const label = (f) => RULES[f.rule] || 'Opozorilo';

// Flags of the given students, only for the exercises the class sees (like events). Oldest first.
export async function flagsFor(userIds, exerciseIds) {
  if (!userIds.length) return new Map();
  const rows = await many(
    `SELECT f.*, u.name AS decided_name FROM flags f LEFT JOIN users u ON u.id=f.decided_by
     WHERE f.user_id = ANY($1) AND f.exercise_id = ANY($2) ORDER BY f.created_at`,
    [userIds, [...exerciseIds]],
  );
  const map = new Map();
  for (const f of rows) {
    if (!map.has(f.user_id)) map.set(f.user_id, []);
    map.get(f.user_id).push(f);
  }
  return map;
}
// The student's confirmed flags, one line each, for the notice in the portal and in the exercise.
export const confirmedFor = (userId) => many(
  `SELECT exercise_id, max(decided_at) AS at FROM flags WHERE user_id=$1 AND status='confirmed' GROUP BY exercise_id ORDER BY max(decided_at) DESC`, [userId],
);
export const notice = (titles) =>
  `Učitelj je označil odgovore pri vaji ${titles.join(', ')} kot nenavadne. Če meniš, da je to napaka, se pogovori z njim.`;
