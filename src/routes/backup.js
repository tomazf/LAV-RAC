import fs from 'node:fs';
import express from 'express';
import { checkCsrf, checkCsrfHeader } from '../auth.js';
import { BackupError, createDump, dropPending, holdUpload, inspectDump, lastBackup, pendingFor, receiveUpload, recentBackup, restore } from '../backup.js';

export const backupRouter = express.Router();

const back = (res, key, msg) => res.redirect(`/admin/kopije?${key}=${encodeURIComponent(msg)}`);
const fail = (e) => {
  if (!(e instanceof BackupError)) console.error(e);
  return { status: e.status || 500, message: e.userMessage || 'Prišlo je do napake. Podrobnosti so v dnevniku strežnika.' };
};

backupRouter.get('/', async (req, res, next) => {
  try {
    const pending = pendingFor(req.user.id);
    res.render('admin/backup', {
      tab: 'backup',
      message: req.query.sporocilo || null,
      error: req.query.napaka || null,
      last: await lastBackup(),
      pending,
      fresh: pending ? await recentBackup() : false,
    });
  } catch (e) { next(e); }
});

// The backup is made in a temporary folder, sent to the admin and deleted. Nothing stays on the server.
backupRouter.post('/prenesi', checkCsrf, async (req, res, next) => {
  try {
    const dump = await createDump(req.user);
    res.download(dump.file, dump.name, (err) => {
      dump.cleanup();
      if (err && !res.headersSent) next(err);
    });
  } catch (e) {
    if (e instanceof BackupError) return back(res, 'napaka', e.userMessage);
    next(e);
  }
});

// The file itself is the request body, so the token comes in a header.
backupRouter.post('/nalozi', checkCsrfHeader, async (req, res) => {
  let held = false;
  let upload = null;
  try {
    if (Number(req.get('content-length')) > 200 * 1024 * 1024) throw new BackupError('Datoteka je prevelika.', 413);
    upload = await receiveUpload(req);
    const info = await inspectDump(upload.file);
    holdUpload(upload, info, req.user.id);
    held = true;
    res.json({ ok: true });
  } catch (e) {
    const { status, message } = fail(e);
    res.status(status).json({ ok: false, error: message });
  } finally {
    if (upload && !held) fs.rmSync(upload.dir, { recursive: true, force: true });
  }
});

backupRouter.post('/preklici', checkCsrf, (req, res) => {
  if (pendingFor(req.user.id)) dropPending();
  back(res, 'sporocilo', 'Datoteka je odstranjena. Podatki niso spremenjeni.');
});

backupRouter.post('/obnovi', checkCsrf, async (req, res, next) => {
  try {
    if (String(req.body.potrdi || '').trim().toUpperCase() !== 'OBNOVI') return back(res, 'napaka', 'Za potrditev vpiši besedo OBNOVI.');
    const result = await restore({ token: String(req.body.token || ''), actor: req.user, skipSafety: req.body.skip === '1' });
    // Everyone, including this admin, is signed out: user numbers in the old sessions may now mean other people.
    res.locals.user = null;
    req.session.destroy(() => res.render('admin/restored', { result }));
  } catch (e) {
    if (e instanceof BackupError) return back(res, 'napaka', e.userMessage);
    next(e);
  }
});
