// The SQL sandbox page: editor, running statements on the MySQL server (POST /api/sql/run), results per statement,
// errors pointing at their line, the tables of the chosen database, saved scripts, the history of runs and an ER diagram.
(() => {
  'use strict';
  const root = document.getElementById('sq');
  if (!root || !window.LRSqlEditor) return;
  root.hidden = false;
  const csrf = root.dataset.csrf;
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  };
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf, ...body }) });
    let d = {};
    try { d = await r.json(); } catch { /* not JSON */ }
    if (!r.ok && !d.error) d.error = r.status === 401 ? 'Prijava je potekla. Osveži stran in se prijavi znova.' : 'Strežnik portala ni odgovoril pravilno. Poskusi znova.';
    return d;
  };
  const get = async (url) => { const r = await fetch(url, { credentials: 'same-origin' }); try { return await r.json(); } catch { return { ok: false }; } };
  const sl = (n, forms) => { const m = n % 100; return `${n} ${m === 1 ? forms[0] : m === 2 ? forms[1] : m === 3 || m === 4 ? forms[2] : forms[3]}`; };
  const VRSTIC = ['vrstica', 'vrstici', 'vrstice', 'vrstic'];
  const ms = (t) => (t < 1000 ? `${t} ms` : `${(t / 1000).toLocaleString('sl-SI', { maximumFractionDigits: 1 })} s`);

  // ---------- editor ----------
  const db = $('sq-db');
  const STARTER = {
    moja: '-- Moja baza (4.4): tukaj ustvarjaš tabele in omejitve.\n-- Zaženi s Ctrl+Enter.\n\nSHOW TABLES;\n',
    moja6: '-- Moja baza za poglavje 6 (4.6): INSERT, UPDATE, DELETE in tuji ključi.\n-- Zaženi s Ctrl+Enter.\n\nSHOW TABLES;\n',
    sola: '-- Šolska baza (samo branje), za poizvedbe iz 4.5.\n\nSELECT ime, priimek\nFROM dijak\nORDER BY priimek, ime\nLIMIT 10;\n',
    matura: '-- Tabele maturitetnih nalog (samo branje). Predpona je šifra pole, npr. m171_film.\n\nSHOW TABLES;\n',
  };
  const draft = $('sq-draft')?.value ?? '';
  let saveTimer = null;
  const saved = $('sq-saved');
  const ed = window.LRSqlEditor.create($('sq-ed'), {
    doc: draft || STARTER[db.value] || '',
    label: 'Urejevalnik SQL',
    nonce: root.dataset.nonce,
    onRun: (what) => runIt(what),
    onChange: () => {
      saved.textContent = '';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveDraft, 1500);
    },
    onSelect: () => { $('sq-run-l').textContent = ed?.selection() ? 'Zaženi izbrano' : 'Zaženi vse'; },
  });
  root.sqEditor = ed; // for the browser tests
  async function saveDraft() {
    const d = await post('/api/sql/osnutek', { target: db.value, sql: ed.value });
    saved.textContent = d.ok ? 'Osnutek shranjen' : '';
  }
  window.addEventListener('beforeunload', () => {
    if (!saveTimer) return;
    navigator.sendBeacon?.('/api/sql/osnutek', new Blob([JSON.stringify({ csrf, target: db.value, sql: ed.value })], { type: 'text/plain' }));
  });

  // ---------- the tables of the chosen database ----------
  let schema = null;
  const tree = $('sq-tree');
  async function loadSchema() {
    tree.replaceChildren(el('p', { class: 'dim', text: 'Nalagam …' }));
    const d = await get(`/api/sql/shema?baza=${encodeURIComponent(db.value)}`);
    if (!d.ok) { schema = null; tree.replaceChildren(el('p', { class: 'dim', text: d.error || 'Tabel ni mogoče prebrati.' })); return; }
    schema = d;
    ed.setSchema(d.tables);
    drawTree();
  }
  const fkOf = (t, c) => schema.fks.find((f) => f.table === t && f.column === c);
  function drawTree() {
    if (!schema.tables.length) {
      tree.replaceChildren(el('p', { class: 'dim', text: db.value.startsWith('moja') ? 'Baza je prazna. Ustvari tabelo s CREATE TABLE ali jo ponastavi s pripravljeno skripto.' : 'V bazi ni tabel.' }));
      return;
    }
    const open = new Set([...tree.querySelectorAll('details[open]')].map((d) => d.dataset.t));
    tree.replaceChildren(el('ul', { class: 'sq-tables' }, schema.tables.map((t) => el('li', {},
      el('details', { 'data-t': t.name, open: open.has(t.name) || null },
        el('summary', {},
          el('button', { type: 'button', class: 'sq-name', title: 'Vstavi ime v urejevalnik', onclick: (e) => { e.preventDefault(); ed.insert(t.name); } }, t.name),
          el('span', { class: 'sq-rows', title: t.view ? 'pogled' : 'približno število vrstic' }, t.view ? 'pogled' : t.rows === null ? '' : `~${t.rows}`)),
        el('ul', { class: 'sq-cols' }, t.columns.map((c) => {
          const fk = fkOf(t.name, c.name);
          return el('li', {},
            el('span', { class: 'sq-key', title: c.key === 'PRI' ? 'primarni ključ' : fk ? `tuji ključ → ${fk.refTable}.${fk.refColumn}` : '' }, c.key === 'PRI' ? 'PK' : fk ? 'FK' : ''),
            el('button', { type: 'button', class: 'sq-name', title: fk ? `→ ${fk.refTable}.${fk.refColumn}` : 'Vstavi ime', onclick: () => ed.insert(c.name) }, c.name),
            el('span', { class: 'sq-type' }, c.type + (c.nullable ? '' : ' · NOT NULL')));
        })))))));
  }
  $('sq-refresh').addEventListener('click', loadSchema);
  // Which database the statements run on is always written above the editor (also for the read-only shared ones).
  const banner = $('sq-banner');
  function showBanner() {
    const o = db.selectedOptions[0];
    if (!o || !banner) return;
    banner.classList.toggle('ro', !!o.dataset.ro);
    banner.replaceChildren(document.createTextNode('Stavki se izvedejo v bazi '), el('code', {}, o.dataset.real || ''),
      document.createTextNode(` (${o.dataset.title || ''}${o.dataset.ro ? ', samo branje' : ''}).`));
  }
  showBanner();
  db.addEventListener('change', () => {
    if (!ed.value.trim() || Object.values(STARTER).includes(ed.value)) ed.value = STARTER[db.value] || '';
    showBanner();
    loadSchema();
    saveDraft();
  });

  // ---------- running ----------
  const out = $('sq-out');
  const runBtns = [$('sq-run'), $('sq-run1')];
  const HINTS = {
    1064: 'Napaka v skladnji. Poglej besedo tik pred navedenim delom: manjka vejica, oklepaj ali narekovaj, ali pa je ključna beseda napisana narobe.',
    1146: 'Tabela v tej bazi ne obstaja. Preveri ime (tabele so levo) ali jo najprej ustvari.',
    1054: 'Stolpec ne obstaja ali ni v tabelah iz FROM. Preveri ime in predpono tabele.',
    1052: 'Ime stolpca je dvoumno, ker je v več tabelah. Napiši tabela.stolpec.',
    1062: 'Podvojena vrednost primarnega ali enoličnega ključa (UNIQUE).',
    1451: 'Vrstice ni mogoče izbrisati ali spremeniti, ker se nanjo sklicuje tuji ključ v drugi tabeli (ON DELETE / ON UPDATE).',
    1452: 'Tuji ključ kaže na vrstico, ki je v nadrejeni tabeli ni. Najprej vstavi nadrejeno vrstico.',
    1050: 'Tabela s tem imenom že obstaja. Uporabi drugo ime ali najprej DROP TABLE IF EXISTS.',
    1048: 'Stolpec ne sme biti NULL (NOT NULL).',
    1364: 'Stolpec nima privzete vrednosti, zato ga moraš vpisati.',
    1136: 'Število vrednosti se ne ujema s številom stolpcev.',
    1142: 'Za ta ukaz nimaš pravic. Skupne baze so samo za branje; spreminjaš lahko svojo bazo.',
    1044: 'Do te baze nimaš dostopa. Delaš lahko samo v svoji bazi.',
    1055: 'Pri GROUP BY mora biti vsak stolpec iz SELECT, ki ni v agregatni funkciji, tudi v GROUP BY.',
    1111: 'Agregatne funkcije (COUNT, SUM …) ni mogoče uporabiti v WHERE. Uporabi HAVING.',
    1292: 'Napačna vrednost za tip stolpca. Datum piši kot \'LLLL-MM-DD\'.',
    1366: 'Vrednost se ne ujema s tipom stolpca.',
    1406: 'Besedilo je daljše, kot dovoli stolpec (npr. VARCHAR(20)).',
    3819: 'Vrstica krši omejitev CHECK.',
    1091: 'Stolpca, ključa ali omejitve s tem imenom ni, zato ga ni mogoče izbrisati.',
    1826: 'Omejitev s tem imenom že obstaja. Imena omejitev (CONSTRAINT) morajo biti v bazi različna.',
    1822: 'Za tuji ključ mora imeti nadrejena tabela na tem stolpcu primarni ali enolični ključ.',
    3780: 'Tuji ključ in stolpec, na katerega kaže, morata imeti enak tip.',
    1049: 'Baza ne obstaja. V peskovniku je baza že izbrana zgoraj, USE ni potreben.',
  };
  function resultLabel(r) {
    if (!r.ok) return r.timeout ? 'prekinjen' : 'napaka';
    if (r.kind === 'rows') return sl(r.total, VRSTIC);
    if (r.affected) return `${sl(r.affected, ['spremenjena', 'spremenjeni', 'spremenjene', 'spremenjenih'])}`;
    return 'izvedeno';
  }
  const isNum = (v) => v === null || /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v);
  function table(r) {
    const numeric = r.columns.map((_, i) => r.rows.length > 0 && r.rows.every((row) => isNum(row[i])) && r.rows.some((row) => row[i] !== null));
    return el('div', { class: 'sq-grid-wrap', tabindex: '0', role: 'region', 'aria-label': 'Rezultat' },
      el('table', { class: 'sq-grid' },
        el('thead', {}, el('tr', {}, el('th', { class: 'n', scope: 'col' }, '#'), r.columns.map((c, i) => el('th', { scope: 'col', class: numeric[i] ? 'num' : null }, c)))),
        el('tbody', {}, r.rows.map((row, k) => el('tr', {}, el('td', { class: 'n' }, k + 1),
          row.map((v, i) => (v === null ? el('td', { class: 'null' }, 'NULL') : el('td', { class: numeric[i] ? 'num' : null, title: v.length > 60 ? v : null }, v))))))));
  }
  const csvOf = (r) => [r.columns, ...r.rows].map((row) => row.map((v) => (v === null ? '' : /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';')).join('\r\n');
  const download = (name, text, type) => {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  function panel(r, base) {
    const line = r.line + base - 1;
    const head = el('div', { class: 'sq-ph' },
      el('code', { class: 'sq-stmt', title: r.sql }, r.sql.split('\n')[0].slice(0, 120) + (r.sql.length > 120 || r.sql.includes('\n') ? ' …' : '')),
      el('button', { type: 'button', class: 'linkbtn', onclick: () => ed.gotoLine(line, r.ok ? 'cm-runline' : 'cm-errline', r.ok ? r.sql.split('\n').length : 1) }, `vrstica ${line}`));
    if (!r.ok) {
      const hint = HINTS[r.errno];
      return el('div', { class: 'sq-panel' }, head,
        el('div', { class: 'sq-error', role: 'alert' },
          el('p', { class: 'sq-error-h' }, r.timeout ? 'Stavek je bil prekinjen' : `Napaka ${r.errno ?? ''}`, r.code ? el('span', { class: 'dim' }, ` · ${r.code}`) : null),
          el('p', { class: 'mono' }, r.message),
          hint ? el('p', { class: 'sq-hint' }, hint) : null));
    }
    if (r.kind === 'rows') {
      return el('div', { class: 'sq-panel' }, head,
        el('div', { class: 'sq-meta' },
          el('span', {}, `${sl(r.total, VRSTIC)} · ${ms(r.ms)}${r.truncated ? ` · prikazanih prvih ${r.rows.length}` : ''}`,
            r.stopped ? el('strong', { class: 'sq-warn' }, ` · stavek je dosegel časovno omejitev (${root.dataset.timeout} s), rezultat morda ni popoln`) : null),
          r.rows.length ? el('span', { class: 'row tight' },
            el('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { navigator.clipboard?.writeText(csvOf(r).replace(/;/g, '\t')); e.target.textContent = 'Kopirano'; } }, 'Kopiraj'),
            el('button', { type: 'button', class: 'btn ghost small', onclick: () => download('rezultat.csv', `﻿${csvOf(r)}\r\n`, 'text/csv') }, 'CSV')) : null),
        r.columns.length && r.rows.length ? table(r) : el('p', { class: 'empty' }, 'Poizvedba ni vrnila nobene vrstice.'));
    }
    const ms_ = ms(r.ms);
    return el('div', { class: 'sq-panel' }, head,
      el('p', { class: 'sq-ok' }, '✓ ', r.affected ? `Spremenjenih vrstic: ${r.affected}` : 'Stavek je izveden.',
        r.warnings ? el('span', { class: 'sq-warn' }, ` · opozoril: ${r.warnings} (SHOW WARNINGS)`) : null,
        el('span', { class: 'dim' }, ` · ${ms_}`)),
      r.info ? el('p', { class: 'dim mono' }, r.info) : null);
  }
  function show(d, base, label) {
    if (d.error) { out.replaceChildren(el('div', { class: 'sq-error', role: 'alert' }, el('p', {}, d.error))); return; }
    const res = d.results;
    const failed = res.find((r) => !r.ok);
    const tabs = el('div', { class: 'sq-tabs', role: 'tablist', 'aria-label': 'Rezultati po stavkih' });
    const box = el('div', { class: 'sq-panels' });
    const panels = res.map((r) => panel(r, base));
    const select = (i, focus) => {
      [...tabs.children].forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      box.replaceChildren(panels[i]);
      if (focus) tabs.children[i].focus();
    };
    res.forEach((r, i) => tabs.append(el('button', {
      type: 'button', role: 'tab', class: `sq-tab ${r.ok ? 'ok' : 'bad'}`, onclick: () => select(i),
      onkeydown: (e) => {
        const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: res.length - 1 }[e.key];
        if (k !== undefined) { e.preventDefault(); select((k + res.length) % res.length, true); }
      },
    }, el('span', { class: 'sq-dot', 'aria-hidden': 'true' }), `${r.n}`, el('small', {}, ` · ${resultLabel(r)}`))));
    const skipped = d.statements - d.ran;
    const sum = el('p', { class: `sq-sum ${failed ? 'bad' : 'ok'}`, role: 'status' },
      failed ? `Napaka v stavku ${failed.n}${skipped ? `; ${sl(skipped, ['stavek ni bil izveden', 'stavka nista bila izvedena', 'stavki niso bili izvedeni', 'stavkov ni bilo izvedenih'])}` : ''}.`
        : `${label}: ${sl(res.length, ['stavek izveden', 'stavka izvedena', 'stavki izvedeni', 'stavkov izvedenih'])} · ${ms(res.reduce((a, r) => a + r.ms, 0))}`);
    out.replaceChildren(sum, tabs, box);
    const lastRows = res.map((r) => r.kind === 'rows').lastIndexOf(true);
    const pick = failed ? res.indexOf(failed) : lastRows >= 0 ? lastRows : res.length - 1;
    select(pick);
    if (failed) ed.gotoLine(failed.line + base - 1, 'cm-errline'); else ed.clearMarks();
  }
  let busy = false;
  async function runIt(what) {
    if (busy) return;
    let part;
    if (what === 'statement') part = ed.statement();
    else part = ed.selection() ?? { text: ed.value, line: 1 };
    if (!part || !part.text.trim()) { out.replaceChildren(el('p', { class: 'empty' }, 'Ni stavka za izvedbo.')); return; }
    busy = true;
    runBtns.forEach((b) => { b.disabled = true; });
    out.replaceChildren(el('p', { class: 'sq-wait', role: 'status' }, el('span', { class: 'sq-spin', 'aria-hidden': 'true' }), 'Izvajam …'));
    try {
      const d = await post('/api/sql/run', { target: db.value, sql: part.text });
      show(d, part.line, what === 'statement' ? 'Stavek' : ed.selection() ? 'Izbrano' : 'Skript');
      if (d.changed) loadSchema();
    } catch {
      out.replaceChildren(el('div', { class: 'sq-error', role: 'alert' }, el('p', {}, 'Povezave s portalom ni. Preveri internet in poskusi znova.')));
    } finally {
      busy = false;
      runBtns.forEach((b) => { b.disabled = false; });
    }
  }
  $('sq-run').addEventListener('click', () => runIt('all'));
  $('sq-run1').addEventListener('click', () => runIt('statement'));

  // ---------- dialogs ----------
  for (const b of document.querySelectorAll('[data-open]')) b.addEventListener('click', () => { const d = $(b.dataset.open); d.showModal(); d.dispatchEvent(new Event('open')); });
  for (const d of document.querySelectorAll('dialog')) {
    for (const b of d.querySelectorAll('[data-close]')) b.addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  for (const c of document.querySelectorAll('[data-copy]')) {
    c.tabIndex = 0;
    c.title = 'Klikni za kopiranje';
    const copy = () => { navigator.clipboard?.writeText(c.textContent.trim()); c.classList.add('copied'); setTimeout(() => c.classList.remove('copied'), 1200); };
    c.addEventListener('click', copy);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  }

  // ---------- scripts ----------
  const sList = $('sq-scripts-list');
  const sMsg = $('sq-scripts-msg');
  const when = (t) => new Date(t).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  async function loadScripts() {
    const d = await get('/api/sql/skripti');
    if (!d.ok) return;
    if (!d.list.length) { sList.replaceChildren(el('li', { class: 'dim' }, 'Še ni shranjenih skriptov.')); return; }
    sList.replaceChildren(...d.list.map((x) => el('li', {},
      el('button', { type: 'button', class: 'sq-li-main', onclick: () => { ed.value = x.body; $('sq-name').value = x.name; $('sq-scripts').close(); ed.focus(); } },
        el('strong', {}, x.name), el('span', { class: 'dim' }, ` · ${when(x.updated_at)}`), el('code', {}, x.body.split('\n').find((l) => l.trim() && !l.startsWith('--'))?.slice(0, 80) ?? '')),
      el('button', { type: 'button', class: 'btn ghost small', 'aria-label': `Izbriši ${x.name}`, onclick: async () => { await post(`/api/sql/skripti/${x.id}/izbrisi`, {}); loadScripts(); } }, 'Izbriši'))));
  }
  $('sq-scripts').addEventListener('open', loadScripts);
  $('sq-save').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = await post('/api/sql/skripti', { name: $('sq-name').value, body: ed.value });
    sMsg.textContent = d.ok ? 'Shranjeno.' : d.error;
    if (d.ok) loadScripts();
  });

  // ---------- history ----------
  const hList = $('sq-hist-list');
  $('sq-hist').addEventListener('open', async () => {
    const d = await get('/api/sql/zgodovina');
    if (!d.ok) return;
    const names = Object.fromEntries([...db.options].map((o) => [o.value, `${o.dataset.title || o.value}${o.dataset.real ? ` (${o.dataset.real})` : ''}`]));
    if (!d.list.length) { hList.replaceChildren(el('li', { class: 'dim' }, 'Še ni zagonov.')); return; }
    hList.replaceChildren(...d.list.map((x) => el('li', {},
      el('button', { type: 'button', class: 'sq-li-main', onclick: () => { ed.value = x.body; $('sq-hist').close(); ed.focus(); } },
        el('span', { class: `sq-dot ${x.ok ? 'ok' : 'bad'}`, 'aria-label': x.ok ? 'uspešno' : 'napaka' }),
        el('strong', {}, when(x.created_at)), el('span', { class: 'dim' }, ` · ${names[x.target] ?? x.target} · ${sl(x.statements, ['stavek', 'stavka', 'stavki', 'stavkov'])}`),
        el('code', {}, x.body.replace(/\s+/g, ' ').slice(0, 110))))));
  });

  // ---------- ER diagram: tables as cards, lines from a foreign key to the key it points at ----------
  const er = $('sq-er');
  const canvas = $('sq-er-canvas');
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  let zoom = 1;
  let erBox = null;
  function drawEr() {
    if (!schema) return;
    $('sq-er-db').textContent = schema.database;
    const css = getComputedStyle(document.documentElement);
    const c = (v) => css.getPropertyValue(v).trim() || '#888';
    const col = { card: c('--card'), ink: c('--ink'), mut: c('--mut'), acc: c('--acc'), line: c('--wire'), head: c('--hdr'), onhead: '#ffffff', sig: c('--sig'), bg: c('--bg') };
    const tables = schema.tables.filter((t) => !t.view);
    if (!tables.length) { canvas.replaceChildren(el('p', { class: 'empty' }, 'V bazi ni tabel.')); return; }
    const ROW = 22;
    const HEAD = 30;
    const size = (t) => ({ w: Math.min(320, Math.max(170, 16 + 7.6 * Math.max(t.name.length + 2, ...t.columns.map((x) => x.name.length + x.type.length + 5)))), h: HEAD + ROW * t.columns.length + 8 });
    // order: the most connected first, then their neighbours, so linked tables sit close together
    const deg = new Map(tables.map((t) => [t.name, schema.fks.filter((f) => f.table === t.name || f.refTable === t.name).length]));
    const order = [];
    const seen = new Set();
    for (const t of [...tables].sort((a, b) => deg.get(b.name) - deg.get(a.name) || a.name.localeCompare(b.name))) {
      const queue = [t.name];
      while (queue.length) {
        const n = queue.shift();
        if (seen.has(n)) continue;
        seen.add(n);
        order.push(tables.find((x) => x.name === n));
        for (const f of schema.fks) {
          if (f.table === n && !seen.has(f.refTable) && tables.some((x) => x.name === f.refTable)) queue.push(f.refTable);
          if (f.refTable === n && !seen.has(f.table)) queue.push(f.table);
        }
      }
    }
    const perRow = Math.max(2, Math.ceil(Math.sqrt(order.length * 1.6)));
    const pos = new Map();
    let x = 30; let y = 30; let rowH = 0;
    order.forEach((t, i) => {
      const s = size(t);
      if (i && i % perRow === 0) { x = 30; y += rowH + 70; rowH = 0; }
      pos.set(t.name, { x, y, ...s });
      x += s.w + 90;
      rowH = Math.max(rowH, s.h);
    });
    const width = Math.max(...[...pos.values()].map((p) => p.x + p.w)) + 30;
    const height = Math.max(...[...pos.values()].map((p) => p.y + p.h)) + 30;
    erBox = { width, height };
    const svg = svgEl('svg', { xmlns: NS, viewBox: `0 0 ${width} ${height}`, width: Math.round(width * zoom), height: Math.round(height * zoom), role: 'img', 'aria-label': `ER diagram baze ${schema.database}`, 'font-family': 'IBM Plex Mono, Consolas, monospace', 'font-size': '13' });
    svg.append(svgEl('rect', { x: 0, y: 0, width, height, fill: col.bg }));
    const links = svgEl('g', { fill: 'none', stroke: col.acc, 'stroke-width': '1.6' });
    svg.append(links);
    const rowY = (t, cname) => {
      const p = pos.get(t);
      const i = tables.find((z) => z.name === t).columns.findIndex((z) => z.name === cname);
      return p.y + HEAD + ROW * Math.max(0, i) + ROW / 2 + 4;
    };
    const drawLinks = () => {
      links.replaceChildren();
      for (const f of schema.fks) {
        const a = pos.get(f.table); const b = pos.get(f.refTable);
        if (!a || !b) continue;
        const y1 = rowY(f.table, f.column); const y2 = rowY(f.refTable, f.refColumn);
        let x1; let x2; let d1; let d2;
        if (a === b) { x1 = a.x + a.w; x2 = a.x + a.w; d1 = 40; d2 = 40; }
        else if (a.x + a.w < b.x) { x1 = a.x + a.w; x2 = b.x; d1 = 1; d2 = -1; }
        else if (b.x + b.w < a.x) { x1 = a.x; x2 = b.x + b.w; d1 = -1; d2 = 1; }
        else { x1 = a.x + a.w; x2 = b.x + b.w; d1 = 1; d2 = 1; }
        const k = Math.max(40, Math.abs(x2 - x1) / 2);
        const path = a === b ? `M${x1},${y1} C${x1 + 50},${y1} ${x2 + 50},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + d1 * k},${y1} ${x2 + d2 * k},${y2} ${x2},${y2}`;
        links.append(svgEl('path', { d: path }), svgEl('circle', { cx: x2, cy: y2, r: 3.5, fill: col.acc }));
        links.lastChild.previousSibling.append(svgEl('title', {}, `${f.table}.${f.column} → ${f.refTable}.${f.refColumn}`));
      }
    };
    for (const t of order) {
      const p = pos.get(t.name);
      const g = svgEl('g', { transform: `translate(${p.x},${p.y})`, class: 'er-t', tabindex: '0' });
      g.append(
        svgEl('rect', { width: p.w, height: p.h, rx: 8, fill: col.card, stroke: col.line, 'stroke-width': 1.5 }),
        svgEl('path', { d: `M0,8 a8,8 0 0 1 8,-8 h${p.w - 16} a8,8 0 0 1 8,8 v${HEAD - 8} h-${p.w} z`, fill: col.head }),
        svgEl('text', { x: 12, y: 20, fill: col.onhead, 'font-weight': '700', 'font-family': 'Atkinson Hyperlegible, system-ui, sans-serif', 'font-size': '14' }, t.name));
      t.columns.forEach((cl, i) => {
        const yy = HEAD + ROW * i + ROW / 2 + 8;
        const fk = schema.fks.some((f) => f.table === t.name && f.column === cl.name);
        const mark = cl.key === 'PRI' ? '🔑' : fk ? '→' : '';
        g.append(svgEl('text', { x: 10, y: yy, fill: cl.key === 'PRI' ? col.sig : col.acc, 'font-size': '12' }, mark));
        g.append(svgEl('text', { x: 30, y: yy, fill: col.ink, 'font-weight': cl.key === 'PRI' ? '700' : '400', 'text-decoration': cl.key === 'PRI' ? 'underline' : 'none' }, cl.name));
        g.append(svgEl('text', { x: p.w - 10, y: yy, fill: col.mut, 'text-anchor': 'end', 'font-size': '11.5' }, cl.type.replace(/ unsigned/, ' uns.')));
      });
      // drag a card: the lines follow
      g.addEventListener('pointerdown', (e) => {
        g.setPointerCapture(e.pointerId);
        const sx = e.clientX; const sy = e.clientY; const ox = p.x; const oy = p.y;
        const move = (m) => { p.x = Math.max(0, ox + (m.clientX - sx) / zoom); p.y = Math.max(0, oy + (m.clientY - sy) / zoom); g.setAttribute('transform', `translate(${p.x},${p.y})`); drawLinks(); };
        const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); };
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', up);
      });
      svg.append(g);
    }
    drawLinks();
    canvas.replaceChildren(svg);
  }
  const setZoom = (z) => {
    zoom = Math.min(2.5, Math.max(0.3, z));
    const svg = canvas.querySelector('svg');
    if (svg && erBox) { svg.setAttribute('width', Math.round(erBox.width * zoom)); svg.setAttribute('height', Math.round(erBox.height * zoom)); }
  };
  $('sq-er-open').addEventListener('click', async () => {
    if (!schema) await loadSchema();
    er.showModal();
    zoom = 1;
    drawEr();
    if (erBox) setZoom(Math.min(1, (canvas.clientWidth - 10) / erBox.width));
  });
  $('sq-er-plus').addEventListener('click', () => setZoom(zoom * 1.2));
  $('sq-er-minus').addEventListener('click', () => setZoom(zoom / 1.2));
  $('sq-er-fit').addEventListener('click', () => erBox && setZoom(Math.min((canvas.clientWidth - 10) / erBox.width, (canvas.clientHeight - 10) / erBox.height)));
  $('sq-er-svg').addEventListener('click', () => {
    const svg = canvas.querySelector('svg');
    if (svg) download(`${schema.database}-er.svg`, new XMLSerializer().serializeToString(svg), 'image/svg+xml');
  });

  // A link from an exercise: /sql#koda=<base64url of the SQL>&baza=sola. The code is added below what is in the editor.
  function fromLink() {
    const link = new URLSearchParams(location.hash.slice(1));
    if (!link.has('koda')) return;
    try {
      const b64 = link.get('koda').replace(/-/g, '+').replace(/_/g, '/');
      const code = new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))).trim();
      const want = link.get('baza');
      if (want && [...db.options].some((o) => o.value === want && !o.disabled)) { db.value = want; showBanner(); }
      const now = ed.value.trim();
      ed.value = !now || Object.values(STARTER).some((x) => x.trim() === now) ? `${code}\n` : `${ed.value.replace(/\s+$/, '')}\n\n-- Iz vaje:\n${code}\n`;
      saveDraft();
    } catch { /* a broken link: the editor stays as it was */ }
    history.replaceState(null, '', location.pathname);
  }
  fromLink();
  window.addEventListener('hashchange', () => { fromLink(); loadSchema(); });
  loadSchema();
  ed.focus();
})();
