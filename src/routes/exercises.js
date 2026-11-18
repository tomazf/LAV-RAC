import crypto from 'node:crypto';
import express from 'express';
import { byId, inYear, pastYear, renderExercise, yearOf } from '../catalog.js';
import { csrfValid, requireAccess } from '../auth.js';
import { many, one, tx } from '../db.js';
import { merge, summarize, recordReset } from '../progress.js';

export const exerciseRouter = express.Router();

const canOpen = async (user, ex) => {
  if (!ex) return false;
  if (user.isTeacher) return true;
  // A supervisor sees the chosen years as a whole, the standard way; they have no class.
  if (user.isObserver) return user.observer_years.includes(yearOf(ex.module));
  const s = await one(
    `SELECT c.year, c.past_years, x.visible FROM classes c LEFT JOIN class_exercises x ON x.class_id=c.id AND x.exercise_id=$2 WHERE c.id=$1`,
    [user.class_id, ex.id],
  );
  if (!s) return false;
  // A lower year is open as a whole when the class may revisit it; the class's own year only as the teacher opened it.
  if (pastYear(s.year, ex.module)) return s.past_years.includes(yearOf(ex.module));
  return inYear(s.year, ex.module) && s.visible === true;
};
const stateOk = (s) => s && typeof s === 'object' && !Array.isArray(s) && (s.t === undefined || (typeof s.t === 'object' && !Array.isArray(s.t)));

// Tasks already started when numbers are first assigned keep their original numbers.
async function withSeed(c, user, ex, p) {
  if (!ex.hasVariants || p.variant_seed !== null) return p;
  const keep = Object.keys(p.state?.t ?? {}).map(Number).filter(Number.isInteger);
  return (await c.query(
    'UPDATE progress SET variant_seed=$3, variant_keep=$4 WHERE user_id=$1 AND exercise_id=$2 RETURNING *',
    [user.id, ex.id, crypto.randomInt(1, 2147483647), keep],
  )).rows[0];
}

// Opens the current attempt; a new exercise version starts a new attempt, since task numbers may have moved.
async function openAttempt(user, ex) {
  return tx(async (c) => {
    await c.query(
      `INSERT INTO progress(user_id, exercise_id, content_version) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [user.id, ex.id, ex.version],
    );
    const p = (await c.query('SELECT * FROM progress WHERE user_id=$1 AND exercise_id=$2 FOR UPDATE', [user.id, ex.id])).rows[0];
    if (p.content_version === ex.version) return withSeed(c, user, ex, p);
    if (p.done_count > 0) {
      await recordReset(c, { userId: user.id, exId: ex.id, attempt: p.attempt, score: Number(p.score), done: p.done_count, reason: 'version' });
    }
    const fresh = (await c.query(
      `UPDATE progress SET attempt=attempt+1, content_version=$3, state='{}', score=0, done_count=0, hint_count=0, solution_count=0, completed_at=NULL, updated_at=now(),
         variant_seed=NULL, variant_keep='{}'
       WHERE user_id=$1 AND exercise_id=$2 RETURNING *`, [user.id, ex.id, ex.version],
    )).rows[0];
    return withSeed(c, user, ex, fresh);
  });
}

exerciseRouter.get('/vaje/:id', requireAccess, async (req, res, next) => {
  try {
    const ex = byId.get(req.params.id);
    if (!(await canOpen(req.user, ex))) return res.status(404).render('error', { title: 'Vaja ni na voljo', message: 'Učitelj te vaje še ni odprl za tvoj razred.' });
    // A supervisor gets the exercise read-only: no progress row, no tracker, the solutions shown (staff) and a fixed variant.
    if (req.user.isObserver) {
      return res.type('html').send(renderExercise(ex, {
        id: ex.id, no: ex.no, title: ex.title, key: ex.key, attempt: 0, uid: req.user.id, name: req.user.name, state: {}, csrf: req.session.csrf, staff: true, readOnly: true,
        variant: ex.hasVariants ? { seed: 1, keep: [] } : null,
      }));
    }
    const p = await openAttempt(req.user, ex);
    res.type('html').send(renderExercise(ex, {
      id: ex.id, no: ex.no, title: ex.title, key: ex.key, attempt: p.attempt, uid: req.user.id, name: req.user.name, state: p.state, csrf: req.session.csrf, staff: req.user.isTeacher,
      variant: ex.hasVariants ? { seed: p.variant_seed, keep: p.variant_keep } : null,
    }));
  } catch (e) { next(e); }
});

exerciseRouter.post('/api/progress/:id', async (req, res, next) => {
  try {
    if (!req.user || req.user.isWaiting) return res.status(401).json({ ok: false, code: 'login' });
    if (req.user.isObserver) return res.status(403).json({ ok: false, code: 'readonly' });
    if (!csrfValid(req)) return res.status(403).json({ ok: false, code: 'csrf' });
    const ex = byId.get(req.params.id);
    if (!ex || !stateOk(req.body.state)) return res.status(400).json({ ok: false, code: 'bad' });
    if (!(await canOpen(req.user, ex))) return res.status(403).json({ ok: false, code: 'closed' });
    const result = await tx(async (c) => {
      const p = (await c.query('SELECT * FROM progress WHERE user_id=$1 AND exercise_id=$2 FOR UPDATE', [req.user.id, ex.id])).rows[0];
      if (!p) return { status: 409 };
      if (Number(req.body.attempt) !== p.attempt || p.content_version !== ex.version) return { status: 409, attempt: p.attempt };
      if (req.body.reset === true) {
        const had = summarize(ex, p.state);
        if (had.done === 0 && had.hints === 0) return { attempt: p.attempt, ...had };
        await recordReset(c, { userId: req.user.id, exId: ex.id, attempt: p.attempt, score: had.score, done: had.done });
        const fresh = merge(ex, {}, req.body.state);
        await c.query(`UPDATE progress SET attempt=attempt+1, state=$3, score=0, done_count=0, hint_count=0, solution_count=0, completed_at=NULL, updated_at=now(), variant_seed=NULL, variant_keep='{}' WHERE user_id=$1 AND exercise_id=$2`, [req.user.id, ex.id, { ...fresh.state, t: {} }]);
        return { attempt: p.attempt + 1, score: 0, done: 0 };
      }
      const { state, events, summary } = merge(ex, p.state, req.body.state);
      const changed = JSON.stringify(state) !== JSON.stringify(p.state);
      if (changed) {
        const complete = summary.done === ex.tasks.length;
        await c.query(
          `UPDATE progress SET state=$3, score=$4, done_count=$5, hint_count=$6, solution_count=$7, updated_at=now(),
             completed_at=CASE WHEN $8::boolean THEN COALESCE(completed_at, now()) ELSE NULL END
           WHERE user_id=$1 AND exercise_id=$2`,
          [req.user.id, ex.id, state, summary.score, summary.done, summary.hints, summary.solutions, complete],
        );
        for (const ev of events) {
          await c.query('INSERT INTO task_events(user_id, exercise_id, attempt, task_index, kind, points) VALUES($1,$2,$3,$4,$5,$6)', [req.user.id, ex.id, p.attempt, ev.task, ev.kind, ev.points]);
        }
      }
      return { attempt: p.attempt, score: summary.score, done: summary.done };
    });
    if (result.status) return res.status(result.status).json({ ok: false, code: 'attempt', attempt: result.attempt });
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

// Time is counted by the browser only while the tab is visible and the student is active.
exerciseRouter.post('/api/time/:id', async (req, res, next) => {
  try {
    if (!req.user || req.user.isWaiting) return res.status(401).json({ ok: false });
    if (req.user.isObserver) return res.status(403).json({ ok: false, code: 'readonly' });
    if (!csrfValid(req)) return res.status(403).json({ ok: false });
    const ex = byId.get(req.params.id);
    const page = ex?.pageMap.get(String(req.body.page));
    if (!page) return res.status(400).json({ ok: false });
    if (!(await canOpen(req.user, ex))) return res.status(403).json({ ok: false, code: 'closed' });
    const seconds = Math.max(0, Math.min(60, Math.round(Number(req.body.seconds) || 0)));
    await many(
      `INSERT INTO page_time(user_id, exercise_id, page_id, chapter, seconds) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, exercise_id, page_id) DO UPDATE SET seconds=page_time.seconds+$5, last_seen=now()`,
      [req.user.id, ex.id, page.id, page.chapter, seconds],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
