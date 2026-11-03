import express from 'express';
import { checkCsrf, isAdmin, requireTeacher } from '../auth.js';
import { arranged, byId, CHAPTERS } from '../catalog.js';
import { audit, many, one, q, tx } from '../db.js';
import { csvCell, dayKey, date, duration, num, pct } from '../format.js';
import { readTask } from '../progress.js';
import { cell, progressFor, rollup, strip } from '../stats.js';

export const teacherRouter = express.Router();
teacherRouter.use(requireTeacher);

const waitingUsers = async () => (await many(
  `SELECT u.id, u.name, u.username, u.email, u.created_at FROM users u
   WHERE u.role='user' AND NOT EXISTS (SELECT 1 FROM class_members m WHERE m.user_id=u.id)
   ORDER BY u.name`,
)).filter((u) => !isAdmin(u));
async function loadClass(req, res, next) {
  try {
    const c = await one('SELECT c.*, u.name AS owner_name FROM classes c LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=$1', [Number(req.params.id) || 0]);
    if (!c || (!req.user.isAdmin && c.owner_id !== req.user.id)) {
      return res.status(404).render('error', { title: 'Razred ne obstaja', message: 'Razred je bil izbrisan ali ni tvoj.' });
    }
    req.cls = c;
    next();
  } catch (e) { next(e); }
}
const members = (classId) => many(
  `SELECT u.id, u.name, u.username, u.email, u.last_login_at, m.added_at FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=$1 ORDER BY u.name`, [classId],
);
const exerciseList = async () => (await arranged({ includeHidden: true })).flatMap((m) => m.exercises);

teacherRouter.get('/', async (req, res, next) => {
  try {
    const classes = await many(
      `SELECT c.id, c.name, u.name AS owner_name, c.owner_id, count(m.user_id)::int AS students FROM classes c
       LEFT JOIN class_members m ON m.class_id=c.id LEFT JOIN users u ON u.id=c.owner_id
       WHERE ($1 OR c.owner_id=$2) GROUP BY c.id, u.name ORDER BY c.name`, [req.user.isAdmin, req.user.id],
    );
    const list = await exerciseList();
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    for (const c of classes) {
      const ms = await members(c.id);
      const map = await progressFor(ms.map((m) => m.id));
      const rolled = ms.map((m) => rollup(map.get(m.id)));
      c.avg = ms.length ? Math.round(rolled.reduce((a, r) => a + pct(r.score, maxPoints), 0) / ms.length) : 0;
      c.activeWeek = rolled.filter((r) => r.last && Date.now() - new Date(r.last) < 7 * 864e5).length;
    }
    const waiting = await waitingUsers();
    res.render('teacher/index', { classes, waiting });
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi', checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.redirect('/ucitelj');
    const c = await one('INSERT INTO classes(name, owner_id) VALUES($1,$2) RETURNING id', [name, req.user.id]);
    await audit(req.user, 'Ustvaril razred', name);
    res.redirect(`/ucitelj/razredi/${c.id}`);
  } catch (e) { next(e); }
});
const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'sl'),
  score: (a, b) => b.total.score - a.total.score,
  time: (a, b) => b.total.seconds - a.total.seconds,
  last: (a, b) => new Date(b.total.last || 0) - new Date(a.total.last || 0),
};
teacherRouter.get('/razredi/:id', loadClass, async (req, res, next) => {
  try {
    const ms = await members(req.cls.id);
    const list = await exerciseList();
    const map = await progressFor(ms.map((m) => m.id));
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    const maxTasks = list.reduce((a, e) => a + e.tasks.length, 0);
    const sort = SORTS[req.query.sort] ? req.query.sort : 'name';
    const rows = ms.map((m) => ({ ...m, total: rollup(map.get(m.id)), cells: map.get(m.id) })).sort(SORTS[sort]);
    const stats = {
      avg: rows.length ? Math.round(rows.reduce((a, r) => a + pct(r.total.score, maxPoints), 0) / rows.length) : 0,
      active: rows.filter((r) => r.total.last && Date.now() - new Date(r.total.last) < 7 * 864e5).length,
      never: rows.filter((r) => !r.total.last).length,
      seconds: rows.length ? rows.reduce((a, r) => a + r.total.seconds, 0) / rows.length : 0,
    };
    res.render('teacher/class', { cls: req.cls, rows, list, cell, maxPoints, maxTasks, stats, sort, waiting: await waitingUsers() });
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/dodaj', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const ids = [].concat(req.body.user ?? []).map(Number).filter(Boolean);
    await tx(async (c) => {
      for (const id of ids) {
        await c.query(
          `INSERT INTO class_members(class_id, user_id, added_by) SELECT $1, u.id, $3 FROM users u WHERE u.id=$2 ON CONFLICT DO NOTHING`,
          [req.cls.id, id, req.user.id],
        );
      }
    });
    if (ids.length) await audit(req.user, 'Dodal dijake v razred', `${req.cls.name}: ${ids.length}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/odstrani', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const u = await one('SELECT name FROM users WHERE id=$1', [Number(req.body.user) || 0]);
    await q('DELETE FROM class_members WHERE class_id=$1 AND user_id=$2', [req.cls.id, Number(req.body.user) || 0]);
    if (u) await audit(req.user, 'Odstranil dijaka iz razreda', `${req.cls.name}: ${u.name}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/preimenuj', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (name) await q('UPDATE classes SET name=$2 WHERE id=$1', [req.cls.id, name]);
    res.redirect(`/ucitelj/razredi/${req.cls.id}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/izbrisi', loadClass, checkCsrf, async (req, res, next) => {
  try {
    await q('DELETE FROM classes WHERE id=$1', [req.cls.id]);
    await audit(req.user, 'Izbrisal razred', req.cls.name);
    res.redirect('/ucitelj');
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/izvoz.csv', loadClass, async (req, res, next) => {
  try {
    const ms = await members(req.cls.id);
    const list = await exerciseList();
    const map = await progressFor(ms.map((m) => m.id));
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    const head = ['Dijak', 'Račun', ...list.flatMap((e) => [`${e.id} točke (od ${e.maxPoints})`, `${e.id} naloge (od ${e.tasks.length})`, `${e.id} čas (min)`, `${e.id} ponastavitve`]), `Skupaj točke (od ${maxPoints})`, 'Skupaj %', 'Skupaj čas (min)', 'Zadnja aktivnost'];
    const lines = [head.map(csvCell).join(';')];
    for (const m of ms) {
      const t = rollup(map.get(m.id));
      lines.push([m.name, m.email || m.username, ...list.flatMap((e) => {
        const c = cell(map.get(m.id), e.id);
        return [num(c.score), c.done, Math.round(c.seconds / 60), c.resets];
      }), num(t.score), pct(t.score, maxPoints), Math.round(t.seconds / 60), date(t.last)].map(csvCell).join(';'));
    }
    const safe = req.cls.name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`LAV-ELS_${safe}.csv`)}`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/vaje/:eid', loadClass, async (req, res, next) => {
  try {
    const ex = byId.get(req.params.eid);
    if (!ex) return res.status(404).render('error', { title: 'Vaja ne obstaja', message: 'Povezava je napačna.' });
    const ms = await members(req.cls.id);
    const map = await progressFor(ms.map((m) => m.id));
    const students = ms.map((m) => {
      const c = cell(map.get(m.id), ex.id);
      return { ...m, c, strip: strip(ex, c.state) };
    });
    const tasks = ex.tasks.map((t, n) => {
      const r = { n: n + 1, ...t, answered: 0, right: 0, hints: 0, solutions: 0 };
      for (const s of students) {
        const x = readTask(ex, s.c.state?.t?.[t.i]);
        if (x.hinted) r.hints++;
        if (x.done) {
          r.answered++;
          if (x.solution) r.solutions++;
          else if (x.points > 0) r.right++;
        }
      }
      return r;
    });
    res.render('teacher/exercise', { cls: req.cls, ex, students, tasks });
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/dijaki/:uid', loadClass, async (req, res, next) => {
  try {
    const uid = Number(req.params.uid) || 0;
    const m = (await members(req.cls.id)).find((x) => x.id === uid);
    if (!m) return res.status(404).render('error', { title: 'Dijak ni v razredu', message: 'Dijak je bil odstranjen iz razreda.' });
    const list = await exerciseList();
    const map = (await progressFor([uid])).get(uid);
    const events = await many('SELECT * FROM task_events WHERE user_id=$1 ORDER BY created_at', [uid]);
    const resets = await many('SELECT * FROM resets WHERE user_id=$1 ORDER BY created_at DESC', [uid]);
    const pages = await many('SELECT * FROM page_time WHERE user_id=$1', [uid]);
    const days = new Map();
    for (let i = 29; i >= 0; i--) days.set(dayKey(Date.now() - i * 864e5), 0);
    for (const ev of events) {
      const k = dayKey(ev.created_at);
      if (days.has(k) && ev.kind !== 'hint') days.set(k, days.get(k) + 1);
    }
    const exs = list.map((e) => {
      const c = cell(map, e.id);
      const finished = new Map();
      for (const ev of events) if (ev.exercise_id === e.id && ev.attempt === c.attempt && ev.kind !== 'hint') finished.set(ev.task_index, ev.created_at);
      return {
        ...e, c, strip: strip(e, c.state), finished,
        resets: resets.filter((r) => r.exercise_id === e.id),
        visits: e.pages.map((p) => ({ ...p, row: pages.find((r) => r.exercise_id === e.id && r.page_id === p.id) })),
      };
    });
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    const maxTasks = list.reduce((a, e) => a + e.tasks.length, 0);
    res.render('teacher/student', { cls: req.cls, m, exs, total: rollup(map), maxPoints, maxTasks, days: [...days], CHAPTERS, duration });
  } catch (e) { next(e); }
});
