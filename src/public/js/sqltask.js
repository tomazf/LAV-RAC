// SQL pages: every button that creates, resets, deletes or tests something opens a window that says what the system will do,
// shows the progress step by step and ends with the result and its numbers. A form with data-task (JSON: title, lead, bullets,
// warn, danger, confirm) is sent here with the header X-Task: 1; the server answers with one JSON object per line.
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const secs = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('sl-SI', { maximumFractionDigits: 1 })} s`);
  const ICON = { run: '', ok: '✓', fail: '✕', skip: '–', wait: '' };
  const STATE = { run: 'poteka', ok: 'v redu', fail: 'napaka', skip: 'preskočeno' };

  const dlg = el('dialog', 'tk-dlg');
  dlg.setAttribute('aria-labelledby', 'tk-title');
  document.body.append(dlg);
  let running = false;
  dlg.addEventListener('cancel', (e) => { if (running) e.preventDefault(); }); // Escape does not stop the work
  dlg.addEventListener('click', (e) => { if (e.target === dlg && !running && dlg.dataset.phase !== 'done') dlg.close(); });

  const reset = (title) => {
    dlg.replaceChildren();
    const h = el('h2', '', title);
    h.id = 'tk-title';
    dlg.append(h);
    return h;
  };

  function confirm(form, spec, go) {
    reset(spec.title);
    dlg.dataset.phase = 'confirm';
    const pick = form.querySelector('select[name=predloga]');
    const fill = (s) => s.replace('{predloga}', pick ? pick.selectedOptions[0].textContent.trim() : '');
    if (spec.lead) dlg.append(el('p', 'tk-lead', fill(spec.lead)));
    if (spec.bullets?.length) {
      dlg.append(el('h3', '', 'Kaj bo naredil sistem'));
      const ul = el('ul', 'tk-list');
      for (const b of spec.bullets) ul.append(el('li', '', fill(b)));
      dlg.append(ul);
    }
    if (spec.warn) dlg.append(el('p', `tk-warn${spec.danger ? ' danger' : ''}`, spec.warn));
    const row = el('div', 'tk-actions');
    const no = el('button', 'btn ghost', 'Prekliči');
    no.type = 'button';
    no.addEventListener('click', () => dlg.close());
    const yes = el('button', `btn${spec.danger ? ' danger' : ''}`, spec.confirm || 'Nadaljuj');
    yes.type = 'button';
    yes.addEventListener('click', go);
    row.append(no, yes);
    dlg.append(row);
    if (!dlg.open) dlg.showModal();
    (spec.danger ? no : yes).focus();
  }

  const leave = (form, go) => {
    const url = new URL(location.href);
    url.searchParams.delete('sporocilo');
    url.searchParams.delete('napaka');
    url.searchParams.delete('uredi');
    const hash = form.dataset.hash !== undefined ? (form.dataset.hash ? `#${form.dataset.hash}` : '') : '';
    history.replaceState(null, '', go || `${url.pathname}${url.search}${hash}`);
    location.reload();
  };

  async function run(form, spec) {
    running = true;
    reset(spec.title);
    dlg.dataset.phase = 'run';
    const status = el('p', 'tk-status', 'Poteka …');
    status.setAttribute('role', 'status');
    const bar = el('progress', 'tk-bar');
    const list = el('ol', 'tk-steps');
    list.setAttribute('aria-live', 'polite');
    const note = el('p', 'dim small', 'Okna ne zapiraj in strani ne osveži, dokler se delo ne konča.');
    dlg.append(status, bar, list, note);
    const t0 = Date.now();
    let total = 0, finished = 0;
    const items = new Map();
    const tick = setInterval(() => { status.textContent = `Poteka … ${secs(Date.now() - t0)}`; }, 500);
    const paint = () => {
      if (total) { bar.max = total; bar.value = Math.min(finished, total); } else bar.removeAttribute('value');
    };
    paint();
    const put = (o) => {
      if (o.type === 'plan') { total = o.total; paint(); return; }
      if (o.type !== 'step') return;
      let li = items.get(o.id);
      if (!li) {
        li = el('li', 'tk-step');
        li.append(el('span', 'ic'), el('span', 'nm'), el('span', 'dt'), el('span', 'ms'));
        items.set(o.id, li);
        list.append(li);
        li.scrollIntoView({ block: 'nearest' });
      }
      li.dataset.state = o.state;
      if (o.name) li.querySelector('.nm').textContent = o.name;
      li.querySelector('.ic').textContent = ICON[o.state] || '';
      li.querySelector('.ic').setAttribute('title', STATE[o.state] || '');
      if (o.detail !== undefined) li.querySelector('.dt').textContent = o.detail;
      if (o.ms !== undefined) li.querySelector('.ms').textContent = secs(o.ms);
      if (o.state !== 'run') { finished += 1; paint(); }
    };
    let done = null;
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { 'X-Task': '1', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)), credentials: 'same-origin' });
      if (!(res.headers.get('Content-Type') || '').includes('ndjson')) {
        done = { ok: false, message: res.status === 403 ? 'Stran je potekla ali nimaš pravice za to dejanje. Osveži stran in poskusi znova.' : `Dejanje ni bilo izvedeno (napaka ${res.status}).`, stats: [], ms: Date.now() - t0 };
      } else {
        const rd = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done: end } = await rd.read();
          buf += dec.decode(value || new Uint8Array(), { stream: !end });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const ln of lines) if (ln.trim()) { const o = JSON.parse(ln); if (o.type === 'done') done = o; else put(o); }
          if (end) break;
        }
        if (buf.trim()) { const o = JSON.parse(buf); if (o.type === 'done') done = o; }
        if (!done) done = { ok: false, message: 'Povezava s portalom se je prekinila, preden se je delo končalo. Stanje preveri na strani.', stats: [], ms: Date.now() - t0 };
      }
    } catch {
      done = { ok: false, message: 'Portala ni bilo mogoče doseči. Preveri povezavo in stanje na strani.', stats: [], ms: Date.now() - t0 };
    }
    clearInterval(tick);
    running = false;
    for (const li of items.values()) if (li.dataset.state === 'run') { li.dataset.state = 'fail'; li.querySelector('.ic').textContent = ICON.fail; }
    finish(form, spec, done, list);
  }

  function finish(form, spec, d, list) {
    dlg.dataset.phase = 'done';
    dlg.querySelector('.tk-status')?.remove();
    dlg.querySelector('.tk-bar')?.remove();
    dlg.querySelector('.dim.small')?.remove();
    const h = dlg.querySelector('h2');
    h.textContent = `${spec.title}: ${d.ok ? 'končano' : 'ni uspelo'}`;
    const box = el('div', `tk-result ${d.ok ? 'ok' : 'bad'}`);
    box.setAttribute('role', d.ok ? 'status' : 'alert');
    box.append(el('strong', '', d.ok ? 'Rezultat: ' : 'Napaka: '), document.createTextNode(d.message));
    h.after(box);
    const stats = [['Trajanje', secs(d.ms ?? 0)], ...(d.stats || [])];
    const ok = [...list.children].filter((li) => li.dataset.state === 'ok').length;
    const bad = [...list.children].filter((li) => li.dataset.state === 'fail').length;
    if (list.children.length > 1) stats.splice(1, 0, ['Korakov', `${ok} v redu${bad ? `, ${bad} z napako` : ''}`]);
    const dl = el('dl', 'tk-stats');
    for (const [k, v] of stats) { const w = el('div'); w.append(el('dt', '', k), el('dd', '', String(v))); dl.append(w); }
    list.before(dl);
    if (d.extra?.pass) {
      const c = el('div', 'tk-cred');
      c.append(el('p', '', `Povej to dijaku (${d.extra.name}). Geslo se prikaže samo zdaj; dijak ga vedno vidi v svojem peskovniku.`));
      const cd = el('dl', 'cred');
      const a = el('div'); a.append(el('dt', '', 'Uporabnik'), el('dd', '', d.extra.user));
      const b = el('div'); b.append(el('dt', '', 'Geslo'), el('dd', 'big-code', d.extra.pass));
      cd.append(a, b);
      c.append(cd);
      dlg.insertBefore(c, list);
    }
    const row = el('div', 'tk-actions');
    const close = el('button', 'btn', 'Zapri');
    close.type = 'button';
    close.addEventListener('click', () => dlg.close());
    row.append(close);
    dlg.append(row);
    dlg.addEventListener('close', () => leave(form, d.go), { once: true });
    close.focus();
  }

  for (const form of document.querySelectorAll('form[data-task]')) {
    let spec;
    try { spec = JSON.parse(form.dataset.task); } catch { continue; }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      confirm(form, spec, () => run(form, spec));
    });
  }
  document.documentElement.dataset.tk = 'ready'; // the buttons are wired (tests wait for it)
})();
