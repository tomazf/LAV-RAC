// Podatkovne baze in SUPB (LAV-RAČ4, 2. poglavje). Connects the published artifact to the exercise shell: the portal's
// storage, one answer per task, five theory groups, the revision set from the Za doma page kept last among the
// exercises as "Ponavljanje" (as in the other chapters), the practice items without points left as "Za doma".
// The sample tables stay in the page: the server only learns the points.

import { partialCredit } from './qformat.js';

const ICONS = {
  baza: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="11" rx="16" ry="6"/><path d="M8 11v26c0 3.3 7.2 6 16 6s16-2.7 16-6V11M8 24c0 3.3 7.2 6 16 6s16-2.7 16-6"/><ellipse cx="24" cy="11" rx="16" ry="6" class="fill" opacity=".35"/></svg>',
  supb: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="8" width="34" height="13" rx="2.5"/><rect x="7" y="27" width="34" height="13" rx="2.5"/><path d="M13 14.5h.01M13 33.5h.01M20 14.5h14M20 33.5h14"/><rect x="7" y="8" width="34" height="13" rx="2.5" class="fill" opacity=".35"/></svg>',
  arh: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l18 8-18 8-18-8z"/><path d="M6 24l18 8 18-8M6 34l18 8 18-8"/><path d="M24 6l18 8-18 8-18-8z" class="fill" opacity=".35"/></svg>',
  prav: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="19" cy="15" r="7"/><path d="M5 40a14 14 0 0 1 22-11.5"/><circle cx="36" cy="30" r="4.5"/><path d="M36 34.5V43M36 39h4"/><circle cx="19" cy="15" r="7" class="fill" opacity=".35"/></svg>',
  is: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="11" r="5"/><circle cx="10" cy="36" r="5"/><circle cx="38" cy="36" r="5"/><path d="M21.5 15.5L12.5 31.5M26.5 15.5L35.5 31.5M15 36h18"/><circle cx="24" cy="11" r="5" class="fill" opacity=".35"/></svg>',
};
// Theory groups (proposed 11. 11. 2026, confirmed by the teacher 12. 11. 2026): pages in the artifact's own order, matching the task sets
// A (1-5), B (6-9, after the merge below), C (10-14), D (15).
const GROUPS = [
  { id: 'g-baza', icon: 'baza', title: 'Podatki in podatkovna baza', pages: ['uvod', 'datoteke'] },
  { id: 'g-supb', icon: 'supb', title: 'Naloge SUPB', pages: ['supb', 'integriteta', 'transakcije'] },
  { id: 'g-arh', icon: 'arh', title: 'Zgradba baze in jeziki', pages: ['ansi', 'neodvisnost', 'relmodel', 'jeziki'] },
  { id: 'g-prav', icon: 'prav', title: 'Uporabniki in pravice', pages: ['uporabniki', 'racuni', 'grant', 'revoke', 'vloge'] },
  { id: 'g-is', icon: 'is', title: 'Informacijski sistemi in povzetek', pages: ['is', 'utrjevanje'] },
];
const TITLE = 'Podatkovne baze in SUPB';
const KICKER = 'LAV-RAČ4 · 2. poglavje';
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

export default {
  module: 'LAV-RAČ4',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--amber:var(--lr-half);--amber-soft:var(--lr-half-bg);
  --f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}`,
  patches: [
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...partialCredit,
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Sets B (Arhitektura ANSI/SPARC, 10 tasks) and C (Relacijski model in jeziki SUPB, 7 tasks) become one set, "Zgradba baze in jeziki",
    // like the theory group of the same name (asked by the teacher 12. 11. 2026). The order of the tasks, their points and numbers stay; the shell
    // letters the sets by their place (A, B, C ...), so nothing else has to be renamed.
    ['{"id": "naloge-b", "tag": "B", "title": "Arhitektura ANSI/SPARC", "note": "Trije nivoji, število shem in podatkovna neodvisnost (razlagi 6 in 7)."}, {"id": "naloge-c", "tag": "C", "title": "Relacijski model in jeziki SUPB", "note": "Zapis shem ter razvrščanje stavkov v DDL, DML in DCL (razlagi 8 in 9)."}',
      '{"id": "naloge-b", "tag": "B", "title": "Zgradba baze in jeziki", "note": "Trije nivoji, število shem, podatkovna neodvisnost, zapis shem ter razvrščanje stavkov v DDL, DML in DCL (razlage 6 do 9)."}'],
    ['"lv": "C"', '"lv": "B"', 'all'],
    // The revision set (artifact id "doma", which is also the id of the Za doma section) is "Ponavljanje" and gets its
    // own id; the shell lettering puts it after the sets A–F, and Za doma takes the next letter.
    ['{"id": "doma", "tag": "H", "title": "Za doma", "note": "Naloge za samostojno ponavljanje, med njimi dve maturitetni, ki sta se na maturi ponovili z enakim besedilom.", "home": true}',
      '{"id": "doma-mat", "tag": "H", "title": "Ponavljanje", "note": "Naloge za samostojno ponavljanje, med njimi dve maturitetni, ki sta se na maturi ponovili z enakim besedilom.", "home": true}'],
    // The portal's own rules say how hints and solutions count; the note must not contradict them.
    [' Namigi so zastonj, ogled rešitve pa nalogo izloči iz točk.', ''],
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
    // Task ids exist only from here on, so the shell learns the tasks here. No task needs options (no programs).
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : t.key ? t.key : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, {});
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : t.key ? t.key : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // One answer per task. Something missing (an empty field, an expression that cannot be read) is not an answer
    // yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : (t.pts ? \`Pravilno. +\${ptsLabel(t.pts)}\` : "Pravilno.")) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    // The three practice tasks on the Postopek page (lv "P", no points, "Poskusi sam") stay in the page: state in the portal's local
    // storage, nothing sent to the server. Every other task goes through the shell.
    `    if(t.lv==="P"){ if(ok){ if(s.state!=="seen") s.state="ok"; save(); } show(ok, ok ? "Pravilno." : ("Ni še pravilno. "+msg).trim()); paint(); return; }
    if(!ok && t.type==="blanks" && t.b.every((_,k)=>!$(\`#b-\${t.id}-\${k}\`,el).value.trim())){ show(false,"Najprej vpiši odgovor."); return; }
    if(!ok && /^Razvrsti/.test(msg)){ show(false,msg); return; }
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
