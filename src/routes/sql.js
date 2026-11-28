// SQL sandbox pages: the admin's server settings, the teacher's class databases, the student's sandbox and its API.
import express from 'express';
import { checkCsrf, csrfValid, requireAdmin, requireLogin } from '../auth.js';
import { YEARS, yearsOn } from '../catalog.js';
import { audit, many, one, q } from '../db.js';
import { byName } from '../format.js';
import * as sb from '../sqlbox.js';

// The message goes into the query, before a #fragment.
const flash = (res, to, msg, err = false) => {
  const [where, hash] = to.split('#');
  res.redirect(`${where}${where.includes('?') ? '&' : '?'}${err ? 'napaka' : 'sporocilo'}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ''}`);
};
// Sizes as people read them: small databases in kB, larger in MB.
const mb = (bytes) => {
  const b = Number(bytes || 0);
  return b < 1048576 ? `${Math.round(b / 1024)} kB` : `${(b / 1048576).toLocaleString('sl-SI', { maximumFractionDigits: 1 })} MB`;
};

// ---------- admin: Administracija > SQL ----------
export const adminSqlRouter = express.Router();
adminSqlRouter.use(requireAdmin);
adminSqlRouter.get('/', async (req, res, next) => {
  try {
    const s = await sb.settings();
    const rows = await many(
      `SELECT a.*, u.name, u.role, c.id AS class_id, c.name AS class_name, c.year
       FROM sql_accounts a JOIN users u ON u.id=a.user_id
       LEFT JOIN class_members m ON m.user_id=u.id LEFT JOIN classes c ON c.id=m.class_id`,
    );
    const classes = await many(
      `SELECT c.id, c.name, c.year, (SELECT count(*)::int FROM class_members m WHERE m.class_id=c.id) AS students FROM classes c`,
    );
    const sqlClasses = classes.filter((c) => !yearsOn || sb.SQL_YEARS.includes(Number(c.year))).sort(byName).map((c) => {
      const accs = rows.filter((r) => r.class_id === c.id);
      return {
        ...c, accounts: accs.length, active: accs.filter((a) => sb.light(a) === 'green').length,
        bytes: accs.reduce((x, a) => x + Number(a.size_bytes) + Number(a.size_bytes6), 0),
      };
    });
    const others = rows.filter((r) => !r.class_id).sort(byName);
    const queued = (await one('SELECT count(*)::int AS n FROM sql_drop_queue')).n;
    const statistics = s ? await sb.stats(s.limits) : null;
    res.render('admin/sql', {
      statistics,
      tab: 'sql', s, keyOk: sb.keyOk(), editing: req.query.uredi !== undefined, limits: s?.limits ?? sb.DEFAULT_LIMITS, sqlClasses, others, queued, mb, light: sb.light, LIGHTS: sb.LIGHTS,
      locked: rows.length > 0,
      orphanList: req.query.osirotele === undefined ? null : String(req.query.osirotele).split(',').filter((n) => /^[a-z0-9_]+$/.test(n)), SHARED: sb.SHARED,
      message: req.query.sporocilo || null, error: req.query.napaka || null,
    });
  } catch (e) { next(e); }
});
// After a mistake the form stays open (the page otherwise shows a summary once the connection works).
const EDIT = '/admin/sql?uredi=1#streznik';
adminSqlRouter.post('/nastavitve', checkCsrf, async (req, res, next) => {
  try {
    if (!sb.keyOk()) return flash(res, EDIT, 'Najprej nastavi SQL_KEY v datoteki .env.', true);
    const old = await sb.settings();
    const b = req.body;
    const host = String(b.host ?? '').trim();
    const port = Number(b.port) || 3306;
    const adminUser = String(b.admin_user ?? '').trim();
    const pass = String(b.admin_pass ?? '');
    const hasAccounts = !!(await one('SELECT 1 AS x FROM sql_accounts LIMIT 1'));
    const prefix = hasAccounts && old ? old.prefix : String(b.prefix ?? 'lr_').trim().toLowerCase();
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host)) return flash(res, EDIT, 'Naslov strežnika ni pravilen (ime ali IP).', true);
    if (port < 1 || port > 65535) return flash(res, EDIT, 'Vrata morajo biti med 1 in 65535.', true);
    if (!/^[A-Za-z0-9_.-]{1,32}$/.test(adminUser)) return flash(res, EDIT, 'Uporabniško ime skrbniškega računa ni pravilno.', true);
    if (!sb.PREFIX_RE.test(prefix)) return flash(res, EDIT, 'Predpona ima male črke in številke ter konča s podčrtajem, npr. lr_.', true);
    if (!pass && !old) return flash(res, EDIT, 'Vpiši geslo skrbniškega računa.', true);
    const limits = sb.clampLimits({
      timeout: b.timeout, rows: b.rows, sizeMb: b.sizeMb, scriptKb: b.scriptKb, perMinute: b.perMinute, connections: b.connections,
    });
    const ca = String(b.ca ?? '').trim();
    if (ca && !/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(ca)) return flash(res, EDIT, 'Certifikat CA mora biti v obliki PEM (BEGIN CERTIFICATE).', true);
    const sealed = pass ? sb.seal(pass) : old.admin_pass;
    // A different server or account: the shared databases have to be imported there again.
    const moved = old && (old.host !== host || old.port !== port || old.prefix !== prefix);
    await q(
      `INSERT INTO sql_server(id, host, port, admin_user, admin_pass, tls, ca, prefix, limits, updated_at) VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (id) DO UPDATE SET host=$1, port=$2, admin_user=$3, admin_pass=$4, tls=$5, ca=$6, prefix=$7, limits=$8, updated_at=now()
       ${moved ? ', shared_at=NULL, reader_pass=NULL, server_version=NULL, checked_at=NULL' : ''}`,
      [host, port, adminUser, sealed, b.tls === 'on', ca || null, prefix, JSON.stringify(limits)],
    );
    sb.forget();
    await audit(req.user, 'Spremenil nastavitve SQL', `${host}:${port}`);
    // Saving also tests the connection, so the admin sees at once whether it works.
    try {
      const t = await sb.testConnection(await sb.settings());
      await q('UPDATE sql_server SET server_version=$1, checked_at=now() WHERE id=1', [t.version]);
      sb.forget();
      flash(res, '/admin/sql', `Nastavitve so shranjene. Povezava deluje (${t.version}).`);
    } catch (e) {
      if (!(e instanceof sb.SqlAdminError)) throw e;
      flash(res, EDIT, `Nastavitve so shranjene, povezava pa ne deluje: ${e.message}`, true);
    }
  } catch (e) { next(e); }
});
adminSqlRouter.post('/preizkus', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    if (!s || !sb.keyOk()) return flash(res, '/admin/sql', 'Strežnik še ni nastavljen.', true);
    try {
      const t = await sb.testConnection(s);
      await q('UPDATE sql_server SET server_version=$1, checked_at=now() WHERE id=1', [t.version]);
      sb.forget();
      flash(res, '/admin/sql', `Povezava deluje: ${t.version}. Skrbniški račun lahko ustvari in izbriše bazo in uporabnika.`);
    } catch (e) {
      if (!(e instanceof sb.SqlAdminError)) throw e;
      // the summary must not say "works" any more: the form opens with the message
      await q('UPDATE sql_server SET checked_at=NULL WHERE id=1');
      sb.forget();
      flash(res, EDIT, e.message, true);
    }
  } catch (e) { next(e); }
});
// The full check: a throwaway account tries what students do (and must not be able to do); the page shows each line and the result is kept
// (date and ok/failed) so the teachers' page can say whether the server was checked.
adminSqlRouter.post('/celoten-preizkus', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    if (!s || !sb.keyOk()) return flash(res, '/admin/sql', 'Strežnik še ni nastavljen.', true);
    const results = await sb.selfTest(s);
    const ok = results.every((r) => r.ok !== false);
    await q('UPDATE sql_server SET selftest_at=now(), selftest_ok=$1 WHERE id=1', [ok]);
    sb.forget();
    await audit(req.user, 'Celoten preizkus SQL', ok ? 'uspešen' : `napake: ${results.filter((r) => r.ok === false).length}`);
    res.render('admin/sql_preizkus', { tab: 'sql', message: null, error: null, results, ok, s });
  } catch (e) { next(e); }
});
adminSqlRouter.post('/skupne', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    if (!s || !sb.keyOk()) return flash(res, '/admin/sql', 'Strežnik še ni nastavljen.', true);
    try {
      await sb.importShared(s, req.user);
      flash(res, '/admin/sql', 'Skupni bazi sta uvoženi. Dijaki ju lahko berejo, spremeniti ju ne morejo.');
    } catch (e) { if (e instanceof sb.SqlAdminError) flash(res, '/admin/sql', e.message, true); else throw e; }
  } catch (e) { next(e); }
});
adminSqlRouter.post('/osirotele', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    if (!s || !sb.keyOk()) return flash(res, '/admin/sql', 'Strežnik še ni nastavljen.', true);
    try {
      await sb.drainDropQueue();
      if (req.body.akcija === 'izbrisi') {
        const names = [].concat(req.body.db ?? []).map(String);
        const n = await sb.dropOrphans(s, names, req.user);
        return flash(res, '/admin/sql#osirotele', `Izbrisanih baz: ${n}.`);
      }
      const list = await sb.orphans(s);
      flash(res, `/admin/sql?osirotele=${encodeURIComponent(list.join(','))}#osirotele`, list.length ? `Najdenih baz brez lastnika: ${list.length}.` : 'Na strežniku ni baz brez lastnika.');
    } catch (e) { if (e instanceof sb.SqlAdminError) flash(res, '/admin/sql', e.message, true); else throw e; }
  } catch (e) { next(e); }
});

// ---------- teacher: the class's databases (Razredi > razred > SQL baze) ----------
// Registered from teacher.js, which has loadClass (access to the class) and members.
export function teacherSql(router, { loadClass, members }) {
  const sqlClass = (req, res, next) => {
    if (yearsOn && !sb.SQL_YEARS.includes(Number(req.cls.year))) {
      return res.status(404).render('error', { title: 'Ni na voljo', message: `SQL baze so samo za ${sb.SQL_YEARS.join('. in ')}. letnik.` });
    }
    next();
  };
  const ready = async (req, res, next) => {
    try {
      if (!(await sb.available())) return res.status(404).render('error', { title: 'SQL peskovnik ni nastavljen', message: 'Skrbnik še ni vpisal strežnika SQL.' });
      next();
    } catch (e) { next(e); }
  };
  const base = (req) => `/ucitelj/razredi/${req.cls.id}/sql`;
  router.get('/razredi/:id/sql', loadClass, sqlClass, ready, async (req, res, next) => {
    try {
      const ms = await members(req.cls.id);
      const accs = new Map((await many('SELECT * FROM sql_accounts WHERE user_id = ANY($1)', [ms.map((m) => m.id)])).map((a) => [a.user_id, a]));
      const rows = ms.map((m) => ({ ...m, acc: accs.get(m.id) ?? null, light: sb.light(accs.get(m.id)) }));
      // The password is shown once, right after the teacher set a new one (to tell the student).
      const shown = req.session.sqlShown && req.session.sqlShown.cls === req.cls.id ? req.session.sqlShown : null;
      if (shown) { delete req.session.sqlShown; }
      const s = await sb.settings();
      res.render('teacher/sql', {
        cls: req.cls, rows, shown, s, TEMPLATES: sb.TEMPLATES, PERSONAL: sb.PERSONAL, LIGHTS: sb.LIGHTS, mb, limits: s.limits, SHARED: sb.SHARED,
        message: req.query.sporocilo || null, error: req.query.napaka || null,
      });
    } catch (e) { next(e); }
  });
  const memberOf = async (req) => (await members(req.cls.id)).find((m) => m.id === (Number(req.params.uid) || 0)) ?? null;
  const tryAdmin = async (res, to, fn) => {
    try { return await fn(); } catch (e) {
      if (e instanceof sb.SqlAdminError) { flash(res, to, e.message, true); return undefined; }
      throw e;
    }
  };
  router.post('/razredi/:id/sql/ustvari', loadClass, sqlClass, ready, checkCsrf, async (req, res, next) => {
    try {
      const s = await sb.settings();
      const ms = await members(req.cls.id);
      const have = new Set((await many('SELECT user_id FROM sql_accounts WHERE user_id = ANY($1)', [ms.map((m) => m.id)])).map((r) => r.user_id));
      const wanted = req.body.user ? new Set([].concat(req.body.user).map(Number)) : null;
      let n = 0;
      const ok = await tryAdmin(res, base(req), async () => {
        for (const m of ms) if (!have.has(m.id) && (!wanted || wanted.has(m.id))) { await sb.createAccount(s, m, req.user); n++; }
        return true;
      });
      if (n) await audit(req.user, 'Ustvaril baze SQL', `${req.cls.name}: ${n}`);
      if (ok) flash(res, base(req), n ? `Ustvarjenih računov z dvema bazama: ${n}. Dijaki vidijo svoje podatke za prijavo v peskovniku.` : 'Vsi dijaki že imajo bazi.');
    } catch (e) { next(e); }
  });
  router.post('/razredi/:id/sql/dijaki/:uid/:akcija', loadClass, sqlClass, ready, checkCsrf, async (req, res, next) => {
    try {
      const m = await memberOf(req);
      if (!m) return flash(res, base(req), 'Dijak ni več v razredu.', true);
      const s = await sb.settings();
      const acc = await sb.accountOf(m.id);
      const to = `${base(req)}#d${m.id}`;
      const act = req.params.akcija;
      if (act === 'ustvari') {
        if (acc) return flash(res, to, 'Dijak že ima obe bazi.');
        if (await tryAdmin(res, to, () => sb.createAccount(s, m, req.user)) === undefined) return;
        await audit(req.user, 'Ustvaril bazo SQL', `${req.cls.name}: ${m.name}`);
        return flash(res, to, `Baza za ${m.name} je ustvarjena.`);
      }
      if (!acc) return flash(res, to, 'Dijak nima baze.', true);
      if (act === 'ponastavi') {
        if (req.body.potrdi !== 'on') return flash(res, to, 'Za ponastavitev označi potrditev.', true);
        const t = await tryAdmin(res, to, () => sb.resetDatabase(s, acc, String(req.body.predloga ?? '')));
        if (!t) return;
        await audit(req.user, 'Ponastavil bazo SQL', `${req.cls.name}: ${m.name}: ${t.name}: ${t.id}`);
        return flash(res, to, `Baza ${t.name} za ${m.name} je ponastavljena (${t.title}).`);
      }
      if (act === 'geslo') {
        const pass = await tryAdmin(res, to, () => sb.resetPassword(s, acc));
        if (!pass) return;
        req.session.sqlShown = { cls: req.cls.id, uid: m.id, name: m.name, user: acc.db_user, pass };
        await audit(req.user, 'Ponastavil geslo SQL', `${req.cls.name}: ${m.name}`);
        return res.redirect(to);
      }
      if (act === 'izbrisi') {
        if (req.body.potrdi !== 'on') return flash(res, to, 'Za izbris označi potrditev.', true);
        if (await tryAdmin(res, to, () => sb.dropAccount(s, acc)) === undefined) return;
        await audit(req.user, 'Izbrisal bazo SQL', `${req.cls.name}: ${m.name}`);
        return flash(res, to, `Bazi za ${m.name} sta izbrisani.`);
      }
      flash(res, to, 'Neznano dejanje.', true);
    } catch (e) { next(e); }
  });
}

// ---------- the sandbox page and its API ----------
export const sqlRouter = express.Router();
const sandboxGate = async (req, res, next) => {
  try {
    if (!req.user) return req.path.startsWith('/api/') ? res.status(401).json({ ok: false }) : res.redirect('/');
    if (!sb.mayUse(req.user) || !(await sb.available())) {
      return req.path.startsWith('/api/') ? res.status(403).json({ ok: false, error: 'Peskovnik ni na voljo.' })
        : res.status(404).render('error', { title: 'SQL peskovnik ni na voljo', message: 'Peskovnik je za dijake 4. letnika, ko skrbnik nastavi strežnik SQL.' });
    }
    next();
  } catch (e) { next(e); }
};
const apiCsrf = (req, res, next) => (csrfValid(req) ? next() : res.status(403).json({ ok: false, error: 'Stran je potekla. Osveži jo in poskusi znova.' }));
const targets = async () => {
  const s = await sb.settings();
  return [...Object.entries(sb.PERSONAL).map(([id, p]) => ({ id, title: p.title })), ...(s.shared_at ? sb.SHARED.map((x) => ({ id: x.id, title: x.title, readonly: true })) : [])];
};
const targetOk = async (t) => (await targets()).some((x) => x.id === t);

sqlRouter.get('/sql', requireLogin, sandboxGate, async (req, res, next) => {
  try {
    const s = await sb.settings();
    const acc = await sb.accountOf(req.user.id);
    const draft = await one('SELECT * FROM sql_drafts WHERE user_id=$1', [req.user.id]);
    const list = await targets();
    const usable = (t) => (sb.isPersonal(t) ? !!sb.dbOf(acc, t) : true);
    const start = draft && list.some((t) => t.id === draft.target && usable(t.id)) ? draft.target : acc ? 'moja' : list.find((t) => !sb.isPersonal(t.id))?.id ?? 'moja';
    res.render('sql/sandbox', {
      s, acc, pass: acc ? sb.unseal(acc.password) : null, targets: list, start, draft: draft?.body ?? '',
      TEMPLATES: sb.TEMPLATES, PERSONAL: sb.PERSONAL, SHARED: sb.SHARED, limits: s.limits, mb, years: YEARS,
      message: req.query.sporocilo || null, error: req.query.napaka || null,
    });
  } catch (e) { next(e); }
});
// A teacher (or admin) makes their own database for trying things out.
sqlRouter.post('/sql/ustvari', requireLogin, sandboxGate, checkCsrf, async (req, res, next) => {
  try {
    if (!req.user.isTeacher) return flash(res, '/sql', 'Bazo dijaku ustvari učitelj.', true);
    if (await sb.accountOf(req.user.id)) return res.redirect('/sql');
    try { await sb.createAccount(await sb.settings(), req.user, req.user); } catch (e) {
      if (e instanceof sb.SqlAdminError) return flash(res, '/sql', e.message, true);
      throw e;
    }
    await audit(req.user, 'Ustvaril bazo SQL', req.user.name);
    flash(res, '/sql', 'Tvoja baza je ustvarjena.');
  } catch (e) { next(e); }
});
sqlRouter.post('/sql/ponastavi', requireLogin, sandboxGate, checkCsrf, async (req, res, next) => {
  try {
    const acc = await sb.accountOf(req.user.id);
    if (!acc) return flash(res, '/sql', 'Nimaš še svoje baze.', true);
    if (req.body.potrdi !== 'on') return flash(res, '/sql', 'Za ponastavitev označi potrditev.', true);
    let t;
    try { t = await sb.resetDatabase(await sb.settings(), acc, String(req.body.predloga ?? '')); } catch (e) {
      if (e instanceof sb.SqlAdminError) return flash(res, '/sql', e.message, true);
      throw e;
    }
    await audit(req.user, 'Ponastavil svojo bazo SQL', `${t.name}: ${t.id}`);
    flash(res, '/sql', `Baza ${t.name} je ponastavljena: ${t.title}.`);
  } catch (e) { next(e); }
});

sqlRouter.post('/api/sql/run', sandboxGate, apiCsrf, async (req, res, next) => {
  try {
    const target = String(req.body.target ?? '');
    if (!(await targetOk(target))) return res.status(400).json({ ok: false, error: 'Baza ni na voljo.' });
    const s = await sb.settings();
    if (!sb.rateOk(req.user.id, s.limits.perMinute)) return res.status(429).json({ ok: false, error: `Preveč zagonov v eni minuti (največ ${s.limits.perMinute}). Počakaj trenutek.` });
    const text = String(req.body.sql ?? '');
    const out = await sb.run(req.user, target, text);
    if (out.results) await sb.remember(req.user.id, target, text, out);
    res.json(out);
  } catch (e) { next(e); }
});
sqlRouter.get('/api/sql/shema', sandboxGate, async (req, res, next) => {
  try {
    const target = String(req.query.baza ?? '');
    if (!(await targetOk(target))) return res.status(400).json({ ok: false });
    try {
      const sc = await sb.schema(req.user, target);
      res.json(sc ? { ok: true, ...sc } : { ok: false, error: 'Baza ni na voljo.' });
    } catch (e) {
      console.error('SQL peskovnik (shema):', e.code || '', e.message);
      res.json({ ok: false, error: 'Strežnik SQL trenutno ni dosegljiv.' });
    }
  } catch (e) { next(e); }
});
sqlRouter.post('/api/sql/osnutek', sandboxGate, apiCsrf, async (req, res, next) => {
  try {
    const target = String(req.body.target ?? 'moja');
    const body = String(req.body.sql ?? '').slice(0, 256 * 1024);
    await q(`INSERT INTO sql_drafts(user_id, target, body) VALUES($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET target=$2, body=$3, updated_at=now()`,
      [req.user.id, (await targetOk(target)) ? target : 'moja', body]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
const MAX_SCRIPTS = 50;
sqlRouter.get('/api/sql/skripti', sandboxGate, async (req, res, next) => {
  try {
    res.json({ ok: true, list: await many('SELECT id, name, body, updated_at FROM sql_scripts WHERE user_id=$1 ORDER BY lower(name)', [req.user.id]) });
  } catch (e) { next(e); }
});
sqlRouter.post('/api/sql/skripti', sandboxGate, apiCsrf, async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const body = String(req.body.body ?? '').slice(0, 256 * 1024);
    if (!name) return res.status(400).json({ ok: false, error: 'Vpiši ime skripta.' });
    const exists = await one('SELECT id FROM sql_scripts WHERE user_id=$1 AND name=$2', [req.user.id, name]);
    if (!exists && (await one('SELECT count(*)::int AS n FROM sql_scripts WHERE user_id=$1', [req.user.id])).n >= MAX_SCRIPTS) {
      return res.status(400).json({ ok: false, error: `Shraniš lahko največ ${MAX_SCRIPTS} skriptov. Izbriši katerega.` });
    }
    await q(`INSERT INTO sql_scripts(user_id, name, body) VALUES($1,$2,$3) ON CONFLICT (user_id, name) DO UPDATE SET body=$3, updated_at=now()`, [req.user.id, name, body]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
sqlRouter.post('/api/sql/skripti/:sid/izbrisi', sandboxGate, apiCsrf, async (req, res, next) => {
  try {
    await q('DELETE FROM sql_scripts WHERE id=$1 AND user_id=$2', [Number(req.params.sid) || 0, req.user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
sqlRouter.get('/api/sql/zgodovina', sandboxGate, async (req, res, next) => {
  try {
    res.json({ ok: true, list: await many('SELECT id, target, body, ok, ms, statements, created_at FROM sql_history WHERE user_id=$1 ORDER BY id DESC LIMIT 100', [req.user.id]) });
  } catch (e) { next(e); }
});
