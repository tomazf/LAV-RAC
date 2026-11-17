// Java in delovanje JVM. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, two theory groups, and the matura revision set moved
// among the graded sets as "Ponavljanje" (agreed 8. 11. 2026).
// Since 18. 11. 2026 the explanations also end with small tasks »Preizkusi se« (no points, nothing is kept) and the artifact's own
// self-assessment of code tasks is not used (see codeAsBefore in qformat.js).

import { statements, QTEXT, outputCompare, partialCredit, codeAsBefore, miniTasks } from './qformat.js';
const ICONS = {
  jezik: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 14L7 24l10 10M31 14l10 10-10 10"/><path d="M27 10l-6 28"/></svg>',
  orodja: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="6" width="40" height="36" rx="3"/><rect x="10" y="14" width="28" height="22" rx="2"/><rect x="16" y="21" width="16" height="10" rx="2" class="fill" opacity=".35"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026).
const GROUPS = [
  { id: 'jezik', title: 'Jezik in prevajanje', pages: ['jezik', 'prevajanje', 'pot'] },
  { id: 'orodja', title: 'Orodja, zagon in napake', pages: ['jdk', 'ukazi', 'class', 'napake'] },
];
// The teacher's task names: the set letter and the place in the set as the artifact shows it (10. 11. 2026).
const PREP = {
  self: ['C10', 'D11'],
  nobtn: ['C5', 'C6', 'C9', 'C11', 'C12', 'D9', 'D10'],
};
const TITLE = 'Java in delovanje JVM';
const KICKER = 'LAV-RAČ3 · 1. poglavje';
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
    vajeNote: document.querySelector("#naloge .prose").innerHTML.replace(" Več jih najdeš še na strani Za doma, z enakim", " Z enakim"),
    groups: ${JSON.stringify(GROUPS.map((g) => ({ ...g, icon: ICONS[g.id] })))}.map(g=>({ ...g, pages: g.pages.map(id=>({ id, title: title(id), el: document.getElementById(id) })) })),
    sets,
    extra: { id: "doma", title: "Za doma", note: home.querySelector(":scope > .prose").textContent.trim().replace(/^Najprej .*?, nato vaje/, "Vaje"), el: home },
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
    ...outputCompare(false),
    // The tasks with code keep the portal's handling, the small tasks of the explanations keep nothing (agreed 18. 11. 2026).
    ...codeAsBefore,
    ...miniTasks,
    // The introduction of the tasks says nothing about the artifact's self-assessment of code tasks (not used here).
    [" Naloge so dveh vrst. Pri nalogah z <strong>enoličnim odgovorom</strong> (izbira, dopolnjevanje, razvrščanje, napoved izpisa) stran odgovor preveri in podeli točke; če si pred pravilnim odgovorom ogledal rešitev, se točke ne štejejo. Pri nalogah z oznako <span class=\"tag self\">Samoocena</span> <strong>sam napišeš kodo</strong> (preizkusiš jo v Programizu, Eclipse ali VS Code). Stran je ne more preveriti, zato točk ni: kodo in neobvezen izpis shranimo, nato klikneš »Primerjaj z rešitvijo«, kjer vidiš svojo kodo ob primeru rešitve, prečrtaš merila in sam oceniš, ali nalogo znaš. Vrednosti so zapisane v kodi, vnosa s Scannerjem ni treba preizkušati.",
      " Odgovor preveri sam, če se zatakne, odpri namig. Če si ogledaš rešitev, preden nalogo pravilno rešiš, se ti točke ne štejejo."],
    // C10 is checked by the student: its solution no longer says the output is compared exactly.
    ['Pazi na pike in velike črke, izpis primerjamo natančno.', 'Pazi na ločila: vejica in klicaj v prvi vrstici ter pika v drugi.'],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Set A title shortened (corrected 10. 11. 2026).
    ['title:"Programski jeziki in vrste kode"', 'title:"Programski jeziki"'],
    // The matura revision set is graded among the others (agreed 8. 11. 2026).
    ['title:"Še več maturitetnih nalog", note:"Naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–D.", home:true',
      'title:"Ponavljanje", note:"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–D.", home:true'],
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
    // Corrections of 10. 11. 2026: the programs the student writes are checked by the student (no output to type),
    // the tasks named by the teacher have no copy / Programiz buttons, and Za doma loses D3 and D6 (the rest is renumbered).
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});\nHOME.splice(5, 1); HOME.splice(2, 1);\nT.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });\nLavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });\nS = LavRac.loadUi();`],
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
    ['cur = location.hash.slice(1) || "jezik";\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
    // Long statements: paragraphs and bold key words (11. 11. 2026), the same way as in LAV-RAČ2 chapter 2.
    QTEXT,
    ...statements([
      [
        "Napisali smo program v programskem jeziku Java. Datoteka z napisanim programom ima končnico java. Programu v taki obliki pravimo (1) ___. S prevajalnikom prevedemo program in dobimo datoteko s končnico class. Programu v taki obliki pravimo (2) ___.",
        "Napisali smo program v programskem jeziku Java. Datoteka z napisanim programom ima končnico **java**. Programu v taki obliki pravimo (1) ___.\nS **prevajalnikom** prevedemo program in dobimo datoteko s končnico **class**. Programu v taki obliki pravimo (2) ___.",
      ],
      [
        "V urejevalniku imamo zapisano programsko kodo (zgoraj). Zapišite ukaz, s katerim prevedemo program v vmesno kodo, in ime ter končnico dobljene datoteke.",
        "V urejevalniku imamo zapisano programsko kodo (zgoraj).\nZapišite **ukaz**, s katerim prevedemo program v vmesno kodo, in **ime ter končnico** dobljene datoteke.",
      ],
      [
        "V urejevalniku je zapisan javanski program (zgoraj). Zapišite ime in končnico datoteke, v katero je treba shraniti program, in ukaz, s katerim iz konzole prevedemo program v vmesno kodo.",
        "V urejevalniku je zapisan javanski program (zgoraj).\nZapišite **ime in končnico datoteke**, v katero je treba shraniti program, in **ukaz**, s katerim iz konzole prevedemo program v vmesno kodo.",
      ],
      [
        "V mapi C:\\vaje je samo datoteka Pozdrav.java. Zapiši ukaz za prevajanje, ukaz za zagon in imena VSEH datotek, ki so v mapi po prevajanju (ločene z vejico).",
        "V mapi **C:\\vaje** je samo datoteka **Pozdrav.java**. Zapiši:\n- **ukaz za prevajanje**\n- **ukaz za zagon**\n- imena **VSEH datotek**, ki so v mapi po prevajanju (ločene z vejico)",
      ],
      [
        "Pri prevajanju prevajalnik javi napake: Syntax error, insert \";\" to complete Statement (line 5); x cannot be resolved to a variable (line 9); x cannot be resolved to a variable (line 10). Napake lahko odpravimo, če pravilno dopolnimo vrstici 5 in 9. Napišite celotni dopolnjeni vrstici. (Številke vrstic niso del kode.)",
        "Pri prevajanju prevajalnik javi napake:\n- Syntax error, insert \";\" to complete Statement (line 5)\n- x cannot be resolved to a variable (line 9)\n- x cannot be resolved to a variable (line 10)\nNapake lahko odpravimo, če pravilno dopolnimo **vrstici 5 in 9**. Napišite **celotni dopolnjeni vrstici**. (Številke vrstic niso del kode.)",
      ],
    ]),
  ],
};
