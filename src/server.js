import path from 'node:path';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import helmet from 'helmet';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { isMaintenance } from './backup.js';
import { portal } from './portal.js';
import { asset, fontPreloads } from './assets.js';
import { exercises, pastText, yearsOn } from './catalog.js';
import { recordTaskMap } from './taskmap.js';
import { listUrl, pageNumbers, PER_PAGE } from './paging.js';
import * as fmt from './format.js';
import { readVersion } from './version.js';
import { authRouter, loadUser } from './auth.js';
import { exerciseRouter } from './routes/exercises.js';
import { studentRouter } from './routes/student.js';
import { teacherRouter } from './routes/teacher.js';
import { adminRouter } from './routes/admin.js';
import { reportApiRouter } from './routes/reports.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.locals.fmt = fmt;
app.locals.portal = portal;
app.locals.version = readVersion(process.env.PORTAL_GIT_DIR || path.join(import.meta.dirname, '..', '.git'));
app.locals.asset = asset;
app.locals.fontPreloads = fontPreloads;
app.locals.yearsOn = yearsOn;
app.locals.pastText = pastText;
Object.assign(app.locals, { listUrl, pageNumbers, PER_PAGE });
app.locals.path = '/';
app.locals.user = null;
app.locals.csrf = '';
app.locals.htmlPrefs = '';

// Browsers and bookmarks ask for /favicon.ico on their own, also on exercise pages.
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(import.meta.dirname, 'public', 'favicon.ico'));
});
app.get('/healthz', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
// Versioned links can be kept for a long time; anything else is checked with the server first. Font files are named for
// what they hold and are requested from fonts.css without a version, but they are kept too: checking them with the
// server on every load (and every F5) draws the text in the fallback font first, and the page jumps when the font
// arrives. A changed font file needs a new name.
app.use('/static', express.static(path.join(import.meta.dirname, 'public'), {
  setHeaders: (res, file) => {
    const keep = res.req.query.v || file.endsWith('.woff2');
    res.setHeader('Cache-Control', keep ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
}));

const portalCsp = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], styleSrcAttr: ["'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"],
    baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: config.secureCookies ? [] : null,
  },
});
// The exercises are single files with inline code, but they may only talk to this server.
const exerciseCsp = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"],
    baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: config.secureCookies ? [] : null,
  },
});
app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: config.secureCookies, crossOriginOpenerPolicy: false }));
app.use((req, res, next) => (req.path.startsWith('/vaje/') ? exerciseCsp : portalCsp)(req, res, next));

// While the database is being replaced from a backup, nothing else may touch it (this includes sessions).
app.use((req, res, next) => {
  if (!isMaintenance()) return next();
  res.set('Retry-After', '30');
  if (req.path.startsWith('/api/')) return res.status(503).json({ ok: false });
  res.status(503).type('html').send('<!doctype html><html lang="sl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + portal.name + '</title><body style="font:1.1rem system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem"><h1>Portal se posodablja</h1><p>Podatki se obnavljajo iz varnostne kopije. Poskusi znova čez minuto.</p></body></html>');
});

const Store = pgSession(session);
app.use(session({
  name: `${portal.slug}.sid`,
  store: new Store({ pool, tableName: 'session', pruneSessionInterval: 3600 }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, maxAge: 1000 * 60 * 60 * 12 },
}));
app.use(express.urlencoded({ extended: false, limit: '200kb', parameterLimit: 3000 }));
app.use(express.json({ limit: '512kb', type: ['application/json', 'text/plain'] }));
app.use(loadUser);
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use('/auth', authRouter);
app.use('/', exerciseRouter);
app.use('/', studentRouter);
app.use('/', reportApiRouter);
app.use('/ucitelj', teacherRouter);
app.use('/admin', adminRouter);
app.use((req, res) => res.status(404).render('error', { title: 'Stran ne obstaja', message: 'Povezava je napačna ali stran ni več na voljo.' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (!err.userTitle) console.error(err);
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api/')) return res.status(status).json({ ok: false });
  res.status(status).render('error', { title: err.userTitle || 'Prišlo je do napake', message: err.userMessage || 'Osveži stran in poskusi znova.' });
});

await migrate();
await recordTaskMap(pool, exercises);
const server = app.listen(config.port, () => console.log(`${portal.name} posluša na vratih ${config.port}`));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    // Graceful stop, but never wait for ever for a connection that stays open (docker stop would wait 10 s and kill).
    setTimeout(() => process.exit(1), 8000).unref();
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}
