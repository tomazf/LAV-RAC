// Konceptualni in logični model (LAV-RAČ4, 3. poglavje). Connects the published artifact to the exercise shell, as 4.2:
// the portal's storage, one answer per task, five theory groups, the revision set from the Za doma page kept last among
// the exercises as "Ponavljanje", the practice items without points left as "Za doma".
// The drawing tasks with a self-assessment rubric (diagrams and schemas drawn on paper or in MySQL Workbench) are
// »Sam preveri« tasks (agreed 10. 11. 2026): no points, the student compares the work with the solution and the criteria
// and ticks »Preveril sem«. The rubric stays as a list of criteria. The schemas typed in the page are kept by the portal.

import { partialCredit } from './qformat.js';

const ICONS = {
  model: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="14" height="10" rx="2"/><rect x="28" y="19" width="14" height="10" rx="2"/><rect x="6" y="32" width="14" height="10" rx="2"/><path d="M20 11h4v26h-4M24 24h4"/><rect x="28" y="19" width="14" height="10" rx="2" class="fill" opacity=".35"/></svg>',
  ent: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="7" width="32" height="34" rx="3"/><path d="M8 17h32M14 24h6M14 31h14"/><circle cx="31" cy="24" r="2"/><rect x="8" y="7" width="32" height="10" rx="3" class="fill" opacity=".35"/></svg>',
  raz: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="17" width="12" height="14" rx="2"/><rect x="33" y="17" width="12" height="14" rx="2"/><path d="M15 24h18M28 24l5-5M28 24l5 5M20 19v10"/><rect x="33" y="17" width="12" height="14" rx="2" class="fill" opacity=".35"/></svg>',
  shema: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="3"/><path d="M6 19h36M6 29h36M18 9v30"/><rect x="6" y="9" width="12" height="30" rx="3" class="fill" opacity=".35"/></svg>',
  orodje: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 38l14-14M24 24l6-6"/><circle cx="34" cy="14" r="8"/><path d="M8 40l4-4"/><circle cx="34" cy="14" r="8" class="fill" opacity=".35"/></svg>',
};
// Theory groups (proposed 17. 11. 2026, to be confirmed by the teacher): pages in the artifact's own order, matching the
// task sets A (1), B (2-4), C (5-9), D (10), E (11), F (12).
const GROUPS = [
  { id: 'g-model', icon: 'model', title: 'Od zahtev do modela', pages: ['uvod'] },
  { id: 'g-ent', icon: 'ent', title: 'Entitete, atributi in ključi', pages: ['entitete', 'atributi', 'kljuci'] },
  { id: 'g-raz', icon: 'raz', title: 'Razmerja in števnosti', pages: ['razmerja', 'stevnost', 'mn', 'sibki', 'branje'] },
  { id: 'g-shema', icon: 'shema', title: 'Diagram ER in relacijske sheme', pages: ['sheme', 'obratno'] },
  { id: 'g-orodje', icon: 'orodje', title: 'Postopek, orodje in povzetek', pages: ['postopek', 'workbench', 'utrjevanje'] },
];
// The drawing tasks with a rubric (teacher's names: set letter and place in the set).
const PREP = {
  self: ['D1', 'D2', 'D3', 'D6', 'E1', 'E2', 'E3', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'],
};
const TITLE = 'Konceptualni in logični model';
const KICKER = 'LAV-RAČ4 · 3. poglavje';
const ZAGON = `fillEr(); fillCard(); fillStepper(); fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();
renderAll();
{
  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];
  const home = document.getElementById("doma");
  const sets = LEVELS.map((L,i)=>({ id: L.id, tag: String.fromCharCode(65+i), title: L.title, note: L.note, el: document.getElementById(L.id),
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
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...partialCredit,
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The drawing tasks are »Sam preveri«: no points, so the notes do not promise any.
    [' Pri nalogah z oznako <span class="tag">Samoocena</span> diagram ali sheme narišeš na papir ali v MySQL Workbench, odpreš rešitev in obkljukaš merila, ki jih izpolnjuješ; vsako merilo je 1 točka. Pri drugih nalogah so namigi zastonj, ogled rešitve pa nalogo izloči iz točk.',
      ' Pri nalogah z oznako <span class="tag">Samoocena</span> diagram ali sheme narišeš na papir ali v MySQL Workbench, odpreš rešitev in svoje delo preveriš po merilih.'],
    ['Pri nalogah s samooceno zapis primerjaš z rešitvijo in obkljukaš merila (razlaga 10).', 'Pri nalogah s samooceno zapis primerjaš z rešitvijo in ga preveriš po merilih (razlaga 10).'],
    ['nariši diagram ER na papir ali v MySQL Workbench, nato se samooceni (razlaga 11).', 'nariši diagram ER na papir ali v MySQL Workbench, nato ga primerjaj z rešitvijo (razlaga 11).'],
    ['Nariši, nato odpri rešitev in se samooceni po štirih merilih iz razlage 12.', 'Nariši, nato odpri rešitev in svoj diagram preveri po štirih merilih iz razlage 12.'],
    // The revision set (artifact id "doma", which is also the id of the Za doma section) is "Ponavljanje" and gets its
    // own id; the shell lettering puts it after the sets A–F, and Za doma takes the next letter.
    ['{"id":"doma","tag":"H","title":"Za doma","note":"Preostale maturitetne naloge z diagrami ER. Vse so iz izpitnih pol 2 in štejejo k točkam.","home":true}',
      '{"id":"doma-mat","tag":"H","title":"Ponavljanje","note":"Preostale maturitetne naloge z diagrami ER, vse iz izpitnih pol 2.","home":true}'],
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
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : t.key ? t.key : "own-"+i; });',
      `LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : t.key ? t.key : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.self ? Math.min(t.pts, 3) : t.pts });
S = LavRac.loadUi();`],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // The schemas a student types in a drawing task are the answer the portal keeps.
    ['Tvoj zapis (neobvezno, ostane shranjen v tem brskalniku)', 'Tvoj zapis (neobvezno, se shrani)'],
    ['const wE = $(`#w-${t.id}`,el); if(wE){ if(s.w) wE.value = s.w; wE.addEventListener("input",collect); }',
      'const wE = $(`#w-${t.id}`,el); if(wE){ if(typeof s.v === "string") wE.value = s.v; wE.addEventListener("input",collect); }'],
    ['const wEl = $(`#w-${t.id}`,el); if(wEl) s.w = wEl.value;', 'const wEl = $(`#w-${t.id}`,el); if(wEl) s.v = wEl.value;'],
    // A drawing task gets a check button, which the shell turns into »Preveril sem«; its solution button is the usual one.
    // The practice task on the Postopek page (lv "P") keeps its own self-assessment.
    [`\${t.type==="self" ? "" : '<button class="btn primary js-check" type="button">Preveri</button>'}`,
      `\${t.type==="self" && t.lv==="P" ? "" : '<button class="btn primary js-check" type="button">Preveri</button>'}`],
    ['<button class="btn ${t.type==="self"?"primary":"ghost"} js-sol" type="button">${t.type==="self"?"Prikaži rešitev in se oceni":"Prikaži rešitev"}</button>',
      '<button class="btn ${t.type==="self" && t.lv==="P"?"primary":"ghost"} js-sol" type="button">${t.type==="self" && t.lv==="P"?"Prikaži rešitev in se oceni":"Prikaži rešitev"}</button>'],
    ['$(".js-sol",el).textContent = t.type==="self" ? "Prikaži rešitev in se oceni" : "Prikaži rešitev";',
      '$(".js-sol",el).textContent = t.type==="self" && t.lv==="P" ? "Prikaži rešitev in se oceni" : "Prikaži rešitev";'],
    // The rubric of a drawing task is a list of criteria to check the work by; it gives no points.
    ['    if(t.type==="self") html += `<fieldset class="rub">',
      '    if(t.type==="self" && t.lv!=="P") html += `<div><div class="eyebrow">Svoje delo preveri po merilih</div><ul class="crit">${t.rub.map(r=>`<li>${fmtQ(r)}</li>`).join("")}</ul></div>`;\n    else if(t.type==="self") html += `<fieldset class="rub">'],
    // One answer per task. Something missing (an empty field) is not an answer yet; anything else locks the task.
    [`    if(ok){ if(s.state!=="seen") s.state="ok"; save(); }
    show(ok, ok ? (s.state==="seen" ? "Pravilno. Točke se ne štejejo, ker si si ogledal rešitev." : (t.pts ? \`Pravilno. +\${ptsLabel(t.pts)}\` : "Pravilno.")) : ("Ni še pravilno. "+msg).trim());
    paint(); progress();`,
    // The three practice tasks on the Postopek page (lv "P", no points, "Poskusi sam") stay in the page: state in the portal's local
    // storage, nothing sent to the server. Every other task goes through the shell.
    `    if(t.lv==="P"){ if(ok){ if(s.state!=="seen") s.state="ok"; save(); } show(ok, ok ? "Pravilno." : ("Ni še pravilno. "+msg).trim()); paint(); return; }
    if(!ok && t.type==="blanks" && t.b.every((_,k)=>!$(\`#b-\${t.id}-\${k}\`,el).value.trim())){ show(false,"Najprej vpiši odgovor."); return; }
    if(!ok && /^Razvrsti/.test(msg)){ show(false,msg); return; }
    save(); LavRac.answered(t.idx, ok, msg, part);`],
    ['if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      'if(hintB) hintB.addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); if(t.lv!=="P" && !t.self) LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); wireRub(); solEl.hidden=false; if(s.state!=="ok" && t.type!=="self"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); wireRub(); solEl.hidden=false; if(t.lv==="P"){ if(s.state!=="ok" && t.type!=="self"){ s.state="seen"; save(); paint(); } } else LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    ['cur = location.hash.slice(1) || "uvod";\n', ''],
    // Start.
    ['fillEr(); fillCard(); fillStepper(); fillRels(); fillPlay(); fillFormulas(); fillSteps(); fillQuiz(); fillTry();\n\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
  ],
};
