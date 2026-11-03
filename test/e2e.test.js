// End-to-end tests: real server, real PostgreSQL, real browser, stand-in Microsoft login.
// Needs TEST_DATABASE_URL pointing to an empty test database.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { chromium } from 'playwright';
import { startMockOidc, TENANT } from './mock-oidc.js';

pg.types.setTypeParser(1700, Number);
const DB = process.env.TEST_DATABASE_URL;
if (!DB) { console.error('Set TEST_DATABASE_URL'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'content/catalog.json'), 'utf8'));
const APP = 'http://localhost:3101';
const OIDC_PORT = 9401;
let server, mock, browser, db;
const pageErrors = [];

const sql = async (text, params) => (await db.query(text, params)).rows;
async function login(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  return loginIn(ctx, name);
}
async function loginIn(ctx, name) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${page.url()}: ${e.message}`));
  await page.goto(APP);
  await page.click('text=Prijava s šolskim računom');
  await page.click(`a:text-is("${name}")`);
  await page.waitForURL(`${APP}/**`);
  return page;
}
const synced = (page) => page.waitForFunction(() => document.querySelector('.lvs-status')?.textContent === 'Shranjeno', null, { timeout: 8000 });
const openTasks = async (page, id) => {
  await page.goto(`${APP}/vaje/${id}`);
  await page.evaluate(() => { document.querySelectorAll('#nav .chap').forEach((c) => { if (/Naloge/.test(c.textContent)) c.click(); }); });
};

before(async () => {
  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  mock = startMockOidc({ port: OIDC_PORT, clientId: 'c1', clientSecret: 's1' });
  server = spawn('node', ['src/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, PORT: '3101', DATABASE_URL: DB, PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c1', OIDC_CLIENT_SECRET: 's1', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true', ADMIN_EMAILS: 'Admin@sola.test', SESSION_SECRET: 'x'.repeat(40) },
  });
  await new Promise((ok, no) => {
    server.stdout.on('data', (d) => { if (String(d).includes('posluša')) ok(); });
    server.on('exit', (c) => no(new Error(`server exited ${c}`)));
  });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.removeAllListeners('exit');
  server?.kill();
  mock?.server.close();
  await db?.end();
});

let classId;
test('a new user waits and cannot open exercises', async () => {
  const p = await login('Ana Kovač');
  assert.match(await p.textContent('h1'), /Čakaš, da te učitelj doda/);
  assert.match(await p.textContent('.gate-fig'), /Šolski račun = 1[\s\S]*Razred = 0[\s\S]*Vaje = 0/);
  await p.goto(`${APP}/vaje/1.1`);
  assert.equal(new URL(p.url()).pathname, '/');
  const r = await p.request.post(`${APP}/api/progress/1.1`, { data: { state: {}, attempt: 1 } });
  assert.equal(r.status(), 401);
  assert.equal((await p.goto(`${APP}/ucitelj`)).status(), 403);
  assert.equal((await p.goto(`${APP}/admin`)).status(), 403);
  await p.context().close();
});
test('an account from another tenant is refused', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.click('text=Prijava s šolskim računom');
  await page.click('a:text-is("Zunanji Gost")');
  await page.waitForSelector('h1');
  assert.match(await page.textContent('h1'), /Prijava ni mogoča/);
  assert.equal((await sql(`SELECT count(*)::int n FROM users WHERE username LIKE 'gost%'`))[0].n, 0);
  await ctx.close();
});
test('admin comes from configuration, regardless of letter case, and chooses teachers', async () => {
  const t = await login('Tomaž Učitelj');
  assert.match(await t.textContent('h1'), /Čakaš/);
  const a = await login('Sara Skrbnik');
  assert.equal(new URL(a.url()).pathname, '/ucitelj');
  await a.goto(`${APP}/admin`);
  const row = a.locator('tr', { hasText: 'ucitelj@sola.test' });
  await row.locator('button:text("Določi za učitelja")').click();
  await a.waitForURL(`${APP}/admin`);
  await t.reload();
  assert.equal(new URL(t.url()).pathname, '/ucitelj');
  assert.equal((await t.goto(`${APP}/admin`)).status(), 403);
  const log = await sql(`SELECT action FROM audit_log`);
  assert.ok(log.some((l) => l.action === 'Določil učitelja'));
  await a.context().close();
  await t.context().close();
});
test('a teacher creates a class and adds waiting students', async () => {
  for (const n of ['Bor Novak', 'Cene Zupan']) await (await login(n)).context().close();
  const t = await login('Tomaž Učitelj');
  await t.fill('#novi', 'E4A <b>test</b>');
  await t.click('text=Ustvari razred');
  await t.waitForURL(/razredi\/\d+/);
  classId = Number(t.url().match(/razredi\/(\d+)/)[1]);
  assert.match(await t.textContent('h1'), /E4A <b>test<\/b>/); // shown as text, not HTML
  for (const n of ['Ana Kovač', 'Bor Novak']) await t.locator('#cakajo label', { hasText: n }).locator('input').check();
  await t.click('text=Dodaj izbrane');
  await t.waitForLoadState();
  assert.equal(await t.locator('.matrix tbody tr').count(), 2);
  assert.equal(await t.locator('#cakajo li').count(), 1);
  await t.context().close();
});
test('all 9 exercises: tracked score matches the page, survives reload and another computer', async () => {
  assert.equal(catalog.exercises.length, 9);
  const s = await login('Ana Kovač');
  const res = [];
  for (const ex of catalog.exercises) {
    await openTasks(s, ex.id);
    assert.match(await s.textContent('header small, .ttl small'), /LAV-ELS/);
    assert.equal(await s.locator('.task').count(), ex.tasks.length);
    // task 1: hint then answer; task 2: solution; task 3: answer
    const page = await s.evaluate(() => {
      const t = document.querySelectorAll('.task');
      t[0].querySelector('[data-act=hint]').click();
      const r0 = t[0].querySelector('input[type=radio]');
      if (r0) { r0.checked = true; t[0].querySelector('[data-act=check]').click(); }
      t[1].querySelector('[data-act=sol]').click();
      const r2 = t[2].querySelector('input[type=radio]');
      if (r2) { r2.checked = true; t[2].querySelector('[data-act=check]').click(); }
      return { sc: document.getElementById('sc').textContent };
    });
    await synced(s);
    const row = (await sql(`SELECT * FROM progress WHERE exercise_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [ex.id]))[0];
    assert.equal(String(row.score).replace('.', ','), page.sc, `${ex.id} score`);
    assert.ok(row.done_count >= 1, `${ex.id} done`);
    assert.ok(row.solution_count === 1, `${ex.id} solution`);
    assert.ok(row.hint_count >= 1, `${ex.id} hints`);
    await s.reload();
    assert.equal(await s.textContent('#sc'), page.sc, `${ex.id} reload`);
    res.push([ex.id, page.sc]);
  }
  // Same student, new computer: progress follows
  const other = await login('Ana Kovač');
  for (const [id, sc] of res) {
    await other.goto(`${APP}/vaje/${id}`);
    assert.equal(await other.textContent('#sc'), sc, `${id} on another computer`);
  }
  await other.context().close();
  const ev = await sql(`SELECT kind, count(*)::int n FROM task_events GROUP BY 1`);
  assert.ok(ev.find((e) => e.kind === 'solution').n === 9);
  await s.context().close();
});
test('shared computer: the next student sees nothing from the previous one', async () => {
  const ctx = await browser.newContext();
  const a = await loginIn(ctx, 'Ana Kovač');
  await a.goto(`${APP}/vaje/3.2`);
  const before_ = await a.textContent('#pc');
  assert.doesNotMatch(before_, /^0\//);
  await a.click('text=Odjava');
  await a.waitForURL(`${APP}/`);
  const left = await a.evaluate(() => Object.keys(localStorage).filter((k) => /^(scnm_lavele_\d|lavels_)/.test(k)));
  assert.deepEqual(left, []);
  await a.click('text=Prijava s šolskim računom');
  await a.click('a:text-is("Bor Novak")');
  await a.waitForURL(`${APP}/**`);
  await a.goto(`${APP}/vaje/3.2`);
  assert.match(await a.textContent('#pc'), /^0\//);
  await ctx.close();
});
test('reset: the student can restart, the teacher sees it with the earlier score', async () => {
  const s = await login('Ana Kovač');
  await openTasks(s, '1.1');
  const scoreBefore = (await sql(`SELECT score, done_count, attempt FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0];
  await s.click('#resetBtn');
  await s.click('#resetYes');
  await synced(s);
  assert.equal(await s.textContent('#sc'), '0');
  const row = (await sql(`SELECT * FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0];
  assert.equal(row.score, 0);
  assert.equal(row.attempt, scoreBefore.attempt + 1);
  const r = (await sql(`SELECT * FROM resets`))[0];
  assert.equal(r.score, scoreBefore.score);
  assert.equal(r.reason, 'student');
  await s.reload();
  assert.equal(await s.textContent('#sc'), '0');
  // new answers after the reset still save
  await s.evaluate(() => { document.querySelectorAll('.task')[1].querySelector('[data-act=sol]').click(); });
  await synced(s);
  assert.equal((await sql(`SELECT done_count FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0].done_count, 1);
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  assert.equal(await t.locator('.matrix tbody tr', { hasText: 'Ana' }).locator('.rs').count(), 1);
  await t.locator('.matrix a', { hasText: 'Ana Kovač' }).click();
  await t.waitForURL(/dijaki/);
  await t.locator('details.exd', { hasText: 'Logični nivoji' }).locator('summary').click();
  assert.match(await t.locator('details.exd', { hasText: 'Logični nivoji' }).textContent(), /ponastavil dijak, prejšnji rezultat/);
  await s.context().close();
  await t.context().close();
});
test('reset works and is logged in all 9 exercises', async () => {
  const s = await login('Ana Kovač');
  for (const ex of catalog.exercises) {
    await openTasks(s, ex.id);
    await s.evaluate(() => {
      const open = [...document.querySelectorAll('.task')].find((t) => !t.querySelector('[data-act=check]').disabled);
      open.querySelector('[data-act=sol]').click();
    });
    await synced(s);
    const before_ = (await sql(`SELECT attempt, done_count FROM progress WHERE exercise_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [ex.id]))[0];
    assert.ok(before_.done_count >= 1, ex.id);
    await s.click('#resetBtn');
    assert.match(await s.textContent('.confirm'), /Učitelj bo videl ponastavitev/, ex.id);
    await s.click('#resetYes');
    await synced(s);
    const row = (await sql(`SELECT attempt, done_count FROM progress WHERE exercise_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [ex.id]))[0];
    assert.deepEqual(row, { attempt: before_.attempt + 1, done_count: 0 }, ex.id);
    await s.reload();
    assert.match(await s.textContent('#pc'), /^0\//, ex.id);
  }
  const logged = await sql(`SELECT DISTINCT exercise_id FROM resets WHERE user_id=(SELECT id FROM users WHERE oid='u-ana')`);
  assert.equal(logged.length, 9);
  await s.context().close();
});
test('the tracker counts active time only, on the page being viewed', async () => {
  const ctx = await browser.newContext();
  const s = await loginIn(ctx, 'Ana Kovač');
  const secs = async (page) => (await sql(`SELECT coalesce(sum(seconds),0)::int n FROM page_time WHERE exercise_id='3.1' AND page_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [page]))[0].n;
  await s.clock.install();
  await s.goto(`${APP}/vaje/3.1`);
  const first = await s.evaluate(() => document.querySelector('.page.on').id);
  // active for a while, then no input at all for a long time: only the first minute may count
  await s.mouse.move(50, 50);
  await s.clock.runFor(200000);
  await s.waitForTimeout(300);
  const counted = await secs(first);
  assert.ok(counted >= 45 && counted <= 66, `idle not counted: ${counted}`);
  // a hidden tab does not count even with input
  await s.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
  await s.mouse.move(60, 60);
  await s.clock.runFor(30000);
  await s.waitForTimeout(300);
  assert.ok((await secs(first)) <= counted + 6, 'hidden tab not counted');
  // time goes to the page in view
  await s.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
  await s.evaluate(() => { [...document.querySelectorAll('#nav .chap')].find((c) => /Simulacija/.test(c.textContent)).click(); });
  const sim = await s.evaluate(() => document.querySelector('.page.on').id);
  await s.mouse.move(70, 70);
  await s.clock.runFor(20000);
  await s.waitForTimeout(300);
  assert.notEqual(sim, first);
  assert.ok((await secs(sim)) >= 10, 'simulation page time');
  await ctx.close();
});
test('another tab cannot bring back answers after a reset', async () => {
  const ctx = await browser.newContext();
  const a = await loginIn(ctx, 'Bor Novak');
  await openTasks(a, '2.2');
  await a.evaluate(() => { document.querySelectorAll('.task')[0].querySelector('[data-act=sol]').click(); });
  await synced(a);
  const b = await ctx.newPage();
  await b.goto(`${APP}/vaje/2.2`);
  await b.evaluate(() => { [...document.querySelectorAll('#nav .chap')].find((c) => /Naloge/.test(c.textContent)).click(); });
  await b.click('#resetBtn');
  await b.click('#resetYes');
  await synced(b);
  await a.evaluate(() => { document.querySelectorAll('.task')[1].querySelector('[data-act=sol]').click(); });
  await a.waitForSelector('.lvs-warn');
  assert.equal((await sql(`SELECT done_count FROM progress WHERE exercise_id='2.2' AND user_id=(SELECT id FROM users WHERE oid='u-bor')`))[0].done_count, 0);
  await ctx.close();
});
test('the server keeps locked tasks and the points rules against tampering', async () => {
  const s = await login('Bor Novak');
  await s.goto(`${APP}/vaje/1.2`);
  const boot = await s.evaluate(() => ({ csrf: window.__LAVELS.csrf, attempt: window.__LAVELS.attempt }));
  const send = (state, extra = {}) => s.request.post(`${APP}/api/progress/1.2`, { data: { csrf: boot.csrf, attempt: boot.attempt, state, ...extra } });
  const max0 = catalog.exercises.find((e) => e.id === '1.2').tasks[0].max;
  // inflated points are capped, an unknown task is dropped
  let r = await send({ t: { 0: { d: true, p: 999, h: false }, 9999: { d: true, p: 50 } } });
  assert.equal((await r.json()).score, max0);
  // a locked task cannot be changed or "unlocked"
  r = await send({ t: { 0: { d: false, p: 0 } } });
  assert.equal((await r.json()).done, 1);
  // used hint stays used and halves the points
  await send({ t: { 1: { h: true } } });
  const max1 = catalog.exercises.find((e) => e.id === '1.2').tasks[1].max;
  r = await send({ t: { 1: { d: true, p: max1, h: false } } });
  assert.equal((await r.json()).score, max0 + max1 / 2);
  // no CSRF token, wrong attempt
  assert.equal((await s.request.post(`${APP}/api/progress/1.2`, { data: { attempt: boot.attempt, state: {} } })).status(), 403);
  assert.equal((await send({ t: {} }, { attempt: 99 })).status(), 409);
  // student input cannot break out of the page
  await send({ note: '</script><script>window.__x=1</script>', t: {} });
  await s.goto(`${APP}/vaje/1.2`);
  assert.equal(await s.evaluate(() => window.__x), undefined);
  await s.context().close();
});
test('time counts only while active on a visible page, per chapter', async () => {
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje/3.3`);
  await s.evaluate(() => { [...document.querySelectorAll('#nav .chap')].find((c) => /Simulacija/.test(c.textContent)).click(); });
  const r = await s.evaluate(async () => {
    const page = document.querySelector('.page.on').id;
    const post = (seconds, p) => fetch('/api/time/3.3', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csrf: window.__LAVELS.csrf, page: p, seconds }) }).then((x) => x.status);
    return { page, a: await post(30, page), big: await post(100000, page), bad: await post(5, 'ni-strani') };
  });
  assert.equal(r.a, 200); assert.equal(r.bad, 400);
  const row = (await sql(`SELECT * FROM page_time WHERE exercise_id='3.3' AND page_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [r.page]))[0];
  assert.equal(row.chapter, 'Simulacija');
  assert.ok(row.seconds >= 90 && row.seconds < 100, `clamped ${row.seconds}`);
  // the real tracker records a page visit when an exercise opens
  const seen = await sql(`SELECT count(*)::int n FROM page_time WHERE exercise_id='3.3'`);
  assert.ok(seen[0].n >= 1);
  await s.context().close();
});
test('teachers only see their own classes; CSV export is safe', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/admin`);
  await a.locator('tr', { hasText: 'cene.zupan@sola.test' }).locator('button:text("Določi za učitelja")').click();
  await a.waitForURL(`${APP}/admin`);
  const other = await login('Cene Zupan');
  assert.equal((await other.goto(`${APP}/ucitelj/razredi/${classId}`)).status(), 404);
  assert.equal((await other.goto(`${APP}/ucitelj/razredi/${classId}/izvoz.csv`)).status(), 404);
  await other.context().close();
  await db.query(`UPDATE users SET name='=HYPERLINK("x")' WHERE oid='u-bor'`);
  const t = await login('Tomaž Učitelj');
  const csv = await (await t.request.get(`${APP}/ucitelj/razredi/${classId}/izvoz.csv`)).text();
  assert.ok(csv.startsWith('﻿Dijak;Račun;1.1 točke (od 48)'));
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /Ana Kovač;ana\.kovac@sola\.test/);
  await db.query(`UPDATE users SET name='Bor Novak' WHERE oid='u-bor'`);
  await t.goto(`${APP}/ucitelj/razredi/${classId}/vaje/1.1`);
  assert.equal(await t.locator('tbody .strip').count(), 2);
  await t.context().close();
  await a.context().close();
});
test('removing a student returns them to waiting and keeps progress', async () => {
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  await t.locator('.matrix a', { hasText: 'Bor Novak' }).click();
  await t.waitForURL(/dijaki/);
  await t.click('summary:text("Odstrani iz razreda")');
  await t.click('text=Da, odstrani');
  await t.waitForURL(/razredi\/\d+$/);
  const s = await login('Bor Novak');
  assert.match(await s.textContent('h1'), /Čakaš/);
  assert.ok((await sql(`SELECT count(*)::int n FROM progress WHERE user_id=(SELECT id FROM users WHERE oid='u-bor')`))[0].n > 0);
  await s.context().close();
  await t.context().close();
});
test('admin hides and reorders exercises and deletes a user with all data', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/admin/vaje`);
  const row = a.locator('tr', { hasText: 'Kodiranje in pariteta' });
  await row.locator('input[name=visible]').uncheck();
  await row.locator('input[name=est_minutes]').fill('45');
  await row.locator('button:text("Shrani")').click();
  await a.waitForLoadState();
  await a.locator('tr', { hasText: 'Binarni seštevalniki' }).locator('button:text("Dol")').click();
  await a.waitForLoadState();
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  const titles = await s.locator('.rail h3').allTextContents();
  assert.ok(!titles.some((x) => x.includes('Kodiranje')));
  assert.ok(titles.findIndex((x) => x.includes('Kodirnik')) < titles.findIndex((x) => x.includes('Binarni')));
  assert.equal((await s.goto(`${APP}/vaje/2.2`)).status(), 404);
  await s.context().close();
  await a.goto(`${APP}/admin`);
  const u = a.locator('tr', { hasText: 'bor.novak@sola.test' });
  await u.locator('summary:text("Izbriši")').click();
  await u.locator('button:text("Da, izbriši")').click();
  await a.waitForURL(/admin/);
  assert.equal((await sql(`SELECT count(*)::int n FROM users WHERE oid='u-bor'`))[0].n, 0);
  assert.equal((await sql(`SELECT count(*)::int n FROM task_events e LEFT JOIN users u ON u.id=e.user_id WHERE u.id IS NULL`))[0].n, 0);
  await a.goto(`${APP}/admin/dnevnik`);
  assert.match(await a.textContent('table'), /Izbrisal uporabnika/);
  await a.context().close();
});
test('nothing is loaded from other sites, and there were no page errors', async () => {
  const s = await login('Ana Kovač');
  const outside = [];
  s.on('request', (r) => { if (!r.url().startsWith(APP) && !r.url().startsWith('data:')) outside.push(r.url()); });
  await s.goto(`${APP}/vaje/1.3`);
  await s.goto(`${APP}/vaje`);
  await s.waitForTimeout(300);
  assert.deepEqual(outside, []);
  const w = await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(w);
  await s.context().close();
  assert.deepEqual(pageErrors, []);
});
