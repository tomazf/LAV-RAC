import express from 'express';
import { checkCsrf, isAdmin, requireAdmin } from '../auth.js';
import { lowerYears, pastText, plannedIn, plannedModules, standardGroups, YEARS, yearsOn } from '../catalog.js';
import { audit, eraseUser, many, one, q, tx } from '../db.js';
import { ACTION_BACKUP, backupWarning, recentBackup } from '../backup.js';
import { byName, cleanName } from '../format.js';
import { paging } from '../paging.js';
import { backupRouter } from './backup.js';
import { ACTION_YEAR, yearRouter } from './year.js';

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
// The class lists of the edit windows: one group per year (the classes without a year last), each in the order of the alphabet.
const classGroups = (classes) => (yearsOn
  ? [...YEARS.map((y) => ({ year: y.year, title: `${y.year}. letnik` })), { year: null, title: 'Brez letnika' }]
  : [{ year: null, title: '' }]
).map((g) => ({ ...g, classes: classes.filter((c) => !yearsOn || (c.year ?? null) === g.year).sort(byName) })).filter((g) => g.classes.length);
// Where the admin returns to after saving: the same list with the same filter and page, without an old message.
const listBack = (req) => {
  const u = new URL(req.originalUrl, 'http://x');
  u.searchParams.delete('sporocilo');
  return u.pathname + u.search;
};
const backTo = (v) => {
  try { const u = new URL(String(v || ''), 'http://x'); return u.origin === 'http://x' && u.pathname === '/admin' ? u.pathname + u.search : '/admin'; } catch { return '/admin'; }
};
const ROLES = { admin: 'Skrbnik', teacher: 'Učitelj', observer: 'Nadzorni', student: 'Dijak', waiting: 'Brez razreda' };
const roleOf = (u) => (isAdmin(u) ? 'admin' : u.role === 'teacher' ? 'teacher' : u.role === 'observer' ? 'observer' : u.class_names ? 'student' : 'waiting');

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
    const all = rows.map((u) => ({ ...u, kind: roleOf(u) })).filter((u) => !kind || u.kind === kind).sort(byName);
    const pg = paging(req.query, all.length);
    const users = all.slice(pg.offset, pg.offset + pg.per);
    // Every edit window offers the classes: students without one can also be put into one from the list itself.
    const classes = await many('SELECT id, name, year FROM classes');
    const teaching = new Map((await many('SELECT t.user_id, t.class_id FROM class_teachers t WHERE t.user_id = ANY($1)', [users.map((u) => u.id)])).reduce((m, t) => m.set(t.user_id, [...(m.get(t.user_id) ?? []), t.class_id]), new Map()));
    const memberOf = new Map((await many('SELECT user_id, class_id FROM class_members WHERE user_id = ANY($1)', [users.map((u) => u.id)])).map((m) => [m.user_id, m.class_id]));
    for (const u of users) { u.teach_ids = teaching.get(u.id) ?? []; u.class_id = memberOf.get(u.id) ?? null; }
    const params = { vloga: kind, q: search, na: pg.per === 50 ? '' : pg.per };
    res.render('admin/users', {
      users, search, kind, ROLES, pg, params, groups: classGroups(classes), classes, years: YEARS, back: listBack(req),
      message: req.query.sporocilo || null, tab: 'users',
    });
  } catch (e) { next(e); }
});
// One window for everything about a person: the role, the class of a student or the classes of a teacher.
adminRouter.post('/uporabniki/:id/uredi', checkCsrf, async (req, res, next) => {
  const to = backTo(req.body.back);
  try {
    const id = Number(req.params.id) || 0;
    const role = ['teacher', 'observer'].includes(req.body.role) ? req.body.role : 'user';
    // A supervisor sees only the years ticked here; the list is checked against the years that exist.
    const years = role === 'observer' ? YEARS.map((y) => y.year).filter((y) => asList(req.body.years).map(Number).includes(y)) : [];
    const out = await tx(async (c) => {
      const u = (await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!u) return { missing: true };
      if (isAdmin(u)) return { admin: true };
      const mine = (await c.query('SELECT m.class_id, c.name FROM class_members m JOIN classes c ON c.id=m.class_id WHERE m.user_id=$1', [id])).rows[0] ?? null;
      const teaching = (await c.query('SELECT t.class_id, c.name FROM class_teachers t JOIN classes c ON c.id=t.class_id WHERE t.user_id=$1', [id])).rows;
      const log = [];
      if (role !== u.role) {
        await c.query('UPDATE users SET role=$2 WHERE id=$1', [id, role]);
        log.push([role === 'teacher' ? 'Določil učitelja' : role === 'observer' ? 'Določil nadzornega' : 'Odvzel vlogo učitelja ali nadzornega', u.name]);
      }
      if (role === 'observer') {
        // A supervisor has no class and no classes to teach; the progress of students is never theirs to see.
        if (mine) {
          await c.query('DELETE FROM class_members WHERE user_id=$1', [id]);
          log.push(['Odstranil dijaka iz razreda', `${mine.name}: ${u.name}`]);
        }
        for (const t of teaching) log.push(['Odstranil učitelja iz razreda', `${t.name}: ${u.name}`]);
        if (teaching.length) await c.query('DELETE FROM class_teachers WHERE user_id=$1', [id]);
        const before = (await c.query('SELECT observer_years FROM users WHERE id=$1', [id])).rows[0].observer_years;
        if (before.join() !== years.join()) {
          await c.query('UPDATE users SET observer_years=$2 WHERE id=$1', [id, years]);
          log.push(['Nastavil letnike nadzornemu', `${years.map((y) => `${y}. letnik`).join(', ') || 'brez letnikov'}: ${u.name}`]);
        }
      } else {
        if (u.observer_years.length) await c.query("UPDATE users SET observer_years='{}' WHERE id=$1", [id]);
      }
      if (role !== 'observer') {
      if (role === 'teacher') {
        // A teacher is not a student; the classes they teach are exactly the ticked ones.
        if (mine) {
          await c.query('DELETE FROM class_members WHERE user_id=$1', [id]);
          log.push(['Odstranil dijaka iz razreda', `${mine.name}: ${u.name}`]);
        }
        const wanted = asList(req.body.teach).map(Number).filter(Boolean);
        const valid = (await c.query('SELECT id, name FROM classes WHERE id = ANY($1)', [wanted])).rows;
        for (const t of teaching.filter((x) => !valid.some((v) => v.id === x.class_id))) {
          await c.query('DELETE FROM class_teachers WHERE user_id=$1 AND class_id=$2', [id, t.class_id]);
          log.push(['Odstranil učitelja iz razreda', `${t.name}: ${u.name}`]);
        }
        for (const v of valid.filter((x) => !teaching.some((t) => t.class_id === x.id))) {
          await c.query('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [v.id, id]);
          log.push(['Dodal učitelja razredu', `${v.name}: ${u.name}`]);
        }
      } else {
        // A former teacher no longer has classes. A student has one class or none; the progress stays with the student.
        for (const t of teaching) log.push(['Odstranil učitelja iz razreda', `${t.name}: ${u.name}`]);
        if (teaching.length) await c.query('DELETE FROM class_teachers WHERE user_id=$1', [id]);
        const want = Number(req.body.class_id) || null;
        const target = want ? (await c.query('SELECT id, name FROM classes WHERE id=$1', [want])).rows[0] ?? null : null;
        if (want && !target) return { badClass: true };
        if ((mine?.class_id ?? null) !== (target?.id ?? null)) {
          if (mine) {
            await c.query('DELETE FROM class_members WHERE user_id=$1', [id]);
            log.push(['Odstranil dijaka iz razreda', `${mine.name}: ${u.name}`]);
          }
          if (target) {
            await c.query('INSERT INTO class_members(class_id, user_id, added_by) VALUES($1,$2,$3)', [target.id, id, req.user.id]);
            log.push(['Dodal dijaka v razred', `${target.name}: ${u.name}`]);
          }
        }
      }
      }
      return { log };
    });
    if (out.missing) return flash(res, to, 'Uporabnik ne obstaja več.');
    if (out.admin) return flash(res, to, 'Skrbnika se ureja v nastavitvah strežnika.');
    if (out.badClass) return flash(res, to, 'Izbrani razred ne obstaja. Nič ni bilo spremenjeno.');
    for (const [action, detail] of out.log) await audit(req.user, action, detail);
    flash(res, to, out.log.length ? 'Spremembe so shranjene.' : 'Ni sprememb.');
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/:id/izbrisi', checkCsrf, async (req, res, next) => {
  try {
    const to = backTo(req.body.back);
    const u = await one('SELECT * FROM users WHERE id=$1', [Number(req.params.id) || 0]);
    if (!u) return res.redirect(to);
    if (isAdmin(u)) return flash(res, to, 'Skrbnika ni mogoče izbrisati. Najprej ga odstrani iz nastavitve ADMIN_EMAILS.');
    await eraseUser(u);
    await audit(req.user, 'Izbrisal uporabnika in njegove podatke');
    flash(res, to, 'Uporabnik in vsi njegovi podatki so izbrisani.');
  } catch (e) { next(e); }
});
adminRouter.post('/uporabniki/razredi', checkCsrf, async (req, res, next) => {
  try {
    const picks = Object.entries(req.body)
      .map(([k, v]) => [Number(k.match(/^class_(\d+)$/)?.[1]), Number(v)])
      .filter(([uid, cid]) => uid && cid);
    const added = new Map();
    await tx(async (c) => {
      for (const [uid, cid] of picks) {
        // Only students who still have no class; a student has one class.
        const r = await c.query(
          `INSERT INTO class_members(class_id, user_id, added_by) SELECT $1, u.id, $3 FROM users u
           WHERE u.id=$2 AND u.role='user' AND EXISTS (SELECT 1 FROM classes WHERE id=$1)
             AND NOT EXISTS (SELECT 1 FROM class_members m WHERE m.user_id=u.id)`, [cid, uid, req.user.id],
        );
        if (r.rowCount) added.set(cid, (added.get(cid) ?? 0) + 1);
      }
    });
    const names = new Map((await many('SELECT id, name FROM classes WHERE id = ANY($1)', [[...added.keys()]])).map((x) => [Number(x.id), x.name]));
    for (const [cid, n] of added) await audit(req.user, 'Dodal dijake v razred', `${names.get(cid)}: ${n}`);
    const total = [...added.values()].reduce((a, b) => a + b, 0);
    flash(res, '/admin?vloga=waiting', total ? `Dijakov, dodanih v razred: ${total}.` : 'Nobenemu dijaku ni bil izbran razred.');
  } catch (e) { next(e); }
});
// Inactive students: first a list of who matches, then the admin picks and confirms. Names are only shown to the admin.
const MIN_DAYS = 30;
const CLEAN_LIST_MAX = 1000;
adminRouter.get('/ciscenje', async (req, res, next) => {
  try {
    const days = Number(req.query.dni);
    const asked = req.query.dni !== undefined && req.query.dni !== '';
    const valid = Number.isInteger(days) && days >= MIN_DAYS;
    let found = null;
    if (valid) {
      const rows = await many(
        `SELECT u.*, (SELECT c.name FROM class_members m JOIN classes c ON c.id=m.class_id WHERE m.user_id=u.id) AS class_name
         FROM users u WHERE u.role='user' AND u.last_login_at < now() - make_interval(days => $1) ORDER BY u.last_login_at`, [days],
      );
      const all = rows.filter((u) => !isAdmin(u));
      found = { all: all.length, list: all.slice(0, CLEAN_LIST_MAX).sort(byName) };
    }
    res.render('admin/cleanup', {
      tab: 'cleanup', message: req.query.sporocilo || null, days: valid ? days : 365, asked, valid, MIN_DAYS, found,
      fresh: await recentBackup(), more: found ? Math.max(0, found.all - found.list.length) : 0,
    });
  } catch (e) { next(e); }
});
adminRouter.post('/ciscenje', checkCsrf, async (req, res, next) => {
  try {
    const days = Number(req.body.days);
    const back = `/admin/ciscenje?dni=${Number.isInteger(days) ? days : ''}`;
    if (!Number.isInteger(days) || days < MIN_DAYS || req.body.confirm !== 'da') return flash(res, back, `Vpiši vsaj ${MIN_DAYS} dni in potrdi brisanje.`);
    // The deletion is for good, so a fresh copy of the database must exist, the same as for the end of the school year.
    if (!(await recentBackup())) return flash(res, back, 'Najprej prenesi svežo varnostno kopijo (Administracija > Kopije), nato ponovi.');
    const picked = [...new Set(asList(req.body.id).map(Number).filter(Boolean))];
    if (!picked.length) return flash(res, back, 'Nisi izbral nobenega dijaka.');
    // What was shown may be out of date: only those still without a login for that long, still students, are deleted.
    const rows = await many(`SELECT * FROM users WHERE id = ANY($1) AND role='user' AND last_login_at < now() - make_interval(days => $2)`, [picked, days]);
    const gone = rows.filter((u) => !isAdmin(u));
    for (const u of gone) await eraseUser(u);
    await audit(req.user, 'Izbrisal neaktivne uporabnike', `${gone.length} (brez prijave ${days} dni)`);
    const skipped = picked.length - gone.length;
    flash(res, back, `Izbrisanih uporabnikov: ${gone.length}.${skipped ? ` Preskočenih: ${skipped} (od predogleda so se prijavili ali niso več dijaki).` : ''}`);
  } catch (e) { next(e); }
});
adminRouter.get('/vaje', (req, res) => {
  res.render('admin/exercises', { mods: standardGroups(), plannedModules, plannedIn, tab: 'exercises', message: null });
});
const fail = (res, msg) => res.redirect(`/admin/razredi?napaka=${encodeURIComponent(msg)}`);
const TAKEN = (name) => `Razred z imenom ${name} že obstaja. Izberi drugo ime.`;
const asList = (v) => [].concat(v ?? []);
// Two classes never share a name, ignoring case and spaces (the database has the same rule as an index).
const nameTaken = async (name, exceptId = 0, run = q) => (await run('SELECT 1 FROM classes WHERE lower(btrim(name))=lower($1) AND id<>$2', [name, exceptId])).rowCount > 0;
const isDuplicate = (e) => e?.code === '23505';

adminRouter.get('/razredi', async (req, res, next) => {
  try {
    const classes = await many(
      `SELECT c.*, (SELECT count(*)::int FROM class_members m WHERE m.class_id=c.id) AS students FROM classes c ORDER BY c.name`,
    );
    const links = await many(`SELECT t.class_id, u.id, u.name FROM class_teachers t JOIN users u ON u.id=t.user_id ORDER BY u.name`);
    for (const c of classes) c.teachers = links.filter((l) => l.class_id === c.id);
    const all = await many('SELECT id, name, username, role FROM users ORDER BY name');
    const teachers = all.filter((u) => u.role === 'teacher' || isAdmin(u)).sort(byName);
    // With years, one group per year (also when empty, so it is clear what is missing), then the classes without a year.
    const groups = (yearsOn
      ? [...YEARS.map((y) => ({ year: y.year, title: `${y.year}. letnik` })), { year: null, title: 'Brez letnika' }]
      : [{ year: null, title: null }]
    ).map((g) => ({ ...g, classes: yearsOn ? classes.filter((c) => (c.year ?? null) === g.year) : classes }))
      .filter((g) => !yearsOn || g.year !== null || g.classes.length)
      .map((g) => ({ ...g, students: g.classes.reduce((n, c) => n + c.students, 0), noTeacher: g.classes.filter((c) => !c.teachers.length).length }));
    res.render('admin/classes', {
      classes, groups, teachers, noTeacher: classes.filter((c) => !c.teachers.length), YEARS: yearsOn ? YEARS : [],
      tab: 'classes', message: req.query.sporocilo || null, error: req.query.napaka || null,
    });
  } catch (e) { next(e); }
});
adminRouter.post('/razredi', checkCsrf, async (req, res, next) => {
  try {
    const name = cleanName(req.body.name);
    if (!name) return res.redirect('/admin/razredi');
    const year = yearIn(req.body.year);
    if (yearsOn && !year) return flash(res, '/admin/razredi', 'Izberi letnik razreda.');
    if (await nameTaken(name)) return fail(res, TAKEN(name));
    try { await q('INSERT INTO classes(name, year) VALUES($1,$2)', [name, year]); } catch (e) { if (isDuplicate(e)) return fail(res, TAKEN(name)); throw e; }
    await audit(req.user, 'Ustvaril razred', year ? `${name} (${year}. letnik)` : name);
    flash(res, '/admin/razredi', `Razred ${name} je ustvarjen.`);
  } catch (e) { next(e); }
});
// One form edits the whole class: name, year, the lower years its students may revisit, and its teachers.
adminRouter.post('/razredi/:id/uredi', checkCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const name = cleanName(req.body.name);
    if (!name) return fail(res, 'Vpiši ime razreda.');
    const wanted = new Set(asList(req.body.teacher).map(Number).filter(Boolean));
    const out = await tx(async (c) => {
      const cur = (await c.query('SELECT * FROM classes WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!cur) return { missing: true };
      if (await nameTaken(name, id, (sql, args) => c.query(sql, args))) return { taken: true };
      // Without years in the portal the year stays as it is; a missing choice keeps the current year.
      const year = yearsOn ? (yearIn(req.body.year) ?? cur.year) : cur.year;
      const past = yearsOn && year ? lowerYears(year).filter((y) => asList(req.body.past).map(Number).includes(y)) : [];
      await c.query('UPDATE classes SET name=$2, year=$3, past_years=$4 WHERE id=$1', [id, name, year, past]);
      const have = (await c.query('SELECT t.user_id, u.name FROM class_teachers t JOIN users u ON u.id=t.user_id WHERE t.class_id=$1', [id])).rows;
      const valid = (await c.query('SELECT * FROM users WHERE id = ANY($1)', [[...wanted]])).rows.filter((u) => u.role === 'teacher' || isAdmin(u));
      const removed = have.filter((h) => !valid.some((v) => v.id === h.user_id));
      const added = valid.filter((v) => !have.some((h) => h.user_id === v.id));
      if (removed.length) await c.query('DELETE FROM class_teachers WHERE class_id=$1 AND user_id = ANY($2)', [id, removed.map((r) => r.user_id)]);
      for (const t of added) await c.query('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, t.id]);
      return { cur, name, year, past, added, removed };
    });
    if (out.missing) return fail(res, 'Razred ne obstaja.');
    if (out.taken) return fail(res, TAKEN(name));
    const { cur, year, past, added, removed } = out;
    if (cur.name !== name) await audit(req.user, 'Preimenoval razred', `${cur.name}: ${name}`);
    if (yearsOn && (cur.year !== year || [...cur.past_years].join() !== past.join())) {
      await audit(req.user, 'Nastavil letnik razreda', `${name}: ${year}. letnik, prejšnji letniki ${past.length ? `vidni (${pastText(year, past)})` : 'skriti'}`);
    }
    for (const t of added) await audit(req.user, 'Dodal učitelja razredu', `${name}: ${t.name}`);
    for (const t of removed) await audit(req.user, 'Odstranil učitelja iz razreda', `${name}: ${t.name}`);
    flash(res, '/admin/razredi', `Razred ${name} je shranjen.`);
  } catch (e) { if (isDuplicate(e)) return fail(res, 'Razred s tem imenom že obstaja.'); next(e); }
});
adminRouter.post('/razredi/:id/izbrisi', checkCsrf, async (req, res, next) => {
  try {
    const c = await one('DELETE FROM classes WHERE id=$1 RETURNING name', [Number(req.params.id) || 0]);
    if (c) await audit(req.user, 'Izbrisal razred', c.name);
    res.redirect('/admin/razredi');
  } catch (e) { next(e); }
});
// The log: newest first by default; any column sorts, on the server, so it works with paging.
const LOG_SORT = { cas: 'created_at', kdo: 'actor_name', dejanje: 'action', podrobnost: 'detail' };
const LOG_KEEP_MONTHS = [1, 2, 3];
adminRouter.get('/dnevnik', async (req, res, next) => {
  try {
    const by = LOG_SORT[req.query.uredi] ? req.query.uredi : 'cas';
    const dir = req.query.smer === 'nar' ? 'nar' : req.query.smer === 'pad' ? 'pad' : by === 'cas' ? 'pad' : 'nar';
    const total = (await one('SELECT count(*)::int AS n FROM audit_log')).n;
    const pg = paging(req.query, total);
    // Text columns sort by Slovenian rules; ties keep the newest first.
    const col = by === 'cas' ? 'created_at' : `${LOG_SORT[by]} COLLATE "sl-SI-x-icu"`;
    const log = await many(
      `SELECT * FROM audit_log ORDER BY ${col} ${dir === 'nar' ? 'ASC' : 'DESC'} NULLS LAST, id DESC LIMIT $1 OFFSET $2`, [pg.per, pg.offset],
    );
    const params = { uredi: by === 'cas' ? '' : by, smer: req.query.smer === 'nar' || req.query.smer === 'pad' ? dir : '', na: pg.per === 50 ? '' : pg.per };
    res.render('admin/log', { log, pg, params, by, dir, months: LOG_KEEP_MONTHS, tab: 'log', message: req.query.sporocilo || null });
  } catch (e) { next(e); }
});
adminRouter.post('/dnevnik/ciscenje', checkCsrf, async (req, res, next) => {
  try {
    const months = Number(req.body.months);
    if (!LOG_KEEP_MONTHS.includes(months) || req.body.confirm !== 'da') return flash(res, '/admin/dnevnik', 'Izberi obdobje in potrdi brisanje.');
    // The portal reads the last backup and the last end of the school year from the log, so those two always stay.
    const r = await q(
      `DELETE FROM audit_log WHERE created_at < now() - make_interval(months => $1)
         AND id NOT IN (SELECT DISTINCT ON (action) id FROM audit_log WHERE action = ANY($2) ORDER BY action, created_at DESC)`,
      [months, [ACTION_BACKUP, ACTION_YEAR]],
    );
    const label = { 1: '1 meseca', 2: '2 mesecev', 3: '3 mesecev' }[months];
    await audit(req.user, 'Izbrisal stare zapise dnevnika', `${r.rowCount}, starejših od ${label}`);
    flash(res, '/admin/dnevnik', `Izbrisanih zapisov: ${r.rowCount}.`);
  } catch (e) { next(e); }
});
