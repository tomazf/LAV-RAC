// Developer tool: imports exercises from a folder of published pages into content/.
// Usage: node scripts/import-exercises.js <source-dir>   (expects <source-dir>/<id>.html)
// Applies the LAV-ELS name, local fonts and portal wording, then generates content/catalog.json.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const MODULES = [
  { id: 1, title: 'Logična vrata in Booleova algebra' },
  { id: 2, title: 'Številski sistemi in kodiranje' },
  { id: 3, title: 'Sestavljena kombinacijska vezja' },
];
const EXERCISES = [
  ['1.1', 'Logični nivoji in spremenljivke'], ['1.2', 'Logične operacije in vrata'],
  ['1.3', 'Booleova algebra in minimizacija'], ['1.4', 'Analiza in sinteza vezij'],
  ['2.1', 'Številski sistemi'], ['2.2', 'Kodiranje in pariteta'],
  ['3.1', 'Binarni seštevalniki'], ['3.2', 'Kodirnik in dekodirnik'], ['3.3', 'MUX, DEMUX in primerjalnik'],
];
const src = process.argv[2];
if (!src) { console.error('Usage: import-exercises.js <source-dir>'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'content/exercises');
fs.mkdirSync(outDir, { recursive: true });
const FONT_RE = /<link href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const WRAP_END = '\n</body></html>';

function unwrap(html) {
  const mark = '</head><body>\n';
  if (html.startsWith('<!doctype html><html><head><meta charset=utf8>') && html.endsWith(WRAP_END)) {
    return html.slice(html.indexOf(mark) + mark.length, -WRAP_END.length);
  }
  return html;
}
function transform(html, id) {
  let s = unwrap(html);
  s = s.replaceAll('LAV-ELE', 'LAV-ELS');
  if (!FONT_RE.test(s)) throw new Error(`${id}: font link not found`);
  s = s.replace(FONT_RE, '<link href="/static/fonts/fonts.css" rel="stylesheet">');
  s = s.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
  s = s.replaceAll('v tem brskalniku', 'v tvojem računu');
  const note = ' Učitelj bo videl ponastavitev in prejšnji rezultat.';
  const withNote = s.replace(/(<span>)([^<]*\?)(<\/span><button class="btn danger sm" id="resetYes")/, `$1$2${note}$3`);
  if (withNote === s) throw new Error(`${id}: reset question not found`);
  s = withNote;
  const BOOT = '<!--LAVELS:BOOT-->';
  if (/^<!doctype/i.test(s.trimStart())) {
    s = s.replace(/<head>\n?/, `<head>\n${BOOT}\n`);
  } else {
    s = `<!doctype html>\n<html lang="sl"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${BOOT}\n${s}\n</html>\n`;
  }
  const tasks = s.indexOf('const TASKS=[');
  if (tasks >= 0) {
    const end = s.indexOf('</script>', tasks) + '</script>'.length;
    s = `${s.slice(0, end)}\n<!--LAVELS:VARIANTS-->${s.slice(end)}`;
  }
  if (!s.includes(BOOT)) throw new Error(`${id}: boot marker missing`);
  return s;
}

const browser = await chromium.launch();
const catalog = { modules: MODULES, exercises: [] };
let current = '';
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(current);
}).listen(0);
const port = server.address().port;

for (const [id, title] of EXERCISES) {
  const html = transform(fs.readFileSync(path.join(src, `${id}.html`), 'utf8'), id);
  fs.writeFileSync(path.join(outDir, `${id}.html`), html);
  current = html;
  const key = html.match(/scnm_lavele_\d_\d_v\d+/)?.[0];
  if (!key) throw new Error(`${id}: progress key not found`);
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/\/static\//, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => {
    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const tasks = [...document.querySelectorAll('.task')].map((c) => {
      const lv = clean(c.querySelector('.lvt')?.textContent).toLowerCase();
      const crumb = clean(c.querySelector('.crumb span')?.textContent);
      return {
        i: Number(c.id.replace(/^t/, '')),
        level: lv.split(' ')[0],
        max: Number(lv.match(/(\d+)\s*t/)?.[1]),
        section: crumb.split(' · ')[1] || '',
        q: clean(c.querySelector('.qt, .q')?.textContent).slice(0, 160),
      };
    });
    const pages = [...document.querySelectorAll('.page')].map((p) => {
      const crumb = clean(p.querySelector(':scope > .crumb span')?.textContent);
      const parts = crumb.split(' · ');
      return { id: p.id, chapter: p.dataset.grp || parts[0] || 'Naloge', label: parts[1] || parts[0] || p.id };
    });
    return { tasks, pages, hasReset: !!document.getElementById('resetBtn'), max: Number(document.getElementById('mx')?.textContent) };
  });
  if (errors.length) throw new Error(`${id}: page errors ${errors[0]}`);
  if (!data.hasReset) throw new Error(`${id}: no reset button`);
  const bad = data.tasks.find((t) => !Number.isInteger(t.i) || ![1, 2, 3].includes(t.max));
  if (bad) throw new Error(`${id}: bad task ${JSON.stringify(bad)}`);
  const sum = data.tasks.reduce((a, t) => a + t.max, 0);
  if (sum !== data.max) throw new Error(`${id}: points ${sum} != ${data.max}`);
  const bigChap = data.pages.filter((p) => !['Teorija', 'Simulacija', 'Naloge'].includes(p.chapter));
  if (bigChap.length) throw new Error(`${id}: unknown chapter ${bigChap[0].chapter}`);
  catalog.exercises.push({
    id, module: Number(id[0]), title, fullTitle: await page.evaluate(() => document.querySelector('header h1')?.childNodes[0]?.textContent?.trim()),
    key, version: Number(key.match(/_v(\d+)$/)[1]),
    format: /st\.hinted|hinted:/.test(html) ? 'long' : 'short',
    maxPoints: sum, tasks: data.tasks, pages: data.pages,
  });
  console.log(id, key, `${data.tasks.length} nalog, ${sum} t, ${data.pages.length} strani`);
  await page.context().close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(root, 'content/catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
const tot = catalog.exercises.reduce((a, e) => [a[0] + e.tasks.length, a[1] + e.maxPoints], [0, 0]);
console.log('Skupaj', tot[0], 'nalog', tot[1], 'točk');
