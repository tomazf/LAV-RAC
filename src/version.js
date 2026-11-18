// Which version of the code is on the server: the commit that is checked out, read from the files of the repository
// itself (no git program is needed). docker-compose.yml mounts .git into the container read-only. Shown to the admin
// in the footer. It tells which commit was last pulled; it does not prove that the image was built from it.
import fs from 'node:fs';
import path from 'node:path';

const HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/; // SHA-1, or SHA-256 in newer repositories

const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };

// The last bytes of a file, so a long reflog is not read whole.
function tail(file, bytes) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

// HEAD holds a commit (detached) or the name of a branch; the branch is a file of its own, or a line in packed-refs.
function commitOf(gitDir) {
  let value = readText(path.join(gitDir, 'HEAD'))?.trim();
  for (let step = 0; value && step < 5; step += 1) {
    if (HASH.test(value)) return value;
    const name = /^ref:\s*(refs\/\S+)$/.exec(value)?.[1];
    if (!name || name.split('/').includes('..')) return null;
    const loose = readText(path.join(gitDir, name))?.trim();
    if (loose) { value = loose; continue; }
    const packed = readText(path.join(gitDir, 'packed-refs'))?.split('\n').map((l) => l.split(' ')).find(([, n]) => n === name);
    return packed && HASH.test(packed[0]) ? packed[0] : null;
  }
  return null;
}

// The reflog of HEAD has one line per change of HEAD (a commit, a pull, a checkout); the last line is the latest change.
// "<old> <new> Name <email> <unix time> <zone><TAB>message". Used only if that line is about the commit that is shown.
function updatedAt(gitDir, commit) {
  const last = tail(path.join(gitDir, 'logs', 'HEAD'), 16384)?.split('\n').filter(Boolean).pop();
  const m = last && /^\S+ (\S+) .*> (\d{9,11}) [+-]\d{4}(?:\t|$)/.exec(last);
  return m && m[1] === commit ? new Date(Number(m[2]) * 1000) : null;
}

export function readVersion(gitDir) {
  const commit = commitOf(gitDir);
  if (!commit) return null;
  return { commit, short: commit.slice(0, 7), at: updatedAt(gitDir, commit) };
}
