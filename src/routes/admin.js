import express from 'express';
import { checkCsrf, isAdmin, requireAdmin } from '../auth.js';
import { arranged, exercises } from '../catalog.js';
import { audit, many, one, q } from '../db.js';

export const adminRouter = express.Router();
adminRouter.use(requireAdmin);

const flash = (res, path, msg) => res.redirect(`${path}${path.includes('?') ? '&' : '?'}sporocilo=${encodeURIComponent(msg)}`);
const ROLES = { admin: 'Skrbnik', teacher: 'Učitelj', student: 'Dijak', waiting: 'Čaka na razred' };
const roleOf = (u) => (isAdmin(u) ? 'admin' : u.role === 'teacher' ? 'teacher' : u.class_count > 0 ? 'student' : 'waiting');

adminRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim();
    const rows = await many(
      `SELECT u.*, (SELECT count(*)::int FROM class_members m WHERE m.user_id=u.id) AS class_count,
         (SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM class_members m JOIN classes c ON c.id=m.class_id WHERE m.user_id=u.id) AS class_names
       FROM users u WHERE ($1='' OR u.name ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%' OR coalesce(u.email,'') ILIKE '%'||$1||'%')
       ORDER BY u.name LIMIT 500`, [search],
    );
    const users = rows.map((u) => ({ ...u, kind: roleOf(u) }));
    res.render('admin/users', { users, search, ROLES, message: req.query.sporocilo || null, tab: 'users' });
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/:id/vloga', checkCsrf, async (req, res, next) => {
  try {
    const role = req.body.role === 'teacher' ? 'teacher' : 'user';
    const u = await one('UPDATE users SET role=$2 WHERE id=$1 RETURNING name', [Number(req.params.id) || 0, role]);
    if (u) await audit(req.user, role === 'teacher' ? 'Določil učitelja' : 'Odvzel vlogo učitelja', u.name);
    res.redirect('/admin');
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/:id/izbrisi', checkCsrf, async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=$1', [Number(req.params.id) || 0]);
    if (!u) return res.redirect('/admin');
    if (isAdmin(u)) return flash(res, '/admin', 'Skrbnika ni mogoče izbrisati. Najprej ga odstrani iz nastavitve ADMIN_EMAILS.');
    await q('DELETE FROM users WHERE id=$1', [u.id]);
    await audit(req.user, 'Izbrisal uporabnika in njegove podatke', u.name);
    flash(res, '/admin', `Izbrisano: ${u.name}.`);
  } catch (e) { next(e); }
});
adminRouter.post('/ciscenje', checkCsrf, async (req, res, next) => {
  try {
    const days = Number(req.body.days);
    if (!Number.isInteger(days) || days < 30 || req.body.confirm !== 'da') return flash(res, '/admin', 'Vpiši vsaj 30 dni in potrdi brisanje.');
    const old = await many(`SELECT * FROM users WHERE role='user' AND last_login_at < now() - make_interval(days => $1)`, [days]);
    const ids = old.filter((u) => !isAdmin(u)).map((u) => u.id);
    await q('DELETE FROM users WHERE id = ANY($1)', [ids]);
    await audit(req.user, 'Izbrisal neaktivne uporabnike', `${ids.length} (brez prijave ${days} dni)`);
    flash(res, '/admin', `Izbrisanih uporabnikov: ${ids.length}.`);
  } catch (e) { next(e); }
});
adminRouter.get('/vaje', async (req, res, next) => {
  try {
    res.render('admin/exercises', { mods: await arranged({ includeHidden: true }), tab: 'exercises', message: null });
  } catch (e) { next(e); }
});
adminRouter.post('/vaje/:id', checkCsrf, async (req, res, next) => {
  try {
    const ex = exercises.find((e) => e.id === req.params.id);
    if (!ex) return res.redirect('/admin/vaje');
    const est = req.body.est_minutes === '' ? null : Math.max(1, Math.min(600, Number(req.body.est_minutes) || 0)) || null;
    await q('UPDATE exercise_settings SET visible=$2, est_minutes=$3 WHERE exercise_id=$1', [ex.id, req.body.visible === 'on', est]);
    await audit(req.user, 'Spremenil vajo', `${ex.id}: ${req.body.visible === 'on' ? 'vidna' : 'skrita'}`);
    res.redirect('/admin/vaje');
  } catch (e) { next(e); }
});
adminRouter.post('/vaje/:id/premik', checkCsrf, async (req, res, next) => {
  try {
    const mods = await arranged({ includeHidden: true });
    const m = mods.find((x) => x.exercises.some((e) => e.id === req.params.id));
    if (m) {
      const ids = m.exercises.map((e) => e.id);
      const i = ids.indexOf(req.params.id);
      const j = req.body.dir === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) {
        const orders = m.exercises.map((e) => e.order);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        for (const [k, id] of ids.entries()) await q('UPDATE exercise_settings SET sort_order=$2 WHERE exercise_id=$1', [id, orders[k]]);
      }
    }
    res.redirect('/admin/vaje');
  } catch (e) { next(e); }
});
adminRouter.get('/razredi', async (req, res, next) => {
  try {
    const classes = await many(
      `SELECT c.*, u.name AS owner_name, (SELECT count(*)::int FROM class_members m WHERE m.class_id=c.id) AS students FROM classes c LEFT JOIN users u ON u.id=c.owner_id ORDER BY c.name`,
    );
    const all = await many(`SELECT id, name, username, role FROM users ORDER BY name`);
    const teachers = all.filter((u) => u.role === 'teacher' || isAdmin(u));
    res.render('admin/classes', { classes, teachers, tab: 'classes', message: null });
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/lastnik', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('UPDATE classes SET owner_id=$2 WHERE id=$1 RETURNING name', [Number(req.params.id) || 0, Number(req.body.owner) || null]);
    if (c) await audit(req.user, 'Spremenil učitelja razreda', c.name);
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
adminRouter.get('/dnevnik', async (req, res, next) => {
  try {
    res.render('admin/log', { log: await many('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 300'), tab: 'log', message: null });
  } catch (e) { next(e); }
});
