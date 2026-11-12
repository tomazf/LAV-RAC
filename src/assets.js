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
// The text font (both subsets, both weights) is on every page. Preloading it starts the download with the page, so the
// text is not drawn in the fallback font first and then jumps when the real font arrives. The address must be the one
// fonts.css uses (no ?v=), and a font preload always needs crossorigin.
export const fontPreloads = ['latin-400', 'latin-ext-400', 'latin-700', 'latin-ext-700']
  .map((f) => `<link rel="preload" href="/static/fonts/atkinson-hyperlegible-${f}-normal.woff2" as="font" type="font/woff2" crossorigin>`)
  .join('\n');
