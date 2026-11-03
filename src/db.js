import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from './config.js';

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
