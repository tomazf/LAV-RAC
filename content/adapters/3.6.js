// Zanke v Javi. Connects the published artifact to the exercise shell: the portal's storage (also for answers typed as
// program output), one answer per task, three theory groups, the laboratory set renamed "Naloge za utrjevanje", the
// extra set "Dodatne vaje" and the matura revision set kept last as "Ponavljanje" (agreed 8. 11. 2026), no mention of
// laboratory exercises, and the matura's diagram labels only (agreed 10. 11. 2026).

import { QTEXT, outputCompare, partialCredit } from './qformat.js';
const ICONS = {
  zanka: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M34 6v8.5h-8.5"/><circle cx="24" cy="24" r="4" class="fill" opacity=".35"/></svg>',
  gnezdo: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="4"/><rect x="14" y="14" width="20" height="20" rx="3" class="fill" opacity=".35"/><path d="M14 40h20M34 40l-4-3M34 40l-4 3"/></svg>',
  vzorec: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 10h4M8 20h10M8 30h16M8 40h22"/><circle cx="38" cy="14" r="5" class="fill" opacity=".35"/><path d="M34 34l8 8M42 34l-8 8"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026, TODO.md).
const GROUPS = [
  { id: 'g-vrste', icon: 'zanka', title: 'Vrste zank', pages: ['while', 'for', 'do-while', 'izbira'] },
  { id: 'g-gnezdo', icon: 'gnezdo', title: 'Gnezdenje, break in continue', pages: ['gnezdene', 'break'] },
  { id: 'g-vzorci', icon: 'vzorec', title: 'Vzorci', pages: ['vzorci', 'napake'] },
];
// The teacher's task names (set letter and place in the set as the portal shows it). Sorted at import (17. 11. 2026) by
// the rules in docs/LAV-RAC.md, to be confirmed by the teacher:
//   nobtn: the tasks that only ask for an output have no copy / Programiz buttons,
//   self: the programs of the former laboratory set (F) and of the extra set (G) are written elsewhere and ticked by the
//         student, as in 3.4 and 3.5; the code stays to be saved and the right output is shown,
//   inline: D4 has its blank in the code,
//   exact: D12 asks for the spaces in front of the stars (the shape of the triangle).
const PREP = {
  // C1, C3, C4, C5, C8, C9, C10, C12 and H2: the code and its structure are what matters, the output is a number or a short line
  // the student works out by heart; they are written, saved and compared with the solution, without points (18. 11. 2026).
  self: [...Array.from({ length: 37 }, (_, i) => 'F' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'G' + (i + 1)),
    'C1', 'C3', 'C4', 'C5', 'C8', 'C9', 'C10', 'C12', 'H2'],
  nobtn: ['A8', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B16', 'B19',
    'D1', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'E6', 'E7', 'E8', 'E9'],
  inline: ['D4'],
  exact: ['D12'],
};
// Graded programs whose statement asks for a kind of loop also check the written code (comments and strings do not
// count). A missing part is a message, not an answer: the task stays open (rule in docs/LAV-RAC.md, 10. 11. 2026).
const FOR = ['\\bfor\\s*\\(', 'V kodi manjka zanka for.'];
const DO = ['\\bdo\\b[\\s\\S]*\\bwhile\\s*\\(', 'V kodi manjka zanka do-while.'];
const NOFOR = ['^(?![\\s\\S]*\\bfor\\s*\\()', 'Zanke for ne smeš uporabiti.'];
const WHILE = ['\\bwhile\\s*\\(', 'Uporabi zanko while ali do-while.'];
const NESTED = ['(?:\\b(?:for|while)\\s*\\([\\s\\S]*){2}', 'Uporabi gnezdeni zanki (zanko v zanki).'];
const NEED = {
  C1: [FOR], C4: [FOR], C5: [FOR], C9: [FOR], C13: [FOR],
  C6: [NOFOR, WHILE], C7: [NOFOR, WHILE], H1: [NOFOR, WHILE], H2: [NOFOR, WHILE],
  C8: [DO], C10: [DO],
  C12: [['\\b(?:for|while)\\s*\\(', 'V kodi manjka zanka.'], ['^[^*/%]*$', 'Množenja, deljenja in ostanka (*, /, %) ne smeš uporabiti.']],
  C14: [FOR, DO, ['(?:\\bwhile\\s*\\([\\s\\S]*){2}', 'Manjka zanka while (poleg do-while).']],
  D2: [NESTED], D3: [NESTED],
};
// The tags of the laboratory exercise (»RAČ-LAV 3 · vaja 5 · …«); the names of the two collections stay.
const LABS = [...Array.from({ length: 32 }, (_, i) => String(i + 1)),
  ...['Fibonacci', 'aritmetično', 'geometrijsko', 'Taylor', 'bisekcija'].map((z) => 'zaporedja · ' + z)];
const TITLE = 'Zanke v Javi';
const KICKER = 'LAV-RAČ3 · 6. poglavje';
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
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // The laboratory exercises are no longer mentioned (agreed 8. 11. 2026): set F becomes "Naloge za utrjevanje", set G
    // "Dodatne vaje", the tags "RAČ-LAV 3 · vaja 5 · N" go, and the matura revision set is "Ponavljanje", graded among the others.
    ['{"id":"naloge-f","tag":"F","title":"Laboratorijske vaje RAČ-LAV 3 · vaja 5","note":"Vse naloge iz laboratorijske vaje 5 (zanke in ponavljanja). Vrednosti so zapisane v kodi, Scannerja ne potrebuješ (razlaga 7)."}',
      '{"id":"naloge-f","tag":"F","title":"Naloge za utrjevanje","note":"Programi z zankami in ponavljanji. Vrednosti so zapisane v kodi, Scannerja ne potrebuješ (razlaga 7)."}'],
    ['{"id":"naloge-g","tag":"G","title":"Dodatne vaje: Utrjevanje zank in Vaje z zankami","note":"Naloge iz zbirk Utrjevanje zank in Vaje z zankami, ki jih laboratorijska vaja še ne pokriva."}',
      '{"id":"naloge-g","tag":"G","title":"Dodatne vaje","note":"Naloge iz zbirk Utrjevanje zank in Vaje z zankami."}'],
    ['{"id":"doma-mat","tag":"H","title":"Maturitetne naloge za ponavljanje","note":"Naloge iz izpitnih pol 1, ki zahtevajo pisanje zank.","home":true}',
      '{"id":"doma-mat","tag":"H","title":"Ponavljanje","note":"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–G.","home":true}'],
    ...LABS.map((n) => [',"lab":"RAČ-LAV 3 · vaja 5 · ' + n + '"', '']),
    [' (Prirejeno: v vaji 5 je naveden samo naslov naloge, besedilo je sestavljeno.)', '', 'all'],
    [' Naloge z oznako RAČ-LAV 3 so iz laboratorijske vaje 5, naloge z oznako Utrjevanje zank in Vaje z zankami pa iz zbirk vaj.',
      ' Naloge z oznako Utrjevanje zank in Vaje z zankami so iz zbirk vaj.'],
    [' Laboratorijske vaje: RAČ-LAV 3. letnik, vaja 5 – zanke.', ''],
    [' Naloge z zaporedji (Fibonacci, aritmetično, geometrijsko, Taylor, bisekcija) so v vaji 5 navedene le po imenih, besedilo je sestavljeno za to stran.',
      ' Besedilo nalog z zaporedji (Fibonacci, aritmetično, geometrijsko, Taylor, bisekcija) je sestavljeno za to stran.'],
    ['["naloge-f","Naloge F · Laboratorijske vaje"]', '["naloge-f","Naloge F · Utrjevanje"]'],
    // Star figures in a statement would be read as bold markup (** … **) by the shell, so the figures of D3, D4 and D12
    // are shown as code under the statement (17. 11. 2026); the words stay the artifact's.
    ...[
      ['Z gnezdenimi zankami realizirajte programsko kodo v Javi, s katero zagotovite izpis v tej obliki (štiri vrstice): *ooo, **oo, ***o, ****',
        'Z gnezdenimi zankami realizirajte programsko kodo v Javi, s katero zagotovite izpis v tej obliki (štiri vrstice):', '*ooo\n**oo\n***o\n****'],
      ['Napišite metodo static void trikotnik (int n), ki nariše enakokraki trikotnik višine n, ki je podana kot parameter. Za n = 4 se na zaslon izpiše: 3 presledki in *, nato 2 presledka in ***, 1 presledek in *****, nato *******. (Glavni program kliče trikotnik(4).)',
        'Napišite metodo static void trikotnik (int n), ki nariše enakokraki trikotnik višine n, ki je podana kot parameter. Za n = 4 se na zaslon izpiše spodnji lik; presledki pred zvezdicami so del izpisa. (Glavni program kliče trikotnik(4).)', '   *\n  ***\n *****\n*******'],
    ].map(([from, to, fig]) => [`"q":${JSON.stringify(from)}`, `"q":${JSON.stringify(to)},"snip":${JSON.stringify(fig)}`]),
    [`"q":${JSON.stringify('Napišite, kateri pogoj moramo zapisati na črto v spodnji kodi, da bo koda izpisala ****, *oo*, *oo*, **** (štiri vrstice).')}`,
      `"q":${JSON.stringify('Napišite, kateri pogoj moramo zapisati na črto v spodnji kodi, da bo koda izpisala lik iz komentarja na začetku (štiri vrstice).')}`],
    ['"snip":"for(int v=0; v\\u003c4; v++) {', '"snip":' + JSON.stringify('// izpis:\n// ****\n// *oo*\n// *oo*\n// ****\n').slice(0, -1) + 'for(int v=0; v\\u003c4; v++) {'],
    // D4 is typed in the code (inline): the shell's gap is ___, the field gets the width of the longest answer.
    ['if (___________________)', 'if (___)'],
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
    // Task ids exist only from here on, so the shell learns the tasks here. The code checks (NEED) go by the teacher's
    // task names, counted the same way as in LavRac.prepare (set letter and place in the set).
    ['T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });',
      `{ const need = ${JSON.stringify(NEED)}, k = {}; T.forEach((t) => { k[t.lv] = (k[t.lv] || 0) + 1; const n = need[t.lv + k[t.lv]]; if (n) t.need = n; }); }
LavRac.prepare(T, LEVELS, ${JSON.stringify(PREP)});
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    ['      if(!out.value.trim()){ show(false, t.type==="code" ? "Zaženi program in prilepi njegov izpis." : "Napiši izpis."); return; }',
      String.raw`      if(t.type==="code" && t.need){
        const code = ed.value.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"").replace(/"(?:\\.|[^"\\])*"/g,'""').replace(/'(?:\\.|[^'\\])*'/g,"''");
        if(!code.trim()){ show(false,"Najprej zapiši program v okno."); return; }
        const miss = t.need.find(n=>!new RegExp(n[0]).test(code));
        if(miss){ show(false, miss[1]); return; }
      }
      if(!out.value.trim()){ show(false, t.type==="code" ? "Zaženi program in prilepi njegov izpis." : "Napiši izpis."); return; }`],
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
    ['cur = location.hash.slice(1) || "while";\n', ''],
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
    // Long statements: paragraphs and bold key words (11. 11. 2026), the same way as in LAV-RAČ2 chapter 2.
    QTEXT,
    // The tasks of this artifact are JSON ("q":"…"), so the pairs are written here, not with statements().
    ...[
      [
        "Napišite kodo metode deli tako, da bo vrnila celi del pri deljenju števila a s številom b. Dovoljene so le dodatne spremenljivke, zanke ter operaciji seštevanja in odštevanja. Operacij množenja, deljenja in ostanka pri deljenju ne smete uporabiti. (Metoda se kliče iz glavnega programa z a = 17 in b = 5.)",
        "Napišite kodo metode **deli** tako, da bo vrnila **celi del** pri deljenju števila a s številom b.\nDovoljene so le dodatne spremenljivke, zanke ter operaciji **seštevanja in odštevanja**. Operacij **množenja, deljenja in ostanka** pri deljenju ne smete uporabiti.\n(Metoda se kliče iz glavnega programa z **a = 17** in **b = 5**.)",
      ],
      [
        "V Mali vasi imajo težave z mišmi, zato na pomoč pokličejo mačka Toma in njegove prijatelje (mačk je torej več kot ena). Po enem letu so vse mačke pokončale enako število miši, kar skupno znaša 1.111.111, vsaka posebej pa je ubila več miši, kot je vseh mačk skupaj. Izračunaj, koliko mačk je prišlo v Malo vas in koliko miši je pokončal vsak maček. Izpiši število mačk in v drugi vrstici število miši na mačka.",
        "V Mali vasi imajo težave z mišmi, zato na pomoč pokličejo mačka Toma in njegove prijatelje (mačk je torej **več kot ena**). Po enem letu so vse mačke pokončale **enako število miši**, kar skupno znaša **1.111.111**, vsaka posebej pa je ubila **več miši, kot je vseh mačk skupaj**.\nIzračunaj, koliko mačk je prišlo v Malo vas in koliko miši je pokončal vsak maček.\nIzpiši število mačk in v drugi vrstici število miši na mačka.",
      ],
    ].map(([from, to]) => [`"q":${JSON.stringify(from)}`, `"q":${JSON.stringify(to)}`]),
  ],
};
