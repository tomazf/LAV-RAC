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
export const outputCompare = (multi) => [
  [String.raw`const normOut = s => String(s).replace(/\r/g,"").split("\n").map(l=>l.replace(/\s+$/,"")).join("\n").replace(/\n+$/,"");`,
    String.raw`const normOut = (s, t) => { const x = String(s).replace(/\r/g,"").split("\n").map(l => t && t.exact ? l.replace(/\s+$/,"") : l.replace(/\s+/g," ").trim().toLowerCase()); return x.join("\n").replace(t && t.exact ? /\n+$/ : /^\n+|\n+$/g,""); };`],
  multi
    ? ['ok = exps.some(e=>normOut(out.value)===normOut(e));', 'ok = exps.some(e=>normOut(out.value,t)===normOut(e,t));']
    : ['ok = normOut(out.value)===normOut(t.expected);', 'ok = normOut(out.value,t)===normOut(t.expected,t);'],
  multi
    ? [String.raw`const a=normOut(out.value).split("\n"), b=normOut(exps[0]).split("\n");`, String.raw`const a=normOut(out.value,t).split("\n"), b=normOut(exps[0],t).split("\n");`]
    : [String.raw`const a=normOut(out.value).split("\n"), b=normOut(t.expected).split("\n");`, String.raw`const a=normOut(out.value,t).split("\n"), b=normOut(t.expected,t).split("\n");`],
];
