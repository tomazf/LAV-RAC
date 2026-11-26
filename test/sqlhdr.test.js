// The buttons that open the SQL sandbox from a chapter: the link in the header and the button under a block of SQL (src/public/js/hdr.js).
// No database is needed: the script runs on a small page that stands in for an exercise.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const SCRIPT = readFileSync(path.join(root, 'src/public/js/hdr.js'), 'utf8');
const SITE = 'http://portal.test';
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const decode = (hash) => {
  const link = new URLSearchParams(hash.replace(/^#/, ''));
  const b64 = link.get('koda').replace(/-/g, '+').replace(/_/g, '/');
  return { code: new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))), db: link.get('baza') };
};

// A page like an exercise: its header, two sets of tasks (E is a matura set), and some blocks of code.
const exercise = (sql) => `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div class="lr-top"><div class="lr-top-in"><span class="lvs-right"><form class="lvs-out"></form></span></div></div>
<section class="page on" id="p1"><div class="lr-kick">sklop A · Osnove</div>
  <pre class="code js-hl">SELECT ime, priimek
FROM dijak
WHERE priimek = 'Čeh';</pre>
  <pre class="code js-hl">FOREIGN KEY (razred) REFERENCES razred (id)</pre>
  <pre class="code js-hl">SELECT ___ FROM dijak;</pre>
  <pre class="code js-hl">SELECT … FROM dijak;</pre>
  <pre class="code">Ana Novak, 4. letnik</pre>
  <pre class="code js-hl">-- vsi imajo razred 4A
UPDATE dijak SET razred = '4A';</pre>
  <pre class="code js-hl">RENAME TABLE t_ucenec TO t_ucenci; SHOW TABLES;</pre>
</section>
<section class="page" id="p2"><div class="lr-kick">sklop E · Matura</div>
  <pre class="code js-hl">SELECT * FROM mFilm;</pre>
</section>
<script>window.__LAVHD=${JSON.stringify({ csrf: 'x', report: false, unseen: 0, exercise: '4.5', year: 4, chapter: '5', notice: '', sql })}</script>
<script>${SCRIPT}</script>
</body></html>`;

async function open(sql) {
  const ctx = await browser.newContext();
  await ctx.route(`${SITE}/**`, (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: url.pathname === '/vaja' ? exercise(sql) : '<!doctype html><title>SQL</title>' });
  });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/vaja`);
  await page.waitForSelector('.hd-btns');
  return { ctx, page };
}

test('sandbox buttons: a chapter without SQL gets none, and neither does a user who may not use the sandbox', async () => {
  const { ctx, page } = await open(null);
  assert.equal(await page.locator('.hd-sql').count(), 0);
  assert.equal(await page.locator('.hd-sqlgo').count(), 0);
  await ctx.close();
});

test('sandbox buttons: the header link opens /sql in its own tab; only whole statements get a button under them', async () => {
  const { ctx, page } = await open({ db: 'sola', sets: { E: 'matura' } });
  const link = page.locator('.lvs-right .hd-sql');
  assert.equal(await link.count(), 1);
  assert.equal(await link.getAttribute('href'), '/sql');
  assert.equal(await link.getAttribute('target'), 'lavrac-sql');
  // Fragments, blanks, an ellipsis and plain text have no button; the statements (also after a comment line) have one.
  assert.equal(await page.locator('.hd-sqlgo').count(), 4);
  assert.equal(await page.locator('pre.code + .hd-sqlbar').count(), 4);
  await ctx.close();
});

test('sandbox buttons: the code travels in the address with the chapter\'s database, a matura set uses its own, and the tab is reused', async () => {
  const { ctx, page } = await open({ db: 'sola', sets: { E: 'matura' } });
  const first = page.waitForEvent('popup');
  await page.locator('#p1 .hd-sqlgo').first().click();
  const tab = await first;
  const a = decode(new URL(tab.url()).hash);
  assert.equal(new URL(tab.url()).pathname, '/sql');
  assert.equal(a.code, "SELECT ime, priimek\nFROM dijak\nWHERE priimek = 'Čeh';");
  assert.equal(a.db, 'sola');

  // The second click goes to the same tab (no new one) and, from a set E, asks for the matura database.
  await page.evaluate(() => { document.getElementById('p1').classList.remove('on'); document.getElementById('p2').classList.add('on'); });
  await page.locator('#p2 .hd-sqlgo').click();
  await tab.waitForFunction(() => location.hash.includes('baza=matura'));
  assert.equal(ctx.pages().length, 2);
  assert.deepEqual(decode(new URL(tab.url()).hash), { code: 'SELECT * FROM mFilm;', db: 'matura' });
  await ctx.close();
});

test('sandbox buttons: a block that the page builds later gets its button, and a chapter on their own database asks for it', async () => {
  const { ctx, page } = await open({ db: 'moja' });
  await page.evaluate(() => {
    const pre = document.createElement('pre');
    pre.className = 'code js-hl';
    pre.textContent = 'CREATE TABLE razred (id INT PRIMARY KEY);';
    document.getElementById('p1').appendChild(pre);
  });
  await page.waitForFunction(() => document.querySelectorAll('.hd-sqlgo').length === 5);
  const popup = page.waitForEvent('popup');
  await page.locator('#p1 .hd-sqlgo').last().click();
  const tab = await popup;
  assert.deepEqual(decode(new URL(tab.url()).hash), { code: 'CREATE TABLE razred (id INT PRIMARY KEY);', db: 'moja' });
  await ctx.close();
});
