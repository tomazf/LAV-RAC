// SQL DML in posledice pri tujih ključih (LAV-RAČ4, 6. poglavje; 4.6). Connects the published artifact to the exercise shell: the
// portal's storage, one answer per task, four theory groups, the practice items without points left as "Za doma".
// The student changes the school database step by step, in MySQL Workbench or in the portal's SQL sandbox (their own database,
// `sandbox: {"db": "moja"}` in sources.json). The portal never judges the statements: the student runs the control queries and
// types what the server returns (a number, a value, an error code). Tasks keep their control results and points as in 4.5.
// The checkpoint scripts K0 to K6 are served from the page itself (the exercise is one file) and are also templates of the
// sandbox (src/sqlbox.js, TEMPLATES), so that a student can start again from any checkpoint with one click.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { partialCredit } from './qformat.js';

const FILES = ['sola6_ponastavi.sql', 'sola6_k2.sql', 'sola6_k3.sql', 'sola6_k4.sql', 'sola6_k5.sql', 'sola6_k6.sql'];
const FILE_TEXT = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(fileURLToPath(new URL(`../sources/4.6/${f}`, import.meta.url)), 'utf8')]));
const SRC = fs.readFileSync(fileURLToPath(new URL('../sources/4.6.html', import.meta.url)), 'utf8');
// The page's block for the files, cut out of the source so that the patch replaces exactly it.
const OLD_FILES_JS = SRC.slice(SRC.indexOf('/* ---------- datoteke: ZIP'), SRC.indexOf('/* ---------- account sync'));

const ICONS = {
  varno: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l16 6v12c0 10-7 17-16 20C15 40 8 33 8 23V11z"/><path d="M16 24l6 6 11-12"/><path d="M24 5l16 6v12c0 10-7 17-16 20z" class="fill" opacity=".35"/></svg>',
  kopija: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="12" width="26" height="30" rx="3"/><rect x="16" y="6" width="26" height="30" rx="3"/><rect x="16" y="6" width="26" height="30" rx="3" class="fill" opacity=".35"/></svg>',
  spremeni: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34l5-5 22-22 5 5-22 22-5 5-8 3z"/><path d="M30 12l5 5"/><path d="M8 34l5-5 5 5-5 5z" class="fill" opacity=".35"/></svg>',
  referenca: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="16" height="12" rx="3"/><rect x="27" y="28" width="16" height="12" rx="3" class="fill" opacity=".35"/><path d="M21 14h8a6 6 0 0 1 6 6v8M35 28l-3-4M35 28l3-4"/></svg>',
};
// Theory groups (proposed 28. 11. 2026, to be confirmed by the teacher): the nine pages in the artifact's own order, each group
// matching one or two task sets: A (pages 1, 2), B (3), C and D (4, 5), E and F (6, 7, 8, 9).
const GROUPS = [
  { id: 'g-varno', icon: 'varno', title: 'Varno spreminjanje in INSERT', pages: ['uvod', 'insert'] },
  { id: 'g-kopije', icon: 'kopija', title: 'INSERT … SELECT in kopije', pages: ['inssel'] },
  { id: 'g-upd', icon: 'spremeni', title: 'UPDATE in DELETE', pages: ['update', 'delete'] },
  { id: 'g-posl', icon: 'referenca', title: 'Posledice pri tujih ključih', pages: ['posledice', 'branje', 'sirote', 'povzetek'] },
];
// No task is »Sam preveri«: every task has control results (a number, a value or an error code) that the student types.
const PREP = { self: [] };
// In this artifact the blanks check is followed by the SQL one, not by the sorting, so that one replacement has its own anchor.
const PARTIAL = partialCredit.map((p) => (p[0] === '      ok = all;\n    }\n    if(t.type==="cls"){'
  ? ['      ok = all;\n    }\n    if(t.type==="sql"){', p[1].replace('if(t.type==="cls"){', 'if(t.type==="sql"){')] : p));
const TITLE = 'SQL DML in posledice pri tujih ključih';
const KICKER = 'LAV-RAČ4 · 6. poglavje';
const ZAGON = `fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();
renderAll();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  // The windows of the checkpoints (K0 to K6) sit next to the sections, which the shell replaces; they are put back on the page.
  const ktpop = document.getElementById("ktpop");
  const ktNote = document.querySelector("#naloge .prose p"), ktChip = document.querySelector("#naloge .ktchip");
  const sets = LEVELS.map((L,i)=>({ id: L.id, tag: String.fromCharCode(65+i), title: L.title, note: L.note, el: document.getElementById(L.id),
    tasks: T.filter(t=>t.lv===L.tag).map(t=>({ idx: t.idx, el: document.getElementById("t-"+t.id) })) }));
  LavRac.mount({
    title: ${JSON.stringify(TITLE)},
    kicker: ${JSON.stringify(KICKER)},
    root: ".wrap",
    lead: document.querySelector("#hero .lead").textContent.trim(),
    hero: document.querySelector("#hero .magic"),
    source: [...document.querySelectorAll("footer > span:not(#resetWrap)")].map(e=>e.textContent.trim()).join(" "),
    vajeNote: document.querySelector("#naloge .prose").innerHTML + (ktNote ? " " + ktNote.innerHTML : "") + (ktChip ? " " + ktChip.outerHTML : ""),
    groups: ${JSON.stringify(GROUPS.map((g) => ({ ...g, icon: ICONS[g.icon] })))}.map(g=>({ ...g, pages: g.pages.map(id=>({ id, title: title(id), el: document.getElementById(id) })) })),
    sets,
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim(), el: home },
    sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions", extra: ".js-run" },
  });
  if (ktpop) document.body.append(ktpop);
}`;
// The page's own file handling (fetching the .txt files, a ZIP through the claude.ai downloads) is replaced: the text of the
// scripts is in the page, copied or saved as a file from there.
const FILES_JS = `/* ---------- datoteke: kopiranje in prenos ---------- */
const FTXT = ${JSON.stringify(FILE_TEXT).replace(/<\//g, '<\\/')};
document.querySelectorAll(".js-copyfile").forEach(b=>b.addEventListener("click",()=>{
  const f=b.dataset.f, t=FTXT[f], o=b.textContent;
  const done=()=>{ b.textContent="Kopirano: prilepi v Workbench"; setTimeout(()=>b.textContent=o,2200); };
  try { navigator.clipboard.writeText(t).then(done, ()=>fallback(t,done)); } catch(e){ fallback(t,done); }
}));
document.querySelectorAll(".js-getfile").forEach(b=>b.addEventListener("click",()=>{
  const f=b.dataset.f, url=URL.createObjectURL(new Blob([FTXT[f]],{type:"text/plain;charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download=f; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}));
`;
// A script of a checkpoint: a download button in place of the link to the page's own text file.
const fileButtons = FILES.flatMap((f) => {
  const k = f.replace('sola6_', '').replace('.sql', '');
  const label = k === 'ponastavi' ? 'K0' : k.toUpperCase();
  const dl = `<button class="btn primary js-getfile" type="button" data-f="${f}">⬇ Prenesi ${f}</button><button class="btn js-copyfile" type="button" data-f="${f}">Kopiraj</button>`;
  const hint = `<p class="kp-note">V SQL peskovniku portala: Ponastavi mojo bazo, predloga »Poglavje 6: ${label}«.</p>`;
  return [[`<button class="btn primary js-copyfile" type="button" data-f="${f}">Kopiraj ${f}</button><a class="btn ghost" href="${f}.txt" target="_blank" rel="noopener">Odpri ↗</a></div>`, dl + '</div>' + hint]];
});

export default {
  module: 'LAV-RAČ4',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--amber:var(--lr-half);--amber-soft:var(--lr-half-bg);
  --f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}
  .fig{max-width:100%}
  /* long names and statements break instead of widening the page on a phone */
  .q p, ul.shl li, .q code{overflow-wrap:anywhere}
  /* SQL in the questions and explanations: bold, in a tinted box */
  p.qtext code, p.why code, .qtext code{font-weight:700;background:var(--accent-soft);color:var(--fg);padding:.1em .4em}
  /* the result grid of a statement is as wide as its columns, not as wide as the box */
  .wbt table.rel{width:auto}`,
  patches: [
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...PARTIAL,
    ['      ok = all; if(!ok) msg = "Preveri stavek in začetno stanje (kontrolna točka), nato ga izvedi znova.";',
      '      ok = all; if(!ok) msg = "Preveri stavek in začetno stanje (kontrolna točka), nato ga izvedi znova.";\n      part = { right: t.checks.filter((b,k)=>matchBlank($(`#b-${t.id}-${k}`,el).value,b)).length, of: t.checks.length };'],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The page loads a ZIP library from another server, which the exercises may not do; the ZIP is not used.
    ['<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n', ''],
    // The scripts: download buttons in place of the ZIP and of the links to the page's own text files.
    ['<button class="btn primary js-zip" type="button" hidden>⬇ Prenesi ZIP (vse skripte poglavja 6)</button><button class="btn js-copyfile" type="button" data-f="sola6_ponastavi.sql">Kopiraj sola6_ponastavi.sql</button><a class="btn ghost" href="sola6_ponastavi.sql.txt" target="_blank" rel="noopener">Odpri sola6_ponastavi.sql ↗</a><button class="btn js-copyfile" type="button" data-f="matura_baze.sql">Kopiraj matura_baze.sql</button>',
      '<button class="btn primary js-getfile" type="button" data-f="sola6_ponastavi.sql">⬇ Prenesi sola6_ponastavi.sql</button><button class="btn js-copyfile" type="button" data-f="sola6_ponastavi.sql">Kopiraj sola6_ponastavi.sql</button><a class="btn primary" href="/static/matura_baze.sql" download>⬇ Prenesi matura_baze.sql</a>'],
    ...fileButtons,
    // The sandbox: the same states as templates (the note on Safe Updates in a new connection is in the artifact itself).
    ['Podatki poglavja 5 se izgubijo, a jih lahko kadarkoli spet uvoziš s <code>sola.sql</code>.</p>',
      'Podatki poglavja 5 se izgubijo, a jih lahko kadarkoli spet uvoziš s <code>sola.sql</code>.</p><p class="note"><strong>V SQL peskovniku portala</strong> (meni SQL peskovnik, »Moja baza«) ti skripte ni treba prenašati: klikni »Ponastavi mojo bazo« in izberi predlogo »Poglavje 6: K0« (šolska baza in maturitetne tabele). Za vsako kontrolno točko je predloga z njenim imenom. Ponastavitev izbriše vse v tvoji bazi.</p>'],
    [OLD_FILES_JS, FILES_JS + '\n'],
    // The page's account sync and downloads are not used (they run only inside claude.ai).
    ['if(!window.claude || !window.claude.use) return;', 'return;', 'all'],
    // Storage: the portal's state for this student; the artifact's own account sync is not used.
    [`let S = {}, localT = 0;
try { S = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; localT = +localStorage.getItem(STORE+"-t") || 0; } catch(e) { S = {}; }
let remote = null, pushTimer = null, pushing = false, dirty = false;
function saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(S)); localStorage.setItem(STORE+"-t", String(localT)); } catch(e){} }
function save(){ localT = Date.now(); saveLocal(); if(remote){ dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); } }`,
    `let S = {}, localT = 0;
let remote = null, pushTimer = null, pushing = false, dirty = false;
function saveLocal(){ LavRac.saveUi(S); }
function save(){ LavRac.saveUi(S); }`],
    // Task ids exist only from here on, so the shell learns the tasks here.
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace(/[\\/.]/g,"-") : t.key ? t.key : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace(/[\\/.]/g,"-") : t.key ? t.key : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    // One answer per task. Something missing (an empty field) is not an answer yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : (t.pts ? \`Pravilno. +\${ptsLabel(t.pts)}\` : "Pravilno.")) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    // The practice tasks on the explanation pages (lv "P", "Poskusi sam", no points) stay in the page and send nothing to the server.
    `    if(t.lv==="P"){ if(ok){ if(s.state!=="seen") s.state="ok"; save(); } show(ok, ok ? "Pravilno." : ("Ni še pravilno. "+msg).trim()); paint(); return; }
    if(!ok && t.type==="blanks" && t.b.every((_,k)=>!$(\`#b-\${t.id}-\${k}\`,el).value.trim())){ show(false,"Najprej vpiši odgovor."); return; }
    save(); LavRac.answered(t.idx, ok, msg, part);`],
    ['if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      'if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); if(t.lv!=="P") LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; if(t.lv==="P"){ if(s.state!=="ok"){ s.state="seen"; save(); paint(); } } else LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    ['cur = location.hash.slice(1) || "uvod";\n', ''],
    // Start.
    ['fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();\n\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
  ],
};
