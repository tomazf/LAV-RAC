// SQL DDL in integritetne omejitve (LAV-RAČ4, 4. poglavje). Connects the published artifact to the exercise shell: the portal's
// storage, one answer per task, five theory groups, the revision set from the Za doma page kept last among the exercises
// as "Ponavljanje" (as in 4.1 to 4.3), the practice items without points left as "Za doma".
// The tasks where the student writes SQL statements (type "sql", 28 tasks) are »Sam preveri« (agreed 18. 11. 2026 for code
// tasks, 21. 11. 2026 for this chapter): the statements are written and run in MySQL Workbench, the portal cannot judge them,
// so there are no points; the control results are shown to compare with, the hint and the solution stay. What the student
// typed in the window is kept by the portal. The three SQL files of the page are downloaded from the page itself
// (the page carries their text), because the exercise is one file.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { partialCredit } from './qformat.js';

const FILES = ['sola_struktura.sql', 'sola_zacetni_podatki.sql', 'indeks_test.sql'];
const FILE_TEXT = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(fileURLToPath(new URL(`../sources/4.4/${f}`, import.meta.url)), 'utf8')]));

// The page's block for the files, cut out of the source so the patch replaces exactly it.
const SRC = fs.readFileSync(fileURLToPath(new URL('../sources/4.4.html', import.meta.url)), 'utf8');
const OLD_FILES_JS = SRC.slice(SRC.indexOf('/* ---------- datoteke: ZIP'), SRC.indexOf('/* ---------- account sync'));

const ICONS = {
  baza: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="11" rx="16" ry="6"/><path d="M8 11v26c0 3.3 7.2 6 16 6s16-2.7 16-6V11M8 24c0 3.3 7.2 6 16 6s16-2.7 16-6"/><ellipse cx="24" cy="11" rx="16" ry="6" class="fill" opacity=".35"/></svg>',
  tabela: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="10" width="38" height="28" rx="3"/><path d="M5 20h38M17 10v28"/><rect x="5" y="10" width="12" height="28" rx="3" class="fill" opacity=".35"/></svg>',
  referenca: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="16" height="12" rx="3"/><rect x="27" y="28" width="16" height="12" rx="3" class="fill" opacity=".35"/><path d="M21 14h8a6 6 0 0 1 6 6v8M35 28l-3-4M35 28l3-4"/></svg>',
  lab: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 6v14L8 38a3 3 0 0 0 2.6 4.5h26.8A3 3 0 0 0 40 38L30 20V6M15 6h18"/><path d="M13 32h22" /><path d="M10 38l3-6h22l3 6z" class="fill" opacity=".35"/></svg>',
  spremeni: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34l5-5 22-22 5 5-22 22-5 5-8 3z"/><path d="M30 12l5 5"/><path d="M8 34l5-5 5 5-5 5z" class="fill" opacity=".35"/></svg>',
};
// Theory groups (proposed 21. 11. 2026, to be confirmed by the teacher): pages in the artifact's own order, matching the task sets
// A (tipi, CREATE TABLE), B (ključi, referenčna integriteta, CHECK), C (šolska baza), D (preizkus omejitev), E (ALTER ... dokumentiranje).
const GROUPS = [
  { id: 'g-baza', icon: 'baza', title: 'Od diagrama ER do baze', pages: ['uvod', 'baza', 'tipi'] },
  { id: 'g-tabela', icon: 'tabela', title: 'Tabela in ključi', pages: ['create', 'kljuci', 'tuji'] },
  { id: 'g-ref', icon: 'referenca', title: 'Referenčna integriteta in CHECK', pages: ['ref', 'check'] },
  { id: 'g-lab', icon: 'lab', title: 'Šolska baza v praksi', pages: ['lab', 'preizkus'] },
  { id: 'g-spr', icon: 'spremeni', title: 'Spreminjanje, indeksi in povzetek', pages: ['alter', 'drop', 'indeksi', 'dokumentiranje', 'povzetek'] },
];
// Every task where the student writes SQL (set letter and place in the set, as the teacher sees them in the artifact).
const PREP = {
  self: ['A6', 'A7', 'A8', 'A9', 'B13', 'B14', 'C1', 'C2', 'C3', 'C4', 'C5', 'C7', 'C8', 'C9', 'C11', 'D3', 'D4', 'D5', 'D6', 'D7', 'D9', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E12'],
};
// In this artifact the blanks check is followed by the SQL one, not by the sorting, so that one replacement has its own anchor.
const PARTIAL = partialCredit.map((p) => (p[0] === '      ok = all;\n    }\n    if(t.type==="cls"){'
  ? ['      ok = all;\n    }\n    if(t.type==="sql"){', p[1].replace('if(t.type==="cls"){', 'if(t.type==="sql"){')] : p));
const TITLE = 'SQL DDL in integritetne omejitve';
const KICKER = 'LAV-RAČ4 · 4. poglavje';
const ZAGON = `fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();
renderAll();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  const sets = LEVELS.map((L,i)=>({ id: L.id, tag: String.fromCharCode(65+i), title: L.title, note: L.note, el: document.getElementById(L.id),
    tasks: T.filter(t=>t.lv===L.tag).map(t=>({ idx: t.idx, el: document.getElementById("t-"+t.id) })) }));
  LavRac.mount({
    title: ${JSON.stringify(TITLE)},
    kicker: ${JSON.stringify(KICKER)},
    root: ".wrap",
    lead: document.querySelector("#hero .lead").textContent.trim(),
    hero: document.querySelector("#hero .magic"),
    source: [...document.querySelectorAll("footer > span:not(#resetWrap)")].map(e=>e.textContent.trim()).join(" "),
    vajeNote: document.querySelector("#naloge .prose").innerHTML,
    groups: ${JSON.stringify(GROUPS.map((g) => ({ ...g, icon: ICONS[g.icon] })))}.map(g=>({ ...g, pages: g.pages.map(id=>({ id, title: title(id), el: document.getElementById(id) })) })),
    sets,
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim().replace(/^Najprej .*?, nato praktične vaje/, "Vaje"), el: home },
    sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions", extra: ".js-run" },
  });
}`;
// The page's own file handling (fetching the .txt files, a ZIP through the claude.ai downloads) is replaced: the text of the
// three files is in the page, copied or saved as a file from there.
const FILES_JS = `/* ---------- datoteke: kopiranje in prenos ---------- */
const FTXT = ${JSON.stringify(FILE_TEXT)};
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

// Question and explanation texts: the source's own markup (<code>, <b>) is read as markup, and SQL statements written
// in plain text are set in code, so that they stand out from the Slovene text (21. 11. 2026).
const SQL_START = /\b(?:CREATE TABLE(?=\s+[\w.]+\s*\()|CREATE DATABASE(?=\s+\w)|CREATE INDEX(?=\s+\w+\s+ON\b)|ALTER TABLE(?=\s+[\w.]+\s+(?:ADD|DROP|MODIFY|CHANGE|ALTER|RENAME)\b)|DROP TABLE(?=\s+IF EXISTS\b|\s+[\w.]+\s*(?:[;.?]|$)|\s*[.?]?$)|DROP DATABASE(?=\s+\w)|TRUNCATE TABLE(?=\s+\w)|INSERT INTO(?=\s+[\w.]+\s*(?:\(|VALUES\b))|UPDATE(?=\s+[\w.]+\s+SET\b)|DELETE FROM(?=\s+[\w.]+(?:\s+WHERE\b|\s*[;.?]|\s*$))|SELECT(?=\s+(?:\*|COUNT\s*\(|[\w.,()*\s]+?\s+FROM\b)))/g;
function wrapSql(plain){
  let out = '', i = 0;
  for (;;) {
    SQL_START.lastIndex = i;
    const m = SQL_START.exec(plain);
    if (!m) return out + plain.slice(i);
    out += plain.slice(i, m.index);
    let j = m.index, depth = 0;
    for (; j < plain.length; j++) {
      const c = plain[j];
      if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (c === '.' || c === '?' || c === '!' || c === ';' || c === '\n') && (j + 1 >= plain.length || /\s/.test(plain[j + 1]))) {
        if (c === ';') j++;
        break;
      }
    }
    const stmt = plain.slice(m.index, j).trimEnd();
    out += '<code>' + stmt + '</code>';
    i = m.index + stmt.length;
  }
}
const fixText = (s) => {
  if (typeof s !== 'string') return s;
  s = s.replace(/<(b|strong)>([\s\S]*?)<\/\1>/g, '**$2**');
  return s.split(/(<code>[\s\S]*?<\/code>|`[^`]*`|\*\*[\s\S]*?\*\*)/).map((p, k) => (k % 2 ? p : wrapSql(p))).join('');
};
const LINES = SRC.split('\n');
const toJs = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
const TASKS_LINE = LINES.find((l) => l.startsWith('const T = '));
const TRY_LINE = LINES.find((l) => l.startsWith('const TRY = '));
const FMTQ_LINE = LINES.find((l) => l.startsWith('const fmtQ = '));
const TASKS_SRC = JSON.parse(TASKS_LINE.slice('const T = '.length).replace(/;$/, ''));
const TRY_SRC = JSON.parse(TRY_LINE.slice('const TRY = '.length).replace(/;$/, ''));
for (const t of TASKS_SRC) { t.q = fixText(t.q); t.why = fixText(t.why); }
// The practice tasks on the explanation pages get their own label (they had none: "undefined. naloga").
for (const t of TRY_SRC) { t.q = fixText(t.q); t.why = fixText(t.why); t.tryLabel = 'Naloga ' + t.key.slice(1); }

// The ER diagram of the first page: full screen, and a print sheet of the figure alone (the browser saves it as PDF).
const ER_JS = `document.addEventListener("click", (e) => {
  const fig = document.getElementById("erfig");
  if (!fig) return;
  if (e.target.closest(".js-er-full")) {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (fig.requestFullscreen) fig.requestFullscreen();
  }
  if (e.target.closest(".js-er-pdf")) {
    document.body.classList.add("er-print");
    const done = () => { document.body.classList.remove("er-print"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }
});
`;

export default {
  module: 'LAV-RAČ4',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--amber:var(--lr-half);--amber-soft:var(--lr-half-bg);
  --f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}
  /* the wide schema figure scrolls inside its box instead of widening the page */
  .fig{max-width:100%}
  /* long names and statements break instead of widening the page on a phone */
  .q p, ul.shl li, .q code{overflow-wrap:anywhere}
  /* SQL in the questions and explanations: bold, in a tinted box */
  p.qtext code, p.why code, .qtext code{font-weight:700;background:var(--accent-soft);color:var(--fg);padding:.1em .4em}
  /* the ER figure: a button row above it; full screen and print show the figure alone */
  .erbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  figure.schemafig:fullscreen{background:var(--surface);padding:24px;overflow:auto;display:flex;align-items:center;justify-content:center;max-width:none;border:0}
  figure.schemafig:fullscreen svg.schema{min-width:0;width:min(100%,1400px);height:auto}
  @media print{
    body.er-print *{visibility:hidden!important}
    body.er-print #erfig, body.er-print #erfig *{visibility:visible!important}
    body.er-print #erfig{position:absolute;left:0;top:0;width:100%;border:0;background:#fff;--fg:#111;--surface:#fff;--bg:#fff;--muted:#444;--line:#999;color:#111}
    body.er-print #erfig .erbar{display:none}
    body.er-print #erfig svg.schema{min-width:0;width:100%;height:auto}
  }
  /* the result grid of a statement is as wide as its columns, not as wide as the box */
  .wbt table.rel{width:auto}`,
  patches: [
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...PARTIAL,
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The page loads a ZIP library from another server, which the exercises may not do; the ZIP is not used.
    ['<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>', ''],
    // The three SQL files: a download button in place of the ZIP and of the links to the page's own text files.
    ['<button class="btn primary js-zip" type="button" hidden>⬇ Prenesi ZIP (sola_struktura, začetni podatki, indeks_test)</button>', ''],
    ['<button class="btn js-copyfile" type="button" data-f="sola_struktura.sql">Kopiraj sola_struktura.sql</button><a class="btn ghost" href="sola_struktura.sql.txt" target="_blank" rel="noopener">Odpri sola_struktura.sql ↗</a>',
      '<button class="btn primary js-getfile" type="button" data-f="sola_struktura.sql">⬇ Prenesi sola_struktura.sql</button><button class="btn js-copyfile" type="button" data-f="sola_struktura.sql">Kopiraj sola_struktura.sql</button>'],
    ['<button class="btn js-copyfile" type="button" data-f="sola_zacetni_podatki.sql">Kopiraj sola_zacetni_podatki.sql</button><a class="btn ghost" href="sola_zacetni_podatki.sql.txt" target="_blank" rel="noopener">Odpri datoteko ↗</a>',
      '<button class="btn primary js-getfile" type="button" data-f="sola_zacetni_podatki.sql">⬇ Prenesi sola_zacetni_podatki.sql</button><button class="btn js-copyfile" type="button" data-f="sola_zacetni_podatki.sql">Kopiraj sola_zacetni_podatki.sql</button>'],
    ['<button class="btn js-copyfile" type="button" data-f="indeks_test.sql">Kopiraj indeks_test.sql</button><a class="btn ghost" href="indeks_test.sql.txt" target="_blank" rel="noopener">Odpri indeks_test.sql ↗</a>',
      '<button class="btn primary js-getfile" type="button" data-f="indeks_test.sql">⬇ Prenesi indeks_test.sql</button><button class="btn js-copyfile" type="button" data-f="indeks_test.sql">Kopiraj indeks_test.sql</button>'],
    [OLD_FILES_JS, FILES_JS + '\n'],
    // The revision set (artifact id "doma", which is also the id of the Za doma section) is "Ponavljanje" and gets its
    // own id; the shell lettering puts it after the sets A–E, and Za doma takes the next letter.
    ['{"id": "doma", "tag": "H", "title": "Maturitetne naloge za ponavljanje", "note": "Naloge iz prejšnjih let za utrjevanje; štejejo k točkam.", "home": true}',
      '{"id": "doma-mat", "tag": "H", "title": "Ponavljanje", "note": "Maturitetne naloge iz prejšnjih let za utrjevanje; štejejo k točkam.", "home": true}'],
    // The tasks that write SQL are »Sam preveri«: no inputs for the control results, the results are shown to compare with.
    ['    body += `<div class="chk"><div class="lbl">Kontrolni rezultat</div>` + t.checks.map((b,k)=>`<div class="blank"><label for="b-${t.id}-${k}">${esc(b.l)}</label><input type="text" id="b-${t.id}-${k}" class="mono" autocomplete="off" spellcheck="false" autocapitalize="off"></div>`).join("") + `</div>`;',
      '    if(!t.self) body += `<div class="chk"><div class="lbl">Kontrolni rezultat</div>` + t.checks.map((b,k)=>`<div class="blank"><label for="b-${t.id}-${k}">${esc(b.l)}</label><input type="text" id="b-${t.id}-${k}" class="mono" autocomplete="off" spellcheck="false" autocapitalize="off"></div>`).join("") + `</div>`;\n    else body += `<div class="lr-tests"><b>Pravilni kontrolni rezultati za preverjanje</b><ul>` + t.checks.map(b=>`<li>${esc(b.l)}: <code>${esc(b.acc[0])}</code></li>`).join("") + `</ul></div>`;'],
    ['<span>${t.edl?"Izvedi v Workbenchu, nato vpiši kontrolni rezultat.":"Izvedi jo v Workbenchu, nato vpiši kontrolni rezultat."}</span>',
      '<span>${t.self ? "Stavke izvedi v MySQL Workbenchu in primerjaj kontrolne rezultate s spodnjimi. Besedilo lahko shraniš tu." : (t.edl?"Izvedi v Workbenchu, nato vpiši kontrolni rezultat.":"Izvedi jo v Workbenchu, nato vpiši kontrolni rezultat.")}</span>'],
    // What the student types in the window is the answer the portal keeps for such a task.
    ['  if(sq){ if(s.q) sq.value = s.q; sq.addEventListener("input",()=>{ s.q = sq.value; save(); });',
      '  if(sq){ if(t.self && s.v && typeof s.v[0]==="string") sq.value = s.v[0]; else if(s.q) sq.value = s.q; sq.addEventListener("input",()=>{ if(t.self) s.v = [sq.value]; else s.q = sq.value; save(); });'],
    ['sq.value=sq.value.slice(0,a)+"  "+sq.value.slice(b); sq.selectionStart=sq.selectionEnd=a+2; s.q=sq.value; save(); }}); }',
      'sq.value=sq.value.slice(0,a)+"  "+sq.value.slice(b); sq.selectionStart=sq.selectionEnd=a+2; if(t.self) s.v=[sq.value]; else s.q=sq.value; save(); }}); }'],
    ['    if(t.type==="sql") s.v = t.checks.map((_,k)=>$(`#b-${t.id}-${k}`,el).value);', '    if(t.type==="sql" && !t.self) s.v = t.checks.map((_,k)=>$(`#b-${t.id}-${k}`,el).value);'],
    // The portal's own rules say how hints and solutions count; the note must not contradict them.
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
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.self ? Math.min(t.pts, 3) : t.pts });
S = LavRac.loadUi();`],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // One answer per task. Something missing (an empty field) is not an answer yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : (t.pts ? \`Pravilno. +\${ptsLabel(t.pts)}\` : "Pravilno.")) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    // The practice tasks on the pages (lv "P", no points, "Poskusi sam") stay in the page: state in the portal's local
    // storage, nothing sent to the server. Every other task goes through the shell.
    `    if(t.lv==="P"){ if(ok){ if(s.state!=="seen") s.state="ok"; save(); } show(ok, ok ? "Pravilno." : ("Ni še pravilno. "+msg).trim()); paint(); return; }
    if(!ok && t.type==="blanks" && t.b.every((_,k)=>!$(\`#b-\${t.id}-\${k}\`,el).value.trim())){ show(false,"Najprej vpiši odgovor."); return; }
    if(!ok && /^Razvrsti/.test(msg)){ show(false,msg); return; }
    save(); LavRac.answered(t.idx, ok, msg, part);`],
    ['if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      'if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); if(t.lv!=="P" && !t.self) LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; if(t.lv==="P"){ if(s.state!=="ok"){ s.state="seen"; save(); paint(); } } else LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    ['cur = location.hash.slice(1) || "uvod";\n', ''],
    // Start.
    ['fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();\n\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ER_JS + ZAGON],
    // The question and explanation texts, the practice tasks and their labels (see above).
    [TASKS_LINE, `const T = ${toJs(TASKS_SRC)};`],
    [TRY_LINE, `const TRY = ${toJs(TRY_SRC)};`],
    // <code> from the source is read as code, not shown as text.
    [FMTQ_LINE, FMTQ_LINE.replace(/;$/, '.replace(/&lt;code&gt;([\\s\\S]+?)&lt;\\/code&gt;/g,"<code>$1</code>");')],
    // The ER figure gets its buttons.
    ['<figure class="fig schemafig">', '<figure class="fig schemafig" id="erfig"><div class="erbar"><button type="button" class="btn js-er-full">Celozaslonsko</button><button type="button" class="btn primary js-er-pdf">Prenesi PDF</button></div>'],
  ],
};
