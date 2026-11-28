// The SQL sandbox editor: CodeMirror 6 with MySQL highlighting and completion of the tables and columns of the chosen
// database. Bundled into one local file (src/public/js/vendor/sqleditor.js) by scripts/editor/build.mjs; no CDN.
// The colours are CSS variables of the portal, so the editor follows the light, dark and high-contrast themes.
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { MySQL, sql } from '@codemirror/lang-sql';
import { tags as t } from '@lezer/highlight';
import { splitSql } from '../../src/sqlsplit.js';

const style = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--sq-kw)', fontWeight: '700' },
  { tag: [t.typeName, t.standard(t.name)], color: 'var(--sq-type)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--sq-str)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--sq-num)' },
  { tag: [t.lineComment, t.blockComment, t.comment], color: 'var(--sq-com)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.name)], color: 'var(--sq-fn)' },
  { tag: [t.special(t.name), t.propertyName], color: 'var(--sq-id)' },
  { tag: [t.operator, t.punctuation, t.paren, t.bracket], color: 'var(--sq-op)' },
]);
const theme = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'var(--sq-bg)', fontSize: 'var(--sq-size, .98rem)', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--fm)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--acc)', padding: '8px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--acc)', borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: 'var(--sq-gut)', color: 'var(--mut)', border: 'none', borderRight: '1px solid var(--line)' },
  // The active line is a translucent tint: the selection is drawn under the text lines, an opaque colour would hide it.
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--acc) 8%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--sq-act)', color: 'var(--ink)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--sq-sel) !important' },
  '.cm-selectionMatch': { backgroundColor: 'var(--sq-match)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--sq-match)', outline: '1px solid var(--wire)' },
  '.cm-tooltip': { backgroundColor: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--wire)', borderRadius: '8px', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--acc)', color: 'var(--onacc)' },
  '.cm-completionIcon': { width: '1.2em', opacity: '.9', paddingRight: '.4em', textAlign: 'center' },
  '.cm-completionDetail': { color: 'inherit', opacity: '.7', marginLeft: '10px', fontStyle: 'normal' },
  '.cm-errline': { backgroundColor: 'var(--sq-err)' },
  '.cm-runline': { backgroundColor: 'var(--sq-run)' },
  '.cm-placeholder': { color: 'var(--mut)' },
  '.cm-panels': { backgroundColor: 'var(--card)', color: 'var(--ink)' },
  '.cm-search input, .cm-search button': { minHeight: '30px' },
});

// Lines marked as the error (red) or the statement that ran (light) until the text changes.
const setMarks = StateEffect.define();
const marks = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) if (e.is(setMarks)) deco = e.value;
    if (tr.docChanged) deco = Decoration.none;
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});
const lineDeco = (cls) => Decoration.line({ class: cls });

export function create(parent, opts = {}) {
  const lang = new Compartment();
  const run = (what) => () => { opts.onRun?.(what); return true; };
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.doc ?? '',
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
        highlightActiveLine(), highlightSelectionMatches(), autocompletion({ activateOnTyping: true, icons: true, maxRenderedOptions: 60 }),
        lang.of(sql({ dialect: MySQL, upperCaseKeywords: true })),
        syntaxHighlighting(style), theme, marks, EditorView.lineWrapping,
        // the portal's CSP allows the editor's own <style> only with this page's nonce
        ...(opts.nonce ? [EditorView.cspNonce.of(opts.nonce)] : []),
        placeholder(opts.placeholder ?? ''),
        EditorView.contentAttributes.of({ 'aria-label': opts.label ?? 'Urejevalnik SQL', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        keymap.of([
          { key: 'Mod-Enter', run: run('all') },
          { key: 'Mod-Shift-Enter', run: run('statement') },
          { key: 'F5', run: run('all') },
          ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab,
        ]),
        EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange?.(); if (u.selectionSet || u.docChanged) opts.onSelect?.(); }),
      ],
    }),
  });
  return {
    view,
    get value() { return view.state.doc.toString(); },
    set value(v) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } }); },
    focus: () => view.focus(),
    // the selected text, or null; with the line it starts on (errors from the server count lines from there)
    selection() {
      const r = view.state.selection.main;
      if (r.empty) return null;
      return { text: view.state.sliceDoc(r.from, r.to), line: view.state.doc.lineAt(r.from).number };
    },
    // the statement under the cursor (Workbench: Ctrl+Enter); the one before it when the cursor is after the last semicolon
    statement() {
      const doc = view.state.doc.toString();
      const pos = view.state.selection.main.head;
      const list = splitSql(doc).statements;
      if (!list.length) return null;
      let st = list.find((s) => pos >= s.start && pos <= s.end + 1) ?? [...list].reverse().find((s) => s.end < pos) ?? list[0];
      return { text: st.sql, line: st.line };
    },
    insert(text) {
      const r = view.state.selection.main;
      view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + text.length } });
      view.focus();
    },
    gotoLine(n, cls = 'cm-errline', lines = 1) {
      const doc = view.state.doc;
      const first = Math.min(Math.max(1, n), doc.lines);
      const last = Math.min(doc.lines, first + Math.max(1, lines) - 1);
      const ranges = [];
      for (let i = first; i <= last; i++) ranges.push(lineDeco(cls).range(doc.line(i).from));
      view.dispatch({ effects: [setMarks.of(Decoration.set(ranges)), EditorView.scrollIntoView(doc.line(first).from, { y: 'center' })], selection: { anchor: doc.line(first).from } });
    },
    clearMarks: () => view.dispatch({ effects: setMarks.of(Decoration.none) }),
    // table -> columns for completion (tables of the chosen database)
    setSchema(tables) {
      const schema = {};
      // a column shows its type and a key mark (PK primary, UQ unique)
      const mark = (c) => (c.key === 'PRI' ? ' · PK' : c.key === 'UNI' ? ' · UQ' : '');
      for (const tb of tables ?? []) schema[tb.name] = tb.columns.map((c) => ({ label: c.name, detail: `${c.type}${mark(c)}`, type: 'property', boost: c.key === 'PRI' ? 1 : 0 }));
      const names = (tables ?? []).map((tb) => ({ label: tb.name, type: 'type', detail: tb.view ? 'pogled' : 'tabela', boost: 2 }));
      view.dispatch({ effects: lang.reconfigure(sql({ dialect: MySQL, upperCaseKeywords: true, schema, tables: names })) });
    },
  };
}
export { splitSql };
