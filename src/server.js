import path from 'node:path';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import helmet from 'helmet';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import * as fmt from './format.js';
import { authRouter, loadUser } from './auth.js';
import { exerciseRouter } from './routes/exercises.js';
import { studentRouter } from './routes/student.js';
import { teacherRouter } from './routes/teacher.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views'));
app.locals.fmt = fmt;
app.locals.path = '/';
app.locals.user = null;
app.locals.csrf = '';

app.get('/healthz', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/static', express.static(path.join(import.meta.dirname, 'public'), { maxAge: '1h' }));

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

const Store = pgSession(session);
app.use(session({
  name: 'lavels.sid',
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
const server = app.listen(config.port, () => console.log(`LAV-ELS posluša na vratih ${config.port}`));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => pool.end().finally(() => process.exit(0))));
}
