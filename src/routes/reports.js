import express from 'express';
import { checkCsrf, csrfValid, requireAccess, requireAdmin, requireTeacher } from '../auth.js';
import { YEARS } from '../catalog.js';
import { audit, many, one, q } from '../db.js';
import { byName } from '../format.js';
import { normalizePrefs } from '../prefs.js';
import { byClass, byYear, createReport, describe, listReports, MAX_TEXT, PER_DAY, stateOf } from '../reports.js';

// --- for every signed-in user: display settings, sending a report, own reports -------------------------------------
export const reportApiRouter = express.Router();

reportApiRouter.post('/api/prikaz', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false });
    if (!csrfValid(req)) return res.status(403).json({ ok: false, error: 'Obrazec je potekel. Osveži stran in poskusi znova.' });
    const prefs = normalizePrefs(req.body.prefs);
    await q('UPDATE users SET prefs=$2 WHERE id=$1', [req.user.id, prefs]);
    res.json({ ok: true, prefs });
  } catch (e) { next(e); }
});

// A report is for content and bugs: students, teachers and supervisors send them, the admin reads them.
reportApiRouter.post('/api/prijava', async (req, res, next) => {
  try {
    if (!req.user || req.user.isWaiting) return res.status(401).json({ ok: false, error: 'Za prijavo se moraš prijaviti.' });
    if (req.user.isAdmin) return res.status(403).json({ ok: false, error: 'Skrbnik prijav ne oddaja, popravi jih sam.' });
    if (!csrfValid(req)) return res.status(403).json({ ok: false, error: 'Obrazec je potekel. Osveži stran in poskusi znova.' });
    const out = await createReport(req.user, req.body);
    if (out.error) return res.status(out.status).json({ ok: false, error: out.error });
    res.json({ ok: true, id: out.id, left: out.left });
  } catch (e) { next(e); }
});

reportApiRouter.get('/prijave', requireAccess, async (req, res, next) => {
  try {
    if (req.user.isAdmin) return res.redirect('/admin/prijave');
    const rows = (await many('SELECT * FROM reports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200', [req.user.id])).map((r) => ({ ...r, ...describe(r) }));
    // The list is opened, so what the admin wrote is seen. The page still marks what was new.
    const fresh = new Set(rows.filter((r) => r.unseen).map((r) => r.id));
    if (fresh.size) await q('UPDATE reports SET unseen=false WHERE user_id=$1 AND unseen', [req.user.id]);
    res.render('prijave', { rows, fresh, MAX_TEXT, PER_DAY });
  } catch (e) { next(e); }
});

// --- the lists of reports: grouped by year of the exercise or by class and student ----------------------------------
function listView(req, scope) {
  const state = stateOf(req.query.stanje);
  const view = req.query.pogled === 'letniki' ? 'letniki' : 'razredi';
  const year = YEARS.some((y) => y.year === Number(req.query.letnik)) ? Number(req.query.letnik) : null;
  const classId = Number(req.query.razred) || null;
  return { state, view, year, classId, scope };
}
async function renderList(req, res, template, scope, extra = {}) {
  const f = listView(req, scope);
  const { items, more } = await listReports({ scope, state: f.state, classId: f.classId, year: f.year });
  const classes = (await many(
    scope === 'all'
      ? 'SELECT id, name, year FROM classes'
      : 'SELECT c.id, c.name, c.year FROM classes c JOIN class_teachers t ON t.class_id=c.id WHERE t.user_id=$1',
    scope === 'all' ? [] : [scope.teacherId],
  )).sort(byName);
  const counts = (await one(
    scope === 'all'
      ? `SELECT count(*) FILTER (WHERE status='open') AS open, count(*) FILTER (WHERE status='resolved') AS resolved FROM reports`
      : `SELECT count(*) FILTER (WHERE r.status='open') AS open, count(*) FILTER (WHERE r.status='resolved') AS resolved FROM reports r
         WHERE EXISTS (SELECT 1 FROM class_members m JOIN class_teachers t ON t.class_id=m.class_id WHERE m.user_id=r.user_id AND t.user_id=$1)`,
    scope === 'all' ? [] : [scope.teacherId],
  ));
  const here = new URL(req.originalUrl, 'http://x');
  here.searchParams.delete('sporocilo');
  res.render(template, {
    ...f, back: here.pathname + here.search, items, more, classes, counts, MAX_TEXT, years: YEARS,
    groups: f.view === 'letniki' ? byYear(items) : byClass(items),
    message: req.query.sporocilo || null, ...extra,
  });
}

// Teachers only look: the reports of the students in the classes they have joined.
export const teacherReportsRouter = express.Router();
teacherReportsRouter.use(requireTeacher);
teacherReportsRouter.get('/', async (req, res, next) => {
  try {
    if (req.user.isAdmin) return res.redirect('/admin/prijave');
    await renderList(req, res, 'teacher/reports', { teacherId: req.user.id });
  } catch (e) { next(e); }
});

// The admin answers and closes them.
export const adminReportsRouter = express.Router();
adminReportsRouter.use(requireAdmin);
adminReportsRouter.get('/', async (req, res, next) => {
  try { await renderList(req, res, 'admin/reports', 'all', { tab: 'reports' }); } catch (e) { next(e); }
});
const ACTIONS = { shrani: null, resi: 'resolved', odpri: 'open' };
adminReportsRouter.post('/:id', checkCsrf, async (req, res, next) => {
  try {
    const back = (() => {
      const u = new URL(String(req.body.back || ''), 'http://x');
      return u.origin === 'http://x' && u.pathname === '/admin/prijave' ? u.pathname + u.search : '/admin/prijave';
    })();
    const to = (msg) => {
      const u = new URL(back, 'http://x');
      u.searchParams.set('sporocilo', msg);
      return res.redirect(u.pathname + u.search + `#r${Number(req.params.id) || ''}`);
    };
    const r = await one('SELECT * FROM reports WHERE id=$1', [Number(req.params.id) || 0]);
    if (!r) return to('Prijave ni več.');
    const action = Object.hasOwn(ACTIONS, req.body.akcija) ? req.body.akcija : 'shrani';
    const reply = String(req.body.reply ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXT);
    const status = ACTIONS[action] ?? r.status;
    const replyChanged = reply !== (r.reply ?? '');
    const statusChanged = status !== r.status;
    if (!replyChanged && !statusChanged) return to('Ni sprememb.');
    await q(
      `UPDATE reports SET reply=NULLIF($2,''), replied_at=CASE WHEN $3::boolean THEN now() ELSE replied_at END, status=$4,
         resolved_at=CASE WHEN $4='resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END,
         unseen=(unseen OR $5::boolean OR ($3::boolean AND $2<>'')), updated_at=now() WHERE id=$1`,
      [r.id, reply, replyChanged, status, statusChanged],
    );
    await audit(req.user, status === 'resolved' && statusChanged ? 'Rešil prijavo' : statusChanged ? 'Ponovno odprl prijavo' : 'Odgovoril na prijavo', `#${r.id}`);
    to(statusChanged ? (status === 'resolved' ? 'Prijava je označena kot rešena.' : 'Prijava je spet odprta.') : 'Odgovor je shranjen.');
  } catch (e) { next(e); }
});
