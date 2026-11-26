// SQL sandbox (4th year) against a real MySQL server: the admin's settings, the teacher's class databases with the
// traffic light, the student's sandbox (run, errors, tables, scripts, history, Workbench data), shared read-only
// databases, the year rule and the cleanup after a user is erased.
// Needs TEST_DATABASE_URL and TEST_MYSQL_URL (an account that may create users, e.g. mysql://root:test@127.0.0.1:3306).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { chromium } from 'playwright';
import { startMockOidc, TENANT } from './mock-oidc.js';

const DB = process.env.TEST_DATABASE_URL;
const MY = process.env.TEST_MYSQL_URL;
if (!DB) { console.error('Set TEST_DATABASE_URL'); process.exit(1); }
const skip = !MY && 'TEST_MYSQL_URL ni nastavljen (preizkusi peskovnika potrebujejo MySQL)';
const root = path.resolve(import.meta.dirname, '..');
const APP = 'http://localhost:3105';
const SHOTS = process.env.SQL_SHOTS; // folder for screenshots (manual check of the look), optional
const PREFIX = 'lt_';
const ADMIN = { user: 'lt_portal', pass: 'Portal-geslo-123' };
let server, mock, browser, db, my, myUrl;
const errors = [];
const pages = new Map();
const sql = async (text, params) => (await db.query(text, params)).rows;
const userId = async (username) => (await sql('SELECT id FROM users WHERE username=$1', [username]))[0].id;

async function login(name, viewport = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  if (process.env.SQL_DEBUG) { page.on('console', (m) => console.log(name, m.type(), m.text())); page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message)); }
  await page.goto(APP);
  await page.click('a.btn:text-is("Prijava")');
  await page.click(`a:text-is("${name}")`);
  await page.waitForURL(`${APP}/**`);
  pages.set(name, page);
  return page;
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };
// Puts a script into the CodeMirror editor (as a paste would); one test types with the keyboard.
async function typeSql(p, text) {
  await p.waitForSelector('.sq-ed .cm-content');
  await p.evaluate((t) => { document.getElementById('sq').sqEditor.value = t; }, text);
}
async function runAll(p) {
  await p.click('#sq-run');
  await p.waitForSelector('#sq-out .sq-sum');
  return p.textContent('#sq-out .sq-sum');
}
const api = (p, url, body) => p.evaluate(async ([u, b]) => {
  const csrf = document.getElementById('sq')?.dataset.csrf || document.getElementById('hd-root')?.dataset.csrf;
  const r = await fetch(u, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf, ...b }) });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}, [url, body]);

before(async () => {
  if (skip) return;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  myUrl = new URL(MY);
  my = await mysql.createConnection({ host: myUrl.hostname, port: Number(myUrl.port || 3306), user: decodeURIComponent(myUrl.username), password: decodeURIComponent(myUrl.password), multipleStatements: true });
  // a clean start: no databases or accounts with the test prefix
  for (const [r] of [await my.query("SHOW DATABASES LIKE 'lt\\_%'")]) for (const row of r ?? []) await my.query(`DROP DATABASE \`${Object.values(row)[0]}\``);
  const [users] = await my.query("SELECT user, host FROM mysql.user WHERE user LIKE 'lt\\_%'");
  for (const u of users) await my.query(`DROP USER '${u.user}'@'${u.host}'`);
  // the portal's admin account, as in the setup instructions (without REQUIRE SSL: the test server has no certificate)
  await my.query(`CREATE USER '${ADMIN.user}'@'%' IDENTIFIED BY '${ADMIN.pass}'; GRANT CREATE USER ON *.* TO '${ADMIN.user}'@'%'; GRANT ALL PRIVILEGES ON \`lt\\_%\`.* TO '${ADMIN.user}'@'%' WITH GRANT OPTION;`);

  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  mock = startMockOidc({ port: 9405, clientId: 'c5', clientSecret: 's5' });
  const { CONTENT_DIR, ...env } = process.env;
  server = spawn('node', ['src/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...env, PORT: '3105', DATABASE_URL: DB, PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c5', OIDC_CLIENT_SECRET: 's5', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true', ADMIN_EMAILS: 'admin@sola.test', SESSION_SECRET: 'q'.repeat(40), SQL_KEY: Buffer.alloc(32, 7).toString('base64') },
  });
  await new Promise((ok, no) => {
    server.stdout.on('data', (d) => { if (String(d).includes('posluša')) ok(); });
    server.on('exit', (c) => no(new Error(`server exited ${c}`)));
  });
  browser = await chromium.launch();
  for (const n of ['Sara Skrbnik', 'Tomaž Učitelj', 'Ana Kovač', 'Bor Novak', 'Cene Zupan']) await login(n);
  // R4A (4th year): the teacher, Ana and Bor; R2B (2nd year): Cene
  await sql(`UPDATE users SET role='teacher' WHERE username='ucitelj@sola.test'`);
  const r4 = (await sql(`INSERT INTO classes(name, year) VALUES('R4A', 4) RETURNING id`))[0].id;
  const r2 = (await sql(`INSERT INTO classes(name, year) VALUES('R2B', 2) RETURNING id`))[0].id;
  await sql('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2)', [r4, await userId('ucitelj@sola.test')]);
  for (const u of ['ana.kovac@sola.test', 'bor.novak@sola.test']) await sql('INSERT INTO class_members(class_id, user_id) VALUES($1,$2)', [r4, await userId(u)]);
  await sql('INSERT INTO class_members(class_id, user_id) VALUES($1,$2)', [r2, await userId('cene.zupan@sola.test')]);
});
after(async () => {
  await browser?.close();
  await db?.end();
  await my?.end();
  server?.removeAllListeners('exit');
  server?.kill('SIGKILL');
  mock?.server.close();
});

let r4;
test('sandbox: off until the admin enters the server; only the admin sees the settings', { skip }, async () => {
  const ana = pages.get('Ana Kovač');
  await ana.goto(`${APP}/vaje`);
  assert.equal(await ana.locator('nav a:text-is("SQL peskovnik")').count(), 0);
  assert.equal((await ana.goto(`${APP}/sql`)).status(), 404);
  const t = pages.get('Tomaž Učitelj');
  assert.equal((await t.goto(`${APP}/admin/sql`)).status(), 403);
  const a = pages.get('Sara Skrbnik');
  await a.goto(`${APP}/admin/sql`);
  assert.match(await a.textContent('nav.tabs [aria-current]'), /SQL/);
  await shot(a, '01-admin-prazno');
  // a wrong password: saved, but the page says the connection does not work
  await a.fill('#host', myUrl.hostname);
  await a.fill('#port', myUrl.port || '3306');
  await a.fill('#admin_user', ADMIN.user);
  await a.fill('#admin_pass', 'napacno');
  await a.fill('#prefix', PREFIX);
  await a.uncheck('input[name=tls]');
  await a.click('button:text-is("Shrani in preizkusi")');
  assert.match(await a.textContent('.notice-warn[role=alert]'), /zavrnil prijavo/);
  await a.fill('#admin_pass', ADMIN.pass);
  await a.fill('input[name=timeout]', '2');
  await a.click('button:text-is("Shrani in preizkusi")');
  assert.match(await a.textContent('.notice[role=status]'), /Povezava deluje \(8\./);
  // the password is sealed in the portal's database, never in plain text
  const row = (await sql('SELECT admin_pass, prefix, limits FROM sql_server'))[0];
  assert.ok(row.admin_pass.startsWith('v1:') && !row.admin_pass.includes(ADMIN.pass));
  assert.equal(row.prefix, PREFIX);
  assert.equal(row.limits.timeout, 2);
  // the shared databases
  await a.click('button:text-is("Uvozi skupni bazi")');
  assert.match(await a.textContent('.notice[role=status]'), /Skupni bazi sta uvoženi/);
  const [[cnt]] = await my.query('SELECT count(*) AS n FROM lt_sola.dijak');
  assert.equal(Number(cnt.n), 119);
  await shot(a, '02-admin-nastavljeno');
  r4 = (await sql(`SELECT id FROM classes WHERE name='R4A'`))[0].id;
});

test('teacher: creates the class databases; the traffic light shows only whether a student uses it', { skip }, async () => {
  const t = pages.get('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${r4}`);
  await t.click('a.btn:text-is("SQL baze")');
  assert.equal(new URL(t.url()).pathname, `/ucitelj/razredi/${r4}/sql`);
  assert.equal(await t.locator('.sql-class tbody tr').count(), 2);
  assert.equal(await t.locator('.light.none').count(), 2 + 1, 'two students without a database (and the legend)');
  await t.click('button:has-text("Ustvari bazo vsem")');
  assert.match(await t.textContent('.notice[role=status]'), /Ustvarjenih baz: 2/);
  const accs = await sql('SELECT a.*, u.username FROM sql_accounts a JOIN users u ON u.id=a.user_id ORDER BY u.username');
  assert.deepEqual(accs.map((x) => x.db_name), [`${PREFIX}u${await userId('ana.kovac@sola.test')}`, `${PREFIX}u${await userId('bor.novak@sola.test')}`]);
  assert.ok(accs.every((x) => x.password.startsWith('v1:')));
  const [dbs] = await my.query("SHOW DATABASES LIKE 'lt\\_u%'");
  assert.equal(dbs.length, 2);
  assert.equal(await t.locator('.sql-class .light.grey').count(), 2);
  await shot(t, '03-ucitelj-baze');
  // a 2nd-year class has no SQL databases
  const a = pages.get('Sara Skrbnik');
  const r2 = (await sql(`SELECT id FROM classes WHERE name='R2B'`))[0].id;
  assert.equal((await a.goto(`${APP}/ucitelj/razredi/${r2}/sql`)).status(), 404);
  await a.goto(`${APP}/ucitelj/razredi/${r2}`);
  assert.equal(await a.locator('a.btn:text-is("SQL baze")').count(), 0);
});

test('student: runs a script; results per statement, an error with its line and a hint, the tables on the left', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  await p.goto(`${APP}/vaje`);
  await p.click('nav a:text-is("SQL peskovnik")');
  await p.waitForSelector('.sq-ed .cm-content');
  assert.match(await p.textContent('#sq-db'), /Moja baza \(lt_u\d+\)/);
  await typeSql(p, [
    'CREATE TABLE kraj (',
    '  id INT PRIMARY KEY,',
    '  ime VARCHAR(30) NOT NULL',
    ');',
    "INSERT INTO kraj VALUES (1, 'Novo mesto'), (2, 'Črnomelj'), (3, 'Šentjernej');",
    'SELECT * FROM kraj ORDER BY ime;',
  ].join('\n'));
  assert.match(await runAll(p), /3 stavki izvedeni/);
  assert.equal(await p.locator('.sq-tab').count(), 3);
  assert.equal(await p.getAttribute('.sq-tab:nth-child(3)', 'aria-selected'), 'true', 'the last result table is shown');
  // the Slovene collation of the server: Č after C, Š after S
  assert.deepEqual(await p.$$eval('.sq-grid tbody td:nth-child(3)', (tds) => tds.map((x) => x.textContent)), ['Črnomelj', 'Novo mesto', 'Šentjernej']);
  await p.waitForSelector('.sq-tables .sq-name:text-is("kraj")');
  await shot(p, '04-dijak-rezultat');
  // the second statement fails: the line in the editor, the MySQL message and a Slovene hint; the third does not run
  await typeSql(p, 'SELECT 1;\n\nSELECT ime\nFROM kraji;\nSELECT 3;');
  assert.match(await runAll(p), /Napaka v stavku 2; 1 stavek ni bil izveden/);
  assert.match(await p.textContent('.sq-error'), /1146[\s\S]*doesn't exist[\s\S]*Tabela v tej bazi ne obstaja/);
  assert.match(await p.textContent('.sq-ph .linkbtn'), /vrstica 3/);
  assert.equal(await p.locator('.cm-errline').count(), 1);
  await shot(p, '05-dijak-napaka');
  // a syntax error points at the line inside the statement
  await typeSql(p, 'SELECT *\nFROM kraj\nWHERE ime = \'x\' AND\n  AND id = 1;');
  await runAll(p);
  assert.match(await p.textContent('.sq-ph .linkbtn'), /vrstica 4/);
  // typed with the keyboard; only the statement under the cursor runs (Ctrl+Shift+Enter)
  await typeSql(p, '');
  await p.click('.sq-ed .cm-content');
  await p.keyboard.type('select 1 as a;\nselect 2 as b;');
  await p.keyboard.press('Escape');
  await p.keyboard.press('ControlOrMeta+Shift+Enter');
  await p.waitForSelector('#sq-out .sq-sum');
  assert.equal(await p.locator('.sq-tab').count(), 1);
  assert.deepEqual(await p.$$eval('.sq-grid th', (x) => x.map((e) => e.textContent)), ['#', 'b']);
  assert.equal(await p.textContent('.sq-grid tbody td:nth-child(2)'), '2');
});

test('student: only their own database; the shared ones are read-only; limits and DELIMITER', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  const bor = `${PREFIX}u${await userId('bor.novak@sola.test')}`;
  let r = await api(p, '/api/sql/run', { target: 'moja', sql: `SELECT * FROM ${bor}.kraj` });
  assert.equal(r.d.results[0].ok, false);
  assert.match(r.d.results[0].message, /denied/);
  r = await api(p, '/api/sql/run', { target: 'moja', sql: 'CREATE DATABASE drugo' });
  assert.match(r.d.results[0].message, /denied/);
  r = await api(p, '/api/sql/run', { target: 'sola', sql: 'SELECT count(*) FROM dijak; DELETE FROM dijak' });
  assert.equal(r.d.results[0].rows[0][0], '119');
  assert.match(r.d.results[1].message, /DELETE command denied/);
  r = await api(p, '/api/sql/run', { target: 'drugje', sql: 'SELECT 1' });
  assert.equal(r.status, 400);
  r = await api(p, '/api/sql/run', { target: 'moja', sql: 'DELIMITER $$\nSELECT 1$$' });
  assert.match(r.d.error, /DELIMITER je ukaz MySQL Workbencha/);
  // a statement that takes too long is stopped (the admin set 2 s); big results are cut, the count stays
  r = await api(p, '/api/sql/run', { target: 'moja', sql: 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<900) SELECT a.i FROM n a, n b LIMIT 3000' });
  assert.equal(r.d.results[0].total, 3000);
  assert.equal(r.d.results[0].rows.length, 500);
  assert.equal(r.d.results[0].truncated, true);
  const t0 = Date.now();
  r = await api(p, '/api/sql/run', { target: 'moja', sql: 'SELECT COUNT(*) FROM kraj a, kraj b, kraj c, kraj d, kraj e, kraj f, kraj g, kraj h, kraj i, kraj j, kraj k, kraj l, kraj m, kraj n, kraj o, kraj p, kraj q, kraj r, kraj s, kraj t, kraj u WHERE SLEEP(0.01) = 0' });
  assert.ok(Date.now() - t0 < 6000, 'stopped near the limit');
  assert.equal(r.d.results[0].ok, false);
  // without the token: refused
  const plain = await p.evaluate(async () => (await fetch('/api/sql/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'moja', sql: 'SELECT 1' }) })).status);
  assert.equal(plain, 403);
});

test('student: shared databases in the editor, scripts and history are their own, the draft stays', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  await p.goto(`${APP}/sql`);
  await p.selectOption('#sq-db', 'sola');
  await p.waitForSelector('.sq-tables .sq-name:text-is("dijak")');
  await typeSql(p, 'SELECT o.oznaka, COUNT(*) AS dijakov\nFROM dijak d JOIN oddelek o ON o.id_oddelek = d.id_oddelek\nGROUP BY o.oznaka\nORDER BY o.oznaka;');
  assert.match(await runAll(p), /1 stavek izveden/);
  assert.equal(await p.locator('.sq-grid tbody tr').count(), 8);
  await shot(p, '06-dijak-skupna');
  // save a script
  await p.click('button[data-open=sq-scripts]');
  await p.fill('#sq-name', 'Dijaki po oddelkih');
  await p.click('#sq-save button');
  await p.waitForSelector('#sq-scripts-list li:has-text("Dijaki po oddelkih")');
  await p.click('#sq-scripts [data-close]');
  // the ER diagram of the shared database
  await p.click('#sq-er-open');
  await p.waitForSelector('#sq-er-canvas svg .er-t');
  assert.ok(await p.locator('#sq-er-canvas svg path[d^="M"]').count() >= 8, 'lines for the foreign keys');
  await shot(p, '07-er');
  await p.click('#sq-er [data-close]');
  // the draft is on the server: after a reload it is back, with the same database
  await p.waitForFunction(() => document.getElementById('sq-saved')?.textContent === 'Osnutek shranjen', null, { timeout: 8000 });
  await p.reload();
  await p.waitForSelector('.sq-ed .cm-content');
  assert.equal(await p.inputValue('#sq-db'), 'sola');
  assert.match(await p.textContent('.sq-ed .cm-content'), /GROUP BY o\.oznaka/);
  // Bor does not see Ana's scripts or history
  const b = pages.get('Bor Novak');
  await b.goto(`${APP}/sql`);
  const list = await b.evaluate(async () => (await (await fetch('/api/sql/skripti')).json()).list);
  assert.deepEqual(list, []);
  const hist = await b.evaluate(async () => (await (await fetch('/api/sql/zgodovina')).json()).list);
  assert.deepEqual(hist, []);
  const mine = await p.evaluate(async () => (await (await fetch('/api/sql/zgodovina')).json()).list);
  assert.ok(mine.length >= 5);
});

test('student: Workbench data; the teacher sets a new password and resets the database from a template', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  await p.goto(`${APP}/sql`);
  await p.click('button[data-open=sq-wb]');
  const user = (await p.textContent('#sq-wb .cred div:has(dt:text-is("Username")) code')).trim();
  const pass1 = (await p.textContent('#sq-wb .sq-secret')).trim();
  assert.match(user, /^lt_u\d+$/);
  await shot(p, '08-workbench');
  const conn = (pw) => mysql.createConnection({ host: myUrl.hostname, port: Number(myUrl.port || 3306), user, password: pw, database: user });
  await (await conn(pass1)).end();
  // traffic light: Ana is green now, Bor still grey; the teacher sees no tables or statements
  const t = pages.get('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/sql`);
  const anaId = await userId('ana.kovac@sola.test');
  assert.equal(await t.locator(`#d${anaId} .light.green`).count(), 1);
  assert.doesNotMatch(await t.textContent('main'), /kraj|SELECT/);
  // a new password, shown once
  await t.click(`button[data-edit=e${anaId}]`);
  await t.click(`#e${anaId} button:text-is("Novo geslo")`);
  const pass2 = (await t.textContent('#novo-geslo .big-code')).trim();
  assert.notEqual(pass2, pass1);
  await shot(t, '09-ucitelj-geslo');
  await t.reload();
  assert.equal(await t.locator('#novo-geslo').count(), 0);
  await assert.rejects(conn(pass1));
  await (await conn(pass2)).end();
  await p.reload();
  await p.click('button[data-open=sq-wb]');
  assert.equal((await p.textContent('#sq-wb .sq-secret')).trim(), pass2);
  // reset from the structure of chapter 4.4
  await t.click(`button[data-edit=e${anaId}]`);
  await t.selectOption(`#p${anaId}`, 'struktura');
  await t.check(`#e${anaId} form[action$="/ponastavi"] input[name=potrdi]`);
  await t.click(`#e${anaId} button:text-is("Ponastavi")`);
  assert.match(await t.textContent('.notice[role=status]'), /ponastavljena \(Šolska baza: samo struktura/);
  const [tables] = await my.query(`SHOW TABLES FROM ${user}`);
  assert.deepEqual(tables.map((x) => Object.values(x)[0]).sort(), ['dijak', 'izostanek', 'kraj', 'ocena', 'oddelek', 'poucuje', 'predmet', 'ucitelj']);
  const log = await sql(`SELECT action FROM audit_log WHERE action LIKE '%SQL%' ORDER BY id`);
  assert.deepEqual([...new Set(log.map((x) => x.action))], ['Spremenil nastavitve SQL', 'Uvozil skupne baze SQL', 'Ustvaril baze SQL', 'Ponastavil geslo SQL', 'Ponastavil bazo SQL']);
});

test('a link from an exercise puts its code into the editor and chooses the database', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  const code = 'SELECT priimek, ime\nFROM dijak\nWHERE ime LIKE \'Ž%\';';
  const b64 = Buffer.from(code).toString('base64url');
  await p.goto(`${APP}/sql#koda=${b64}&baza=sola`);
  await p.waitForSelector('.sq-ed .cm-content');
  assert.equal(await p.inputValue('#sq-db'), 'sola');
  assert.match(await p.evaluate(() => document.getElementById('sq').sqEditor.value), /-- Iz vaje:\nSELECT priimek, ime\nFROM dijak\nWHERE ime LIKE 'Ž%';/);
  assert.equal(new URL(p.url()).hash, '');
});

test('the year rule: a 2nd-year student has no sandbox; a teacher makes their own database', { skip }, async () => {
  const c = pages.get('Cene Zupan');
  await c.goto(`${APP}/vaje`);
  assert.equal(await c.locator('nav a:text-is("SQL peskovnik")').count(), 0);
  assert.equal((await c.goto(`${APP}/sql`)).status(), 404);
  await c.goto(`${APP}/vaje`);
  const r = await c.evaluate(async () => (await fetch('/api/sql/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status);
  assert.equal(r, 403);
  const t = pages.get('Tomaž Učitelj');
  await t.goto(`${APP}/sql`);
  await t.click('button:text-is("Ustvari mojo bazo")');
  assert.match(await t.textContent('.notice[role=status]'), /Tvoja baza je ustvarjena/);
  assert.match(await t.textContent('#sq-db'), /Moja baza \(lt_u\d+\)/);
});

test('erasing a user drops their database and account on the MySQL server', { skip }, async () => {
  const a = pages.get('Sara Skrbnik');
  const borId = await userId('bor.novak@sola.test');
  await a.goto(`${APP}/admin`);
  await a.evaluate(async (id) => {
    const csrf = document.getElementById('hd-root').dataset.csrf;
    await fetch(`/admin/uporabniki/${id}/izbrisi`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `_csrf=${csrf}` });
  }, borId);
  const gone = async () => (await my.query(`SHOW DATABASES LIKE 'lt\\_u${borId}'`))[0].length === 0;
  const end = Date.now() + 10000;
  while (!(await gone()) && Date.now() < end) await new Promise((r) => setTimeout(r, 300));
  assert.ok(await gone(), 'the database is dropped');
  const [u] = await my.query(`SELECT 1 FROM mysql.user WHERE user='lt_u${borId}'`);
  assert.equal(u.length, 0);
  assert.equal((await sql('SELECT count(*)::int n FROM sql_drop_queue'))[0].n, 0);
  await a.goto(`${APP}/admin/sql`);
  await a.click('button:text-is("Poišči na strežniku")');
  assert.match(await a.textContent('.notice[role=status]'), /ni baz brez lastnika/);
});

test('sandbox: the narrow screen and the dark theme', { skip }, async () => {
  const p = pages.get('Ana Kovač');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${APP}/sql`);
  await p.waitForSelector('.sq-ed .cm-content');
  await shot(p, '10-telefon');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1 && process.env.SQL_DEBUG) console.log('WIDE ' + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((e) => `${e.tagName}.${e.className}#${e.id} ${Math.round(e.getBoundingClientRect().right)}`))));
  assert.ok(overflow <= 1, `no sideways scrolling (${overflow}px)`);
  await p.setViewportSize({ width: 1360, height: 900 });
  await api(p, '/api/prikaz', { prefs: { theme: 'dark' } });
  await p.goto(`${APP}/sql`);
  await typeSql(p, 'SELECT id, ime FROM kraj;');
  await runAll(p);
  await shot(p, '11-temna');
  await api(p, '/api/prikaz', { prefs: {} });
  assert.deepEqual(errors, []);
});
