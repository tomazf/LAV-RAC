// The portal as it ships: real content folder, no exercises yet. Login page, roles and the three planned parts.
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
test('no exercises yet: the three parts wait for staff, students see a clear message', async () => {
  const s = await login('Ana Kovač');
  assert.match(await s.textContent('h1'), /Čakaš/);
  assert.match(await s.textContent('.gate-fig'), /Šolski račun = 1[\s\S]*Razred = 0[\s\S]*Vaje = 0/);
  const a = await login('Sara Skrbnik');
  await a.goto(`${APP}/admin/vaje`);
  assert.deepEqual(await a.locator('.group.planned h2').allTextContents(), ['LAV-RAČ2 V pripravi', 'LAV-RAČ3 V pripravi', 'LAV-RAČ4 V pripravi']);
  await a.goto(`${APP}/admin/razredi`);
  await a.fill('#novi', 'R2A');
  await a.click('text=Ustvari razred');
  await a.waitForLoadState();
  await a.goto(`${APP}/ucitelj`);
  await a.locator('tr', { hasText: 'R2A' }).locator('a').first().click();
  await a.waitForURL(/razredi\/\d+/);
  await a.locator('#cakajo label', { hasText: 'Ana Kovač' }).locator('input').check();
  await a.click('text=Dodaj izbrane');
  await a.waitForLoadState();
  await a.goto(`${a.url().replace(/\?.*$/, '')}/vaje`);
  assert.equal(await a.locator('.group.planned').count(), 3);
  await s.goto(`${APP}/vaje`);
  assert.match(await s.textContent('main'), /Učitelj še ni odprl nobene vaje/);
  assert.doesNotMatch(await s.textContent('main'), /V pripravi/);
  await s.context().close();
  await a.context().close();
  assert.deepEqual(errors, []);
});
