// Pogojni stavki v Javi. Connects the published artifact to the exercise shell: the portal's storage (also for
// answers typed as program output), one answer per task, two theory groups, the laboratory set renamed "Naloge za
// utrjevanje" and the matura revision set kept last as "Ponavljanje" (agreed 8. 11. 2026), no mention of laboratory
// exercises, and the matura's diagram labels only (agreed 10. 11. 2026).

const ICONS = {
  if: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l12 10-12 10-12-10z"/><path d="M12 15H6v21M36 15h6v21"/><rect x="1.5" y="36" width="9" height="8" rx="1.5" class="fill" opacity=".35"/><rect x="37.5" y="36" width="9" height="8" rx="1.5"/></svg>',
  vec: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4v12"/><path d="M24 16L8 30M24 16v14M24 16l16 14"/><rect x="2" y="30" width="12" height="9" rx="1.5"/><rect x="18" y="30" width="12" height="9" rx="1.5" class="fill" opacity=".35"/><rect x="34" y="30" width="12" height="9" rx="1.5"/></svg>',
};
// Theory groups agreed with the teacher (8. 11. 2026).
const GROUPS = [
  { id: 'g-if', icon: 'if', title: 'Stavek IF', pages: ['stavek-if', 'if-else', 'gnezdenje'] },
  { id: 'g-vec', icon: 'vec', title: 'Več možnosti', pages: ['veriga', 'switch', 'napake'] },
];
// The teacher's task names (set letter and place in the set as the portal shows it, 10. 11. 2026): the tasks that only
// ask for an output have no copy / Programiz buttons.
const PREP = {
  // Programs the student writes elsewhere: ticked by the student, the code stays to be saved, the right output is shown.
  self: ['B8', 'B9', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E8', 'E9', 'E10'],
  nobtn: ['A3', 'A11', 'B5', 'C1', 'C2', 'C3', 'C7', 'D1', 'D2', 'D3', 'D4', 'D7'],
};
// C5 and D9 (matura tasks with points) check the written code as well as the output: what the task asks for must be in
// the code (comments and strings do not count). A missing part is a message, not an answer: the task stays open.
const NEED_C5 = [['\\bif\\b', 'V kodi manjka stavek if.'], ['^[^?]*$', 'V kodi ne sme biti operatorja ?:, nalogo reši s stavkom if.']];
const NEED_D9 = [
  ['\\bswitch\\s*\\(\\s*dan\\s*\\)', 'V kodi manjka stavek switch (dan).'],
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ['\\bcase\\s+' + n + '\\s*(?::|->)', 'Manjka oznaka case ' + n + '.']),
  ['\\bdefault\\s*(?::|->)', 'Manjka veja default za dan, ki ne obstaja.'],
  ['->|(?:\\bbreak\\b[\\s\\S]*){7}', 'Vsaka možnost case se mora končati z break, sicer se izvedejo tudi naslednje.'],
];
// Za doma: the program of every solution is a block of code (Java colours), the sentence keeps the explanation
// (as asked for the other chapters on 10. 11. 2026). Every program was compiled and run with the values below.
const HOME_CODE = [
  { code: 'public class Main {\n    public static void main(String[] args) {\n        int a = 3, b = 4, c = 5;\n        if (a + b > c && a + c > b && b + c > a) {\n            if (a == b && b == c) {\n                System.out.println("enakostranicni");\n            } else if (a == b || b == c || a == c) {\n                System.out.println("enakokraki");\n            } else {\n                System.out.println("raznostranicni");\n            }\n        } else {\n            System.out.println("trikotnik ne obstaja");\n        }\n    }\n}',
    sol: 'Zunanji if preveri, ali trikotnik obstaja, notranja veriga pa določi vrsto. Za 3, 3, 3 je trikotnik enakostranični, za 3, 3, 5 enakokraki, za 3, 4, 5 raznostranični, za 1, 2, 5 ne obstaja (1 + 2 ni večje od 5).' },
  { code: 'public class Main {\n    public static void main(String[] args) {\n        double a = 1, b = -3, c = 2;\n        double d = b * b - 4 * a * c;\n        if (d > 0) {\n            double x1 = (-b + Math.sqrt(d)) / (2 * a);\n            double x2 = (-b - Math.sqrt(d)) / (2 * a);\n            System.out.println("Dve resitvi: " + x1 + " in " + x2);\n        } else if (d == 0) {\n            System.out.println("Ena resitev: " + (-b / (2 * a)));\n        } else {\n            System.out.println("Ni realnih resitev");\n        }\n    }\n}',
    sol: 'Za (1, -3, 2) sta rešitvi 2.0 in 1.0, za (1, 2, 1) je rešitev -1.0, (1, 0, 1) nima realnih rešitev.' },
  { code: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println("1 - pozdrav");\n        System.out.println("2 - trenutno leto");\n        System.out.println("3 - izhod");\n        int izbira = sc.nextInt();\n        switch (izbira) {\n            case 1: System.out.println("Pozdravljen!"); break;\n            case 2: System.out.println(2026); break;\n            case 3: System.out.println("Nasvidenje"); break;\n            default: System.out.println("Napacna izbira");\n        }\n    }\n}',
    sol: 'Vsaka možnost se konča z break, sicer bi se izvedle tudi naslednje. Ne pozabi na import java.util.Scanner; na začetku datoteke.' },
  { code: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int t = sc.nextInt();\n        if (t < 0 || t > 100) {\n            System.out.println("Napacen vnos");\n        } else if (t >= 90) {\n            System.out.println(5);\n        } else if (t >= 75) {\n            System.out.println(4);\n        } else if (t >= 60) {\n            System.out.println(3);\n        } else if (t >= 50) {\n            System.out.println(2);\n        } else {\n            System.out.println(1);\n        }\n    }\n}',
    sol: 'Najprej preverimo območje, nato gremo od največje meje navzdol. Za 49 je ocena 1, za 50 ocena 2, za 89 ocena 4, za 90 ocena 5, za 101 izpis Napacen vnos.' },
];
const TITLE = 'Pogojni stavki v Javi';
const KICKER = 'LAV-RAČ3 · 5. poglavje';
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
    ['Pokaži rešitev', 'Prikaži rešitev', 'all'],
    // IF and ELSE are written in capitals in titles (corrected 10. 11. 2026); the code keeps them lowercase.
    ['["stavek-if","Pogojni stavek if"]', '["stavek-if","Pogojni stavek IF"]'],
    ['<h2>Pogojni stavek if</h2>', '<h2>Pogojni stavek IF</h2>'],
    ['["if-else","if – else in blok stavkov"]', '["if-else","IF – ELSE in blok stavkov"]'],
    ['<h2>if – else in blok stavkov</h2>', '<h2>IF – ELSE in blok stavkov</h2>'],
    ['["gnezdenje","Gnezdenje in viseči else"]', "[\"gnezdenje\",\"Gnezdenje in 'ELSE'\"]"],
    ['<h2>Gnezdenje in »viseči« else</h2>', "<h2>Gnezdenje in 'ELSE'</h2>"],
    ['["veriga","Veriga else if in ?:"]', '["veriga","Veriga ELSE IF in ?:"]'],
    ['<h2>Veriga else if in pogojni operator</h2>', '<h2>Veriga ELSE IF in pogojni operator</h2>'],
    ['title:"Pogoji in stavek if"', 'title:"Pogoji in stavek IF"'],
    ['title:"if – else, bloki in gnezdenje"', 'title:"IF – ELSE, bloki in gnezdenje"'],
    ['title:"Veriga else if in pogojni operator"', 'title:"Veriga ELSE IF in pogojni operator"'],
    // The laboratory exercises are no longer mentioned (agreed 8. 11. 2026): set E becomes "Naloge za utrjevanje", the
    // tags "RAČ-LAV 3 · vaja 4 · N" go, and the matura revision set is "Ponavljanje", graded among the others.
    ['{id:"naloge-e", tag:"E", title:"Laboratorijske vaje RAČ-LAV 3 · vaja 4", note:"Naloge iz laboratorijske vaje 4 (pogojni stavki). Vrednosti so zapisane v kodi, Scannerja ne potrebuješ."},',
      '{id:"naloge-e", tag:"E", title:"Naloge za utrjevanje", note:"Programi s pogojnimi stavki. Vrednosti so zapisane v kodi, Scannerja ne potrebuješ."},'],
    ['{id:"doma-mat", tag:"F", title:"Maturitetne naloge za ponavljanje", note:"Naloge iz izpitnih pol 1 o pogojih in stavku switch.", home:true}',
      '{id:"doma-mat", tag:"F", title:"Ponavljanje", note:"Maturitetne naloge iz drugih rokov za ponavljanje. Preverjaš jih enako kot v sklopih A–E.", home:true}'],
    ['const LAB = n => "RAČ-LAV 3 · vaja 4 · " + n;\n', ''],
    ['/* ----- E: Laboratorijske vaje (vaja 4) ----- */', '/* ----- E: naloge za utrjevanje ----- */'],
    [' lab:LAB("primer"),\n', ''],
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [' lab:LAB(' + n + '),', '']),
    ['Program iz laboratorijske vaje z if – else izpiše isto', 'Program z if – else izpiše isto'],
    [' Laboratorijske vaje: RAČ-LAV 3. letnik, vaja 4 – pogojni stavki.', ''],
    ['["naloge-e","Naloge E · Laboratorijske vaje"]', '["naloge-e","Naloge E · Utrjevanje"]'],
    // Programs can run anywhere, not only in Programiz (agreed 8. 11. 2026).
    ['<span>Zaženi v Eclipse, VS Code ali Programizu (tam razred preimenuj v Main), izpis prilepi spodaj.</span>',
      '<span>Zaženi program v poljubnem okolju (Eclipse, VS Code, Programiz …) in prilepi njegov izpis. V Programizu razred preimenuj v Main.</span>'],
    // B8 is self-checked and has no output field, so it must not ask to paste the output.
    ['Nato preizkusi še z n = 7 in n = -3. Prilepi izpis za n = 14.', 'Nato preizkusi še z n = 7 in n = -3.'],
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
${JSON.stringify(HOME_CODE)}.forEach((f, k) => { HOME[k].jsolCode = f.code; if (f.sol) HOME[k].sol = f.sol; });
T.forEach((t,i)=>{ t.id = t.src ? t.src.replace("/","-") : "own-"+i; });
LavRac.tasks(LEVELS.flatMap(L=>T.filter(t=>t.lv===L.tag)), { level: (t) => t.pts });
S = LavRac.loadUi();`],
    // The tasks that check the code (see NEED_C5, NEED_D9): the code without comments and strings must have the parts.
    ['{src:"M192/8", pts:2, lv:"C", type:"code",', '{src:"M192/8", pts:2, lv:"C", type:"code", need:' + JSON.stringify(NEED_C5) + ','],
    ['{src:"M181/18", pts:3, lv:"D", type:"code", adapt:true,', '{src:"M181/18", pts:3, lv:"D", type:"code", adapt:true, need:' + JSON.stringify(NEED_D9) + ','],
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
    save(); LavRac.answered(t.idx, ok, msg);`],
    ['$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); drawHints(); }});',
      '$(".js-hint",el).addEventListener("click",()=>{ if(hi<t.h.length){ hi++; s.h=hi; save(); LavRac.hinted(t.idx); drawHints(); }});'],
    ['if(solEl.hidden){ drawSol(); solEl.hidden=false; if(s.state!=="ok"){ s.state="seen"; save(); paint(); progress(); }',
      'if(solEl.hidden){ drawSol(); solEl.hidden=false; LavRac.solution(t.idx);'],
    // The shell does the paging.
    ['applyFilter(); showPage(cur, true);\n}', 'applyFilter();\n}'],
    ['window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)));', ''],
    // Start. The diagrams use the matura's labels, as the students meet them there (agreed 10. 11. 2026): no switch.
    ['cur = location.hash.slice(1) || "stavek-if";\n', ''],
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
  ],
};
