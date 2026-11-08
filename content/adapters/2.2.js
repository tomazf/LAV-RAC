// Logične funkcije – utrjevanje. Connects the published artifact to the exercise shell: the portal's storage,
// one answer per task, hints and solution reported to the shell, and three theory groups for the overview.

const ICONS = {
  vrata: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 17h10M4 31h10M38 24h7"/><path d="M14 10h10a14 14 0 0 1 0 28H14z"/></svg>',
  funkcije: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M24 8v32M6 24h36"/><rect x="9" y="11" width="30" height="10" rx="5" class="fill" opacity=".35"/></svg>',
  aritmetika: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="8" width="24" height="32" rx="3"/><path d="M4 18h8M4 30h8M36 18h8M36 30h8M24 46v-6"/><text x="17" y="30" font-size="15">Σ</text></svg>',
};
// Theory groups agreed with the teacher (6. 11. 2026).
const GROUPS = [
  { id: 'vrata', title: 'Logična vrata', pages: ['vrata1', 'vrata2'] },
  { id: 'funkcije', title: 'Funkcije in poenostavljanje', pages: ['zapis', 'algebra', 'veitch', 'demorgan'] },
  { id: 'aritmetika', title: 'Aritmetična vezja', pages: ['sestevalnik', 'odstevalnik'] },
];
const TITLE = 'Logične funkcije – utrjevanje';
const KICKER = 'LAV-RAČ2 · 2. poglavje';

// Two more home tasks, added in the portal (8. 11. 2026); the artifact stays as it is.
const HOME_PLUS = [
 {
  "id": "d7",
  "title": "Glasovalna naprava",
  "q": "Trije sodniki (A, B, C) glasujejo s tipko. Lučka naj zasveti, ko sta za vsaj dva. Zapiši pravilnostno tabelo in PDNO, funkcijo poenostavi z Veitchevim diagramom in nariši vezje.",
  "sol": "Enice so pri ABC = 011, 101, 110 in 111. PDNO: ¬A·B·C + A·¬B·C + A·B·¬C + A·B·C. V Veitchevem diagramu tvorijo tri pare, zato je Q = A·B + A·C + B·C. Vezje: troje vrat IN z dvema vhodoma in vrata ALI s tremi vhodi."
 },
 {
  "id": "d8",
  "title": "Samo vrata NEALI",
  "q": "Na voljo imaš samo vrata NEALI z dvema vhodoma. Pokaži, kako z njimi izvedeš NE, ALI in IN. Koliko vrat potrebuješ za vsako?",
  "sol": "NE: ena vrata NEALI z združenima vhodoma, ¬A = ¬(A+A).\nALI: dvoje vrat, A+B = ¬(¬(A+B)): za NEALI dodaš še negacijo.\nIN: troje vrat, A·B = ¬(¬A+¬B) po De Morganu: dvoje vrat za ¬A in ¬B, tretja vrata NEALI na koncu."
 }
];

export default {
  module: 'LAV-RAČ2',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}`,
  patches: [
    ['HOME.forEach((h,k)=>{', `HOME.push(...${JSON.stringify(HOME_PLUS)});\nHOME.forEach((h,k)=>{`],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Storage: the portal's state for this student; the artifact's own account sync is not used.
    [`const STORE = "logicne-funkcije-scnm-v1";
let S = {}, localT = 0;
try { S = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; localT = +localStorage.getItem(STORE+"-t") || 0; } catch(e) { S = {}; }
let remote = null, pushTimer = null, pushing = false, dirty = false;
function saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(S)); localStorage.setItem(STORE+"-t", String(localT)); } catch(e){} }
function save(){ localT = Date.now(); saveLocal(); if(remote){ dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); } }`,
    `LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.d });
let S = LavRac.loadUi(), localT = 0;
let remote = null, pushTimer = null, pushing = false, dirty = false;
function saveLocal(){ LavRac.saveUi(S); }
function save(){ LavRac.saveUi(S); }`],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // One answer per task. Something missing or unreadable is not an answer yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state = "ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : \`Pravilno. +\${ptsLabel(t.pts)}\`) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    `    if(!ok && /Najprej|^Izpolni|^Razvrsti|Uporabi samo spremenljivke|V tej nalogi so samo|Izraza ne razumem/.test(msg)){ show(false,msg); return; }
    save(); LavRac.answered(t.idx, ok, msg);`],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h = hi; save(); drawHints(); }});',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h = hi; save(); LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden = false; if(s.state!=="ok"){ s.state = "seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden = false; LavRac.solution(t.idx);'],
    // The shell does the paging. It mounts before the overline observer starts, so negations are drawn once.
    ['  applyFilter(); showPage(cur,true);\n', '  applyFilter();\n'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    [`cur = location.hash.slice(1) || PAGES[0][0];
renderAll();
progress();
mountWidgets();
if(location.hash){ setTimeout(()=>window.scrollTo(0,0),0); window.addEventListener("load",()=>window.scrollTo(0,0)); }`,
    `renderAll();
mountWidgets();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  LavRac.mount({
    title: ${JSON.stringify(TITLE)},
    kicker: ${JSON.stringify(KICKER)},
    root: ".wrap",
    lead: document.querySelector("#hero .lead").textContent.trim(),
    hero: document.querySelector("#hero .magic"),
    source: [...document.querySelectorAll("footer > span:not(#resetWrap)")].map(e=>e.textContent.trim()).join(" "),
    vajeNote: document.querySelector("#naloge .prose").innerHTML,
    groups: ${JSON.stringify(GROUPS.map((g) => ({ ...g, icon: ICONS[g.id] })))}.map(g=>({ ...g, pages: g.pages.map(id=>({ id, title: title(id), el: document.getElementById(id) })) })),
    sets: LEVELS.map(L=>({ id: L.id, tag: L.tag, title: L.title, note: L.note, el: document.getElementById(L.id),
      tasks: T.filter(t=>t.lv===L.tag).map(t=>({ idx: t.idx, el: document.getElementById("t-"+t.id) })) })),
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim(), el: home },
    sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions" },
  });
}`],
  ],
};
