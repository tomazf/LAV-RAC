// Builds the SQL editor bundle: node scripts/editor/build.mjs (npm run build:editor). The output is committed,
// so the portal image needs neither esbuild nor the CodeMirror packages.
import { build } from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
await build({
  entryPoints: [path.join(root, 'scripts/editor/entry.js')],
  outfile: path.join(root, 'src/public/js/vendor/sqleditor.js'),
  bundle: true, minify: true, format: 'iife', globalName: 'LRSqlEditor', target: ['es2020'], legalComments: 'eof',
  banner: { js: '/* SQL editor for LAV-RAČ: CodeMirror 6 (MIT, https://codemirror.net). Built by scripts/editor/build.mjs. */' },
});
console.log('src/public/js/vendor/sqleditor.js');
