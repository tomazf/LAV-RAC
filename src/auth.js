import crypto from 'node:crypto';
import express from 'express';
import * as oidc from 'openid-client';
import { config } from './config.js';
import { one } from './db.js';
import { portal } from './portal.js';

let discovered = null;
async function oidcConfig() {
  if (discovered) return discovered;
  const options = config.allowInsecureOidc ? { execute: [oidc.allowInsecureRequests] } : undefined;
  discovered = await oidc.discovery(new URL(config.issuer), config.clientId, config.clientSecret, undefined, options);
  return discovered;
}
const redirectUri = () => `${config.publicUrl}/auth/callback`;
export const isAdmin = (user) => config.admins.has(String(user.username).toLowerCase());
const regenerate = (req) => new Promise((ok, no) => req.session.regenerate((e) => (e ? no(e) : ok())));
const saveSession = (req) => new Promise((ok, no) => req.session.save((e) => (e ? no(e) : ok())));

export const authRouter = express.Router();
authRouter.get('/login', async (req, res, next) => {
  try {
    const cfg = await oidcConfig();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const verifier = oidc.randomPKCECodeVerifier();
    req.session.oidc = { state, nonce, verifier };
    await saveSession(req);
    const url = oidc.buildAuthorizationUrl(cfg, {
      redirect_uri: redirectUri(),
      scope: 'openid profile email',
      response_type: 'code',
      state,
      nonce,
      prompt: 'select_account',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    });
    res.redirect(url.href);
  } catch (e) { next(e); }
});
authRouter.get('/callback', async (req, res, next) => {
  try {
    const pending = req.session.oidc;
    if (!pending) return res.redirect('/');
    delete req.session.oidc;
    const cfg = await oidcConfig();
    const current = new URL(req.originalUrl, config.publicUrl);
    const tokens = await oidc.authorizationCodeGrant(cfg, current, {
      pkceCodeVerifier: pending.verifier, expectedState: pending.state, expectedNonce: pending.nonce, idTokenExpected: true,
    });
    const c = tokens.claims();
    if (c.tid !== config.tenantId) return res.status(403).render('error', { title: 'Prijava ni mogoča', message: 'Ta račun ni iz šolske organizacije. Prijavi se s šolskim računom.' });
    const username = c.preferred_username;
    if (!c.oid || !username) return res.status(403).render('error', { title: 'Prijava ni mogoča', message: 'Prijava ni vrnila podatkov o računu. Obrni se na skrbnika.' });
    const user = await one(
      `INSERT INTO users(oid, username, email, name) VALUES($1,$2,$3,$4)
       ON CONFLICT (oid) DO UPDATE SET username=$2, email=$3, name=$4, last_login_at=now() RETURNING id`,
      [c.oid, username, c.email || null, c.name || username],
    );
    await regenerate(req);
    req.session.uid = user.id;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    await saveSession(req);
    res.redirect('/');
  } catch (e) {
    console.error('Napaka pri prijavi:', e.message);
    res.status(400);
    next(Object.assign(new Error('login'), { userTitle: 'Prijava ni uspela', userMessage: 'Prijava se ni končala. Poskusi znova.', status: 400 }));
  }
});
// Sign out of the portal and of Microsoft too, so the next student on a shared computer can't continue as this one.
authRouter.post('/logout', async (req, res, next) => {
  try {
    await new Promise((ok) => req.session.destroy(() => ok()));
    res.clearCookie(`${portal.slug}.sid`);
    let target = `${config.publicUrl}/`;
    try {
      target = oidc.buildEndSessionUrl(await oidcConfig(), { post_logout_redirect_uri: `${config.publicUrl}/`, client_id: config.clientId }).href;
    } catch (e) { console.error('Odjava pri Microsoftu ni na voljo:', e.message); }
    res.render('signout', { target });
  } catch (e) { next(e); }
});

// Loads the signed-in user on every request, so role changes and removals apply immediately.
export async function loadUser(req, res, next) {
  try {
    res.locals.user = null;
    if (req.session?.uid) {
      const u = await one(
        `SELECT u.*, (SELECT m.class_id FROM class_members m WHERE m.user_id=u.id) AS class_id FROM users u WHERE u.id=$1`,
        [req.session.uid],
      );
      if (u) {
        u.isAdmin = isAdmin(u);
        u.isTeacher = u.isAdmin || u.role === 'teacher';
        u.isWaiting = !u.isTeacher && !u.class_id;
        req.user = u;
        res.locals.user = u;
        res.locals.csrf = req.session.csrf;
      } else { req.session.uid = null; }
    }
    next();
  } catch (e) { next(e); }
}
function sameToken(req, value) {
  const sent = Buffer.from(String(value ?? ''));
  const real = Buffer.from(String(req.session?.csrf ?? ''));
  return real.length > 0 && sent.length === real.length && crypto.timingSafeEqual(sent, real);
}
export const csrfValid = (req) => sameToken(req, req.body?._csrf ?? req.body?.csrf);
// For requests whose body is a file, so the token travels in a header.
export function checkCsrfHeader(req, res, next) {
  if (!sameToken(req, req.get('x-csrf-token'))) return res.status(403).json({ ok: false, error: 'Obrazec je potekel. Osveži stran in poskusi znova.' });
  next();
}
export function checkCsrf(req, res, next) {
  if (!csrfValid(req)) return res.status(403).render('error', { title: 'Obrazec je potekel', message: 'Vrni se na prejšnjo stran, jo osveži in poskusi znova.' });
  next();
}
const denied = (res) => res.status(403).render('error', { title: 'Ni dostopa', message: 'Ta stran ni na voljo za tvoj račun.' });
export const requireLogin = (req, res, next) => (req.user ? next() : res.redirect('/'));
export const requireTeacher = (req, res, next) => (!req.user ? res.redirect('/') : req.user.isTeacher ? next() : denied(res));
export const requireAdmin = (req, res, next) => (!req.user ? res.redirect('/') : req.user.isAdmin ? next() : denied(res));
export const requireAccess = (req, res, next) => (!req.user ? res.redirect('/') : req.user.isWaiting ? res.redirect('/') : next());
