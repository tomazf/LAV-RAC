// Flags (»Opozorila«): answers that look unusual are marked for the teacher, who confirms or dismisses; the student sees only a confirmed one.
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
const APP = 'http://localhost:3104';
const catalog = JSON.parse(readFileSync(path.join(root, 'content/catalog.json'), 'utf8'));
const EX = catalog.exercises.find((e) => e.id === '4.2');
let server, mock, browser, db, flags;
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
const classId = async (name) => (await sql('SELECT id FROM classes WHERE name=$1', [name]))[0].id;

// What a browser sends after answering tasks: the tasks given are all done, right, with their full points.
async function send(p, uid, tasks) {
  await p.goto(`${APP}/vaje/4.2`);
  await p.waitForSelector('.lr-top-in');
  const token = await csrfOf(p);
  const attempt = (await sql('SELECT attempt FROM progress WHERE user_id=$1 AND exercise_id=$2', [uid, '4.2']))[0].attempt;
  const t = {};
  for (const i of tasks) t[i] = { d: true, p: EX.tasks[i].max };
  return p.evaluate(async (b) => (await fetch('/api/progress/4.2', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status,
    { csrf: token, attempt, state: { t, seen: EX.gate } });
}
const flagsOf = (uid) => sql('SELECT * FROM flags WHERE user_id=$1 ORDER BY id', [uid]);

before(async () => {
  Object.assign(process.env, { PUBLIC_URL: APP, OIDC_TENANT_ID: TENANT, OIDC_CLIENT_ID: 'c4', OIDC_CLIENT_SECRET: 's4', ADMIN_EMAILS: 'admin@sola.test', SESSION_SECRET: 'z'.repeat(40), DATABASE_URL: DB });
  flags = await import('../src/flags.js');
  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  mock = startMockOidc({ port: 9404, clientId: 'c4', clientSecret: 's4' });
  const { CONTENT_DIR, ...env } = process.env;
  server = spawn('node', ['src/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...env, PORT: '3104', OIDC_ISSUER: mock.issuer, OIDC_ALLOW_INSECURE: 'true' },
  });
  await new Promise((ok, no) => {
    server.stdout.on('data', (d) => { if (String(d).includes('posluša')) ok(); });
    server.on('exit', (c) => no(new Error(`server exited ${c}`)));
  });
  browser = await chromium.launch();
  for (const n of ['Sara Skrbnik', 'Tomaž Učitelj', 'Ana Kovač', 'Bor Novak', 'Cene Zupan']) await login(n);
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
  assert.deepEqual(errors, []);
});

test('the rules: three tasks in one request, and many tasks in very little time; nothing else', () => {
  const ev = (n, kind = 'correct') => Array.from({ length: n }, (_, i) => ({ task: i, kind, points: 1 }));
  const rules = (x) => flags.evaluate(x).map((f) => f.rule);
  assert.deepEqual(rules({ events: ev(2), tasks: 2, seconds: 0 }), []);
  assert.deepEqual(rules({ events: ev(3), tasks: 3, seconds: 0 }), ['burst']);
  assert.deepEqual(rules({ events: ev(3, 'wrong'), tasks: 0, seconds: 0 }), [], 'wrong answers carry no points');
  assert.deepEqual(rules({ events: ev(3, 'hint'), tasks: 0, seconds: 0 }), []);
  // ten tasks with points: fewer than 5 seconds each on the pages is too fast, exactly 5 is not
  assert.deepEqual(rules({ events: ev(1), tasks: 10, seconds: 49 }), ['fast']);
  assert.deepEqual(rules({ events: ev(1), tasks: 10, seconds: 50 }), []);
  assert.deepEqual(rules({ events: ev(1), tasks: 9, seconds: 0 }), []);
  assert.deepEqual(rules({ events: [], tasks: 20, seconds: 0 }), [], 'nothing was answered in this request');
  assert.deepEqual(rules({ events: ev(4), tasks: 12, seconds: 10 }), ['burst', 'fast']);
  assert.match(flags.describe({ rule: 'burst', detail: { tasks: 4 } }), /^4 nalog/);
});

test('a student who answers one task per request is not flagged; a teacher is never flagged', async () => {
  const bor = pages.get('Bor Novak');
  await bor.goto(`${APP}/vaje/4.2`);
  const uid = await userId('bor.novak@sola.test');
  assert.equal(await send(bor, uid, [0]), 200);
  assert.equal(await send(bor, uid, [0, 1]), 200);
  assert.equal(await send(bor, uid, [0, 1, 2]), 200);
  assert.deepEqual(await flagsOf(uid), []);
  const t = pages.get('Tomaž Učitelj');
  const tid = await userId('ucitelj@sola.test');
  assert.equal(await send(t, tid, [0, 1, 2, 3, 4]), 200);
  assert.deepEqual(await flagsOf(tid), []);
  // the points of the forged request are what they were before: the flag changes nothing
  const p = (await sql('SELECT done_count FROM progress WHERE user_id=$1 AND exercise_id=$2', [tid, '4.2']))[0];
  assert.equal(p.done_count, 5);
});

test('several tasks in one request raise one flag; sending it again does not add another', async () => {
  const ana = pages.get('Ana Kovač');
  const uid = await userId('ana.kovac@sola.test');
  await ana.goto(`${APP}/vaje/4.2`);
  assert.equal(await send(ana, uid, [0, 1, 2, 3]), 200);
  let f = await flagsOf(uid);
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, 'burst');
  assert.equal(f[0].status, 'open');
  assert.deepEqual(f[0].detail, { tasks: 4 });
  assert.equal(await send(ana, uid, [4, 5, 6]), 200);
  f = await flagsOf(uid);
  assert.equal(f.length, 1, 'one flag per rule and attempt');
});

test('a student with ten tasks and no time on the pages raises the flag "too fast"', async () => {
  const bor = pages.get('Bor Novak');
  const uid = await userId('bor.novak@sola.test');
  for (let n = 3; n < 11; n++) await send(bor, uid, Array.from({ length: n }, (_, i) => i).slice(0, n).map((i) => i)); // one task more each time
  const f = await flagsOf(uid);
  assert.deepEqual(f.map((x) => x.rule), ['fast']);
  assert.equal(f[0].detail.tasks, 10);
});

test('the teacher sees the marks and the reasons; the student sees nothing while the flag is open', async () => {
  const t = pages.get('Tomaž Učitelj');
  const r4 = await classId('R4A');
  await t.goto(`${APP}/ucitelj/razredi/${r4}`);
  assert.equal(await t.locator('td.stick .flagmark.open').count(), 2, 'one mark next to each of the two students');
  assert.equal(await t.locator('td.heat .flagmark.open').count(), 2, 'and one in the cell of the exercise');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/rezultati/4.2`);
  assert.equal(await t.locator('.flagmark.open').count(), 2);
  const ana = await userId('ana.kovac@sola.test');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/dijaki/${ana}`);
  const card = t.locator('#opozorila .flag.open');
  assert.equal(await card.count(), 1);
  assert.match(await card.innerText(), /Več nalog naenkrat[\s\S]*4 nalog je dobilo točke v enem samem zahtevku/);
  // the student: no notice in the portal and none in the exercise
  const a = pages.get('Ana Kovač');
  await a.goto(`${APP}/vaje`);
  assert.equal(await a.locator('.notice-warn').count(), 0);
  await a.goto(`${APP}/vaje/4.2`);
  await a.waitForSelector('.lr-top-in .hd-btns');
  assert.equal(await a.locator('.hd-notice').count(), 0);
});

test('the teacher confirms: the student sees the notice at the exercise list and in the exercise; the log has only the number', async () => {
  const t = pages.get('Tomaž Učitelj');
  const r4 = await classId('R4A');
  const ana = await userId('ana.kovac@sola.test');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/dijaki/${ana}`);
  await t.fill('#opozorila input[name=note]', 'Pogovorila sva se.');
  await t.click('#opozorila button[value=potrdi]');
  await t.waitForURL(/sporocilo=/);
  assert.equal((await flagsOf(ana))[0].status, 'confirmed');
  assert.equal((await flagsOf(ana))[0].note, 'Pogovorila sva se.');
  assert.equal((await flagsOf(ana))[0].decided_by, await userId('ucitelj@sola.test'));
  assert.equal(await t.locator('#opozorila .flag.confirmed').count(), 1);
  const log = (await sql(`SELECT action, detail FROM audit_log WHERE action='Potrdil opozorilo'`));
  assert.equal(log.length, 1);
  assert.match(log[0].detail, /^#\d+$/);
  const a = pages.get('Ana Kovač');
  await a.goto(`${APP}/vaje`);
  assert.match(await a.locator('.notice-warn').innerText(), /Opozorilo[\s\S]*pri vaji[\s\S]*Če meniš, da je to napaka, se pogovori z njim/);
  await a.goto(`${APP}/vaje/4.2`);
  await a.waitForSelector('.hd-notice');
  assert.match(await a.locator('.hd-notice').innerText(), /^! Opozorilo:/);
  // the other student's flag is still open, so he sees nothing
  const b = pages.get('Bor Novak');
  await b.goto(`${APP}/vaje`);
  assert.equal(await b.locator('.notice-warn').count(), 0);
});

test('dismissing and opening again; the decision can be turned around', async () => {
  const t = pages.get('Tomaž Učitelj');
  const r4 = await classId('R4A');
  const ana = await userId('ana.kovac@sola.test');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/dijaki/${ana}`);
  await t.click('#opozorila button[value=razveljavi]');
  await t.waitForURL(/sporocilo=/);
  assert.equal((await flagsOf(ana))[0].status, 'dismissed');
  const a = pages.get('Ana Kovač');
  await a.goto(`${APP}/vaje`);
  assert.equal(await a.locator('.notice-warn').count(), 0, 'a dismissed flag is not shown to the student');
  await t.goto(`${APP}/ucitelj/razredi/${r4}`);
  assert.equal(await t.locator('td.stick .flagmark').count(), 1, 'only the other student keeps a mark');
  await t.goto(`${APP}/ucitelj/razredi/${r4}/dijaki/${ana}`);
  await t.click('#opozorila button[value=odpri]');
  await t.waitForURL(/sporocilo=/);
  const f = (await flagsOf(ana))[0];
  assert.equal(f.status, 'open');
  assert.equal(f.decided_by, null);
  assert.equal(f.decided_at, null);
});

test('only the teacher of the class (or the admin) decides; a student and the other class are refused', async () => {
  const r4 = await classId('R4A');
  const r2 = await classId('R2B');
  const ana = await userId('ana.kovac@sola.test');
  const cene = await userId('cene.zupan@sola.test');
  const fid = (await flagsOf(ana))[0].id;
  const post = (p, url, body) => p.evaluate(async ([u, b]) => (await fetch(u, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status, [url, body]);
  const bor = pages.get('Bor Novak');
  await bor.goto(`${APP}/vaje`);
  const token = await csrfOf(bor);
  assert.equal(await post(bor, `/ucitelj/razredi/${r4}/dijaki/${ana}/opozorila/${fid}`, { _csrf: token, akcija: 'razveljavi' }), 403, 'a student');
  assert.equal((await flagsOf(ana))[0].status, 'open');
  // a flag of a student of another class is not reachable through this class
  await sql(`INSERT INTO flags(user_id, exercise_id, attempt, rule, detail) VALUES($1,'2.1',1,'burst','{"tasks":3}')`, [cene]);
  const t = pages.get('Tomaž Učitelj');
  await t.goto(`${APP}/ucitelj/razredi/${r4}`);
  const tt = await csrfOf(t);
  const cf = (await flagsOf(cene))[0].id;
  await post(t, `/ucitelj/razredi/${r4}/dijaki/${cene}/opozorila/${cf}`, { _csrf: tt, akcija: 'potrdi' });
  assert.equal((await flagsOf(cene))[0].status, 'open', 'Cene is not in R4A');
  await post(t, `/ucitelj/razredi/${r4}/dijaki/${ana}/opozorila/${cf}`, { _csrf: tt, akcija: 'potrdi' });
  assert.equal((await flagsOf(cene))[0].status, 'open', 'a flag of another student, named under Ana');
  assert.equal(await post(t, `/ucitelj/razredi/${r2}/dijaki/${cene}/opozorila/${cf}`, { _csrf: tt, akcija: 'potrdi' }), 404, 'a class the teacher has not joined');
  assert.equal((await flagsOf(cene))[0].status, 'open');
  // no token: refused, nothing changes
  await post(t, `/ucitelj/razredi/${r4}/dijaki/${ana}/opozorila/${fid}`, { akcija: 'potrdi' });
  assert.equal((await flagsOf(ana))[0].status, 'open');
  // the admin decides in every class
  const s = pages.get('Sara Skrbnik');
  await s.goto(`${APP}/ucitelj`);
  const st = await csrfOf(s);
  await post(s, `/ucitelj/razredi/${r2}/dijaki/${cene}/opozorila/${cf}`, { _csrf: st, akcija: 'potrdi' });
  assert.equal((await flagsOf(cene))[0].status, 'confirmed');
});

test('deleting a user removes their flags; the privacy page names them', async () => {
  const bor = await userId('bor.novak@sola.test');
  assert.equal((await flagsOf(bor)).length, 1);
  await sql('DELETE FROM users WHERE id=$1', [bor]);
  assert.equal((await sql('SELECT count(*)::int AS n FROM flags WHERE user_id=$1', [bor]))[0].n, 0);
  const s = pages.get('Sara Skrbnik');
  await s.goto(`${APP}/zasebnost`);
  assert.match(await s.locator('main').innerText(), /Opozorila o nenavadnih odgovorih/);
});
