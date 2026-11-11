// Relacijska algebra (LAV-RAČ4, 1. poglavje). Connects the published artifact to the exercise shell: the portal's
// storage, one answer per task, four theory groups, the revision set from the Za doma page kept last among the
// exercises as "Ponavljanje" (as in the other chapters), the practice items without points left as "Za doma".
// The expression evaluator (RA) and the sample databases stay in the page: the server only learns the points.

const ICONS = {
  baza: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M6 18h36M6 28h36M18 8v32"/><rect x="6" y="8" width="36" height="10" rx="3" class="fill" opacity=".35"/></svg>',
  mnoz: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8v17a12 12 0 0 0 24 0V8"/><path d="M12 8v17a12 12 0 0 0 24 0V8z" class="fill" opacity=".35"/></svg>',
  oper: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 8h36L28 26v13l-8-4V26z"/><path d="M6 8h36l-5 6H11z" class="fill" opacity=".35"/></svg>',
  stik: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="24" r="12"/><circle cx="30" cy="24" r="12"/><path d="M24 13.6A12 12 0 0 0 24 34.4A12 12 0 0 0 24 13.6z" class="fill" opacity=".35"/></svg>',
  izraz: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 8H9v32h8M31 8h8v32h-8"/><circle cx="24" cy="24" r="3.5" class="fill" opacity=".35"/></svg>',
};
// Theory groups (proposed and confirmed by the teacher 11. 11. 2026): pages in the artifact's own order. Since the artifact has a page
// per operation (11. 11. 2026, evening), the set operations and the product are a group of their own (the teacher asked for it), and both
// joins go with the quotient.
const GROUPS = [
  { id: 'g-baza', icon: 'baza', title: 'Pojmi in baza', pages: ['uvod', 'pojmi'] },
  { id: 'g-oper', icon: 'oper', title: 'Osnovne operacije', pages: ['selekcija', 'projekcija', 'preimenovanje'] },
  { id: 'g-mnoz', icon: 'mnoz', title: 'Množične operacije', pages: ['unija', 'presek', 'razlika', 'produkt'] },
  { id: 'g-stik', icon: 'stik', title: 'Stiki in količnik', pages: ['stik', 'thetastik', 'kolicnik'] },
  { id: 'g-izraz', icon: 'izraz', title: 'Izrazi v praksi', pages: ['prioriteta', 'sql', 'postopek'] },
];
const TITLE = 'Relacijska algebra';
const KICKER = 'LAV-RAČ4 · 1. poglavje';
const ZAGON = `fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();
renderAll();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  const sets = LEVELS.map(L=>({ id: L.id, tag: L.home ? "G" : L.tag, title: L.title, note: L.note, el: document.getElementById(L.id),
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
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The revision set (artifact id "doma", which is also the id of the Za doma section) is "Ponavljanje" and gets its
    // own id; the shell lettering puts it after the sets A–F, and Za doma takes the next letter.
    ['{"id":"doma","tag":"H","title":"Za doma","note":"Kombinirane naloge za samostojno ponavljanje. Vsaka zahteva dve ali tri operacije.","home":true}',
      '{"id":"doma-mat","tag":"H","title":"Ponavljanje","note":"Kombinirane naloge za samostojno ponavljanje. Vsaka zahteva dve ali tri operacije.","home":true}'],
    // The portal's own rules say how hints and solutions count; the note must not contradict them.
    [' Namigi so zastonj, ogled rešitve pa nalogo izloči iz točk.', ''],
    // The source note no longer names the old course (RAČ-LAV), as in the other chapters.
    ['(uvod in vaje) za RAČ-LAV, 4. letnik.', '(uvod in vaje) za 4. letnik.'],
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
    save(); LavRac.answered(t.idx, ok, msg);`],
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
