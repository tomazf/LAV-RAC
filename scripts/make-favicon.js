// Developer tool: builds src/public/favicon.ico from src/public/favicon.svg (16, 32 and 48 px, PNG inside ICO).
// Usage: node scripts/make-favicon.js
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.resolve(import.meta.dirname, '../src/public');
const svg = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
const sizes = [16, 32, 48];
const browser = await chromium.launch();
const pngs = [];
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s, height: s } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${s}px;height:${s}px}</style>${svg}`);
  pngs.push(await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, k) => {
  const e = 6 + 16 * k;
  head.writeUInt8(s, e);
  head.writeUInt8(s, e + 1);
  head.writeUInt16LE(1, e + 4);
  head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[k].length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += pngs[k].length;
});
fs.writeFileSync(path.join(pub, 'favicon.ico'), Buffer.concat([head, ...pngs]));
console.log('favicon.ico', offset, 'bytes');
