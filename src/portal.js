// What makes this portal this portal: name, wording and school. Everything else is the same for every portal.
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(import.meta.dirname, '../content/portal.json');
export const portal = JSON.parse(fs.readFileSync(file, 'utf8'));
const bad = (what) => { console.error(`content/portal.json: ${what}`); process.exit(1); };
for (const key of ['name', 'title', 'about']) if (typeof portal[key] !== 'string' || !portal[key].trim()) bad(`manjka "${key}"`);
// The slug names the session cookie, backup files and the record of erased users, so it must stay the same once the portal is in use.
if (!/^[a-z][a-z0-9-]*$/.test(portal.slug ?? '')) bad('"slug" mora biti iz malih črk, številk in vezajev (npr. "lavels")');
if (portal.school && !(portal.school.name && portal.school.url && portal.school.logo)) bad('"school" potrebuje "name", "url" in "logo"');
portal.plannedModules ??= [];
// Years (letniki): which group of exercises each year works on, e.g. { "2": "LAV-RAČ2" }. Empty means classes have no year.
portal.years ??= {};
if (typeof portal.years !== 'object' || Object.entries(portal.years).some(([y, m]) => !/^[1-9]$/.test(y) || typeof m !== 'string')) bad('"years" mora biti npr. { "2": "LAV-RAČ2" }');
