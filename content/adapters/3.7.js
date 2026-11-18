// Tabele v Javi. Connects the published artifact to the exercise shell: the portal's storage (also for answers typed as
// program output), one answer per task, four theory groups, the laboratory set renamed "Naloge za utrjevanje", the
// extra set "Dodatne vaje" and the matura revision set kept last as "Ponavljanje" (as in 3.6), no mention of laboratory
// exercises, and the matura's diagram labels only. Like 3.1 since 18. 11. 2026, the explanations end with small tasks
// »Preizkusi se« (no points, nothing kept) and the artifact's own self-assessment of code tasks is not used (codeAsBefore).

import { QTEXT, outputCompare, partialCredit, codeAsBefore, miniTasks } from './qformat.js';
const ICONS = {
  tabela: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="16" width="38" height="16" rx="3"/><path d="M15 16v16M24 16v16M33 16v16"/><circle cx="19.5" cy="24" r="3" class="fill" opacity=".35"/></svg>',
  referenca: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="16" height="12" rx="3"/><rect x="27" y="28" width="16" height="12" rx="3" class="fill" opacity=".35"/><path d="M21 14h8a6 6 0 0 1 6 6v8M35 28l-3-4M35 28l3-4"/></svg>',
  algoritem: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 36h8V24h8V14h8v12h8v10h4"/><circle cx="26" cy="9" r="3" class="fill" opacity=".35"/></svg>',
  mreza: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="4"/><path d="M18 6v36M30 6v36M6 18h36M6 30h36"/><rect x="18" y="18" width="12" height="12" class="fill" opacity=".35"/></svg>',
};
// Theory groups proposed to the teacher (18. 11. 2026), to be confirmed.
const GROUPS = [
  { id: 'g-tabela', icon: 'tabela', title: 'Tabela in pomnilnik', pages: ['kaj', 'ustvarjanje', 'istitip', 'pomnilnik'] },
  { id: 'g-ref', icon: 'referenca', title: 'Reference in metode', pages: ['reference', 'metode'] },
  { id: 'g-algo', icon: 'algoritem', title: 'Algoritmi in polnjenje', pages: ['sprehod', 'nakljucna'] },
  { id: 'g-2d', icon: 'mreza', title: 'Dvodimenzionalne tabele', pages: ['dvorazsezne', 'napake'] },
];
// Sorted at import (18. 11. 2026) by the rules in docs/LAV-RAC.md, to be confirmed by the teacher:
//   self: the programs of the former laboratory set (G) and of the extra set (H) are written elsewhere and ticked by the
//         student, as in 3.4 to 3.6 (the code stays to be saved, the right output is shown),
//   nobtn: the tasks that only ask for an output have no copy / Programiz buttons,
//   inline: the tasks with blanks in the code (E1, E14, F13, I1).
const PREP = {
  // A and B: the output is only true/false or a value or two the student can work out by heart, so the student writes the code
  // and checks it against the solution (agreed 18. 11. 2026).
  self: [...Array.from({ length: 20 }, (_, i) => 'G' + (i + 1)), ...Array.from({ length: 14 }, (_, i) => 'H' + (i + 1)),
    'A9', 'F8', 'D1', 'E3', 'E5', 'E6', 'E17', 'E18', 'E23', 'E25', 'E26', 'E28', 'F12', 'F14', 'F16', 'F19', 'I4', 'I5'],
  nobtn: ["B2","B3","B4","B5","B11","B12","C2","C3","C5","C7","C8"],
  inline: ['E1', 'E14', 'F13', 'I1'],
};
// The tags of the laboratory exercise (»RAČ-LAV 3 · vaja 6 · N«); the names of the collections stay.
const LABS = Array.from({ length: 20 }, (_, i) => String(i + 1));
const TITLE = 'Tabele v Javi';
const KICKER = 'LAV-RAČ3 · 7. poglavje';
const ZAGON = `fillFigs();
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
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim().replace(/^Najprej .*?, nato praktične vaje/, "Vaje"), el: home },
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
  body{padding-left:0;padding-right:0}`,
  patches: [
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...partialCredit,
    // The typed output is compared without regard to letter case and repeated spaces (agreed 16. 11. 2026).
    ...outputCompare(true),
    // Must come before the replacement of »Pokaži rešitev«.
    // The tasks with code keep the portal's handling, the small tasks of the explanations keep nothing (agreed 18. 11. 2026).
    ...codeAsBefore,
    ...miniTasks,
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The laboratory exercises are no longer mentioned (as in 3.5 and 3.6): set G becomes "Naloge za utrjevanje", set H
    // "Dodatne vaje", the tags "RAČ-LAV 3 · vaja 6 · N" go, and the matura revision set is "Ponavljanje".
    ['{"id": "naloge-g", "tag": "G", "title": "Laboratorijske vaje RAČ-LAV 3 · vaja 6", "note": "Vseh 20 nalog iz laboratorijske vaje 6 (tabele). Vrednosti so zapisane v kodi, Scannerja ne potrebuješ."}',
      '{"id": "naloge-g", "tag": "G", "title": "Naloge za utrjevanje", "note": "Programi s tabelami. Vrednosti so zapisane v kodi, Scannerja ne potrebuješ."}'],
    ['"title": "Dodatne vaje: Vaje s tabelami"', '"title": "Dodatne vaje"'],
    ['"title": "Maturitetne naloge za ponavljanje", "note": "Še šest nalog iz izpitnih pol 1, ki so zelo podobne nalogam v sklopih E in F ali so daljše."',
      '"title": "Ponavljanje", "note": "Še šest maturitetnih nalog, ki so zelo podobne nalogam v sklopih E in F ali so daljše."'],
    ...LABS.map((n) => [', "lab": "RAČ-LAV 3 · vaja 6 · ' + n + '"', '']),
    ['Naloge z oznako RAČ-LAV 3 so iz laboratorijske vaje 6, naloge z oznako Vaje s tabelami pa iz istoimenske zbirke.',
      'Naloge z oznako Vaje s tabelami so iz istoimenske zbirke.'],
    [' Laboratorijske vaje: RAČ-LAV 3. letnik, vaja 6 – tabele.', ''],
    ['["naloge-g", "Naloge G · Laboratorijske vaje"]', '["naloge-g", "Naloge G · Utrjevanje"]'],
    // The introduction of the tasks says nothing about the artifact's self-assessment of code tasks (not used here).
    [" Pri nalogah z oznako <span class=\"tag self\">Samoocena</span> <strong>napišeš kodo</strong>. Stran je ne more preveriti, zato točk ni: kodo in neobvezen izpis shranimo, nato klikneš »Primerjaj z rešitvijo«, kjer vidiš svojo kodo ob primeru rešitve, prečrtaš merila in sam oceniš, ali nalogo znaš. Pri metodah je glavni program že pripravljen.",
      " Pri nalogah, kjer <strong>napišeš kodo</strong>, jo zaženeš v poljubnem okolju in prilepiš izpis; stran ga preveri. Pri metodah je glavni program že pripravljen."],
    // The chapters of LAV-RAČ3 are numbered as in the plan: strings are 8, classes are 10 (Objektno programiranje).
    ['so v poglavjih 8 in 11.', 'so v poglavjih 8 in 10.'],
    ['razredi so v poglavju 11.)', 'razredi so v poglavju 10.)'],
    // The blanks of E1, E14, F13 and I1 are typed in the code (inline): the shell's gap is ___ (one per field).
    ...[
[
"\"snip\": \"public class ParnostStevil {\\n  ____________ main(String[] args) {\\n    int[] stevila = new int[]{1,2,3,4,5,6,7,8,9,10};\\n    for(int i=0; i < stevila.length; i++){\\n      if(____________)\\n        System.out.println(stevila[i] + \\\" je sodo stevilo.\\\");\\n      else\\n        System.out.println(stevila[i] + \\\" je liho stevilo.\\\");\\n    }\\n  }\\n}\"",
"\"snip\": \"public class ParnostStevil {\\n  ___ main(String[] args) {\\n    int[] stevila = new int[]{1,2,3,4,5,6,7,8,9,10};\\n    for(int i=0; i < stevila.length; i++){\\n      if(___)\\n        System.out.println(stevila[i] + \\\" je sodo stevilo.\\\");\\n      else\\n        System.out.println(stevila[i] + \\\" je liho stevilo.\\\");\\n    }\\n  }\\n}\""
],
[
"\"snip\": \"public static void main(String[] args) {\\n    int[] t1={14, 16, 18, 22, 21, 39, 28, 56, 11, 112};\\n    int[] t2=_______________;\\n    for(int i=0, j=0; _____________; i++)\\n        if (_____________==0){\\n            t2[j]=t1[i];\\n            j++;\\n        }\\n}\"",
"\"snip\": \"public static void main(String[] args) {\\n    int[] t1={14, 16, 18, 22, 21, 39, 28, 56, 11, 112};\\n    int[] t2=___;\\n    for(int i=0, j=0; ___; i++)\\n        if (___==0){\\n            t2[j]=t1[i];\\n            j++;\\n        }\\n}\""
],
[
"\"snip\": \"static int najNadDiagonalo(int [][] t){\\n    ________________________\\n    for (________________________)\\n        for (______________________________)\\n            if (t[i][j]>naj) naj=t[i][j];\\n    return naj;\\n}\"",
"\"snip\": \"static int najNadDiagonalo(int [][] t){\\n    ___\\n    for (___)\\n        for (___)\\n            if (t[i][j]>naj) naj=t[i][j];\\n    return naj;\\n}\""
],
[
"\"snip\": \"int tabela1[] = {13,18,11,26,33,39,88,52,112,212};\\nint tabela2[] = _______________;\\nfor (int i = 0, j = 0; _______________; i++)\\n    if (_______________== 0) {\\n        tabela2[j] = tabela1[i];\\n        j++;\\n    }\"",
"\"snip\": \"int tabela1[] = {13,18,11,26,33,39,88,52,112,212};\\nint tabela2[] = ___;\\nfor (int i = 0, j = 0; ___; i++)\\n    if (___== 0) {\\n        tabela2[j] = tabela1[i];\\n        j++;\\n    }\""
]
],
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
    // Task ids exist only from here on, so the shell learns the tasks here. The code checks (NEED) go by the teacher's
    // task names, counted the same way as in LavRac.prepare (set letter and place in the set).
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});
// The artifact shows the right output of every program (it was a self-assessment); a graded program hides it, as before.
T.forEach((t) => { if (t.type === "code" && !t.self) t.hideExp = true; });
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
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
    save(); LavRac.answered(t.idx, ok, msg, part);`],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    // Start. The diagrams use the matura's labels, as the students meet them there (agreed 10. 11. 2026): no switch.
    ['cur = location.hash.slice(1) || "kaj";\n', ''],
    // The matura's labels from the start: the figures are drawn before the start code runs.
    ['let LANG = "en";', 'let LANG = "sl";'],
    ['try{ FLOW.setLang(localStorage.getItem("java-matura-diagram-lang")||"en"); }catch(e){ FLOW.setLang("en"); }', 'FLOW.setLang("sl");'],
    [`document.querySelectorAll(".js-lang").forEach(b=>b.addEventListener("click",()=>{
  FLOW.setLang(b.dataset.lang);
  try{ localStorage.setItem("java-matura-diagram-lang", b.dataset.lang); }catch(e){}
  paintLang(); fillFigs(); renderAll();
}));
`, ''],
    ['paintLang(); fillFigs();\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
    // Long statements: paragraphs and bold key words, the same way as in the other chapters.
    QTEXT,
  ],
};
