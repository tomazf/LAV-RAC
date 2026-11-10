// Številski sistemi, kodiranje in pariteta. Connects the published artifact to the exercise shell:
// its storage becomes the portal's, an answer locks the task, hints and the solution report to the shell,
// and the page is handed to the shell instead of the artifact's own paging.

import { readFileSync } from 'node:fs';

// Longer code that is built into the artifact lives in content/adapters/2.1/ so that it can be read and checked as code.
const part = (name) => readFileSync(new URL('./2.1/' + name, import.meta.url), 'utf8');

// Icons for the theory groups, drawn for this exercise: base change, arithmetic, a seven-segment digit, a parity bit.
const ICONS = {
  pretvorbe: '<svg viewBox="0 0 48 48" aria-hidden="true"><text x="2" y="19" font-size="17">10</text><path d="M10 25v5a7 7 0 0 0 7 7h14"/><path d="M27 32l5 5-5 5"/><text x="35" y="43" font-size="17">2</text></svg>',
  racunanje: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 13h12M14 7v12M28 13h12M10 31l8 8M18 31l-8 8M28 33h12M28 39h12"/></svg>',
  kodiranje: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 8h14M15 10v12M33 10v12M17 24h14M15 26v12M33 26v12M17 40h14" stroke-width="3.2"/></svg>',
  pariteta: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="7" cy="18" r="3.4" class="fill"/><circle cx="16" cy="18" r="3.4"/><circle cx="25" cy="18" r="3.4" class="fill"/><circle cx="34" cy="18" r="3.4"/><rect x="38" y="12.5" width="9" height="11" rx="2.5" class="fill"/><path d="M14 33l6 6 13-13"/></svg>',
};
const GROUP_IDS = ['pretvorbe', 'racunanje', 'kodiranje', 'pariteta'];

// Two more home tasks, added in the portal (8. 11. 2026); the artifact stays as it is.
const HOME_PLUS = [
 {
  "title": "Barve na spletu",
  "q": "Barva #FF8000 (oranžna) je na spletu zapisana šestnajstiško: po en bajt za rdečo, zeleno in modro (R, G, B). Vsako komponento zapiši desetiško in dvojiško. Koliko različnih barv lahko zapišemo s 24 biti?",
  "sol": "<p>R = FF₁₆ = 255₁₀ = 11111111₂</p><p>G = 80₁₆ = 128₁₀ = 10000000₂</p><p>B = 00₁₆ = 0₁₀ = 00000000₂</p><p>Z 24 biti zapišemo 2²⁴ = 16 777 216 različnih barv.</p>"
 },
 {
  "title": "Prekoračitev v 8 bitih",
  "q": "Števili 100 in 50 zapiši v 8-bitnem dvojiškem komplementu in ju seštej. Je rezultat pravilen? Nato izračunaj še 100 + (−50) in razloži razliko.",
  "sol": "<p>100 = 01100100, 50 = 00110010. Vsota je 10010110, kar je v dvojiškem komplementu −106 namesto 150: prišlo je do prekoračitve, saj je največje 8-bitno predznačeno število 127. Vsota dveh pozitivnih števil ne sme biti negativna.</p><p>−50 = 11001110. 01100100 + 11001110 = 1 00110010; prenos iz najvišjega bita zavržemo in dobimo 00110010 = 50, kar je pravilno.</p>"
 }
];

export default {
  module: 'LAV-RAČ2',
  title: 'Številski sistemi, kodiranje in pariteta',
  kicker: 'LAV-RAČ2 · 1. poglavje',
  // The artifact's colours and fonts give way to the portal's, so every exercise looks the same.
  // html:not(#lr):root outranks the artifact's own dark-mode rule (:root:not([data-theme=light])).
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}
  /* the complement subtraction: carry rings and arrows between the columns */
  .al.cs td.ar{min-width:.8rem;padding:3px 0;color:var(--accent);font-size:.72rem}
  .al.cs td.ch{padding:2px 4px}
  .al.cs td.ch b{display:inline-flex;align-items:center;justify-content:center;min-width:1.35rem;height:1.35rem;border-radius:999px;font-size:.78rem;font-weight:700}
  .al.cs td.ch b.on{background:var(--accent);color:#fff}
  .al.cs td.ch b.none{border:1px dashed var(--line);color:var(--muted);font-weight:500}
  .al.cs td.ch b.disc{text-decoration:line-through;opacity:.75}
  .al tr.dn td{color:var(--muted);font-size:.8rem}
  /* parity table: explanation below it; RAID page: disks as rows of bit boxes */
  .pgwhy{margin-top:12px}
  .raid .rline{margin:12px 0 4px;padding:10px 12px;border-radius:10px;background:var(--sunk);line-height:1.5}
  .raid .rt{border-collapse:collapse;margin:6px 0}
  .raid .rt th{background:transparent;text-transform:none;letter-spacing:0;font-family:var(--f-body);font-weight:600;text-align:left;padding:3px 12px 3px 0;white-space:nowrap;font-size:.92rem;color:var(--fg)}
  .raid .rt td{padding:3px 2px;text-align:center}
  .raid .rt td.cur{background:var(--accent-soft)}
  .raid .rt .bt{display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:7px;border:1px solid var(--line);background:var(--surface);font-family:var(--f-mono);font-weight:600}
  .raid .rt .bt.q{border-style:dashed;color:var(--muted);background:transparent}
  .raid .rt .bt.lost{border-style:dashed;border-color:var(--bad);color:var(--bad);background:var(--bad-soft)}
  .raid .rt .bt.new{border-color:var(--ok);color:var(--ok);background:var(--ok-soft)}
  .raid .rt tr.par th,.raid .rt tr.par td{border-top:2px solid var(--line)}
  .raid .rt tr.par th{color:var(--accent)}
  .raid .rt tr.dead th{color:var(--bad)}
  .raid .rt .x{font-size:.72rem;font-weight:500;border:1px solid var(--bad);color:var(--bad);border-radius:999px;padding:0 6px;margin-left:4px}`,
  patches: [
    ['HOME.forEach((h,k)=>{', `HOME.push(...${JSON.stringify(HOME_PLUS)});\nHOME.forEach((h,k)=>{`],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Subtraction (agreed 10. 11. 2026): the page about borrowing is removed, and every subtraction is shown as the sum of a
    // complement with the carries drawn from column to column.
    ["function calcBlock(A, B, base, op){\n  const va = parseInt(A,base), vb = parseInt(B,base), s = sub(base);\n",
      "function calcBlock(A, B, base, op){\n  const va = parseInt(A,base), vb = parseInt(B,base), s = sub(base);\n  if(op===\"-\") return subGraph(A,B,base);\n"],
    ["/* množenje: aligniran zapis delnih produktov */",
      part('sub.js') + '\n' + "/* množenje: aligniran zapis delnih produktov */"],
    ["const GROUPS = [\"Pretvorbe\",\"Računanje\",\"Kodiranje\",\"Pariteta\"];",
      "THEORY.splice(THEORY.findIndex(p=>p.id===\"odstevanje\"),1);\nconst GROUPS = [\"Pretvorbe\",\"Računanje\",\"Kodiranje\",\"Pariteta\"];"],
    ["${prose(`<p>Računalnik pozna samo ničle in enice, znaka minus nima.",
      "${note(\"<strong>Zakaj to potrebujemo?</strong> Računalnik nima posebnega vezja za odštevanje. Ima samo seštevalnik. Odštevanje zato prevede v seštevanje negativnega števila: <strong>A − B = A + (−B)</strong>. Kako zapišemo negativno število, pokaže ta stran, odštevanje po tem postopku pa naslednja.\")}\n  ${prose(`<p>Računalnik pozna samo ničle in enice, znaka minus nima."],
    ["  ${subComp(100,37,8)}\n  <h3>Hitri pregled</h3>",
      "  ${subComp(100,37,8)}\n  ${note(\"<strong>Več členov.</strong> Pri računu <code>1011 + 101 − 11 + 10</code> računaš od leve proti desni: 1011 + 101 = 10000, nato 10000 − 11 = 1101 in 1101 + 10 = <strong>1111</strong>. Preizkus: 11 + 5 − 3 + 2 = 15.\")}\n  <h3>Hitri pregled</h3>"],
    ["  <h3>Odštevanje: trije primeri</h3>\n  ${exs(calcBlock(\"7A\",\"2F\",16,\"-\"), calcBlock(\"B3C\",\"7D5\",16,\"-\"), calcBlock(\"1000\",\"1\",16,\"-\"))}\n  <h3>Odštevanje s komplementom</h3>\n  ${prose(`<p>Tako kot v dvojiškem sistemu lahko A − B izračunaš kot A + (−B). Komplement števila dobiš tako, da <strong>vsako števko odšteješ od F</strong>, nato prišteješ 1. Prenos čez zgornje mesto zavržeš.</p>`)}\n  ${compBase(\"7A\",\"2F\",16,2)}\n",
      "  <h3>Odštevanje s komplementom: trije primeri</h3>\n  ${prose(`<p>Tako kot v dvojiškem sistemu računalnik A − B izračuna kot A + (−B). Komplement števila dobiš tako, da <strong>vsako števko odšteješ od F</strong>, nato prišteješ 1. Prenos čez zgornje mesto zavržeš. Pri vsakem primeru so koraki narisani, prenos se vidi od stolpca do stolpca.</p>`)}\n  ${exs(calcBlock(\"7A\",\"2F\",16,\"-\"), calcBlock(\"B3C\",\"7D5\",16,\"-\"), calcBlock(\"1000\",\"1\",16,\"-\"))}\n"],
    ["  <h3>Odštevanje: trije primeri</h3>\n  ${exs(calcBlock(\"52\",\"17\",8,\"-\"), calcBlock(\"463\",\"275\",8,\"-\"), calcBlock(\"1000\",\"1\",8,\"-\"))}\n  <h3>Odštevanje s komplementom</h3>\n  ${prose(`<p>V osmiškem sistemu je komplement števk <strong>7 − števka</strong>, nato prišteješ 1. Postopek je enak kot v dvojiškem in šestnajstiškem sistemu.</p>`)}\n  ${compBase(\"52\",\"17\",8,3)}\n",
      "  <h3>Odštevanje s komplementom: trije primeri</h3>\n  ${prose(`<p>V osmiškem sistemu je komplement števk <strong>7 − števka</strong>, nato prišteješ 1. Postopek je enak kot v dvojiškem in šestnajstiškem sistemu. Pri vsakem primeru so koraki narisani, prenos se vidi od stolpca do stolpca.</p>`)}\n  ${exs(calcBlock(\"52\",\"17\",8,\"-\"), calcBlock(\"463\",\"275\",8,\"-\"), calcBlock(\"1000\",\"1\",8,\"-\"))}\n"],
    ["Pri odštevanju si izposodimo 16 (ne 10). Pri računanju v glavi",
      "Odštevanje računamo kot seštevanje komplementa (spodaj). Pri računanju v glavi"],
    ["<strong>Prenos nastane, ko vsota stolpca doseže 8</strong>, pri odštevanju si izposodimo 8. Števke",
      "<strong>Prenos nastane, ko vsota stolpca doseže 8</strong>, odštevanje pa računamo kot seštevanje komplementa. Števke"],
    // The portal does not let pages run text as code, so the arithmetic tasks compute their answer directly
    // (multiplication first, then addition and subtraction from the left, as before).
    ['const r=Function("return "+e)(), a=Z(r,b);',
      'const r=(()=>{ const v=[dn[0]], s=[]; os.forEach((o,i)=>{ if(o==="+"||o==="−") { s.push(o); v.push(dn[i+1]); } else v[v.length-1]*=dn[i+1]; }); return v.reduce((x,y,i)=>i===0?y:(s[i-1]==="+"?x+y:x-y),0); })(), a=Z(r,b);'],
    // Parity and RAID (agreed 10. 11. 2026): the parity table to fill in and the RAID page are rewritten (content/adapters/2.1/widgets.js),
    // the word NOVO is explained from the ASCII codes, and the RAID page gets a task of its own (content/adapters/2.1/raidtask.js).
    ["document.querySelectorAll(\"[data-w]\").forEach(h=>{ const f = WIDGETS[h.dataset.w]; if(f) f(h); });",
      part('widgets.js') + '\n' + "document.querySelectorAll(\"[data-w]\").forEach(h=>{ const f = WIDGETS[h.dataset.w]; if(f) f(h); });"],
    ["Vsak znak je ena vrstica (7 bitov ASCII). Vsaki vrstici dodamo",
      "Vsak znak je ena vrstica: njegova koda ASCII (N = 78, O = 79, V = 86), zapisana v 7 bitih (78 = 1001110). Vsaki vrstici dodamo"],
    ["${pgv(NOVO,\"even\",true,true,[...\"NOVO\"])}",
      "${pgv(NOVO,\"even\",true,true,[...\"NOVO\"].map(ch=>ch+\" = \"+ch.charCodeAt(0)))}"],
    ["case \"num\": return inp(0,\"Tvoj odgovor\");",
      "case \"num\": return (t.fig||\"\")+inp(0,t.lab||\"Tvoj odgovor\");"],
    ["er(flipAt(fullM([[1,1,0,1,0],[0,1,1,0,1],[1,0,0,1,1],[0,0,1,1,1]],\"even\"),1,5),\"even\",null,\"\");",
      "er(flipAt(fullM([[1,1,0,1,0],[0,1,1,0,1],[1,0,0,1,1],[0,0,1,1,1]],\"even\"),1,5),\"even\",null,\"\");" + '\n' + part('raidtask.js')],
    ["${prose(`<p>Tri diski hranijo podatke, četrti paritetni blok P = XOR vseh treh (sodo pariteto po stolpcih). Izberi disk, ki »odpove«, in oglej si, kako ga sistem obnovi.</p>`)}",
      "${prose(`<p>Pri RAID 5 so podatki razporejeni po več diskih. Poleg njih sistem hrani <strong>paritetni blok P</strong>, izračunan po stolpcih enako kot vzdolžna pariteta v tabeli. Če en disk odpove, se njegova vsebina izračuna iz preostalih. V prikazu spodaj to narediš po korakih: najprej nastane P, nato en disk odpove in se obnovi bit za bitom.</p>`)}"],
    // Storage: the portal's state for this student instead of the browser's own copy.
    [`const STORE = "stevilski-sistemi-v2";
let S = {};
try { S = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch(e) { S = {}; }
function save(){ try { localStorage.setItem(STORE, JSON.stringify(S)); } catch(e){} }`,
    `LavRac.tasks(TT, { level: (t) => t.lv });
let S = LavRac.loadUi();
function save(){ LavRac.saveUi(S); }`],
    // One answer per task: an incomplete answer only gets a message, a complete one locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : \`Pravilno. +\${ptsLabel(t.pts)}\`) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    `    if(!ok && msg){ show(false,msg); return; }
    save(); LavRac.answered(t.idx, ok);`],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); } });',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); LavRac.hinted(t.idx); drawHints(); } });'],
    ['solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }', 'solEl.hidden=false; LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    [`cur = location.hash.slice(1) || PAGES[0][0];
renderAll();
progress();
showPage(cur, true);
if(location.hash){ setTimeout(()=>window.scrollTo(0,0), 0); window.addEventListener("load",()=>window.scrollTo(0,0)); }`,
    `renderAll();
LavRac.mount({
  title: ${JSON.stringify('Številski sistemi, kodiranje in pariteta')},
  kicker: ${JSON.stringify('LAV-RAČ2 · 1. poglavje')},
  lead: document.querySelector("#hero .lead").textContent.trim(),
  hero: document.querySelector("#hero .magic"),
  source: document.querySelector("footer > span").textContent.trim(),
  vajeNote: document.querySelector("#naloge .prose").innerHTML,
  groups: GROUPS.map((g,k)=>({ id: ${JSON.stringify(GROUP_IDS)}[k], title: g, icon: ${JSON.stringify(GROUP_IDS.map((id) => ICONS[id]))}[k],
    pages: THEORY.filter(p=>p.g===k).map(p=>({ id: p.id, title: p.t, el: document.getElementById("p-"+p.id) })) })),
  sets: LEVELS.map(L=>({ id: L.id, tag: L.tag, title: L.title, note: L.note, el: document.getElementById("p-"+L.id),
    tasks: L.list.map(t=>({ idx: t.idx, el: document.getElementById("t-"+t.id) })) })),
  extra: { id: "doma", title: "Za doma", note: document.querySelector("#sec-doma > .prose").textContent.trim(), el: document.getElementById("sec-doma") },
  sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions" },
});`],
  ],
};
