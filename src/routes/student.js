import express from 'express';
import { classGroups, pastGroups, standardGroups } from '../catalog.js';
import { requireAccess } from '../auth.js';
import { many, one } from '../db.js';
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
    const mods = req.user.isTeacher ? standardGroups() : await classGroups(req.user.class_id, { openOnly: true });
    // A class that may revisit lower years sees them in a section of their own, outside this year's totals.
    const cls = req.user.isTeacher ? null : await one('SELECT year, past_years FROM classes WHERE id=$1', [req.user.class_id]);
    const past = cls ? pastGroups(cls.year, cls.past_years) : [];
    const map = (await progressFor([req.user.id])).get(req.user.id);
    const list = mods.flatMap((m) => m.exercises);
    const rows = new Map([...list, ...past.flatMap((m) => m.exercises)].map((e) => {
      const c = cell(map, e.id);
      return [e.id, { ...c, strip: strip(e, c.state), last: latest(c.updatedAt, c.lastSeen) }];
    }));
    const total = rollup(new Map(list.map((e) => [e.id, rows.get(e.id)])));
    const maxPoints = list.reduce((a, e) => a + e.maxPoints, 0);
    const maxTasks = list.reduce((a, e) => a + e.tasks.length, 0);
    const unfinished = list.filter((e) => rows.get(e.id).done < e.tasks.length);
    const inProgress = unfinished.filter((e) => rows.get(e.id).started).sort((a, b) => (rows.get(b.id).last ?? 0) - (rows.get(a.id).last ?? 0));
    const next_ = inProgress[0] ?? unfinished[0] ?? null;
    res.render('dashboard', { mods, past, rows, total, maxPoints, maxTasks, next_, nextStarted: next_ ? rows.get(next_.id).started : false });
  } catch (e) { next(e); }
});
