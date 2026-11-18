import { readFileSync } from 'node:fs';
// Light markup in long task statements (the shell turns it into paragraphs, bold words and lists: formatQ in
// content/shell/vaja.js): **bold**, one paragraph per line, lines starting with "- " form a list.
// A pair is [statement as it is in the page at that point, new statement]; the importer fails if the old one is not there once.
export const statements = (pairs) => pairs.map(([from, to]) => [`q:${JSON.stringify(from)}`, `q:${JSON.stringify(to)}`]);

// The pages of the third year print a statement as a plain paragraph; as .qtext the shell can format it.
export const QTEXT = ['body += `<p>${esc(t.q)}</p>`;', 'body += `<p class="qtext">${esc(t.q)}</p>`;'];

// Program output typed by the student is compared without regard to letter case and repeated spaces (agreed 16. 11. 2026):
// each line is trimmed and its runs of spaces become one, case is folded, the empty lines before and after the output
// are dropped. A task that says in its statement that case or spaces matter carries the flag `exact` (LavRac.prepare)
// and is compared as typed (only the spaces at the end of a line and the empty lines at the end are ignored).
// `multi` is the style of 3.3 to 3.5 (several accepted outputs), otherwise 3.1 and 3.2 (one expected output).
// Several lines of output are worth a share of the points: `part` is the number of lines that are right (in order, the longest
// common run of lines) out of the longer of the two outputs.
export const outputCompare = (multi) => [
  [String.raw`const normOut = s => String(s).replace(/\r/g,"").split("\n").map(l=>l.replace(/\s+$/,"")).join("\n").replace(/\n+$/,"");`,
    String.raw`const normOut = (s, t) => { const x = String(s).replace(/\r/g,"").split("\n").map(l => t && t.exact ? l.replace(/\s+$/,"") : l.replace(/\s+/g," ").trim().toLowerCase()); return x.join("\n").replace(t && t.exact ? /\n+$/ : /^\n+|\n+$/g,""); };
const lcsN = (a, b) => { const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i-1] === b[j-1] ? d[i-1][j-1] + 1 : Math.max(d[i-1][j], d[i][j-1]); return d[a.length][b.length]; };`],
  multi
    ? ['ok = exps.some(e=>normOut(out.value)===normOut(e));', 'ok = exps.some(e=>normOut(out.value,t)===normOut(e,t));']
    : ['ok = normOut(out.value)===normOut(t.expected);', 'ok = normOut(out.value,t)===normOut(t.expected,t);'],
  multi
    ? [String.raw`const a=normOut(out.value).split("\n"), b=normOut(exps[0]).split("\n");`, String.raw`const a=normOut(out.value,t).split("\n"), b=normOut(exps[0],t).split("\n"); part = exps.map(e => { const bb = normOut(e,t).split("\n"); return { right: lcsN(a,bb), of: Math.max(a.length,bb.length) }; }).sort((u,v) => v.right/v.of - u.right/u.of)[0];`]
    : [String.raw`const a=normOut(out.value).split("\n"), b=normOut(t.expected).split("\n");`, String.raw`const a=normOut(out.value,t).split("\n"), b=normOut(t.expected,t).split("\n"); part = { right: lcsN(a,b), of: Math.max(a.length,b.length) };`],
];

// Partial credit (agreed 16. 11. 2026): a task with several parts passes the number of parts that are right to the shell
// (`part`: { right, of }), which turns it into points; one part that is right gets its share. For the tasks the third and the
// fourth year share (choice with several right answers, blanks, sorting statements); the output tasks have it in outputCompare.
export const partialCredit = [
  ['    let ok=false, msg="";\n    if(t.type==="mc"){', '    let ok=false, msg="", part=null;\n    if(t.type==="mc"){'],
  // a choice with several right answers: the right ones chosen minus the wrong ones chosen
  ['      if(!ok && t.a.length>1 && v.size!==t.a.length) msg = `Pravilnih odgovorov je ${t.a.length}.`;',
    '      if(!ok && t.a.length>1){ const hit = [...v].filter(k=>t.a.includes(k)).length; part = { right: Math.max(0, hit - (v.size - hit)), of: t.a.length }; }\n      if(!ok && t.a.length>1 && v.size!==t.a.length) msg = `Pravilnih odgovorov je ${t.a.length}.`;'],
  ['      ok = all;\n    }\n    if(t.type==="cls"){',
    '      ok = all; part = { right: t.b.filter((b,k)=>matchBlank($(`#b-${t.id}-${k}`,el).value,b)).length, of: t.b.length };\n    }\n    if(t.type==="cls"){'],
  ['      ok = all; if(!ok && s.v.includes(null)) msg="Razvrsti vse trditve.";',
    '      ok = all; if(!ok && s.v.includes(null)) msg="Razvrsti vse trditve.";\n      part = { right: t.items.filter((it,k)=>s.v[k]===it[1]).length, of: t.items.length };'],
];

// The same for the second year (2.2 and 2.3): blanks (each blank is right or not), sorting and matching rows, a choice with
// several right answers. The special kinds (truth tables, Karnaugh map, groups, expressions, bits, parts of a figure, assembler)
// stay all or nothing. `spaced` is how 2.2 writes the declaration (2.3 has no spaces).
export const partialCredit2 = (spaced) => [
  [spaced ? '    let ok = false, msg = "";\n    if(t.type==="mc"){' : '    let ok=false, msg="";\n    if(t.type==="mc"){',
    spaced ? '    let ok = false, msg = "", part = null;\n    if(t.type==="mc"){' : '    let ok=false, msg="", part=null;\n    if(t.type==="mc"){'],
  partialCredit[1],
  ['      ok = flags.every(Boolean);', '      ok = flags.every(Boolean); part = { right: flags.filter(Boolean).length, of: flags.length };'],
  ['ok = all; if(!ok && s.v.includes(null)) msg = t.type==="cls" ? "Razvrsti vse trditve." : "Izpolni vse vrstice.";',
    'ok = all; if(!ok && s.v.includes(null)) msg = t.type==="cls" ? "Razvrsti vse trditve." : "Izpolni vse vrstice.";\n      { const rows = t.type==="cls" ? t.items : t.rows; part = { right: rows.filter((r,k)=>s.v[k]===r[1]).length, of: rows.length }; }'],
];

// The tasks where the student writes code stay as the portal handles them (points or "Sam preveri" as set in the adapter; the
// answer, the hints and the solution go to the shell). The newer artifacts add a self-assessment of their own for these tasks
// (»Preveri izpis«, »Primerjaj z rešitvijo«, criteria to tick, no points). It is not used: these replacements bring back the
// artifact's earlier handling of such a task. Must come before the replacement of »Pokaži rešitev«.
export const codeAsBefore = [
  ["`${t.type===\"code\"?`<span class=\"tag self\">Samoocena · na maturi ${ptsLabel(t.pts)}</span>`:`<span class=\"tag\">${ptsLabel(t.pts)}</span>`}<span class=\"tag js-st\" hidden></span>`",
    "`<span class=\"tag\">${ptsLabel(t.pts)}</span><span class=\"tag js-st\" hidden></span>`"],
  ["Izpis tvojega programa (neobvezno)</label><textarea id=\"o-${t.id}\" class=\"mono out\" spellcheck=\"false\"></textarea></div><p class=\"selfnote\">Pri nalogah, kjer pišeš kodo, stran pravilnosti ne more preveriti, zato točk ni. Izpis je le preizkus. Ko končaš, klikni »Primerjaj z rešitvijo«: svojo kodo vidiš ob primeru rešitve in sam oceniš, ali je pravilna. Koda se shrani.</p>",
    "Izpis tvojega programa</label><textarea id=\"o-${t.id}\" class=\"mono out\" spellcheck=\"false\"></textarea></div>"],
  ["${t.type===\"code\"?\"Preveri izpis\":\"Preveri\"}", 'Preveri'],
  ["${t.type===\"code\"?\"Primerjaj z rešitvijo\":\"Pokaži rešitev\"}", 'Pokaži rešitev'],
  ["    if(t.type===\"code\"){ show(ok, ok ? \"Izpis se ujema s pričakovanim. Zdaj primerjaj še svojo kodo z rešitvijo.\" : (\"Izpis se še ne ujema. \"+msg).trim()); save(); return; }\n", ''],
  ["    if(t.type===\"code\"){\n      if(!solEl.hidden){ solEl.hidden = true; btn.textContent = \"Primerjaj z rešitvijo\"; return; }\n      collect();\n      const mine = (ed.value||\"\").trim(), empty = !mine || mine===(t.starter||\"\").trim();\n      if(empty && !s.askEmpty){ s.askEmpty = true; show(false,\"Najprej poskusi napisati svojo kodo. Če želiš samo rešitev, klikni še enkrat (naloga se potem ne šteje).\"); return; }\n      drawCmp(empty); solEl.hidden = false; btn.textContent = \"Skrij primerjavo\";\n      if(empty && s.state!==\"cmp\"){ s.state=\"seen\"; save(); paint(); progress(); }\n      return;\n    }\n", ''],
];

// The small tasks at the end of an explanation (»Preizkusi se«: drag and drop, true or false, which picture, trace). They have no
// points and the portal keeps nothing of them (agreed 18. 11. 2026): the mark »Opravljeno« lives in the page only. The search in
// the explanations skips what is marked data-quiz, as it skips the quizzes of 4.1.
export const miniTasks = [
  ["document.querySelectorAll(\".w\").forEach(r=>{ if(wdone(r)) r.classList.add(\"done\"); });",
    'document.querySelectorAll(".w").forEach(r=>{ r.setAttribute("data-quiz",""); if(wdone(r)) r.classList.add("done"); });'],
  // The artifact's task filter takes every element with the class chip, so a piece of a drag and drop task that was clicked got
  // aria-pressed and the colour of a pressed filter (light text on a light ground), and the filter lost its own mark. Only the filter
  // buttons (they have data-f) are meant.
  ["document.querySelectorAll(\".chip\").forEach(c=>c.addEventListener(\"click\",()=>{\n  document.querySelectorAll(\".chip\").forEach(x=>x.setAttribute(\"aria-pressed\",\"false\"));",
    "document.querySelectorAll(\".chip[data-f]\").forEach(c=>c.addEventListener(\"click\",()=>{\n  document.querySelectorAll(\".chip[data-f]\").forEach(x=>x.setAttribute(\"aria-pressed\",\"false\"));"],
];

// The trace widgets of the explanations (»Preizkusi se«, step through a short program) build a function from text with
// new Function, which the portal's content security policy forbids. At import the functions are built here instead and
// the page looks them up by the name of the widget (agreed 18. 11. 2026; the policy stays strict).
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
export function traceCompile(id) {
  const html = readFileSync(new URL(`../sources/${id}.html`, import.meta.url), 'utf8');
  const fns = [];
  const seen = new Set();
  for (const m of html.matchAll(/<div class="w wtrace" data-w="([^"]+)" data-cfg="([^"]*)"/g)) {
    if (seen.has(m[1])) throw new Error(`trace widget ${m[1]} appears twice in ${id}`);
    seen.add(m[1]);
    const cfg = JSON.parse(unesc(m[2]));
    const names = cfg.vars.map((v) => v[0]);
    // The same text the artifact passes to new Function.
    const body = '"use strict";var ' + names.join(',') + ';\nfunction __l(k){ if(frames.length>500) throw new JErr("__limit"); frames.push({k:k,v:{'
      + names.map((n) => n + ':cl(' + n + ')').join(',') + '},o:out.length}); }\n' + cfg.js + '\n__l(-1);';
    fns.push(`${JSON.stringify(m[1])}:function(IN,println,print,D,Ch,I,Bt,Sh,div,rem,cl,frames,out,JErr){${body}\n}`);
  }
  if (!fns.length) return [];
  return [
    ['class JErr extends Error {}', `class JErr extends Error {}\nconst TRACE_FN = {\n${fns.join(',\n')}\n};`],
    ['try { new Function("IN","println","print","D","Ch","I","Bt","Sh","div","rem","cl","frames","out","JErr", body)(IN,',
      'try { TRACE_FN[root.dataset.w](IN,'],
  ];
}
