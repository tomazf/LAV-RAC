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

// Long task statements get light markup (**bold**, one paragraph per line, "- " lists), which the shell draws (formatQ in
// content/shell/vaja.js); D12's siren sentence says outright that the gas must be present together with one of the two
// conditions, and the brackets missing in E6, E8 are closed (11. 11. 2026). Old text, new text; the points stay the same.
const STATEMENTS = [
 [
  "Motor se vrti (Q = 1), če sta pritisnjeni obe tipki, A in B. Zapiši funkcijo Q.",
  "**Motor** se vrti (**Q = 1**), če sta pritisnjeni **obe tipki**, A in B.\nZapiši funkcijo Q."
 ],
 [
  "Alarm piska (Q = 1), če voznik sedi (A = 1) in pas ni pripet (B = 0). Zapiši funkcijo Q in jo preveri s tabelo.",
  "**Alarm** piska (**Q = 1**), če **voznik sedi** (A = 1) **in** pas **ni pripet** (B = 0).\nZapiši funkcijo Q in jo preveri s tabelo."
 ],
 [
  "Vrata se odprejo (Q = 1), če je pritisnjena tipka A ali tipka B in sistem ni zaklenjen (C = 1 pomeni zaklenjen). Zapiši Q.",
  "Vrata se odprejo (**Q = 1**), če je pritisnjena **vsaj ena od tipk, A ali B**, in hkrati sistem **ni zaklenjen** (C = 1 pomeni zaklenjen).\nZapiši Q."
 ],
 [
  "Glasovanje: Q = 1, če sta vsaj dva od treh članov (A, B, C) za. Zapiši Q.",
  "**Glasovanje:** Q = 1, če sta **vsaj dva od treh** članov (A, B, C) **za**.\nZapiši Q."
 ],
 [
  "Seštevalnik sešteva bite A, B in prenos C. Bit vsote S je 1, kadar je med A, B, C liho število enic. Zapiši S z operatorjem ⊕.",
  "**Seštevalnik** sešteva bite **A**, **B** in prenos **C**. Bit vsote **S** je 1, kadar je med A, B, C **liho število enic**.\nZapiši S z operatorjem **⊕**."
 ],
 [
  "Krmilnik črpalke ima tri vhode A, B in C. Njegova funkcija Q (Q = 1: črpalka teče) je že vpisana v Veitchev diagram. Z miško ali prstom povleci čez celice ene skupine enic in pritisni »Dodaj skupino«. Ko imaš vse skupine, zapiši minimalno PDNO.",
  "**Krmilnik črpalke** ima tri vhode A, B in C. Njegova funkcija **Q** (Q = 1: črpalka teče) je že vpisana v Veitchev diagram.\nZ miško ali prstom **povleci čez celice ene skupine** enic in pritisni **»Dodaj skupino«**. Ko imaš vse skupine, zapiši **minimalno PDNO**."
 ],
 [
  "Prezračevanje strojnice. Vhodi: A = temperatura je previsoka, B = zaznan je plin, C = vrata strojnice so odprta, D = vklopljen je ročni preklic. Izhoda: Q1 = ventilator teče, Q2 = sirena se oglaša.\nVentilator teče, če je temperatura previsoka ali je zaznan plin, razen kadar je vklopljen ročni preklic.\nSirena se oglaša, če je zaznan plin in je hkrati temperatura previsoka ali so vrata odprta.\nDopolni oba stolpca pravilnostne tabele.",
  "**Prezračevanje strojnice.** Vezje ima štiri vhode in dva izhoda.\n**Vhodi** (1 = da):\n- **A**: temperatura je previsoka\n- **B**: zaznan je plin\n- **C**: vrata strojnice so odprta\n- **D**: vklopljen je ročni preklic\n**Izhoda:**\n- **Q1**: ventilator teče\n- **Q2**: sirena se oglaša\n**Ventilator** teče, če je temperatura previsoka **ali** je zaznan plin, **razen** kadar je vklopljen ročni preklic.\n**Sirena** se oglaša, kadar je zaznan **plin** in je hkrati izpolnjen vsaj eden od obeh pogojev: temperatura je previsoka **ali** so vrata odprta.\nDopolni oba stolpca pravilnostne tabele."
 ],
 [
  "Ventilator iz prejšnje naloge: funkcija Q1 je vpisana v Veitchev diagram (A, B, C, D). Označi skupine enic in zapiši minimalno PDNO.",
  "**Ventilator** iz prejšnje naloge: funkcija **Q1** je vpisana v Veitchev diagram (A, B, C, D).\nOznači **skupine enic** in zapiši **minimalno PDNO**."
 ],
 [
  "Sirena iz iste strojnice: funkcija Q2 je vpisana v diagram. Označi skupine enic in zapiši minimalno PDNO. Zapiši vsoto produktov (PDNO).",
  "**Sirena** iz iste strojnice: funkcija **Q2** je vpisana v diagram.\nOznači **skupine enic** in zapiši **minimalno PDNO** (vsoto produktov)."
 ],
 [
  "Signalna lučka L ima štiri vhode A, B, C, D in sveti v vrsticah 0, 4, 5, 7, 8 in 12 pravilnostne tabele (Q = 1). Funkcija je vpisana v diagram. Označi skupine enic in zapiši minimalno PDNO.",
  "**Signalna lučka L** ima štiri vhode A, B, C, D in sveti (**Q = 1**) v vrsticah **0, 4, 5, 7, 8 in 12** pravilnostne tabele. Funkcija je vpisana v diagram.\nOznači **skupine enic** in zapiši **minimalno PDNO**."
 ],
 [
  "Zapiši ¬A samo z vrati NEIN. Vrata NEIN zapišemo kot negacijo produkta dveh vhodov, vhoda lahko združiš.",
  "Zapiši **¬A** samo z vrati **NEIN**.\nVrata NEIN zapišemo kot negacijo produkta dveh vhodov; vhoda lahko združiš."
 ],
 [
  "Zapiši A·B samo z vrati NEIN (dovoljeno: spremenljivke, negacija in produkt · samo neposredno pod negacijo. Uporabi največ dve vrati.",
  "Zapiši **A·B** samo z vrati **NEIN**.\nDovoljeno: spremenljivke, negacija in produkt (·), a produkt samo neposredno pod negacijo.\nUporabi največ **dve vrati**."
 ],
 [
  "Zapiši A + B samo z vrati NEALI (dovoljeno: spremenljivke, negacija in vsota + samo neposredno pod negacijo. Uporabi največ dve vrati.",
  "Zapiši **A + B** samo z vrati **NEALI**.\nDovoljeno: spremenljivke, negacija in vsota (+), a vsota samo neposredno pod negacijo.\nUporabi največ **dve vrati**."
 ],
 [
  "Zapiši A·B samo z vrati NEALI (dovoljeno: spremenljivke, negacija in vsota + samo neposredno pod negacijo). Uporabi največ tri vrata.",
  "Zapiši **A·B** samo z vrati **NEALI**.\nDovoljeno: spremenljivke, negacija in vsota (+), a vsota samo neposredno pod negacijo.\nUporabi največ **tri vrata**."
 ],
 [
  "Zapiši A⊕B samo z vrati NEIN (znana rešitev uporablja štiri vrata, ker enak podizraz X = ¬(A·B) uporabiš dvakrat). Dovoljeno je poljubno število vrat.",
  "Zapiši **A⊕B** samo z vrati **NEIN**.\nZnana rešitev uporablja **štiri vrata**, ker enak podizraz X = ¬(A·B) uporabiš dvakrat. Dovoljeno je poljubno število vrat."
 ],
 [
  "Funkcijo Q = A·B + C·D realiziraš z vrati IN in ALI (čipi 7408 z 4×IN in 7432 z 4×ALI, tri vrata) ali samo z vrati NEIN (čip 7400 s 4×NEIN, tri vrata). Koliko čipov potrebuješ v vsakem primeru?",
  "Funkcijo **Q = A·B + C·D** realiziraš na dva načina:\n- z vrati **IN in ALI** (čip 7408 s 4×IN in čip 7432 s 4×ALI; skupaj tri vrata),\n- samo z vrati **NEIN** (čip 7400 s 4×NEIN; tri vrata).\nKoliko **čipov** potrebuješ v vsakem primeru?"
 ],
 [
  "Zapiši najkrajšo PDNO za prenos Cout polnega seštevalnika (vhoda A, B in prenos C). Cout = 1, kadar sta vsaj dva od A, B, C enaka 1.",
  "Zapiši **najkrajšo PDNO** za prenos **Cout** polnega seštevalnika (vhoda A, B in prenos C).\nCout = 1, kadar sta **vsaj dva** od A, B, C enaka 1."
 ],
 [
  "Zapiši izraz za izposojo Bout polovičnega odštevalnika (A − B). Izposoja je 1, kadar odštevamo 1 od 0.",
  "Zapiši izraz za **izposojo Bout** polovičnega odštevalnika (A − B).\nIzposoja je 1, kadar odštevamo **1 od 0**."
 ],
 [
  "Polni odštevalnik izračuna A − B − Bin (v tabeli je Bin stolpec C). Izhoda sta D (razlika) in Bout (izposoja). Izposoja je 1, kadar je A manjši od B + Bin. Dopolni oba stolpca.",
  "**Polni odštevalnik** izračuna **A − B − Bin** (v tabeli je Bin stolpec C).\nIzhoda: **D** (razlika) in **Bout** (izposoja).\nIzposoja je **1**, kadar je **A manjši od B + Bin**.\nDopolni oba stolpca."
 ],
 [
  "Prenos Cout polnega seštevalnika sestavljata dva polovična seštevalnika in vrata ALI. Prvi sešteje A in B (S1 = A⊕B, C1 = A·B), drugi S1 in Cin (v nalogi C). Zapiši Cout z izrazi, ki jih ti seštevalniki izračunajo.",
  "**Prenos Cout** polnega seštevalnika sestavljata **dva polovična seštevalnika** in vrata **ALI**.\n- prvi sešteje **A in B** (S1 = A⊕B, C1 = A·B),\n- drugi sešteje **S1 in Cin** (v nalogi C).\nZapiši **Cout** z izrazi, ki jih ti seštevalniki izračunajo."
 ]
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
    ...STATEMENTS.map(([from, to]) => [`q:${JSON.stringify(from)}`, `q:${JSON.stringify(to)}`]),
    // The symbol keys keep the focus of the input field with a listener in the page: the artifact's inline onmousedown is blocked by
    // the portal's CSP, the field lost the focus on the second click and the key moved away with the preview line (11. 11. 2026).
    [' onmousedown="event.preventDefault()"', ''],
    ['function insertAt(inp,txt){',
      'document.addEventListener("mousedown",e=>{ if(e.target.closest && e.target.closest(".kp button")) e.preventDefault(); });\nfunction insertAt(inp,txt){'],
    // A15 (gate names and expressions): a drop-down cannot draw a bar over a whole expression, so each row has the expressions as buttons.
    ['body += `<div class="cls">` + t.rows.map((r,k)=>`<div class="crow sel match" data-k="${k}"><span class="txt">${esc(r[0])}</span><select aria-label="Izberi izraz za ${esc(r[0])}"><option value="">— izberi izraz —</option>${opts}</select></div>`).join("") + `</div>`;',
      'body += `<div class="cls">` + t.rows.map((r,k)=>`<div class="crow" data-k="${k}"><span class="txt">${esc(r[0])}</span><div class="seg" role="group" aria-label="Izberi izraz za ${esc(r[0])}">${t.lab.map((c,ci)=>`<button type="button" data-ci="${ci}" aria-pressed="false">${esc(c)}</button>`).join("")}</div></div>`).join("") + `</div>`;'],
    ['if(t.type==="cls") row.querySelectorAll("button").forEach(b=>{', 'if(t.type==="cls"||t.type==="sel") row.querySelectorAll("button").forEach(b=>{'],
    ['if(t.type==="cls") s.v = [...el.querySelectorAll(".crow")].map(r=>{', 'if(t.type==="cls"||t.type==="sel") s.v = [...el.querySelectorAll(".crow")].map(r=>{'],
    ['    if(t.type==="sel") s.v = [...el.querySelectorAll(".crow select")].map(x=>x.value==="" ? null : +x.value);\n', ''],
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
