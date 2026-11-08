// Številski sistemi, kodiranje in pariteta. Connects the published artifact to the exercise shell:
// its storage becomes the portal's, an answer locks the task, hints and the solution report to the shell,
// and the page is handed to the shell instead of the artifact's own paging.

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
  body{padding-left:0;padding-right:0}`,
  patches: [
    ['HOME.forEach((h,k)=>{', `HOME.push(...${JSON.stringify(HOME_PLUS)});\nHOME.forEach((h,k)=>{`],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The portal does not let pages run text as code, so the arithmetic tasks compute their answer directly
    // (multiplication first, then addition and subtraction from the left, as before).
    ['const r=Function("return "+e)(), a=Z(r,b);',
      'const r=(()=>{ const v=[dn[0]], s=[]; os.forEach((o,i)=>{ if(o==="+"||o==="−") { s.push(o); v.push(dn[i+1]); } else v[v.length-1]*=dn[i+1]; }); return v.reduce((x,y,i)=>i===0?y:(s[i-1]==="+"?x+y:x-y),0); })(), a=Z(r,b);'],
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
