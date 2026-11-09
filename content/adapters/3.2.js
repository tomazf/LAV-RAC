// Algoritmi in diagram poteka. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, three theory groups, the matura revision set moved among
// the graded sets as "Ponavljanje" (agreed 8. 11. 2026), and the diagram label switch (Flowgorithm / Matura) kept.

const ICONS = {
  zapis: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="5" width="28" height="38" rx="3"/><path d="M16 15h16M16 22h16M16 29h16M16 36h9"/></svg>',
  gradniki: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="4" width="20" height="9" rx="2"/><path d="M24 13v5"/><path d="M24 18l10 8-10 8-10-8z"/><path d="M24 34v4"/><rect x="14" y="38" width="20" height="7" rx="2" class="fill" opacity=".35"/></svg>',
  program: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l10 8-10 8-10-8z"/><path d="M24 20v9M19 25l5 5 5-5"/><rect x="9" y="33" width="30" height="11" rx="2"/><path d="M17 38.5h14" opacity=".6"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026).
const GROUPS = [
  { id: 'g-zapis', icon: 'zapis', title: 'Algoritem in zapis', pages: ['algoritem', 'zapis', 'simboli'] },
  { id: 'g-gradniki', icon: 'gradniki', title: 'Gradniki in sled', pages: ['gradniki', 'sled'] },
  { id: 'g-program', icon: 'program', title: 'Od diagrama do programa', pages: ['java', 'nacrtovanje'] },
];
const TITLE = 'Algoritmi in diagram poteka';
const KICKER = 'LAV-RAČ3 · 2. poglavje';

// The label switch: the artifact built it into its own left column, which the shell replaces. The shell asks for one
// fresh copy per place (rail, phone list); a change redraws the diagrams in place, because the cards are already
// in the shell's pages and must not be rebuilt.
const TOOLS = `const langBox = () => {
  const d = document.createElement("div");
  d.className = "langsw"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "Napisi v diagramih");
  d.innerHTML = '<span class="eyebrow">Napisi v diagramih</span><div class="seg"><button type="button" class="js-lang" data-lang="en" aria-pressed="true">Flowgorithm</button><button type="button" class="js-lang" data-lang="sl" aria-pressed="false">Matura</button></div>';
  d.querySelectorAll(".js-lang").forEach(b=>b.addEventListener("click",()=>{
    FLOW.setLang(b.dataset.lang);
    try{ localStorage.setItem("java-matura-diagram-lang", b.dataset.lang); }catch(e){}
    paintLang(); fillFigs(); redrawFigs();
  }));
  paintLang();
  return d;
};
function redrawFigs(){
  document.querySelectorAll("[data-ft]").forEach(e=>{ const t = T.find(x=>x.id===e.dataset.ft); if(t) e.innerHTML = FLOW.svg(t.fcq,{num:t.lv==="D"||t.lv==="C"}); });
  document.querySelectorAll("[data-fs]").forEach(e=>{ const t = T.find(x=>x.id===e.dataset.fs); if(t) e.innerHTML = FLOW.svg(t.fc); });
  document.querySelectorAll("[data-fh]").forEach(e=>{ const h = HOME.find(x=>x.id===e.dataset.fh); if(h) e.innerHTML = FLOW.svg(h.fc); });
}
`;
const ZAGON = `${TOOLS}fillFigs();
renderAll();
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
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim().replace(/^Najprej .*?, nato vaje/, "Vaje"), el: home },
    tools: langBox,
    sel: { head: ".thead", num: ".tnum", tags: ".tags", q: ".q", check: ".js-check", hint: ".js-hint", sol: ".js-sol", fb: ".feedback", actions: ":scope > .actions" },
  });
}`;

export default {
  module: 'LAV-RAČ3',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}
  .lr-mnav .langsw{flex-direction:row;align-items:center;gap:10px;flex-wrap:wrap}`,
  patches: [
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The matura revision set is graded among the others (agreed 8. 11. 2026).
    ['title:"Še več maturitetnih nalog", note:"Naloge iz drugih rokov za ponavljanje.", home:true',
      'title:"Ponavljanje", note:"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–F.", home:true'],
    // Programs can run anywhere, not only in Programiz (agreed 8. 11. 2026).
    ['<span>Zaženi v Eclipse, VS Code ali Programizu (tam razred preimenuj v Main), izpis prilepi spodaj.</span>',
      '<span>Zaženi program v poljubnem okolju (Eclipse, VS Code, Programiz …) in prilepi njegov izpis. V Programizu razred preimenuj v Main.</span>'],
    // Diagrams can be redrawn in place when the label switch changes: every place that draws one names its task.
    ['if(t.fcq) body += `<div class="fig">${FLOW.svg(t.fcq,{num:t.lv==="D"||(t.lv==="C")})}</div>`;',
      'if(t.fcq) body += `<div class="fig" data-ft="${t.id}">${FLOW.svg(t.fcq,{num:t.lv==="D"||(t.lv==="C")})}</div>`;'],
    ['if(t.fc) html += `<div class="fig"><div class="eyebrow" style="margin-bottom:8px">Diagram poteka</div>${FLOW.svg(t.fc)}</div>`;',
      'if(t.fc) html += `<div class="fig"><div class="eyebrow" style="margin-bottom:8px">Diagram poteka</div><div data-fs="${t.id}">${FLOW.svg(t.fc)}</div></div>`;'],
    ['${h.fc?`<div class="fig">${FLOW.svg(h.fc)}</div>`:""}', '${h.fc?`<div class="fig" data-fh="${h.id}">${FLOW.svg(h.fc)}</div>`:""}'],
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
