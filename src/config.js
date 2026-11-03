const need = (name) => {
  const v = process.env[name];
  if (!v) { console.error(`Manjka nastavitev ${name}. Preveri datoteko .env.`); process.exit(1); }
  return v;
};
const publicUrl = need('PUBLIC_URL').replace(/\/$/, '');
const tenantId = need('OIDC_TENANT_ID');
const sessionSecret = need('SESSION_SECRET');
if (sessionSecret.length < 32) { console.error('SESSION_SECRET mora imeti vsaj 32 znakov.'); process.exit(1); }
export const config = {
  publicUrl,
  secureCookies: publicUrl.startsWith('https://'),
  port: Number(process.env.PORT || 3000),
  databaseUrl: need('DATABASE_URL'),
  sessionSecret,
  tenantId,
  clientId: need('OIDC_CLIENT_ID'),
  clientSecret: need('OIDC_CLIENT_SECRET'),
  issuer: process.env.OIDC_ISSUER || `https://login.microsoftonline.com/${tenantId}/v2.0`,
  allowInsecureOidc: process.env.OIDC_ALLOW_INSECURE === 'true',
  admins: new Set(need('ADMIN_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
};
