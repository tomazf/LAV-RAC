import express from 'express';
import { arranged, totalPoints, totalTasks } from '../catalog.js';
import { requireAccess } from '../auth.js';
import { cell, latest, progressFor, rollup, strip } from '../stats.js';

export const studentRouter = express.Router();

studentRouter.get('/', (req, res) => {
  if (!req.user) return res.render('login', { error: null });
  if (req.user.isWaiting) return res.render('waiting');
  res.redirect(req.user.isTeacher ? '/ucitelj' : '/vaje');
});
studentRouter.get('/zasebnost', (req, res) => res.render('privacy'));
studentRouter.get('/vaje', requireAccess, async (req, res, next) => {
  try {
    const mods = await arranged({ includeHidden: false });
    const map = (await progressFor([req.user.id])).get(req.user.id);
    const list = mods.flatMap((m) => m.exercises);
    const rows = new Map(list.map((e) => {
      const c = cell(map, e.id);
      return [e.id, { ...c, strip: strip(e, c.state), last: latest(c.updatedAt, c.lastSeen) }];
    }));
    const visibleMap = new Map(list.map((e) => [e.id, rows.get(e.id)]));
    const total = rollup(visibleMap);
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    const maxTasks = list.reduce((a, e) => a + e.tasks.length, 0);
    const unfinished = list.filter((e) => rows.get(e.id).done < e.tasks.length);
    const inProgress = unfinished.filter((e) => rows.get(e.id).started).sort((a, b) => (rows.get(b.id).last ?? 0) - (rows.get(a.id).last ?? 0));
    const next_ = inProgress[0] ?? unfinished[0] ?? null;
    res.render('dashboard', { mods, rows, total, maxPoints, maxTasks, next_, nextStarted: next_ ? rows.get(next_.id).started : false, totalPoints, totalTasks });
  } catch (e) { next(e); }
});
