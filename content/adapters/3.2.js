// Algoritmi in diagram poteka. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, three theory groups, the matura revision set moved among
// the graded sets as "Ponavljanje" (agreed 8. 11. 2026), and the matura's diagram labels only (the switch was dropped 10. 11. 2026).

import { statements, QTEXT, outputCompare } from './qformat.js';
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
// Set E (10. 11. 2026): the student draws the diagram in Flowgorithm, runs it on known test cases and ticks the task
// (no points: a drawing cannot be checked by the portal). The solution shows the diagram and the program. E1 is a worked
// example with its solution open, and two tasks are new (even or odd, a product). The names are those of the artifact
// with the new tasks put in: E3 and E7 are new, and the artifact's E12 (symbols to count) is E14.
const PREP = {
  self: Array.from({ length: 15 }, (_, k) => 'E' + (k + 1)),
  example: ['E1'],
  nobtn: ['E14'],
};
const NEW_EVEN = `{lv:"E", own:true, pts:1, type:"blanks", draw:true,
 q:"Nariši diagram poteka, ki prebere celo število n in izpiše, ali je sodo ali liho.",
 b:[{l:"Za n = 7 se izpiše", acc:["liho"]},{l:"Za n = 10 se izpiše", acc:["sodo"]},{l:"Za n = 0 se izpiše", acc:["sodo"]}],
 h:["Število je sodo, če je ostanek pri deljenju z 2 enak 0. Ostanek zapišeš kot n % 2."],
 fc:[inp("n"), IF("n % 2 == 0",[out('"sodo"')],[out('"liho"')])], jsol:"e14",
 why:"Pogoj n % 2 == 0 loči sode in lihe. Za 7 je ostanek 1 (liho), za 10 in za 0 je ostanek 0 (sodo)."},
`;
const NEW_PRODUCT = `{lv:"E", own:true, pts:2, type:"blanks", draw:true,
 q:"Nariši diagram poteka, ki prebere naravno število N in izpiše zmnožek števil od 1 do N (1 · 2 · … · N).",
 b:[{l:"Za N = 5 se izpiše", acc:["120"]},{l:"Za N = 1 se izpiše", acc:["1"]},{l:"Za N = 6 se izpiše", acc:["720"]}],
 h:["Zmnožek mora imeti začetno vrednost 1, ne 0: z ničlo bi bil rezultat vedno 0.","V zanki zmnožek pomnoži s števcem i in števec poveča za 1."],
 fc:[inp("N"), p("f = 1"), p("i = 1"), wh("i <= N",[p("f = f * i"), p("i = i + 1")]), out("f")], jsol:"e15",
 why:"Zmnožek se začne z 1 in se v vsakem krogu pomnoži z i. Za N = 5 je 1 · 2 · 3 · 4 · 5 = 120, za N = 1 je rezultat 1."},
`;
const J_NEW = {
  e14: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        if (n % 2 == 0) {\n            System.out.println("sodo");\n        } else {\n            System.out.println("liho");\n        }\n    }\n}',
  e15: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int f = 1;\n        int i = 1;\n        while (i <= n) {\n            f = f * i;\n            i = i + 1;\n        }\n        System.out.println(f);\n    }\n}',
};
// Za doma 6 (the same algorithm in four ways): its solution gets the diagram and the program, not only a sentence.
const H6_JAVA = 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        int c = sc.nextInt();\n        double p = (a + b + c) / 3.0;\n        System.out.println(p);\n    }\n}';
const H6_SOL = 'Besedno: preberi tri števila, jih seštej, vsoto deli s 3 in izpiši rezultat. Psevdokoda: preberi a, b, c; p = (a + b + c) / 3; izpiši p. Diagram in program sta zgoraj. Pozor: če so a, b, c tipa int, mora biti deljenec ali delitelj realen (3.0), sicer se rezultat zaokroži.';
const TITLE = 'Algoritmi in diagrami poteka';
const KICKER = 'LAV-RAČ3 · 2. poglavje';

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
    ...outputCompare(false),
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // Corrected titles (10. 11. 2026): the chapter is plural, the planning page is a question.
    ['Algoritmi in diagram poteka', 'Algoritmi in diagrami poteka', 'all'],
    ['["nacrtovanje","Kako rešiš nalogo"]', '["nacrtovanje","Kako rešiš nalogo?"]'],
    // The matura revision set is graded among the others (agreed 8. 11. 2026).
    ['title:"Še več maturitetnih nalog", note:"Naloge iz drugih rokov za ponavljanje.", home:true',
      'title:"Ponavljanje", note:"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–F.", home:true'],
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
HOME[5].fc = [inp("a", "b", "c"), p("p = (a + b + c) / 3"), out("p")]; HOME[5].jsolCode = ${JSON.stringify(H6_JAVA)}; HOME[5].sol = ${JSON.stringify(H6_SOL)};
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    // Set E: the way of working, the worked example, and two new tasks (a diagram and a program for each).
    ['note:"Diagram najprej nariši na papir ali v Flowgorithm, nato odgovori na testna vprašanja. Rešitev pokaže diagram in kodo v Javi."',
      'note:"Diagram nariši v programu Flowgorithm (ali na papir) in ga zaženi. Delovanje preveri sam na nekaj testnih primerih z znanim rezultatom: pri vsaki nalogi so navedeni vhodni podatki in pravilni izpis. Točk ni. Ko diagram deluje, nalogo označi s »Preveril sem«. Rešitev (diagram poteka in program v Javi) si lahko ogledaš kadar koli, brez posledic. Prva naloga je rešen primer."'],
    ['q:"Nariši diagram poteka, ki prebere dve celi števili ter izpiše njuno vsoto in nato njun zmnožek.",',
      'q:"Rešen primer: diagram poteka za program, ki prebere dve celi števili ter izpiše njuno vsoto in nato njun zmnožek, je spodaj. Nariši ga v Flowgorithm in preveri, ali za vhod 6 in 7 izpiše pravilno.",'],
    ['{lv:"E", own:true, pts:2, type:"blanks", draw:true,\n q:"Nariši diagram poteka, ki prebere celo število x in izpiše pozitivno',
      NEW_EVEN + '{lv:"E", own:true, pts:2, type:"blanks", draw:true,\n q:"Nariši diagram poteka, ki prebere celo število x in izpiše pozitivno'],
    ['{lv:"E", src:"M222/2", pts:2, type:"blanks", draw:true,', NEW_PRODUCT + '{lv:"E", src:"M222/2", pts:2, type:"blanks", draw:true,'],
    ['const J = {"e1": ', 'const J = {"e14": ' + JSON.stringify(J_NEW.e14) + ', "e15": ' + JSON.stringify(J_NEW.e15) + ', "e1": '],
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
        "Bloki so oštevilčeni od zgoraj navzdol: 1 je i = 1, 2 je pogoj i <= 3, 3 je izpis vrednosti i, 4 je i = i + 1. Zapiši zaporedje blokov, ki se izvedejo (številke ločene s presledki). Pogoj šteje kot blok vsakič, ko ga preverimo.",
        "Bloki so oštevilčeni od zgoraj navzdol:\n- **1**: i = 1\n- **2**: pogoj i <= 3\n- **3**: izpis vrednosti i\n- **4**: i = i + 1\nZapiši **zaporedje blokov**, ki se izvedejo (številke ločene s presledki). **Pogoj** šteje kot blok **vsakič**, ko ga preverimo.",
      ],
      [
        "Rešen primer: diagram poteka za program, ki prebere dve celi števili ter izpiše njuno vsoto in nato njun zmnožek, je spodaj. Nariši ga v Flowgorithm in preveri, ali za vhod 6 in 7 izpiše pravilno.",
        "**Rešen primer:** diagram poteka za program, ki prebere **dve celi števili** ter izpiše njuno **vsoto** in nato njun **zmnožek**, je spodaj.\nNariši ga v **Flowgorithm** in preveri, ali za vhod **6 in 7** izpiše pravilno.",
      ],
      [
        "Nariši diagram poteka, s katerim prebereš 2 naravni števili in znak. Algoritem naj izpiše prebrani znak tolikokrat, kot je razlika med manjšo in večjo prebrano vrednostjo. Primer: če je vrednost prvega prebranega števila 5, drugega 8 in prebrani znak G, algoritem izpiše GGG.",
        "Nariši diagram poteka, s katerim prebereš **2 naravni števili** in **znak**. Algoritem naj izpiše prebrani znak **tolikokrat, kot je razlika** med manjšo in večjo prebrano vrednostjo.\n**Primer:** če je vrednost prvega prebranega števila 5, drugega 8 in prebrani znak G, algoritem izpiše **GGG**.",
      ],
      [
        "Uporabnik vnaša pare celih števil. Program vsoti prišteje obe števili iz para le, če je prvo število v paru večje kot drugo. Postopek se konča, ko je dobljena vsota večja kot 50. Nato program izpiše, koliko parov števil je bilo vpisanih. Nariši diagram poteka za ta program.",
        "Uporabnik vnaša **pare celih števil**. Program vsoti prišteje obe števili iz para **le, če je prvo število v paru večje** kot drugo.\nPostopek se konča, ko je dobljena **vsota večja kot 50**. Nato program izpiše, **koliko parov števil** je bilo vpisanih.\nNariši diagram poteka za ta program.",
      ],
      [
        "Nariši diagram poteka Evklidovega algoritma: prebere dve naravni števili a in b in izpiše njun največji skupni delitelj. Postopek: dokler b ni 0, izračunaj ostanek t = a % b, nato a postane b in b postane t. Rezultat je a.",
        "Nariši diagram poteka **Evklidovega algoritma**: prebere dve naravni števili **a** in **b** in izpiše njun **največji skupni delitelj**.\n**Postopek:** dokler b ni 0, izračunaj ostanek **t = a % b**, nato a postane b in b postane t.\n**Rezultat** je a.",
      ],
    ]),
  ],
};
