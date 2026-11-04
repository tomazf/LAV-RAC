// The portal's name and wording come from content/portal.json; a typo there must stop the start-up with a clear message.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const portal = JSON.parse(readFileSync(path.join(root, 'content/portal.json'), 'utf8'));

test('portal.json is complete', () => {
  for (const key of ['name', 'title', 'about']) assert.ok(String(portal[key]).trim(), key);
  assert.match(portal.slug, /^[a-z][a-z0-9-]*$/);
  assert.ok(portal.school.name && portal.school.url && portal.school.logo);
  assert.ok(readFileSync(path.join(root, 'src/public', portal.school.logo)).length > 0, 'the logo file exists');
});
test('a wrong slug stops the start-up with a message', () => {
  const run = (json) => spawnSync('node', ['--input-type=module', '-e', `
    import fs from 'node:fs';
    const real = fs.readFileSync;
    fs.readFileSync = (f, ...a) => (String(f).endsWith('portal.json') ? ${JSON.stringify(json)} : real(f, ...a));
    await import('./src/portal.js');`], { cwd: root, encoding: 'utf8' });
  const bad = run(JSON.stringify({ ...portal, slug: 'Lav ELS' }));
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /slug/);
  assert.equal(run(JSON.stringify(portal)).status, 0);
});
