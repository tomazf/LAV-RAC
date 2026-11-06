import express from 'express';
import { checkCsrf, isAdmin, requireTeacher } from '../auth.js';
import { byId, classGroups, CHAPTERS, ensureClassRows, inYear, plannedIn, plannedModules } from '../catalog.js';
import { audit, many, one, q, tx } from '../db.js';
import { portal } from '../portal.js';
import { byName, bySurname, csvCell, dayKey, date, duration, num, pct } from '../format.js';
import { readTask, summarize } from '../progress.js';
import { cell, progressFor, rollup, strip } from '../stats.js';

export const teacherRouter = express.Router();
teacherRouter.use(requireTeacher);

// Listed by name; each person also carries their place in the order by surname, so the page can switch without a reload.
const unassignedUsers = async () => {
  const people = (await many(
    `SELECT u.id, u.name, u.username, u.email, u.created_at FROM users u
     WHERE u.role='user' AND NOT EXISTS (SELECT 1 FROM class_members m WHERE m.user_id=u.id)`,
  )).filter((u) => !isAdmin(u));
  const place = (order) => new Map(order.map((u, i) => [u.id, i]));
  const nameAt = place([...people].sort(byName));
  const surnameAt = place([...people].sort(bySurname));
  return people.map((u) => ({ ...u, nameAt: nameAt.get(u.id), surnameAt: surnameAt.get(u.id) })).sort((a, b) => a.nameAt - b.nameAt);
};
const teachersOf = async (classId) => (await many(
  'SELECT u.id, u.name FROM class_teachers t JOIN users u ON u.id=t.user_id WHERE t.class_id=$1', [classId],
)).sort(byName);
// Teachers manage only classes they have joined; the admin manages every class.
async function loadClass(req, res, next) {
  try {
    const c = await one('SELECT * FROM classes WHERE id=$1', [Number(req.params.id) || 0]);
    if (!c) return res.status(404).render('error', { title: 'Razred ne obstaja', message: 'Razred je bil izbrisan.' });
    const member = await one('SELECT 1 AS yes FROM class_teachers WHERE class_id=$1 AND user_id=$2', [c.id, req.user.id]);
    if (!member && !req.user.isAdmin) {
      return res.status(404).render('error', { title: 'Razred ni tvoj', message: 'Najprej se pridruži razredu na strani Razredi.' });
    }
    c.iTeach = !!member;
    req.cls = c;
    next();
  } catch (e) { next(e); }
}
const members = async (classId) => (await many(
  `SELECT u.id, u.name, u.username, u.email, u.last_login_at, m.added_at FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=$1`, [classId],
)).sort(byName);
const exerciseList = async (classId) => (await classGroups(classId)).flatMap((m) => m.exercises);
// A class sees only its year; progress in other exercises (lower years) is the student's own and stays out of every view.
const ofList = (map, list) => {
  const ids = new Set(list.map((e) => e.id));
  for (const m of map.values()) for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id);
  return map;
};
const exerciseOf = (req) => {
  const ex = byId.get(req.params.eid);
  return ex && inYear(req.cls.year, ex.module) ? ex : null;
};
const sums = (list) => ({
  maxPoints: list.reduce((a, e) => a + e.maxPoints, 0),
  maxTasks: list.reduce((a, e) => a + e.tasks.length, 0),
  ids: new Set(list.map((e) => e.id)),
});

teacherRouter.get('/', async (req, res, next) => {
  try {
    const classes = await many(
      `SELECT c.id, c.name,
         (SELECT count(*)::int FROM class_members m WHERE m.class_id=c.id) AS students,
         (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM class_teachers t JOIN users u ON u.id=t.user_id WHERE t.class_id=c.id) AS teachers,
         EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=$1) AS mine
       FROM classes c ORDER BY c.name`, [req.user.id],
    );
    const mine = classes.filter((c) => c.mine);
    const others = classes.filter((c) => !c.mine);
    for (const c of req.user.isAdmin ? classes : mine) {
      const ms = await members(c.id);
      const list = await exerciseList(c.id);
      const open = sums(list.filter((e) => e.visible));
      c.open_count = open.ids.size;
      c.total = list.length;
      const map = ofList(await progressFor(ms.map((m) => m.id)), list);
      const rolled = ms.map((m) => rollup(map.get(m.id), open.ids));
      c.avg = ms.length ? Math.round(rolled.reduce((a, r) => a + pct(r.score, open.maxPoints), 0) / ms.length) : 0;
      c.activeWeek = rolled.filter((r) => r.last && Date.now() - new Date(r.last) < 7 * 864e5).length;
    }
    res.render('teacher/index', { mine, others, unassigned: await unassignedUsers() });
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/pridruzi', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('SELECT id, name FROM classes WHERE id=$1', [Number(req.params.id) || 0]);
    if (!c) return res.redirect('/ucitelj');
    await q('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [c.id, req.user.id]);
    await audit(req.user, 'Pridružil se je razredu', c.name);
    res.redirect(`/ucitelj/razredi/${c.id}`);
  } catch (e) { next(e); }
});
const SORTS = {
  name: byName,
  surname: bySurname,
  score: (a, b) => b.total.score - a.total.score,
  time: (a, b) => b.total.seconds - a.total.seconds,
  last: (a, b) => new Date(b.total.last || 0) - new Date(a.total.last || 0),
};
teacherRouter.get('/razredi/:id', loadClass, async (req, res, next) => {
  try {
    const ms = await members(req.cls.id);
    const list = await exerciseList(req.cls.id);
    const open = sums(list.filter((e) => e.visible));
    const map = ofList(await progressFor(ms.map((m) => m.id)), list);
    const sort = SORTS[req.query.sort] ? req.query.sort : 'name';
    const rows = ms.map((m) => ({ ...m, total: rollup(map.get(m.id), open.ids), cells: map.get(m.id) })).sort(SORTS[sort]);
    const stats = {
      avg: rows.length ? Math.round(rows.reduce((a, r) => a + pct(r.total.score, open.maxPoints), 0) / rows.length) : 0,
      active: rows.filter((r) => r.total.last && Date.now() - new Date(r.total.last) < 7 * 864e5).length,
      never: rows.filter((r) => !r.total.last).length,
      seconds: rows.length ? rows.reduce((a, r) => a + r.total.seconds, 0) / rows.length : 0,
    };
    res.render('teacher/class', {
      cls: req.cls, rows, list, cell, maxPoints: open.maxPoints, openCount: open.ids.size, stats, sort,
      unassigned: await unassignedUsers(), teachers: await teachersOf(req.cls.id),
    });
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/dodaj', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const ids = [].concat(req.body.user ?? []).map(Number).filter(Boolean);
    let added = 0;
    await tx(async (c) => {
      for (const id of ids) {
        // Only people without a class and without a teacher role can be added; a student has one class.
        const r = await c.query(
          `INSERT INTO class_members(class_id, user_id, added_by) SELECT $1, u.id, $3 FROM users u WHERE u.id=$2 AND u.role='user'
           ON CONFLICT DO NOTHING`, [req.cls.id, id, req.user.id],
        );
        added += r.rowCount;
      }
    });
    if (added) await audit(req.user, 'Dodal dijake v razred', `${req.cls.name}: ${added}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/odstrani', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const u = await one('SELECT name FROM users WHERE id=$1', [Number(req.body.user) || 0]);
    const r = await q('DELETE FROM class_members WHERE class_id=$1 AND user_id=$2', [req.cls.id, Number(req.body.user) || 0]);
    if (u && r.rowCount) await audit(req.user, 'Odstranil dijaka iz razreda', `${req.cls.name}: ${u.name}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}`);
  } catch (e) { next(e); }
});
// A teacher's reset starts a new attempt for the student; the earlier score stays in the history.
async function resetExercise(ex, userId) {
  return tx(async (c) => {
    const p = (await c.query('SELECT * FROM progress WHERE user_id=$1 AND exercise_id=$2 FOR UPDATE', [userId, ex.id])).rows[0];
    if (!p) return false;
    const had = summarize(ex, p.state);
    if (had.done === 0 && had.hints === 0) return false;
    await c.query(`INSERT INTO resets(user_id, exercise_id, attempt, score, done_count, reason) VALUES($1,$2,$3,$4,$5,'teacher')`, [userId, ex.id, p.attempt, had.score, had.done]);
    await c.query(`UPDATE progress SET attempt=attempt+1, state='{}', score=0, done_count=0, hint_count=0, solution_count=0, completed_at=NULL, updated_at=now(), variant_seed=NULL, variant_keep='{}' WHERE user_id=$1 AND exercise_id=$2`, [userId, ex.id]);
    return true;
  });
}
teacherRouter.post('/razredi/:id/dijaki/:uid/vaje/:eid/ponastavi', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const uid = Number(req.params.uid) || 0;
    const ex = exerciseOf(req);
    const m = (await members(req.cls.id)).find((x) => x.id === uid);
    if (!ex || !m) return res.status(404).render('error', { title: 'Dijak ni v razredu', message: 'Dijak je bil odstranjen iz razreda.' });
    if (await resetExercise(ex, uid)) await audit(req.user, 'Ponastavil vajo dijaku', `${req.cls.name}: ${m.name}: ${ex.id}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}/dijaki/${uid}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/rezultati/:eid/ponastavi', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const ex = exerciseOf(req);
    if (!ex) return res.status(404).render('error', { title: 'Vaja ne obstaja', message: 'Povezava je napačna.' });
    let n = 0;
    for (const m of await members(req.cls.id)) if (await resetExercise(ex, m.id)) n++;
    if (n) await audit(req.user, 'Ponastavil vajo razredu', `${req.cls.name}: ${ex.id}: ${n}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}/rezultati/${ex.id}?sporocilo=${encodeURIComponent(`Vaja ${ex.no} je ponastavljena. Dijakov: ${n}.`)}`);
  } catch (e) { next(e); }
});
// Which exercises the class can see, and in what order.
teacherRouter.get('/razredi/:id/vaje', loadClass, async (req, res, next) => {
  try {
    const mods = await classGroups(req.cls.id);
    const list = mods.flatMap((m) => m.exercises);
    res.render('teacher/sections', {
      cls: req.cls, mods, plannedIn, plannedModules: plannedModules.filter((id) => inYear(req.cls.year, id)),
      exerciseCount: list.length, openCount: list.filter((e) => e.visible).length,
    });
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/vaje/:eid/vidnost', loadClass, checkCsrf, async (req, res, next) => {
  try {
    const ex = exerciseOf(req);
    if (!ex) return res.redirect(`/ucitelj/razredi/${req.cls.id}/vaje`);
    await ensureClassRows(req.cls.id);
    const open = req.body.visible === 'on';
    await q('UPDATE class_exercises SET visible=$3 WHERE class_id=$1 AND exercise_id=$2', [req.cls.id, ex.id, open]);
    await audit(req.user, open ? 'Odprl vajo' : 'Zaprl vajo', `${req.cls.name}: ${ex.id}`);
    res.redirect(`/ucitelj/razredi/${req.cls.id}/vaje#vaja-${ex.id}`);
  } catch (e) { next(e); }
});
teacherRouter.post('/razredi/:id/vaje/:eid/premik', loadClass, checkCsrf, async (req, res, next) => {
  try {
    await ensureClassRows(req.cls.id);
    const mods = await classGroups(req.cls.id);
    const m = mods.find((x) => x.exercises.some((e) => e.id === req.params.eid));
    if (m) {
      const ids = m.exercises.map((e) => e.id);
      const i = ids.indexOf(req.params.eid);
      const j = req.body.dir === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) {
        const orders = m.exercises.map((e) => e.order);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        for (const [k, id] of ids.entries()) await q('UPDATE class_exercises SET sort_order=$3 WHERE class_id=$1 AND exercise_id=$2', [req.cls.id, id, orders[k]]);
      }
    }
    res.redirect(`/ucitelj/razredi/${req.cls.id}/vaje#vaja-${req.params.eid}`);
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/izvoz.csv', loadClass, async (req, res, next) => {
  try {
    const ms = await members(req.cls.id);
    const list = await exerciseList(req.cls.id);
    const open = sums(list.filter((e) => e.visible));
    const map = ofList(await progressFor(ms.map((m) => m.id)), list);
    const head = ['Dijak', 'Račun', ...list.flatMap((e) => [`${e.no} točke (od ${e.maxPoints})`, `${e.no} naloge (od ${e.tasks.length})`, `${e.no} čas (min)`, `${e.no} ponastavitve`]), `Odprte vaje točke (od ${open.maxPoints})`, 'Odprte vaje %', 'Skupaj čas (min)', 'Zadnja aktivnost'];
    const lines = [head.map(csvCell).join(';')];
    for (const m of ms) {
      const t = rollup(map.get(m.id), open.ids);
      lines.push([m.name, m.email || m.username, ...list.flatMap((e) => {
        const c = cell(map.get(m.id), e.id);
        return [num(c.score), c.done, Math.round(c.seconds / 60), c.resets];
      }), num(t.score), pct(t.score, open.maxPoints), Math.round(t.seconds / 60), date(t.last)].map(csvCell).join(';'));
    }
    const safe = req.cls.name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${portal.name}_${safe}.csv`)}`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/rezultati/:eid', loadClass, async (req, res, next) => {
  try {
    const ex = exerciseOf(req);
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
    res.render('teacher/exercise', { cls: req.cls, ex, students, tasks, message: req.query.sporocilo || null });
  } catch (e) { next(e); }
});
teacherRouter.get('/razredi/:id/dijaki/:uid', loadClass, async (req, res, next) => {
  try {
    const uid = Number(req.params.uid) || 0;
    const m = (await members(req.cls.id)).find((x) => x.id === uid);
    if (!m) return res.status(404).render('error', { title: 'Dijak ni v razredu', message: 'Dijak je bil odstranjen iz razreda.' });
    const list = await exerciseList(req.cls.id);
    const open = sums(list.filter((e) => e.visible));
    const map = ofList(await progressFor([uid]), list).get(uid);
    const ids = new Set(list.map((e) => e.id));
    const events = (await many('SELECT * FROM task_events WHERE user_id=$1 ORDER BY created_at', [uid])).filter((ev) => ids.has(ev.exercise_id));
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
    res.render('teacher/student', { cls: req.cls, m, exs, total: rollup(map, open.ids), maxPoints: open.maxPoints, maxTasks: open.maxTasks, days: [...days], CHAPTERS, duration });
  } catch (e) { next(e); }
});
