// Backup and restore of the database from the admin page. Nothing is kept on the server:
// a backup goes straight to the admin's computer, and an uploaded file is deleted after use.
// Only admins reach this; an uploaded file is applied with the rights of the database user, like any restore.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isAdmin } from './auth.js';
import { config } from './config.js';
import { audit, ERASED_SALT, erasedHash, eraseUser, many, migrate, one, pool } from './db.js';
import { portal } from './portal.js';
import { build } from './build.js';
import { fileStamp } from './format.js';

export class BackupError extends Error {
  constructor(message, status = 400) { super(message); this.userMessage = message; this.status = status; }
}

export const ACTION_BACKUP = 'Prenesel varnostno kopijo';
export const ACTION_RESTORE = 'Obnovil bazo iz kopije';
const STALE_DAYS = 7;
const FRESH_MINUTES = 30;
const MAX_UPLOAD = 200 * 1024 * 1024;
const PENDING_MS = 15 * 60 * 1000;
const REQUIRED_TABLES = ['users', 'classes', 'class_members', 'progress', 'schema_migrations', 'audit_log'];
const MIGRATIONS = path.join(import.meta.dirname, 'migrations');

const bin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);
function pgEnv() {
  const u = new URL(config.databaseUrl);
  const env = { PATH: process.env.PATH, PGOPTIONS: '-c client_min_messages=warning', PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGDATABASE: decodeURIComponent(u.pathname.slice(1)) };
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  if (u.searchParams.get('sslmode')) env.PGSSLMODE = u.searchParams.get('sslmode');
  return env;
}
// Runs a PostgreSQL tool. The password goes in the environment, not on the command line.
function exec(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin(cmd), args, { env: pgEnv(), stdio: ['ignore', onLine ? 'pipe' : 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
    const read = onLine
      ? new Promise((ok) => { const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity }); rl.on('line', onLine); rl.on('close', ok); })
      : Promise.resolve();
    child.on('error', (e) => reject(new BackupError(`Orodje ${cmd} ni na voljo: ${e.message}`, 500)));
    child.on('close', (code) => read.then(() => resolve({ code, stderr: stderr.trim() })));
  });
}
const tempDir = (kind) => fs.mkdtempSync(path.join(os.tmpdir(), `${portal.slug}-${kind}-`));
const rmDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });
for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith(`${portal.slug}-backup-`) || d.startsWith(`${portal.slug}-restore-`)) rmDir(path.join(os.tmpdir(), d));

// ---------- when was the last backup ----------
export async function lastBackup() {
  return (await one('SELECT max(created_at) AS at FROM audit_log WHERE action=$1', [ACTION_BACKUP]))?.at ?? null;
}
// Returns null when there is a recent backup; the page shows it as a warning, not an error.
export async function backupWarning() {
  const at = await lastBackup();
  if (at && Date.now() - new Date(at).getTime() < STALE_DAYS * 864e5) return null;
  return { at };
}
export const recentBackup = async () => !!(await one(
  `SELECT 1 FROM audit_log WHERE action=$1 AND created_at > now() - make_interval(mins => $2)`, [ACTION_BACKUP, FRESH_MINUTES],
));

// ---------- download ----------
let dumping = false;
export async function createDump(actor) {
  if (dumping) throw new BackupError('Kopija se že izdeluje. Počakaj trenutek.', 409);
  dumping = true;
  const dir = tempDir('backup');
  const file = path.join(dir, 'kopija.dump');
  // The commit of the running code and the local time, e.g. lavrac-dc8e035-2026-11-18-00-13.dump
  const name = `${portal.slug}-${build.commit}-${fileStamp()}.dump`;
  let logId = null;
  try {
    // Logged first, so the entry is inside the backup it describes.
    logId = (await one('INSERT INTO audit_log(actor_id, actor_name, action, detail) VALUES($1,$2,$3,$4) RETURNING id', [actor.id, actor.name, ACTION_BACKUP, name])).id;
    const r = await exec('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-acl', '--exclude-table-data=session', `--file=${file}`]);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (r.code !== 0 || !size) {
      console.error('Izdelava kopije ni uspela:', r.stderr);
      await pool.query('DELETE FROM audit_log WHERE id=$1', [logId]);
      await audit(actor, 'Izdelava kopije ni uspela', r.stderr.split('\n')[0].slice(0, 200));
      throw new BackupError('Kopije ni bilo mogoče izdelati. Podrobnosti so v dnevniku strežnika.', 500);
    }
    return { file, name, size, cleanup: () => rmDir(dir) };
  } catch (e) { rmDir(dir); throw e; } finally { dumping = false; }
}

// ---------- upload and inspection ----------
export async function receiveUpload(req) {
  const dir = tempDir('restore');
  const file = path.join(dir, 'kopija.dump');
  let size = 0;
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      cb(size > MAX_UPLOAD ? new BackupError('Datoteka je prevelika.', 413) : null, chunk);
    },
  });
  try {
    await pipeline(req, limit, fs.createWriteStream(file));
    if (!size) throw new BackupError('Datoteka je prazna.');
    return { dir, file };
  } catch (e) { rmDir(dir); throw e; }
}

// Reads one table's rows out of the archive, without restoring it.
async function copyTable(file, table, keep = true) {
  let cols = null;
  let inside = false;
  let count = 0;
  const rows = [];
  const r = await exec('pg_restore', ['--data-only', `--table=${table}`, '--file=-', file], (line) => {
    if (!inside) {
      if (line.startsWith(`COPY public.${table} (`)) { cols = line.slice(line.indexOf('(') + 1, line.indexOf(')')).split(', '); inside = true; }
      return;
    }
    if (line === '\\.') { inside = false; return; }
    count++;
    if (keep) rows.push(line.split('\t'));
  });
  if (r.code !== 0 || !cols) throw new BackupError('Datoteka je poškodovana ali ni kopija tega portala.');
  return { cols, rows, count };
}

export async function inspectDump(file) {
  const damaged = () => new BackupError('Datoteka je poškodovana ali ni kopija tega portala.');
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(5);
  fs.readSync(fd, head, 0, 5, 0);
  fs.closeSync(fd);
  if (head.toString() !== 'PGDMP') throw new BackupError('To ni kopija, narejena v tem portalu.');
  const toc = [];
  if ((await exec('pg_restore', ['--list', file], (l) => toc.push(l))).code !== 0) throw damaged();
  const tables = new Set(toc.map((l) => /^\d+; \d+ \d+ TABLE public (\S+)/.exec(l)?.[1]).filter(Boolean));
  if (REQUIRED_TABLES.some((t) => !tables.has(t))) throw new BackupError('Datoteka ne vsebuje vseh tabel portala.');
  // Reading every block now finds a cut-off file here and not in the middle of a restore.
  if ((await exec('pg_restore', ['--file=/dev/null', file])).code !== 0) throw damaged();

  const done = (await copyTable(file, 'schema_migrations')).rows.map((r) => r[0]);
  const known = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));
  if (done.some((n) => !known.includes(n))) throw new BackupError('Kopija je iz novejše različice portala. Najprej posodobi portal, nato obnovi.');
  const users = await copyTable(file, 'users');
  const iOid = users.cols.indexOf('oid');
  const iMade = users.cols.indexOf('created_at');
  const again = await one(
    `SELECT count(*)::int AS n FROM unnest($1::text[], $2::timestamptz[]) AS u(h, c)
     JOIN erased_users e ON e.oid_hash=u.h AND u.c < e.erased_at`,
    [users.rows.map((r) => erasedHash(r[iOid])), users.rows.map((r) => r[iMade])],
  );
  return {
    createdAt: (toc.find((l) => l.startsWith('; Archive created at')) || '').replace('; Archive created at ', '') || null,
    users: users.count,
    classes: (await copyTable(file, 'classes', false)).count,
    progress: (await copyTable(file, 'progress', false)).count,
    erasedAgain: again.n,
    older: known.some((n) => !done.includes(n)),
  };
}

// One uploaded file waits for confirmation, for at most 15 minutes.
let pending = null;
export function dropPending() {
  if (!pending) return;
  clearTimeout(pending.timer);
  rmDir(pending.dir);
  pending = null;
}
export const pendingFor = (adminId) => (pending && pending.adminId === adminId
  ? { token: pending.token, info: pending.info, expires: new Date(pending.uploadedAt + PENDING_MS) } : null);
export function holdUpload({ dir, file }, info, adminId) {
  dropPending();
  const token = crypto.randomBytes(16).toString('hex');
  pending = { token, dir, file, info, adminId, uploadedAt: Date.now(), timer: setTimeout(dropPending, PENDING_MS) };
  pending.timer.unref();
  return token;
}

// ---------- restore ----------
let maintenance = false;
let restoring = false;
export const isMaintenance = () => maintenance;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function restore({ token, actor, skipSafety }) {
  if (!pending || pending.token !== token || pending.adminId !== actor.id) throw new BackupError('Datoteka ni več pripravljena. Naloži jo znova.', 410);
  if (restoring) throw new BackupError('Obnovitev že poteka.', 409);
  if (!skipSafety && !(await recentBackup())) {
    throw new BackupError('Pred obnovitvijo prenesi trenutno stanje (razdelek zgoraj), da ga lahko vrneš. Če ga ne potrebuješ, to označi.', 409);
  }
  restoring = true;
  const job = pending;
  clearTimeout(job.timer);
  pending = null;
  try {
    maintenance = true;
    await sleep(1500); // let requests that are already running finish
    const live = await many('SELECT oid_hash, erased_at FROM erased_users');
    const script = path.join(job.dir, 'obnovi.sql');
    // The script is written out first: a failure here changes nothing, and a cut-off script can never be run.
    if ((await exec('pg_restore', ['--no-owner', '--no-acl', `--file=${script}`, job.file])).code !== 0) throw new BackupError('Datoteka je poškodovana. Podatki niso spremenjeni.');
    const r = await exec('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-c', "SET lock_timeout = '20s'", '-c', 'DROP SCHEMA public CASCADE', '-c', 'CREATE SCHEMA public', '-f', script]);
    if (r.code !== 0) {
      console.error('Obnovitev ni uspela:', r.stderr);
      throw new BackupError(`Obnovitev ni uspela, podatki so ostali nespremenjeni. ${r.stderr.split('\n').slice(-2).join(' ').slice(0, 300)}`, 500);
    }
    // From here on the database is the restored one: bring it up to date and keep erased users erased.
    try {
      return await afterRestore(job, live, actor);
    } catch (e) {
      console.error('Obnovitev: popravki po obnovi niso uspeli:', e);
      throw new BackupError('Podatki so obnovljeni, vendar popravki po obnovi niso uspeli. Zaženi portal znova (docker compose restart app) in preveri stran Uporabniki.', 500);
    }
  } finally {
    maintenance = false;
    restoring = false;
    rmDir(job.dir);
  }
}

async function afterRestore(job, live, actor) {
  await migrate();
  for (const e of live) {
    await pool.query(
      `INSERT INTO erased_users(oid_hash, erased_at) VALUES($1,$2)
       ON CONFLICT (oid_hash) DO UPDATE SET erased_at = GREATEST(erased_users.erased_at, EXCLUDED.erased_at)`, [e.oid_hash, e.erased_at],
    );
  }
  const back = await many(
    `SELECT u.* FROM users u JOIN erased_users e
       ON e.oid_hash = encode(sha256(convert_to($1 || u.oid, 'UTF8')), 'hex') AND u.created_at < e.erased_at`, [ERASED_SALT],
  );
  let erased = 0;
  for (const u of back) if (!isAdmin(u)) { await eraseUser(u); erased++; }
  // Sessions point at user numbers, which may now belong to other people. A backup from this page has
  // no sessions, but a file made on the command line might.
  await pool.query('TRUNCATE session');
  const users = (await one('SELECT count(*)::int AS n FROM users')).n;
  await audit({ name: actor.name }, ACTION_RESTORE, `kopija ${job.info.createdAt || ''}; uporabnikov ${users}; znova izbrisanih ${erased}`.trim());
  return { users, erased };
}
