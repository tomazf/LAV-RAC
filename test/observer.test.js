// »Nadzorni« (observer): the chosen years are shown read-only, with solutions, and without the tracker that saves anything.
import assert from 'node:assert/strict';
import { test } from 'node:test';
// src/catalog.js loads the configuration, which exits without these settings; this file runs without the app's .env (CI).
const defaults = {
  PUBLIC_URL: 'http://localhost:4000', DATABASE_URL: 'postgres://unused@localhost/unused', OIDC_TENANT_ID: 'test-tenant',
  OIDC_CLIENT_ID: 'test-client', OIDC_CLIENT_SECRET: 'test-secret', SESSION_SECRET: 'x'.repeat(40), ADMIN_EMAILS: 'admin@sola.test',
};
for (const [k, v] of Object.entries(defaults)) process.env[k] ||= v;
const { observerGroups, renderExercise, byId, yearOf } = await import('../src/catalog.js');

const sample = [...byId.values()].find((e) => yearOf(e.module) === 2 && e.html);

test('the supervisor sees only the chosen years, in the standard order', () => {
  const groups = observerGroups([2]);
  assert.ok(groups.length > 0);
  for (const m of groups) for (const e of m.exercises) assert.equal(yearOf(e.module), 2);
  assert.deepEqual(observerGroups([]), []);
});

test('the read-only page has its data but no tracker, so nothing is sent or saved', () => {
  assert.ok(sample, 'an exercise of the second year exists');
  const boot = { id: sample.id, no: sample.no, title: sample.title, key: sample.key, attempt: 0, uid: 1, name: 'Nadzor', state: {}, csrf: 'x', staff: true, readOnly: true };
  const html = renderExercise(sample, boot);
  assert.match(html, /window\.__LAVELS=/);
  assert.doesNotMatch(html, /js\/tracker\.js/);
  const normal = renderExercise(sample, { ...boot, readOnly: false });
  assert.match(normal, /js\/tracker\.js/);
});
