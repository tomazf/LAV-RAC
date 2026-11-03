// Developer tool: copies Latin and Latin Extended font files so the site makes no requests to Google.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'src/public/fonts');
fs.mkdirSync(out, { recursive: true });
let css = '';
for (const [pkg, weights] of [['atkinson-hyperlegible', [400, 700]], ['ibm-plex-mono', [400, 500, 600]]]) {
  const dir = path.join(root, 'node_modules/@fontsource', pkg);
  for (const w of weights) {
    for (const sub of ['latin', 'latin-ext']) {
      const file = `${pkg}-${sub}-${w}-normal.woff2`;
      fs.copyFileSync(path.join(dir, 'files', file), path.join(out, file));
      const block = fs.readFileSync(path.join(dir, `${sub}-${w}.css`), 'utf8');
      const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
      const family = block.match(/font-family:\s*'([^']+)'/)[1];
      css += `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${w};src:url(${file}) format("woff2");${range ? `unicode-range:${range};` : ''}}\n`;
    }
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log(fs.readdirSync(out).length, 'files');
