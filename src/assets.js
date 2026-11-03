// A version for static files, taken from their content, so browsers load new files right after an update.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, 'public');
const hash = crypto.createHash('sha256');
for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.join(e.parentPath, e.name))
  .sort()) {
  hash.update(entry.slice(root.length)).update(fs.readFileSync(entry));
}
export const assetVersion = hash.digest('hex').slice(0, 12);
export const asset = (file) => `/static/${file}?v=${assetVersion}`;
