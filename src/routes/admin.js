import express from 'express';
import { checkCsrf, isAdmin, requireAdmin } from '../auth.js';
import { plannedIn, plannedModules, standardGroups, YEARS, yearsOn } from '../catalog.js';
import { audit, eraseUser, many, one, q, tx } from '../db.js';
import { backupWarning } from '../backup.js';
import { byName } from '../format.js';
import { backupRouter } from './backup.js';
import { yearRouter } from './year.js';

export const adminRouter = express.Router();
adminRouter.use(requireAdmin);
// Every admin page reminds the admin when there is no recent backup; this is a warning, not an error.
adminRouter.use(async (req, res, next) => {
  try { if (req.method === 'GET') res.locals.backupWarn = await backupWarning(); next(); } catch (e) { next(e); }
});
adminRouter.use('/kopije', backupRouter);
adminRouter.use('/solsko-leto', yearRouter);

const yearIn = (v) => (YEARS.some((y) => y.year === Number(v)) ? Number(v) : null);
const flash = (res, path, msg) => res.redirect(`${path}${path.includes('?') ? '&' : '?'}sporocilo=${encodeURIComponent(msg)}`);
const ROLES = { admin: 'Skrbnik', teacher: 'Učitelj', student: 'Dijak', waiting: 'Brez razreda' };
const roleOf = (u) => (isAdmin(u) ? 'admin' : u.role === 'teacher' ? 'teacher' : u.class_names ? 'student' : 'waiting');

adminRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim();
    const kind = ROLES[req.query.vloga] ? req.query.vloga : '';
    const rows = await many(
      `SELECT u.*,
         (SELECT c.name FROM class_members m JOIN classes c ON c.id=m.class_id WHERE m.user_id=u.id) AS class_names,
         (SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM class_teachers t JOIN classes c ON c.id=t.class_id WHERE t.user_id=u.id) AS teaching
       FROM users u WHERE ($1='' OR u.name ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%' OR coalesce(u.email,'') ILIKE '%'||$1||'%')
       ORDER BY u.name`, [search],
    );
    const users = rows.map((u) => ({ ...u, kind: roleOf(u) })).filter((u) => !kind || u.kind === kind).sort(byName);
    res.render('admin/users', { users, search, kind, ROLES, message: req.query.sporocilo || null, tab: 'users' });
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/:id/vloga', checkCsrf, async (req, res, next) => {
  try {
    const role = req.body.role === 'teacher' ? 'teacher' : 'user';
    const id = Number(req.params.id) || 0;
    const u = await tx(async (c) => {
      const row = (await c.query('UPDATE users SET role=$2 WHERE id=$1 RETURNING name', [id, role])).rows[0];
      if (!row) return null;
      // A teacher is not a student, and a former teacher no longer has classes.
      if (role === 'teacher') await c.query('DELETE FROM class_members WHERE user_id=$1', [id]);
      else await c.query('DELETE FROM class_teachers WHERE user_id=$1', [id]);
      return row;
    });
    if (u) await audit(req.user, role === 'teacher' ? 'Določil učitelja' : 'Odvzel vlogo učitelja', u.name);
    res.redirect('/admin');
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/:id/izbrisi', checkCsrf, async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=$1', [Number(req.params.id) || 0]);
    if (!u) return res.redirect('/admin');
    if (isAdmin(u)) return flash(res, '/admin', 'Skrbnika ni mogoče izbrisati. Najprej ga odstrani iz nastavitve ADMIN_EMAILS.');
    await eraseUser(u);
    await audit(req.user, 'Izbrisal uporabnika in njegove podatke');
    flash(res, '/admin', 'Uporabnik in vsi njegovi podatki so izbrisani.');
  } catch (e) { next(e); }
});
adminRouter.post('/ciscenje', checkCsrf, async (req, res, next) => {
  try {
    const days = Number(req.body.days);
    if (!Number.isInteger(days) || days < 30 || req.body.confirm !== 'da') return flash(res, '/admin', 'Vpiši vsaj 30 dni in potrdi brisanje.');
    const old = await many(`SELECT * FROM users WHERE role='user' AND last_login_at < now() - make_interval(days => $1)`, [days]);
    const gone = old.filter((u) => !isAdmin(u));
    for (const u of gone) await eraseUser(u);
    await audit(req.user, 'Izbrisal neaktivne uporabnike', `${gone.length} (brez prijave ${days} dni)`);
    flash(res, '/admin', `Izbrisanih uporabnikov: ${gone.length}.`);
  } catch (e) { next(e); }
});
adminRouter.get('/vaje', (req, res) => {
  res.render('admin/exercises', { mods: standardGroups(), plannedModules, plannedIn, tab: 'exercises', message: null });
});
adminRouter.get('/razredi', async (req, res, next) => {
  try {
    const classes = await many(
      `SELECT c.*, (SELECT count(*)::int FROM class_members m WHERE m.class_id=c.id) AS students FROM classes c ORDER BY c.name`,
    );
    const links = await many(`SELECT t.class_id, u.id, u.name FROM class_teachers t JOIN users u ON u.id=t.user_id ORDER BY u.name`);
    for (const c of classes) c.teachers = links.filter((l) => l.class_id === c.id);
    const all = await many('SELECT id, name, username, role FROM users ORDER BY name');
    const teachers = all.filter((u) => u.role === 'teacher' || isAdmin(u));
    res.render('admin/classes', { classes, teachers, YEARS: yearsOn ? YEARS : [], tab: 'classes', message: req.query.sporocilo || null });
  } catch (e) { next(e); }
});
adminRouter.post('/razredi', checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.redirect('/admin/razredi');
    const year = yearIn(req.body.year);
    if (yearsOn && !year) return flash(res, '/admin/razredi', 'Izberi letnik razreda.');
    await q('INSERT INTO classes(name, year) VALUES($1,$2)', [name, year]);
    await audit(req.user, 'Ustvaril razred', year ? `${name} (${year}. letnik)` : name);
    flash(res, '/admin/razredi', `Razred ${name} je ustvarjen.`);
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/preimenuj', checkCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (name) {
      const before = await one('SELECT name FROM classes WHERE id=$1', [Number(req.params.id) || 0]);
      await q('UPDATE classes SET name=$2 WHERE id=$1', [Number(req.params.id) || 0, name]);
      if (before) await audit(req.user, 'Preimenoval razred', `${before.name}: ${name}`);
    }
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/letnik', checkCsrf, async (req, res, next) => {
  try {
    const year = yearIn(req.body.year);
    const past = req.body.show_past === 'on';
    if (!yearsOn || !year) return res.redirect('/admin/razredi');
    const c = await one('UPDATE classes SET year=$2, show_past=$3 WHERE id=$1 RETURNING name', [Number(req.params.id) || 0, year, past]);
    if (c) await audit(req.user, 'Nastavil letnik razreda', `${c.name}: ${year}. letnik, prejšnji letniki ${past ? 'vidni' : 'skriti'}`);
    flash(res, '/admin/razredi', c ? `Razred ${c.name}: ${year}. letnik${past ? ', vidi prejšnje letnike' : ''}.` : 'Razred ne obstaja.');
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/izbrisi', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('DELETE FROM classes WHERE id=$1 RETURNING name', [Number(req.params.id) || 0]);
    if (c) await audit(req.user, 'Izbrisal razred', c.name);
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/ucitelji', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('SELECT id, name FROM classes WHERE id=$1', [Number(req.params.id) || 0]);
    const t = await one('SELECT * FROM users WHERE id=$1', [Number(req.body.user) || 0]);
    if (c && t && (t.role === 'teacher' || isAdmin(t))) {
      await q('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [c.id, t.id]);
      await audit(req.user, 'Dodal učitelja razredu', `${c.name}: ${t.name}`);
    }
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
adminRouter.post('/razredi/:id/ucitelji/:uid/odstrani', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('SELECT name FROM classes WHERE id=$1', [Number(req.params.id) || 0]);
    const t = await one('SELECT name FROM users WHERE id=$1', [Number(req.params.uid) || 0]);
    await q('DELETE FROM class_teachers WHERE class_id=$1 AND user_id=$2', [Number(req.params.id) || 0, Number(req.params.uid) || 0]);
    if (c && t) await audit(req.user, 'Odstranil učitelja iz razreda', `${c.name}: ${t.name}`);
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
adminRouter.get('/dnevnik', async (req, res, next) => {
  try {
    res.render('admin/log', { log: await many('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 300'), tab: 'log', message: null });
  } catch (e) { next(e); }
});
