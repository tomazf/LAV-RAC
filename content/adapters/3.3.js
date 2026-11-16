// Temeljni gradniki programa. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, three theory groups, the matura revision set moved among
// the graded sets as "Ponavljanje" (agreed 8. 11. 2026), and the matura's diagram labels only (the switch was dropped 10. 11. 2026).

import { statements, QTEXT, outputCompare } from './qformat.js';
const ICONS = {
  podatki: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 7c-4 0-5 2-5 5v5c0 3-2 5-5 7 3 2 5 4 5 7v5c0 3 1 5 5 5"/><path d="M31 7c4 0 5 2 5 5v5c0 3 2 5 5 7-3 2-5 4-5 7v5c0 3-1 5-5 5"/><rect x="19.5" y="19.5" width="9" height="9" rx="1.5" class="fill" opacity=".35"/></svg>',
  izpis: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="7" width="40" height="28" rx="3"/><path d="M12 16l7 5-7 5M23 27h9"/><path d="M16 42h16M24 35v7"/></svg>',
  racunanje: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="4"/><path d="M24 6v36M6 24h36"/><path d="M12 15h8M16 11v8"/><path d="M29 15h8"/><path d="M30 29l8 8M38 29l-8 8"/><path d="M12 33h8" opacity=".6"/><path d="M16 29.5v0M16 36.5v0"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026).
const GROUPS = [
  { id: 'g-podatki', icon: 'podatki', title: 'Program in podatki', pages: ['struktura', 'tipi'] },
  { id: 'g-izpis', icon: 'izpis', title: 'Izpis in vnos', pages: ['izpis', 'vnos'] },
  { id: 'g-racunanje', icon: 'racunanje', title: 'Računanje in potek programa', pages: ['aritmetika', 'gradniki', 'napake'] },
];
// The teacher's task names: the set letter and the place in the set as the artifact shows it (10. 11. 2026); B7 is
// removed, so B8 onwards move up by one in the portal. The program tasks C6, C12 and D10 are checked by the student.
const PREP = {
  self: ['C6', 'C12', 'D10'],
  nobtn: ['A4', 'A5', 'B13', 'C2', 'C3', 'C5', 'C10', 'D3', 'E5', 'F7'],
  inline: ['A1', 'B6', 'C8'],
  same: ['B6'],
  cols: ['B4'],
  list: ['B12'],
  remove: ['B7'],
};
// Za doma 5 (debugger): no buttons, and the worked trace is code, not a sentence.
const H5_TRACE = [
  'int x = 1;           // x = 1',
  'int a = 5;           // x = 1, a = 5',
  'int b = ++x + a--;   // ++x: x = 2 (vrednost 2); a--: vrednost 5, nato a = 4; b = 2 + 5 = 7',
  'System.out.println(x + " " + a + " " + b);   // izpis: 2 4 7',
].join('\n');
const H5_SOL = 'Razhroščevalnik v oknu s spremenljivkami (Variables) prikaže iste vrednosti kot sled v kodi. Po zadnjem stavku je x = 2, a = 4, b = 7 in program izpiše »2 4 7«.';
const TITLE = 'Temeljni gradniki programa';
const KICKER = 'LAV-RAČ3 · 3. poglavje';

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
    // The typed output is compared without regard to letter case and repeated spaces (agreed 16. 11. 2026).
    ...outputCompare(true),
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The matura revision set is graded among the others (agreed 8. 11. 2026).
    ['title:"Še več maturitetnih nalog", note:"Naloge iz drugih rokov za ponavljanje.", home:true',
      'title:"Ponavljanje", note:"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–E.", home:true'],
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
      `LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});
HOME[4].nobtn = true; HOME[4].jsolCode = ${JSON.stringify(H5_TRACE)}; HOME[4].sol = ${JSON.stringify(H5_SOL)};
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    // The home tasks that carry code show no copy / Programiz buttons when they say so (nobtn).
    ['${h.code?`<div class="actions"><button class="btn js-c" type="button">Kopiraj kodo</button>', '${h.code&&!h.nobtn?`<div class="actions"><button class="btn js-c" type="button">Kopiraj kodo</button>'],
    // Questions: the blanks are typed in the code (A1, B6) and the descriptions of B12 are a list.
    ['q:"Dopolni najmanjši program v Javi. Manjkajoča mesta so označena s tremi podčrtaji, po vrsti od zgoraj navzdol.",',
      'q:"Dopolni najmanjši program v Javi: manjkajoče dele vpiši kar v kodo. Vrzeli so po vrsti od zgoraj navzdol: 1. ključna beseda, ki uvede razred, 2. ime metode, v kateri se izvajanje začne, 3. znak na koncu stavka.",'],
    ['q:"Vpiši tip, ki ga zahteva vsaka deklaracija.",', 'q:"Vpiši v kodo tip, ki ga zahteva vsaka deklaracija.",'],
    ['q:"Vsakemu pojmu ustreza natanko en opis. Opisi: A – ime spremenljivke, B – znakovna vrednost, C – celoštevilska vrednost, D – poljuben podatkovni tip, E – niz, F – ključna beseda programskega jezika Java. Vpiši črko opisa.",',
      'q:"Vsakemu pojmu ustreza natanko en opis. Opisi:\\n- A – ime spremenljivke\\n- B – znakovna vrednost\\n- C – celoštevilska vrednost\\n- D – poljuben podatkovni tip\\n- E – niz\\n- F – ključna beseda programskega jezika Java\\nVpiši črko opisa.",'],
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
    // Start. The diagrams use the matura's labels, as the students meet them there (agreed 10. 11. 2026): no switch.
    ['cur = location.hash.slice(1) || "jezik";\n', ''],
    // The matura's labels from the start: the Za doma figures are drawn before the start code runs.
    ['let LANG = "en";', 'let LANG = "sl";'],
    ['try{ FLOW.setLang(localStorage.getItem("java-matura-diagram-lang")||"en"); }catch(e){ FLOW.setLang("en"); }', 'FLOW.setLang("sl");'],
    [`document.querySelectorAll(".js-lang").forEach(b=>b.addEventListener("click",()=>{
  FLOW.setLang(b.dataset.lang);
  try{ localStorage.setItem("java-matura-diagram-lang", b.dataset.lang); }catch(e){}
  paintLang(); fillFigs(); renderAll();
}));
`, ''],
    ['paintLang(); fillFigs();\nrenderAll();\nprogress();\nif(location.hash) setTimeout(()=>window.scrollTo(0,0), 0);', ZAGON],
    // Long statements: paragraphs and bold key words (11. 11. 2026), the same way as in LAV-RAČ2 chapter 2.
    QTEXT,
    ...statements([
      [
        "Dopolni najmanjši program v Javi: manjkajoče dele vpiši kar v kodo. Vrzeli so po vrsti od zgoraj navzdol: 1. ključna beseda, ki uvede razred, 2. ime metode, v kateri se izvajanje začne, 3. znak na koncu stavka.",
        "Dopolni **najmanjši program v Javi**: manjkajoče dele vpiši kar v kodo.\n**Vrzeli** so po vrsti od zgoraj navzdol:\n- **1.** ključna beseda, ki uvede razred\n- **2.** ime metode, v kateri se izvajanje začne\n- **3.** znak na koncu stavka",
      ],
      [
        "Napiši izsek programa, ki ustvari konstanto konst z vrednostjo 1.23456 in jo izpiše na dve decimalni mesti. Pričakovan izpis: 1.23 (na računalniku s slovenskimi nastavitvami printf izpiše vejico: 1,23, tudi to je pravilno).",
        "Napiši izsek programa, ki ustvari **konstanto konst** z vrednostjo **1.23456** in jo izpiše na **dve decimalni mesti**.\n**Pričakovan izpis:** 1.23 (na računalniku s slovenskimi nastavitvami printf izpiše vejico: 1,23, tudi to je pravilno).",
      ],
      [
        "Ana, rojena leta 2008, je visoka 1.68 m. Shrani podatke v spremenljivke ustreznih tipov (ime je String, leto int, višina double; vrednosti zapiši kar v kodo) in izpiši natanko to besedilo, pri čemer vrednosti vzemi iz spremenljivk.",
        "**Ana**, rojena leta **2008**, je visoka **1.68 m**.\nShrani podatke v spremenljivke ustreznih tipov (ime je **String**, leto **int**, višina **double**; vrednosti zapiši kar v kodo) in izpiši natanko to besedilo, pri čemer vrednosti vzemi **iz spremenljivk**.",
      ],
      [
        "V programu imamo celoštevilsko spremenljivko stevilo. Zapišite stavek, ki vrednosti v spremenljivki stevilo odreže najbolj desno števko (števko, ki predstavlja enice). Primer: vrednost 123456 po taki operaciji postane 12345.",
        "V programu imamo celoštevilsko spremenljivko **stevilo**. Zapišite stavek, ki vrednosti v spremenljivki stevilo **odreže najbolj desno števko** (števko, ki predstavlja enice).\n**Primer:** vrednost 123456 po taki operaciji postane 12345.",
      ],
      [
        "Podani sta deklaraciji int a = 10; in int b;. Zapišite vrednosti obeh spremenljivk po izvedbi vsakega od stavkov b = a++; in b = ++a; (stavka se izvedeta drug za drugim).",
        "Podani sta deklaraciji **int a = 10;** in **int b;**.\nZapišite vrednosti obeh spremenljivk po izvedbi vsakega od stavkov **b = a++;** in **b = ++a;** (stavka se izvedeta **drug za drugim**).",
      ],
      [
        "Napišite naslednji izraz v programskem jeziku Java: x = (b + √(b² − 4ac)) / (2a). Izračunaj ga za a = 2, b = 6, c = 4. Pričakovan izpis: 2.0. Korenjenje: Math.sqrt(...).",
        "Napišite naslednji izraz v programskem jeziku Java: **x = (b + √(b² − 4ac)) / (2a)**.\nIzračunaj ga za **a = 2, b = 6, c = 4**. **Pričakovan izpis:** 2.0.\n**Korenjenje:** Math.sqrt(...).",
      ],
    ]),
  ],
};
