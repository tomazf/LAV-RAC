// The portal as it ships, with its real content: login page, the three parts, and the exercise shell on 2.1.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  assert.deepEqual(await a.locator('.group.planned h2').allTextContents(), ['LAV-RAČ3 V pripravi', 'LAV-RAČ4 V pripravi']);
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
  assert.equal(ex21.tasks.length, 98);
  assert.equal(ex21.pages.filter((x) => x.chapter === 'Teorija').length, ex21.gate.length + 1);
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
  assert.match(await p.textContent('.page.on .lr-count'), /Razlaga 12 \/ 18/);
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
  assert.match(await p.textContent('#lrPtxt'), /^4 \/ 98 nalog · 1,5 \/ 216 točk$/);
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
  assert.match(await p.textContent('#lrPtxt'), /^4 \/ 98 nalog · 1,5 \/ 216 točk$/);
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

test('a reset starts a new attempt that the teacher sees; read pages stay read', async () => {
  const p = await login('Ana Kovač');
  await p.goto(EX);
  await p.click('#resetBtn');
  await Promise.all([p.waitForEvent('load'), p.click('#resetYes')]);
  await p.waitForFunction(() => /^0 \/ 98 nalog/.test(document.getElementById('lrPtxt')?.textContent || ''), null, { timeout: 8000 });
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

test('2.2 and 2.3: every page opens without errors, with their theory groups', async () => {
  const want = { '2.2': [85, ['Logična vrata', 'Funkcije in poenostavljanje', 'Aritmetična vezja', 'Vaje']], '2.3': [129, ['Podatki in procesor', 'Zbirnik', 'Prekinitve in pomnilniki', 'Vhod, izhod in cevovod', 'Vaje']] };
  for (const [id, [n, groups]] of Object.entries(want)) {
    const ex = catalog.exercises.find((e) => e.id === id);
    assert.equal(ex.module, 'LAV-RAČ2');
    assert.equal(ex.tasks.length, n);
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
  assert.match(await a.textContent('.title-row'), /Vaje razreda \(0 od 0\)/);
  assert.match(await a.textContent('.team'), /3\. letnik, dijaki vidijo tudi 2\. letnik/);
  assert.equal((await a.goto(`${APP}/ucitelj/razredi/${r3}/rezultati/2.1`)).status(), 404);
  assert.doesNotMatch(await (await a.request.get(`${APP}/ucitelj/razredi/${r3}/izvoz.csv`)).text(), /2\.1/);
  await a.goto(`${APP}/ucitelj/razredi/${r3}/vaje`);
  assert.deepEqual(await a.locator('.group h2').allTextContents(), ['LAV-RAČ3 V pripravi']);
  await a.goto(`${APP}/ucitelj/razredi/${r2}/vaje`);
  assert.equal(await a.locator('.ex-table tbody tr:not(.planned-ex)').count(), 3);

  // the end of the school year needs a fresh backup and the typed word
  const anaBefore = (await db.query(`SELECT score, attempt FROM progress WHERE user_id=$1 AND exercise_id='2.1'`, [await uid('u-ana')])).rows[0];
  assert.ok(anaBefore);
  await a.goto(`${APP}/admin/solsko-leto`);
  assert.match(await a.textContent('main'), /prenesi svežo varnostno kopijo/);
  assert.deepEqual(await a.locator('.year-class legend strong').allTextContents(), ['R4A', 'R3A', 'R2A']);
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
  await a.locator('.year-class', { hasText: 'R2A' }).locator('label', { hasText: 'Bor Novak' }).locator('input[type=checkbox]').uncheck();
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
  assert.equal(await a.locator('tbody tr').count(), 50);
  assert.equal((await a.textContent('.list-pager .dim')).trim(), `1–50 od ${total}`);
  await a.click('.list-pager .per a:text-is("20")');
  assert.equal(await a.locator('tbody tr').count(), 20);
  await a.click('.list-pager a[aria-label="Naslednja stran"]');
  assert.equal((await a.textContent('.list-pager .dim')).trim(), `21–40 od ${total}`);
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
