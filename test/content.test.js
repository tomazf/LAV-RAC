// The portal as it ships, with its real content: login page, the three parts, and the exercise shell on 2.1.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { chromium } from 'playwright';
import { startMockOidc, TENANT } from './mock-oidc.js';

const DB = process.env.TEST_DATABASE_URL;
if (!DB) { console.error('Set TEST_DATABASE_URL'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const portal = JSON.parse(readFileSync(path.join(root, 'content/portal.json'), 'utf8'));
const APP = 'http://localhost:3102';
let server, mock, browser;
const errors = [];

async function login(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP);
  await page.click('a.btn:text-is("Prijava")');
  await page.click(`a:text-is("${name}")`);
  await page.waitForURL(`${APP}/**`);
  return page;
}
before(async () => {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.end();
  mock = startMockOidc({ port: 9402, clientId: 'c2', clientSecret: 's2' });
  const { CONTENT_DIR, ...env } = process.env;
  server = spawn('node', ['src/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...env, PORT: '3102', DATABASE_URL: DB, PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c2', OIDC_CLIENT_SECRET: 's2', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true', ADMIN_EMAILS: 'admin@sola.test', SESSION_SECRET: 'y'.repeat(40) },
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
});

test('the panel spells the portal name in Windows-1250 bytes', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const outside = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('request', (r) => { if (!r.url().startsWith(APP) && !r.url().startsWith('data:')) outside.push(r.url()); });
  await p.goto(APP);
  assert.equal(await p.title(), `Prijava | ${portal.name}`);
  assert.equal(await p.textContent('h1'), portal.title);
  assert.deepEqual(await p.locator('[data-glyph]').allTextContents(), [...portal.name]);
  assert.deepEqual(await p.locator('[data-hex]').allTextContents(), ['4C', '41', '56', '2D', '52', '41', 'C8']);
  // every lamp agrees with the hex below it
  const lit = await p.evaluate(() => [...document.querySelectorAll('[data-col]')].map((c) => [...c.querySelectorAll('.lamp')].reduce((a, l) => a + (l.getAttribute('aria-pressed') === 'true' ? Number(l.dataset.w) : 0), 0)));
  assert.deepEqual(lit, [0x4c, 0x41, 0x56, 0x2d, 0x52, 0x41, 0xc8]);
  assert.deepEqual(outside, []);
  await ctx.close();
});
test('flipping lamps changes the character, and the name can be restored', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(APP);
  const glyph = (c) => p.textContent(`[data-glyph="${c}"]`);
  const hex = (c) => p.textContent(`[data-hex="${c}"]`);
  assert.equal(await p.locator('[data-reset]').isVisible(), false);
  await p.click('[data-col="1"] [data-w="1"]'); // A 0x41 becomes @ 0x40
  assert.equal(await glyph(1), '@');
  assert.equal(await hex(1), '40');
  assert.equal(await p.locator('[data-reset]').isVisible(), true);
  await p.click('[data-col="6"] [data-w="32"]'); // Č 0xC8 becomes č 0xE8, as in the code table
  assert.equal(await glyph(6), 'č');
  assert.equal(await hex(6), 'E8');
  assert.match(await p.textContent('[data-say]'), /Znak 7: č, desetiško 232, šestnajstiško E8/);
  await p.click('[data-col="3"] [data-w="32"]'); // - 0x2D becomes 0x0D, a control code with nothing to show
  await p.click('[data-col="3"] [data-w="8"]');
  assert.equal(await glyph(3), '·');
  await p.click('[data-reset]');
  assert.deepEqual(await p.locator('[data-glyph]').allTextContents(), [...portal.name]);
  assert.equal(await p.locator('[data-reset]').isVisible(), false);
  await ctx.close();
});
test('one tab stop on the panel: arrows move, space flips, the login comes first', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  assert.equal(await p.locator('.lamp[tabindex="0"]').count(), 1);
  await p.locator('a.btn:text-is("Prijava")').focus();
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Znak 1, bit 128');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Znak 2, bit 64');
  await p.keyboard.press('Space');
  assert.equal(await p.textContent('[data-hex="1"]'), '01');
  assert.equal(await p.locator('.lamp[tabindex="0"]').count(), 1);
  await ctx.close();
});
test('the title breaks in one place only: Laboratorijske vaje, then iz računalništva', async () => {
  for (const width of [320, 360, 768, 1024, 1280, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(APP);
    const lines = await p.evaluate(() => {
      const h1 = document.querySelector('.entry h1');
      const text = h1.firstChild;
      const out = [];
      let top = null;
      for (let i = 0; i < text.length; i++) {
        const r = document.createRange();
        r.setStart(text, i);
        r.setEnd(text, i + 1);
        const t = Math.round(r.getBoundingClientRect().top);
        if (t !== top) { out.push(''); top = t; }
        out[out.length - 1] += text.data[i];
      }
      return out.map((l) => l.replace(/\u00a0/g, ' ').trim());
    });
    assert.deepEqual(lines, ['Laboratorijske vaje', 'iz računalništva'], `at ${width}px`);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width}px`);
    await ctx.close();
  }
});
test('the page fits a phone with no sideways scrolling, in both colour schemes', async () => {
  for (const colorScheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme });
    const p = await ctx.newPage();
    await p.goto(APP);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), colorScheme);
    assert.ok(await p.locator('a.btn:text-is("Prijava")').isVisible());
    const lamp = await p.locator('.lamp').first().boundingBox();
    assert.ok(lamp.width >= 29, `lamps can be tapped (${lamp.width})`);
    await ctx.close();
  }
});
let classUrl = null;
test('parts without exercises wait for staff; a closed class shows a clear message', async () => {
  const s = await login('Ana Kovač');
  assert.match(await s.textContent('h1'), /Čakaš/);
  assert.match(await s.textContent('.gate-fig'), /Šolski račun = 1[\s\S]*Razred = 0[\s\S]*Vaje = 0/);
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/admin/vaje`);
  assert.deepEqual(await a.locator('.group.planned h2').allTextContents(), ['LAV-RAČ4 V pripravi']);
  // the empty 4th chapter of LAV-RAČ2 has its place
  assert.deepEqual(await a.locator('.planned-ex td:first-child').allTextContents(), ['4 V pripravi']);
  await a.goto(`${APP}/admin/razredi`);
  // a class needs its year, also when the form is sent by hand
  const csrf = await a.inputValue('form[action="/admin/razredi"] input[name=_csrf]');
  const bare = await a.request.post(`${APP}/admin/razredi`, { form: { _csrf: csrf, name: 'Brez letnika' } });
  assert.match(decodeURIComponent(bare.url()), /Izberi letnik razreda/);
  await a.fill('#novi', 'R2A');
  await a.selectOption('#novi-letnik', '2');
  await a.click('text=Ustvari razred');
  await a.waitForLoadState();
  await a.goto(`${APP}/ucitelj`);
  await a.locator('tr', { hasText: 'R2A' }).locator('a').first().click();
  await a.waitForURL(/razredi\/\d+/);
  classUrl = a.url().replace(/\?.*$/, '');
  for (const name of ['Ana Kovač', 'Bor Novak']) {
    const b = await login(name);
    await b.context().close();
  }
  await a.goto(classUrl);
  for (const name of ['Ana Kovač', 'Bor Novak']) await a.locator('#cakajo label', { hasText: name }).locator('input').check();
  await a.click('text=Dodaj izbrane');
  await a.waitForLoadState();
  await s.goto(`${APP}/vaje`);
  assert.match(await s.textContent('main'), /Učitelj še ni odprl nobene vaje/);
  assert.doesNotMatch(await s.textContent('main'), /V pripravi/);
  await a.goto(`${classUrl}/vaje`);
  await a.locator('input[name=visible]').first().check();
  await a.waitForURL(/vaje#vaja-2\.1$/);
  await s.goto(`${APP}/vaje`);
  assert.match(await s.textContent('main'), /Številski sistemi, kodiranje in pariteta/);
  assert.doesNotMatch(await s.textContent('main'), /V pripravi/);
  await a.goto(`${classUrl}/vaje`);
  assert.equal(await a.locator('.planned-ex').count(), 1);
  // chapters count from 1 within each year; the technical id stays in the address
  assert.equal(await s.locator('h3:has-text("Številski sistemi") .ex-no').textContent(), '1');
  assert.match(await s.textContent('main a.btn.big'), /^Začni vajo 1: Številski sistemi/);
  assert.match(await s.locator('h3:has-text("Številski sistemi") a').getAttribute('href'), /\/vaje\/2\.1$/);
  // the rows have no buttons (agreed 10. 11. 2026): the title is the link, only the top button stays
  assert.equal(await s.locator('.rail .btn').count(), 0);
  await a.goto(classUrl);
  assert.deepEqual(await a.locator('thead th a').allTextContents(), ['1', '2', '3']);
  await s.context().close();
  await a.context().close();
});

// ---------- exercise shell on 2.1 ----------
const EX = `${APP}/vaje/2.1`;
const catalog = JSON.parse(readFileSync(path.join(root, 'content/catalog.json'), 'utf8'));
const ex21 = catalog.exercises.find((e) => e.id === '2.1');
const card = (p) => p.locator('.page.on .lr-task:not(.lr-off)');
// Paging follows the address, which the browser reports a moment after a click.
const at = (p, hash) => p.waitForFunction((h) => {
  const [id, n] = h.split('/');
  if (location.hash !== '#' + h || document.querySelector('.page.on')?.id !== id) return false;
  return !n || document.querySelector('.page.on .lr-num[aria-current=step]')?.textContent === n;
}, hash);
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await at(p, hash); };
// The first tasks of set A ask to switch bits on for a number; this sets the right bits.
async function setBits(p, wrong) {
  const q = await card(p).locator('.qtext').textContent();
  const n = Number(q.match(/število (\d+)/)[1]) ^ (wrong ? 1 : 0);
  const bits = card(p).locator('button.bit');
  for (let k = 0; k < 8; k++) if (n & (128 >> k)) await bits.nth(k).click();
}
async function readAll(p) {
  for (const id of ex21.gate) await go(p, id);
}
async function progressRow(name) {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const r = (await db.query(`SELECT p.* FROM progress p JOIN users u ON u.id=p.user_id WHERE u.name=$1 AND p.exercise_id='2.1'`, [name])).rows[0];
  await db.end();
  return r;
}
async function settled(p) {
  await p.waitForFunction(() => /Shranjeno/.test(document.querySelector('.lvs-status')?.textContent || ''), null, { timeout: 5000 });
}

test('the page icon is everywhere: portal pages, exercise pages and /favicon.ico', async () => {
  const r = await fetch(`${APP}/favicon.ico`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /icon/);
  const ico = Buffer.from(await r.arrayBuffer());
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const id of ['2.1', '2.2', '2.3']) assert.match(readFileSync(path.join(root, `content/exercises/${id}.html`), 'utf8'), /<link rel="icon" href="\/favicon\.ico"/);
  const login = await (await fetch(APP)).text();
  assert.match(login, /<link rel="icon" href="\/favicon\.ico"/);
});

test('the built exercise carries the current shell and nothing from outside', async () => {
  const html = readFileSync(path.join(root, 'content/exercises/2.1.html'), 'utf8');
  assert.ok(html.includes(readFileSync(path.join(root, 'content/shell/vaja.js'), 'utf8').trim().slice(0, 4000)), 'run npm run import after changing the shell');
  assert.ok(html.includes(readFileSync(path.join(root, 'content/shell/vaja.css'), 'utf8').trim()), 'run npm run import after changing the shell');
  assert.doesNotMatch(html, /fonts\.googleapis|Function\(|eval\(/);
  assert.equal(ex21.module, 'LAV-RAČ2');
  assert.equal(ex21.tasks.length, 99);
  assert.equal(ex21.pages.filter((x) => x.chapter === 'Teorija').length, ex21.gate.length + 1);
});

test('»Vse vaje« and »Odjava« sit in the exercise header, which stays on screen when scrolling', async () => {
  const p = await login('Ana Kovač');
  await p.goto(EX);
  await p.waitForSelector('.lr-top-in .lvs-back');
  // the portal's links merge into the shell header (agreed 10. 11. 2026): no separate dark bar above it
  assert.equal(await p.locator('.lvs-bar').count(), 0);
  assert.equal(await p.locator('.lr-top-in .lvs-back').textContent(), '‹ Vse vaje');
  assert.match(await p.locator('.lr-top-in .lvs-back').getAttribute('href'), /^\/vaje$/);
  assert.equal(await p.locator('.lr-top-in .lvs-out button').textContent(), 'Odjava');
  const top = await p.evaluate(() => {
    const t = document.querySelector('.lr-top-in');
    const s = getComputedStyle(t.parentElement);
    return { first: t.firstElementChild.className, last: t.lastElementChild.className, position: s.position, top: s.top };
  });
  assert.equal(top.first, 'lvs-back');
  assert.equal(top.last, 'lvs-right');
  assert.equal(top.position, 'sticky');
  assert.equal(top.top, '0px');
  // scrolled to the bottom, the header still starts at the top of the screen
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.equal(await p.evaluate(() => document.querySelector('.lr-top').getBoundingClientRect().top), 0);
  // existing parts stay: title, progress and the reset button
  assert.match(await p.textContent('.lr-top .lr-name'), /Številski sistemi/);
  assert.ok(await p.locator('.lr-top #resetBtn').isVisible());
  await p.context().close();
  assert.deepEqual(errors, []);
});

test('overview lists the parts; the tasks open only after every theory page', async () => {
  const p = await login('Ana Kovač');
  const outside = [];
  p.on('request', (r) => { if (!r.url().startsWith(APP)) outside.push(r.url()); });
  await p.goto(EX);
  assert.equal(await p.locator('.page.on').getAttribute('id'), 'pregled');
  assert.deepEqual(await p.locator('.lr-tile .lr-tt').allTextContents(), ['Pretvorbe', 'Računanje', 'Kodiranje', 'Pariteta', 'Vaje']);
  assert.ok(await p.locator('.lr-tile-vaje.locked').isVisible());
  assert.deepEqual(await p.locator('.lr-grp b').allTextContents(), ['Pretvorbe', 'Računanje', 'Kodiranje', 'Pariteta', 'Vaje']);
  await go(p, 'naloge-a');
  assert.ok(await p.locator('.page.on .lr-locked').isVisible());
  assert.ok(await p.locator('.page.on .lr-setbody').isHidden());
  assert.match(await p.textContent('.page.on .lr-locked'), new RegExp(`Ostalo jih je še ${ex21.gate.length}`));
  // a tile takes you to the first page of its part, which then counts as read
  await go(p, 'pregled');
  await p.click('.lr-tile[data-tile=kodiranje]');
  await at(p, 'bcd');
  assert.equal(await p.locator('.page.on').getAttribute('id'), 'bcd');
  assert.match(await p.textContent('.page.on .lr-count'), /Razlaga 11 \/ 17/);
  await readAll(p);
  await go(p, 'naloge-a');
  assert.ok(await p.locator('.page.on .lr-locked').isHidden());
  assert.equal(await p.locator('.page.on .lr-num').count(), 34);
  assert.equal(await p.locator('.page.on .lr-task:not(.lr-off)').count(), 1);
  await settled(p);
  assert.deepEqual((await progressRow('Ana Kovač')).state.seen.sort(), [...ex21.gate, 'pregled'].filter((x) => x !== 'pregled').sort());
  assert.deepEqual(outside, []);
  await p.context().close();
});

test('one answer per task: right, wrong, with a hint, and the solution', async () => {
  const p = await login('Ana Kovač');
  await p.goto(`${EX}#naloge-a/1`);
  assert.match(await card(p).locator('.tnum').textContent(), /Naloga 1 od 34/);
  // nothing switched on is not an answer yet
  await card(p).locator('.lr-check').click();
  assert.match(await card(p).locator('.lr-left .feedback').textContent(), /Najprej/);
  assert.equal(await card(p).getAttribute('data-lr'), 'open');
  await setBits(p, false);
  await card(p).locator('.lr-check').click();
  assert.equal(await card(p).getAttribute('data-lr'), 'ok');
  assert.ok(await card(p).locator('.lr-check').isDisabled());
  assert.ok(await card(p).locator('button.bit').first().isDisabled());
  // task 2: a hint halves the points
  await p.click('.page.on .lr-next');
  await at(p, 'naloge-a/2');
  assert.match(await card(p).locator('.tnum').textContent(), /Naloga 2 od 34/);
  assert.match(await card(p).locator('.lr-hint').textContent(), /−50 %|Namig/);
  await card(p).locator('.lr-hint').click();
  await setBits(p, false);
  await card(p).locator('.lr-check').click();
  assert.equal(await card(p).getAttribute('data-lr'), 'half');
  assert.match(await card(p).locator('.lr-left .feedback').textContent(), /z namigom: 0,5 točke/);
  // task 3: wrong is locked with 0 points
  await p.click('.page.on .lr-num:text-is("3")');
  await at(p, 'naloge-a/3');
  assert.match(await card(p).locator('.qtext').textContent(), /10111₂ v desetiški/);
  await card(p).locator('.lr-q input').first().fill('22');
  await card(p).locator('.lr-check').click();
  assert.equal(await card(p).getAttribute('data-lr'), 'bad');
  // task 4: the solution asks first, then gives 0 points
  await p.click('.page.on .lr-next');
  await at(p, 'naloge-a/4');
  await card(p).locator('.lr-sol').click();
  assert.ok(await card(p).locator('.lr-solask').isVisible());
  assert.ok(await card(p).locator('.sol').isHidden());
  await card(p).locator('.lr-solask button:text-is("Prekliči")').click();
  assert.equal(await card(p).getAttribute('data-lr'), 'open');
  await card(p).locator('.lr-sol').click();
  await card(p).locator('.lr-solask .lr-danger').click();
  assert.equal(await card(p).getAttribute('data-lr'), 'seen');
  assert.ok(await card(p).locator('.sol').isVisible());
  // the help buttons sit on the right, the check on the left
  const check = await card(p).locator('.lr-check').boundingBox();
  const sol = await card(p).locator('.lr-sol').boundingBox();
  assert.ok(sol.x > check.x + 300);
  assert.deepEqual(await p.locator('.page.on .lr-num').evaluateAll((b) => b.slice(0, 5).map((x) => x.dataset.s)), ['ok', 'half', 'bad', 'seen', 'open']);
  assert.match(await p.textContent('#lrPtxt'), /^4 \/ 99 nalog · 1,5 \/ 218 točk$/);
  await settled(p);
  const r = await progressRow('Ana Kovač');
  assert.equal(Number(r.score), 1.5);
  assert.equal(r.done_count, 4);
  assert.equal(r.solution_count, 1);
  await p.context().close();
});

test('another computer continues where the student left off, and locked stays locked', async () => {
  const p = await login('Ana Kovač');
  await p.goto(EX);
  assert.match(await p.textContent('#lrResume'), /Vaje A · Pretvorbe/);
  assert.match(await p.textContent('#lrPtxt'), /^4 \/ 99 nalog · 1,5 \/ 218 točk$/);
  await go(p, 'naloge-a/3');
  assert.equal(await card(p).getAttribute('data-lr'), 'bad');
  assert.ok(await card(p).locator('.lr-check').isDisabled());
  assert.match(await card(p).locator('.lr-left .feedback').textContent(), /Napačno: 0 točk/);
  await p.context().close();
});

test('the server does not count tasks before the theory, even if a page claims so', async () => {
  const p = await login('Bor Novak');
  await p.goto(EX);
  const res = await p.evaluate(async () => {
    const B = window.__LAVELS;
    const r = await fetch('/api/progress/2.1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: B.csrf, attempt: B.attempt, state: { t: { 0: { d: true, p: 1 } }, seen: ['sistemi'] } }) });
    return r.json();
  });
  assert.equal(res.ok, true);
  assert.equal(res.done, 0);
  assert.equal((await progressRow('Bor Novak')).done_count, 0);
  await p.context().close();
});

test('staff see the tasks without reading the theory first', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(`${EX}#naloge-b`);
  assert.ok(await a.locator('.page.on .lr-locked').isHidden());
  assert.equal(await a.locator('.page.on .lr-num').count(), 23);
  // the arrow and the side give the direction, no words; screen readers still get them
  assert.equal(await a.locator('.page.on .lr-pager small').count(), 0);
  assert.match(await a.locator('.page.on .lr-nextp').getAttribute('aria-label'), /^Naprej: /);
  // back sits at the left edge, forward at the right edge
  const bar = await a.locator('.page.on .lr-pager').boundingBox();
  const prev = await a.locator('.page.on .lr-prevp').boundingBox();
  const next = await a.locator('.page.on .lr-nextp').boundingBox();
  assert.ok(Math.abs(prev.x - bar.x) < 2 && Math.abs(next.x + next.width - bar.x - bar.width) < 2);
  await a.context().close();
});

test('the rail: counters at the right edge, a pie of states per set, text hangs under text, Za doma has the next letter; the legend sits right', async () => {
  // The shell on its own, without the portal: the state stays in this browser and nothing is saved on the server.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  let wrapped = false;
  for (const [id, letter] of [['2.1', 'E'], ['2.2', 'G'], ['2.3', 'J'], ['3.1', 'F'], ['3.2', 'H'], ['3.3', 'G'], ['3.4', 'H']]) {
    const ex = catalog.exercises.find((e) => e.id === id);
    await p.goto(pathToFileURL(path.join(root, 'content/exercises', `${id}.html`)).href);
    await p.evaluate((seen) => localStorage.setItem('lavrac_local_' + location.pathname, JSON.stringify({ t: {}, seen })), ex.gate);
    await p.reload();
    await p.waitForSelector('.lr-rail');
    // the sets are lettered A, B, C … and Za doma takes the next letter
    const tags = await p.locator('.lr-rail a.lr-gated .lr-tg').allTextContents();
    assert.deepEqual(tags, [...tags.keys()].map((k) => `${String.fromCharCode(65 + k)} ·`), id);
    assert.equal(tags.at(-1), `${letter} ·`, id);
    assert.equal(await p.locator('.lr-rail a[data-page=doma] .lr-tx').textContent(), 'Za doma');
    assert.match(await p.locator('.lr-tile-vaje li').last().textContent(), new RegExp(`^${letter} · Za doma`), id);
    // Za doma gets its tick once it is opened
    assert.equal(await p.locator('.lr-rail a[data-page=doma]').evaluate((a) => a.classList.contains('seen')), false);
    await go(p, 'doma');
    assert.equal(await p.locator('.lr-rail a[data-page=doma]').evaluate((a) => a.classList.contains('seen')), true);
    assert.equal(await p.textContent('.page.on .lr-kick'), `Vaje · sklop ${letter}`);
    assert.match(await p.locator('.page.on .lr-pager .lr-prevp').getAttribute('aria-label'), /^Nazaj: Vaje /);
    // counters end at the right edge of their row, whatever the name; every text starts in the same column
    const rows = await p.evaluate(() => ({
      gaps: [...document.querySelectorAll('.lr-rail .lr-cnt')].map((c) => Math.round(c.closest('a').getBoundingClientRect().right - c.getBoundingClientRect().right)),
      lefts: [...document.querySelectorAll('.lr-rail .lr-tx')].map((t) => Math.round(t.getBoundingClientRect().left)),
      tall: [...document.querySelectorAll('.lr-rail .lr-tx')].some((t) => t.getBoundingClientRect().height > 1.7 * parseFloat(getComputedStyle(t).lineHeight)),
    }));
    assert.ok(rows.gaps.length > 3);
    assert.equal(new Set(rows.gaps).size, 1, `${id}: counters ${rows.gaps}`);
    assert.equal(new Set(rows.lefts).size, 1, `${id}: text columns ${[...new Set(rows.lefts)]}`);
    wrapped ||= rows.tall;
    // the pie of a set follows the states of its tasks
    const first = await p.evaluate(() => {
      const a = document.querySelector('.lr-rail a.lr-gated');
      return { page: a.dataset.page, i: [...document.querySelectorAll(`#${a.dataset.page} .lr-num`)].map((b) => Number(b.dataset.i)) };
    });
    const link = p.locator(`.lr-rail a[data-page=${first.page}]`);
    assert.equal(await link.getAttribute('title'), `brez odgovora ${first.i.length}`);
    await p.evaluate(([i]) => {
      window.LavRac.answered(i[0], true);
      window.LavRac.hinted(i[1]); window.LavRac.answered(i[1], true);
      window.LavRac.answered(i[2], false, '');
      window.LavRac.solution(i[3]);
    }, [first.i]);
    assert.equal(await link.getAttribute('title'), `pravilno 1, pravilno z namigom 1, napačno 1, ogledana rešitev 1, brez odgovora ${first.i.length - 4}`);
    assert.match(await link.locator('.lr-pie').evaluate((e) => getComputedStyle(e).backgroundImage), /^conic-gradient/);
    assert.equal(await link.locator('.lr-cnt').textContent(), `4/${first.i.length}`);
    // the legend under the task buttons sits at the right, also when it wraps on a phone
    for (const [w, h] of [[1280, 1400], [390, 844]]) {
      await p.setViewportSize({ width: w, height: h });
      await go(p, `${first.page}/1`);
      const l = await p.evaluate(() => {
        const box = document.querySelector('.page.on .lr-legend');
        const right = box.getBoundingClientRect().right;
        const rows = {};
        [...box.children].forEach((c) => { const r = c.getBoundingClientRect(); const k = Math.round(r.top); rows[k] = Math.max(rows[k] || 0, r.right); });
        return { rows: Object.values(rows).map((x) => Math.round(right - x)), room: Math.round(box.children[0].getBoundingClientRect().left - box.getBoundingClientRect().left) };
      });
      assert.ok(l.rows.every((x) => x <= 1), `${id} ${w}px: ${l.rows}`);
      if (w > 900) assert.ok(l.room > 20, `${id}: the legend does not fill the row`);
    }
    await p.setViewportSize({ width: 1280, height: 1400 });
  }
  assert.ok(wrapped, 'a wrapped label was checked');
  await ctx.close();
  assert.deepEqual(errors, []);
});

test('a reset starts a new attempt that the teacher sees; read pages stay read', async () => {
  const p = await login('Ana Kovač');
  await p.goto(EX);
  await p.click('#resetBtn');
  await Promise.all([p.waitForEvent('load'), p.click('#resetYes')]);
  await p.waitForFunction(() => /^0 \/ 99 nalog/.test(document.getElementById('lrPtxt')?.textContent || ''), null, { timeout: 8000 });
  await go(p, 'naloge-a');
  assert.ok(await p.locator('.page.on .lr-locked').isHidden());
  assert.equal(await card(p).getAttribute('data-lr'), 'open');
  const r = await progressRow('Ana Kovač');
  assert.equal(r.attempt, 2);
  assert.equal(r.done_count, 0);
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const resets = (await db.query(`SELECT score, done_count FROM resets WHERE exercise_id='2.1'`)).rows;
  await db.end();
  assert.deepEqual(resets.map((x) => [Number(x.score), x.done_count]), [[1.5, 4]]);
  await p.context().close();
});

test('corrected chapter and topic titles (10. 11. 2026) are the same in the catalog and on the page', async () => {
  const labels = (id) => catalog.exercises.find((e) => e.id === id).pages.map((x) => x.label);
  assert.deepEqual(labels('2.1').slice(1, 5), ['Številski sistemi', 'Desetiško v druge sisteme', 'Drugi sistemi v desetiški', 'Dvojiško, osmiško in šestnajstiško']);
  assert.equal(catalog.exercises.find((e) => e.id === '3.2').title, 'Algoritmi in diagrami poteka');
  assert.ok(labels('3.2').includes('Kako rešiš nalogo?'));
  assert.ok(catalog.exercises.find((e) => e.id === '3.1').tasks.some((t) => t.section === 'Programski jeziki'));
  assert.deepEqual(labels('3.5').slice(1, 7), ['Pogojni stavek IF', 'IF – ELSE in blok stavkov', "Gnezdenje in 'ELSE'", 'Veriga ELSE IF in ?:', 'Stavek switch', 'Pogoste napake']);
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/3.2#pregled`);
  await a.waitForSelector('.lr-top-in');
  assert.match(await a.textContent('.lr-top .lr-name'), /Algoritmi in diagrami poteka/);
  await a.goto(`${APP}/vaje/2.1#pregled`);
  await a.waitForSelector('.lr-rail');
  assert.deepEqual((await a.locator('.lr-rail a.lr-pg .lr-tx').allTextContents()).slice(0, 4), ['Številski sistemi', 'Desetiško v druge sisteme', 'Drugi sistemi v desetiški', 'Dvojiško, osmiško in šestnajstiško']);
  await a.goto(`${APP}/vaje/3.5#gnezdenje`);
  await a.waitForSelector('.page.on h2');
  assert.equal(await a.textContent('.page.on h2'), "Gnezdenje in 'ELSE'");
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('2.2, 2.3 and 3.1 to 3.5: every page opens without errors, with their theory groups', async () => {
  const want = { '2.2': [85, ['Logična vrata', 'Funkcije in poenostavljanje', 'Aritmetična vezja', 'Vaje']], '2.3': [129, ['Podatki in procesor', 'Zbirnik', 'Prekinitve in pomnilniki', 'Vhod, izhod in cevovod', 'Vaje']], '3.1': [52, ['Jezik in prevajanje', 'Orodja, zagon in napake', 'Vaje']], '3.2': [53, ['Algoritem in zapis', 'Gradniki in sled', 'Od diagrama do programa', 'Vaje']], '3.3': [55, ['Program in podatki', 'Izpis in vnos', 'Računanje in potek programa', 'Vaje']], '3.4': [76, ['Tipi in pretvorbe', 'Znaki in nizi', 'Operatorji', 'Vaje']], '3.5': [50, ['Stavek IF', 'Več možnosti', 'Vaje']] };
  for (const [id, [n, groups]] of Object.entries(want)) {
    const ex = catalog.exercises.find((e) => e.id === id);
    assert.equal(ex.module, id.startsWith('3.') ? 'LAV-RAČ3' : 'LAV-RAČ2');
    assert.equal(ex.tasks.length, n);
    if (id !== '2.2') assert.equal(ex.tasks.at(-1).section, 'Ponavljanje'); // the revision set is graded, last among the sets
    const a = await login('Sara Skrbnik');
    await a.goto(`${APP}/vaje/${id}`);
    assert.deepEqual(await a.locator('.lr-grp b').allTextContents(), groups);
    for (const p of ex.pages) {
      await go(a, p.id);
      assert.ok(await a.locator('.page.on').isVisible(), `${id} ${p.id}`);
    }
    // page and task ids stay unique after the shell moves the artifact's sections
    const own = [...ex.pages.map((p) => p.id), ...ex.tasks.map((t) => `t${t.i}`)];
    assert.deepEqual(await a.evaluate((list) => list.filter((x) => document.querySelectorAll(`[id="${x}"]`).length !== 1), own), []);
    await a.context().close();
  }
  assert.deepEqual(errors, []);
});

test('2.1: no subtraction with borrowing; subtraction is addition of the complement with the carries drawn; pages are renumbered', async () => {
  const a = await login('Sara Skrbnik');
  assert.equal(ex21.version, 2);
  assert.equal(ex21.pages.some((x) => x.id === 'odstevanje'), false);
  await a.goto(EX);
  assert.equal(await a.locator('#odstevanje').count(), 0);
  assert.doesNotMatch(await a.locator('.lr-rail').textContent(), /z izposojo/);
  for (const [hash, n] of [['hex', 9], ['okt', 10], ['precna-vzdolzna', 16], ['popravljanje', 17]]) {
    await go(a, hash);
    assert.match(await a.textContent('.page.on .lr-count'), new RegExp(`Razlaga ${n} \\/ 17`), hash);
  }
  await go(a, 'hex');
  const calc = a.locator('.page.on [data-w="calc"]').first();
  const out = calc.locator('.out');
  const text = async () => (await out.textContent()).replace(/\s+/g, ' ');
  // hexadecimal: complement, +1, addition; the carry out of the top column is crossed out
  await calc.locator('[data-o="-"]').click();
  let t = await text();
  assert.doesNotMatch(t, /Izposodiš/);
  assert.match(t, /Komplement do F števila B/);
  assert.match(t, /Komplement do 16: prištej 1/);
  assert.match(t, /Seštej A \+ \(−B\)/);
  assert.match(t, /Prenos čez zgornje mesto zavržeš/);
  assert.match(t, /60 − 47 = 13, rezultat D₁₆ = 13 ✓/);
  assert.equal(await out.locator('ol.stp > li').count(), 4);
  assert.equal(await out.locator('tr.carry b.on').count(), 1);
  assert.equal(await out.locator('tr.carry b.disc').count(), 1);
  assert.equal(await out.locator('tr.carry td.ar.on').count(), 1);
  // binary, A < B: no carry out, the result is read as a complement and written with a minus
  await calc.locator('[data-b="2"]').click();
  await calc.locator('.in.a').fill('1101');
  await calc.locator('.in.b').fill('10110');
  t = await text();
  assert.match(t, /Eniški komplement števila B/);
  assert.match(t, /Dvojiški komplement: prištej 1/);
  assert.match(t, /Prenosa čez zgornje mesto ni/);
  assert.match(t, /Torej A − B = −1001₂/);
  assert.match(t, /13 − 22 = −9, rezultat −1001₂ = −9 ✓/);
  assert.equal(await out.locator('tr.carry b.disc').count(), 0);
  // subtracting zero
  await calc.locator('.in.b').fill('0');
  assert.match(await text(), /Odštevanje ničle števila ne spremeni/);
  // the octal example blocks use the same method
  await go(a, 'okt');
  const oct = a.locator('.page.on [data-w="calc"]').first();
  await oct.locator('[data-o="-"]').click();
  t = (await oct.locator('.out').textContent()).replace(/\s+/g, ' ');
  assert.match(t, /Komplement do 8: prištej 1/);
  assert.match(t, /159 − 125 = 34/);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('2.1: the parity table keeps its structure for a new example and explains the bits; the RAID page walks through parity and recovery; the new RAID task', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(EX);
  await readAll(a);
  await go(a, 'precna-vzdolzna');
  const w = a.locator('.page.on [data-w="pgfill"]');
  const cells = () => w.locator('tbody.tb tr').evaluateAll((rs) => rs.map((r) => r.children.length));
  // NOVO: one labelled row per character, the same number of cells in every row, the last row labelled too
  assert.deepEqual(await w.locator('tbody.tb td.lb').allTextContents(), ['N = 78', 'O = 79', 'V = 86', 'O = 79', 'paritetni bit']);
  assert.deepEqual(await cells(), [9, 9, 9, 9, 9]);
  assert.match(await w.locator('.pgwhy').textContent(), /Od kod so enice in ničle\?[\s\S]*ASCII[\s\S]*78₁₀ = 1001110₂/);
  assert.match(await w.locator('.pgwhy').textContent(), /Zakaj sploh računamo paritetne bite\?[\s\S]*popravi/);
  // a new random example is a new word, not a broken table
  for (let k = 0; k < 4; k++) {
    await w.locator('[data-a="new"]').click();
    const labels = await w.locator('tbody.tb td.lb').allTextContents();
    assert.equal(labels.length, 5);
    assert.match(labels[0], /^[A-Z] = \d+$/);
    assert.equal(labels.at(-1), 'paritetni bit');
    assert.deepEqual(await cells(), [9, 9, 9, 9, 9]);
    assert.equal(await w.locator('.pf').count(), 12);
    assert.match(await w.locator('.pgwhy').textContent(), new RegExp(`Pri znaku ${labels[0][0]} je koda ${labels[0].split('= ')[1]}`));
  }
  // check: empty fields are not right, the solution fills everything in
  await w.locator('[data-a="check"]').click();
  assert.match(await w.locator('.res').textContent(), /Pravilnih je \d+ od 12/);
  await w.locator('[data-a="sol"]').click();
  assert.equal(await w.locator('.pf.ok').count(), 12);
  await w.locator('[data-a="clr"]').click();
  assert.equal(await w.locator('.pf:not(:empty)').count(), 0);
  // the helper buttons are outlined: a visible border and a card background
  for (const sel of ['[data-a="sol"]', '[data-a="clr"]']) {
    const st = await w.locator(sel).evaluate((b) => { const c = getComputedStyle(b); return { w: c.borderTopWidth, s: c.borderTopStyle, bg: c.backgroundColor }; });
    assert.equal(st.w, '1px', sel);
    assert.equal(st.s, 'solid', sel);
    assert.notEqual(st.bg, 'rgba(0, 0, 0, 0)', sel);
  }
  // RAID: P step by step, then a failed disk and the rebuild
  await go(a, 'popravljanje');
  const r = a.locator('.page.on .raid');
  assert.deepEqual(await r.locator('tbody th').allTextContents(), ['Disk 1', 'Disk 2', 'Disk 3', 'Disk P (paritetni)']);
  assert.equal(await r.locator('.bt.q').count(), 8);
  await r.locator('[data-a="next"]').click();
  assert.match(await r.locator('.rline').textContent(), /Stolpec 1: 1 XOR 0 XOR 1 = 0/);
  assert.equal(await r.locator('.bt.q').count(), 7);
  await r.locator('[data-a="all"]').click();
  assert.match(await r.locator('.rline').textContent(), /P = 10110010 XOR 01101100 XOR 11100101 = 00111011\. Vsi diski delujejo/);
  assert.ok(await r.locator('[data-a="next"]').isDisabled());
  await r.locator('[data-ph="2"]').click();
  assert.match(await r.locator('.rline').textContent(), /Disk 2 je odpovedal/);
  assert.equal(await r.locator('tbody tr.dead').count(), 1);
  assert.equal(await r.locator('.bt.lost').count(), 8);
  await r.locator('[data-a="next"]').click();
  assert.match(await r.locator('.rline').textContent(), /Disk 1 XOR Disk 3 XOR Disk P = 1 XOR 1 XOR 0 = 0/);
  await r.locator('[data-a="all"]').click();
  assert.match(await r.locator('.rline').textContent(), /Disk 2 = 01101100\. Enako kot pred odpovedjo/);
  await r.locator('[data-f="3"]').click();
  await r.locator('[data-a="all"]').click();
  assert.match(await r.locator('.rline').textContent(), /Disk P = 00111011/);
  assert.match(await r.locator('.rnote').textContent(), /B = A XOR C XOR P/);
  assert.doesNotMatch(await r.textContent(), /⊕/);
  // the new task: rebuild the failed disk (2 points, the answer keeps its leading zeros)
  const task = ex21.tasks.find((x) => /RAID 5/.test(x.q));
  assert.equal(task.section, 'Pariteta');
  assert.equal(task.max, 2);
  const pos = ex21.tasks.filter((x) => x.section === 'Pariteta').indexOf(task) + 1;
  await go(a, `naloge-d/${pos}`);
  assert.deepEqual(await card(a).locator('table.al th').allTextContents(), ['Disk 1', 'Disk 2', 'Disk 3', 'Disk P']);
  assert.equal(await card(a).locator('table.al tr').nth(1).locator('td').allTextContents().then((c) => c.join('')), '????????');
  await card(a).locator('input[data-f]').fill('');
  await card(a).locator('.lr-check').click();
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /Najprej/);
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await card(a).locator('input[data-f]').fill('10010110');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('the helper buttons of 2.2 and of the Java exercises are outlined', async () => {
  const a = await login('Sara Skrbnik');
  for (const [id, sel] of [['2.2', '.js-gclr'], ['3.1', '.js-restore'], ['3.2', '.js-restore'], ['3.3', '.js-restore']]) {
    await a.goto(`${APP}/vaje/${id}`);
    await a.waitForSelector('.lr-rail');
    const st = await a.locator(sel).first().evaluate((b) => { const c = getComputedStyle(b); return { w: c.borderTopWidth, s: c.borderTopStyle, bg: c.backgroundColor }; });
    assert.equal(st.w, '1px', `${id} ${sel}`);
    assert.equal(st.s, 'solid', `${id} ${sel}`);
    assert.notEqual(st.bg, 'rgba(0, 0, 0, 0)', `${id} ${sel}`);
  }
  await a.context().close();
});

test('2.2: the title is "Logične funkcije"; every symbol is IEC, the ANSI/IEEE ones only appear in the comparison table of the introduction', async () => {
  const ex = catalog.exercises.find((e) => e.id === '2.2');
  assert.equal(ex.title, 'Logične funkcije');
  assert.doesNotMatch(JSON.stringify([ex.title, ex.fullTitle]), /utrjevanje/);
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/2.2#pregled`);
  await at(a, 'pregled');
  assert.match(await a.textContent('.lr-top'), /Logične funkcije/);
  assert.doesNotMatch(await a.textContent('.lr-top'), /utrjevanje/);
  await go(a, 'vrata1');
  const page = a.locator('.page.on');
  assert.match(await page.textContent(), /Obstajata dva sistema simbolov[\s\S]*IEC[\s\S]*ANSI\/IEEE/);
  // comparison table: seven gates, IEC rectangles next to the ANSI shapes
  const cmp = page.locator('[data-w="symcmp"]');
  assert.equal(await cmp.locator('tbody tr').count(), 7);
  assert.deepEqual(await cmp.locator('thead th').evaluateAll((h) => h.map((x) => x.firstChild.textContent)), ['Vrata', 'IEC', 'ANSI/IEEE']);
  for (let i = 0; i < 7; i++) {
    const row = cmp.locator('tbody tr').nth(i);
    assert.equal(await row.locator('td').nth(1).locator('svg rect').count(), 1, `IEC row ${i}`);
    assert.equal(await row.locator('td').nth(2).locator('svg rect').count(), 0, `ANSI row ${i}`);
  }
  // the gate laboratory, the tasks that show a gate, the circuits and the De Morgan symbols: rectangles with a label, no ANSI shapes
  const ansi = /A19 19|Q40 6|L50 25/;
  await go(a, 'vrata2');
  assert.equal(await page.locator('[data-w="gates2"] svg rect').count(), 1);
  await go(a, 'demorgan');
  assert.ok(await page.locator('text.gl').count() > 4);
  await go(a, 'sestevalnik');
  assert.ok(await page.locator('text.gl').count() >= 4);
  await go(a, 'odstevalnik');
  assert.ok(await page.locator('text.gl').count() >= 3);
  for (const id of ['vrata2', 'zapis', 'veitch', 'demorgan', 'sestevalnik', 'odstevalnik', 'naloge-a', 'naloge-e', 'naloge-f']) {
    await go(a, id);
    const html = await page.innerHTML();
    assert.doesNotMatch(html, ansi, id);
  }
  // A1: the figure of a gate in a task is a modest rectangle
  await go(a, 'naloge-a/1');
  const fig = card(a).locator('.vfig svg.g');
  assert.equal(await fig.locator('rect').count(), 1);
  assert.equal(await fig.locator('text').textContent(), '&');
  const box = await fig.boundingBox();
  assert.ok(box.width <= 200 && box.width >= 100, `gate figure width ${box.width}`);
  // the hints of the first tasks talk about the label in the rectangle, no longer about the shape of the back
  await card(a).locator('.lr-hint').click();
  const hints = await card(a).textContent();
  assert.match(hints, /Poglej izhod: ali ima krožec\?/);
  assert.doesNotMatch(hints, /Ravna zadnja|zaobljen|ukrivljen/);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('2.2: an empty expression is not an answer; 2.3: test runs do not count, handing in does', async () => {
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/2.2#naloge-e`);
  const k = await a.evaluate(() => [...document.querySelectorAll('.page.on .lr-task')].findIndex((c) => c.querySelector('input[data-prev]')));
  await go(a, `naloge-e/${k + 1}`);
  await card(a).locator('.lr-check').click();
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /Najprej/);
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await a.goto(`${APP}/vaje/2.3#naloge-d`);
  await at(a, 'naloge-d');
  const j = await a.evaluate(() => [...document.querySelectorAll('.page.on .lr-task')].findIndex((c) => c.querySelector('.js-run')));
  await go(a, `naloge-d/${j + 1}`);
  assert.equal(await card(a).locator('.lr-left .lr-check').textContent(), 'Oddaj');
  await card(a).locator('.js-run').click();
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /Testi se ne točkujejo/);
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await card(a).locator('.js-run').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'bad');
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /Napačno: 0 točk\. Uspešnih testov/);
  assert.ok(await card(a).locator('.js-run').isDisabled());
  await a.context().close();
});

test('the exercise fits a phone, in both colour schemes', async () => {
  for (const colorScheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme });
    const p = await ctx.newPage();
    await p.goto(APP);
    await p.click('a.btn:text-is("Prijava")');
    await p.click('a:text-is("Ana Kovač")');
    await p.waitForURL(`${APP}/**`);
    for (const hash of ['pregled', 'sistemi', 'naloge-a']) {
      await p.goto(`${EX}#${hash}`);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${colorScheme} ${hash}`);
    }
    assert.ok(await p.locator('#lrSel').isVisible());
    await p.selectOption('#lrSel', 'gray');
    assert.equal(await p.locator('.page.on').getAttribute('id'), 'gray');
    await ctx.close();
  }
  assert.deepEqual(errors, []);
});

test('no theory page of 2.1 and 2.2 is wider than a phone: wide tables scroll inside their frame', async () => {
  const a = await login('Sara Skrbnik');
  await a.setViewportSize({ width: 360, height: 740 });
  for (const id of ['2.1', '2.2']) {
    const ex = catalog.exercises.find((e) => e.id === id);
    await a.goto(`${APP}/vaje/${id}`);
    await a.waitForSelector('.page.on');
    for (const pg of ex.pages.filter((x) => x.chapter === 'Teorija')) {
      await go(a, pg.id);
      const w = await a.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      assert.ok(w.sw <= w.iw + 1, `${id} ${pg.id}: page is ${w.sw}px wide on a ${w.iw}px screen`);
    }
  }
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('the dashboard timeline: the wire runs through the middle of every circle, on whole pixels, on a phone and a desktop, in both colour schemes', async () => {
  // all of the class's exercises open for the check, then put back as they were
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const before = (await db.query('SELECT class_id, exercise_id, visible FROM class_exercises')).rows;
  await db.query('UPDATE class_exercises SET visible = true');
  try {
    await timelineGeometry();
  } finally {
    for (const r of before) await db.query('UPDATE class_exercises SET visible=$3 WHERE class_id=$1 AND exercise_id=$2', [r.class_id, r.exercise_id, r.visible]);
    await db.end();
  }
});
async function timelineGeometry() {
  for (const [width, colorScheme] of [[343, 'light'], [1100, 'light'], [343, 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme });
    const p = await ctx.newPage();
    await p.goto(APP);
    await p.click('a.btn:text-is("Prijava")');
    await p.click('a:text-is("Ana Kovač")');
    await p.waitForURL(`${APP}/**`);
    await p.goto(`${APP}/vaje`);
    const nodes = await p.evaluate(() => [...document.querySelectorAll('.rail .node')].map((n) => {
      const wire = getComputedStyle(n, '::before');
      const dot = getComputedStyle(n, '::after');
      return {
        wire: { left: parseFloat(wire.left), width: parseFloat(wire.width) },
        dot: { left: parseFloat(dot.left), width: parseFloat(dot.width), box: dot.boxSizing, transform: dot.transform },
      };
    }));
    assert.ok(nodes.length >= 3, `${width} ${colorScheme}: nodes`);
    for (const { wire, dot } of nodes) {
      assert.equal(wire.left + wire.width / 2, dot.left + dot.width / 2, `${width} ${colorScheme}: same middle`);
      // a transform would put the circle half a pixel off the wire on some screens; edges stay on whole pixels
      assert.equal(dot.transform, 'none', `${width} ${colorScheme}: no transform`);
      assert.equal(dot.box, 'border-box', `${width} ${colorScheme}: the width is the outer width`);
      assert.ok(Number.isInteger(wire.left) && Number.isInteger(dot.left), `${width} ${colorScheme}: whole pixels`);
    }
    await ctx.close();
  }
}
test('a class works on its year; lower years open for revision; the admin closes the school year', async () => {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const uid = async (oid) => (await db.query('SELECT id FROM users WHERE oid=$1', [oid])).rows[0]?.id;
  const cid = async (name) => (await db.query('SELECT id FROM classes WHERE name=$1', [name])).rows[0]?.id;
  for (const name of ['Cene Zupan', 'Daša Horvat']) await (await login(name)).context().close();
  const a = await login('Sara Skrbnik');
  for (const [name, year] of [['R3A', '3'], ['R4A', '4']]) {
    await a.goto(`${APP}/admin/razredi`);
    await a.fill('#novi', name);
    await a.selectOption('#novi-letnik', year);
    await a.click('text=Ustvari razred');
    await a.waitForLoadState();
  }
  const r3 = await cid('R3A');
  const r4 = await cid('R4A');
  const r2 = await cid('R2A');
  await db.query('INSERT INTO class_members(class_id, user_id) VALUES($1,$2),($3,$4)', [r3, await uid('u-cene'), r4, await uid('u-dasa')]);
  await db.query('INSERT INTO class_teachers(class_id, user_id) SELECT id, $1 FROM classes', [await uid('u-admin')]);

  // 3rd year: nothing of its own yet, and lower years stay hidden until the class may see them
  const c = await login('Cene Zupan');
  assert.match(await c.textContent('main'), /Učitelj še ni odprl nobene vaje/);
  assert.equal(await c.locator('.past-years').count(), 0);
  assert.equal((await c.goto(`${APP}/vaje/2.1`)).status(), 404);
  await a.goto(`${APP}/admin/razredi`);
  const row = a.locator('tr', { has: a.locator(`a[href="/ucitelj/razredi/${r3}"]`) });
  // the lowest year has nothing to look back on; higher years say what opens
  const pastOf = (id) => a.locator('tr', { has: a.locator(`a[href="/ucitelj/razredi/${id}"]`) }).locator('label.switch');
  assert.equal(await pastOf(r2).count(), 0);
  assert.equal((await pastOf(r4).textContent()).trim(), 'vidi 2. in 3. letnik');
  await row.locator('input[name=show_past]').check();
  await row.locator('button:text-is("Shrani")').click();
  await a.waitForLoadState();
  assert.match(await a.textContent('.notice'), /R3A: 3\. letnik, vidi 2\. letnik/);
  await c.goto(`${APP}/vaje`);
  assert.deepEqual(await c.locator('.past-years .ex-no').allTextContents(), ['1', '2', '3']);
  assert.match(await c.textContent('.hello'), /0 od 0 točk/); // lower years are not in this year's totals
  assert.equal((await c.goto(`${APP}/vaje/2.1`)).status(), 200);

  // the teacher sees only the class's year: not its progress in lower years, not their results
  await a.goto(`${APP}/ucitelj/razredi/${r3}`);
  assert.match(await a.textContent('.title-row'), /Vaje razreda \(0 od 5\)/);
  assert.match(await a.textContent('.team'), /3\. letnik, dijaki vidijo tudi 2\. letnik/);
  assert.equal((await a.goto(`${APP}/ucitelj/razredi/${r3}/rezultati/2.1`)).status(), 404);
  assert.doesNotMatch(await (await a.request.get(`${APP}/ucitelj/razredi/${r3}/izvoz.csv`)).text(), /2\.1/);
  await a.goto(`${APP}/ucitelj/razredi/${r3}/vaje`);
  assert.deepEqual(await a.locator('.group h2').allTextContents(), ['LAV-RAČ3 3. letnik']);
  await a.goto(`${APP}/ucitelj/razredi/${r2}/vaje`);
  assert.equal(await a.locator('.ex-table tbody tr:not(.planned-ex)').count(), 3);

  // the end of the school year needs a fresh backup and the typed word
  const anaBefore = (await db.query(`SELECT score, attempt FROM progress WHERE user_id=$1 AND exercise_id='2.1'`, [await uid('u-ana')])).rows[0];
  assert.ok(anaBefore);
  await a.goto(`${APP}/admin/solsko-leto`);
  assert.match(await a.textContent('main'), /prenesi svežo varnostno kopijo/);
  assert.deepEqual((await a.locator('.year-card h3').allTextContents()).map((t) => t.replace('→', '').trim()), ['R4A', 'R3A', 'R2A']);
  assert.match((await a.textContent('.year-sum')).replace(/\s+/g, ' '), /Izbris: 1 razred 4\. letnika, 1 dijak.*Napredovanje: 2 razreda, 3 dijaki, odstranjeni učitelji: 2/);
  // all / none per class, with the count beside
  const r2card = a.locator('.year-card', { hasText: 'R2A' });
  await r2card.locator('button:text-is("nobeden")').click();
  assert.equal(await r2card.locator('[data-count]').textContent(), '0 od 2 označenih');
  await r2card.locator('button:text-is("vsi")').click();
  assert.equal(await r2card.locator('input[type=checkbox]:checked').count(), 2);
  assert.equal(await a.inputValue(`#name_${r3}`), 'R4A');
  assert.equal(await a.inputValue(`#name_${r2}`), 'R3A');
  await a.fill('#potrdi', 'PREHOD');
  await a.click('text=Zaključi šolsko leto');
  await a.waitForLoadState();
  assert.match(await a.textContent('[role=alert]'), /Najprej prenesi svežo varnostno kopijo/);
  assert.ok(await uid('u-dasa'));
  const csrf = await a.inputValue('input[name=_csrf]');
  assert.equal((await a.request.post(`${APP}/admin/kopije/prenesi`, { form: { _csrf: csrf } })).status(), 200);
  await a.goto(`${APP}/admin/solsko-leto`);
  await a.locator('.year-card', { hasText: 'R2A' }).locator('label', { hasText: 'Bor Novak' }).locator('input[type=checkbox]').uncheck();
  await a.fill('#potrdi', 'prehod');
  await a.click('text=Zaključi šolsko leto');
  await a.waitForURL(/admin\/razredi/);
  assert.match(await a.textContent('.notice'), /Izbrisanih dijakov: 1\. Razredov v višjem letniku: 2\. Dijakov brez razreda: 1\./);

  // 4th year gone for good; the others moved up, without teachers, with nothing open, and see lower years
  assert.equal(await uid('u-dasa'), undefined);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM erased_users')).rows[0].n >= 1, true);
  const classes = (await db.query('SELECT id, name, year, show_past FROM classes ORDER BY name')).rows;
  assert.deepEqual(classes, [{ id: r2, name: 'R3A', year: 3, show_past: true }, { id: r3, name: 'R4A', year: 4, show_past: true }]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM class_teachers')).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM class_exercises')).rows[0].n, 0);
  const left = (await db.query('SELECT u.oid FROM class_members m JOIN users u ON u.id=m.user_id ORDER BY u.oid')).rows.map((r) => r.oid);
  assert.deepEqual(left, ['u-ana', 'u-cene']); // Bor stays without a class
  assert.deepEqual((await db.query(`SELECT score, attempt FROM progress WHERE user_id=$1 AND exercise_id='2.1'`, [await uid('u-ana')])).rows[0], anaBefore);
  const ana = await login('Ana Kovač');
  assert.match(await ana.textContent('main'), /Učitelj še ni odprl nobene vaje/);
  assert.deepEqual(await ana.locator('.past-years .ex-no').allTextContents(), ['1', '2', '3']);
  const bor = await login('Bor Novak');
  assert.match(await bor.textContent('h1'), /Čakaš/);
  const log = (await db.query(`SELECT detail FROM audit_log WHERE action='Zaključil šolsko leto'`)).rows;
  assert.deepEqual(log.map((r) => r.detail), ['izbrisanih dijakov 1, izbrisanih razredov 1, razredov v višjem letniku 2, dijakov brez razreda 1']);

  // a second run so soon needs an extra confirmation
  await a.goto(`${APP}/admin/solsko-leto`);
  await a.fill('#potrdi', 'PREHOD');
  await a.click('text=Zaključi šolsko leto');
  await a.waitForLoadState();
  assert.match(await a.textContent('[role=alert]'), /pred kratkim že zaključeno/);
  assert.equal((await db.query('SELECT year FROM classes WHERE id=$1', [r2])).rows[0].year, 3);
  for (const p of [a, c, ana, bor]) await p.context().close();
  await db.end();
  assert.deepEqual(errors, []);
});

test('admin lists: filter row, class for students without one, the log in pages, sorted and cleaned up; cleanup tab', async () => {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const a = await login('Sara Skrbnik');
  // filter first, then search, then the button, in one row
  await a.goto(`${APP}/admin`);
  const order = await a.locator('form.user-filter > *:not([type=hidden])').evaluateAll((els) => els.map((e) => e.className || e.id || e.tagName));
  assert.deepEqual(order.filter((x) => x !== 'sr'), ['sorter', 'q', 'btn ghost']);
  // a student without a class gets one right here (Bor was left without a class at the end of the year)
  await a.click('.sorter a:text-is("brez razreda")');
  assert.deepEqual(await a.locator('tbody td strong').allTextContents(), ['Bor Novak']);
  const bor = (await db.query(`SELECT id FROM users WHERE oid='u-bor'`)).rows[0].id;
  await a.selectOption(`#cl${bor}`, { label: 'R3A (3. letnik)' });
  await a.click('text=Shrani razrede');
  await a.waitForLoadState();
  assert.match(await a.textContent('.notice'), /Dijakov, dodanih v razred: 1\./);
  assert.equal((await db.query('SELECT c.name FROM class_members m JOIN classes c ON c.id=m.class_id WHERE m.user_id=$1', [bor])).rows[0].name, 'R3A');
  assert.equal(await a.locator('tbody tr').count(), 0);
  // deleting inactive students has its own tab
  await a.click('.tabs a:text-is("Čiščenje")');
  assert.equal(await a.locator('#days').count(), 1);
  await a.goto(`${APP}/admin`);
  assert.equal(await a.locator('#days').count(), 0);

  // the log in pages, sorted by any column with Slovenian letters in place
  await db.query(`UPDATE audit_log SET created_at = created_at - interval '6 months'`);
  for (const [i, name] of ['Žan', 'Ana', 'Črt', 'Cvetka'].entries()) {
    await db.query(`INSERT INTO audit_log(actor_name, action, detail, created_at) VALUES($1,'Preizkus',$2, now() - make_interval(days => $3))`, [name, String(i), 70 + i]);
  }
  for (let i = 0; i < 60; i++) await db.query(`INSERT INTO audit_log(actor_name, action, detail) VALUES('Polnilo','Preizkus',$1)`, [String(i)]);
  const total = (await db.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n;
  await a.goto(`${APP}/admin/dnevnik`);
  assert.equal(await a.locator('tbody tr').count(), 20);
  assert.equal((await a.textContent('.list-pager .dim')).trim(), `1–20 od ${total}`);
  // page sizes on offer: 10, 20 (the default) and 50 (agreed 10. 11. 2026)
  assert.deepEqual(await a.locator('.list-pager .per a, .list-pager .per [aria-current]').allTextContents(), ['10', '20', '50']);
  await a.click('.list-pager .per a:text-is("10")');
  assert.equal(await a.locator('tbody tr').count(), 10);
  await a.click('.list-pager a[aria-label="Naslednja stran"]');
  assert.equal((await a.textContent('.list-pager .dim')).trim(), `11–20 od ${total}`);
  await a.click('th a:text-is("Kdo")');
  const who = (await a.locator('tbody td:nth-child(2)').allTextContents()).filter((n) => ['Žan', 'Ana', 'Črt', 'Cvetka'].includes(n));
  assert.deepEqual(who, ['Ana', 'Cvetka', 'Črt']); // Žan is further down, on a later page
  assert.equal(await a.getAttribute('th[aria-sort]', 'aria-sort'), 'ascending');
  await a.click('th a:has-text("Kdo")');
  assert.equal(await a.getAttribute('th[aria-sort]', 'aria-sort'), 'descending');
  assert.equal(await a.textContent('tbody tr:first-child td:nth-child(2)'), 'Žan');

  // deleting old entries keeps the last backup and the last end of the school year
  await a.goto(`${APP}/admin/dnevnik`);
  await a.click('summary:text-is("Izbriši stare zapise")');
  await a.selectOption('#months', '2');
  await a.check('.log-clean input[name=confirm]');
  await a.click('.log-clean button:text-is("Izbriši")');
  await a.waitForLoadState();
  const left = (await db.query(`SELECT action, actor_name FROM audit_log WHERE created_at < now() - interval '2 months' ORDER BY action`)).rows;
  assert.deepEqual(left.map((r) => r.action), ['Prenesel varnostno kopijo', 'Zaključil šolsko leto']);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM audit_log WHERE action='Preizkus'`)).rows[0].n, 60); // only the recent ones stay
  assert.match(await a.textContent('.notice'), /Izbrisanih zapisov: \d+\./);
  assert.match(await a.textContent('tbody tr:first-child'), /Izbrisal stare zapise dnevnika.*starejših od 2 mesecev/);
  await a.context().close();
  await db.end();
  assert.deepEqual(errors, []);
});

test('Za doma: two more tasks per chapter, added in the portal, unscored', async () => {
  const want = { '2.1': [9, 'Barve na spletu', 'Prekoračitev v 8 bitih'], '2.2': [8, 'Glasovalna naprava', 'Samo vrata NEALI'], '2.3': [9, 'Naslovni prostor', 'Množenje z 10 s pomiki'] };
  const a = await login('Sara Skrbnik');
  for (const [id, [n, ...titles]] of Object.entries(want)) {
    await a.goto(`${APP}/vaje/${id}`);
    await go(a, 'doma');
    const heads = await a.locator('.page.on .tnum').allTextContents();
    assert.equal(heads.filter((t) => /^D\d+\./.test(t)).length, n, id);
    for (const t of titles) assert.ok(heads.some((h) => h.endsWith(t)), `${id}: ${t}`);
    await a.locator('.page.on article', { hasText: titles[1] }).locator('button:text-is("Prikaži rešitev")').click();
    assert.ok(await a.locator('.page.on article', { hasText: titles[1] }).locator('.sol').isVisible());
  }
  // unscored: the catalog has the same tasks and points as before (3.1 to 3.3 changed on 10. 11. 2026: tasks the student checks have no points)
  assert.deepEqual(catalog.exercises.map((e) => [e.id, e.tasks.length, e.maxPoints]), [['2.1', 99, 218], ['2.2', 85, 164], ['2.3', 129, 237], ['3.1', 52, 75], ['3.2', 53, 61], ['3.3', 55, 83], ['3.4', 76, 83], ['3.5', 50, 58]]);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('3.1: program output is the answer and stays after a reload; an empty blank is not an answer', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.1');
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/3.1#naloge-c`);
  await at(a, 'naloge-c');
  const k = await a.evaluate(() => [...document.querySelectorAll('.page.on .lr-task')].findIndex((c) => c.querySelector('textarea.out') && !c.querySelector('textarea.editor')));
  assert.ok(k >= 0);
  await go(a, `naloge-c/${k + 1}`);
  assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0);
  await card(a).locator('textarea.out').fill('napačen izpis');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'bad');
  await a.reload();
  await at(a, `naloge-c/${k + 1}`);
  assert.equal(await card(a).locator('textarea.out').inputValue(), 'napačen izpis');
  assert.equal(await card(a).getAttribute('data-lr'), 'bad');
  // a blank left empty is not an answer yet
  await a.goto(`${APP}/vaje/3.1#naloge-a`);
  await at(a, 'naloge-a');
  const j = await a.evaluate(() => [...document.querySelectorAll('.page.on .lr-task')].findIndex((c) => c.querySelector('.blank input[type=text]')));
  await go(a, `naloge-a/${j + 1}`);
  await card(a).locator('.lr-check').click();
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /Najprej vpiši odgovor/);
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  // the revision set is the last graded set; no »od 12« from the artifact
  assert.equal(ex.tasks.filter((t) => t.section === 'Ponavljanje').length, 7);
  assert.doesNotMatch(await a.locator('body').innerText(), /od 12/);
  // programs the student writes against a told output are checked by the student: no output field to type, a tick, a free solution
  assert.deepEqual(ex.tasks.filter((t) => t.self).map((t) => t.max), [0, 0]);
  await go(a, 'naloge-c/10');
  assert.equal(await card(a).locator('textarea.out').count(), 0);
  assert.ok(await card(a).locator('textarea.editor').isVisible());
  assert.equal((await card(a).locator('.lr-check').textContent()).trim(), 'Preveril sem');
  assert.match(await card(a).locator('.tags').textContent(), /Sam preveri · brez točk/);
  assert.ok(await card(a).locator('.js-copy').count() > 0, 'the editor keeps its own buttons');
  assert.match(await card(a).textContent(), /Program zaženi v poljubnem okolju \(Eclipse, VS Code, Programiz …\) in primerjaj njegov izpis s pričakovanim/);
  await card(a).locator('.lr-sol').click();
  assert.ok(await card(a).locator('.sol').isVisible(), 'no question before the solution');
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /sam si preveril/);
  assert.match(await a.textContent('#lrPtxt'), / \/ 75 točk$/);
  await go(a, 'naloge-d/11');
  assert.equal(await card(a).locator('textarea.out').count(), 0);
  assert.equal((await card(a).locator('.lr-check').textContent()).trim(), 'Preveril sem');
  // no »Kopiraj kodo« and no »Odpri Programiz« where the teacher took them off
  for (const hash of ['naloge-c/5', 'naloge-c/6', 'naloge-c/9', 'naloge-c/11', 'naloge-c/12', 'naloge-d/9', 'naloge-d/10']) {
    await go(a, hash);
    assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0, hash);
  }
  // Za doma without D3 and D6, numbered again
  await go(a, 'doma');
  assert.deepEqual((await a.locator('.page.on .tnum').allTextContents()).map((t) => t.replace(/\s+/g, ' ')),
    ['D1. Namesti JDK in preveri različico', 'D2. Isti program, različni sistemi', 'D3. Prevajalnik in tolmač s svojimi besedami', 'D4. Shema na papir']);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('3.2: matura labels only and no switch; set E is checked by the student, without points; a code answer keeps program and output; the revision set is last', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.2');
  const a = await login('Sara Skrbnik');
  // a label set chosen on an earlier visit (the artifact kept it) is ignored
  await a.addInitScript(() => { try { localStorage.setItem('java-matura-diagram-lang', 'en'); } catch (e) { /* none */ } });
  await a.goto(`${APP}/vaje/3.2#naloge-d/9`);
  await at(a, 'naloge-d/9');
  assert.equal(await a.locator('.js-lang, .langsw').count(), 0);
  const fig = card(a).locator('.fig svg');
  assert.match(await fig.textContent(), /začetek.*preberi x.*izpiši.*konec/);
  assert.doesNotMatch(await fig.textContent(), /Main|Input|Output/);
  await go(a, 'sled');
  assert.match(await a.locator('.page.on [data-fc=sum] svg').textContent(), /začetek/);
  // set E: 15 tasks, none with points; the whole chapter has 61 points left
  const setE = ex.tasks.filter((t) => t.section === 'Narišem diagram poteka');
  assert.equal(setE.length, 15);
  assert.ok(setE.every((t) => t.self && t.max === 0));
  assert.equal(ex.maxPoints, 61);
  await go(a, 'naloge-e');
  assert.match(await a.locator('.page.on .lr-shead p').textContent(), /Flowgorithm.*testnih primerih z znanim rezultatom.*Točk ni/);
  assert.equal((await a.locator('.page.on .lr-legend').textContent()).trim(), 'sam preveril (brez točk)');
  // E1 is a worked example: its solution is open from the start, and the known results replace the inputs
  await go(a, 'naloge-e/1');
  assert.ok(await card(a).locator('.sol').isVisible());
  assert.match(await card(a).locator('.sol .fig svg').textContent(), /začetek.*preberi a, b.*izpiši a \+ b/);
  assert.match(await card(a).locator('.tags').textContent(), /Rešen primer/);
  assert.match(await card(a).locator('.lr-tests').textContent(), /13 42/);
  assert.equal(await card(a).locator('.blank input').count(), 0);
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  // the new tasks are in place: E3 (even or odd) and E7 (a product), each with a diagram and a program in its solution
  await go(a, 'naloge-e/3');
  assert.match(await card(a).locator('.q').textContent(), /sodo ali liho/);
  await card(a).locator('.lr-sol').click();
  assert.match(await card(a).locator('.sol .fig svg').textContent(), /n % 2 == 0/);
  assert.match(await card(a).locator('.sol pre.code').textContent(), /Scanner sc/);
  await go(a, 'naloge-e/7');
  assert.match(await card(a).locator('.lr-tests').textContent(), /120/);
  // E4: the solution costs nothing and locks nothing; the tick is the only answer
  await go(a, 'naloge-e/4');
  assert.match(await card(a).locator('.lr-tests').textContent(), /negativno/);
  assert.equal(await card(a).locator('.lr-hint').evaluate((e) => getComputedStyle(e, '::after').content), 'none');
  await card(a).locator('.lr-sol').click();
  assert.ok(await card(a).locator('.sol').isVisible(), 'no question before the solution');
  assert.equal(await card(a).getAttribute('data-lr'), 'open');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  assert.match(await card(a).locator('.lr-left .feedback').textContent(), /sam si preveril/);
  assert.equal(await a.textContent('#lrPtxt'), '1 / 53 nalog · 0 / 61 točk');
  assert.equal(await a.locator('.page.on .lr-num[data-s=self]').count(), 1);
  await a.reload();
  await at(a, 'naloge-e/4');
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  // the artifact's symbol-counting task has no copy / Programiz buttons
  await go(a, 'naloge-e/14');
  assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0);
  // a task that asks for a program keeps the code and the output
  await go(a, 'naloge-f/1');
  await card(a).locator('textarea.editor').fill('public class Main { /* moja koda */ }');
  await card(a).locator('textarea.out').fill('3 2');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  await a.reload();
  await at(a, 'naloge-f/1');
  assert.equal(await card(a).locator('textarea.editor').inputValue(), 'public class Main { /* moja koda */ }');
  assert.equal(await card(a).locator('textarea.out').inputValue(), '3 2');
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  // the revision set is the last graded set; no chapter numbers of the artifact, Za doma starts with its own words
  assert.equal(ex.tasks.filter((t) => t.section === 'Ponavljanje').length, 2);
  await go(a, 'pregled');
  assert.doesNotMatch(await a.locator('body').innerText(), /Poglavje \d+ od 12|RAČ-LAV|aboratorijsk/);
  assert.match(await a.locator('.lr-rules').textContent(), /Sam preveri/);
  await go(a, 'doma');
  assert.match(await a.locator('.page.on .lr-shead p').textContent(), /^Vaje, ki jih narediš na računalniku/);
  // Za doma 6: the solution has the diagram and the program, not only a sentence
  const six = a.locator('.page.on article', { hasText: 'Isti algoritem na štiri načine' });
  await six.locator('.js-s').click();
  assert.match(await six.locator('.sol .fig svg').textContent(), /začetek.*preberi a, b, c.*izpiši p/);
  assert.match(await six.locator('.sol pre.code').textContent(), /double p = \(a \+ b \+ c\) \/ 3\.0;/);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('3.3: matura labels and no switch; blanks typed in the code; tasks without buttons; checked by the student; a code answer keeps program and output; the revision set is last', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.3');
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/3.3#pregled`);
  await at(a, 'pregled');
  // three theory groups, five graded sets, then the revision set, then Za doma with the next letter
  assert.deepEqual(await a.locator('.lr-rail .lr-grp b').allTextContents(), ['Program in podatki', 'Izpis in vnos', 'Računanje in potek programa', 'Vaje']);
  assert.deepEqual([...new Set(ex.tasks.map((t) => t.section))], ['Struktura programa in komentarji', 'Spremenljivke in primitivni tipi', 'Izpis in vnos', 'Aritmetika', 'Prvi stik z vejitvijo in zanko', 'Ponavljanje']);
  assert.equal(ex.tasks.filter((t) => t.section === 'Ponavljanje').length, 10);
  assert.deepEqual(await a.locator('.lr-rail a.lr-gated .lr-tg').allTextContents(), ['A ·', 'B ·', 'C ·', 'D ·', 'E ·', 'F ·', 'G ·']);
  assert.equal((await a.locator('.lr-rail a.lr-gated .lr-tx').last().textContent()).trim(), 'Za doma');
  // no label switch: the diagrams have the matura's labels, in the task that asks for a program from a diagram as in the theory
  assert.equal(await a.locator('.js-lang, .langsw').count(), 0);
  await go(a, 'naloge-e/6');
  const fig = card(a).locator('.fig svg');
  assert.match(await fig.textContent(), /začetek.*n = 6.*izpiši st.*konec/);
  assert.doesNotMatch(await fig.textContent(), /Main|Output/);
  await card(a).locator('textarea.editor').fill('public class Main { /* moja koda */ }');
  await go(a, 'gradniki');
  assert.match(await a.locator('.page.on [data-fc=zap] svg').textContent(), /začetek/);
  // B7 is gone (12 tasks and 83 points are left); the former B12 is B11, its descriptions a list
  assert.equal(ex.tasks.filter((t) => t.section === 'Spremenljivke in primitivni tipi').length, 12);
  assert.equal(ex.maxPoints, 83);
  await go(a, 'naloge-b/11');
  assert.match(await card(a).locator('.q').textContent(), /int stevilo = -999;/);
  assert.deepEqual(await card(a).locator('.lr-q ul.lr-bul li').allTextContents(), ['A – ime spremenljivke', 'B – znakovna vrednost', 'C – celoštevilska vrednost', 'D – poljuben podatkovni tip', 'E – niz', 'F – ključna beseda programskega jezika Java']);
  // B4: the blanks stand in two columns, row by row
  await go(a, 'naloge-b/4');
  const at4 = await card(a).locator('.lr-cols .blank').evaluateAll((e) => e.map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; }));
  assert.equal(at4.length, 4);
  assert.ok(at4[1][0] > at4[0][0] + 100 && at4[1][1] === at4[0][1] && at4[2][1] > at4[0][1] && at4[2][0] === at4[0][0], JSON.stringify(at4));
  // A1, B6 and C8: the blanks are typed in the code itself, not in a list below it
  for (const [hash, n] of [['naloge-a/1', 3], ['naloge-b/6', 5], ['naloge-c/8', 1]]) {
    await go(a, hash);
    assert.equal(await card(a).locator('pre.code input.lr-gap').count(), n, hash);
    assert.equal(await card(a).locator('.blank').count(), 0, hash);
    assert.doesNotMatch(await card(a).locator('pre.code').textContent(), /___/);
  }
  await go(a, 'naloge-a/1');
  const gaps = card(a).locator('pre.code input.lr-gap');
  await gaps.nth(0).fill('class');
  await gaps.nth(1).fill('main');
  await gaps.nth(2).fill(';');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  assert.ok(await gaps.first().isDisabled());
  // the program tasks with a told output (C6, C12, D10) are checked by the student: no output field
  for (const hash of ['naloge-c/6', 'naloge-c/12', 'naloge-d/10']) {
    await go(a, hash);
    assert.equal(await card(a).locator('textarea.out').count(), 0, hash);
    assert.equal((await card(a).locator('.lr-check').textContent()).trim(), 'Preveril sem', hash);
    assert.ok(await card(a).locator('textarea.editor').isVisible(), hash);
  }
  assert.equal(ex.tasks.filter((t) => t.self).length, 3);
  // no copy / Programiz buttons on the listed tasks (B13 became B12); a program task with an editor keeps its own
  for (const hash of ['naloge-a/4', 'naloge-a/5', 'naloge-b/12', 'naloge-c/2', 'naloge-c/3', 'naloge-c/5', 'naloge-c/10', 'naloge-d/3', 'naloge-e/5', 'doma-mat/7']) {
    await go(a, hash);
    assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0, hash);
  }
  await go(a, 'naloge-e/6');
  assert.ok(await card(a).locator('.js-copy').count() > 0);
  // Za doma 5: no buttons, and the worked trace is code
  await go(a, 'doma');
  assert.equal(await a.locator('.page.on .js-c').count(), 0);
  const five = a.locator('.page.on article', { hasText: 'Sled z razhroščevalnikom' });
  await five.locator('.js-s').click();
  assert.match(await five.locator('.sol pre.code').textContent(), /int b = \+\+x \+ a--;\s+\/\/ \+\+x: x = 2/);
  // the answer is the program output; code and output stay after a reload
  await go(a, 'naloge-e/6');
  await card(a).locator('textarea.out').fill('3');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  await a.reload();
  await at(a, 'naloge-e/6');
  assert.equal(await card(a).locator('textarea.editor').inputValue(), 'public class Main { /* moja koda */ }');
  assert.equal(await card(a).locator('textarea.out').inputValue(), '3');
  assert.equal(await card(a).getAttribute('data-lr'), 'ok');
  // no chapter numbers of the artifact, Za doma starts with its own words
  await go(a, 'pregled');
  assert.doesNotMatch(await a.locator('body').innerText(), /Poglavje \d+ od 12|RAČ-LAV|aboratorijsk/);
  await go(a, 'doma');
  assert.match(await a.locator('.page.on .lr-shead p').textContent(), /^Vaje, ki jih narediš na računalniku/);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('3.4: the operator set is split in two, the revision set is last, laboratory exercises are not mentioned, programs with a fixed result are checked by the student, "Kaj izpiše" has no buttons', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.4');
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/3.4#pregled`);
  await at(a, 'pregled');
  assert.deepEqual(await a.locator('.lr-rail .lr-grp b').allTextContents(), ['Tipi in pretvorbe', 'Znaki in nizi', 'Operatorji', 'Vaje']);
  // sets A to F, the revision set G, Za doma H; E keeps the first 23 operator tasks, F has the other 18
  const sections = [...new Set(ex.tasks.map((t) => t.section))];
  assert.deepEqual(sections, ['Območja tipov in prekoračitev', 'Pretvarjanje tipov', 'Znak in ASCII', 'Integer, Double in pretvorba niz ↔ število', 'Operatorji in izrazi', 'Računanje s programi in logični izrazi', 'Ponavljanje']);
  assert.deepEqual(sections.map((n) => ex.tasks.filter((t) => t.section === n).length), [6, 7, 9, 9, 23, 18, 4]);
  assert.deepEqual(await a.locator('.lr-rail a.lr-gated .lr-tg').allTextContents(), ['A ·', 'B ·', 'C ·', 'D ·', 'E ·', 'F ·', 'G ·', 'H ·']);
  assert.equal((await a.locator('.lr-rail a.lr-gated .lr-tx').last().textContent()).trim(), 'Za doma');
  // no laboratory exercises, no chapter numbers of the artifact, no diagram label switch (this chapter has no diagrams)
  assert.doesNotMatch(JSON.stringify(ex), /aboratorij|RAČ-LAV/);
  assert.equal(await a.locator('.js-lang').count(), 0);
  await go(a, 'naloge-f/1');
  assert.match(await card(a).locator('.q').textContent(), /^\s*Program Obrni: napiši program/);
  await go(a, 'naloge-f/7');
  assert.match(await card(a).locator('.q').textContent(), /^\s*Temperatura je 25 °C\./);
  for (const hash of ['pregled', 'naloge-e', 'naloge-f', 'doma-mat', 'doma']) {
    await go(a, hash);
    assert.doesNotMatch(await a.locator('body').innerText(), /Poglavje \d+ od 12|RAČ-LAV|aboratorij/, hash);
  }
  // the programs the student writes with a fixed result (C7, D8, F1-F5, F7-F10, the former laboratory programs) are checked by
  // the student: the code stays (and can be saved), the buttons stay, there is no output field and no points
  const selfNames = ['C7', 'D8', 'F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8', 'F9', 'F10'];
  const nameOf = (t) => String.fromCharCode(65 + sections.indexOf(t.section)) + (ex.tasks.filter((u) => u.section === t.section).indexOf(t) + 1);
  assert.deepEqual(ex.tasks.filter((t) => t.self).map(nameOf), selfNames);
  assert.equal(ex.maxPoints, 83); // 105 points of the artifact minus the 11 programs of 2 points
  await go(a, 'naloge-f/1');
  assert.match(await card(a).locator('.tags').textContent(), /Sam preveri · brez točk/);
  assert.equal(await card(a).locator('textarea.out').count(), 0);
  assert.ok(await card(a).locator('.js-copy').count() > 0);
  assert.match((await card(a).locator('.lr-tests').textContent()).replace(/\s+/g, ' '), /Pravilen izpis za preverjanje\s*4321/);
  await card(a).locator('textarea.editor').fill('public class Main { /* moja koda */ }');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  await a.waitForTimeout(2500);
  await a.reload();
  await at(a, 'naloge-f/1');
  assert.equal(await card(a).locator('textarea.editor').inputValue(), 'public class Main { /* moja koda */ }');
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  // the tasks that only ask for an output have no copy / Programiz buttons (the teacher's first list and, from 10. 11. 2026, all
  // "Kaj izpiše"); E10 shows its statements as code and still has none
  for (const hash of ['naloge-a/2', 'naloge-a/3', 'naloge-b/2', 'naloge-b/3', 'naloge-b/7', 'naloge-c/3', 'naloge-c/8', 'naloge-d/1', 'naloge-d/2', 'naloge-d/6', 'naloge-d/7', 'naloge-e/2', 'naloge-e/3', 'naloge-e/4', 'naloge-e/6', 'naloge-e/7', 'naloge-e/8', 'naloge-e/10', 'naloge-e/11', 'naloge-e/15', 'naloge-e/22', 'naloge-e/23', 'naloge-f/6', 'naloge-f/16', 'doma-mat/4']) {
    await go(a, hash);
    assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0, hash);
  }
  await go(a, 'naloge-e/10');
  assert.match(await card(a).locator('.q pre.code').textContent(), /int a = x\+\+;\s+int b = \+\+x;/);
  // Za doma starts with its own words, and every solution is a program in Java colours
  await go(a, 'doma');
  assert.match(await a.locator('.page.on .lr-shead p').textContent(), /^Vaje, ki jih narediš na računalniku/);
  const homeSols = a.locator('.page.on .js-s');
  assert.equal(await homeSols.count(), 6);
  for (let i = 0; i < 6; i++) await homeSols.nth(i).click();
  assert.equal(await a.locator('.page.on .sol pre.code').count(), 6);
  assert.ok(await a.locator('.page.on .sol pre.code .k, .page.on .sol pre.code .kw').count() > 0);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('3.5: two theory groups, laboratory exercises are not mentioned, set E is "Naloge za utrjevanje", the revision set is last, the diagrams have the matura labels', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.5');
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/vaje/3.5#pregled`);
  await at(a, 'pregled');
  assert.deepEqual(await a.locator('.lr-rail .lr-grp b').allTextContents(), ['Stavek IF', 'Več možnosti', 'Vaje']);
  const sections = [...new Set(ex.tasks.map((t) => t.section))];
  assert.deepEqual(sections, ['Pogoji in stavek IF', 'IF – ELSE, bloki in gnezdenje', 'Veriga ELSE IF in pogojni operator', 'Stavek switch', 'Naloge za utrjevanje', 'Ponavljanje']);
  assert.deepEqual(sections.map((n) => ex.tasks.filter((t) => t.section === n).length), [11, 9, 7, 9, 10, 4]);
  // 82 points of the artifact minus the 11 self-checked programs (B8, B9, E1-E6, E8-E10), which carry no points
  assert.equal(ex.maxPoints, 58);
  const nameOf = (t) => String.fromCharCode(65 + sections.indexOf(t.section)) + (ex.tasks.filter((u) => u.section === t.section).indexOf(t) + 1);
  assert.deepEqual(ex.tasks.filter((t) => t.self).map(nameOf), ['B8', 'B9', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E8', 'E9', 'E10']);
  assert.deepEqual(await a.locator('.lr-rail a.lr-gated .lr-tg').allTextContents(), ['A ·', 'B ·', 'C ·', 'D ·', 'E ·', 'F ·', 'G ·']);
  assert.equal((await a.locator('.lr-rail a.lr-gated .lr-tx').last().textContent()).trim(), 'Za doma');
  // nothing of the laboratory exercises, no chapter numbers of the artifact, no label switch
  assert.doesNotMatch(JSON.stringify(ex), /aboratorij|RAČ-LAV/);
  for (const hash of ['pregled', 'stavek-if', 'veriga', 'naloge-c', 'naloge-e', 'doma-mat', 'doma']) {
    await go(a, hash);
    assert.doesNotMatch(await a.locator('body').innerText(), /Poglavje \d+ od 12|RAČ-LAV|aboratorij/, hash);
  }
  assert.equal(await a.locator('.js-lang, .langsw').count(), 0);
  // the diagram in the theory has the matura's labels
  await go(a, 'veriga');
  const fig = await a.locator('.page.on [data-fc] svg').first().textContent();
  assert.match(fig, /začetek.*preberi tocke.*izpiši "odlicno".*konec/);
  assert.doesNotMatch(fig, /Main|Input|Output/);
  // the tasks that only ask for an output have no copy / Programiz buttons
  for (const hash of ['naloge-a/3', 'naloge-a/11', 'naloge-b/5', 'naloge-c/1', 'naloge-c/2', 'naloge-c/3', 'naloge-c/7', 'naloge-d/1', 'naloge-d/2', 'naloge-d/3', 'naloge-d/4', 'naloge-d/7']) {
    await go(a, hash);
    assert.equal(await card(a).locator('.js-copy, a[href*=programiz]').count(), 0, hash);
  }
  // the former laboratory tasks are ordinary additional tasks; the example that named the lab program is a plain sentence
  await go(a, 'naloge-e/1');
  assert.match(await card(a).locator('.tags').textContent(), /Dodatna/);
  await go(a, 'naloge-c/7');
  await card(a).locator('.lr-sol').click();
  await card(a).locator('.lr-solask .lr-danger').click();
  assert.match(await card(a).locator('.sol').textContent(), /Program z if – else izpiše isto/);
  // a self-checked program: the editor stays (the code can be saved) and keeps its buttons, there is no output
  // field, the correct output is shown for comparison, and the task text no longer asks to paste an output
  await go(a, 'naloge-b/8');
  assert.ok(await card(a).locator('textarea.editor').isVisible());
  assert.ok(await card(a).locator('.js-copy').count() > 0);
  assert.equal(await card(a).locator('textarea.out').count(), 0);
  assert.doesNotMatch(await card(a).textContent(), /[Pp]rilepi/);
  assert.match((await card(a).locator('.lr-tests').textContent()).replace(/\s+/g, ' '), /Pravilen izpis za preverjanje\s*sodo/);
  await go(a, 'naloge-e/1');
  assert.match((await card(a).locator('.lr-tests').textContent()).replace(/\s+/g, ' '), /Pravilen izpis za preverjanje\s*Presek: \(1\.0, 3\.0\)/);
  await go(a, 'naloge-e/6');
  await card(a).locator('textarea.editor').fill('public class Main { /* moja koda */ }');
  await card(a).locator('.lr-check').click();
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  await a.waitForTimeout(2500);
  await a.reload();
  await at(a, 'naloge-e/6');
  assert.equal(await card(a).getAttribute('data-lr'), 'self');
  assert.equal(await card(a).locator('textarea.editor').inputValue(), 'public class Main { /* moja koda */ }');
  // C5 and D9 check the written code as well as the output; a missing part is only a message, the task stays open
  const feedback = async () => (await card(a).locator('.feedback').first().textContent()).trim();
  const submit = async (code, out) => {
    await card(a).locator('textarea.editor').fill(code);
    await card(a).locator('textarea.out').fill(out);
    await card(a).locator('.lr-check').click();
    return [await feedback(), await card(a).getAttribute('data-lr')];
  };
  const sw = (cases, def, brk) => `int dan = 3; String ime;\nswitch (dan) {\n${cases.map((n) => `case ${n}: ime = "d${n}"; ${brk ? 'break;' : ''}`).join('\n')}\n${def ? 'default: ime = "x"; ' + (brk ? 'break;' : '') : ''}\n}\nSystem.out.println(ime);`;
  await go(a, 'naloge-d/9');
  assert.deepEqual(await submit('// stavek switch (dan) { case 1: default: break; }', 'sreda'), ['Najprej zapiši program v okno.', 'open']);
  assert.deepEqual(await submit('int dan = 3; // switch (dan) { case 1: default: break; }', 'sreda'), ['V kodi manjka stavek switch (dan).', 'open']);
  assert.deepEqual(await submit(sw([1, 2, 3, 4, 5, 6, 7], true, false), 'sreda'), ['Vsaka možnost case se mora končati z break, sicer se izvedejo tudi naslednje.', 'open']);
  assert.deepEqual(await submit(sw([1, 2, 3, 4, 5, 6, 7], false, true), 'sreda'), ['Manjka veja default za dan, ki ne obstaja.', 'open']);
  assert.deepEqual(await submit(sw([1, 2, 3, 4, 6, 7], true, true), 'sreda'), ['Manjka oznaka case 5.', 'open']);
  assert.deepEqual(await submit(sw([1, 2, 3, 4, 5, 6, 7], true, true), 'sreda'), ['Pravilno: 3 točke.', 'ok']);
  await go(a, 'naloge-c/5');
  assert.deepEqual(await submit('// if (a > b) x = a;\nString s = "if"; int x = c;', '30'), ['V kodi manjka stavek if.', 'open']);
  assert.deepEqual(await submit('int x; if (a > b) x = a; else x = b > c ? b : c;', '30'), ['V kodi ne sme biti operatorja ?:, nalogo reši s stavkom if.', 'open']);
  assert.deepEqual(await submit('int x; if (a > b && a > c) x = a; else if (b > c) x = b; else x = c;', '30'), ['Pravilno: 2 točki.', 'ok']);
  // Za doma: four tasks, every solution a program in Java colours
  await go(a, 'doma');
  assert.match(await a.locator('.page.on .lr-shead p').textContent(), /^Vaje, ki jih narediš na računalniku/);
  const homeSols = a.locator('.page.on .js-s');
  assert.equal(await homeSols.count(), 4);
  for (let i = 0; i < 4; i++) await homeSols.nth(i).click();
  assert.equal(await a.locator('.page.on .sol pre.code').count(), 4);
  assert.ok(await a.locator('.page.on .sol pre.code .k').count() > 0);
  await a.context().close();
  assert.deepEqual(errors, []);
});

test('a self-checked task counts as done but never as points: the server forces 0, the teacher sees it apart', async () => {
  const ex = catalog.exercises.find((e) => e.id === '3.2');
  const selfIdx = ex.tasks.filter((t) => t.self).map((t) => t.i);
  assert.equal(selfIdx.length, 15);
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  const stud = (await db.query(`SELECT u.id, m.class_id FROM users u JOIN class_members m ON m.user_id=u.id WHERE u.oid='u-ana'`)).rows[0];
  await db.query(`INSERT INTO class_exercises(class_id, exercise_id, visible, sort_order) VALUES($1,'3.2',true,0) ON CONFLICT (class_id, exercise_id) DO UPDATE SET visible=true`, [stud.class_id]);
  const row = async () => (await db.query(`SELECT * FROM progress WHERE user_id=$1 AND exercise_id='3.2'`, [stud.id])).rows[0];
  try {
    // Ana's class is the 3rd year (R3A); she reads the theory and ticks E4
    const c = await login('Ana Kovač');
    await c.goto(`${APP}/vaje/3.2#pregled`);
    await at(c, 'pregled');
    for (const id of ex.gate) await go(c, id);
    await go(c, 'naloge-e/4');
    await card(c).locator('.lr-check').click();
    assert.equal(await card(c).getAttribute('data-lr'), 'self');
    await c.waitForFunction(() => /Shranjeno|0 \/ 61 točk/.test(document.body.textContent));
    await c.waitForTimeout(2500);
    const first = await row();
    assert.equal(Number(first.score), 0);
    assert.equal(first.done_count, 1);
    assert.equal(first.solution_count, 0);
    assert.equal(first.state.t[selfIdx[3]].d, true);
    assert.equal(first.state.t[selfIdx[3]].p, 0);
    assert.deepEqual((await db.query(`SELECT task_index, kind, points::float8 AS points FROM task_events WHERE user_id=$1 AND exercise_id='3.2'`, [stud.id])).rows, [{ task_index: selfIdx[3], kind: 'self', points: 0 }]);
    // a page that claims points (and a seen solution) for another self task gets none
    const res = await c.evaluate(async (i) => {
      const B = window.__LAVELS;
      const r = await fetch('/api/progress/3.2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: B.csrf, attempt: B.attempt, state: { t: { [i]: { d: true, p: 2, sol: true } } } }) });
      return r.json();
    }, selfIdx[4]);
    assert.deepEqual(res, { ok: true, attempt: first.attempt, score: 0, done: 2 });
    const second = await row();
    assert.equal(Number(second.score), 0);
    assert.equal(second.done_count, 2);
    assert.equal(second.solution_count, 0);
    assert.equal(second.state.t[selfIdx[4]].p, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM task_events WHERE user_id=$1 AND exercise_id='3.2' AND kind='self' AND points=0`, [stud.id])).rows[0].n, 2);
    await c.context().close();

    // the teacher: the strip has its own colour, the table says no points, the student page shows a dash
    const a = await login('Sara Skrbnik');
    await a.goto(`${APP}/ucitelj/razredi/${stud.class_id}/rezultati/3.2`);
    assert.equal(await a.locator('.strip-cell .s-self').count(), 2);
    assert.ok(await a.locator('.legend .s-self, .lr-legend .s-self, i.s-self').count() > 0);
    const tasksTable = a.locator('section.block', { has: a.locator('h2:text-is("Naloge")') });
    assert.equal(await tasksTable.locator('.tag:text-is("sam preveri, brez točk")').count(), 15);
    const e4 = tasksTable.locator('tr', { has: a.locator(`td:text-is("${selfIdx[3] + 1}")`) });
    assert.match((await e4.textContent()).replace(/\s+/g, ' '), /sam preveri, brez točk\s*srednja\s*1\s*–\s*0\s*0/);
    assert.match((await a.locator('tbody tr', { has: a.locator('a', { hasText: 'Ana Kovač' }) }).first().textContent()).replace(/\s+/g, ' '), /0 \/ 61/);
    await a.goto(`${APP}/ucitelj/razredi/${stud.class_id}/dijaki/${stud.id}`);
    const rows = a.locator('tr', { has: a.locator('i.dot.s-self') });
    assert.equal(await rows.count(), 2);
    assert.match((await rows.first().textContent()).replace(/\s+/g, ' '), /sam preveril\s*–/);
    await a.context().close();
  } finally {
    await db.end();
  }
  assert.deepEqual(errors, []);
});
