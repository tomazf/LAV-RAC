import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from './config.js';
import { portal } from './portal.js';

pg.types.setTypeParser(1700, Number); // NUMERIC as JS number
pg.types.setTypeParser(20, Number);   // BIGINT ids and counts as JS number
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });
export const q = (text, params) => pool.query(text, params);
export async function one(text, params) { return (await pool.query(text, params)).rows[0] ?? null; }
export async function many(text, params) { return (await pool.query(text, params)).rows; }
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally { c.release(); }
}
export async function migrate() {
  const dir = path.join(import.meta.dirname, 'migrations');
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(727001)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (done.has(f)) continue;
      await c.query('BEGIN');
      try {
        await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [f]);
        await c.query('COMMIT');
        console.log('Migracija', f);
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    c.release();
  }
}
export const audit = (actor, action, detail = '') =>
  q('INSERT INTO audit_log(actor_id, actor_name, action, detail) VALUES($1,$2,$3,$4)', [actor?.id ?? null, actor?.name ?? 'sistem', action, detail]);
// Deleting a user is permanent: all their rows go, and their name is removed from the log and sessions.
export const DELETED_NAME = 'izbrisan uporabnik';
// Same calculation as in SQL (backup.js): encode(sha256(convert_to(ERASED_SALT || oid, 'UTF8')), 'hex')
export const ERASED_SALT = `${portal.slug}-erased:`;
export const erasedHash = (oid) => crypto.createHash('sha256').update(`${ERASED_SALT}${oid}`).digest('hex');
export async function eraseUser(user) {
  await tx(async (c) => {
    await c.query('INSERT INTO erased_users(oid_hash) VALUES($1) ON CONFLICT (oid_hash) DO UPDATE SET erased_at=now()', [erasedHash(user.oid)]);
    await c.query('UPDATE audit_log SET actor_name=$2 WHERE actor_id=$1', [user.id, DELETED_NAME]);
    await c.query('UPDATE audit_log SET actor_name=replace(actor_name, $1, $2), detail=replace(detail, $1, $2) WHERE actor_name LIKE $3 OR detail LIKE $3',
      [user.name, DELETED_NAME, `%${user.name.replace(/[\\%_]/g, '\\$&')}%`]);
    await c.query(`DELETE FROM session WHERE (sess->>'uid')::bigint = $1`, [user.id]);
    await c.query('DELETE FROM users WHERE id=$1', [user.id]);
  });
}
