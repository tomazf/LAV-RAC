// Logične funkcije. Connects the published artifact to the exercise shell: the portal's storage,
// one answer per task, hints and solution reported to the shell, and three theory groups for the overview.

import { readFileSync } from 'node:fs';

// Longer code that is built into the artifact lives in content/adapters/2.2/ so that it can be read and checked as code.
const part = (name) => readFileSync(new URL('./2.2/' + name, import.meta.url), 'utf8');

const ICONS = {
  vrata: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 17h10M4 31h10M34 24h11"/><rect x="14" y="10" width="20" height="28"/><text x="24" y="30" font-size="16" text-anchor="middle">&amp;</text></svg>',
  funkcije: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M24 8v32M6 24h36"/><rect x="9" y="11" width="30" height="10" rx="5" class="fill" opacity=".35"/></svg>',
  aritmetika: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="8" width="24" height="32" rx="3"/><path d="M4 18h8M4 30h8M36 18h8M36 30h8M24 46v-6"/><text x="17" y="30" font-size="15">Σ</text></svg>',
};
// Theory groups agreed with the teacher (6. 11. 2026).
const GROUPS = [
  { id: 'vrata', title: 'Logična vrata', pages: ['vrata1', 'vrata2'] },
  { id: 'funkcije', title: 'Funkcije in poenostavljanje', pages: ['zapis', 'algebra', 'veitch', 'demorgan'] },
  { id: 'aritmetika', title: 'Aritmetična vezja', pages: ['sestevalnik', 'odstevalnik'] },
];
const TITLE = 'Logične funkcije';
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
  body{padding-left:0;padding-right:0}
  /* IEC gate labels inside the rectangles; comparison table of symbol systems */
  .circ .gl{stroke:none;font-weight:700;font-size:14px}
  .vfig svg.g{width:150px;height:75px;color:var(--accent);flex:none}
  /* the visually hidden texts (.sr) inside wide tables are absolutely positioned; without a positioned frame they escape its scrolling and widen the page on a phone */
  .tbl{position:relative}
  .symcmp th small{font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0}
  .symcmp td{vertical-align:middle}`,
  patches: [
    ['HOME.forEach((h,k)=>{', `HOME.push(...${JSON.stringify(HOME_PLUS)});\nHOME.forEach((h,k)=>{`],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The table of gate expressions on the first page sits in a scrolling frame like every other table, so a phone does not widen the page.
    ['<table class="eqtab" style="margin-top:6px">', '<div class="tbl"><table class="eqtab">'],
    ['je vhod 0</td></tr>\n          </tbody>\n        </table>', 'je vhod 0</td></tr>\n          </tbody>\n        </table></div>'],
    // Gate symbols (agreed 10. 11. 2026): everything is drawn as IEC rectangles; the introduction compares them with ANSI/IEEE
    // (content/adapters/2.2/iec.js, symcmp.js) and the texts that described the old shapes are rewritten.
    ["function gateSvg(t, cls){",
      part('iec.js') + '\n' + "function gateSvgAnsi(t, cls){"],
    ["function gBody(t,H){",
      "function gBodyAnsi(t,H){"],
    ["WIDGETS.gates1 = h=>gateLab(h,[\"AND\",\"OR\",\"NOT\"]);",
      part('symcmp.js') + '\n' + "WIDGETS.gates1 = h=>gateLab(h,[\"AND\",\"OR\",\"NOT\"]);"],
    ["<p>V shemah ne rišemo stikal, ampak simbole vrat. Spodaj so vsa tri osnovna vrata. Pritisni gumba z vhodoma in poglej, kako se spremeni izhod. Vrstica tabele, ki trenutno velja, je obarvana.</p>",
      "<p>V shemah ne rišemo stikal, ampak simbole vrat. Obstajata dva sistema simbolov. <strong>IEC</strong> je mednarodni standard: vrata so pravokotniki z oznako v notranjosti. <strong>ANSI/IEEE</strong> ima za vsaka vrata svojo obliko in ga pogosto srečaš v učbenikih, na spletu in v programih za risanje vezij. Spodaj sta primerjana. <strong>V tem gradivu uporabljamo samo simbole IEC.</strong></p></div>\n      <div data-w=\"symcmp\"></div>\n      <div class=\"prose\">\n        <p>Spodaj so vsa tri osnovna vrata. Pritisni gumba z vhodoma in poglej, kako se spremeni izhod. Vrstica tabele, ki trenutno velja, je obarvana.</p>"],
    ["<p class=\"note\">Pripomoček prikazuje oblike simbolov, kot jih srečaš v večini učbenikov (ANSI/IEEE). V standardu IEC so vrata pravokotniki z oznako v notranjosti: <code>&amp;</code> za IN, <code>≥1</code> za ALI, <code>1</code> za NE, <code>=1</code> za XOR. Krožec na izhodu ali vhodu pomeni negacijo.</p>",
      "<p class=\"note\">Simboli v tem gradivu so po standardu IEC: vrata so pravokotniki z oznako v notranjosti, <code>&amp;</code> za IN, <code>≥1</code> za ALI, <code>1</code> za NE, <code>=1</code> za XOR in <code>=</code> za XNOR. Krožec na izhodu ali vhodu pomeni negacijo.</p>"],
    ["Simboli vrat so narisani v obliki ANSI/IEEE, v standardu IEC so vrata pravokotniki.",
      "Simboli vrat so narisani po standardu IEC: vrata so pravokotniki z oznako v notranjosti."],
    ["h:[\"Poglej izhod: ali ima krožec?\",\"Ravna zadnja stran je značilna za vrata IN.\"],\n why:\"Ravna zadnja stran in izhod brez krožca pomenita vrata IN. Če bi bil na izhodu krožec, bi bila to vrata NEIN.\"",
      "h:[\"Poglej izhod: ali ima krožec?\",\"Oznaka v pravokotniku pove vrsto vrat: & je oznaka za IN.\"],\n why:\"Oznaka & v pravokotniku in izhod brez krožca pomenita vrata IN. Če bi bil na izhodu krožec, bi bila to vrata NEIN.\""],
    ["h:[\"Zadnja stran je zaobljena, kot pri vratih ALI.\",\"Krožec na izhodu pomeni negacijo.\"],\n why:\"Zaobljena oblika so vrata ALI, krožec na izhodu pa izhod še negira. Skupaj so to vrata NEALI.\"",
      "h:[\"Oznaka ≥1 je oznaka za vrata ALI.\",\"Krožec na izhodu pomeni negacijo.\"],\n why:\"Oznaka ≥1 pomeni vrata ALI, krožec na izhodu pa izhod še negira. Skupaj so to vrata NEALI.\""],
    ["h:[\"Opazuj vhodno stran vrat.\",\"Dodatna ukrivljena črta ob vhodih loči XOR od ALI.\"],\n why:\"Dodatna ukrivljena črta pri vhodih je znak za ekskluzivni ALI (XOR). Ker izhod nima krožca, ni XNOR.\"",
      "h:[\"Preberi oznako v pravokotniku.\",\"Oznaka =1 loči XOR od ALI (≥1).\"],\n why:\"Oznaka =1 je znak za ekskluzivni ALI (XOR). Ker izhod nima krožca, ni XNOR.\""],
    ["h:[\"Zadnja stran je ravna.\",\"Krožec na izhodu pomeni, da je rezultat negiran.\"],\n why:\"Ravna zadnja stran so vrata IN, krožec izhod negira: to so vrata NEIN.\"",
      "h:[\"Oznaka & je oznaka za vrata IN.\",\"Krožec na izhodu pomeni, da je rezultat negiran.\"],\n why:\"Oznaka & so vrata IN, krožec izhod negira: to so vrata NEIN.\""],
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
