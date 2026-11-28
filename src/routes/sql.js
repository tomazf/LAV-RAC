// SQL sandbox pages: the admin's server settings, the teacher's class databases, the student's sandbox and its API.
import express from 'express';
import { checkCsrf, csrfValid, requireAdmin, requireLogin } from '../auth.js';
import { YEARS, yearsOn } from '../catalog.js';
import { audit, many, one, q } from '../db.js';
import { byName } from '../format.js';
import * as sb from '../sqlbox.js';
import { perform, TaskError } from '../tasks.js';

// The message goes into the query, before a #fragment.
const flash = (res, to, msg, err = false) => {
  const [where, hash] = to.split('#');
  res.redirect(`${where}${where.includes('?') ? '&' : '?'}${err ? 'napaka' : 'sporocilo'}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ''}`);
};
const userError = (e) => e instanceof sb.SqlAdminError;
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
    const today = (await one(`SELECT to_char(current_date, 'YYYY-MM-DD') AS d`)).d;
    const statistics = s ? await sb.stats(s.limits, sb.period(req.query, new Date(`${today}T12:00:00Z`))) : null;
    res.render('admin/sql', {
      statistics, PERIODS: sb.PERIODS, KEEP_DAYS: sb.KEEP_DAYS,
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
    const ca = String(b.ca ?? '').replace(/\r\n?/g, '\n').trim(); // a browser textarea sends CRLF
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
const NOT_SET = 'Strežnik še ni nastavljen.';
adminSqlRouter.post('/preizkus', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    const failed = async (e) => {
      // the summary must not say "works" any more: the form opens with the message
      await q('UPDATE sql_server SET checked_at=NULL WHERE id=1');
      sb.forget();
      return e;
    };
    await perform(req, res, { isUserError: userError, after: (r) => flash(res, '/admin/sql', r.message), fail: (m) => flash(res, !s || !sb.keyOk() ? '/admin/sql' : EDIT, m, true) }, async (on) => {
      if (!s || !sb.keyOk()) throw new TaskError(NOT_SET);
      try {
        const t = await sb.testConnection(s, on);
        await q('UPDATE sql_server SET server_version=$1, checked_at=now() WHERE id=1', [t.version]);
        sb.forget();
        return { message: `Povezava deluje: ${t.version}. Skrbniški račun lahko ustvari in izbriše bazo in uporabnika.`, stats: [['Različica strežnika', t.version]] };
      } catch (e) { throw await failed(e); }
    });
  } catch (e) { next(e); }
});
// The full check: a throwaway account tries what students do (and must not be able to do); the window shows each line as it happens and the
// result is kept (date and ok/failed) so the teachers' page can say whether the server was checked. Without script the result is a page.
adminSqlRouter.post('/celoten-preizkus', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    let results = [];
    await perform(req, res, {
      isUserError: userError, fail: (m) => flash(res, '/admin/sql', m, true),
      after: () => res.render('admin/sql_preizkus', { tab: 'sql', message: null, error: null, results, ok: results.every((r) => r.ok !== false), s }),
    }, async (on) => {
      if (!s || !sb.keyOk()) throw new TaskError(NOT_SET);
      results = await sb.selfTest(s, on);
      const bad = results.filter((r) => r.ok === false).length;
      await q('UPDATE sql_server SET selftest_at=now(), selftest_ok=$1 WHERE id=1', [!bad]);
      sb.forget();
      await audit(req.user, 'Celoten preizkus SQL', bad ? `napake: ${bad}` : 'uspešen');
      return {
        message: bad ? 'Preizkus je našel napake. Popravi prvo neuspešno vrstico in ga ponovi; vrstice pod njo so lahko samo posledica.'
          : 'Vse deluje: dijaki lahko ustvarjajo, berejo in pišejo v svojih bazah, tuje baze so jim nedostopne, skupni bazi sta samo za branje.',
        failed: !!bad,
        stats: [['Korakov v redu', results.filter((r) => r.ok === true).length], ['Korakov z napako', bad], ['Preskočenih', results.filter((r) => r.ok === null).length]],
      };
    });
  } catch (e) { next(e); }
});
adminSqlRouter.post('/skupne', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    await perform(req, res, { isUserError: userError, after: (r) => flash(res, '/admin/sql', r.message), fail: (m) => flash(res, '/admin/sql', m, true) }, async (on) => {
      if (!s || !sb.keyOk()) throw new TaskError(NOT_SET);
      const done = await sb.importShared(s, req.user, on);
      return {
        message: 'Skupni bazi sta uvoženi. Dijaki ju lahko berejo, spremeniti ju ne morejo.',
        stats: [['Baz', done.length], ['Tabel', done.reduce((n, d) => n + d.tables, 0)], ['Stavkov iz datotek', done.reduce((n, d) => n + d.statements, 0)]],
      };
    });
  } catch (e) { next(e); }
});
adminSqlRouter.post('/osirotele', checkCsrf, async (req, res, next) => {
  try {
    const s = await sb.settings();
    const deleting = req.body.akcija === 'izbrisi';
    let found = null;
    await perform(req, res, {
      isUserError: userError, fail: (m) => flash(res, '/admin/sql', m, true),
      after: (r) => (deleting ? flash(res, '/admin/sql#osirotele', r.message)
        : flash(res, `/admin/sql?osirotele=${encodeURIComponent(found.join(','))}#osirotele`, r.message)),
    }, async (on) => {
      if (!s || !sb.keyOk()) throw new TaskError(NOT_SET);
      await sb.drainDropQueue();
      if (deleting) {
        const names = [].concat(req.body.db ?? []).map(String);
        const n = await sb.dropOrphans(s, names, req.user, on);
        return { message: `Izbrisanih baz: ${n}.`, stats: [['Izbrisanih baz in računov', n]] };
      }
      found = await on.run('Iskanje baz brez lastnika na strežniku', async () => sb.orphans(s));
      return {
        message: found.length ? `Najdenih baz brez lastnika: ${found.length}.` : 'Na strežniku ni baz brez lastnika.',
        stats: [['Najdenih baz', found.length]], go: `/admin/sql?osirotele=${encodeURIComponent(found.join(','))}#osirotele`,
      };
    });
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
  const out = (req, res, to) => ({ isUserError: userError, after: (r) => flash(res, to, r.message), fail: (m) => flash(res, to, m, true) });
  router.post('/razredi/:id/sql/ustvari', loadClass, sqlClass, ready, checkCsrf, async (req, res, next) => {
    try {
      const s = await sb.settings();
      const ms = await members(req.cls.id);
      const have = new Set((await many('SELECT user_id FROM sql_accounts WHERE user_id = ANY($1)', [ms.map((m) => m.id)])).map((r) => r.user_id));
      const wanted = req.body.user ? new Set([].concat(req.body.user).map(Number)) : null;
      const todo = ms.filter((m) => !have.has(m.id) && (!wanted || wanted.has(m.id)));
      await perform(req, res, out(req, res, base(req)), async (on) => {
        let n = 0;
        on.plan(todo.length);
        try {
          for (const m of todo) { await on.run(`Računa in bazi za ${m.name}`, () => sb.createAccount(s, m, req.user)); n++; }
        } finally { if (n) await audit(req.user, 'Ustvaril baze SQL', `${req.cls.name}: ${n}`); }
        return {
          message: n ? `Ustvarjenih računov z dvema bazama: ${n}. Dijaki vidijo svoje podatke za prijavo v peskovniku.` : 'Vsi dijaki že imajo bazi.',
          stats: [['Računov', n], ['Baz', n * 2]],
        };
      });
    } catch (e) { next(e); }
  });
  router.post('/razredi/:id/sql/dijaki/:uid/:akcija', loadClass, sqlClass, ready, checkCsrf, async (req, res, next) => {
    try {
      const m = await memberOf(req);
      const s = await sb.settings();
      const acc = m ? await sb.accountOf(m.id) : null;
      const to = m ? `${base(req)}#d${m.id}` : base(req);
      const act = req.params.akcija;
      const o = out(req, res, to);
      if (act === 'geslo') {
        // without script the new password is kept in the session for one page view; in the window it is shown right there
        o.after = (r) => { req.session.sqlShown = { cls: req.cls.id, uid: m.id, name: m.name, user: acc.db_user, pass: r.extra.pass }; res.redirect(to); };
      }
      await perform(req, res, o, async (on) => {
        if (!m) throw new TaskError('Dijak ni več v razredu.');
        if (act === 'ustvari') {
          if (acc) return { message: 'Dijak že ima obe bazi.' };
          await on.run(`Račun in bazi za ${m.name}`, () => sb.createAccount(s, m, req.user));
          await audit(req.user, 'Ustvaril bazo SQL', `${req.cls.name}: ${m.name}`);
          return { message: `Baza za ${m.name} je ustvarjena.`, stats: [['Računov', 1], ['Baz', 2]] };
        }
        if (!acc) throw new TaskError('Dijak nima baze.');
        if (act === 'ponastavi') {
          if (req.body.potrdi !== 'on') throw new TaskError('Za ponastavitev označi potrditev.');
          const id = String(req.body.predloga ?? '');
          const tpl = sb.TEMPLATES.find((x) => x.id === id) ?? sb.TEMPLATES[0];
          const t = await on.run(`Ponastavitev baze ${sb.dbOf(acc, tpl.db)}: ${tpl.title}`, () => sb.resetDatabase(s, acc, id));
          await audit(req.user, 'Ponastavil bazo SQL', `${req.cls.name}: ${m.name}: ${t.name}: ${t.id}`);
          return { message: `Baza ${t.name} za ${m.name} je ponastavljena (${t.title}).`, stats: [['Baza', t.name], ['Predloga', t.title]] };
        }
        if (act === 'geslo') {
          const pass = await on.run('Novo geslo na strežniku in v portalu', () => sb.resetPassword(s, acc));
          await audit(req.user, 'Ponastavil geslo SQL', `${req.cls.name}: ${m.name}`);
          return { message: `Novo geslo za ${m.name} je nastavljeno. Staro ne velja več.`, extra: { name: m.name, user: acc.db_user, pass } };
        }
        if (act === 'izbrisi') {
          if (req.body.potrdi !== 'on') throw new TaskError('Za izbris označi potrditev.');
          await on.run(`Brisanje baz ${acc.db_name}, ${acc.db_name6} in računa`, () => sb.dropAccount(s, acc));
          await audit(req.user, 'Izbrisal bazo SQL', `${req.cls.name}: ${m.name}`);
          return { message: `Bazi za ${m.name} sta izbrisani.`, stats: [['Izbrisanih baz', 2], ['Izbrisanih računov', 1]] };
        }
        throw new TaskError('Neznano dejanje.');
      });
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
// The CA certificate the admin entered for the server (public, no key), so Workbench can verify the server: the same text the portal itself trusts.
sqlRouter.get('/sql/ca.pem', requireLogin, sandboxGate, async (req, res, next) => {
  try {
    const s = await sb.settings();
    if (!s?.ca) return res.status(404).type('text/plain; charset=utf-8').send('Certifikat CA ni nastavljen.');
    res.set({ 'Content-Type': 'application/x-pem-file; charset=utf-8', 'Content-Disposition': 'attachment; filename="ca.pem"', 'Cache-Control': 'no-store' });
    res.send(`${s.ca.replace(/\r\n?/g, '\n').trim()}\n`);
  } catch (e) { next(e); }
});
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
