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
import { dayKey, dayLabel } from '../src/format.js';
import { addDays } from '../src/timeline.js';

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
// The status text can still be the one of an earlier save, so a test that reads the database polls it for what it expects.
const eventually = async (read, ok, ms = 8000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
};
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
  await makeTeacher(a, 'ucitelj@sola.test');
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
// Opens the edit window of a class on the admin page, lets the caller change it, and saves.
// The edit window of a person in Administration > Uporabniki (opened with the pencil, found by the search).
async function editUser(a, email, change, { save = true } = {}) {
  await a.goto(`${APP}/admin?q=${encodeURIComponent(email)}`);
  await a.locator('tr', { hasText: email }).locator('.icon-btn').click();
  const dlg = a.locator('dialog[open]');
  await change(dlg);
  if (save) { await dlg.locator('button:text-is("Shrani")').click(); await a.waitForLoadState(); }
  return dlg;
}
const eraseUserVia = async (a, email) => {
  await editUser(a, email, async (dlg) => {
    await dlg.locator('summary:text("Izbriši za vedno")').click();
    await dlg.locator('button:text("Da, izbriši za vedno")').click();
    await a.waitForURL(/sporocilo/);
  }, { save: false });
};
const makeTeacher = (a, email) => editUser(a, email, (dlg) => dlg.locator('input[name=role][value=teacher]').check());
async function editClass(a, name, change) {
  await a.goto(`${APP}/admin/razredi`);
  await a.locator('tr', { hasText: name }).locator('.icon-btn').click();
  const dlg = a.locator('dialog[open]');
  await change(dlg);
  await dlg.locator('button:text-is("Shrani")').click();
  await a.waitForLoadState();
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
  // students are numbered in the order shown; the class page has no »Razredi« link above its title; the note under the table wraps over the full width, with no scroller of its own
  assert.deepEqual(await t.locator('.matrix td.stick .rn').allTextContents(), ['1.', '2.']);
  assert.equal(await t.locator('.crumbs').count(), 0);
  const note = await t.locator('.matrix-wrap + p.note').evaluate((e) => {
    const main = e.closest('main'); const cs = getComputedStyle(main); const inner = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { white: getComputedStyle(e).whiteSpace, overflowX: getComputedStyle(e).overflowX, scrolls: e.scrollWidth > e.clientWidth, width: e.getBoundingClientRect().width, inner };
  });
  assert.equal(note.white, 'normal');
  assert.equal(note.overflowX, 'visible');
  assert.equal(note.scrolls, false);
  assert.ok(Math.abs(note.width - note.inner) <= 1, `the note spans the full width (${note.width} of ${note.inner})`);
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
    const row = await eventually(
      async () => (await sql(`SELECT * FROM progress WHERE exercise_id=$1 AND user_id=(SELECT id FROM users WHERE oid='u-ana')`, [ex.id]))[0],
      (r) => r && r.done_count >= 1 && r.solution_count === 1 && r.hint_count >= 1 && String(r.score).replace('.', ',') === page.sc,
    );
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
  assert.equal((await eventually(
    async () => (await sql(`SELECT done_count FROM progress WHERE exercise_id='1.1' AND user_id=(SELECT id FROM users WHERE oid='u-ana')`))[0],
    (r) => r && r.done_count === 1,
  )).done_count, 1);
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
  await makeTeacher(a, 'cene.zupan@sola.test');
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
test('a teacher resets an exercise for one student or the whole class; the score before it stays', async () => {
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
  // only the last reset is kept per student and exercise; the log says who did it
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
  await editClass(a, 'E4A', async (dlg) => { await dlg.locator('label', { hasText: 'Cene Zupan' }).locator('input').check(); });
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
  await editClass(a, 'R3B', async (dlg) => { await dlg.locator('label', { hasText: 'Cene Zupan' }).locator('input').uncheck(); });
  assert.equal((await c.goto(`${APP}/ucitelj/razredi/${second}`)).status(), 404);
  // the admin can open any class without joining
  assert.equal((await a.goto(`${APP}/ucitelj/razredi/${second}`)).status(), 200);
  // removing the teacher role removes the person from all classes and sends them back to waiting
  await editUser(a, 'cene.zupan@sola.test', (dlg) => dlg.locator('input[name=role][value=user]').check());
  assert.equal((await sql(`SELECT count(*)::int n FROM class_teachers t JOIN users u ON u.id=t.user_id WHERE u.oid='u-cene'`))[0].n, 0);
  await c.goto(APP);
  assert.match(await c.textContent('h1'), /Čakaš/);
  await c.context().close();
  await a.context().close();
});
test('classes: one pencil opens one window that saves name and teachers together; names are unique; a class without a teacher is marked', async () => {
  const a = await login('Sara Skrbnik');
  const csrf = async () => a.inputValue('form[action="/admin/razredi"] input[name=_csrf]');
  const count = async (name) => (await sql('SELECT count(*)::int n FROM classes WHERE lower(btrim(name))=lower(btrim($1))', [name]))[0].n;
  await adminMakesClass(a, 'R9X');
  await a.goto(`${APP}/admin/razredi`);
  // the rows hold no forms any more: only the pencil, named after its class
  assert.equal(await a.locator('table.classes select, table.classes input, table.classes form').count(), 0);
  const row = a.locator('tr', { hasText: 'R9X' });
  assert.equal(await row.locator('button').count(), 1);
  assert.equal(await row.locator('button').getAttribute('aria-label'), 'Uredi razred R9X');
  // a class without a teacher says so in its row and in a notice above the table
  assert.match(await row.locator('.tag.warn').textContent(), /Brez učitelja/);
  assert.match(await a.locator('p.notice-warn[role=status]', { hasText: 'Brez učitelja' }).textContent(), /Brez učitelja:.*R9X/);
  // Cancel and Escape close the window without saving
  await row.locator('.icon-btn').click();
  await a.locator('dialog[open] input[name=name]').fill('Nekaj drugega');
  await a.locator('dialog[open] button:text-is("Prekliči")').click();
  assert.equal(await a.locator('dialog[open]').count(), 0);
  await row.locator('.icon-btn').click();
  await a.keyboard.press('Escape');
  assert.equal(await a.locator('dialog[open]').count(), 0);
  assert.equal(await count('Nekaj drugega'), 0);
  // the name and a teacher are saved in one go, and every change is in the log
  await editClass(a, 'R9X', async (dlg) => {
    assert.equal(await dlg.locator('input[name=past], select[name=year]').count(), 0); // this portal run has no years
    await dlg.locator('input[name=name]').fill('  R9Y ');
    await dlg.locator('label', { hasText: 'Tomaž Učitelj' }).locator('input').check();
  });
  assert.match(await a.textContent('.notice'), /Razred R9Y je shranjen/);
  assert.equal(await count('R9X'), 0);
  assert.equal((await sql(`SELECT count(*)::int n FROM class_teachers t JOIN classes c ON c.id=t.class_id JOIN users u ON u.id=t.user_id WHERE c.name='R9Y' AND u.oid='u-teacher'`))[0].n, 1);
  assert.deepEqual((await sql(`SELECT action, detail FROM audit_log WHERE detail LIKE 'R9%' ORDER BY id`)).map((l) => [l.action, l.detail]),
    [['Ustvaril razred', 'R9X'], ['Preimenoval razred', 'R9X: R9Y'], ['Dodal učitelja razredu', 'R9Y: Tomaž Učitelj']]);
  assert.equal(await a.locator('tr', { hasText: 'R9Y' }).locator('.tag.warn').count(), 0);
  // names are unique, whatever the case and spaces, when creating and when renaming
  const before = (await sql('SELECT count(*)::int n FROM classes'))[0].n;
  for (const same of ['R9Y', 'r9y', '  R9Y  ']) {
    await a.goto(`${APP}/admin/razredi`);
    await a.fill('#novi', same);
    await a.click('text=Ustvari razred');
    await a.waitForLoadState();
    assert.match(await a.textContent('[role=alert]'), new RegExp(`Razred z imenom ${same.trim()} že obstaja`));
  }
  await editClass(a, 'R9Y', async (dlg) => { await dlg.locator('input[name=name]').fill('r3b'); });
  assert.match(await a.textContent('[role=alert]'), /Razred z imenom r3b že obstaja/);
  assert.equal((await sql('SELECT count(*)::int n FROM classes'))[0].n, before);
  assert.equal(await count('R9Y'), 1);
  await assert.rejects(sql(`INSERT INTO classes(name) VALUES ('  r9y')`)); // the database holds the same rule
  // a class may change its own spelling
  await editClass(a, 'R9Y', async (dlg) => { await dlg.locator('input[name=name]').fill('r9y'); });
  assert.match(await a.textContent('.notice'), /Razred r9y je shranjen/);
  // only a teacher or the admin can be added to a class, even when the form is sent by hand
  const id = Number((await sql(`SELECT id FROM classes WHERE name='r9y'`))[0].id);
  const ana = (await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id;
  await a.request.post(`${APP}/admin/razredi/${id}/uredi`, { form: { _csrf: await csrf(), name: 'r9y', teacher: [String(ana)] } });
  assert.equal((await sql('SELECT count(*)::int n FROM class_teachers WHERE class_id=$1', [id]))[0].n, 0); // and Tomaž was unticked, so he is out
  // a form for a class that does not exist, and an empty name, change nothing
  const gone = await a.request.post(`${APP}/admin/razredi/999999/uredi`, { form: { _csrf: await csrf(), name: 'Nov' } });
  assert.match(decodeURIComponent(gone.url()), /Razred ne obstaja/);
  await a.request.post(`${APP}/admin/razredi/${id}/uredi`, { form: { _csrf: await csrf(), name: '   ' } });
  assert.equal(await count('r9y'), 1);
  // the window also deletes the class
  await a.goto(`${APP}/admin/razredi`);
  await a.locator('tr', { hasText: 'r9y' }).locator('.icon-btn').click();
  await a.locator('dialog[open] summary', { hasText: 'Izbriši razred' }).click();
  await a.locator('dialog[open] button:text-is("Da, izbriši razred r9y")').click();
  await a.waitForLoadState();
  assert.equal(await count('r9y'), 0);
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
test('users: one pencil opens one window for the role, the class of a student and the classes of a teacher', async () => {
  const a = await login('Sara Skrbnik');
  const ana = Number((await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id);
  const home = Number((await sql('SELECT class_id FROM class_members WHERE user_id=$1', [ana]))[0].class_id);
  const u1 = Number((await sql(`INSERT INTO classes(name) VALUES ('U1') RETURNING id`))[0].id);
  const u2 = Number((await sql(`INSERT INTO classes(name) VALUES ('U2') RETURNING id`))[0].id);
  const mine = async () => (await sql('SELECT class_id FROM class_members WHERE user_id=$1', [ana])).map((r) => Number(r.class_id));
  const teaches = async () => (await sql('SELECT class_id FROM class_teachers WHERE user_id=$1 ORDER BY class_id', [ana])).map((r) => Number(r.class_id));
  const role = async () => (await sql('SELECT role FROM users WHERE id=$1', [ana]))[0].role;
  const all = async () => (await sql(`SELECT action, detail FROM audit_log WHERE detail LIKE '%Ana Kovač%' ORDER BY id`)).map((l) => [l.action, l.detail]);
  const logged = (await all()).length;
  const log = async () => (await all()).slice(logged); // only what this test changed
  const progress = async () => (await sql('SELECT count(*)::int n FROM progress WHERE user_id=$1', [ana]))[0].n;
  const had = await progress();
  assert.ok(had > 0);

  // the rows hold only the pencil, named after the person; the admin from the settings has none
  await a.goto(`${APP}/admin`);
  assert.equal(await a.locator('table.data select, table.data input, table.data form').count(), 0);
  const row = a.locator('tr', { hasText: 'ana.kovac@sola.test' });
  assert.equal(await row.locator('button').count(), 1);
  assert.equal(await row.locator('button').getAttribute('aria-label'), 'Uredi uporabnika Ana Kovač');
  assert.equal(await a.locator('tr', { hasText: 'admin@sola.test' }).locator('button').count(), 0);
  assert.match(await a.locator('tr', { hasText: 'admin@sola.test' }).textContent(), /Določen v nastavitvah strežnika/);

  // a student has the class to choose, a teacher the classes; the role decides which is shown
  await editUser(a, 'ana.kovac@sola.test', async (dlg) => {
    assert.equal(await dlg.locator('[data-panel=user]').isVisible(), true);
    assert.equal(await dlg.locator('[data-panel=teacher]').isVisible(), false);
    await dlg.locator('input[name=role][value=teacher]').check();
    assert.equal(await dlg.locator('[data-panel=user]').isVisible(), false);
    assert.equal(await dlg.locator('[data-panel=teacher]').isVisible(), true);
    await dlg.locator('input[name=role][value=user]').check();
    assert.equal(await dlg.locator('select[name=class_id]').inputValue(), String(home));
    await dlg.locator('button:text-is("Prekliči")').click();
  }, { save: false });
  assert.equal(await a.locator('dialog[open]').count(), 0);

  // saving without a change changes nothing and says so; the list keeps its search
  await editUser(a, 'ana.kovac@sola.test', async () => {});
  assert.match(await a.textContent('.notice'), /Ni sprememb/);
  assert.match(a.url(), /q=ana\.kovac/);
  assert.deepEqual(await log(), []);

  // the admin moves a student to another class: one class, the progress stays with the student
  await editUser(a, 'ana.kovac@sola.test', (dlg) => dlg.locator('select[name=class_id]').selectOption({ label: 'U1' }));
  assert.match(await a.textContent('.notice'), /Spremembe so shranjene/);
  assert.deepEqual(await mine(), [u1]);
  assert.equal(await progress(), had);
  assert.match(await a.locator('tr', { hasText: 'ana.kovac@sola.test' }).textContent(), /U1/);
  assert.deepEqual(await log(), [['Odstranil dijaka iz razreda', `${(await sql('SELECT name FROM classes WHERE id=$1', [home]))[0].name}: Ana Kovač`], ['Dodal dijaka v razred', 'U1: Ana Kovač']]);

  // without a class she waits again
  await editUser(a, 'ana.kovac@sola.test', (dlg) => dlg.locator('select[name=class_id]').selectOption(''));
  assert.deepEqual(await mine(), []);
  assert.match(await a.locator('tr', { hasText: 'ana.kovac@sola.test' }).textContent(), /Brez razreda/);

  // a teacher: the role and the classes in one save; she is no longer a student
  await editUser(a, 'ana.kovac@sola.test', async (dlg) => {
    await dlg.locator('select[name=class_id]').selectOption({ label: 'U2' });
    await dlg.locator('input[name=role][value=teacher]').check();
    await dlg.locator('label', { hasText: /^\s*U1\s*$/ }).locator('input').check();
    await dlg.locator('label', { hasText: /^\s*U2\s*$/ }).locator('input').check();
  });
  assert.equal(await role(), 'teacher');
  assert.deepEqual(await teaches(), [u1, u2]);
  assert.deepEqual(await mine(), []); // the class chosen for a student is not used for a teacher
  assert.match(await a.locator('tr', { hasText: 'ana.kovac@sola.test' }).textContent(), /U1, U2/);
  // reopened, the window shows the classes she teaches
  await editUser(a, 'ana.kovac@sola.test', async (dlg) => {
    assert.equal(await dlg.locator('input[name=role][value=teacher]').isChecked(), true);
    assert.equal(await dlg.locator('input[name=teach]:checked').count(), 2);
    assert.equal(await dlg.locator('[data-panel=teacher]').isVisible(), true);
    await dlg.locator('label', { hasText: /^\s*U2\s*$/ }).locator('input').uncheck();
  });
  assert.deepEqual(await teaches(), [u1]);
  // she opens her class as a teacher
  assert.equal((await (await login('Ana Kovač')).goto(`${APP}/ucitelj/razredi/${u1}`)).status(), 200);

  // a teacher becomes a student again: the classes she taught are gone, the chosen class is hers
  await editUser(a, 'ana.kovac@sola.test', async (dlg) => {
    await dlg.locator('input[name=role][value=user]').check();
    await dlg.locator('select[name=class_id]').selectOption({ label: 'U2' });
  });
  assert.equal(await role(), 'user');
  assert.deepEqual(await teaches(), []);
  assert.deepEqual(await mine(), [u2]);
  assert.deepEqual((await log()).map((l) => l[0]), [
    'Odstranil dijaka iz razreda', 'Dodal dijaka v razred', 'Odstranil dijaka iz razreda',
    'Določil učitelja', 'Dodal učitelja razredu', 'Dodal učitelja razredu', 'Odstranil učitelja iz razreda',
    'Odvzel vlogo učitelja', 'Odstranil učitelja iz razreda', 'Dodal dijaka v razred',
  ]);
  assert.equal(await progress(), had);

  // forms sent by hand: the admin of the settings, a class that does not exist and a foreign return address change nothing
  const csrf = await a.inputValue('input[name=_csrf]');
  const adminId = (await sql(`SELECT id FROM users WHERE oid='u-admin'`))[0].id;
  const post = (id, form) => a.request.post(`${APP}/admin/uporabniki/${id}/uredi`, { form: { _csrf: csrf, ...form } });
  assert.match(decodeURIComponent((await post(adminId, { role: 'teacher' })).url()), /Skrbnika se ureja v nastavitvah/);
  assert.equal((await sql(`SELECT role FROM users WHERE oid='u-admin'`))[0].role, 'user');
  assert.match(decodeURIComponent((await post(ana, { role: 'user', class_id: '999999' })).url()), /Izbrani razred ne obstaja/);
  assert.deepEqual(await mine(), [u2]);
  assert.match(decodeURIComponent((await post(999999, { role: 'user' })).url()), /Uporabnik ne obstaja več/);
  const away = await post(ana, { role: 'user', class_id: String(u2), back: 'https://evil.example/x' });
  assert.equal(new URL(away.url()).origin, APP);
  assert.equal(new URL((await post(ana, { role: 'user', class_id: String(u2), back: '//evil.example/x' })).url()).origin, APP);
  // somebody who is not the admin cannot use the window
  const t = await login('Tomaž Učitelj');
  const own = await t.request.post(`${APP}/admin/uporabniki/${ana}/uredi`, { form: { role: 'teacher' } });
  assert.notEqual(own.status(), 200);
  assert.equal(await role(), 'user');
  await t.context().close();

  // everything back where it was
  await editUser(a, 'ana.kovac@sola.test', (dlg) => dlg.locator('select[name=class_id]').selectOption(String(home)));
  assert.deepEqual(await mine(), [home]);
  await sql('DELETE FROM classes WHERE id = ANY($1)', [[u1, u2]]);
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
test('notes are gone: no icon, no slot, no route, no script, no table, and the privacy page does not mention them', async () => {
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  assert.equal(await s.locator('.lvn-btn, .my-note, .lvn-text, [data-note-slot]').count(), 0);
  assert.doesNotMatch(await s.textContent('main'), /opomb/i);
  await openTasks(s, '1.1');
  assert.equal(await s.locator('.lvn-btn, .lvn-text, .lvs-exnote').count(), 0);
  const csrf = await s.evaluate(() => window.__LAVELS.csrf);
  assert.equal(await s.evaluate(() => 'notes' in window.__LAVELS), false);
  assert.equal((await s.request.post(`${APP}/api/notes`, { data: { csrf, body: 'x' } })).status(), 404);
  assert.equal((await s.request.get(`${APP}/static/js/notes.js`)).status(), 404);
  assert.equal((await sql(`SELECT to_regclass('public.student_notes') AS t`))[0].t, null);
  await s.goto(`${APP}/zasebnost`);
  assert.doesNotMatch(await s.textContent('main'), /opomb/i);
  await s.context().close();
  // the admin and teacher views have none either
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/1.1`);
  await a.waitForSelector('.lvs-bar');
  assert.equal(await a.locator('.lvn-btn, .lvn-text').count(), 0);
  await a.context().close();
});
test('the timeline on the student page: ranges, bars per day or week, a pop-up with what was solved, and aligned task strips', async () => {
  const ana = (await sql(`SELECT id FROM users WHERE oid='u-ana'`))[0].id;
  const titleOf = (id) => catalog.exercises.find((e) => e.id === id).title;
  // Events on fixed days of the portal's calendar: three days ago (a busy day), 40 and 100 days ago (one answer each).
  const at = (daysAgo, time) => `((date_trunc('day', now() AT TIME ZONE 'Europe/Ljubljana') - interval '${daysAgo} days' + time '${time}') AT TIME ZONE 'Europe/Ljubljana')`;
  const rows = [
    [3, '10:00', 1, 'hint', '1.1'], [3, '10:05', 1, 'wrong', '1.1'], [3, '10:20', 1, 'correct', '1.1'], [3, '12:30', 0, 'partial', '1.1'], [3, '12:31', 2, 'solution', '3.3'],
    [40, '09:00', 0, 'correct', '1.1'], [100, '09:00', 0, 'correct', '1.1'],
  ];
  const ids = [];
  for (const [d, time, task, kind, ex] of rows) {
    ids.push((await sql(`INSERT INTO task_events(user_id, exercise_id, attempt, task_index, kind, points, created_at) VALUES ($1,$2,1,$3,$4,0,${at(d, time)}) RETURNING id`, [ana, ex, task, kind]))[0].id);
  }
  const today = dayKey(Date.now());
  const threeAgo = addDays(today, -3);
  const t = await login('Tomaž Učitelj');
  const url = `${APP}/ucitelj/razredi/${classId}/dijaki/${ana}`;
  const info = async () => t.evaluate(() => ({
    h2: document.querySelector('.tl h2').textContent, cols: document.querySelectorAll('.bar-col').length, axis: document.querySelector('.bars-axis').textContent,
    current: [...document.querySelectorAll('.tl-range [aria-current]')].map((a) => a.textContent), links: [...document.querySelectorAll('.tl-range a')].map((a) => a.textContent),
    labels: [...document.querySelectorAll('.bar-col')].map((c) => c.getAttribute('aria-label')),
  }));
  // 30 days is the default, and a nonsense range falls back to it
  for (const q of ['', '?obdobje=junk', '?obdobje=30']) {
    await t.goto(url + q);
    const i = await info();
    assert.deepEqual([i.h2, i.cols, i.current, i.links], ['Odgovori v zadnjih 30 dneh', 30, ['30 dni'], ['7 dni', '30 dni', '90 dni', 'Šolsko leto', 'Vse']]);
  }
  await t.goto(url);
  let i = await info();
  assert.ok(i.labels.some((l) => l.startsWith(`${dayLabel(threeAgo)}: 4 odgovori, 1 namig. vaja 1.1, naloge 1, 2. vaja 3.3, naloga 3. pravilno 1, pravilno z namigom 1, napačno 1, ogledana rešitev 1`)), i.labels.join('\n'));
  assert.equal(i.labels.filter((l) => l.includes(dayLabel(addDays(today, -40)))).length, 0, '40 days ago is outside 30 days');
  // the other ranges
  await t.goto(`${url}?obdobje=7`);
  i = await info();
  assert.deepEqual([i.h2, i.cols, i.current], ['Odgovori v zadnjih 7 dneh', 7, ['7 dni']]);
  await t.goto(`${url}?obdobje=90`);
  i = await info();
  assert.deepEqual([i.h2, i.cols], ['Odgovori v zadnjih 90 dneh', 90]);
  assert.ok(i.labels.some((l) => l.startsWith(`${dayLabel(addDays(today, -40))}: 1 odgovor. vaja 1.1, naloga 1. pravilno 1`)));
  assert.match(i.axis, /največ \d+ na dan/);
  await t.goto(`${url}?obdobje=leto`);
  i = await info();
  assert.match(i.h2, /^Odgovori v šolskem letu \d{4}\/\d{2}$/);
  assert.deepEqual(i.current, ['Šolsko leto']);
  await t.goto(`${url}?obdobje=vse`);
  i = await info();
  // 100 days back is longer than 92, so each bar is a week
  assert.equal(i.h2, 'Odgovori od začetka');
  assert.ok(i.cols >= 15 && i.cols <= 16, `${i.cols} weeks`);
  assert.match(i.axis, /na teden/);
  assert.ok(i.labels.some((l) => /^\d+\. \d+\. \d{4} – \d+\. \d+\. \d{4}: 1 odgovor\. vaja 1\.1, naloga 1\. pravilno 1$/.test(l)), 'the week of the oldest answer');
  assert.ok(i.labels.every((l) => !/(ponedeljek|torek|sreda|četrtek|petek|sobota|nedelja),/.test(l)), 'weeks are named by their dates');

  // the pop-up: hover anywhere above a bar
  await t.goto(url);
  assert.equal(await t.locator('.bar-col[title]').count(), 0, 'no plain tooltip once the script runs');
  const box = await t.locator('.bars').boundingBox();
  const colX = (n, back) => box.x + box.width * ((n - 1 - back + 0.5) / n);
  await t.mouse.move(colX(30, 3), box.y + 6);
  await t.waitForSelector('.tl-tip-box:not([hidden])');
  const tip = await t.locator('.tl-tip-box').innerText();
  for (const part of [dayLabel(threeAgo), '4 odgovori, 1 namig', '10:00–12:31', titleOf('1.1'), 'naloge 1, 2', titleOf('3.3'), 'naloga 3', 'pravilno 1', 'napačno 1', 'ogledana rešitev 1']) {
    assert.ok(tip.toLowerCase().includes(part.toLowerCase()), `pop-up has "${part}": ${tip}`);
  }
  assert.equal(await t.locator('.bar-col.on').count(), 1);
  const place = await t.evaluate(() => { const r = document.querySelector('.tl-tip-box').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, r.top >= 0]; });
  assert.deepEqual(place, [true, true, true]);
  // a day without answers says so, and the pop-up follows the pointer
  await t.mouse.move(colX(30, 5), box.y + 6);
  assert.match(await t.locator('.tl-tip-box').innerText(), /Brez odgovorov/i);
  await t.mouse.move(box.x + 5, box.y - 80);
  assert.equal(await t.locator('.tl-tip-box').isHidden(), true);
  // the keyboard: one tab stop, arrows walk back day by day, Escape closes
  await t.locator('.bar-col').last().focus();
  assert.equal(await t.locator('.bar-col[tabindex="0"]').count(), 1);
  for (let k = 0; k < 3; k++) await t.keyboard.press('ArrowLeft');
  assert.ok((await t.locator('.tl-tip-box').innerText()).includes(titleOf('3.3')));
  assert.equal(await t.locator('.bar-col[tabindex="0"]').count(), 1);
  await t.keyboard.press('Escape');
  assert.equal(await t.locator('.tl-tip-box').isHidden(), true);
  await t.keyboard.press('Home');
  assert.ok((await t.locator('.tl-tip-box').innerText()).length > 0);
  // the range buttons are plain links that keep the place on the page
  await t.locator('.tl-range a', { hasText: '90 dni' }).click();
  await t.waitForURL(/obdobje=90#casovnica$/);
  assert.equal((await info()).cols, 90);

  // the strips of task cells start at the same place in every exercise, whatever the text on the right says
  await t.goto(url);
  const rowsInfo = await t.evaluate(() => [...document.querySelectorAll('.exd > summary')].map((s) => ({ left: Math.round(s.querySelector('.strip').getBoundingClientRect().left * 10) / 10, text: s.querySelector('.exd-m').textContent })));
  assert.ok(rowsInfo.length >= 9);
  assert.ok(new Set(rowsInfo.map((r) => r.text.length)).size > 1, 'the texts on the right differ in length');
  assert.deepEqual([...new Set(rowsInfo.map((r) => r.left))].length, 1, JSON.stringify(rowsInfo));

  await sql('DELETE FROM task_events WHERE id = ANY($1)', [ids]);
  await t.context().close();
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
test('text paragraphs run across the whole width of their page, on the admin, teacher and student pages', async () => {
  // A paragraph is as wide as the block it sits in (no 72-character column); the privacy page keeps its own narrow column.
  const narrow = (page) => page.evaluate(() => [...document.querySelectorAll('main p')].filter((e) => {
    const parent = e.parentElement;
    const cs = getComputedStyle(parent);
    if (!e.offsetParent || cs.display.includes('flex') || cs.display.includes('grid') || getComputedStyle(e).display !== 'block') return false;
    const inner = parent.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return e.getBoundingClientRect().width < inner - 2;
  }).map((e) => e.textContent.trim().slice(0, 50)));
  const a = await login('Sara Skrbnik');
  for (const path of ['/admin', '/admin/vaje', '/admin/razredi', '/admin/solsko-leto', '/admin/kopije', '/admin/dnevnik', '/admin/ciscenje', `/ucitelj/razredi/${classId}`, `/ucitelj/razredi/${classId}/vaje`]) {
    await a.goto(`${APP}${path}`);
    assert.deepEqual(await narrow(a), [], path);
  }
  const s = await login('Ana Kovač');
  await s.goto(`${APP}/vaje`);
  assert.deepEqual(await narrow(s), [], '/vaje');
  await s.context().close();
  await a.context().close();
});
test('removing from a class keeps the user; deleting from the system erases them forever', async () => {
  const uid = async (oid) => (await sql('SELECT id FROM users WHERE oid=$1', [oid]))[0]?.id;
  const counts = async (id) => {
    const out = {};
    for (const tbl of ['progress', 'resets', 'task_events', 'page_time', 'class_members', 'class_teachers']) {
      out[tbl] = (await sql(`SELECT count(*)::int n FROM ${tbl} WHERE user_id=$1`, [id]))[0].n;
    }
    return out;
  };
  const bor = await uid('u-bor');
  const s = await login('Bor Novak');
  await s.goto(`${APP}/vaje`);
  // removed from a class: everything stays, and another class can take the student
  const t = await login('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${classId}/dijaki/${bor}`);
  await t.click('summary:text("Odstrani iz razreda")');
  await t.click('text=Da, odstrani');
  await t.waitForURL(/razredi\/\d+$/);
  let c = await counts(bor);
  assert.equal(c.class_members, 0);
  assert.ok(c.progress > 0 && c.task_events > 0);
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
  await eraseUserVia(a, 'bor.novak@sola.test');
  assert.ok(!decodeURIComponent(a.url()).includes('Bor'), 'name is not in the address');
  assert.deepEqual(Object.values(await counts(bor)), [0, 0, 0, 0, 0, 0]);
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
  assert.deepEqual(Object.values(await counts(fresh)), [0, 0, 0, 0, 0, 0]);
  await s.context().close();
  // a teacher can be deleted too; the class stays and the log no longer names them
  await eraseUserVia(a, 'ucitelj@sola.test');
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
  // the name carries the commit (neznano without a build argument) and the local time
  assert.match(dl.suggestedFilename(), new RegExp(`^${portal.slug}-[a-z0-9]+-\\d{4}-\\d\\d-\\d\\d-\\d\\d-\\d\\d\\.dump$`));
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
  await a.goto(`${APP}/admin`);
  // the user list is numbered across pages (the number counts rows of the list, not roles)
  const nums = await a.locator('.data tbody td.n').allTextContents();
  assert.ok(nums.length > 1);
  assert.deepEqual(nums, nums.map((_, i) => String(i + 1)));
  await eraseUserVia(a, 'cene.zupan@sola.test');
  assert.equal(await uid('u-cene'), undefined);
  await makeTeacher(a, 'dasa.horvat@sola.test');
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
test('fonts do not make the page jump: kept by the browser, preloaded, and not asked for again after F5', async () => {
  const a = await login('Sara Skrbnik');
  try {
    const FACES = ['latin-400', 'latin-ext-400', 'latin-700', 'latin-ext-700'].map((f) => `/static/fonts/atkinson-hyperlegible-${f}-normal.woff2`);
    for (const f of FACES) {
      const res = await a.request.get(`${APP}${f}`);
      assert.equal(res.status(), 200, f);
      assert.equal(res.headers()['cache-control'], 'public, max-age=31536000, immutable', f);
    }
    const loads = async () => a.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('.woff2')).map((r) => ({ name: new URL(r.name).pathname, transfer: r.transferSize })));
    for (const url of ['/vaje', `/vaje/${catalog.exercises[0].id}`, '/admin']) {
      await a.goto(`${APP}${url}`);
      // the text font is announced in the head, before the style sheet, the way the browser needs it (crossorigin)
      const links = await a.$$eval('head link[rel=preload][as=font]', (ls) => ls.map((l) => [new URL(l.href).pathname, l.type, l.crossOrigin]));
      assert.deepEqual(links.map((l) => l[0]), FACES, url);
      assert.ok(links.every((l) => l[1] === 'font/woff2' && l[2] === 'anonymous'), url);
      const order = await a.$$eval('head link[rel=preload][as=font], head link[rel=stylesheet][href*="fonts.css"]', (ls) => ls.map((l) => l.rel));
      assert.equal(order.at(-1), 'stylesheet', `${url}: preloads come before fonts.css`);
      // fonts.css has a version, so it is kept as well (the exercises link it without one in their own file)
      assert.match(await a.getAttribute('head link[href*="fonts.css"]', 'href'), /fonts\.css\?v=/, url);
      // F5: the fonts come from the cache, not from the server
      await a.waitForLoadState('load');
      await a.reload();
      await a.waitForLoadState('load');
      await a.waitForTimeout(300);
      const after = await loads();
      assert.ok(after.length >= 2, `${url}: fonts are used`);
      assert.deepEqual(after.filter((r) => r.transfer !== 0), [], `${url}: no font was fetched again after F5`);
    }
  } finally { await a.context().close(); }
});
