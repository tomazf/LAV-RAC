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
