// The version shown to the admin is read from the files of a git repository, without the git program.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ejs from 'ejs';
import * as fmt from '../src/format.js';
import { readVersion } from '../src/version.js';

const dirs = [];
const A = 'a'.repeat(40);
const B = '0123456789abcdef0123456789abcdef01234567';
const entry = (from, to, time, what) => `${from} ${to} Tomaž Ferbežar <t@sola.test> ${time} +0100\t${what}\n`;
// A fake .git folder with the given files (path -> content).
function gitDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'lavgit-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test('a branch in HEAD: the commit comes from the branch file, the time from the last line of the reflog', () => {
  const dir = gitDir({
    HEAD: 'ref: refs/heads/main\n',
    'refs/heads/main': `${B}\n`,
    'logs/HEAD': entry('0'.repeat(40), A, 1794000000, 'clone') + entry(A, B, 1794260400, 'pull: Fast-forward'),
  });
  const v = readVersion(dir);
  assert.equal(v.commit, B);
  assert.equal(v.short, '0123456');
  assert.equal(v.at.toISOString(), '2026-11-09T21:40:00.000Z');
});
test('a branch that is only in packed-refs (after git gc) is found; peeled lines and the header are skipped', () => {
  const dir = gitDir({
    HEAD: 'ref: refs/heads/main\n',
    'packed-refs': `# pack-refs with: peeled fully-peeled sorted\n${A} refs/heads/other\n${B} refs/heads/main\n^${A}\n${A} refs/tags/v1\n`,
  });
  assert.equal(readVersion(dir).commit, B);
});
test('a detached HEAD holds the commit itself', () => {
  assert.equal(readVersion(gitDir({ HEAD: `${B}\n` })).commit, B);
});
test('the time is left out when the last line of the reflog is about another commit, or there is no reflog', () => {
  const other = gitDir({ HEAD: `${B}\n`, 'logs/HEAD': entry(B, A, 1794260400, 'checkout: moving') });
  assert.equal(readVersion(other).at, null);
  assert.equal(readVersion(gitDir({ HEAD: `${B}\n` })).at, null);
});
test('a long reflog is not a problem: the last line counts', () => {
  const lines = Array.from({ length: 400 }, (_, i) => entry(A, A, 1700000000 + i, 'commit: a rather long message to make the log big enough')).join('');
  const dir = gitDir({ HEAD: `${B}\n`, 'logs/HEAD': lines + entry(A, B, 1794260400, 'pull') });
  assert.ok(lines.length > 16384);
  assert.equal(readVersion(dir).at.toISOString(), '2026-11-09T21:40:00.000Z');
});
test('nothing usable: no folder, an empty or broken HEAD, a branch that does not exist, a path that leaves refs/', () => {
  assert.equal(readVersion(path.join(tmpdir(), 'lavgit-does-not-exist')), null);
  assert.equal(readVersion(gitDir({ HEAD: '' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'not a commit\n' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'abc1234\n' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'ref: refs/heads/main\n' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'ref: refs/heads/main\n', 'refs/heads/main': 'garbage\n' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'ref: refs/../../etc/passwd\n' })), null);
  assert.equal(readVersion(gitDir({ HEAD: 'ref: /etc/passwd\n' })), null);
});
test('this repository: the same commit as git says', (t) => {
  const repo = path.resolve(import.meta.dirname, '..', '.git');
  if (!existsSync(repo)) return t.skip('no .git folder');
  let expected;
  try { expected = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.dirname(repo), encoding: 'utf8' }).trim(); } catch { return t.skip('no git program'); }
  assert.equal(readVersion(repo).commit, expected);
});

// The footer: the version is for the admin only.
const foot = (data) => ejs.renderFile(path.resolve(import.meta.dirname, '../src/views/partials/foot.ejs'), { fmt, path: '/', user: null, version: null, ...data });
test('the footer shows the version to the admin only', async () => {
  const version = { commit: B, short: '0123456', at: new Date('2026-11-09T21:40:00Z') };
  const admin = await foot({ user: { isAdmin: true }, version });
  assert.match(admin, /Koda na strežniku: <span title="0123456789abcdef0123456789abcdef01234567">0123456<\/span>, posodobljeno <span class="nw">9\. 11\. 2026, 22:40<\/span><\/p>/);
  assert.match(await foot({ user: { isAdmin: true }, version: { ...version, at: null } }), /<span[^>]*>0123456<\/span><\/p>/);
  assert.match(await foot({ user: { isAdmin: true }, version: null }), /Koda na strežniku: različica ni znana/);
  for (const user of [null, { isAdmin: false, isTeacher: true }, { isAdmin: false }]) {
    assert.doesNotMatch(await foot({ user, version }), /Koda na strežniku|0123456/);
  }
  assert.doesNotMatch(await foot({ user: { isAdmin: true }, version, path: '/zasebnost' }), /Koda na strežniku/);
});
