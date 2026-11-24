// SQL poizvedbe (LAV-RAČ4, 5. poglavje). Connects the published artifact to the exercise shell: the portal's storage, one
// answer per task, five theory groups, the revision set from the Za doma page kept last among the exercises as "Ponavljanje",
// the practice items without points left as "Za doma". The student runs every query in MySQL Workbench on their own schema
// and types a control result; the portal never executes SQL. The tasks whose result is a table or a longer list (31 of 81)
// are "Sam preveri" (agreed 21. 11. 2026): the student compares the Workbench result with the solution, no points.
// The two scripts (sola.sql, matura_baze.sql) are served from /static and offered as downloads.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { partialCredit } from './qformat.js';

const SRC = fs.readFileSync(fileURLToPath(new URL('../sources/4.5.html', import.meta.url)), 'utf8');

const ICONS = {
  tabela: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="3"/><path d="M6 19h36M6 29h36M19 9v30"/><rect x="6" y="9" width="36" height="10" rx="3" class="fill" opacity=".35"/></svg>',
  zdruzi: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 10h34L28 25v13l-8 4V25z"/><path d="M7 10h34L28 25H20z" class="fill" opacity=".35"/></svg>',
  stik: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="24" r="12"/><circle cx="30" cy="24" r="12"/><path d="M24 14.2a12 12 0 0 1 0 19.6a12 12 0 0 1 0-19.6z" class="fill" opacity=".35"/></svg>',
  podpoizv: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="3"/><rect x="15" y="17" width="18" height="14" rx="2"/><rect x="15" y="17" width="18" height="14" rx="2" class="fill" opacity=".35"/></svg>',
  pogled: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="5"/><circle cx="24" cy="24" r="5" class="fill" opacity=".35"/></svg>',
};
// Theory groups: the pages (explanations 1 to 12) in the artifact's own order, each group matching one or two task sets:
// A (explanations 2 to 4), B (5, 6), C (7, 8), D (9, 10).
const GROUPS = [
  { id: 'g-osnove', icon: 'tabela', title: 'Šolska baza in osnove SELECT', pages: ['uvod', 'select', 'where', 'funkcije'] },
  { id: 'g-zdruzi', icon: 'zdruzi', title: 'Združevanje podatkov', pages: ['agregati', 'group'] },
  { id: 'g-stiki', icon: 'stik', title: 'Stiki tabel', pages: ['join', 'joingroup'] },
  { id: 'g-zunanji', icon: 'podpoizv', title: 'Zunanji stiki in podpoizvedbe', pages: ['outer', 'sub'] },
  { id: 'g-mnozice', icon: 'zdruzi', title: 'Množice in povzetek', pages: ['unija', 'povzetek'] },
];
const TITLE = 'SQL poizvedbe';
const KICKER = 'LAV-RAČ4 · 5. poglavje';
// Tasks whose result is a table or a longer list (more than 5 rows or more than 2 columns, more than one row): the student
// compares the Workbench result with the solution. Names as the shell reads them: the artifact's set tag and the place in the set
// (M1 = set E, M2 = F, M3 = G, H = Ponavljanje on the portal).
const SELF = ['A1', 'A3', 'A4', 'A6', 'A7', 'B3', 'B4', 'C2', 'C3', 'C5', 'C6', 'D1', 'D2', 'D4', 'D5',
  'M19', 'M114', 'M25', 'M27', 'M212', 'M213', 'M215', 'M216', 'M220', 'M34', 'M38', 'M311', 'M312', 'M313', 'M315'];
const ZAGON = `fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();
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

// Question and explanation texts: the source's own markup (<code>, <b>) is read as markup, and SQL statements written
// in plain text are set in code, so that they stand out from the Slovene text (21. 11. 2026).
const SQL_START = /\b(?:CREATE TABLE(?=\s+[\w.]+\s*\()|CREATE DATABASE(?=\s+\w)|CREATE INDEX(?=\s+\w+\s+ON\b)|ALTER TABLE(?=\s+[\w.]+\s+(?:ADD|DROP|MODIFY|CHANGE|ALTER|RENAME)\b)|DROP TABLE(?=\s+IF EXISTS\b|\s+[\w.]+\s*(?:[;.?]|$)|\s*[.?]?$)|DROP DATABASE(?=\s+\w)|TRUNCATE TABLE(?=\s+\w)|INSERT INTO(?=\s+[\w.]+\s*(?:\(|VALUES\b))|UPDATE(?=\s+[\w.]+\s+SET\b)|DELETE FROM(?=\s+[\w.]+(?:\s+WHERE\b|\s*[;.?]|\s*$))|SELECT(?=\s+(?:\*|COUNT\s*\(|[\w.,()* ]+?\s+FROM\b)))/g;
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
let TASKS_SRC = JSON.parse(TASKS_LINE.slice('const T = '.length).replace(/;$/, ''));
const TRY_SRC = JSON.parse(TRY_LINE.slice('const TRY = '.length).replace(/;$/, ''));
for (const t of TASKS_SRC) { t.q = fixText(t.q); t.why = fixText(t.why); }
// The matura statements as they are written on the exam: the table names without the pole prefix (mNNN_).
for (const t of TASKS_SRC) if (t.sol && /\bm\d{3}_/.test(t.sol)) t.maturi = t.sol.replace(/\bm\d{3}_/g, '');
// The revision set (sklop H, »Ponavljanje«) is removed: its four tasks repeat tasks of sets F and G (agreed 23. 11. 2026).
TASKS_SRC = TASKS_SRC.filter((t) => t.lv !== 'H');
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
    // The solution of a matura task shows the statement as it is written on the exam, below the portal's own solution.
    ['html += `<div class="eyebrow">Rešitev</div><pre class="code">${hl(t.sol)}</pre>`;',
      'html += `<div class="eyebrow">Rešitev</div><pre class="code">${hl(t.sol)}</pre>${t.maturi ? `<div class="eyebrow">Na maturi</div><pre class="code">${hl(t.maturi)}</pre>` : ""}`;'],    // Partial credit for tasks with several parts (agreed 16. 11. 2026); the blanks and the control results of a query are
    // counted here, the other kinds are the shared ones.
    partialCredit[0],
    partialCredit[1],
    ['      ok = all;\n    }\n    if(t.type==="sql"){',
      '      ok = all; part = { right: t.b.filter((b,k)=>matchBlank($(`#b-${t.id}-${k}`,el).value,b)).length, of: t.b.length };\n    }\n    if(t.type==="sql"){'],
    ['      ok = all; if(!ok) msg = "Preveri poizvedbo v Workbenchu (pogoje, stik, GROUP BY) in jo izvedi znova.";',
      '      ok = all; if(!ok) msg = "Preveri poizvedbo v Workbenchu (pogoje, stik, GROUP BY) in jo izvedi znova.";\n      part = { right: t.checks.filter((b,k)=>matchBlank($(`#b-${t.id}-${k}`,el).value,b)).length, of: t.checks.length };'],
    partialCredit[3],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // the two result tables of one statement sit side by side, as one row of the page
    ['<div class="gviz">', '<div class="gviz two">'],
    // The revision set (artifact level "doma", tag H, "Ponavljanje") is removed from the levels; its tasks are removed above.
    [', {"id": "doma", "tag": "H", "title": "Za doma", "note": "Maturitetne naloge, ki so se na kasnejših polah ponovile z enakim besedilom. Rešuj jih za ponavljanje.", "home": true}]',
      ']'],
    // The portal's own rules say how hints and solutions count; the note must not contradict them. A longer result is compared, not typed.
    ['Poizvedbo napiši in izvedi v Workbenchu, nato v polja <b>Kontrolni rezultat</b> vpiši, kar ti vrne (število vrstic, izbrano vrednost) in pritisni Preveri. Decimalna števila lahko zaokrožiš na dve decimalki.',
      'Poizvedbo napiši in izvedi v Workbenchu. Pri nalogah s kratkim izpisom v polja <b>Kontrolni rezultat</b> vpiši, kar ti vrne (število vrstic, izbrano vrednost), in pritisni Preveri. Decimalna števila lahko zaokrožiš na dve decimalki. Pri nalogah z daljšim izpisom (tabela) rezultat sam primerjaš z rešitvijo: označene so s »Sam preveri« in nimajo točk.'],
    [' Namigi so zastonj, ogled rešitve pa nalogo izloči iz točk.', ''],
    // The scripts are downloads from the portal, not text to copy; the ZIP, the copy buttons and the external script go.
    ['<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n', ''],
    ['Prenesi ZIP z obema skriptama ali pa skripto kopiraj in jo v 4. koraku prilepi v okno za poizvedbe.<div class="actions dlrow"><button class="btn primary js-zip" type="button" hidden>⬇ Prenesi ZIP (sola.sql + matura_baze.sql)</button><button class="btn js-copyfile" type="button" data-f="sola.sql">Kopiraj sola.sql</button><a class="btn ghost" href="sola.sql.txt" target="_blank" rel="noopener">Odpri sola.sql ↗</a></div>',
      'Prenesi jo na svoj računalnik.<div class="actions dlrow"><a class="btn primary" href="/static/sola.sql" download>⬇ Prenesi sola.sql</a></div><p class="note">Skripta najprej izbriše tabele z istimi imeni v izbrani shemi (tudi tiste, ki si jih naredil sam). Za vsako poglavje uporabi svojo shemo (npr. sola4, sola5).</p>'],
    [' (ali pa kopirano besedilo prilepi v novo okno, <span class="kbd">Ctrl</span> + <span class="kbd">T</span>)', ''],
    ['<div class="actions dlrow"><button class="btn primary js-zip" type="button" hidden>⬇ Prenesi ZIP (obe skripti)</button><button class="btn js-copyfile" type="button" data-f="matura_baze.sql">Kopiraj matura_baze.sql</button><a class="btn ghost" href="matura_baze.sql.txt" target="_blank" rel="noopener">Odpri matura_baze.sql ↗</a><span class="muted">94 majhnih tabel · naloge so v sklopih M1–M3</span></div>',
      '<div class="actions dlrow"><a class="btn primary" href="/static/matura_baze.sql" download>⬇ Prenesi matura_baze.sql</a><span class="muted">94 majhnih tabel · naloge so v sklopih E–G</span></div><p class="note">Skripta najprej izbriše tabele z istimi imeni v izbrani shemi (tudi tiste, ki si jih naredil sam). Za vsako poglavje uporabi svojo shemo (npr. sola4, sola5).</p>'],
    ['["sola.sql","matura_baze.sql"].forEach(f=>{ try { fetch(f+".txt").then(r=>r.ok?r.text():null).then(t=>{ if(t) FTXT[f]=t; }).catch(()=>{}); } catch(e){} });\n', ''],
    // A task marked "Sam preveri" has no control result to type: the student compares the Workbench result with the solution.
    ['    body += `<div class="chk"><div class="lbl">Kontrolni rezultat</div>`', '    if(!t.self) body += `<div class="chk"><div class="lbl">Kontrolni rezultat</div>`'],
    ['<span>Izvedi jo v Workbenchu, nato vpiši kontrolni rezultat.</span>', '<span>${t.self ? "Izvedi jo v Workbenchu in rezultat primerjaj z rešitvijo." : "Izvedi jo v Workbenchu, nato vpiši kontrolni rezultat."}</span>'],
    ['    if(t.type==="sql") s.v = t.checks.map(', '    if(t.type==="sql" && !t.self) s.v = t.checks.map('],
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
    // Task ids exist only from here on, so the shell learns the tasks here (and which of them are "Sam preveri").
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace(/[\\/.]/g,"-") : t.key ? t.key : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, { self: ${JSON.stringify(SELF)} });
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace(/[\\/.]/g,"-") : t.key ? t.key : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    ['if(!window.claude || !window.claude.use) return;', 'return;', 'all'],
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
    // The question and explanation texts, the practice tasks and their labels (see above).
    [TASKS_LINE, `const T = ${toJs(TASKS_SRC)};`],
    [TRY_LINE, `const TRY = ${toJs(TRY_SRC)};`],
    // <code> from the source is read as code, not shown as text.
    [FMTQ_LINE, FMTQ_LINE.replace(/;$/, '.replace(/&lt;code&gt;([\\s\\S]+?)&lt;\\/code&gt;/g,"<code>$1</code>");')],
    // The ER figure of the first explanation gets its buttons (full screen, and a print sheet to save as PDF).
    ['ocena.id_dijak</code> pove, čigava je ocena.</p></div></div><figure class="fig schemafig">',
      'ocena.id_dijak</code> pove, čigava je ocena.</p></div></div><figure class="fig schemafig" id="erfig"><div class="erbar"><button type="button" class="btn js-er-full">Celozaslonsko</button><button type="button" class="btn primary js-er-pdf">Prenesi PDF</button></div>'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    ['cur = location.hash.slice(1) || "uvod";\n', ''],
    // Start.
    ['fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();\n\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ER_JS + ZAGON],
  ],
};
