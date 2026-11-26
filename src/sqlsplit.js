// Splits a MySQL script into statements, the way the mysql client and Workbench do with the default delimiter.
// Knows strings ('…', "…", with backslash escapes and doubled quotes), `identifiers`, and comments (-- , #, /* */).
// Each statement carries where it starts in the script (offset, line from 1), so an error can point at its line.
// DELIMITER is a client command, not SQL; the sandbox runs every statement on its own and does not need it.

export function splitSql(text) {
  const src = String(text ?? '');
  const out = [];
  let start = -1; // first character of the statement that is not space or a comment
  let i = 0;
  let line = 1;
  let startLine = 1;
  let delimiter = false;
  const begin = () => { if (start < 0) { start = i; startLine = line; } };
  const flush = (end) => {
    if (start >= 0) {
      const sql = src.slice(start, end).trim();
      if (sql) out.push({ sql, start, end, line: startLine });
    }
    start = -1;
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    // DELIMITER at the start of a statement (the mysql client's command); the rest of the line is its argument
    if (start < 0 && /^delimiter[ \t]/i.test(src.slice(i, i + 10))) {
      delimiter = true;
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '-' && n === '-' && (src[i + 2] === undefined || /\s/.test(src[i + 2]))) {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      // /*! … */ is MySQL's executable comment: it is part of the statement
      if (src[i + 2] === '!') begin();
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      begin();
      i++;
      while (i < src.length) {
        if (src[i] === '\n') line++;
        if (src[i] === '\\' && c !== '`') { i += 2; continue; }
        if (src[i] === c) {
          if (src[i + 1] === c) { i += 2; continue; }
          break;
        }
        i++;
      }
      i++;
      continue;
    }
    if (c === ';') { flush(i); i++; continue; }
    if (!/\s/.test(c)) begin();
    i++;
  }
  flush(src.length);
  return { statements: out, delimiter };
}

// The first keyword of a statement (for the size limit: an over-full database may still shrink).
export const firstWord = (sql) => (String(sql).replace(/^(\s|\/\*(?!!)[\s\S]*?\*\/|(--\s|#)[^\n]*\n?)*/, '').match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
