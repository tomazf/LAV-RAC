// Arhitektura računalniških sistemov. Connects the published artifact to the exercise shell: the portal's storage,
// one answer per task, four theory groups, and for the assembler tasks a test run that does not count before
// the answer is handed in ("Oddaj" counts and locks, also when tests fail).

import { statements, partialCredit2 } from './qformat.js';
const ICONS = {
  procesor: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="12" width="24" height="24" rx="3"/><rect x="19" y="19" width="10" height="10" class="fill" opacity=".35"/><path d="M18 5v7M24 5v7M30 5v7M18 36v7M24 36v7M30 36v7M5 18h7M5 24h7M5 30h7M36 18h7M36 24h7M36 30h7"/></svg>',
  zbirnik: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="3"/><text x="10" y="22" font-size="10">LDAA</text><text x="10" y="34" font-size="10">STAA</text></svg>',
  pomnilniki: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6L42 40H6z"/><path d="M15 23h18M10 32h28"/></svg>',
  vi: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="8" width="12" height="8" rx="1.5"/><rect x="14" y="20" width="12" height="8" rx="1.5"/><rect x="24" y="32" width="12" height="8" rx="1.5" class="fill" opacity=".35"/><path d="M36 12h8M40 8l4 4-4 4"/></svg>',
};
// Theory groups agreed with the teacher (6. 11. 2026).
const GROUPS = [
  { id: 'procesor', title: 'Podatki in procesor', pages: ['podatki', 'vn', 'ukaz', 'naslavljanje'] },
  { id: 'zbirnik', title: 'Zbirnik', pages: ['zbirnik', 'simulator', 'pomiki'] },
  { id: 'pomnilniki', title: 'Prekinitve in pomnilniki', pages: ['prekinitve', 'pomnilniki', 'hierarhija'] },
  { id: 'vi', title: 'Vhod, izhod in cevovod', pages: ['vi', 'cevovod'] },
];
const TITLE = 'Arhitektura računalniških sistemov';
const KICKER = 'LAV-RAČ2 · 3. poglavje';
const ZAGON = "renderAll();\nmountWidgets();\n{\n  const title = id => (PAGES.find(p=>p[0]===id) || [id, id])[1];\n  const home = document.getElementById(\"doma\");\n  const sets = LEVELS.map(L=>({ id: L.id, tag: L.home ? \"I\" : L.tag, title: L.title, note: L.note, el: document.getElementById(L.id),\n    tasks: T.filter(t=>t.lv===(L.key||L.tag)).map(t=>({ idx: t.idx, el: document.getElementById(\"t-\"+t.id) })) }));\n  LavRac.mount({\n    title: TITLE_,\n    kicker: KICKER_,\n    root: \".wrap\",\n    lead: document.querySelector(\"#hero .lead\").textContent.trim(),\n    hero: document.querySelector(\"#hero .magic\"),\n    source: [...document.querySelectorAll(\"footer > span:not(#resetWrap)\")].map(e=>e.textContent.trim()).join(\" \"),\n    vajeNote: document.querySelector(\"#naloge .prose\").innerHTML,\n    groups: GROUPS_.map(g=>({ ...g, pages: g.pages.map(id=>({ id, title: title(id), el: document.getElementById(id) })) })),\n    sets,\n    extra: { id: \"doma\", title: \"Za doma\", note: home.querySelector(\":scope > .prose\").textContent.trim().replace(/^Najprej še nekaj nalog za ponavljanje, nato vaje/, \"Vaje\"), el: home },\n    sel: { head: \".thead\", num: \".tnum\", tags: \".tags\", q: \".q\", check: \".js-check\", hint: \".js-hint\", sol: \".js-sol\", fb: \".feedback\", actions: \":scope > .actions\", extra: \".js-run\" },\n  });\n}"
  .replace('TITLE_', JSON.stringify(TITLE)).replace('KICKER_', JSON.stringify(KICKER))
  .replace('GROUPS_', JSON.stringify(GROUPS.map((g) => ({ ...g, icon: ICONS[g.id] }))));

// Two more home tasks, added in the portal (8. 11. 2026); the artifact stays as it is.
const HOME_PLUS = [
 {
  "id": "d8",
  "title": "Naslovni prostor",
  "q": "Procesor ima 16-bitno naslovno vodilo in 8-bitno podatkovno vodilo. Koliko bajtov pomnilnika lahko naslovi? Koliko naslovnih bitov bi potreboval za 4 GB? Poišči, ali je tvoj računalnik 32- ali 64-biten.",
  "sol": "16 naslovnih bitov da 2¹⁶ = 65 536 naslovov, pri 8-bitnem podatkovnem vodilu je to 64 KB.\nZa 4 GB = 2³² B potrebuješ 32 naslovnih bitov.\nDanašnji računalniki so večinoma 64-bitni (Windows: Nastavitve > Sistem > Vizitka, Linux: ukaz uname -m vrne x86_64)."
 },
 {
  "id": "d9",
  "title": "Množenje z 10 s pomiki",
  "q": "V simulatorju napiši program, ki število z naslova $20 (največ 25) pomnoži z 10 samo s pomiki in seštevanjem ter rezultat zapiše na $30. Namig: 10·x = 8·x + 2·x.",
  "sol": "LDAA $20\nASLA        ; 2x\nSTAA $31    ; shrani 2x\nASLA        ; 4x\nASLA        ; 8x\nADDA $31    ; 8x + 2x\nSTAA $30\nWAI\nPri x = 7 dobimo 70 ($46). Pomik v levo za en bit pomnoži z 2, zato je program hitrejši od zaporednega seštevanja."
 }
];

export default {
  module: 'LAV-RAČ2',
  title: TITLE,
  kicker: KICKER,
  css: `html:not(#lr):root{--bg:var(--lr-bg);--surface:var(--lr-card);--sunk:var(--lr-tile);--line:var(--lr-line);--fg:var(--lr-ink);--muted:var(--lr-mut);
  --accent:var(--lr-acc);--accent-soft:var(--lr-acc-soft);--ok:var(--lr-ok);--ok-soft:var(--lr-ok-bg);--bad:var(--lr-bad);--bad-soft:var(--lr-bad-bg);
  --seen:var(--lr-seen);--seen-soft:var(--lr-seen-bg);--f-display:var(--lr-fb);--f-body:var(--lr-fb);--f-mono:var(--lr-fm)}
  body{padding-left:0;padding-right:0}
  .rc.on small{color:inherit}`,
  patches: [
    // Partial credit for tasks with several parts (agreed 16. 11. 2026).
    ...partialCredit2(false),
    ['HOME.forEach((h,k)=>{', `HOME.push(...${JSON.stringify(HOME_PLUS)});\nHOME.forEach((h,k)=>{`],
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Set I is mixed revision; not all of its tasks come from the matura (agreed 8. 11. 2026).
    ['title:"Še več maturitetnih nalog", note:"Mešane naloge za ponavljanje. Preverjaš jih enako kot v sklopih A–H."',
      'title:"Ponavljanje", note:"Mešane naloge iz vseh razdelkov, med njimi tudi maturitetne. Preverjaš jih enako kot v sklopih A–H."'],
    // Storage: the portal's state for this student; the artifact's own account sync is not used.
    ["const STORE = \"arhitektura-matura-p2-v1\";\nconst $ = (s,el=document)=>el.querySelector(s);\nlet S = {}, localT = 0;\ntry { S = JSON.parse(localStorage.getItem(STORE) || \"{}\") || {}; localT = +localStorage.getItem(STORE+\"-t\") || 0; } catch(e) { S = {}; }\nlet remote = null, pushTimer = null, pushing = false, dirty = false;\nfunction saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(S)); localStorage.setItem(STORE+\"-t\", String(localT)); } catch(e){} }\nfunction save(){ localT = Date.now(); saveLocal(); if(remote){ dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); } }",
      "LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===(L.key||L.tag))), { level: (t) => t.pts });\nconst $ = (s,el=document)=>el.querySelector(s);\nlet S = LavRac.loadUi(), localT = 0;\nlet remote = null, pushTimer = null, pushing = false, dirty = false;\nfunction saveLocal(){ LavRac.saveUi(S); }\nfunction save(){ LavRac.saveUi(S); }"],
    ['if(!window.claude || !window.claude.use) return;', 'return;'],
    // Assembler: "Zaženi teste" runs the tests without counting, "Oddaj" counts.
    ["<button class=\"btn primary js-check\" type=\"button\">${t.type===\"asm\" ? \"Preveri s testi\" : \"Preveri\"}</button>",
      "${t.type===\"asm\" ? '<button class=\"btn js-run\" type=\"button\">Zaženi teste</button>' : \"\"}<button class=\"btn primary js-check\" type=\"button\">${t.type===\"asm\" ? \"Oddaj\" : \"Preveri\"}</button>"],
    ["  // preverjanje\n  $(\".js-check\",el).addEventListener(\"click\",()=>{",
      "  // preverjanje\n  if(t.type===\"asm\") $(\".js-run\",el).addEventListener(\"click\",()=>{ el._trial = true; $(\".js-check\",el).click(); });\n  $(\".js-check\",el).addEventListener(\"click\",()=>{"],
    // One answer per task. Something missing is not an answer yet; anything else locks the task.
    ["    if(ok){ if(s.state!==\"seen\") s.state=\"ok\"; save(); }\n    show(ok, ok ? (s.state===\"seen\" ? \"Pravilno. Točke se ne štejejo, ker si si ogledal rešitev.\" : `Pravilno. +${ptsLabel(t.pts)}`) : (\"Ni še pravilno. \"+msg).trim());\n    paint(); progress();", "    if(el._trial){ el._trial = false; show(ok, ok ? \"Vsi testi uspejo. Testi se ne točkujejo: ko si pripravljen, program oddaj.\" : (msg + \" Testi se ne točkujejo: popravi program in jih zaženi znova.\").trim()); return; }\n    if(!ok && /^Izpolni|^Razvrsti/.test(msg)){ show(false,msg); return; }\n    save(); LavRac.answered(t.idx, ok, msg, part);"],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['  applyFilter(); showPage(cur, true);\n', '  applyFilter();\n'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    ["cur = location.hash.slice(1) || PAGES[0][0];\nrenderAll();\nprogress();\nmountWidgets();\nif(location.hash){ setTimeout(()=>window.scrollTo(0,0), 0); window.addEventListener(\"load\",()=>window.scrollTo(0,0)); }", ZAGON],
    // Long statements: paragraphs and bold key words (11. 11. 2026), the same way as in LAV-RAČ2 chapter 2.
    ...statements([
      [
        "Beseda Dijak ima 5 znakov. Koliko bitov porabi, če jo kodiramo z osnovno ASCII (7 bitov na znak)? Koliko, če uporabimo razširjeno ASCII (8 bitov na znak)?",
        "Beseda **Dijak** ima **5 znakov**. Koliko bitov porabi, če jo kodiramo z **osnovno ASCII** (7 bitov na znak)?\nKoliko, če uporabimo **razširjeno ASCII** (8 bitov na znak)?",
      ],
      [
        "Pošiljatelj je poslal 10-bitno nenegativno celo število 300, prejemnik pa je prejel 316. Pri prenosu je bil napačen natanko en bit. Najbolj desni bit ima zaporedno številko 0. V katerem bitu je napaka?",
        "**Pošiljatelj** je poslal 10-bitno nenegativno celo število **300**, **prejemnik** pa je prejel **316**. Pri prenosu je bil napačen **natanko en bit**.\nNajbolj desni bit ima zaporedno številko **0**. V katerem bitu je napaka?",
      ],
      [
        "Za preverjanje pravilnosti prenosa izračunaj sodo pariteto: paritetni bit za vsako vrstico (desni stolpec, od zgoraj navzdol), paritetni bit za vsak stolpec (spodnja vrstica, od leve) in vogalni bit.",
        "Za preverjanje pravilnosti prenosa izračunaj **sodo pariteto**:\n- **paritetni bit za vsako vrstico** (desni stolpec, od zgoraj navzdol)\n- **paritetni bit za vsak stolpec** (spodnja vrstica, od leve)\n- **vogalni bit**",
      ],
      [
        "Pri prenosu smo izračunali sodo pariteto (zadnji stolpec in zadnja vrstica sta paritetna). Pri prenosu je bil napačen natanko en bit. V kateri vrstici in v katerem stolpcu je napaka? Štej od 1, od zgoraj in od leve.",
        "Pri prenosu smo izračunali **sodo pariteto** (zadnji stolpec in zadnja vrstica sta paritetna). Pri prenosu je bil napačen **natanko en bit**.\nV kateri **vrstici** in v katerem **stolpcu** je napaka? Štej od 1, od zgoraj in od leve.",
      ],
      [
        "Naslovno vodilo je široko 12 bitov. Koliko pomnilniških lokacij lahko CPE naslovi? Koliko bitov mora imeti naslovno vodilo, da naslovimo 1 MiB (1 048 576) bajtnih lokacij?",
        "Naslovno vodilo je široko **12 bitov**. Koliko pomnilniških lokacij lahko CPE naslovi?\nKoliko bitov mora imeti naslovno vodilo, da naslovimo **1 MiB** (1 048 576) bajtnih lokacij?",
      ],
      [
        "Program se začne na naslovu $0100. Ukazi so po vrsti dolgi: LDAA #$0A (2 bajta), ADDA $20 (2 bajta), LDX #$0030 (3 bajti), WAI (1 bajt). Kakšen je PC, ko CPE prevzema ukaz WAI? Koliko bajtov zavzame ves program?",
        "Program se začne na naslovu **$0100**. Ukazi so po vrsti dolgi:\n- **LDAA #$0A** (2 bajta)\n- **ADDA $20** (2 bajta)\n- **LDX #$0030** (3 bajti)\n- **WAI** (1 bajt)\nKakšen je **PC**, ko CPE prevzema ukaz WAI?\nKoliko bajtov zavzame **ves program**?",
      ],
      [
        "Na naslovu $30 je število 23 (desetiško). Kaj je po izvedbi treh ukazov v registru B? Zapiši šestnajstiško in desetiško kot predznačeno število (dvojiški komplement).",
        "Na naslovu **$30** je število **23** (desetiško). Kaj je po izvedbi treh ukazov v registru B?\nZapiši **šestnajstiško** in **desetiško kot predznačeno število** (dvojiški komplement).",
      ],
      [
        "Sklad raste proti nižjim naslovom: ukaz PSH zapiše podatek na naslov SP in nato SP zmanjša, ukaz PUL najprej SP poveča in nato prebere podatek. Na kateri naslov se zapiše A? Kaj je po koncu v A? Kakšen je SP? (šestnajstiško)",
        "Sklad raste proti **nižjim naslovom**:\n- ukaz **PSH** zapiše podatek na naslov SP in nato SP **zmanjša**\n- ukaz **PUL** najprej SP **poveča** in nato prebere podatek\nNa kateri **naslov** se zapiše A? Kaj je po koncu v **A**? Kakšen je **SP**? (šestnajstiško)",
      ],
      [
        "Dostop do predpomnilnika traja 2 ns, do glavnega pomnilnika 100 ns. Predpomnilnik je zadel pri 95 % dostopov. Koliko je povprečni čas dostopa (v ns)? Kolikokrat je to hitreje od dostopa samo do glavnega pomnilnika (zaokroži na eno decimalko)?",
        "Dostop do **predpomnilnika** traja **2 ns**, do **glavnega pomnilnika** **100 ns**. Predpomnilnik je zadel pri **95 %** dostopov.\nKoliko je **povprečni čas dostopa** (v ns)?\nKolikokrat je to hitreje od dostopa samo do glavnega pomnilnika (zaokroži na eno decimalko)?",
      ],
      [
        "Predpomnilnik hrani bloke po 4 bajte (naslovi 0–3 so blok 0, 4–7 blok 1 …) in je na začetku prazen. Program po vrsti bere naslove na sliki. Ob zgrešku se v predpomnilnik prenese cel blok. Koliko je zadetkov in koliko zgreškov?",
        "Predpomnilnik hrani bloke po **4 bajte** (naslovi 0–3 so blok 0, 4–7 blok 1 …) in je na začetku **prazen**. Program po vrsti bere naslove na sliki. Ob **zgrešku** se v predpomnilnik prenese **cel blok**.\nKoliko je **zadetkov** in koliko **zgreškov**?",
      ],
      [
        "Pri dostopih iz prejšnje naloge je delež zadetkov 6/8 = 75 %. Dostop do predpomnilnika traja 1 ns, do glavnega pomnilnika 100 ns. Koliko je povprečni čas dostopa (ns)?",
        "Pri dostopih iz prejšnje naloge je delež zadetkov 6/8 = **75 %**. Dostop do predpomnilnika traja **1 ns**, do glavnega pomnilnika **100 ns**.\nKoliko je **povprečni čas dostopa** (ns)?",
      ],
      [
        "Procesor ima cevovod s 5 stopnjami. V tabeli sta vrisana prva dva ukaza. V katerem taktu se konča 4. ukaz? V katerem taktu bi se končal 4. ukaz brez cevovoda?",
        "Procesor ima **cevovod s 5 stopnjami**. V tabeli sta vrisana prva dva ukaza.\nV katerem taktu se konča **4. ukaz**?\nV katerem taktu bi se končal 4. ukaz **brez cevovoda**?",
      ],
      [
        "Prenesti moramo 4 bajte. Vzporedna povezava ima 8 podatkovnih linij, serijska eno. V vsakem taktu gre po vsaki liniji en bit. Koliko taktov potrebuje vzporedni in koliko serijski prenos (pri enakem taktu)?",
        "Prenesti moramo **4 bajte**. **Vzporedna** povezava ima 8 podatkovnih linij, **serijska** eno. V vsakem taktu gre po vsaki liniji en bit.\nKoliko taktov potrebuje **vzporedni** in koliko **serijski** prenos (pri enakem taktu)?",
      ],
      [
        "Za vsak opis zapiši primer dveh binarnih števil z osmimi biti (x in y) ali NE OBSTAJA, če takih števil ni.\n1) x je večji od y in ima manj enic kot y.\n2) x in y sta različni števili z enako liho pariteto (liho število enic).\n3) Najbolj levi bit x je različen od najbolj levega bita y, obe števili sta večji od 127.",
        "Za vsak opis zapiši primer dveh **binarnih števil z osmimi biti** (x in y) ali **NE OBSTAJA**, če takih števil ni.\n**1)** x je večji od y in ima **manj enic** kot y.\n**2)** x in y sta **različni** števili z enako **liho pariteto** (liho število enic).\n**3)** **Najbolj levi bit** x je različen od najbolj levega bita y, obe števili sta večji od 127.",
      ],
    ]),
  ],
};
