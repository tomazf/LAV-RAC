// Demo mode: real app, stand-in login. Run through docker-compose.demo.yml or with DATABASE_URL set.
import { startMockOidc, TENANT } from './mock-oidc.js';

const port = Number(process.env.DEMO_OIDC_PORT || 9400);
Object.assign(process.env, {
  PUBLIC_URL: process.env.PUBLIC_URL || 'http://localhost:4000',
  OIDC_TENANT_ID: TENANT,
  OIDC_CLIENT_ID: 'demo-client',
  OIDC_CLIENT_SECRET: 'demo-secret',
  OIDC_ISSUER: `http://localhost:${port}/${TENANT}/v2.0`,
  OIDC_ALLOW_INSECURE: 'true',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@sola.test',
  SESSION_SECRET: process.env.SESSION_SECRET || 'demo-only-secret-demo-only-secret-123',
});
startMockOidc({ port, clientId: 'demo-client', clientSecret: 'demo-secret' });
console.log('DEMO: preizkusna prijava, ne za pravo uporabo.');
await import('../src/server.js');
