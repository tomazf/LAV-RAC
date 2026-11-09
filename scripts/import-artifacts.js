// Developer tool: builds the exercises from the published artifacts in content/sources.
// Usage: npm run import            (all exercises in content/sources.json)
//        npm run import -- 3.1     (only these)
// For every exercise: content/sources/<id>.html is the artifact as published, content/adapters/<id>.js says
// how it connects to the shell (content/shell). The result is content/exercises/<id>.html and content/catalog.json.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const C = (...p) => path.join(root, 'content', ...p);
const sources = JSON.parse(fs.readFileSync(C('sources.json'), 'utf8'));
const only = process.argv.slice(2);
const shellJs = fs.readFileSync(C('shell/vaja.js'), 'utf8');
const shellCss = fs.readFileSync(C('shell/vaja.css'), 'utf8');
const WRAP_START = '</head><body>\n';
const WRAP_END = '\n</body></html>';

// A published artifact comes wrapped in a small page of its own; only the artifact's part is kept.
function unwrap(html) {
  const a = html.indexOf(WRAP_START);
  if (html.startsWith('<!doctype html><html><head><meta charset=utf8>') && a > 0 && html.trimEnd().endsWith('</body></html>')) {
    return html.slice(a + WRAP_START.length, html.trimEnd().length - WRAP_END.trim().length).trim();
  }
  return html;
}
function patch(s, [from, to, mode], id) {
  const n = s.split(from).length - 1;
  if (mode === 'all') { if (!n) throw new Error(`${id}: not found: ${from.slice(0, 80)}`); return s.split(from).join(to); }
  if (n !== 1) throw new Error(`${id}: expected once, found ${n}: ${from.slice(0, 80)}`);
  return s.replace(from, () => to);
}
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');

function build(id, src, adapter) {
  let s = unwrap(src);
  // Everything is served by the portal: no outside fonts, no artifact-only tags.
  s = s.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '');
  s = s.replace(/<meta name="claude:[^>]*>\n?/g, '');
  if (/https?:\/\/fonts\./.test(s)) throw new Error(`${id}: outside font left`);
  for (const p of adapter.patches) s = patch(s, p, id);
  // The artifact's head part (title, styles) goes into <head>, the rest into <body>.
  const firstScript = s.indexOf('<script');
  const headEnd = s.lastIndexOf('</style>', firstScript) + '</style>'.length;
  if (headEnd < 8) throw new Error(`${id}: no style before the script`);
  const head = s.slice(0, headEnd).trim();
  const body = s.slice(headEnd).trim();
  return `<!doctype html>
<html lang="sl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!--LAVELS:BOOT-->
<!-- LAV-RAČ: built by scripts/import-artifacts.js from content/sources/${id}.html. Do not edit, run the import. -->
<script>
${safe(shellJs)}
</script>
<link href="/static/fonts/fonts.css" rel="stylesheet">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
${head}
<style>
${shellCss}
${adapter.css || ''}
</style>
</head><body>
${body}
</body></html>
`;
}

const browser = await chromium.launch();
let current = '';
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/static/')) { res.setHeader('content-type', 'text/css'); return res.end(''); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // The same rules as the portal's exercise pages (src/server.js), so a page that breaks there breaks here.
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'");
  res.end(current);
}).listen(0);
const port = server.address().port;
const old = fs.existsSync(C('catalog.json')) ? JSON.parse(fs.readFileSync(C('catalog.json'), 'utf8')).exercises : [];
const built = [];
fs.mkdirSync(C('exercises'), { recursive: true });
for (const src of sources.exercises) {
  if (only.length && !only.includes(src.id)) { const keep = old.find((e) => e.id === src.id); if (keep) built.push(keep); continue; }
  const adapter = (await import(pathToFileURL(C('adapters', `${src.id}.js`)).href)).default;
  const html = build(src.id, fs.readFileSync(C('sources', `${src.id}.html`), 'utf8'), adapter);
  current = html;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => window.LavRac && window.LavRac.catalog());
  await ctx.close();
  if (errors.length) throw new Error(`${src.id}: page error: ${errors[0]}`);
  if (!data || !data.tasks.length) throw new Error(`${src.id}: the shell found no tasks`);
  if (data.tasks.some((t, k) => t.i !== k || !(t.max > 0))) throw new Error(`${src.id}: tasks are not numbered 0..n-1 with points`);
  // The sets are lettered A, B, C … without a gap, and Za doma takes the next letter (the shell does that itself).
  if (!data.tags || data.tags.some((t, k) => t !== String.fromCharCode(65 + k))) throw new Error(`${src.id}: set letters have a gap or do not start with A: ${(data.tags || []).join(' ')}`);
  const key = `scnm_lavrac_${src.id.replace('.', '_')}_v${src.version}`;
  const maxPoints = data.tasks.reduce((a, t) => a + t.max, 0);
  fs.writeFileSync(C('exercises', `${src.id}.html`), html);
  built.push({
    id: src.id, no: src.no ?? src.id, module: adapter.module, title: adapter.title, fullTitle: adapter.title, key, version: src.version,
    format: 'short', maxPoints, tasks: data.tasks, pages: data.pages, gate: data.gate,
  });
  console.log(src.id, key, `${data.tasks.length} nalog, ${maxPoints} točk, ${data.pages.length} strani, ${data.gate.length} razlag pred vajami`);
}
await browser.close();
server.close();
const order = sources.exercises.map((e) => e.id);
built.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
// Only parts with exercises are modules; the others stay "V pripravi" (content/portal.json).
const modules = sources.modules.filter((m) => built.some((e) => e.module === m.id));
// (a part with only planned chapters stays a planned part, content/portal.json)
// Chapters that have a place but no content yet (sources.json "planned"), shown to staff as "V pripravi".
const planned = (sources.planned || []).filter((p) => !built.some((e) => e.module === p.module && e.no === p.no));
fs.writeFileSync(C('catalog.json'), JSON.stringify({ modules, exercises: built, planned }, null, 1) + '\n');
console.log('Skupaj', built.length, 'vaj');
