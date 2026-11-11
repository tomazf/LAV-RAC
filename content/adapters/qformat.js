// Light markup in long task statements (the shell turns it into paragraphs, bold words and lists: formatQ in
// content/shell/vaja.js): **bold**, one paragraph per line, lines starting with "- " form a list.
// A pair is [statement as it is in the page at that point, new statement]; the importer fails if the old one is not there once.
export const statements = (pairs) => pairs.map(([from, to]) => [`q:${JSON.stringify(from)}`, `q:${JSON.stringify(to)}`]);

// The pages of the third year print a statement as a plain paragraph; as .qtext the shell can format it.
export const QTEXT = ['body += `<p>${esc(t.q)}</p>`;', 'body += `<p class="qtext">${esc(t.q)}</p>`;'];
