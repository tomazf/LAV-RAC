// End-to-end tests: real server, real PostgreSQL, real browser, stand-in Microsoft login.
// Needs TEST_DATABASE_URL pointing to an empty test database.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { chromium } from 'playwright';
import { startMockOidc, TENANT } from './mock-oidc.js';

pg.types.setTypeParser(1700, Number);
const DB = process.env.TEST_DATABASE_URL;
if (!DB) { console.error('Set TEST_DATABASE_URL'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const FIXTURES = 'test/fixtures/content';
const catalog = JSON.parse(readFileSync(path.join(root, FIXTURES, 'catalog.json'), 'utf8'));
const portal = JSON.parse(readFileSync(path.join(root, 'content/portal.json'), 'utf8'));
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
  await page.click('a.btn:text-is("Prijava")');
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
    env: { ...process.env, CONTENT_DIR: FIXTURES, PORT: '3101', DATABASE_URL: DB, PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c1', OIDC_CLIENT_SECRET: 's1', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true', ADMIN_EMAILS: 'Admin@sola.test', SESSION_SECRET: 'x'.repeat(40) },
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
  await page.click('a.btn:text-is("Prijava")');
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
async function adminMakesClass(a, name) {
  await a.goto(`${APP}/admin/razredi`);
  await a.fill('#novi', name);
  await a.click('text=Ustvari razred');
  await a.waitForLoadState();
  return Number((await sql('SELECT id FROM classes WHERE name=$1', [name]))[0].id);
}
async function openAll(t, id) {
  for (const ex of catalog.exercises) {
    await t.goto(`${APP}/ucitelj/razredi/${id}/vaje`);
    await t.locator(`tr[id="vaja-${ex.id}"] input[name=visible]`).check();
    await t.waitForURL(new RegExp(`#vaja-${ex.id.replace('.', '\\.')}$`));
  }
}
test('admin creates classes; a teacher joins, chooses exercises and adds students', async () => {
  for (const n of ['Bor Novak', 'Cene Zupan']) await (await login(n)).context().close();
  const a = await login('Sara Skrbnik');
  classId = await adminMakesClass(a, 'E4A <b>test</b>');
  const t = await login('Tomaž Učitelj');
  // only the admin creates classes
  assert.equal((await t.goto(`${APP}/admin/razredi`)).status(), 403);
  await t.goto(`${APP}/ucitelj`);
  assert.equal(await t.locator('#novi').count(), 0);
  assert.equal((await t.goto(`${APP}/ucitelj/razredi/${classId}`)).status(), 404); // not joined yet
  await t.goto(`${APP}/ucitelj`);
  assert.match(await t.textContent('body'), /Dijaki brez razreda \(3\)/);
  await t.locator('tr', { hasText: 'E4A' }).locator('button:text("Pridruži se")').click();
  await t.waitForURL(/razredi\/\d+/);
  assert.match(await t.textContent('h1'), /E4A <b>test<\/b>/); // shown as text, not HTML
  assert.match(await t.textContent('.notice-warn'), /še ne vidijo nobene vaje/);
  for (const n of ['Ana Kovač', 'Bor Novak']) await t.locator('#cakajo label', { hasText: n }).locator('input').check();
  await t.click('text=Dodaj izbrane');
  await t.waitForLoadState();
  assert.equal(await t.locator('.matrix tbody tr').count(), 2);
  assert.equal(await t.locator('#cakajo li').count(), 1);
  // a new class shows students nothing
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  assert.match(await s.textContent('main'), /Učitelj še ni odprl nobene vaje/);
  assert.equal(await s.locator('.rail').count(), 0);
  assert.equal((await s.goto(`${APP}/vaje/1.1`)).status(), 404);
  await openAll(t, classId);
  await s.goto(`${APP}/vaje`);
  assert.equal(await s.locator('.rail li').count(), 9);
  await s.context().close();
  await t.context().close();
  await a.context().close();
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
  await a.click('a.btn:text-is("Prijava")');
  await a.click('a:text-is("Bor Novak")');
  await a.waitForURL(`${APP}/**`);
  await a.goto(`${APP}/vaje/3.2`);
  assert.match(await a.textContent('#pc'), /^0\//);
  await ctx.close();
});
test('reset: the student can restart; the earlier score counts until a new answer, the teacher sees it once', async () => {
  const s = await login('Ana Kovač');
  await openTasks(s, '1.1');
  const scoreBefore = (await sql(`SELECT score, done_count, attempt FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0];
  await s.click('#resetBtn');
  await Promise.all([s.waitForEvent('load'), s.click('#resetYes')]);
  assert.equal(await s.textContent('#sc'), '0');
  // the page loads again for the new numbers, and the student stays on the tasks
  assert.ok(await s.locator('.task').first().isVisible());
  const row = (await sql(`SELECT * FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0];
  assert.equal(row.score, 0);
  assert.equal(row.attempt, scoreBefore.attempt + 1);
  const r = (await sql(`SELECT * FROM resets`))[0];
  assert.equal(r.score, scoreBefore.score);
  assert.equal(r.reason, 'student');
  await s.reload();
  assert.equal(await s.textContent('#sc'), '0');
  // until the student answers again, the earlier score counts, for the student and for the teacher
  await s.goto(`${APP}/vaje`);
  const meta = await s.locator('li.node', { hasText: 'Logični nivoji' }).locator('.ex-meta').textContent();
  assert.match(meta, new RegExp(`^${String(Math.round(Number(scoreBefore.score) * 10) / 10).replace('.', ',')} od .*, ${scoreBefore.done_count} od .*točke pred ponastavitvijo`));
  const t0 = await login('Tomaž Učitelj');
  await t0.goto(`${APP}/ucitelj/razredi/${classId}/dijaki/${(await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id}`);
  assert.match(await t0.locator('details.exd', { hasText: 'Logični nivoji' }).textContent(), /Pred zadnjo ponastavitvijo .*Te točke štejejo/);
  await t0.context().close();
  // new answers after the reset still save, and from then on the new attempt counts
  await openTasks(s, '1.1');
  await s.evaluate(() => { document.querySelectorAll('.task')[1].querySelector('[data-act=sol]').click(); });
  await synced(s);
  assert.equal((await sql(`SELECT done_count FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0].done_count, 1);
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  assert.equal(await t.locator('.matrix .rs').count(), 0); // how often is not shown
  await t.locator('.matrix a', { hasText: 'Ana Kovač' }).click();
  await t.waitForURL(/dijaki/);
  await t.locator('details.exd', { hasText: 'Logični nivoji' }).locator('summary').first().click();
  assert.match(await t.locator('details.exd', { hasText: 'Logični nivoji' }).textContent(), /Pred zadnjo ponastavitvijo .*Dijak rešuje znova/);
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
    const resetDone = s.waitForResponse((r) => r.url().includes('/api/progress/') && r.request().postDataJSON().reset === true);
    await s.click('#resetYes');
    await resetDone;
    await s.waitForLoadState();
    await s.waitForTimeout(300); // exercises with varied numbers load again
    await s.waitForLoadState();
    assert.ok(await s.locator('.task').first().isVisible(), `${ex.id ?? id} stays on the tasks after a reset`);
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
  const resetDone = b.waitForResponse((r) => r.url().includes('/api/progress/') && r.request().postDataJSON().reset === true);
  await b.click('#resetYes');
  await resetDone;
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
  assert.equal((await other.goto(`${APP}/ucitelj/razredi/${classId}/vaje`)).status(), 404);
  assert.equal((await other.request.post(`${APP}/ucitelj/razredi/${classId}/rezultati/1.1/ponastavi`, { form: {} })).status(), 404);
  await other.context().close();
  await db.query(`UPDATE users SET name='=HYPERLINK("x")' WHERE oid='u-bor'`);
  const t = await login('Tomaž Učitelj');
  const csv = await (await t.request.get(`${APP}/ucitelj/razredi/${classId}/izvoz.csv`)).text();
  assert.ok(csv.startsWith('﻿Dijak;Račun;1.1 točke (od 48)'));
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /Ana Kovač;ana\.kovac@sola\.test/);
  await db.query(`UPDATE users SET name='Bor Novak' WHERE oid='u-bor'`);
  await t.goto(`${APP}/ucitelj/razredi/${classId}/rezultati/1.1`);
  assert.equal(await t.locator('tbody .strip').count(), 2);
  await t.context().close();
  await a.context().close();
});
test('removing a student returns them to waiting; progress comes back when they return', async () => {
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
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  await t.locator('#cakajo label', { hasText: 'Bor Novak' }).locator('input').check();
  await t.click('text=Dodaj izbrane');
  await t.waitForLoadState();
  await s.goto(`${APP}/vaje`);
  assert.equal(await s.locator('.rail li').count(), 9);
  await s.context().close();
  await t.context().close();
});
test('a teacher resets an exercise for one student or the whole class; the score before it and notes stay', async () => {
  const ana = (await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id;
  const bor = (await sql(`SELECT id FROM users WHERE oid='u-bor'`))[0].id;
  const row = async (uid, ex) => (await sql('SELECT attempt, score, done_count, state FROM progress WHERE user_id=$1 AND exercise_id=$2', [uid, ex]))[0];
  const a = await login('Ana Kovač');
  const b = await login('Bor Novak');
  const answer = async (p, ex, n) => {
    await openTasks(p, ex);
    await p.evaluate((n) => {
      const open = [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('[data-act=check]').disabled);
      open.slice(0, n).forEach((t) => {
        const r = t.querySelector('input[type=radio]');
        if (r) { r.checked = true; t.querySelector('[data-act=check]').click(); } else t.querySelector('[data-act=sol]').click();
      });
    }, n);
    await synced(p);
  };
  await answer(a, '3.2', 2);
  await answer(a, '3.3', 2);
  await answer(b, '3.2', 1);
  const before3 = await row(ana, '3.3');
  assert.ok(before3.done_count >= 2);
  // one student, one exercise
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}/dijaki/${ana}`);
  const box = t.locator('details.exd', { hasText: 'MUX, DEMUX' });
  await box.locator('summary').first().click();
  await box.locator('summary:text("Ponastavi to vajo dijaku")').click();
  await box.locator('button:text("Da, ponastavi vajo")').click();
  await t.waitForLoadState();
  const after3 = await row(ana, '3.3');
  assert.deepEqual([after3.attempt, Number(after3.score), after3.done_count, after3.state], [before3.attempt + 1, 0, 0, {}]);
  assert.ok((await row(ana, '3.2')).done_count >= 2, 'other exercises stay');
  const r = (await sql(`SELECT * FROM resets WHERE user_id=$1 AND exercise_id='3.3' ORDER BY id DESC LIMIT 1`, [ana]))[0];
  assert.deepEqual([r.reason, r.done_count], ['teacher', before3.done_count]);
  await t.locator('details.exd', { hasText: 'MUX, DEMUX' }).locator('summary').first().click();
  assert.match(await t.locator('details.exd', { hasText: 'MUX, DEMUX' }).textContent(), /Pred zadnjo ponastavitvijo .*Te točke štejejo/);
  // a tab the student left open cannot bring answers back
  await a.evaluate(() => { [...document.querySelectorAll('.task')].find((t) => !t.querySelector('[data-act=check]').disabled).querySelector('[data-act=sol]').click(); });
  await a.waitForSelector('.lvs-warn');
  assert.equal((await row(ana, '3.3')).done_count, 0);
  // the student starts fresh on reload
  await a.goto(`${APP}/vaje/3.3`);
  assert.match(await a.textContent('#pc'), /^0\//);
  // the whole class, one exercise; a student with nothing to reset is not logged
  await t.goto(`${APP}/ucitelj/razredi/${classId}/rezultati/3.2`);
  await t.click('summary:text("Ponastavi vajo 3.2 celemu razredu")');
  await t.click('button:text("Da, ponastavi vajo 3.2")');
  await t.waitForLoadState();
  assert.match(await t.textContent('.notice'), /Dijakov: 2/);
  assert.equal((await row(ana, '3.2')).done_count, 0);
  assert.equal((await row(bor, '3.2')).done_count, 0);
  await t.reload();
  await t.goto(`${APP}/ucitelj/razredi/${classId}/rezultati/3.2`);
  await t.click('summary:text("Ponastavi vajo 3.2 celemu razredu")');
  await t.click('button:text("Da, ponastavi vajo 3.2")');
  await t.waitForLoadState();
  assert.match(await t.textContent('.notice'), /Dijakov: 0/);
  // only the last reset is kept per student and exercise; the log says who did it; notes stay
  assert.deepEqual(await sql(`SELECT user_id, exercise_id FROM resets GROUP BY 1,2 HAVING count(*) > 1`), []);
  const log = await sql(`SELECT action, actor_name, detail FROM audit_log WHERE action LIKE 'Ponastavil vajo%' ORDER BY id`);
  assert.deepEqual(log.map((l) => [l.action, l.actor_name]), [['Ponastavil vajo dijaku', 'Tomaž Učitelj'], ['Ponastavil vajo razredu', 'Tomaž Učitelj']]);
  assert.match(log[0].detail, /Ana Kovač: 3\.3/);
  await a.context().close();
  await b.context().close();
  await t.context().close();
});
test('varied numbers: own numbers per student, stable until reset, all answers correct', async () => {
  const uid = async (oid) => (await sql('SELECT id FROM users WHERE oid=$1', [oid]))[0].id;
  const variants = JSON.parse(readFileSync(path.join(root, FIXTURES, 'variants.json'), 'utf8'));
  const bor = await uid('u-bor');
  const b = await login('Bor Novak');
  const a = await login('Ana Kovač');
  const questions = (p, list) => p.evaluate((list) => list.map((i) => TASKS[i].q), list);
  await openTasks(b, '2.1');
  await openTasks(a, '2.1');
  const qb = await questions(b, variants['2.1']);
  assert.notDeepEqual(qb, await questions(a, variants['2.1']), 'students have different numbers');
  // fixed tasks stay the same for everyone
  assert.deepEqual(await questions(b, [0, 3, 11]), await questions(a, [0, 3, 11]));
  // correct answers from the student's own numbers earn full points, and the shown question matches
  const pts = await b.evaluate((list) => {
    const out = [];
    for (const i of list) {
      const card = document.getElementById('t' + i);
      TASKS[i].fields.forEach((f, j) => { card.querySelector('#t' + i + 'f' + j).value = f.a.replace('.', ','); });
      card.querySelector('[data-act=check]').click();
      out.push([i, card.querySelector('.fb').textContent, card.querySelector('.qt').innerHTML === TASKS[i].q]);
    }
    return out;
  }, variants['2.1']);
  for (const [i, fb, same] of pts) { assert.match(fb, /^Pravilno/, `2.1 task ${i}: ${fb}`); assert.ok(same); }
  await synced(b);
  // the same numbers after a reload and on another computer
  await b.reload();
  assert.deepEqual(await questions(b, variants['2.1']), qb);
  const other = await login('Bor Novak');
  await other.goto(`${APP}/vaje/2.1`);
  assert.deepEqual(await questions(other, variants['2.1']), qb);
  await other.context().close();
  const row = (await sql(`SELECT score, done_count FROM progress WHERE user_id=$1 AND exercise_id='2.1'`, [bor]))[0];
  assert.equal(row.done_count, variants['2.1'].length);
  // a reset gives new numbers
  await openTasks(b, '2.1');
  await b.click('#resetBtn');
  const done = b.waitForResponse((r) => r.url().includes('/api/progress/') && r.request().postDataJSON().reset === true);
  // a new attempt has new numbers, which the page only gets by loading again: wait for that load, not for the answer to the save
  const reloaded = b.waitForEvent('load');
  await b.click('#resetYes');
  await done;
  await reloaded;
  await b.waitForFunction(() => document.getElementById('sc')?.textContent === '0');
  assert.notDeepEqual(await questions(b, variants['2.1']), qb, 'new numbers after a reset');
  // a teacher's reset also gives new numbers on the next opening
  const qb2 = await questions(b, variants['2.1']);
  const t = await login('Tomaž Učitelj');
  await b.evaluate(() => { document.querySelectorAll('.task')[1].querySelector('[data-act=sol]').click(); });
  await synced(b);
  await t.goto(`${APP}/ucitelj/razredi/${classId}/rezultati/2.1`);
  assert.ok((await t.locator('.tag', { hasText: 'svoja števila' }).count()) === variants['2.1'].length);
  await t.click('summary:text("Ponastavi vajo 2.1 celemu razredu")');
  await t.click('button:text("Da, ponastavi vajo 2.1")');
  await t.waitForLoadState();
  await b.goto(`${APP}/vaje/2.1`);
  assert.notDeepEqual(await questions(b, variants['2.1']), qb2);
  await t.context().close();
  // an attempt started before this feature keeps numbers on tasks already started; the others change
  await db.query(`UPDATE progress SET variant_seed=NULL, variant_keep='{}', attempt=attempt+1, state='{"t":{"4":{"d":true,"p":2,"h":false,"a":["101101"]}},"g":[]}', score=2, done_count=1 WHERE user_id=$1 AND exercise_id='2.1'`, [bor]);
  await b.goto(`${APP}/vaje/2.1`);
  assert.match((await questions(b, [4]))[0], />45</);
  assert.match(await b.textContent('#sc'), /^2$/);
  assert.equal(await b.locator('#t4 .fb').evaluate((x) => x.textContent.startsWith('Pravilno')), true);
  await a.context().close();
  await b.context().close();
});
test('varied numbers reach the exercises that keep their tasks inside one script', async () => {
  const b = await login('Bor Novak');
  const a = await login('Ana Kovač');
  const questions = (p) => p.evaluate(() => [...document.querySelectorAll('.task .qt, .task .q')].map((q) => q.textContent));
  for (const ex of ['3.1', '3.2']) {
    await openTasks(b, ex);
    await openTasks(a, ex);
    const qb = await questions(b);
    assert.ok(qb.length > 10, ex);
    assert.notDeepEqual(qb, await questions(a), `${ex}: students have different numbers`);
    await b.reload();
    assert.deepEqual(await questions(b), qb, `${ex}: same numbers after a reload`);
  }
  await a.context().close();
  await b.context().close();
});
test('several teachers per class and classes per teacher; removing the role ends it', async () => {
  const a = await login('Sara Skrbnik');
  const second = await adminMakesClass(a, 'R3B');
  await a.goto(`${APP}/admin/razredi`);
  const row = a.locator('tr', { hasText: 'E4A' });
  await row.locator('select[name=user]').selectOption({ label: 'Cene Zupan' });
  await row.locator('button:text("Dodaj")').click();
  await a.waitForLoadState();
  const c = await login('Cene Zupan');
  await c.goto(`${APP}/ucitelj/razredi/${classId}`); // assigned by the admin
  assert.match(await c.textContent('.team'), /Cene Zupan.*Tomaž Učitelj/);
  await c.goto(`${APP}/ucitelj`);
  await c.locator('tr', { hasText: 'R3B' }).locator('button:text("Pridruži se")').click();
  await c.waitForURL(/razredi\/\d+/);
  await c.goto(`${APP}/ucitelj`);
  assert.equal(await c.locator('section', { hasText: 'Moji razredi' }).locator('tbody tr').count(), 2);
  // teachers have no way to leave a class themselves; the admin removes them
  await c.goto(`${APP}/ucitelj/razredi/${second}`);
  assert.equal(await c.locator('text=Zapusti razred').count(), 0);
  assert.equal((await c.request.post(`${APP}/ucitelj/razredi/${second}/zapusti`, { form: {} })).status(), 404);
  await a.goto(`${APP}/admin/razredi`);
  await a.locator('tr', { hasText: 'R3B' }).locator('.teacher-chip', { hasText: 'Cene Zupan' }).locator('button').click();
  await a.waitForLoadState();
  assert.equal((await c.goto(`${APP}/ucitelj/razredi/${second}`)).status(), 404);
  // the admin can open any class without joining
  assert.equal((await a.goto(`${APP}/ucitelj/razredi/${second}`)).status(), 200);
  // removing the teacher role removes the person from all classes and sends them back to waiting
  await a.goto(`${APP}/admin`);
  await a.locator('tr', { hasText: 'cene.zupan@sola.test' }).locator('button:text("Odvzemi vlogo učitelja")').click();
  await a.waitForLoadState();
  assert.equal((await sql(`SELECT count(*)::int n FROM class_teachers t JOIN users u ON u.id=t.user_id WHERE u.oid='u-cene'`))[0].n, 0);
  await c.goto(APP);
  assert.match(await c.textContent('h1'), /Čakaš/);
  await c.context().close();
  await a.context().close();
});
test('a student can be in one class only and cannot be taken from another', async () => {
  const a = await login('Sara Skrbnik');
  const second = (await sql(`SELECT id FROM classes WHERE name='R3B'`))[0].id;
  await a.goto(`${APP}/ucitelj/razredi/${second}`);
  const token = await a.locator('#dodaj input[name=_csrf]').inputValue();
  const ana = (await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id;
  const r = await a.request.post(`${APP}/ucitelj/razredi/${second}/dodaj`, { form: { _csrf: token, user: String(ana) } });
  assert.equal(r.status(), 200);
  const rows = await sql('SELECT class_id FROM class_members WHERE user_id=$1', [ana]);
  assert.deepEqual(rows.map((x) => Number(x.class_id)), [classId]);
  await a.context().close();
});
test('each class has its own open exercises and order; closed exercises stay in the results', async () => {
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}/vaje`);
  await t.locator('tr', { hasText: 'Kodiranje in pariteta' }).locator('input[name=visible]').uncheck();
  await t.waitForLoadState();
  await t.locator('tr', { hasText: 'Binarni seštevalniki' }).locator('button:text("Dol")').click();
  await t.waitForLoadState();
  assert.match(await t.locator('tr', { hasText: 'Kodiranje in pariteta' }).textContent(), /zaprta/);
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  const titles = await s.locator('.rail h3').allTextContents();
  assert.ok(!titles.some((x) => x.includes('Kodiranje')));
  assert.ok(titles.findIndex((x) => x.includes('Kodirnik')) < titles.findIndex((x) => x.includes('Binarni')));
  assert.equal((await s.goto(`${APP}/vaje/2.2`)).status(), 404);
  // an open tab cannot keep saving after the exercise closes
  await s.goto(`${APP}/vaje/1.2`);
  const boot = await s.evaluate(() => ({ csrf: window.__LAVELS.csrf, attempt: window.__LAVELS.attempt }));
  const closed = await s.request.post(`${APP}/api/progress/2.2`, { data: { csrf: boot.csrf, attempt: 1, state: { t: {} } } });
  assert.deepEqual([closed.status(), (await closed.json()).code], [403, 'closed']);
  // progress stays visible to the teacher
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  assert.equal(await t.locator('.matrix th.closed').count(), 1);
  // another class is not affected
  const other = (await sql(`SELECT count(*)::int n FROM class_exercises x JOIN classes c ON c.id=x.class_id WHERE c.name='R3B' AND x.visible`))[0].n;
  assert.equal(other, 0);
  await s.context().close();
  await t.context().close();
});
test('notes: general, exercise and task; private, kept after reset, shown as text', async () => {
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  await s.locator('.my-note .lvn-btn').click();
  await s.fill('.lvn-dialog textarea', 'Splošno <b>x</b>');
  await s.click('.lvn-save');
  await s.waitForSelector('#note-general:not([hidden])');
  assert.equal(await s.textContent('#note-general'), 'Splošno <b>x</b>');
  await s.reload();
  assert.equal(await s.textContent('#note-general'), 'Splošno <b>x</b>');
  await openTasks(s, '1.1');
  const card = s.locator('.task').nth(4);
  await card.locator('.lvn-btn').click();
  await s.fill('.lvn-dialog textarea', 'Pri tej nalogi pazi na predznak');
  await s.click('.lvn-save');
  await card.locator('.lvn-text:not([hidden])').waitFor();
  await s.locator('.lvs-bar .lvn-btn').click();
  await s.fill('.lvn-dialog textarea', 'Ponovi teorijo');
  await s.click('.lvn-save');
  await s.locator('.lvs-exnote:not([hidden])').waitFor();
  await s.reload();
  assert.equal(await s.locator('.task').nth(4).locator('.lvn-text').textContent(), 'Pri tej nalogi pazi na predznak');
  assert.equal(await s.textContent('.lvs-exnote'), 'Ponovi teorijo');
  // the reset rebuilds the tasks; notes stay and the icons come back
  await s.evaluate(() => { [...document.querySelectorAll('#nav .chap')].find((c) => /Naloge/.test(c.textContent)).click(); document.querySelectorAll('.task')[0].querySelector('[data-act=sol]').click(); });
  await synced(s);
  await s.click('#resetBtn');
  await Promise.all([s.waitForEvent('load'), s.click('#resetYes')]);
  await s.waitForFunction(() => document.querySelectorAll('.task .lvn-btn').length === document.querySelectorAll('.task').length);
  assert.equal(await s.locator('.task').nth(4).locator('.lvn-text').textContent(), 'Pri tej nalogi pazi na predznak');
  // deleting a note, then a dashboard exercise note
  await s.goto(`${APP}/vaje`);
  assert.match(await s.textContent('#note-1\\.1'), /Ponovi teorijo/);
  assert.match(await s.locator('.node', { hasText: '1.1' }).textContent(), /opombe pri nalogah: 1/);
  await s.locator('.node', { hasText: '1.1' }).locator('.lvn-btn').click();
  await s.click('.lvn-del');
  await s.waitForSelector('#note-1\\.1', { state: 'hidden' });
  // limits and tampering
  const csrf = await s.locator('[data-note-slot]').first().getAttribute('data-csrf');
  const send = (data) => s.request.post(`${APP}/api/notes`, { data: { csrf, ...data } });
  assert.equal((await send({ body: 'x'.repeat(5001) })).status(), 400);
  assert.equal((await send({ exercise: '1.1', task: 9999, body: 'x' })).status(), 400);
  assert.equal((await send({ exercise: '2.2', body: 'x' })).status(), 404); // closed for this class
  assert.equal((await s.request.post(`${APP}/api/notes`, { data: { body: 'x' } })).status(), 403);
  // another student sees nothing; the teacher pages do not include notes
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}`);
  await t.locator('.matrix a', { hasText: 'Ana Kovač' }).click();
  await t.waitForURL(/dijaki/);
  const html = await t.content();
  assert.ok(!html.includes('pazi na predznak') && !html.includes('Splošno'));
  const b = await login('Bor Novak');
  await b.goto(`${APP}/vaje`);
  assert.equal(await b.locator('#note-general').isHidden(), true);
  await b.goto(`${APP}/vaje/1.1`);
  assert.equal(await b.locator('.task .lvn-text:not([hidden])').count(), 0);
  await b.context().close();
  await t.context().close();
  await s.context().close();
});
test('the admin view has no notes', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje`);
  assert.equal(await a.locator('.rail li').count(), 9);
  assert.equal(await a.locator('.lvn-btn, .my-note, .lvn-text').count(), 0);
  await a.goto(`${APP}/vaje/1.1`);
  await a.waitForSelector('.lvs-bar');
  assert.equal(await a.locator('.lvn-btn, .lvn-text').count(), 0);
  const csrf = await a.evaluate(() => window.__LAVELS.csrf);
  assert.equal((await a.request.post(`${APP}/api/notes`, { data: { csrf, body: 'x' } })).status(), 403);
  await a.context().close();
});
test('browsers load new static files right after an update', async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(APP);
  const href = await p.locator('link[href*="css/app.css"]').getAttribute('href');
  assert.match(href, /\?v=[0-9a-f]{12}$/);
  assert.match((await p.request.get(APP + href)).headers()['cache-control'], /immutable/);
  assert.equal((await p.request.get(`${APP}/static/css/app.css`)).headers()['cache-control'], 'no-cache');
  await ctx.close();
});
test('exercise groups line up on the admin overview and class page; empty groups only for staff', async () => {
  const a = await login('Sara Skrbnik');
  const measure = () => a.evaluate(() => [...document.querySelectorAll('.ex-table')].map((t) => [...t.querySelectorAll('thead th')].map((c) => Math.round(c.getBoundingClientRect().left))));
  const same = (rows) => rows.every((r) => JSON.stringify(r) === JSON.stringify(rows[0]));
  await a.goto(`${APP}/admin/vaje`);
  let rows = await measure();
  assert.equal(rows.length, 3);
  assert.ok(same(rows), JSON.stringify(rows));
  assert.equal(await a.locator('input[type=checkbox], button:text("Gor")').count(), 0); // read-only
  assert.deepEqual(await a.locator('.group.planned h2').allTextContents(), portal.plannedModules.map((id) => `${id} V pripravi`));
  await a.goto(`${APP}/ucitelj/razredi/${classId}/vaje`);
  rows = await measure();
  assert.ok(same(rows), JSON.stringify(rows));
  assert.equal(await a.locator('.group.planned').count(), portal.plannedModules.length);
  assert.equal(await a.locator('button:text("Odpri vse"), button:text("Zapri vse")').count(), 0);
  assert.equal(await a.evaluate(() => getComputedStyle(document.querySelector('.group')).marginTop), '40px');
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  assert.doesNotMatch(await s.textContent('main'), /V pripravi/);
  await s.context().close();
  await a.context().close();
});
test('removing from a class keeps the user; deleting from the system erases them forever', async () => {
  const uid = async (oid) => (await sql('SELECT id FROM users WHERE oid=$1', [oid]))[0]?.id;
  const counts = async (id) => {
    const out = {};
    for (const tbl of ['progress', 'resets', 'task_events', 'page_time', 'student_notes', 'class_members', 'class_teachers']) {
      out[tbl] = (await sql(`SELECT count(*)::int n FROM ${tbl} WHERE user_id=$1`, [id]))[0].n;
    }
    return out;
  };
  const bor = await uid('u-bor');
  const s = await login('Bor Novak');
  await s.goto(`${APP}/vaje`);
  await s.locator('.my-note .lvn-btn').click();
  await s.fill('.lvn-dialog textarea', 'Borova zasebna opomba');
  await s.click('.lvn-save');
  await s.waitForSelector('#note-general:not([hidden])');
  // removed from a class: everything stays, and another class can take the student
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}/dijaki/${bor}`);
  await t.click('summary:text("Odstrani iz razreda")');
  await t.click('text=Da, odstrani');
  await t.waitForURL(/razredi\/\d+$/);
  let c = await counts(bor);
  assert.equal(c.class_members, 0);
  assert.ok(c.progress > 0 && c.task_events > 0 && c.student_notes === 1);
  const a = await login('Sara Skrbnik');
  const second = (await sql(`SELECT id FROM classes WHERE name='R3B'`))[0].id;
  await a.goto(`${APP}/ucitelj/razredi/${second}`);
  await a.locator('#cakajo label', { hasText: 'Bor Novak' }).locator('input').check();
  await a.click('text=Dodaj izbrane');
  await a.waitForLoadState();
  assert.equal((await sql('SELECT class_id FROM class_members WHERE user_id=$1', [bor])).length, 1);
  assert.ok((await counts(bor)).progress === c.progress, 'progress follows the student');
  // deleted from the system: nothing of the student remains, including the name in the log
  assert.ok((await sql(`SELECT count(*)::int n FROM audit_log WHERE detail LIKE '%Bor Novak%'`))[0].n > 0, 'name was in the log');
  await a.goto(`${APP}/admin`);
  const u = a.locator('tr', { hasText: 'bor.novak@sola.test' });
  await u.locator('summary:text("Izbriši za vedno")').click();
  await u.locator('button:text("Da, izbriši za vedno")').click();
  await a.waitForURL(/sporocilo/);
  assert.ok(!decodeURIComponent(a.url()).includes('Bor'), 'name is not in the address');
  assert.deepEqual(Object.values(await counts(bor)), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(await uid('u-bor'), undefined);
  assert.equal((await sql(`SELECT count(*)::int n FROM audit_log WHERE detail LIKE '%Bor Novak%' OR actor_name LIKE '%Bor Novak%'`))[0].n, 0);
  assert.equal((await sql(`SELECT count(*)::int n FROM session WHERE (sess->>'uid')::bigint=$1`, [bor]))[0].n, 0);
  // their open browser is logged out, and logging in again gives a new empty waiting account
  await s.goto(`${APP}/vaje`);
  assert.equal(new URL(s.url()).pathname, '/');
  await s.click('a.btn:text-is("Prijava")');
  await s.click('a:text-is("Bor Novak")');
  await s.waitForURL(`${APP}/**`);
  assert.match(await s.textContent('h1'), /Čakaš/);
  const fresh = await uid('u-bor');
  assert.notEqual(fresh, bor);
  assert.deepEqual(Object.values(await counts(fresh)), [0, 0, 0, 0, 0, 0, 0]);
  await s.context().close();
  // a teacher can be deleted too; the class stays and the log no longer names them
  await a.goto(`${APP}/admin`);
  const tr = a.locator('tr', { hasText: 'ucitelj@sola.test' });
  await tr.locator('summary:text("Izbriši za vedno")').click();
  await tr.locator('button:text("Da, izbriši za vedno")').click();
  await a.waitForURL(/sporocilo/);
  assert.equal(await uid('u-teacher'), undefined);
  assert.equal((await sql(`SELECT count(*)::int n FROM audit_log WHERE actor_name LIKE '%Tomaž%' OR detail LIKE '%Tomaž%'`))[0].n, 0);
  assert.ok((await sql(`SELECT count(*)::int n FROM audit_log WHERE actor_name='izbrisan uporabnik'`))[0].n > 0);
  assert.equal((await sql('SELECT count(*)::int n FROM classes WHERE id=$1', [classId]))[0].n, 1);
  await a.goto(`${APP}/admin/dnevnik`);
  assert.match(await a.textContent('table'), /Izbrisal uporabnika/);
  await t.context().close();
  await a.context().close();
});
test('backup from the admin page: download, warning, restore keeps deleted users deleted', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lav-bk-'));
  const a = await login('Sara Skrbnik');
  const uid = async (oid) => (await sql('SELECT id FROM users WHERE oid=$1', [oid]))[0]?.id;
  const loggedIn = async (name) => { const p = await login(name); await p.context().close(); };
  await loggedIn('Cene Zupan');
  await loggedIn('Daša Horvat');
  // nobody has made a backup yet: every admin page says so, as a warning
  await a.goto(`${APP}/admin`);
  assert.match(await a.textContent('.notice-warn'), /še ni bila prenesena/);
  assert.equal((await a.goto(`${APP}/admin/kopije`)).status(), 200);
  assert.equal(await a.locator('.notice-warn').count(), 0, 'the backup page has its own status line');
  // download
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('button:text("Prenesi varnostno kopijo")')]);
  assert.match(dl.suggestedFilename(), new RegExp(`^${portal.slug}-\\d{4}-\\d\\d-\\d\\d-\\d\\d-\\d\\d\\.dump$`));
  const good = path.join(dir, 'kopija.dump');
  await dl.saveAs(good);
  assert.equal(readFileSync(good).subarray(0, 5).toString(), 'PGDMP');
  const text = (file, ...args) => execFileSync('pg_restore', [...args, '--file=-', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PATH: `${process.env.PG_BIN ? `${process.env.PG_BIN}:` : ''}${process.env.PATH}` } });
  assert.match(text(good, '--data-only', '--table=users'), /Cene Zupan/);
  assert.doesNotMatch(text(good), /COPY public\.session /, 'sessions are not in the backup');
  assert.equal(readdirSync(tmpdir()).filter((d) => d.startsWith(`${portal.slug}-backup-`)).length, 0, 'nothing is left on the server');
  await a.goto(`${APP}/admin`);
  assert.equal(await a.locator('.notice-warn').count(), 0, 'warning is gone after a backup');
  assert.match(await (await a.request.get(`${APP}/admin/dnevnik`)).text(), /Prenesel varnostno kopijo/);
  // an old backup brings the warning back, with the age
  await sql(`UPDATE audit_log SET created_at = now() - interval '9 days' WHERE action='Prenesel varnostno kopijo'`);
  await a.goto(`${APP}/admin/razredi`);
  assert.match(await a.textContent('.notice-warn'), /Zadnja varnostna kopija baze je bila narejena/);
  await sql(`UPDATE audit_log SET created_at = now() WHERE action='Prenesel varnostno kopijo'`);

  // after the backup: Cene is deleted for good, Daša becomes a teacher
  await a.goto(`${APP}/admin?q=cene`);
  const row = a.locator('tr', { hasText: 'cene.zupan@sola.test' });
  await row.locator('summary:text("Izbriši za vedno")').click();
  await row.locator('button:text("Da, izbriši za vedno")').click();
  await a.waitForURL(/sporocilo/);
  assert.equal(await uid('u-cene'), undefined);
  await a.goto(`${APP}/admin?q=dasa`);
  await a.locator('tr', { hasText: 'dasa.horvat@sola.test' }).locator('button:text("Določi za učitelja")').click();
  await a.waitForURL(`${APP}/admin`);
  assert.equal((await sql(`SELECT role FROM users WHERE oid='u-dasa'`))[0].role, 'teacher');
  const usersBefore = (await sql('SELECT count(*)::int n FROM users'))[0].n;

  // wrong files are refused with a clear message and leave nothing behind
  await a.goto(`${APP}/admin/kopije`);
  const csrf = await a.locator('#upload').getAttribute('data-csrf');
  const send = (body, headers = { 'x-csrf-token': csrf }) => a.request.post(`${APP}/admin/kopije/nalozi`, { headers: { 'content-type': 'application/octet-stream', ...headers }, data: body });
  assert.equal((await send(good, {})).status(), 403, 'no token, no upload');
  const notDump = await send(Buffer.from('to ni kopija'));
  assert.equal(notDump.status(), 400);
  assert.match((await notDump.json()).error, /ni kopija/);
  const whole = readFileSync(good);
  const cut = await send(whole.subarray(0, Math.floor(whole.length / 2)));
  assert.equal(cut.status(), 400);
  assert.match((await cut.json()).error, /poškodovana/);
  assert.equal((await send(Buffer.alloc(0))).status(), 400);
  await a.goto(`${APP}/admin/kopije`);
  assert.equal(await a.locator('#restore').count(), 0, 'nothing is waiting for confirmation');
  assert.equal(readdirSync(tmpdir()).filter((d) => d.startsWith(`${portal.slug}-restore-`)).length, 0, 'refused files are deleted');
  assert.equal((await sql('SELECT count(*)::int n FROM users'))[0].n, usersBefore, 'data untouched');

  // the right file is checked and shown before anything changes
  await a.setInputFiles('#file', good);
  await a.click('button:text("Naloži in preveri")');
  await a.waitForSelector('#restore');
  assert.match(await a.textContent('.stats'), /Uporabniki\s*\d+/);
  assert.match(await a.textContent('main'), /bo po obnovitvi znova izbrisanih/);
  assert.match(await a.textContent('.notice-warn'), /znova izbrisanih/);
  assert.equal((await sql('SELECT count(*)::int n FROM users'))[0].n, usersBefore, 'preview changes nothing');
  // the word is required
  await a.fill('#potrdi', 'ne');
  await a.click('button:text("Obnovi bazo")');
  await a.waitForURL(/napaka/);
  assert.match(await a.textContent('.notice-warn[role=alert]'), /OBNOVI/);
  assert.equal((await sql('SELECT count(*)::int n FROM users'))[0].n, usersBefore);
  await a.waitForSelector('#restore');
  // restore
  await a.fill('#potrdi', 'obnovi');
  // while the data is replaced, other visitors are told to wait instead of touching the database
  const waiting = (async () => {
    for (let i = 0; i < 80; i++) {
      if ((await a.request.get(`${APP}/vaje`, { maxRedirects: 0 })).status() === 503) return true;
      await new Promise((ok) => setTimeout(ok, 100));
    }
    return false;
  })();
  const [, sawMaintenance] = await Promise.all([a.click('button:text("Obnovi bazo")'), waiting]);
  assert.equal(sawMaintenance, true, 'visitors get 503 during the restore');
  await a.waitForSelector('h1:text("Obnovitev je končana")');
  assert.match(await a.textContent('.lead'), /Znova izbrisanih: 1/);
  assert.equal(await uid('u-cene'), undefined, 'a user deleted after the backup stays deleted');
  assert.equal((await sql(`SELECT role FROM users WHERE oid='u-dasa'`))[0].role, 'user', 'other changes went back');
  assert.equal((await sql('SELECT count(*)::int n FROM users'))[0].n, usersBefore);
  assert.equal((await sql('SELECT count(*)::int n FROM session'))[0].n, 0, 'everybody is signed out');
  const hash = createHash('sha256').update(`${portal.slug}-erased:u-cene`).digest('hex');
  assert.equal((await sql('SELECT count(*)::int n FROM erased_users WHERE oid_hash=$1', [hash]))[0].n, 1, 'who was deleted is remembered, by hash only');
  assert.equal((await sql(`SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') AS h`, [`${portal.slug}-erased:u-cene`]))[0].h, hash, 'SQL and program agree on the hash');
  assert.equal((await sql(`SELECT count(*)::int n FROM erased_users WHERE oid_hash LIKE '%cene%'`))[0].n, 0);
  // the old browser is signed out; the admin signs in again and finds the entry in the log
  await a.goto(`${APP}/admin`);
  assert.equal(new URL(a.url()).pathname, '/');
  const a2 = await login('Sara Skrbnik');
  await a2.goto(`${APP}/admin/dnevnik`);
  assert.match(await a2.textContent('table'), /Obnovil bazo iz kopije[\s\S]*znova izbrisanih 1/);
  assert.equal((await sql(`SELECT actor_id FROM audit_log WHERE action='Obnovil bazo iz kopije'`))[0].actor_id, null);
  assert.equal(readdirSync(tmpdir()).filter((d) => d.startsWith(`${portal.slug}-restore-`)).length, 0);
  // a deleted user can still sign in again, as a new empty account
  const c = await login('Cene Zupan');
  assert.match(await c.textContent('h1'), /Čakaš/);
  await c.context().close();

  // with no recent backup, restoring needs the box to be ticked
  await sql(`UPDATE audit_log SET created_at = now() - interval '2 days' WHERE action='Prenesel varnostno kopijo'`);
  await a2.goto(`${APP}/admin/kopije`);
  const csrf2 = await a2.locator('#upload').getAttribute('data-csrf');
  assert.equal((await a2.request.post(`${APP}/admin/kopije/nalozi`, { headers: { 'x-csrf-token': csrf2, 'content-type': 'application/octet-stream' }, data: readFileSync(good) })).status(), 200);
  await a2.goto(`${APP}/admin/kopije`);
  assert.match(await a2.textContent('#restore'), /Trenutnega stanja še nisi prenesel/);
  await a2.fill('#potrdi', 'OBNOVI');
  await a2.click('button:text("Obnovi bazo")');
  await a2.waitForURL(/napaka/);
  assert.match(await a2.textContent('.notice-warn[role=alert]'), /prenesi trenutno stanje/);
  await a2.click('button:text("Prekliči in odstrani datoteko")');
  await a2.waitForURL(/sporocilo/);
  assert.equal(await a2.locator('#restore').count(), 0);
  assert.equal(readdirSync(tmpdir()).filter((d) => d.startsWith(`${portal.slug}-restore-`)).length, 0);
  // not allowed for anyone but the admin
  const s = await login('Ana Kovač');
  assert.equal((await s.goto(`${APP}/admin/kopije`)).status(), 403);
  assert.equal((await s.request.post(`${APP}/admin/kopije/nalozi`, { headers: { 'x-csrf-token': 'x' }, data: 'x' })).status(), 403);
  await s.context().close();
  await a2.context().close();
  rmSync(dir, { recursive: true, force: true });
});
test('people without a class: names only, account on hover, search by name, Slovene order by name or surname', async () => {
  const people = [['Anja Žnidaršič', 'anja.znidarsic'], ['Črt Cvetko', 'crt.cvetko'], ['Dušan Kralj', 'dusan.kralj'], ['Šimen Brglez', 'simen.brglez']];
  const byName = ['Anja Žnidaršič', 'Črt Cvetko', 'Dušan Kralj', 'Šimen Brglez'];
  const bySurname = ['Šimen Brglez', 'Črt Cvetko', 'Dušan Kralj', 'Anja Žnidaršič'];
  for (const [name, user] of people) await sql(`INSERT INTO users(oid, username, name, role) VALUES($1,$2,$3,'user')`, [`sort-${user}`, `${user}@sola.test`, name]);
  const a = await login('Sara Skrbnik');
  try {
    const mine = (names) => names.map((n) => n.trim()).filter((n) => byName.includes(n));
    const order = async (sel) => mine(await a.locator(sel).allTextContents());
    const pressed = () => a.locator('.sorter button[aria-pressed=true]').textContent();
    // overview
    await a.goto(`${APP}/ucitelj`);
    assert.deepEqual(await order('#brez-razreda li'), byName);
    assert.doesNotMatch(await a.textContent('#brez-razreda'), /@|sola\.test/, 'no account in the list');
    assert.equal(await a.locator('#brez-razreda li', { hasText: 'Črt Cvetko' }).getAttribute('title'), 'crt.cvetko@sola.test');
    await a.click('.sorter button:text("po priimku")');
    assert.deepEqual(await order('#brez-razreda li'), bySurname);
    assert.equal(await pressed(), 'po priimku');
    await a.click('.sorter button:text("po imenu")');
    assert.deepEqual(await order('#brez-razreda li'), byName);
    // class page: adding people
    await a.goto(`${APP}/ucitelj/razredi/${classId}`);
    assert.deepEqual(await order('#cakajo li'), byName);
    assert.doesNotMatch(await a.textContent('#cakajo'), /@|sola\.test/);
    assert.equal(await a.locator('#cakajo label', { hasText: 'Šimen Brglez' }).getAttribute('title'), 'simen.brglez@sola.test');
    assert.equal(await a.getAttribute('#iskanje', 'placeholder'), 'Išči po imenu');
    await a.fill('#iskanje', 'cvetko');
    assert.deepEqual(await a.locator('#cakajo li:visible').allTextContents().then((x) => x.map((n) => n.trim())), ['Črt Cvetko']);
    await a.fill('#iskanje', 'sola.test');
    assert.equal(await a.locator('#cakajo li:visible').count(), 0, 'the account is not searched');
    await a.fill('#iskanje', '');
    await a.locator('#cakajo label', { hasText: 'Dušan Kralj' }).locator('input').check();
    await a.click('.sorter button:text("po priimku")');
    assert.deepEqual(await order('#cakajo li'), bySurname);
    assert.equal(await a.locator('#cakajo label', { hasText: 'Dušan Kralj' }).locator('input').isChecked(), true, 'a ticked box stays ticked');
    // people in the class: by name, and by surname on request
    await sql(`INSERT INTO class_members(class_id, user_id) SELECT $1, id FROM users WHERE oid LIKE 'sort-%'`, [classId]);
    await a.goto(`${APP}/ucitelj/razredi/${classId}`);
    assert.deepEqual(await order('.matrix td.stick a'), byName);
    await a.click('.sorter a:text("po priimku")');
    assert.deepEqual(await order('.matrix td.stick a'), bySurname);
    assert.equal(await a.locator('.sorter a[aria-current]').textContent(), 'po priimku');
    await a.goto(`${APP}/ucitelj/razredi/${classId}/rezultati/1.1`);
    assert.deepEqual(await order('tbody tr td:first-child a'), byName);
  } finally {
    await sql(`DELETE FROM users WHERE oid LIKE 'sort-%'`);
    await a.context().close();
  }
});
test('login page, school logo and data notice page', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  assert.equal(await p.textContent('h1'), portal.title);
  assert.doesNotMatch(await p.textContent('main'), /Vaje vidiš/);
  assert.equal(await p.locator('.school-logo').getAttribute('href'), portal.school.url);
  assert.ok(await p.evaluate(() => document.querySelector('.school-logo img').naturalWidth > 0), 'logo loads');
  // the title and the login button share one centre line
  const centre = async (sel) => { const b = await p.locator(sel).boundingBox(); return b.x + b.width / 2; };
  assert.ok(Math.abs(await centre('.entry h1') - await centre('main a.btn')) < 2, 'the button is centred under the title');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.entry h1')).textAlign), 'center');
  assert.doesNotMatch(await p.textContent('main'), /Prijaviš se|Tudi ime portala/);
  await p.click('a:text("Kateri podatki se beležijo")');
  await p.waitForURL(/zasebnost/);
  assert.equal(await p.locator('footer a').count(), 0);
  await p.click('[data-back]');
  await p.waitForURL(`${APP}/`);
  await p.goto(`${APP}/zasebnost`);
  await p.click('[data-back]'); // opened directly: goes home
  await p.waitForURL(`${APP}/`);
  await ctx.close();
});
test('the replaced 3.2 tasks are in place and score correctly', async () => {
  const s = await login('Ana Kovač');
  await openTasks(s, '3.2');
  const before_ = Number((await s.textContent('#sc')).replace(',', '.'));
  const task = (n) => s.locator('.task').nth(n - 1);
  assert.match(await task(5).locator('.q').textContent(), /Katera logična vrata uporabimo za izračun bita parnosti/);
  for (const [n, label] of [[5, 'XOR'], [11, 'Negator (NE)'], [12, '7']]) {
    await task(n).locator('label.opt', { hasText: new RegExp(`^\\s*${label.replace(/[()]/g, '\\$&')}\\s*$`) }).locator('input').check();
    await task(n).locator('[data-act=check]').click();
    assert.match(await task(n).locator('.fb').textContent(), /Pravilno/, `task ${n}`);
  }
  await synced(s);
  assert.equal(Number((await s.textContent('#sc')).replace(',', '.')), before_ + 5);
  await s.context().close();
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
