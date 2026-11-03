import express from 'express';
import { byId, renderExercise } from '../catalog.js';
import { csrfValid, requireAccess } from '../auth.js';
import { many, one, tx } from '../db.js';
import { merge, summarize } from '../progress.js';

export const exerciseRouter = express.Router();

const visible = async (user, ex) => {
  if (!ex) return false;
  if (user.isTeacher) return true;
  const s = await one('SELECT visible FROM exercise_settings WHERE exercise_id=$1', [ex.id]);
  return s?.visible !== false;
};
const stateOk = (s) => s && typeof s === 'object' && !Array.isArray(s) && (s.t === undefined || (typeof s.t === 'object' && !Array.isArray(s.t)));

// Opens the current attempt; a new exercise version starts a new attempt, since task numbers may have moved.
async function openAttempt(user, ex) {
  return tx(async (c) => {
    await c.query(
      `INSERT INTO progress(user_id, exercise_id, content_version) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [user.id, ex.id, ex.version],
    );
    const p = (await c.query('SELECT * FROM progress WHERE user_id=$1 AND exercise_id=$2 FOR UPDATE', [user.id, ex.id])).rows[0];
    if (p.content_version === ex.version) return p;
    if (p.done_count > 0) {
      await c.query('INSERT INTO resets(user_id, exercise_id, attempt, score, done_count, reason) VALUES($1,$2,$3,$4,$5,$6)', [user.id, ex.id, p.attempt, p.score, p.done_count, 'version']);
    }
    return (await c.query(
      `UPDATE progress SET attempt=attempt+1, content_version=$3, state='{}', score=0, done_count=0, hint_count=0, solution_count=0, completed_at=NULL, updated_at=now()
       WHERE user_id=$1 AND exercise_id=$2 RETURNING *`, [user.id, ex.id, ex.version],
    )).rows[0];
  });
}

exerciseRouter.get('/vaje/:id', requireAccess, async (req, res, next) => {
  try {
    const ex = byId.get(req.params.id);
    if (!(await visible(req.user, ex))) return res.status(404).render('error', { title: 'Vaja ni na voljo', message: 'Te vaje trenutno ni na seznamu.' });
    const p = await openAttempt(req.user, ex);
    res.type('html').send(renderExercise(ex, {
      id: ex.id, title: ex.title, key: ex.key, attempt: p.attempt, uid: req.user.id, name: req.user.name, state: p.state, csrf: req.session.csrf,
    }));
  } catch (e) { next(e); }
});

exerciseRouter.post('/api/progress/:id', async (req, res, next) => {
  try {
    if (!req.user || req.user.isWaiting) return res.status(401).json({ ok: false, code: 'login' });
    if (!csrfValid(req)) return res.status(403).json({ ok: false, code: 'csrf' });
    const ex = byId.get(req.params.id);
    if (!ex || !stateOk(req.body.state)) return res.status(400).json({ ok: false, code: 'bad' });
    const result = await tx(async (c) => {
      const p = (await c.query('SELECT * FROM progress WHERE user_id=$1 AND exercise_id=$2 FOR UPDATE', [req.user.id, ex.id])).rows[0];
      if (!p) return { status: 409 };
      if (Number(req.body.attempt) !== p.attempt || p.content_version !== ex.version) return { status: 409, attempt: p.attempt };
      if (req.body.reset === true) {
        const had = summarize(ex, p.state);
        if (had.done === 0 && had.hints === 0) return { attempt: p.attempt, ...had };
        await c.query('INSERT INTO resets(user_id, exercise_id, attempt, score, done_count) VALUES($1,$2,$3,$4,$5)', [req.user.id, ex.id, p.attempt, had.score, had.done]);
        const fresh = merge(ex, {}, req.body.state);
        await c.query(`UPDATE progress SET attempt=attempt+1, state=$3, score=0, done_count=0, hint_count=0, solution_count=0, completed_at=NULL, updated_at=now() WHERE user_id=$1 AND exercise_id=$2`, [req.user.id, ex.id, { ...fresh.state, t: {} }]);
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
    if (!csrfValid(req)) return res.status(403).json({ ok: false });
    const ex = byId.get(req.params.id);
    const page = ex?.pageMap.get(String(req.body.page));
    if (!page) return res.status(400).json({ ok: false });
    const seconds = Math.max(0, Math.min(60, Math.round(Number(req.body.seconds) || 0)));
    await many(
      `INSERT INTO page_time(user_id, exercise_id, page_id, chapter, seconds) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, exercise_id, page_id) DO UPDATE SET seconds=page_time.seconds+$5, last_seen=now()`,
      [req.user.id, ex.id, page.id, page.chapter, seconds],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});
