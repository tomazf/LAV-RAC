// The end of the school year, done once a year by the admin: the final year leaves the portal and every other class
// moves up a year. Preview first, a fresh backup, a typed confirmation, then everything in one transaction.
import express from 'express';
import { checkCsrf, isAdmin } from '../auth.js';
import { finalYear, yearsOn } from '../catalog.js';
import { audit, eraseUser, many, one, tx } from '../db.js';
import { recentBackup } from '../backup.js';
import { byName } from '../format.js';

export const yearRouter = express.Router();
export const ACTION_YEAR = 'Zaključil šolsko leto';
const WORD = 'PREHOD';
// A second run within this time is almost certainly a mistake, so it needs an extra confirmation.
const AGAIN_DAYS = 120;

// R2A becomes R3A; the admin can change it in the preview.
export const nextName = (c) => (c.name.includes(String(c.year)) ? c.name.replace(String(c.year), String(c.year + 1)) : c.name);
const back = (res, key, msg) => res.redirect(`/admin/solsko-leto?${key}=${encodeURIComponent(msg)}`);
const ids = (v) => new Set([].concat(v ?? []).map(Number).filter(Boolean));

async function plan() {
  const classes = await many('SELECT * FROM classes ORDER BY name');
  const people = await many(`SELECT m.class_id, u.id, u.name, u.username, u.email, u.role FROM class_members m JOIN users u ON u.id=m.user_id`);
  const teachers = await many('SELECT t.class_id, u.name FROM class_teachers t JOIN users u ON u.id=t.user_id');
  for (const c of classes) {
    c.students = people.filter((p) => p.class_id === c.id).sort(byName);
    c.teachers = teachers.filter((t) => t.class_id === c.id).sort(byName).map((t) => t.name);
    c.next = c.year ? nextName(c) : c.name;
  }
  return {
    leaving: classes.filter((c) => c.year === finalYear),
    // Higher years first, so the list reads in the order the classes move.
    moving: classes.filter((c) => c.year && c.year < finalYear).sort((a, b) => b.year - a.year),
    other: classes.filter((c) => !c.year || c.year > finalYear),
  };
}

yearRouter.use((req, res, next) => (yearsOn ? next() : res.status(404).render('error', { title: 'Ni na voljo', message: 'Ta portal nima letnikov.' })));

yearRouter.get('/', async (req, res, next) => {
  try {
    res.render('admin/year', {
      tab: 'year', message: req.query.sporocilo || null, error: req.query.napaka || null,
      ...(await plan()), finalYear, word: WORD, fresh: await recentBackup(),
      lastRun: (await one('SELECT max(created_at) AS at FROM audit_log WHERE action=$1', [ACTION_YEAR]))?.at ?? null,
      againDays: AGAIN_DAYS,
    });
  } catch (e) { next(e); }
});

yearRouter.post('/', checkCsrf, async (req, res, next) => {
  try {
    if (String(req.body.potrdi || '').trim().toUpperCase() !== WORD) return back(res, 'napaka', `Za potrditev vpiši besedo ${WORD}.`);
    if (!(await recentBackup())) return back(res, 'napaka', 'Najprej prenesi svežo varnostno kopijo (Administracija > Kopije), nato ponovi prehod.');
    const recent = await one(`SELECT 1 FROM audit_log WHERE action=$1 AND created_at > now() - make_interval(days => $2)`, [ACTION_YEAR, AGAIN_DAYS]);
    if (recent && req.body.again !== '1') return back(res, 'napaka', 'Šolsko leto je bilo pred kratkim že zaključeno. Če ga res želiš zaključiti znova, to označi.');
    // Only the people the admin saw in the preview are affected; anyone added since then stays where they are.
    const shownLeaving = ids(req.body.leaving);
    const erase = ids(req.body.erase);
    const shownMoving = ids(req.body.moving);
    const keep = ids(req.body.keep);
    const done = await tx(async (c) => {
      const classes = (await c.query('SELECT * FROM classes ORDER BY id FOR UPDATE')).rows;
      const leaving = classes.filter((x) => x.year === finalYear);
      const moving = classes.filter((x) => x.year && x.year < finalYear);
      const r = { erased: 0, deleted: leaving.length, moved: moving.length, unassigned: 0 };
      const gone = (await c.query(
        `SELECT u.* FROM users u JOIN class_members m ON m.user_id=u.id WHERE m.class_id = ANY($1) AND u.role='user'`, [leaving.map((x) => x.id)],
      )).rows.filter((u) => shownLeaving.has(u.id) && !isAdmin(u));
      for (const u of gone) {
        if (erase.has(u.id)) { await eraseUser(u, c); r.erased++; } else r.unassigned++;
      }
      // Deleting the classes also removes their teachers, members and open exercises.
      await c.query('DELETE FROM classes WHERE id = ANY($1)', [leaving.map((x) => x.id)]);
      for (const x of moving) {
        const name = String(req.body[`name_${x.id}`] ?? '').trim().slice(0, 80) || nextName(x);
        await c.query('UPDATE classes SET year=$2, name=$3, show_past=TRUE WHERE id=$1', [x.id, x.year + 1, name]);
        // The new year starts closed and without teachers; the admin assigns them, the teachers open the chapters.
        await c.query('DELETE FROM class_teachers WHERE class_id=$1', [x.id]);
        await c.query('DELETE FROM class_exercises WHERE class_id=$1', [x.id]);
        const out = [...shownMoving].filter((id) => !keep.has(id));
        r.unassigned += (await c.query('DELETE FROM class_members WHERE class_id=$1 AND user_id = ANY($2)', [x.id, out])).rowCount;
      }
      return r;
    });
    await audit(req.user, ACTION_YEAR, `izbrisanih dijakov ${done.erased}, izbrisanih razredov ${done.deleted}, razredov v višjem letniku ${done.moved}, dijakov brez razreda ${done.unassigned}`);
    res.redirect(`/admin/razredi?sporocilo=${encodeURIComponent(`Šolsko leto je zaključeno. Izbrisanih dijakov: ${done.erased}. Razredov v višjem letniku: ${done.moved}. Dijakov brez razreda: ${done.unassigned}. Razredom zdaj dodeli učitelje.`)}`);
  } catch (e) { next(e); }
});
