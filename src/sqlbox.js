// The SQL sandbox (4th year): a separate MySQL server that only the admin configures, one database and account per
// student (and teacher), and shared read-only databases. The portal runs the statements with the student's own
// account, so the MySQL server itself enforces what a student may touch. Plan: docs/NACRT_SQL_PESKOVNIK.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2';
import { config } from './config.js';
import { audit, many, one, q } from './db.js';
import { portal } from './portal.js';
import { yearsOn } from './catalog.js';
import { firstWord, splitSql } from './sqlsplit.js';
import { afterErase } from './db.js';

const root = path.resolve(import.meta.dirname, '..');
// The years whose classes get the sandbox (content/portal.json, "sqlYears"); without years every class may.
export const SQL_YEARS = portal.sqlYears;
export const DEFAULT_LIMITS = { timeout: 5, rows: 500, sizeMb: 20, scriptKb: 64, perMinute: 30, connections: 5 };
const LIMIT_RANGE = { timeout: [1, 30], rows: [50, 5000], sizeMb: [1, 500], scriptKb: [4, 512], perMinute: [5, 300], connections: [1, 20] };
export const clampLimits = (v = {}) => Object.fromEntries(Object.entries(DEFAULT_LIMITS).map(([k, d]) => {
  const n = Math.round(Number(v[k]));
  const [lo, hi] = LIMIT_RANGE[k];
  return [k, Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : d];
}));

// ---------- secrets: AES-256-GCM with SQL_KEY from .env (not part of the backups) ----------
const key = () => {
  if (!config.sqlKey) return null;
  const k = Buffer.from(config.sqlKey, 'base64');
  return k.length === 32 ? k : null;
};
export const keyOk = () => !!key();
export function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
export function unseal(box) {
  const [v, iv, tag, ct] = String(box ?? '').split(':');
  if (v !== 'v1' || !key()) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}
// Passwords people type into Workbench: no letters that look alike (0/O, 1/l/I).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newPassword = (n = 14) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

// ---------- settings (one row, written only by the admin) ----------
let cached;
export async function settings() {
  if (cached !== undefined) return cached;
  const r = await one('SELECT * FROM sql_server WHERE id=1');
  cached = r ? { ...r, limits: clampLimits(r.limits) } : null;
  return cached;
}
export const forget = () => { cached = undefined; };
// The sandbox is on when the key is set and the admin has entered the server.
export const available = async () => keyOk() && !!(await settings());
export const PREFIX_RE = /^[a-z][a-z0-9]{0,8}_$/;
// The account is lr_u<id>; its two databases (4.4 and 4.6) are lr_u<id>_4_4 and lr_u<id>_4_6 (no dots: they would need backticks everywhere).
export const dbNameFor = (s, userId) => `${s.prefix}u${Number(userId)}`;
export const PERSONAL = {
  moja: { suffix: '_4_4', col: 'db_name', size: 'size_bytes', title: 'Moja baza (4.4)' },
  moja6: { suffix: '_4_6', col: 'db_name6', size: 'size_bytes6', title: 'Moja baza za poglavje 6 (4.6)' },
};
export const isPersonal = (target) => Object.hasOwn(PERSONAL, target);
export const personalNames = (s, userId) => Object.fromEntries(Object.entries(PERSONAL).map(([k, v]) => [k, `${dbNameFor(s, userId)}${v.suffix}`]));
// The database of a target in an account row.
export const dbOf = (acc, target) => (acc ? acc[PERSONAL[target].col] ?? null : null);
const personalRe = (s) => new RegExp(`^${s.prefix}u\\d+_4_[46]$`);
export const SHARED = [
  { id: 'sola', title: 'sola (šolska baza)', file: 'src/public/sola.sql', db: (s) => `${s.prefix}sola` },
  { id: 'matura', title: 'matura_baze (maturitetne naloge)', file: 'src/public/matura_baze.sql', db: (s) => `${s.prefix}matura` },
];
export const readerName = (s) => `${s.prefix}bralec`;
// What a personal database can be reset to (files of the chapters 4.4, 4.5 and 4.6; 4.6 offers its checkpoints K0 to K6, 28. 11. 2026).
// db: the personal database a template fills (moja = 4.4, moja6 = 4.6).
export const TEMPLATES = [
  { id: 'prazna', db: 'moja', title: 'Prazna baza', files: [] },
  { id: 'prazna6', db: 'moja6', title: 'Prazna baza', files: [] },
  { id: 'struktura', db: 'moja', title: 'Šolska baza: samo struktura (4.4)', files: ['content/sources/4.4/sola_struktura.sql'] },
  { id: 'zacetni', db: 'moja', title: 'Šolska baza: struktura in začetni podatki (4.4)', files: ['content/sources/4.4/sola_struktura.sql', 'content/sources/4.4/sola_zacetni_podatki.sql'] },
  { id: 'sola', db: 'moja', title: 'Šolska baza s podatki (sola.sql, 4.5)', files: ['src/public/sola.sql'] },
  { id: 'matura', db: 'moja', title: 'Maturitetne baze (matura_baze.sql, 4.5)', files: ['src/public/matura_baze.sql'] },
  { id: 'indeks', db: 'moja', title: 'Tabela za indekse (indeks_test.sql, 4.4)', files: ['content/sources/4.4/indeks_test.sql'] },
  { id: 'p6k0', db: 'moja6', title: 'Poglavje 6: K0 začetek (šolska baza in matura)', files: ['content/sources/4.6/sola6_ponastavi.sql', 'src/public/matura_baze.sql'] },
  { id: 'p6k2', db: 'moja6', title: 'Poglavje 6: K2 po INSERT (šolska baza in matura)', files: ['content/sources/4.6/sola6_k2.sql', 'src/public/matura_baze.sql'] },
  { id: 'p6k3', db: 'moja6', title: 'Poglavje 6: K3 po INSERT … SELECT (šolska baza in matura)', files: ['content/sources/4.6/sola6_k3.sql', 'src/public/matura_baze.sql'] },
  { id: 'p6k4', db: 'moja6', title: 'Poglavje 6: K4 po UPDATE (šolska baza in matura)', files: ['content/sources/4.6/sola6_k4.sql', 'src/public/matura_baze.sql'] },
  { id: 'p6k5', db: 'moja6', title: 'Poglavje 6: K5 po DELETE (šolska baza in matura)', files: ['content/sources/4.6/sola6_k5.sql', 'src/public/matura_baze.sql'] },
  { id: 'p6k6', db: 'moja6', title: 'Poglavje 6: K6 končno stanje (šolska baza in matura)', files: ['content/sources/4.6/sola6_k6.sql', 'src/public/matura_baze.sql'] },
];
const readScript = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// ---------- who may use it ----------
export function mayUse(user) {
  if (!user || user.isObserver || user.isWaiting) return false;
  if (user.isTeacher) return true;
  return yearsOn ? SQL_YEARS.includes(Number(user.class_year)) : !!user.class_id;
}

// ---------- connections ----------
const isMaria = (s) => /mariadb/i.test(s?.server_version ?? '');
const connOpts = (s, user, password, database) => ({
  host: s.host, port: s.port, user, password, database,
  multipleStatements: false, connectTimeout: 5000, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
  charset: 'utf8mb4_general_ci', rowsAsArray: true,
  ssl: s.tls ? { rejectUnauthorized: !!s.ca, ...(s.ca ? { ca: s.ca } : {}) } : undefined,
});
const connect = (opts) => new Promise((ok, no) => {
  const c = mysql.createConnection(opts);
  // a broken connection must not crash the portal; the running query reports the error itself
  c.on('error', (e) => console.error('SQL peskovnik (povezava prekinjena):', e.code || '', e.message));
  c.connect((e) => (e ? (c.destroy(), no(e)) : ok(c)));
});
const query = (c, sql, params) => new Promise((ok, no) => c.query({ sql, values: params, rowsAsArray: false }, (e, r) => (e ? no(e) : ok(r))));
const end = (c) => new Promise((ok) => c.end(() => ok()));
async function asAdmin(s, fn) {
  const c = await connect(connOpts(s, s.admin_user, unseal(s.admin_pass)));
  try { return await fn(c); } finally { await end(c).catch(() => c.destroy()); }
}
const ident = (name) => {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `\`${name}\``;
};
// In GRANT, _ and % in a database name are wildcards: `lr_u1` would mean "lr?u1", which the admin's `lr\_%` does not cover.
const grantOn = (name) => `${ident(name).replace(/_/g, '\\_')}.*`;
const userAt = (name) => `'${name.replace(/[^a-z0-9_]/g, '')}'@'%'`;

// A message for people when the admin connection or a command fails; the details go to the log.
export class SqlAdminError extends Error {}
const adminFail = (e, what) => {
  console.error(`SQL peskovnik (${what}):`, e.code || '', e.message);
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST'].includes(e.code)) return new SqlAdminError('Strežnik SQL ni dosegljiv. Preveri naslov, vrata in požarni zid.');
  if (e.code === 'ER_ACCESS_DENIED_ERROR') return new SqlAdminError('Strežnik SQL je zavrnil prijavo skrbniškega računa (uporabnik ali geslo).');
  if (e.code === 'HANDSHAKE_SSL_ERROR' || /ssl|tls/i.test(e.message)) return new SqlAdminError('Šifrirane povezave (TLS) ni bilo mogoče vzpostaviti. Preveri nastavitev TLS na strežniku.');
  return new SqlAdminError(`Strežnik SQL je vrnil napako: ${e.sqlMessage || e.message}`);
};

// ---------- the admin: test the connection, import the shared databases, clean up ----------
export async function testConnection(s) {
  try {
    return await asAdmin(s, async (c) => {
      const version = (await query(c, 'SELECT VERSION() AS v'))[0].v;
      const probe = `${s.prefix}_preizkus`;
      await query(c, `CREATE DATABASE IF NOT EXISTS ${ident(probe)}`);
      await query(c, `DROP DATABASE ${ident(probe)}`);
      const probeUser = `${s.prefix}_preizkus`;
      await query(c, `CREATE USER IF NOT EXISTS ${userAt(probeUser)} IDENTIFIED BY ?`, [newPassword()]);
      await query(c, `DROP USER ${userAt(probeUser)}`);
      return { version };
    });
  } catch (e) { throw adminFail(e, 'preizkus'); }
}
// Runs a script statement by statement on an open connection; used for templates and the shared databases.
async function runScript(c, text) {
  for (const st of splitSql(text).statements) await query(c, st.sql);
}
const collation = (s) => (isMaria(s) ? 'utf8mb4_slovenian_ci' : 'utf8mb4_sl_0900_ai_ci');
async function freshDatabase(c, s, name) {
  await query(c, `DROP DATABASE IF EXISTS ${ident(name)}`);
  await query(c, `CREATE DATABASE ${ident(name)} CHARACTER SET utf8mb4 COLLATE ${collation(s)}`);
}
// A database made fresh and filled from a template with the owner's own account (as if the student ran the script).
async function fillTemplate(s, adminConn, t, name, user, password) {
  await freshDatabase(adminConn, s, name);
  if (!t.files.length) return;
  const c = await connect(connOpts(s, user, password, name));
  try { for (const f of t.files) await runScript(c, readScript(f)); } finally { await end(c).catch(() => c.destroy()); }
}
export async function importShared(s, actor) {
  const reader = readerName(s);
  let pass = unseal(s.reader_pass);
  try {
    await asAdmin(s, async (c) => {
      if (!pass) pass = newPassword(20);
      await query(c, `CREATE USER IF NOT EXISTS ${userAt(reader)} IDENTIFIED BY ? WITH MAX_USER_CONNECTIONS 30`, [pass]);
      await query(c, `ALTER USER ${userAt(reader)} IDENTIFIED BY ?`, [pass]);
      for (const sh of SHARED) {
        await freshDatabase(c, s, sh.db(s));
        await query(c, `USE ${ident(sh.db(s))}`);
        await runScript(c, readScript(sh.file));
        await query(c, `GRANT SELECT, SHOW VIEW ON ${grantOn(sh.db(s))} TO ${userAt(reader)}`);
      }
    });
  } catch (e) { throw adminFail(e, 'skupne baze'); }
  await q(`UPDATE sql_server SET reader_pass=$1, shared_at=now() WHERE id=1`, [seal(pass)]);
  forget();
  await audit(actor, 'Uvozil skupne baze SQL', SHARED.map((x) => x.db(s)).join(', '));
}
// Personal databases on the server that have no owner in the portal (left after a failed delete or a restored backup).
export async function orphans(s) {
  try {
    return await asAdmin(s, async (c) => {
      const like = `${s.prefix.replace(/_/g, '\\_')}u%`;
      const names = (await query(c, 'SHOW DATABASES LIKE ?', [like])).map((r) => Object.values(r)[0]).filter((n) => personalRe(s).test(n));
      const known = new Set((await many('SELECT db_name, db_name6 FROM sql_accounts')).flatMap((r) => [r.db_name, r.db_name6]));
      (await many('SELECT db_name FROM sql_drop_queue')).forEach((r) => known.add(r.db_name));
      return names.filter((n) => !known.has(n)).sort();
    });
  } catch (e) { throw adminFail(e, 'osirotele'); }
}
export async function dropOrphans(s, names, actor) {
  const ok = new Set(await orphans(s));
  const list = names.filter((n) => ok.has(n));
  try {
    await asAdmin(s, async (c) => {
      for (const n of list) {
        await query(c, `DROP DATABASE IF EXISTS ${ident(n)}`);
        await query(c, `DROP USER IF EXISTS ${userAt(n)}`);
      }
    });
  } catch (e) { throw adminFail(e, 'brisanje osirotelih'); }
  if (list.length) await audit(actor, 'Izbrisal osirotele baze SQL', String(list.length));
  return list.length;
}

// ---------- personal databases ----------
export const accountOf = (userId) => one('SELECT * FROM sql_accounts WHERE user_id=$1', [userId]);
// Both databases and the account; the account has ALL on its two databases and nothing else.
async function makeDatabases(c, s, account, names, pass) {
  await query(c, `CREATE USER IF NOT EXISTS ${userAt(account)} IDENTIFIED BY ? WITH MAX_USER_CONNECTIONS ${Number(s.limits.connections)}`, [pass]);
  await query(c, `ALTER USER ${userAt(account)} IDENTIFIED BY ? WITH MAX_USER_CONNECTIONS ${Number(s.limits.connections)}`, [pass]);
  for (const name of Object.values(names)) {
    await freshDatabase(c, s, name);
    await query(c, `GRANT ALL PRIVILEGES ON ${grantOn(name)} TO ${userAt(account)}`);
  }
}
export async function createAccount(s, user, actor) {
  const account = dbNameFor(s, user.id);
  const names = personalNames(s, user.id);
  const pass = newPassword();
  try {
    await asAdmin(s, (c) => makeDatabases(c, s, account, names, pass));
  } catch (e) { throw adminFail(e, 'nova baza'); }
  await q(
    `INSERT INTO sql_accounts(user_id, db_name, db_name6, db_user, password, created_by) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET db_name=$2, db_name6=$3, db_user=$4, password=$5, created_by=$6, created_at=now(), last_used_at=NULL, size_bytes=0, size_bytes6=0`,
    [user.id, names.moja, names.moja6, account, seal(pass), actor?.id ?? null],
  );
  return pass;
}
export async function resetPassword(s, acc) {
  const pass = newPassword();
  try {
    await asAdmin(s, (c) => query(c, `ALTER USER ${userAt(acc.db_user)} IDENTIFIED BY ?`, [pass]));
  } catch (e) { throw adminFail(e, 'geslo'); }
  await q('UPDATE sql_accounts SET password=$2 WHERE user_id=$1', [acc.user_id, seal(pass)]);
  return pass;
}
// A fresh database (the one the template belongs to), filled from the template with the owner's own account (as if the student ran the script).
export async function resetDatabase(s, acc, templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  const name = dbOf(acc, t.db);
  try {
    await asAdmin(s, (c) => fillTemplate(s, c, t, name, acc.db_user, unseal(acc.password)));
  } catch (e) { throw adminFail(e, 'ponastavitev'); }
  await measure(s, acc, t.db);
  return { ...t, name };
}
export async function dropAccount(s, acc) {
  try {
    await asAdmin(s, async (c) => {
      for (const name of [acc.db_name, acc.db_name6]) await query(c, `DROP DATABASE IF EXISTS ${ident(name)}`);
      await query(c, `DROP USER IF EXISTS ${userAt(acc.db_user)}`);
    });
  } catch (e) { throw adminFail(e, 'brisanje'); }
  await q('DELETE FROM sql_accounts WHERE user_id=$1', [acc.user_id]);
}
// Deleted users: eraseUser() puts their database in sql_drop_queue (in the same transaction); this removes them on the server.
let draining = false;
export async function drainDropQueue() {
  if (draining || !(await available())) return 0;
  draining = true;
  try {
    const s = await settings();
    const list = await many('SELECT * FROM sql_drop_queue ORDER BY queued_at LIMIT 200');
    if (!list.length) return 0;
    await asAdmin(s, async (c) => {
      for (const r of list) {
        if (!personalRe(s).test(r.db_name)) { await q('DELETE FROM sql_drop_queue WHERE db_name=$1', [r.db_name]); continue; }
        await query(c, `DROP DATABASE IF EXISTS ${ident(r.db_name)}`);
        await query(c, `DROP USER IF EXISTS ${userAt(r.db_user)}`);
        await q('DELETE FROM sql_drop_queue WHERE db_name=$1', [r.db_name]);
      }
    });
    return list.length;
  } catch (e) {
    console.error('SQL peskovnik (vrsta za brisanje):', e.code || '', e.message);
    return 0;
  } finally { draining = false; }
}
export const drainSoon = () => setTimeout(() => drainDropQueue(), 2000).unref();
afterErase.add(drainSoon);
setInterval(() => drainDropQueue(), 5 * 60 * 1000).unref();

async function measure(s, acc, target) {
  try {
    const bytes = await asAdmin(s, async (c) => Number((await query(c,
      'SELECT COALESCE(SUM(data_length + index_length), 0) AS b FROM information_schema.tables WHERE table_schema=?', [dbOf(acc, target)]))[0].b));
    await q(`UPDATE sql_accounts SET ${PERSONAL[target].size}=$2 WHERE user_id=$1`, [acc.user_id, bytes]);
    return bytes;
  } catch { return null; }
}

// ---------- running statements ----------
// Each run is a new connection with the owner's account; statements run one after another and stop at the first error.
const recent = new Map();
export function rateOk(userId, perMinute) {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 60000);
  if (list.length >= perMinute) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  return true;
}
// Statements an over-full database may still run, so it can shrink.
const SHRINK = new Set(['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'DELETE', 'DROP', 'TRUNCATE', 'USE', 'SET']);
const MAX_STATEMENTS = 200;
const MAX_CELL = 2000;
const cellOf = (v) => {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return `0x${v.subarray(0, 64).toString('hex').toUpperCase()}${v.length > 64 ? '…' : ''}`;
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v);
  return v.length > MAX_CELL ? `${v.slice(0, MAX_CELL)}…` : v;
};
// The error message points at a line of the statement ("at line 3"); in the editor that is a line of the whole script.
const lineIn = (msg, st) => {
  const m = /at line (\d+)/.exec(msg ?? '');
  return m ? st.line + Number(m[1]) - 1 : st.line;
};

function runOne(c, st, limits, killer) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sets = [];
    let headers = null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killer(c.threadId); }, limits.timeout * 1000);
    const qy = c.query({ sql: st.sql, rowsAsArray: true });
    qy.on('fields', (fields) => { if (fields) sets.push({ columns: fields.map((f) => f.name), rows: [], total: 0 }); });
    qy.on('result', (row) => {
      if (Array.isArray(row) && sets.length) {
        const set = sets.at(-1);
        set.total++;
        if (set.rows.length < limits.rows) set.rows.push(row.map(cellOf));
      } else headers = row;
    });
    qy.on('error', (e) => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      if (timedOut || e.errno === 1317 || e.errno === 3024 || e.errno === 1969) {
        resolve({ ok: false, ms, line: st.line, code: e.code, errno: e.errno, timeout: true, message: `Stavek je trajal več kot ${limits.timeout} s in je bil prekinjen.` });
      } else resolve({ ok: false, ms, line: lineIn(e.sqlMessage, st), code: e.code, errno: e.errno, state: e.sqlState, message: e.sqlMessage || e.message, fatal: !!e.fatal });
    });
    qy.on('end', () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      if (sets.length) {
        const set = sets[0];
        // a SELECT that reached the time limit is stopped by the server and returns what it had (e.g. SLEEP returns 1)
        resolve({ ok: true, ms, line: st.line, kind: 'rows', columns: set.columns, rows: set.rows, total: set.total, truncated: set.total > set.rows.length, stopped: ms >= limits.timeout * 1000 - 50 });
      } else {
        resolve({ ok: true, ms, line: st.line, kind: 'ok', affected: headers?.affectedRows ?? 0, insertId: headers?.insertId || null, warnings: headers?.warningStatus ?? 0, info: headers?.info || '' });
      }
    });
  });
}

// target: 'moja' (4.4) or 'moja6' (4.6), the personal databases, or one of SHARED (read-only).
export async function run(user, target, text) {
  const s = await settings();
  const limits = s.limits;
  const body = String(text ?? '');
  if (Buffer.byteLength(body) > limits.scriptKb * 1024) return { ok: false, error: `Skript je daljši od ${limits.scriptKb} kB.` };
  const { statements, delimiter } = splitSql(body);
  if (delimiter) return { ok: false, error: 'DELIMITER je ukaz MySQL Workbencha in odjemalca mysql, ne strežnika. V peskovniku ga ne potrebuješ: vsak stavek konča podpičje.' };
  if (!statements.length) return { ok: false, error: 'Ni stavka za izvedbo.' };
  if (statements.length > MAX_STATEMENTS) return { ok: false, error: `Skript ima več kot ${MAX_STATEMENTS} stavkov. Razdeli ga.` };
  let cred;
  let acc = null;
  if (isPersonal(target)) {
    acc = await accountOf(user.id);
    if (!acc) return { ok: false, error: 'Nimaš še svoje baze. Ustvari jo učitelj.' };
    cred = { user: acc.db_user, password: unseal(acc.password), database: dbOf(acc, target) };
  } else {
    const sh = SHARED.find((x) => x.id === target);
    if (!sh || !s.shared_at) return { ok: false, error: 'Ta skupna baza še ni pripravljena.' };
    cred = { user: readerName(s), password: unseal(s.reader_pass), database: sh.db(s) };
  }
  if (!cred.password) return { ok: false, error: 'Gesla ni mogoče prebrati (ključ SQL_KEY se je spremenil). Obvesti učitelja.' };
  const over = acc && acc[PERSONAL[target].size] > limits.sizeMb * 1024 * 1024;
  const opts = connOpts(s, cred.user, cred.password, cred.database);
  let c;
  try { c = await connect(opts); } catch (e) {
    if (e.code === 'ER_TOO_MANY_USER_CONNECTIONS' || e.errno === 1203) return { ok: false, error: 'Odprtih je preveč povezav s tvojim računom (morda v Workbenchu). Zapri katero in poskusi znova.' };
    console.error('SQL peskovnik (povezava):', e.code || '', e.message);
    return { ok: false, error: 'Strežnik SQL trenutno ni dosegljiv. Poskusi čez nekaj minut.' };
  }
  // Ending a long query: a second connection of the same account may stop its own statements (no extra rights needed).
  const killer = (threadId) => connect(opts).then((k) => query(k, `KILL QUERY ${Number(threadId)}`).finally(() => end(k))).catch(() => {});
  const results = [];
  let changed = false;
  try {
    await query(c, isMaria(s) ? `SET SESSION max_statement_time=${Number(limits.timeout)}` : `SET SESSION max_execution_time=${Number(limits.timeout) * 1000}`).catch(() => {});
    for (const [n, st] of statements.entries()) {
      const word = firstWord(st.sql);
      if (over && !SHRINK.has(word)) {
        results.push({ ok: false, n: n + 1, line: st.line, sql: st.sql.slice(0, 200), message: `Tvoja baza ${cred.database} je večja od ${limits.sizeMb} MB. Najprej jo zmanjšaj (DELETE, DROP, TRUNCATE) ali ponastavi.` });
        break;
      }
      const r = await runOne(c, st, limits, killer);
      results.push({ n: n + 1, sql: st.sql.slice(0, 200), ...r });
      if (!['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH', 'TABLE', 'VALUES'].includes(word)) changed = true;
      if (!r.ok || r.fatal) break;
    }
  } finally { await end(c).catch(() => c.destroy()); }
  const failed = results.find((r) => !r.ok);
  if (acc) {
    await q('UPDATE sql_accounts SET last_used_at=now() WHERE user_id=$1', [user.id]);
    if (changed) await measure(s, acc, target);
  }
  return { ok: !failed, results, statements: statements.length, changed, ran: results.length };
}

// Tables, columns and foreign keys of a database, for the tree, the completion and the ER diagram.
export async function schema(user, target) {
  const s = await settings();
  let cred;
  if (isPersonal(target)) {
    const acc = await accountOf(user.id);
    if (!acc) return null;
    cred = { user: acc.db_user, password: unseal(acc.password), database: dbOf(acc, target) };
  } else {
    const sh = SHARED.find((x) => x.id === target);
    if (!sh || !s.shared_at) return null;
    cred = { user: readerName(s), password: unseal(s.reader_pass), database: sh.db(s) };
  }
  const c = await connect(connOpts(s, cred.user, cred.password, cred.database));
  try {
    const db = cred.database;
    const tables = await query(c, 'SELECT table_name AS t, table_type AS k, table_rows AS r FROM information_schema.tables WHERE table_schema=? ORDER BY table_name', [db]);
    const cols = await query(c, `SELECT table_name AS t, column_name AS c, column_type AS ty, is_nullable AS nu, column_key AS ke, extra AS ex
      FROM information_schema.columns WHERE table_schema=? ORDER BY table_name, ordinal_position`, [db]);
    const fks = await query(c, `SELECT constraint_name AS n, table_name AS t, column_name AS c, referenced_table_name AS rt, referenced_column_name AS rc
      FROM information_schema.key_column_usage WHERE table_schema=? AND referenced_table_name IS NOT NULL ORDER BY constraint_name, ordinal_position`, [db]);
    return {
      database: db,
      tables: tables.map((t) => ({
        name: t.t, view: /VIEW/.test(t.k), rows: t.r === null ? null : Number(t.r),
        columns: cols.filter((x) => x.t === t.t).map((x) => ({ name: x.c, type: x.ty, nullable: x.nu === 'YES', key: x.ke, extra: x.ex })),
      })),
      fks: fks.map((f) => ({ name: f.n, table: f.t, column: f.c, refTable: f.rt, refColumn: f.rc })),
    };
  } finally { await end(c).catch(() => c.destroy()); }
}

// ---------- the teacher's traffic light ----------
// green: used in the last 7 days; yellow: used before; grey: created but never used; none: no database.
export const light = (acc) => (!acc ? 'none' : !acc.last_used_at ? 'grey' : Date.now() - new Date(acc.last_used_at) < 7 * 864e5 ? 'green' : 'yellow');
export const LIGHTS = { green: 'uporabljal v zadnjih 7 dneh', yellow: 'uporabljal, a ne v zadnjih 7 dneh', grey: 'še ni uporabljal', none: 'nima baze' };

export const historyKeep = 100;
export async function remember(userId, target, text, out) {
  await q(
    `INSERT INTO sql_history(user_id, target, body, ok, ms, statements) VALUES($1,$2,$3,$4,$5,$6)`,
    [userId, target, String(text).slice(0, 4000), !!out.ok, (out.results ?? []).reduce((a, r) => a + (r.ms || 0), 0), out.ran ?? 0],
  );
  await q(`DELETE FROM sql_history WHERE user_id=$1 AND id NOT IN (SELECT id FROM sql_history WHERE user_id=$1 ORDER BY id DESC LIMIT ${historyKeep})`, [userId]);
  // counters for the admin's statistics: numbers only
  const ms = (out.results ?? []).reduce((a, r) => a + (r.ms || 0), 0);
  await q(
    `INSERT INTO sql_daily(day, target, runs, failed, ms) VALUES (current_date, $1, 1, $2, $3)
     ON CONFLICT (day, target) DO UPDATE SET runs=sql_daily.runs+1, failed=sql_daily.failed+$2, ms=sql_daily.ms+$3`,
    [target, out.ok ? 0 : 1, ms],
  );
  await q('INSERT INTO sql_daily_users(day, user_id) VALUES (current_date, $1) ON CONFLICT DO NOTHING', [userId]);
}

// ---------- the admin's statistics (numbers only; the teacher never sees statements, and neither does the admin here) ----------
export async function stats(limits) {
  await q(`DELETE FROM sql_daily WHERE day < current_date - 90`);
  await q(`DELETE FROM sql_daily_users WHERE day < current_date - 90`);
  const days = await many(
    `SELECT d::date AS day, COALESCE(sum(x.runs), 0)::int AS runs, COALESCE(sum(x.failed), 0)::int AS failed, COALESCE(sum(x.ms), 0)::bigint AS ms,
            (SELECT count(*)::int FROM sql_daily_users u WHERE u.day = d::date) AS users
     FROM generate_series(current_date - 13, current_date, interval '1 day') d LEFT JOIN sql_daily x ON x.day = d::date
     GROUP BY d ORDER BY d DESC`,
  );
  const byTarget = await many(`SELECT target, sum(runs)::int AS runs, sum(failed)::int AS failed FROM sql_daily WHERE day > current_date - 7 GROUP BY target ORDER BY target`);
  const totals = await one(
    `SELECT count(*)::int AS accounts, count(*) FILTER (WHERE last_used_at IS NULL)::int AS never,
            count(*) FILTER (WHERE last_used_at > now() - interval '7 days')::int AS active,
            COALESCE(sum(size_bytes + size_bytes6), 0)::bigint AS bytes, COALESCE(max(GREATEST(size_bytes, size_bytes6)), 0)::bigint AS biggest,
            count(*) FILTER (WHERE GREATEST(size_bytes, size_bytes6) > $1)::int AS over
     FROM sql_accounts`,
    [Number(limits.sizeMb) * 1048576],
  );
  const queued = (await one('SELECT count(*)::int AS n FROM sql_drop_queue')).n;
  return { days, byTarget, totals, queued };
}

// ---------- the admin's full check ----------
// Makes a throwaway account (user id 0, so it can never be a real person's) with both databases, tries what a student does and what a student
// must not be able to do, and removes everything. Each line is ok (true), failed (false) or not run (null).
export async function selfTest(s) {
  const out = [];
  const step = async (name, fn) => {
    const t0 = Date.now();
    try { out.push({ ok: true, name, detail: (await fn()) ?? '', ms: Date.now() - t0 }); return true; } catch (e) {
      out.push({ ok: false, name, detail: e.sqlMessage || e.message, ms: Date.now() - t0 }); return false;
    }
  };
  const skip = (name, why) => out.push({ ok: null, name, detail: why, ms: 0 });
  const mustFail = async (fn, what) => {
    let failed = false;
    try { await fn(); } catch { failed = true; }
    if (!failed) throw new Error(`${what}: ukaz je uspel, a ne bi smel`);
  };
  const account = dbNameFor(s, 0);
  const names = personalNames(s, 0);
  const pass = newPassword();
  const limits = s.limits;
  let admin;
  const asTest = async (database, fn) => {
    const c = await connect(connOpts(s, account, pass, database));
    try { return await fn(c); } finally { await end(c).catch(() => c.destroy()); }
  };
  const dropTest = async () => {
    for (const name of Object.values(names)) await query(admin, `DROP DATABASE IF EXISTS ${ident(name)}`);
    await query(admin, `DROP USER IF EXISTS ${userAt(account)}`);
  };
  try {
    const connected = await step('Skrbniška povezava na strežnik', async () => {
      admin = await connect(connOpts(s, s.admin_user, unseal(s.admin_pass)));
      const version = (await query(admin, 'SELECT VERSION() AS v'))[0].v;
      if (!s.tls) return `${version} (TLS je izklopljen)`;
      const cipher = (await query(admin, `SHOW SESSION STATUS LIKE 'Ssl_cipher'`))[0]?.Value;
      if (!cipher) throw new Error('Povezava ni šifrirana (TLS), čeprav je vklopljen v nastavitvah');
      return `${version}, TLS: ${cipher}`;
    });
    if (!connected) return out;
    const made = await step('Preizkusni račun in obe osebni bazi se ustvarita', async () => {
      await dropTest();
      await makeDatabases(admin, s, account, names, pass);
      return `${account}, ${Object.values(names).join(', ')}`;
    });
    if (!made) return out;
    for (const [key, p] of Object.entries(PERSONAL)) {
      await step(`${p.title}: ustvarjanje tabele, pisanje, branje in brisanje`, () => asTest(names[key], async (c) => {
        await query(c, 'CREATE TABLE preizkus (id INT PRIMARY KEY, x VARCHAR(20)) ENGINE=InnoDB');
        await query(c, `INSERT INTO preizkus VALUES (1, 'č')`);
        await query(c, `UPDATE preizkus SET x = 'š' WHERE id = 1`);
        const r = await query(c, 'SELECT x FROM preizkus WHERE id = 1');
        if (r[0]?.x !== 'š') throw new Error('Prebrana vrednost ni enaka zapisani (nabor znakov?)');
        await query(c, 'DELETE FROM preizkus WHERE id = 1');
        await query(c, 'DROP TABLE preizkus');
        return names[key];
      }));
      const t = TEMPLATES.find((x) => x.db === key && x.files.length);
      await step(`${p.title}: ponastavitev na predlogo »${t.title}«`, async () => {
        await fillTemplate(s, admin, t, names[key], account, pass);
        const n = (await query(admin, 'SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = ?', [names[key]]))[0].n;
        if (!Number(n)) throw new Error('Po ponastavitvi v bazi ni nobene tabele');
        return `${n} tabel`;
      });
    }
    await step('Račun vidi samo svoji bazi in ne more ustvarjati baz, brati sistemskih ali dajati pravic', () => asTest(names.moja, async (c) => {
      const seen = (await query(c, 'SHOW DATABASES')).map((r) => Object.values(r)[0]);
      const foreign = seen.filter((n) => n !== 'information_schema' && n !== 'performance_schema' && !Object.values(names).includes(n));
      if (foreign.length) throw new Error(`Račun vidi tuje baze: ${foreign.join(', ')}`);
      await mustFail(() => query(c, `CREATE DATABASE ${ident(`${s.prefix}u0_tuja`)}`), 'Ustvarjanje nove baze');
      await mustFail(() => query(c, 'SELECT * FROM mysql.user LIMIT 1'), 'Branje sistemske baze');
      await mustFail(() => query(c, `GRANT SELECT ON ${grantOn(names.moja)} TO ${userAt(readerName(s))}`), 'Dajanje pravic');
      return 'tuje baze niso vidne, ukazi so zavrnjeni';
    }));
    await step('Čas stavka in število povezav sta omejena', async () => {
      await asTest(names.moja, async (c) => {
        await query(c, isMaria(s) ? `SET SESSION max_statement_time=${Number(limits.timeout)}` : `SET SESSION max_execution_time=${Number(limits.timeout) * 1000}`);
        const v = (await query(c, isMaria(s) ? 'SELECT @@SESSION.max_statement_time AS v' : 'SELECT @@SESSION.max_execution_time AS v'))[0].v;
        const want = isMaria(s) ? Number(limits.timeout) : Number(limits.timeout) * 1000;
        if (Number(v) !== want) throw new Error(`Čas stavka se ni nastavil (${v})`);
      });
      const open = [];
      try {
        for (let i = 0; i < Number(limits.connections); i++) open.push(await connect(connOpts(s, account, pass, names.moja)));
        await mustFail(async () => { open.push(await connect(connOpts(s, account, pass, names.moja))); }, `Povezava številka ${Number(limits.connections) + 1}`);
      } finally { await Promise.all(open.map((c) => end(c).catch(() => c.destroy()))); }
      return `čas ${limits.timeout} s, povezav ${limits.connections}`;
    });
    if (s.shared_at) {
      await step('Skupni bazi: branje je mogoče, pisanje ne', async () => {
        for (const sh of SHARED) {
          const c = await connect(connOpts(s, readerName(s), unseal(s.reader_pass), sh.db(s)));
          try {
            const n = (await query(c, 'SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = ?', [sh.db(s)]))[0].n;
            if (!Number(n)) throw new Error(`V bazi ${sh.db(s)} ni nobene tabele`);
            await mustFail(() => query(c, 'CREATE TABLE preizkus (a INT)'), `Pisanje v ${sh.db(s)}`);
          } finally { await end(c).catch(() => c.destroy()); }
        }
        return SHARED.map((x) => x.db(s)).join(', ');
      });
    } else skip('Skupni bazi: branje je mogoče, pisanje ne', 'Skupni bazi še nista uvoženi.');
  } finally {
    if (admin) {
      await step('Pospravljanje: preizkusni račun in bazi se izbrišejo', async () => {
        await dropTest();
        const left = await query(admin, 'SHOW DATABASES LIKE ?', [`${s.prefix.replace(/_/g, '\_')}u0\_4\_%`]);
        if (left.length) throw new Error('Preizkusni bazi sta ostali na strežniku');
      });
      await end(admin).catch(() => admin.destroy());
    }
  }
  return out;
}
