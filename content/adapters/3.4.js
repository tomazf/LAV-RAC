// Podatkovni tipi v Javi. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, three theory groups, the operator set split in two (E and F)
// with the matura revision set moved after it as "Ponavljanje" (agreed 8. 11. 2026), and no mention of laboratory exercises.

const ICONS = {
  tipi: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="12" height="8" rx="1.5"/><rect x="6" y="20" width="24" height="8" rx="1.5"/><rect x="6" y="32" width="36" height="8" rx="1.5" class="fill" opacity=".35"/></svg>',
  znaki: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 36L15 10l10 26M9.5 27h11"/><circle cx="35" cy="30" r="5"/><path d="M40 25v11"/></svg>',
  operatorji: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 8L7 17l12 9"/><path d="M29 8l12 9-12 9"/><path d="M8 33h32M8 41h32"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026).
const GROUPS = [
  { id: 'g-tipi', icon: 'tipi', title: 'Tipi in pretvorbe', pages: ['obmocja', 'pretvarjanje'] },
  { id: 'g-znaki', icon: 'znaki', title: 'Znaki in nizi', pages: ['znaki', 'razredi'] },
  { id: 'g-operatorji', icon: 'operatorji', title: 'Operatorji', pages: ['operatorji', 'napake'] },
];
const TITLE = 'Podatkovni tipi v Javi';
const KICKER = 'LAV-RAČ3 · 4. poglavje';
const ZAGON = `renderAll();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  const sets = LEVELS.map(L=>({ id: L.id, tag: L.tag, title: L.title, note: L.note, el: document.getElementById(L.id),
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
    sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions" },
  });
}`;

// The laboratory exercises are no longer mentioned (agreed 8. 11. 2026): "Laboratorijska vaja N (program X):" becomes
// "Program X:"; the ones without a program name just lose the prefix.
const LAB = [
  ['Laboratorijska vaja 1 (program Obrni): napiši', 'Program Obrni: napiši'],
  ['Laboratorijska vaja 2 (program Stirimestno): napiši', 'Program Stirimestno: napiši'],
  ['Laboratorijska vaja 3 (program Zlitje): za', 'Program Zlitje: za'],
  ['Laboratorijska vaja 4 (program VsotaKotov): kota', 'Program VsotaKotov: kota'],
  ['Laboratorijska vaja 5 (program CasPotovanja): vlak', 'Program CasPotovanja: vlak'],
  ['Laboratorijska vaja 6 (program CasPrihoda): vlak', 'Program CasPrihoda: vlak'],
  ['Laboratorijska vaja 7: temperatura', 'Temperatura'],
  ['Laboratorijska vaja 8: napiši', 'Napiši'],
  ['Laboratorijska vaja 9: napiši', 'Napiši'],
  ['Laboratorijska vaja 10: napiši', 'Napiši'],
];
export default {
  module: 'LAV-RAČ3',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}`,
  patches: [
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Set E is split: its first 23 tasks stay in E, the rest (programs and logical expressions) form F, and the matura
    // revision set becomes G, graded among the others "Ponavljanje" (agreed 8. 11. 2026).
    ["{id:\"naloge-e\", tag:\"E\", title:\"Operatorji\", note:\"Prioriteta, prefiksni in postfiksni ++ in --, logični, bitni in pogojni operator (razlaga 5). Pri laboratorijskih vajah RAČ-LAV 3 so vrednosti zapisane v kodi; pri pouku program razširi tako, da jih prebere s Scannerjem.\"},",
      "{id:\"naloge-e\", tag:\"E\", title:\"Operatorji in izrazi\", note:\"Prioriteta, prefiksni in postfiksni ++ in --, logični, bitni in pogojni operator (razlaga 5).\"},\n {id:\"naloge-f\", tag:\"F\", title:\"Računanje s programi in logični izrazi\", note:\"Programi s števkami, časom in merami ter maturitetne naloge z logičnimi izrazi. Vrednosti so zapisane v kodi; pri pouku program razširi tako, da jih prebere s Scannerjem.\"},"],
    ["{id:\"doma-mat\", tag:\"F\", title:\"Maturitetna naloga za ponavljanje\", note:\"Naloga iz izpitne pole 1.\", home:true}",
      "{id:\"doma-mat\", tag:\"G\", title:\"Ponavljanje\", note:\"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–F.\", home:true}"],
    ['T.forEach(t=>{ if(t.solKey) t.sol = J[t.solKey]; });',
      '{ let e = 0; T.forEach(t=>{ if(t.lv==="F") t.lv = "G"; else if(t.lv==="E" && ++e > 23) t.lv = "F"; }); }\nT.forEach(t=>{ if(t.solKey) t.sol = J[t.solKey]; });'],
    ['/* ----- E (dodatek): maturitetni operatorji + laboratorijska vaja RAČ-LAV 3 ----- */', '/* ----- E (dodatek): maturitetni operatorji in programi ----- */'],
    ...LAB.map(([from, to]) => ['q:"' + from, 'q:"' + to]),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ['lab:"RAČ-LAV 3 · ' + n + '",', '']),
    // Programs can run anywhere, not only in Programiz (agreed 8. 11. 2026).
    ['<span>Zaženi v Eclipse, VS Code ali Programizu (tam razred preimenuj v Main), izpis prilepi spodaj.</span>',
      '<span>Zaženi program v poljubnem okolju (Eclipse, VS Code, Programiz …) in prilepi njegov izpis. V Programizu razred preimenuj v Main.</span>'],
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
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });',
      'T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });\nLavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });\nS = LavRac.loadUi();'],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // Program output and code are the answer too, so they are kept with the portal.
    ['if(ed){ ed.value = s.code != null ? s.code : t.starter;',
      'const sv = s.v && typeof s.v === "object" && !Array.isArray(s.v) ? s.v : null;\n  if(ed){ ed.value = sv && sv.code != null ? sv.code : t.starter;'],
    ['if(out){ if(s.out) out.value=s.out;',
      'if(out){ const o = sv ? sv.out : (typeof s.v === "string" ? s.v : null); if(o) out.value=o;'],
    ['    if(ed) s.code = ed.value;\n    if(out) s.out = out.value;',
      '    if(t.type==="output") s.v = out.value;\n    if(t.type==="code") s.v = { code: ed.value, out: out.value };'],
    // One answer per task. Something missing is not an answer yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : \`Pravilno. +\${ptsLabel(t.pts)}\`) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    `    if(!ok && t.type==="blanks" && t.b.every((_,k)=>!$(\`#b-\${t.id}-\${k}\`,el).value.trim())){ show(false,"Najprej vpiši odgovor."); return; }
    if(!ok && /^Razvrsti/.test(msg)){ show(false,msg); return; }
    save(); LavRac.answered(t.idx, ok, msg);`],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    // Start: the label switch is built by the shell (tools), so the artifact's own buttons and its re-render are dropped.
    ['cur = location.hash.slice(1) || "jezik";\n', ''],
    [`document.querySelectorAll(".js-lang").forEach(b=>b.addEventListener("click",()=>{
  FLOW.setLang(b.dataset.lang);
  try{ localStorage.setItem("java-matura-diagram-lang", b.dataset.lang); }catch(e){}
  paintLang(); fillFigs(); renderAll();
}));
`, ''],
    ['paintLang(); fillFigs();\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
  ],
};
