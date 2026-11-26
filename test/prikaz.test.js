// Display settings (theme, text size, spacing, contrast, motion) and reports (»Prijave«), as the portal ships them with its real content.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { chromium } from 'playwright';
import { startMockOidc, TENANT } from './mock-oidc.js';

const DB = process.env.TEST_DATABASE_URL;
if (!DB) { console.error('Set TEST_DATABASE_URL'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const APP = 'http://localhost:3103';
let server, mock, browser, db;
const errors = [];
const pages = new Map();

async function login(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(APP);
  await page.click('a.btn:text-is("Prijava")');
  await page.click(`a:text-is("${name}")`);
  await page.waitForURL(`${APP}/**`);
  pages.set(name, page);
  return page;
}
const sql = async (text, params) => (await db.query(text, params)).rows;
const userId = async (username) => (await sql('SELECT id FROM users WHERE username=$1', [username]))[0].id;
const csrfOf = (p) => p.evaluate(() => document.getElementById('hd-root')?.dataset.csrf || window.__LAVHD?.csrf);
const at = (p, hash) => p.waitForFunction((h) => {
  const [id, n] = h.split('/');
  if (location.hash !== '#' + h || document.querySelector('.page.on')?.id !== id) return false;
  return !n || document.querySelector('.page.on .lr-num[aria-current=step]')?.textContent === n;
}, hash);
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await at(p, hash); };
const THEORY = ['uvod', 'datoteke', 'shranjevanje', 'supb', 'integriteta', 'ansi', 'neodvisnost', 'relmodel', 'jeziki', 'uporabniki', 'racuni', 'grant', 'revoke', 'is', 'utrjevanje'];
const bg = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const dlg = (p) => p.locator('dialog.hd-dlg[open]');
// the real radio sits under its label, so a click on the text and a check of the radio are the same thing
const choose = (p, label) => dlg(p).getByLabel(label, { exact: true }).check();

before(async () => {
  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  mock = startMockOidc({ port: 9403, clientId: 'c3', clientSecret: 's3' });
  const { CONTENT_DIR, ...env } = process.env;
  server = spawn('node', ['src/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...env, PORT: '3103', DATABASE_URL: DB, PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c3', OIDC_CLIENT_SECRET: 's3', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true', ADMIN_EMAILS: 'admin@sola.test', SESSION_SECRET: 'z'.repeat(40) },
  });
  await new Promise((ok, no) => {
    server.stdout.on('data', (d) => { if (String(d).includes('posluša')) ok(); });
    server.on('exit', (c) => no(new Error(`server exited ${c}`)));
  });
  browser = await chromium.launch();
  for (const n of ['Sara Skrbnik', 'Tomaž Učitelj', 'Ana Kovač', 'Bor Novak', 'Cene Zupan']) await login(n);
  // R4A (4th year, 4.2 open): the teacher and two students; R2B (2nd year): one student, the teacher is not in it
  await sql(`UPDATE users SET role='teacher' WHERE username='ucitelj@sola.test'`);
  const r4 = (await sql(`INSERT INTO classes(name, year) VALUES('R4A', 4) RETURNING id`))[0].id;
  const r2 = (await sql(`INSERT INTO classes(name, year) VALUES('R2B', 2) RETURNING id`))[0].id;
  await sql('INSERT INTO class_teachers(class_id, user_id) VALUES($1,$2)', [r4, await userId('ucitelj@sola.test')]);
  for (const u of ['ana.kovac@sola.test', 'bor.novak@sola.test']) await sql('INSERT INTO class_members(class_id, user_id) VALUES($1,$2)', [r4, await userId(u)]);
  await sql('INSERT INTO class_members(class_id, user_id) VALUES($1,$2)', [r2, await userId('cene.zupan@sola.test')]);
  await sql(`INSERT INTO class_exercises(class_id, exercise_id, visible, sort_order) VALUES($1,'4.2',true,1)`, [r4]);
  await sql(`INSERT INTO class_exercises(class_id, exercise_id, visible, sort_order) VALUES($1,'2.1',true,1)`, [r2]);
});
after(async () => {
  await browser?.close();
  await db?.end();
  server?.removeAllListeners('exit');
  server?.kill('SIGKILL');
  mock?.server.close();
});

test('4.2: an option beyond the sixth gets the letter G, not "undefined"', async () => {
  // the importer replaces the six-letter string in every exercise, not only in 4.2
  for (const f of readdirSync(path.join(root, 'content/exercises'))) assert.doesNotMatch(readFileSync(path.join(root, 'content/exercises', f), 'utf8'), /"ABCDEF"\[/, f);
  const a = pages.get('Sara Skrbnik');
  await a.goto(`${APP}/vaje/4.2`);
  await a.waitForSelector('.lr-top-in');
  const letters = await a.$$eval('.opt b', (els) => els.map((e) => e.textContent.trim()));
  assert.ok(letters.includes('G'), 'the task with seven options has a G');
  assert.ok(!letters.includes('undefined'));
  assert.deepEqual([...new Set(letters)].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});

test('display settings: normalised and saved per user; the page and the exercise carry them in the <html> tag', async () => {
  const a = pages.get('Ana Kovač');
  await a.goto(`${APP}/vaje`);
  const token = await csrfOf(a);
  const call = (body) => a.evaluate(async (b) => { const r = await fetch('/api/prikaz', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, d: await r.json() }; }, body);
  // no token: refused; unknown values are dropped, missing ones are the defaults
  assert.equal((await call({ prefs: { theme: 'dark' } })).status, 403);
  const out = await call({ csrf: token, prefs: { theme: 'neon', size: 'large', evil: '"><script>', contrast: ['high'] } });
  assert.deepEqual(out.d.prefs, { theme: 'auto', size: 'large', spacing: 'normal', contrast: 'normal', motion: 'auto' });
  const stored = (await sql(`SELECT prefs FROM users WHERE username='ana.kovac@sola.test'`))[0].prefs;
  assert.deepEqual(stored, out.d.prefs);
  const raw = async (url) => (await a.context().request.get(`${APP}${url}`)).text();
  assert.match(await raw('/vaje'), /<html lang="sl" data-size="large">/);
  assert.match(await raw('/vaje/4.2'), /<html lang="sl" data-size="large">/);
  // another user is not affected
  const bor = pages.get('Bor Novak');
  assert.match(await (await bor.context().request.get(`${APP}/vaje`)).text(), /<html lang="sl">/);
  await call({ csrf: token, prefs: {} });
});

test('the theme button: dark and light win over the system setting, in the portal and in the exercise, and the choice is kept', async () => {
  const a = pages.get('Ana Kovač');
  await a.emulateMedia({ colorScheme: 'light' });
  await a.goto(`${APP}/vaje`);
  assert.equal(await bg(a), 'rgb(245, 243, 248)');
  await a.click('.hd-btn[aria-label="Prikaz"]');
  await choose(a, 'Temna');
  await a.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await bg(a), 'rgb(23, 16, 33)');
  await dlg(a).locator('text=Shranjeno pri tvojem računu').waitFor();
  assert.equal((await sql(`SELECT prefs->>'theme' AS t FROM users WHERE username='ana.kovac@sola.test'`))[0].t, 'dark');
  await a.keyboard.press('Escape');
  // reload and the exercise: dark although the system is light
  await a.reload();
  assert.equal(await a.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await bg(a), 'rgb(23, 16, 33)');
  await a.goto(`${APP}/vaje/4.2#pregled`);
  await a.waitForSelector('.lr-top-in .hd-btns');
  assert.equal(await bg(a), 'rgb(23, 16, 33)');
  // the opposite: light although the system is dark
  await a.emulateMedia({ colorScheme: 'dark' });
  await a.click('.hd-btn[aria-label="Prikaz"]');
  await choose(a, 'Svetla');
  await a.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  assert.equal(await bg(a), 'rgb(255, 250, 244)');
  await dlg(a).locator('text=Shranjeno pri tvojem računu').waitFor();
  await a.keyboard.press('Escape');
  await a.goto(`${APP}/vaje`);
  assert.equal(await bg(a), 'rgb(245, 243, 248)');
  // automatic again: the system decides
  await a.click('.hd-btn[aria-label="Prikaz"]');
  await choose(a, 'Samodejno (kot v sistemu)');
  await a.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'));
  assert.equal(await bg(a), 'rgb(23, 16, 33)');
  await dlg(a).locator('text=Shranjeno pri tvojem računu').waitFor();
  await a.keyboard.press('Escape');
  await a.emulateMedia({ colorScheme: 'light' });
});

test('text size, spacing, contrast and motion apply at once, in the portal and in the exercise, and Ponastavi puts everything back', async () => {
  const a = pages.get('Ana Kovač');
  await a.emulateMedia({ colorScheme: 'light' });
  await a.goto(`${APP}/prijave`);
  const size = () => a.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  assert.equal(await size(), '16px');
  await a.click('.hd-btn[aria-label="Prikaz"]');
  await choose(a, 'Največja');
  assert.equal(await size(), '22px');
  await choose(a, 'Večja');
  assert.equal(await size(), '19px');
  await choose(a, 'Povečan');
  assert.notEqual(await a.evaluate(() => getComputedStyle(document.querySelector('main p')).letterSpacing), 'normal');
  await choose(a, 'Visok');
  assert.equal(await a.evaluate(() => getComputedStyle(document.body).color), 'rgb(0, 0, 0)');
  await choose(a, 'Zmanjšane');
  await dlg(a).locator('text=Shranjeno pri tvojem računu').waitFor();
  await a.keyboard.press('Escape');
  const attrs = await a.evaluate(() => ['theme', 'size', 'spacing', 'contrast', 'motion'].map((k) => document.documentElement.dataset[k] ?? null));
  assert.deepEqual(attrs, [null, 'large', 'wide', 'high', 'reduce']);
  // the same in the exercise, from the server: bigger text, dark ink on white, and the quiet motion
  await a.goto(`${APP}/vaje/4.2#pregled`);
  await a.waitForSelector('.lr-top-in .hd-btns');
  assert.equal(await size(), '19px');
  assert.equal(await a.evaluate(() => getComputedStyle(document.body).color), 'rgb(0, 0, 0)');
  // and high contrast in the dark scheme is white on black
  await a.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await bg(a), 'rgb(0, 0, 0)');
  assert.equal(await a.evaluate(() => getComputedStyle(document.body).color), 'rgb(255, 255, 255)');
  await a.emulateMedia({ colorScheme: 'light' });
  await a.click('.hd-btn[aria-label="Prikaz"]');
  await dlg(a).locator('button:text-is("Ponastavi")').click();
  await dlg(a).locator('text=Shranjeno pri tvojem računu').waitFor();
  assert.deepEqual((await sql(`SELECT prefs FROM users WHERE username='ana.kovac@sola.test'`))[0].prefs, { theme: 'auto', size: 'normal', spacing: 'normal', contrast: 'normal', motion: 'auto' });
  assert.equal(await size(), '16px');
  await a.keyboard.press('Escape');
});

test('the buttons sit in the header of the portal and of the exercise; the admin gets no report button', async () => {
  const ana = pages.get('Ana Kovač');
  await ana.goto(`${APP}/vaje`);
  assert.equal(await ana.locator('.who .hd-btn').count(), 2);
  await ana.goto(`${APP}/vaje/4.2#pregled`);
  await ana.waitForSelector('.lr-top-in .lvs-right .hd-btns');
  assert.deepEqual(await ana.$$eval('.lr-top-in .lvs-right > *', (els) => els.map((e) => e.className.split(' ')[0])), ['lvs-status', 'hd-btns', 'lvs-out']);
  assert.equal(await ana.locator('.hd-btn').count(), 2);
  const sara = pages.get('Sara Skrbnik');
  await sara.goto(`${APP}/vaje/4.2#pregled`);
  await sara.waitForSelector('.lr-top-in .hd-btns');
  assert.equal(await sara.locator('.hd-btn').count(), 1);
  assert.equal(await sara.locator('.hd-btn[aria-label="Prikaz"]').count(), 1);
  const status = await sara.evaluate(async (t) => (await fetch('/api/prijava', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: t, text: 'x' }) })).status, await csrfOf(sara));
  assert.equal(status, 403);
});

test('a report from a task knows where it was written; empty, too long and too many are refused', async () => {
  const a = pages.get('Ana Kovač');
  await a.goto(`${APP}/vaje/4.2#uvod`);
  await a.waitForSelector('.lr-top-in .hd-btns');
  for (const id of THEORY) await go(a, id);
  await go(a, 'naloge-b/3');
  await a.click('.hd-btn[aria-label="Prijavi napako ali težavo"]');
  const d = dlg(a);
  assert.match(await d.locator('.hd-where').innerText(), /Vsebina: 4\. letnik · 2\. poglavje · .*naloga B\.3/);
  assert.equal(await d.locator('button:text-is("Oddaj")').isDisabled(), true);
  await d.locator('textarea').fill('V tej nalogi manjka pravilni odgovor.');
  await d.locator('button:text-is("Oddaj")').click();
  await d.locator('text=Hvala, prijava je oddana').waitFor();
  const rows = await sql(`SELECT r.* FROM reports r JOIN users u ON u.id=r.user_id WHERE u.username='ana.kovac@sola.test'`);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].exercise_id, rows[0].page_id, rows[0].task_label, rows[0].task_no, rows[0].path, rows[0].status, rows[0].unseen], ['4.2', 'naloge-b', 'B.3', 3, null, 'open', false]);
  assert.equal(rows[0].body, 'V tej nalogi manjka pravilni odgovor.');
  await a.keyboard.press('Escape');
  // from a portal page it is the address
  await a.goto(`${APP}/vaje`);
  await a.click('.hd-btn[aria-label="Prijavi napako ali težavo"]');
  await dlg(a).locator('textarea').fill('Seznam vaj se ne naloži do konca.');
  await dlg(a).locator('button:text-is("Oddaj")').click();
  await dlg(a).locator('text=Hvala, prijava je oddana').waitFor();
  const second = (await sql(`SELECT * FROM reports ORDER BY id DESC LIMIT 1`))[0];
  assert.deepEqual([second.exercise_id, second.path], [null, '/vaje']);
  await a.keyboard.press('Escape');
  // the page cannot make up a place: an unknown exercise, a page of another exercise and a bad label are dropped
  const token = await csrfOf(a);
  const send = (b) => a.evaluate(async (x) => { const r = await fetch('/api/prijava', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x) }); return { status: r.status, d: await r.json() }; }, { csrf: token, ...b });
  assert.equal((await send({ text: '   ' })).status, 400);
  assert.equal((await send({ text: 'x'.repeat(2001) })).status, 400);
  assert.equal((await send({ text: 'Napačen kraj', exercise: '9.9', hash: 'uvod', label: 'A.1', path: '//evil' })).status, 200);
  assert.equal((await send({ text: 'Tuja stran', exercise: '4.2', hash: 'ni-take-strani/5', label: '<b>A.1' })).status, 200);
  const odd = await sql(`SELECT * FROM reports WHERE body IN ('Napačen kraj', 'Tuja stran') ORDER BY id`);
  assert.deepEqual(odd.map((r) => [r.exercise_id, r.page_id, r.task_label, r.task_no, r.path]), [[null, null, null, null, null], ['4.2', null, null, null, null]]);
  // ten in 24 hours
  const ana = await userId('ana.kovac@sola.test');
  const have = Number((await sql('SELECT count(*) AS n FROM reports WHERE user_id=$1', [ana]))[0].n);
  for (let i = have; i < 10; i++) await sql(`INSERT INTO reports(user_id, body) VALUES($1,'polnilo')`, [ana]);
  const over = await send({ text: 'Ena prijava preveč.' });
  assert.equal(over.status, 429);
  assert.match(over.d.error, /jutri/);
  await sql(`DELETE FROM reports WHERE body='polnilo'`);
});

test('the admin sees reports by class and student or by year and chapter, the teacher only those of their classes and cannot answer', async () => {
  const bor = pages.get('Bor Novak');
  const cene = pages.get('Cene Zupan');
  await bor.goto(`${APP}/vaje/4.2#grant`);
  await bor.waitForSelector('.lr-top-in .hd-btns');
  await bor.click('.hd-btn[aria-label="Prijavi napako ali težavo"]');
  await dlg(bor).locator('textarea').fill('Razlaga o GRANT je nejasna.');
  await dlg(bor).locator('button:text-is("Oddaj")').click();
  await dlg(bor).locator('text=Hvala, prijava je oddana').waitFor();
  await cene.goto(`${APP}/vaje/2.1#uvod`);
  await cene.waitForSelector('.lr-top-in .hd-btns');
  await cene.click('.hd-btn[aria-label="Prijavi napako ali težavo"]');
  await dlg(cene).locator('textarea').fill('Simulacija v 2.1 se ne odziva.');
  await dlg(cene).locator('button:text-is("Oddaj")').click();
  await dlg(cene).locator('text=Hvala, prijava je oddana').waitFor();

  const teacher = pages.get('Tomaž Učitelj');
  await teacher.goto(`${APP}/ucitelj/prijave`);
  assert.deepEqual(await teacher.locator('.rp-group h2').allInnerTexts(), ['R4A · 4. letnik (5)'].map((s) => s));
  assert.deepEqual(await teacher.locator('.rp-group h3').allInnerTexts(), ['Ana Kovač (4)', 'Bor Novak (1)']);
  assert.equal(await teacher.locator('textarea').count(), 0);
  assert.equal(await teacher.locator('button[name=akcija]').count(), 0);
  assert.doesNotMatch(await teacher.locator('main').innerText(), /Simulacija v 2\.1/);
  assert.match(await teacher.locator('nav[aria-label="Glavni meni"] a:has-text("Prijave") .cnt').innerText(), /5/);
  // a teacher cannot change a report
  const id = (await sql(`SELECT id FROM reports ORDER BY id LIMIT 1`))[0].id;
  const denied = await teacher.evaluate(async ([i, t]) => (await fetch(`/admin/prijave/${i}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `_csrf=${encodeURIComponent(t)}&akcija=resi&reply=ok` })).status, [id, await csrfOf(teacher)]);
  assert.equal(denied, 403);
  assert.equal((await sql('SELECT status FROM reports WHERE id=$1', [id]))[0].status, 'open');

  const admin = pages.get('Sara Skrbnik');
  await admin.goto(`${APP}/admin/prijave`);
  assert.deepEqual(await admin.locator('.rp-group h2').allInnerTexts(), ['R2B · 2. letnik (1)', 'R4A · 4. letnik (5)']);
  // the counter is on Prijave in the main menu (like the teacher's), not on Administracija
  assert.match(await admin.locator('nav[aria-label="Glavni meni"] a:has-text("Prijave") .cnt').innerText(), /6/);
  assert.equal(await admin.locator('nav[aria-label="Glavni meni"] a:has-text("Administracija") .cnt').count(), 0);
  assert.equal(await admin.locator('nav[aria-label="Glavni meni"] a[aria-current="page"]').innerText().then((t) => t.replace(/\s*\d+$/, '')), 'Prijave');
  // no tab of Administracija for it: the button in the main menu is the way in
  assert.equal(await admin.locator('nav[aria-label="Administracija"]').count(), 0);
  assert.equal(await admin.locator('h1').innerText(), 'Prijave');
  await admin.goto(`${APP}/admin`);
  assert.equal(await admin.locator('nav[aria-label="Administracija"] a:text-is("Prijave")').count(), 0);
  await admin.goto(`${APP}/admin/prijave`);
  await admin.goto(`${APP}/admin/prijave?pogled=letniki`);
  assert.deepEqual(await admin.locator('.rp-group h2').allInnerTexts(), ['2. letnik (1)', '4. letnik (3)', 'Splošno (ni vezano na vajo) (2)']);
  assert.match((await admin.locator('.rp-group h3').allInnerTexts()).join('|'), /^2\.1 · .*\(1\)\|4\.2 · .*\(3\)\|Brez vaje \(2\)$/);
  // the place is a link to the exact task
  assert.ok(await admin.locator('.rp a[href="/vaje/4.2#naloge-b/3"]').count());
  // an exercise filter by year and a class filter
  await admin.goto(`${APP}/admin/prijave?letnik=2`);
  assert.equal(await admin.locator('.rp').count(), 1);
  await admin.goto(`${APP}/admin/prijave?razred=${(await sql(`SELECT id FROM classes WHERE name='R4A'`))[0].id}`);
  assert.equal(await admin.locator('.rp').count(), 5);
});

test('the admin answers and resolves; the author sees the status and the answer once, and it can be opened again', async () => {
  const admin = pages.get('Sara Skrbnik');
  const ana = pages.get('Ana Kovač');
  const first = (await sql(`SELECT r.id FROM reports r JOIN users u ON u.id=r.user_id WHERE u.username='ana.kovac@sola.test' AND r.task_label='B.3'`))[0].id;
  await admin.goto(`${APP}/admin/prijave`);
  const card = admin.locator(`#r${first}`);
  await card.locator('textarea').fill('Popravljeno, hvala za opozorilo.');
  await card.locator('button:text-is("Shrani in označi kot rešeno")').click();
  await admin.locator('.notice:has-text("označena kot rešena")').waitFor();
  const row = (await sql('SELECT * FROM reports WHERE id=$1', [first]))[0];
  assert.deepEqual([row.status, row.reply, row.unseen], ['resolved', 'Popravljeno, hvala za opozorilo.', true]);
  assert.ok(row.resolved_at && row.replied_at);
  // it left the open list, and it is in the resolved one
  assert.equal(await admin.locator(`#r${first}`).count(), 0);
  await admin.goto(`${APP}/admin/prijave?stanje=resene`);
  assert.match(await admin.locator(`#r${first}`).innerText(), /Rešeno/);
  // an answer without a status change
  const bor = (await sql(`SELECT id FROM reports WHERE body LIKE 'Razlaga o GRANT%'`))[0].id;
  await admin.goto(`${APP}/admin/prijave`);
  await admin.locator(`#r${bor}`).locator('textarea').fill('Dodali bomo primer.');
  await admin.locator(`#r${bor}`).locator('button:text-is("Shrani odgovor")').click();
  await admin.locator('.notice:has-text("Odgovor je shranjen")').waitFor();
  assert.deepEqual((await sql('SELECT status, reply, unseen FROM reports WHERE id=$1', [bor]))[0], { status: 'open', reply: 'Dodali bomo primer.', unseen: true });
  // saving the same again changes nothing
  await admin.locator(`#r${bor}`).locator('button:text-is("Shrani odgovor")').click();
  await admin.locator('.notice:has-text("Ni sprememb")').waitFor();

  // the author: a number on the button, the list with the status and the answer, then the number is gone
  await ana.goto(`${APP}/vaje`);
  assert.equal(await ana.locator('.hd-btn[aria-label="Prijavi napako ali težavo"] .hd-badge').innerText(), '1');
  await ana.goto(`${APP}/vaje/4.2#pregled`);
  await ana.waitForSelector('.lr-top-in .hd-btns');
  assert.equal(await ana.locator('.hd-badge').innerText(), '1');
  await ana.goto(`${APP}/prijave`);
  const mine = ana.locator(`#r${first}`);
  assert.match(await mine.innerText(), /Rešeno/);
  assert.match(await mine.innerText(), /Odgovor skrbnika[\s\S]*Popravljeno, hvala za opozorilo\./);
  assert.equal(await mine.locator('.rp-new').count(), 1);
  assert.equal(await mine.locator('textarea').count(), 0, 'the author cannot change it');
  await ana.goto(`${APP}/vaje`);
  assert.equal(await ana.locator('.hd-badge').count(), 0);
  // another student does not see it, the teacher sees the new state but cannot change it
  const bor2 = pages.get('Bor Novak');
  await bor2.goto(`${APP}/prijave`);
  assert.doesNotMatch(await bor2.locator('main').innerText(), /manjka pravilni odgovor/);
  assert.match(await bor2.locator('main').innerText(), /Dodali bomo primer\./);
  // opened again
  await admin.goto(`${APP}/admin/prijave?stanje=resene`);
  await admin.locator(`#r${first}`).locator('button:text-is("Ponovno odpri")').click();
  await admin.locator('.notice:has-text("spet odprta")').waitFor();
  assert.deepEqual((await sql('SELECT status, resolved_at FROM reports WHERE id=$1', [first]))[0], { status: 'open', resolved_at: null });
});

test('deleting a user removes their reports; the counters follow', async () => {
  const cene = await userId('cene.zupan@sola.test');
  assert.equal(Number((await sql('SELECT count(*) AS n FROM reports WHERE user_id=$1', [cene]))[0].n), 1);
  await sql('DELETE FROM users WHERE id=$1', [cene]);
  assert.equal(Number((await sql('SELECT count(*) AS n FROM reports WHERE user_id=$1', [cene]))[0].n), 0);
  const admin = pages.get('Sara Skrbnik');
  await admin.goto(`${APP}/admin/prijave?stanje=vse`);
  assert.doesNotMatch(await admin.locator('main').innerText(), /Simulacija v 2\.1/);
  assert.deepEqual(errors, []);
});
