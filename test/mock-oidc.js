// Stand-in for Microsoft login, for tests and the demo only. It never runs in production.
import crypto from 'node:crypto';
import http from 'node:http';

export const TENANT = '00000000-0000-4000-8000-000000000001';
export const DEMO_USERS = [
  { oid: 'u-admin', name: 'Sara Skrbnik', username: 'admin@sola.test' },
  { oid: 'u-teacher', name: 'Tomaž Učitelj', username: 'ucitelj@sola.test' },
  { oid: 'u-ana', name: 'Ana Kovač', username: 'ana.kovac@sola.test' },
  { oid: 'u-bor', name: 'Bor Novak', username: 'bor.novak@sola.test' },
  { oid: 'u-cene', name: 'Cene Zupan', username: 'cene.zupan@sola.test' },
  { oid: 'u-dasa', name: 'Daša Horvat', username: 'dasa.horvat@sola.test' },
  { oid: 'u-outside', name: 'Zunanji Gost', username: 'gost@drugje.test', tid: 'other-tenant' },
];
const b64 = (x) => Buffer.from(x).toString('base64url');

export function startMockOidc({ port = 9400, clientId, clientSecret, users = DEMO_USERS }) {
  const issuer = `http://localhost:${port}/${TENANT}/v2.0`;
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const codes = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname.endsWith('/.well-known/openid-configuration')) {
      return json({
        issuer,
        authorization_endpoint: `http://localhost:${port}/authorize`,
        token_endpoint: `http://localhost:${port}/token`,
        jwks_uri: `http://localhost:${port}/jwks`,
        end_session_endpoint: `http://localhost:${port}/logout`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (url.pathname === '/jwks') {
      return json({ keys: [{ ...crypto.createPublicKey(privateKey).export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' }] });
    }
    if (url.pathname === '/authorize') {
      const pick = url.searchParams.get('pick');
      if (pick) {
        const code = crypto.randomUUID();
        codes.set(code, { oid: pick, nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge') });
        const back = new URL(url.searchParams.get('redirect_uri'));
        back.searchParams.set('code', code);
        back.searchParams.set('state', url.searchParams.get('state'));
        res.writeHead(302, { location: back.href });
        return res.end();
      }
      const links = users.map((u) => {
        const q = new URLSearchParams(url.searchParams); q.set('pick', u.oid);
        return `<li><a href="/authorize?${q}">${u.name}</a> (${u.username})</li>`;
      }).join('');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset="utf-8"><title>Demo login</title><h1>Preizkusna prijava</h1><p>To ni prava prijava Microsoft.</p><ul>${links}</ul>`);
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      const p = new URLSearchParams(body);
      const entry = codes.get(p.get('code'));
      codes.delete(p.get('code'));
      const basic = Buffer.from((req.headers.authorization || '').replace('Basic ', ''), 'base64').toString();
      const secret = decodeURIComponent(basic.split(':')[1] || '') || p.get('client_secret');
      const verifier = crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url');
      if (!entry || secret !== clientSecret || verifier !== entry.challenge) return json({ error: 'invalid_grant' }, 400);
      const u = users.find((x) => x.oid === entry.oid);
      const now = Math.floor(Date.now() / 1000);
      const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'k1' }));
      const claims = b64(JSON.stringify({ iss: issuer, aud: clientId, sub: u.oid, oid: u.oid, tid: u.tid || TENANT, name: u.name, preferred_username: u.username, email: u.username, nonce: entry.nonce, iat: now, exp: now + 3600 }));
      const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claims}`), privateKey).toString('base64url');
      return json({ access_token: crypto.randomUUID(), token_type: 'Bearer', expires_in: 3600, id_token: `${head}.${claims}.${sig}` });
    }
    if (url.pathname === '/logout') {
      res.writeHead(302, { location: url.searchParams.get('post_logout_redirect_uri') || '/' });
      return res.end();
    }
    res.writeHead(404); res.end();
  }).listen(port);
  return { issuer, server };
}
