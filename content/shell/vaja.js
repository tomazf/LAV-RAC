// LAV-RAČ exercise shell. The importer puts it into every exercise, before the exercise's own code.
// The artifact keeps its content and answer checks; the shell owns the layout, the paging, the gate
// before the tasks, and the scoring state in the portal's format ({ t: { <index>: { d, p, h, sol } }, seen }).
// Rules are the portal's: one answer per task, a hint halves the points, the solution gives 0 points.
// A task marked self (»Sam preveri«) has no points: the student runs the work elsewhere, compares it with the known
// results and ticks »Preveril sem«. The solution may be opened without locking anything.
(function () {
  'use strict';
  const B = window.__LAVELS || null;
  const KEY = B ? B.key : 'lavrac_local_' + location.pathname;
  const STAFF = !!(B && B.staff);
  const TASKS = [];            // index -> { id, max, src }
  const byId = new Map();      // artifact task id -> index
  const cards = new Map();     // index -> card element
  const notes = new Map();     // index -> why the answer was wrong (only until the page is reloaded)
  let state = read();
  let savedAt = state.at;      // the position that went to the server with the last save
  let cfg = null;
  let quiet = false;           // true while the shell itself opens a solution at the start: nothing is recorded
  let pages = [];              // every page in order: { id, kind, title, group, el, set }
  let gate = [];               // theory page ids that open the tasks
  let resetBox = null;         // the »Ponastavi vajo« button with its confirmation; mount() puts it in the left column (or on the overview page on a phone)
  const setPos = new Map();    // set id -> shown task position

  function read() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!s.t || typeof s.t !== 'object') s.t = {};
    if (!Array.isArray(s.seen)) s.seen = [];
    return s;
  }
  function persist() {
    savedAt = state.at;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* the tracker shows saving problems */ }
  }
  // Moving between pages is not saved (every save shows »Shranjujem …« and goes to the server): the position rides along with the next real change
  // (an answer, a first view of a theory page) or is saved when the student leaves the exercise.
  function leave() { if (state.at !== savedAt) persist(); }
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); }, true);
  window.addEventListener('pagehide', leave);
  const rec = (i) => state.t[i] || (state.t[i] = {});
  const half = (n) => Math.round(n * 50) / 100;

  // ---------- task state ----------
  function status(i) {
    const r = state.t[i] || {};
    if (!r.d) return r.h ? 'hinted' : 'open';
    if (TASKS[i] && TASKS[i].self) return 'self';
    if (r.sol) return 'seen';
    if (r.p > 0) return r.f === false ? 'part' : r.h ? 'half' : 'ok';
    return 'bad';
  }
  const pts = (n) => {
    const s = String(n).replace('.', ',');
    if (n === 1) return '1 točka';
    if (n === 2) return '2 točki';
    if (n === 3 || n === 4) return s + ' točke';
    if (!Number.isInteger(n)) return s + ' točke';
    return s + ' točk';
  };
  const MESSAGE = {
    ok: (r) => 'Pravilno: ' + pts(r.p) + '.',
    half: (r) => 'Pravilno z namigom: ' + pts(r.p) + '.',
    part: (r) => 'Delno pravilno: ' + pts(r.p) + (r.po ? ' (pravilno ' + r.pr + ' od ' + r.po + ')' : '') + (r.h ? ', z namigom' : '') + '.',
    bad: (r, note) => 'Napačno: 0 točk.' + (note ? ' ' + note : '') + ' Naloga je zaklenjena, rešitev si lahko ogledaš.',
    seen: () => 'Rešitev prikazana: 0 točk. Naloga je zaklenjena.',
    self: () => 'Označeno: sam si preveril delovanje. Naloga nima točk.',
  };
  const LABEL = { ok: 'Pravilno', half: 'Pravilno z namigom', part: 'Delno pravilno', bad: 'Napačno', seen: 'Rešitev ogledana', self: 'Sam preveril' };

  function totals() {
    const r = { ok: 0, half: 0, part: 0, bad: 0, seen: 0, self: 0, done: 0, points: 0, max: 0, n: TASKS.length };
    TASKS.forEach((t, i) => {
      const s = status(i);
      r.max += t.max;
      if (r[s] !== undefined) { r[s]++; r.done++; }
      r.points += (state.t[i] && state.t[i].d && Number(state.t[i].p)) || 0;
    });
    r.points = Math.round(r.points * 100) / 100;
    return r;
  }

  // ---------- calls from the artifact ----------
  const api = {
    // list: the artifact's tasks in the order they are shown; level(t) gives 1, 2 or 3 for the teacher's list.
    // A self task has no points (max 0); its pts only say how hard it is.
    tasks(list, opts) {
      const level = (opts && opts.level) || ((t) => t.lv);
      list.forEach((t, i) => { t.idx = i; TASKS.push({ id: t.id, max: t.self ? 0 : Number(t.pts) || 1, self: !!t.self, task: t, level: level(t) }); byId.set(t.id, i); });
    },
    // Before the tasks are numbered: the teacher's task names (set letter and the place in the artifact's own list,
    // e.g. »C9«) get their options, and removed tasks leave the list. The names are read before anything is removed,
    // so they keep the numbers the teacher sees in the artifact. A name that does not exist stops the import.
    //   self: no points, ticked by the student   nobtn: no »Kopiraj kodo« / »Odpri Programiz«
    //   inline: the blanks (___) are typed in the code (same: all as wide as the widest)   cols: the blanks in two columns
    //   list: lines »- …« of the question become bullets   example: the solution is open from the start   remove: leave the list
    //   exact: the printed output is compared with the letter case and the spaces kept (otherwise both are ignored)
    prepare(list, levels, o) {
      const ref = new Map();
      levels.forEach((L) => list.filter((t) => t.lv === L.tag).forEach((t, k) => ref.set(L.tag + (k + 1), t)));
      const get = (r) => { const t = ref.get(r); if (!t) throw new Error('LavRac.prepare: no task ' + r); return t; };
      ['self', 'nobtn', 'inline', 'same', 'cols', 'list', 'example', 'exact'].forEach((flag) => (o[flag] || []).forEach((r) => { get(r)[flag] = true; }));
      (o.remove || []).map(get).forEach((t) => { list.splice(list.indexOf(t), 1); });
    },
    // The artifact's own memory of what was typed and how many hints are open.
    loadUi() {
      const S = {};
      TASKS.forEach((t, i) => {
        const r = state.t[i];
        if (!r) return;
        const s = {};
        if (r.a !== undefined) s.v = r.a;
        if (r.n !== undefined) s.h = r.n;
        S[t.id] = s;
      });
      return S;
    },
    saveUi(S) {
      let changed = false;
      Object.keys(S).forEach((id) => {
        const i = byId.get(id);
        if (i === undefined) return;
        const s = S[id] || {};
        if (!state.t[i] && s.v === undefined && s.h === undefined) return;
        const r = rec(i);
        if (r.d) return;
        if (JSON.stringify(r.a) !== JSON.stringify(s.v)) { r.a = s.v; changed = true; }
        if (s.h !== undefined && r.n !== s.h) { r.n = s.h; changed = true; }
      });
      if (changed) persist();
    },
    // note: the artifact's explanation of a wrong answer, shown with the result.
    // part: { right, of } for a task with several parts, when some are right and some wrong (agreed 16. 11. 2026): the points
    // are the share of the right parts, in halves of a point, rounded down; with a hint half of that. All right is ok.
    answered(i, ok, note, part) {
      const r = rec(i);
      if (r.d) return;
      notes.set(i, ok ? '' : String(note || '').trim());
      const max = TASKS[i].max;
      r.d = true;
      if (ok) r.p = r.h ? half(max) : max;
      else {
        const of = part && Number(part.of) > 1 ? Number(part.of) : 0;
        const right = of ? Math.min(Math.max(Math.floor(Number(part.right)) || 0, 0), of - 1) : 0;
        const earned = of ? (max * right / of) / (r.h ? 2 : 1) : 0;
        r.p = Math.floor(earned * 2 + 1e-9) / 2;
        if (r.p > 0) { r.f = false; r.pr = right; r.po = of; }
      }
      persist();
      paintTask(i, true);
      paintProgress();
    },
    hinted(i) {
      const r = rec(i);
      if (r.d || r.h) return;
      r.h = true;
      persist();
      paintTask(i);
    },
    // »Preveril sem«: the student ticks a self task. No points, and nothing about it can be wrong.
    checked(i) {
      const r = rec(i);
      if (r.d || !TASKS[i].self) return;
      r.d = true; r.p = 0;
      persist();
      paintTask(i, true);
      paintProgress();
    },
    solution(i) {
      const r = rec(i);
      // Looking at the solution of a self task costs nothing and locks nothing.
      if (quiet) return;
      if (r.d || TASKS[i].self) { if (!r.v) { r.v = true; persist(); } return; }
      r.d = true; r.p = 0; r.sol = true;
      persist();
      paintTask(i, true);
      paintProgress();
    },
    status,
    mount,
    catalog,
  };
  window.LavRac = api;

  // ---------- small builders ----------
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((k) => { if (k !== null && k !== undefined && k !== false) el.append(k); });
    return el;
  };
  const ICON = {
    vaje: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="6" width="30" height="36" rx="4"/><path d="M15 17l3 3 6-6M15 29l3 3 6-6M28 17h6M28 29h6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    home: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 22L24 9l16 13M13 19v20h22V19"/><path d="M20 39V28h8v11"/></svg>',
  };

  // ---------- layout ----------
  function mount(c) {
    cfg = c;
    const old = document.querySelector(c.root || '.wrap');
    const groups = c.groups.map((g) => ({ ...g, pages: g.pages.map((p) => ({ ...p, kind: 'theory', group: g })) }));
    const theory = groups.flatMap((g) => g.pages);
    gate = theory.map((p) => p.id);
    const sets = c.sets.map((s) => ({ ...s, kind: 'set' }));
    // Za doma follows the last set in the alphabet; the importer checks that the letters have no gap.
    if (c.extra) c.extra.tag = nextTag(sets);
    pages = [{ id: 'pregled', kind: 'overview', title: 'Pregled' }, ...theory, ...sets];
    if (c.extra) pages.push({ ...c.extra, kind: 'extra' });
    if (STAFF) { gate.concat(c.extra ? [c.extra.id] : []).forEach((id) => { if (!state.seen.includes(id)) state.seen.push(id); }); }

    const main = h('main', { class: 'lr-main', id: 'lrMain' });
    const top = buildTop(c);
    const rail = buildRail(groups, sets, c);
    main.append(buildMobileNav());
    pages.forEach((p) => {
      // The page gets the artifact's id; the artifact's own element keeps a different one, so ids stay unique.
      if (p.el && p.el.id === p.id) p.el.id = 'src-' + p.id;
      p.page = h('div', { class: 'page lr-page lr-' + p.kind, id: p.id, 'data-chapter': p.kind === 'theory' || p.kind === 'overview' ? 'Teorija' : 'Naloge' });
      if (p.kind === 'overview') buildOverview(p, groups, sets, c);
      if (p.kind === 'theory') buildTheory(p, theory);
      if (p.kind === 'set') buildSet(p, c);
      if (p.kind === 'extra') buildExtra(p);
      if (p.kind !== 'set') p.page.append(buildPager(p));
      main.append(p.page);
    });
    // One button with one set of ids: in the left column, and on the overview page when the column is hidden (a phone).
    const phone = window.matchMedia('(max-width:900px)');
    const placeReset = () => {
      if (!phone.matches) { rail.append(resetBox); return; }
      const ov = pages[0].page;
      ov.insertBefore(resetBox, ov.querySelector('.lr-pager'));
    };
    placeReset();
    if (phone.addEventListener) phone.addEventListener('change', placeReset);
    const lr = h('div', { class: 'lr' }, top, h('div', { class: 'lr-body' }, rail, main));
    if (old) old.replaceWith(lr); else document.body.append(lr);
    TASKS.forEach((_, i) => paintTask(i));
    paintProgress();
    window.addEventListener('hashchange', route);
    route();
    // The browser jumps to the element named in the address once the page has loaded; start at the top instead.
    window.addEventListener('load', () => setTimeout(() => window.scrollTo(0, 0), 0));
  }

  function buildTop(c) {
    const bar = h('div', { class: 'lr-stack', 'aria-hidden': 'true' }, ...['ok', 'half', 'part', 'bad', 'seen', 'self'].map((k) => h('i', { class: 'lr-' + k })));
    const reset = h('div', { class: 'lr-reset', id: 'lrReset' });
    const idle = () => {
      reset.replaceChildren(h('button', { type: 'button', class: 'lr-btn lr-ghost', id: 'resetBtn', text: 'Ponastavi vajo' }));
      reset.firstChild.addEventListener('click', ask);
    };
    const ask = () => {
      const yes = h('button', { type: 'button', class: 'lr-btn lr-danger', id: 'resetYes', text: 'Da, ponastavi' });
      const no = h('button', { type: 'button', class: 'lr-btn lr-ghost', text: 'Prekliči' });
      reset.replaceChildren(h('span', { class: 'lr-confirm', role: 'alert' },
        h('span', { text: 'Res ponastavim vajo? Vsi odgovori se izbrišejo. Dokler ne odgovoriš na novo nalogo, štejejo prejšnje točke.' }), yes, no));
      yes.addEventListener('click', doReset);
      no.addEventListener('click', idle);
      no.focus();
    };
    idle();
    resetBox = reset;
    // The title, progress and search sit in the middle; the portal's tracker adds »Vse vaje« before them and »Odjava« after them,
    // so those two stay at the edges of the page, away from the content. The reset button is in the left column (12. 11. 2026).
    return h('div', { class: 'lr-top' }, h('div', { class: 'lr-top-in' },
      h('div', { class: 'lr-top-mid' },
        h('div', { class: 'lr-name' }, h('b', { text: c.title, title: c.title }), c.kicker ? h('span', { text: c.kicker }) : null),
        h('div', { class: 'lr-prog', role: 'status' }, h('div', { class: 'lr-ptxt', id: 'lrPtxt' }), bar),
        buildSearch())));
  }
  function doReset() {
    state = { t: {}, seen: state.seen.slice() };
    persist();
    const pending = B ? 'lavels_pending_' + B.uid + '_' + B.id : null;
    let waited = 0;
    const done = () => { history.replaceState(null, '', '#pregled'); location.reload(); };
    if (!pending) return done();
    const wait = () => {
      waited += 150;
      let left = null;
      try { left = localStorage.getItem(pending); } catch (e) { left = null; }
      if (!left || waited > 5000) done(); else setTimeout(wait, 150);
    };
    setTimeout(wait, 150);
  }

  // The letter after the last set's letter ('' gives A).
  const nextTag = (sets) => (sets.length ? String.fromCharCode(String(sets[sets.length - 1].tag).charCodeAt(0) + 1) : 'A');
  const setLabel = (p) => p.tag + ' · ' + p.title;
  function buildRail(groups, sets, c) {
    const nav = h('nav', { class: 'lr-rail', 'aria-label': 'Vsebina vaje' });
    // The tag column (»3 ·«, »B ·«) is as wide as the longest number, so every text starts at the same place
    // and a wrapped line hangs under the text, not under the tag.
    nav.style.setProperty('--lr-tgd', String(String(groups.reduce((a, g) => a + g.pages.length, 0)).length));
    const lab = (tag, text) => h('span', { class: 'lr-lab' }, h('span', { class: 'lr-tg', text: tag + ' ·' }), h('span', { class: 'lr-tx', text }));
    nav.append(h('a', { class: 'lr-ov', href: '#pregled', 'data-page': 'pregled', text: 'Pregled' }));
    let n = 0;
    groups.forEach((g) => {
      nav.append(h('div', { class: 'lr-grp' }, h('span', { class: 'lr-gi', html: g.icon || '' }), h('b', { text: g.title }), h('small', { class: 'lr-gc', 'data-gc': g.id })));
      g.pages.forEach((p) => {
        n++;
        nav.append(h('a', { href: '#' + p.id, 'data-page': p.id, class: 'lr-pg' }, h('i', { class: 'lr-dot', html: ICON.check }), lab(n, p.title)));
      });
    });
    nav.append(h('div', { class: 'lr-grp lr-vaje' }, h('span', { class: 'lr-gi', html: ICON.vaje }), h('b', { text: 'Vaje' }), h('span', { class: 'lr-lock', html: ICON.lock, title: 'Odklene se, ko pregledaš vse razlage' })));
    // A set shows its state as a small pie in the task colours (paintProgress); Za doma gets a tick once it is opened.
    sets.forEach((s) => nav.append(h('a', { href: '#' + s.id, 'data-page': s.id, class: 'lr-pg lr-gated' },
      h('i', { class: 'lr-pie', 'data-pie': s.id, 'aria-hidden': 'true' }), lab(s.tag, s.title), h('small', { class: 'lr-cnt', 'data-cnt': s.id }))));
    if (c.extra) nav.append(h('a', { href: '#' + c.extra.id, 'data-page': c.extra.id, class: 'lr-pg lr-gated' }, h('i', { class: 'lr-dot', html: ICON.check }), lab(c.extra.tag, c.extra.title)));
    // c.tools() gives a fresh element each time, so the rail and the phone list each get their own copy.
    if (c.tools) nav.append(h('div', { class: 'lr-tools' }, c.tools()));
    return nav;
  }
  function buildMobileNav() {
    const sel = h('select', { id: 'lrSel', 'aria-label': 'Stran' });
    let grp = null;
    pages.forEach((p) => {
      const label = p.kind === 'theory' ? p.group.title : p.kind === 'overview' ? null : 'Vaje';
      if (label && (!grp || grp.label !== label)) { grp = h('optgroup', { label }); sel.append(grp); }
      const o = h('option', { value: p.id, text: p.kind === 'set' || p.kind === 'extra' ? setLabel(p) : p.title });
      (label ? grp : sel).append(o);
    });
    sel.addEventListener('change', () => { location.hash = sel.value; });
    const box = h('div', { class: 'lr-mnav' }, h('label', { class: 'lr-msel' }, h('span', { text: 'Stran' }), sel));
    if (cfg.tools) box.append(h('div', { class: 'lr-tools' }, cfg.tools()));
    return box;
  }

  function buildOverview(p, groups, sets, c) {
    const hero = h('section', { class: 'lr-hero' }, h('h1', { text: c.title }));
    if (c.lead) hero.append(h('p', { class: 'lr-lead', text: c.lead }));
    if (c.hero) hero.append(c.hero);
    p.page.append(hero);
    p.page.append(h('div', { class: 'lr-resume', id: 'lrResume', hidden: true }));
    const grid = h('div', { class: 'lr-tiles' });
    groups.forEach((g) => {
      const list = h('ul', {}, ...g.pages.map((x) => h('li', { text: x.title })));
      grid.append(h('a', { class: 'lr-tile', href: '#' + g.pages[0].id, 'data-tile': g.id },
        h('span', { class: 'lr-ti', html: g.icon || '' }),
        h('span', { class: 'lr-tt', text: g.title }),
        h('span', { class: 'lr-td', text: g.pages.length === 1 ? '1 razlaga' : g.pages.length + (g.pages.length < 5 ? ' razlage' : ' razlag') }),
        list,
        h('span', { class: 'lr-tf', 'data-tf': g.id })));
    });
    const setList = h('ul', {}, ...sets.map((s) => h('li', { text: s.tag + ' · ' + s.title + ' (' + s.tasks.length + ')' })));
    if (c.extra) setList.append(h('li', { text: setLabel(c.extra) }));
    grid.append(h('a', { class: 'lr-tile lr-tile-vaje', href: '#' + sets[0].id, 'data-tile': 'vaje' },
      h('span', { class: 'lr-ti', html: ICON.vaje }),
      h('span', { class: 'lr-tt', text: 'Vaje' }),
      h('span', { class: 'lr-td', text: TASKS.length + ' nalog v ' + sets.length + (sets.length < 5 ? ' sklopih' : ' sklopih') }),
      setList,
      h('span', { class: 'lr-tf', 'data-tf': 'vaje' })));
    p.page.append(grid);
    const rules = h('div', { class: 'lr-rules' },
      h('h2', { text: 'Kako poteka' }),
      h('ol', {},
        h('li', { text: 'Najprej preglej vse razlage. Vaje se odklenejo, ko odpreš vsako stran razlage.' }),
        h('li', { text: 'Pri vsaki nalogi oddaš en odgovor. Pravilen odgovor prinese vse točke, napačen 0 točk. Pri nalogi z več deli (več vrzeli, trditev ali izbir) dobiš točke po deležu pravilnih delov, zaokroženo navzdol na pol točke.' }),
        h('li', { text: 'Namig odbije polovico točk naloge. Ogled rešitve prinese 0 točk in nalogo zaklene.' }),
        TASKS.some((t) => t.self) ? h('li', { text: 'Naloge z oznako »Sam preveri« nimajo točk: rešitev narediš sam, jo preizkusiš in nalogo označiš s »Preveril sem« (pri programih s »Shrani in končaj«). Rešitev si lahko ogledaš brez posledic.' }) : null,
        h('li', { text: 'Napredek se shranjuje v tvoj račun, zato lahko nadaljuješ na katerem koli računalniku.' })));
    if (c.vajeNote) rules.append(h('p', { class: 'lr-just', html: c.vajeNote }));
    p.page.append(rules);
    if (c.source) p.page.append(h('p', { class: 'lr-src', text: c.source }));
  }

  function phead(p, theory) {
    const k = theory.indexOf(p);
    const dash = h('span', { class: 'lr-dash', 'aria-hidden': 'true' }, ...theory.map((x, j) => h('i', { class: j <= k ? 'on' : '' })));
    return h('div', { class: 'lr-phead' },
      h('span', { class: 'lr-pgrp' }, h('span', { class: 'lr-gi', html: p.group.icon || '' }), h('span', { text: p.group.title })),
      h('span', { class: 'lr-count', text: 'Razlaga ' + (k + 1) + ' / ' + theory.length }),
      dash);
  }
  function buildTheory(p, theory) {
    p.page.append(phead(p, theory));
    const el = p.el;
    el.hidden = false;
    const eyebrow = el.querySelector(':scope > .eyebrow');
    if (eyebrow) eyebrow.remove();
    p.page.append(el);
  }

  function buildSet(p, c) {
    const s = p;
    const head = h('header', { class: 'lr-shead' },
      h('span', { class: 'lr-gi', html: ICON.vaje }),
      h('div', {}, h('span', { class: 'lr-kick', text: 'Vaje · sklop ' + s.tag }), h('h2', { text: s.title }), s.note ? h('p', { class: 'lr-just', text: s.note }) : null));
    const nums = h('div', { class: 'lr-nums', role: 'group', 'aria-label': 'Naloge v sklopu ' + s.title });
    s.tasks.forEach((t, k) => {
      const b = h('button', { type: 'button', class: 'lr-num', 'data-k': k, 'data-i': t.idx, text: String(k + 1) });
      b.addEventListener('click', () => { location.hash = s.id + '/' + (k + 1); });
      nums.append(b);
    });
    // A set of self tasks has only that state in its legend; a mixed set has both.
    const allSelf = s.tasks.every((t) => TASKS[t.idx].self), anySelf = s.tasks.some((t) => TASKS[t.idx].self);
    const legend = h('div', { class: 'lr-legend' },
      ...[...(allSelf ? [] : [['ok', 'pravilno'], ['half', 'pravilno z namigom (50 %)'], ['part', 'delno pravilno'], ['bad', 'napačno'], ['seen', 'ogledana rešitev (0 točk)']]), ...(anySelf ? [['self', 'sam preveril (brez točk)']] : [])]
        .map(([k, t]) => h('span', {}, h('i', { class: 'lr-sw lr-' + k }), t)));
    const board = h('div', { class: 'lr-board' },
      h('div', { class: 'lr-bh' }, h('b', { text: s.title }), h('span', { class: 'lr-done', 'data-done': s.id })),
      nums, legend);
    const list = h('div', { class: 'lr-cardlist' });
    s.tasks.forEach((t, k) => {
      const card = t.el;
      cards.set(t.idx, card);
      prepareCard(card, t.idx, k, s.tasks.length, c.sel);
      list.append(card);
    });
    const prev = h('button', { type: 'button', class: 'lr-btn lr-ghost lr-prev', text: '‹ Prejšnja naloga' });
    const next = h('button', { type: 'button', class: 'lr-btn lr-ghost lr-next', text: 'Naslednja naloga ›' });
    prev.addEventListener('click', () => step(s, -1));
    next.addEventListener('click', () => step(s, 1));
    const tpager = h('nav', { class: 'lr-tpager', 'aria-label': 'Listanje po nalogah' }, prev, next);
    const body = h('div', { class: 'lr-setbody' }, board, list, tpager);
    const locked = h('div', { class: 'lr-locked', role: 'note' });
    s.page.append(head, locked, body, buildPager(s));
    if (s.el) s.el.remove();
  }
  // Long task statements can carry light markup: **bold** words, one paragraph per line, lines starting with "- " as a list.
  // Only statements that contain ** are rebuilt; the markers are not part of the text the importer stores.
  function formatQ(q) {
    if (q.children.length || !/\*\*/.test(q.textContent)) return;
    const box = h('div', { class: q.className + ' lr-qf' });
    const inline = (parent, text) => text.split(/\*\*(.+?)\*\*/).forEach((part, j) => { if (part) parent.append(j % 2 ? h('strong', null, part) : part); });
    let ul = null;
    q.textContent.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
      if (/^- /.test(line)) {
        if (!ul) { ul = h('ul'); box.append(ul); }
        const li = h('li'); inline(li, line.slice(2)); ul.append(li);
        return;
      }
      ul = null;
      const p = h('p'); inline(p, line); box.append(p);
    });
    q.replaceWith(box);
  }

  function prepareCard(card, i, k, n, sel) {
    const task = TASKS[i].task;
    card.querySelectorAll('.qtext').forEach(formatQ);
    card.hidden = false;
    card.id = 't' + i;
    card.classList.add('lr-task');
    if (task.self) card.dataset.self = task.type;
    const head = card.querySelector(sel.head);
    if (head) {
      head.classList.add('crumb');
      const num = head.querySelector(sel.num);
      if (num) num.textContent = 'Naloga ' + (k + 1) + ' od ' + n;
      const tags = head.querySelector(sel.tags);
      if (tags) {
        tags.classList.add('lv');
        tags.prepend(h('span', { class: 'tag lr-st', hidden: true }));
        // The points tag is the only one that names points: a self task has none.
        if (task.self) tags.querySelectorAll('.tag:not(.lr-st)').forEach((t) => { if (/točk/.test(t.textContent)) t.textContent = 'Sam preveri · brez točk'; });
        if (task.example) tags.append(h('span', { class: 'tag', text: 'Rešen primer' }));
      }
    }
    const q = card.querySelector(sel.q);
    if (q) q.classList.add('lr-q');
    if (q) shapeTask(card, q, task);
    let check = card.querySelector(sel.check);
    if (task.self && check) {
      // The artifact's own check goes away with its listener; ticking is the shell's.
      const tick = check.cloneNode(false);
      // A program is saved as it is typed; the button saves it once more and ends the task (agreed 18. 11. 2026).
      tick.textContent = task.type === 'code' ? 'Shrani in končaj' : 'Preveril sem';
      tick.addEventListener('click', () => api.checked(i));
      check.replaceWith(tick);
      check = tick;
    }
    const hint = card.querySelector(sel.hint);
    const sol = card.querySelector(sel.sol);
    const fb = card.querySelector(sel.fb);
    if (check) check.classList.add('lr-check');
    if (hint) hint.classList.add('lr-hint');
    if (sol) sol.classList.add('lr-sol');
    // The artifact rewrites the feedback's classes, so the shell keeps its own reference.
    if (fb) { fb.classList.add('lr-fb'); card.lrFb = fb; }
    const actions = card.querySelector(sel.actions);
    if (actions) {
      actions.classList.add('lr-actions');
      const left = h('div', { class: 'lr-left' });
      const right = h('div', { class: 'lr-right' });
      const extra = sel.extra ? [...card.querySelectorAll(sel.extra)] : [];
      extra.forEach((x) => x.classList.add('lr-extra'));
      [...extra, check, fb].forEach((x) => x && left.append(x));
      [hint, sol].forEach((x) => x && right.append(x));
      actions.prepend(left, right);
      const ask = h('div', { class: 'lr-solask', hidden: true, role: 'alert' });
      actions.after(ask);
      if (sol) {
        sol.addEventListener('click', (e) => {
          if (task.self || (status(i) !== 'open' && status(i) !== 'hinted')) return;
          if (card.dataset.solOk) return;
          e.stopImmediatePropagation();
          e.preventDefault();
          const yes = h('button', { type: 'button', class: 'lr-btn lr-danger', text: 'Prikaži rešitev' });
          const no = h('button', { type: 'button', class: 'lr-btn lr-ghost', text: 'Prekliči' });
          ask.replaceChildren(h('span', { text: 'Ogled rešitve prinese 0 točk in nalogo zaklene.' }), yes, no);
          ask.hidden = false;
          yes.addEventListener('click', () => { ask.hidden = true; card.dataset.solOk = '1'; sol.click(); });
          no.addEventListener('click', () => { ask.hidden = true; sol.focus(); });
          no.focus();
        }, true);
        if (task.example) { quiet = true; sol.click(); quiet = false; }
      }
    }
  }

  // The options of a task (LavRac.prepare) shape the artifact's card.
  function shapeTask(card, q, task) {
    // The window for the code grows with the code (agreed 18. 11. 2026): the lines it has plus a few to write in, so the student
    // does not scroll all the time; it stops at 32 lines and can still be pulled taller by hand.
    const editor = q.querySelector('textarea.editor');
    if (editor) {
      const fit = () => { editor.rows = Math.min(32, Math.max(9, editor.value.split('\n').length + 3)); };
      fit();
      editor.addEventListener('input', fit);
      q.querySelectorAll('.js-restore').forEach((b) => b.addEventListener('click', () => setTimeout(fit, 0)));
    }
    if (task.nobtn) {
      q.querySelectorAll('.js-copy, a[href*="programiz"]').forEach((x) => x.remove());
      q.querySelectorAll('.actions').forEach((a) => { if (!a.children.length) a.remove(); });
    }
    if (task.self && task.type === 'code') {
      // The program is written elsewhere and the answer is already told: there is no output to type.
      const out = q.querySelector('[id^="o-"]');
      if (out) (out.closest('.blank') || out).remove();
      const bar = q.querySelector('.editorbar span');
      if (bar) bar.textContent = 'Program zaženi v poljubnem okolju (Eclipse, VS Code, Programiz …) in primerjaj njegov izpis s pričakovanim. V Programizu razred preimenuj v Main. Kodo lahko shraniš tu.';
      // An output the artifact keeps hidden (it checked the typed output) is what the student compares with now.
      if (task.hideExp && task.expected != null && task.expected !== '') {
        const box = h('div', { class: 'lr-tests' }, h('b', { text: 'Pravilen izpis za preverjanje' }), h('pre', { class: 'code', text: String([].concat(task.expected)[0]) }));
        const row = q.querySelector(':scope > .blank');
        if (row) row.before(box); else q.append(box);
      }
    }
    if (task.self && task.type === 'blanks') {
      // No inputs: the known results are what the student compares with.
      const rows = [...q.querySelectorAll(':scope > .blank')];
      if (rows.length) {
        const text = (b) => String(Array.isArray(b.acc) ? b.acc[0] : b.acc);
        const box = h('div', { class: 'lr-tests' }, h('b', { text: 'Pravilni rezultati za preverjanje' }),
          h('ul', {}, ...task.b.map((b) => h('li', {}, b.l + ': ', h('code', { text: text(b) })))));
        rows[0].before(box);
        rows.forEach((r) => r.remove());
      }
    }
    if (task.cols) {
      const rows = [...q.querySelectorAll(':scope > .blank')];
      if (rows.length) { const g = h('div', { class: 'lr-cols' }); rows[0].before(g); rows.forEach((r) => g.append(r)); }
    }
    if (task.inline) gapFill(q, task);
    if (task.list) {
      const p = q.querySelector(':scope > p');
      if (p) {
        const out = [];
        let ul = null;
        p.textContent.split('\n').forEach((line) => {
          if (line.startsWith('- ')) { if (!ul) { ul = h('ul', { class: 'lr-bul' }); out.push(ul); } ul.append(h('li', { text: line.slice(2) })); }
          else { ul = null; out.push(h('p', { text: line })); }
        });
        p.replaceWith(...out);
      }
    }
  }
  // The blanks (___) of a code snippet become inputs in the code itself; the artifact still finds them by their ids.
  function gapFill(q, task) {
    const pre = q.querySelector('pre.code');
    const rows = [...q.querySelectorAll(':scope > .blank')];
    const inputs = rows.map((r) => r.querySelector('input'));
    if (!pre || !inputs.length || inputs.some((x) => !x)) throw new Error('inline: no code or blanks in ' + task.id);
    let k = 0;
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!n.nodeValue.includes('___')) return;
      const frag = document.createDocumentFragment();
      n.nodeValue.split('___').forEach((part, j) => {
        if (j) {
          const inp = inputs[k], b = task.b[k];
          k++;
          if (!inp) throw new Error('inline: more gaps than blanks in ' + task.id);
          inp.classList.add('lr-gap');
          inp.placeholder = String(k);
          inp.setAttribute('aria-label', 'Vrzel ' + k + ': ' + b.l);
          inp.title = b.l;
          const len = Math.max(...(task.same ? task.b : [b]).flatMap((x) => [].concat(x.acc).map((a) => String(a).length)));
          inp.style.width = Math.max(3, len + 2) + 'ch';
          frag.append(inp);
        }
        if (part) frag.append(part);
      });
      n.replaceWith(frag);
    });
    if (k !== inputs.length) throw new Error('inline: ' + k + ' gaps for ' + inputs.length + ' blanks in ' + task.id);
    rows.forEach((r) => r.remove());
  }
  function buildExtra(p) {
    p.page.append(h('header', { class: 'lr-shead' }, h('span', { class: 'lr-gi', html: ICON.home }),
      h('div', {}, h('span', { class: 'lr-kick', text: 'Vaje · sklop ' + p.tag }), h('h2', { text: p.title }), p.note ? h('p', { class: 'lr-just', text: p.note }) : null)));
    p.page.append(h('div', { class: 'lr-locked', role: 'note' }));
    const el = p.el;
    el.hidden = false;
    el.querySelectorAll(':scope > .eyebrow, :scope > h2, :scope > p.prose').forEach((x) => x.remove());
    el.classList.add('lr-setbody');
    p.page.append(el);
  }
  function buildPager(p) {
    const k = pages.indexOf(p);
    const nav = h('nav', { class: 'lr-pager', 'aria-label': 'Listanje po straneh' });
    const prev = pages[k - 1], next = pages[k + 1];
    const label = (x) => x.kind === 'set' || x.kind === 'extra' ? 'Vaje ' + setLabel(x) : x.title;
    // The arrow and the side say the direction; screen readers still hear it.
    if (prev) nav.append(h('a', { class: 'lr-prevp', href: '#' + prev.id, 'aria-label': 'Nazaj: ' + label(prev) }, h('span', { text: label(prev) })));
    if (next) nav.append(h('a', { class: 'lr-nextp', href: '#' + next.id, 'data-to': next.id, 'aria-label': 'Naprej: ' + label(next) }, h('span', { text: label(next) })));
    return nav;
  }

  // ---------- painting ----------
  function paintTask(i, announce) {
    const card = cards.get(i);
    const s = status(i);
    document.querySelectorAll('.lr-num[data-i="' + i + '"]').forEach((b) => { b.dataset.s = s; b.setAttribute('aria-label', 'Naloga ' + b.textContent + (LABEL[s] ? ', ' + LABEL[s].toLowerCase() : '')); });
    if (!card) return;
    card.dataset.lr = s;
    const done = !['open', 'hinted'].includes(s);
    const tag = card.querySelector('.lr-st');
    if (tag) { tag.hidden = !done; tag.textContent = LABEL[s] || ''; tag.className = 'tag lr-st lr-' + s; }
    const fb = card.lrFb;
    if (done) {
      card.querySelectorAll('.lr-q input, .lr-q select, .lr-q textarea, .lr-q button, .lr-check, .lr-extra').forEach((x) => { x.disabled = true; });
      if (fb) { fb.textContent = MESSAGE[s](state.t[i], notes.get(i)); fb.className = 'feedback lr-fb ' + (s === 'ok' || s === 'half' || s === 'part' || s === 'self' ? 'ok' : 'bad'); }
    }
    if (announce) {
      const sb = card.querySelector('.lr-solask');
      if (sb) sb.hidden = true;
    }
  }
  function paintProgress() {
    const r = totals();
    const t = document.getElementById('lrPtxt');
    if (t) {
      // bold numbers, the separator is hidden by the stylesheet but stays in the text
      t.replaceChildren(h('span', { class: 'lr-pn' }, h('b', { text: String(r.done) }), ' / ' + r.n + ' nalog'),
        h('span', { class: 'lr-pd', text: ' · ' }),
        h('span', { class: 'lr-pp' }, h('b', { text: String(r.points).replace('.', ',') }), ' / ' + r.max + ' točk'));
    }
    ['ok', 'half', 'part', 'bad', 'seen', 'self'].forEach((k) => {
      const el = document.querySelector('.lr-stack .lr-' + k);
      if (el) el.style.width = (r.n ? 100 * r[k] / r.n : 0) + '%';
    });
    pages.filter((p) => p.kind === 'set').forEach((s) => {
      const d = s.tasks.filter((x) => !['open', 'hinted'].includes(status(x.idx))).length;
      paintPie(s);
      document.querySelectorAll('[data-done="' + s.id + '"]').forEach((e) => { e.textContent = 'rešenih ' + d + ' / ' + s.tasks.length; });
      document.querySelectorAll('[data-cnt="' + s.id + '"]').forEach((e) => { e.textContent = d + '/' + s.tasks.length; e.classList.toggle('full', d === s.tasks.length); });
    });
    const vt = document.querySelector('[data-tf="vaje"]');
    if (vt && gateOpen()) vt.textContent = 'Rešenih ' + r.done + ' / ' + r.n + ', ' + String(r.points).replace('.', ',') + ' / ' + r.max + ' točk';
  }
  // The set's pie in the rail: one slice per state, clockwise from the top, in the order of the legend.
  const PIE = [['ok', '--lr-ok', 'pravilno'], ['half', '--lr-half', 'pravilno z namigom'], ['part', '--lr-part', 'delno pravilno'], ['bad', '--lr-bad', 'napačno'], ['seen', '--lr-seen', 'ogledana rešitev'], ['self', '--lr-self', 'sam preveril'], ['none', '--lr-none', 'brez odgovora']];
  function paintPie(s) {
    const n = s.tasks.length;
    if (!n) return;
    const c = { ok: 0, half: 0, part: 0, bad: 0, seen: 0, self: 0, none: 0 };
    s.tasks.forEach((x) => { const st = status(x.idx); c[c[st] === undefined ? 'none' : st]++; });
    let cum = 0;
    const parts = [];
    PIE.forEach(([k, v]) => {
      if (!c[k]) return;
      const from = cum;
      cum += c[k];
      parts.push('var(' + v + ') ' + (100 * from / n).toFixed(2) + '% ' + (100 * cum / n).toFixed(2) + '%');
    });
    const text = PIE.filter(([k]) => c[k]).map(([k, , t]) => t + ' ' + c[k]).join(', ');
    document.querySelectorAll('[data-pie="' + s.id + '"]').forEach((e) => {
      e.style.background = 'conic-gradient(' + parts.join(',') + ')';
      if (e.parentElement) e.parentElement.title = text;
    });
  }
  function paintSeen() {
    const open = gateOpen();
    document.querySelectorAll('.lr-pg[data-page]').forEach((a) => a.classList.toggle('seen', state.seen.includes(a.dataset.page)));
    document.querySelectorAll('.lr-gated').forEach((a) => { a.classList.toggle('locked', !open); a.setAttribute('aria-disabled', open ? 'false' : 'true'); });
    document.querySelectorAll('.lr-vaje').forEach((g) => g.classList.toggle('locked', !open));
    (cfg ? cfg.groups : []).forEach((g) => {
      const n = g.pages.filter((p) => state.seen.includes(p.id)).length;
      document.querySelectorAll('[data-gc="' + g.id + '"]').forEach((e) => { e.textContent = n + '/' + g.pages.length; e.classList.toggle('full', n === g.pages.length); });
      document.querySelectorAll('[data-tf="' + g.id + '"]').forEach((e) => { e.textContent = n === g.pages.length ? 'Pregledano' : 'Pregledano ' + n + ' / ' + g.pages.length; e.classList.toggle('full', n === g.pages.length); });
    });
    const tile = document.querySelector('[data-tile="vaje"]');
    if (tile) {
      tile.classList.toggle('locked', !open);
      const left = gate.filter((id) => !state.seen.includes(id)).length;
      if (!open) tile.querySelector('[data-tf="vaje"]').textContent = 'Odklene se, ko pregledaš vse razlage. Še ' + left + '.';
      tile.querySelector('.lr-ti').innerHTML = open ? ICON.vaje : ICON.lock;
    }
    document.querySelectorAll('#lrSel option').forEach((o) => {
      const p = pages.find((x) => x.id === o.value);
      if (p && (p.kind === 'set' || p.kind === 'extra')) o.textContent = setLabel(p) + (open ? '' : ' (zaklenjeno)');
    });
    paintProgress();
  }
  const gateOpen = () => gate.every((id) => state.seen.includes(id));

  // ---------- search in the explanations (agreed 12. 11. 2026) ----------
  // Only the explanation pages are searched: not the tasks, and not the quizzes and »Poskusi sam« blocks inside an explanation.
  // A word is found by its beginning ("tabel" finds tabela, tabele, tabelo), without regard to capitals or marks (s finds š).
  const SKIP = 'script,style,svg,canvas,button,select,textarea,input,[data-quiz],[data-try],.quiz,.lr-phead,.lr-pager';
  const isW = (c) => /[\p{L}\p{N}_]/u.test(c);
  // Lower case and without marks, one letter for one letter, so a place in the folded text is the same place in the original.
  const fold = (s) => {
    let o = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      o += c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD')[0].toLowerCase()[0];
    }
    return o;
  };
  // A typed word, and the shorter beginnings of it that also count (for the other endings of a Slovene word).
  const variants = (t) => {
    const v = [t];
    for (let n = t.length - 1; t.length >= 5 && n >= Math.max(4, t.length - 3); n--) v.push(t.slice(0, n));
    return v;
  };
  // Where words begin with `v`: [start, end of the whole word].
  const wordHits = (norm, v) => {
    const out = [];
    for (let i = norm.indexOf(v); i !== -1; i = norm.indexOf(v, i + 1)) {
      if (i > 0 && isW(norm[i - 1])) continue;
      let e = i + v.length;
      while (e < norm.length && isW(norm[e])) e++;
      out.push([i, e]);
    }
    return out;
  };
  // Merge overlapping ranges of several words.
  const merge = (r) => r.sort((a, b) => a[0] - b[0]).reduce((m, x) => { const l = m[m.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else m.push(x.slice()); return m; }, []);
  let searchIndex = null;
  const indexPages = () => {
    if (searchIndex) return searchIndex;
    const theory = pages.filter((p) => p.kind === 'theory');
    const BLOCK = 'p,li,td,th,tr,div,h1,h2,h3,h4,h5,h6,pre,figcaption,section,ul,ol,table,blockquote,dd,dt';
    searchIndex = theory.map((p, k) => {
      let text = '', last = null;
      const walk = document.createTreeWalker(p.page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      while (walk.nextNode()) {
        // Text of one block runs on as written (so »<code>CREATE</code>,« stays »CREATE,«); another block starts after a space.
        const n = walk.currentNode, block = n.parentElement.closest(BLOCK);
        if (block !== last) { text += ' '; last = block; }
        text += n.nodeValue;
      }
      text = text.replace(/\s+/g, ' ').trim();
      return { p, no: k + 1, text, norm: fold(text), title: fold(p.title), group: fold(p.group.title) };
    });
    return searchIndex;
  };
  // The pages that have every typed word, the best first. `use` is, for every word, the longest form that was found in that page.
  function searchPages(query) {
    const words = fold(query).split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 1 || (w && w.charCodeAt(0) > 127));
    if (!words.length) return [];
    const found = [];
    indexPages().forEach((e) => {
      let score = 0;
      const use = [];
      for (const w of words) {
        let best = null;
        for (const [j, v] of variants(w).entries()) {
          const inBody = wordHits(e.norm, v).length, inTitle = wordHits(e.title, v).length, inGroup = wordHits(e.group, v).length;
          if (!inBody && !inTitle && !inGroup) continue;
          const weight = j === 0 ? 1 : 0.3;
          score += weight * (Math.min(inBody, 10) + 8 * (inTitle ? 1 : 0) + 2 * (inGroup ? 1 : 0));
          best = v;
          break;
        }
        if (!best) return;
        use.push(best);
      }
      found.push({ e, score, use });
    });
    return found.sort((a, b) => b.score - a.score || a.e.no - b.e.no);
  }
  // A short piece of the page around the first match, with the matched words marked.
  function snippet(r) {
    const { e, use } = r;
    let at = -1;
    for (const v of use) { const h0 = wordHits(e.norm, v)[0]; if (h0 && (at < 0 || h0[0] < at)) at = h0[0]; }
    const from = at < 0 ? 0 : Math.max(0, at - 50);
    let a = from, b = Math.min(e.text.length, from + 150);
    if (a > 0) { const s = e.text.indexOf(' ', a); if (s !== -1 && s < at) a = s + 1; }
    if (b < e.text.length) { const s = e.text.lastIndexOf(' ', b); if (s > a) b = s; }
    const part = e.text.slice(a, b), norm = e.norm.slice(a, b);
    const frag = document.createDocumentFragment();
    if (a > 0) frag.append('… ');
    let pos = 0;
    merge(use.flatMap((v) => wordHits(norm, v))).forEach(([x, y]) => {
      frag.append(part.slice(pos, x), h('mark', { text: part.slice(x, y) }));
      pos = y;
    });
    frag.append(part.slice(pos));
    if (b < e.text.length) frag.append(' …');
    return frag;
  }
  // The matched words are marked on the page itself, until the next search, the end of the search or another page.
  function clearMarks() {
    const parents = new Set();
    document.querySelectorAll('mark.lr-hit').forEach((m) => { parents.add(m.parentNode); m.replaceWith(document.createTextNode(m.textContent)); });
    parents.forEach((n) => n.normalize());
  }
  function markPage(p, use) {
    clearMarks();
    const walk = document.createTreeWalker(p.page, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach((n) => {
      const ranges = merge(use.flatMap((v) => wordHits(fold(n.nodeValue), v)));
      if (!ranges.length) return;
      const frag = document.createDocumentFragment();
      let pos = 0;
      ranges.forEach(([x, y]) => { frag.append(n.nodeValue.slice(pos, x), h('mark', { class: 'lr-hit', text: n.nodeValue.slice(x, y) })); pos = y; });
      frag.append(n.nodeValue.slice(pos));
      n.replaceWith(frag);
    });
    return p.page.querySelector('mark.lr-hit');
  }
  function buildSearch() {
    const input = h('input', { type: 'search', id: 'lrSearch', class: 'lr-sq', placeholder: 'Išči po razlagah', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-label': 'Iskanje po razlagah', 'aria-controls': 'lrSres', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
    const list = h('ul', { class: 'lr-sres', id: 'lrSres', role: 'listbox', 'aria-label': 'Zadetki v razlagah', hidden: true });
    const live = h('span', { class: 'lr-sr', role: 'status' });
    const icon = h('span', { class: 'lr-sicon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>' });
    const form = h('form', { class: 'lr-search', role: 'search' }, icon, input, live, list);
    let shown = [], active = -1, pending = null;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const setActive = (i) => {
      const items = list.querySelectorAll('a');
      active = items.length ? (i + items.length) % items.length : -1;
      items.forEach((a, j) => { a.classList.toggle('on', j === active); a.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
      if (active >= 0) { input.setAttribute('aria-activedescendant', items[active].id); items[active].scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
    };
    function render() {
      const q = input.value.trim();
      clearMarks();
      if (!q) { shown = []; close(); live.textContent = ''; return; }
      shown = searchPages(q);
      list.replaceChildren();
      if (!fold(q).split(/[^\p{L}\p{N}_]+/u).some((w) => w.length > 1 || (w && w.charCodeAt(0) > 127))) { close(); live.textContent = ''; return; } // one letter is not a search yet
      if (!shown.length) {
        list.append(h('li', { class: 'lr-sno', role: 'presentation', text: 'Ni zadetkov med razlagami.' }));
        live.textContent = 'Ni zadetkov med razlagami.';
      } else {
        shown.slice(0, 20).forEach((r, i) => {
          const a = h('a', { href: '#' + r.e.p.id, id: 'lrR' + i, role: 'option', 'aria-selected': 'false', 'data-i': i },
            h('span', { class: 'lr-st' }, h('b', { text: r.e.no + ' · ' + r.e.p.title }), h('small', { text: r.e.p.group.title })),
            h('span', { class: 'lr-ss' }, snippet(r)));
          list.append(h('li', { role: 'presentation' }, a));
        });
        live.textContent = shown.length === 1 ? '1 stran z zadetki.' : shown.length + ' strani z zadetki.';
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }
    // Going to a page from the list: the words are marked there and the page opens at the first of them.
    function open(i) {
      const r = shown[i];
      if (!r) return;
      pending = r;
      close();
      const go = () => { const m = markPage(r.e.p, r.use); pending = null; if (m) m.scrollIntoView({ block: 'center' }); };
      if (location.hash.slice(1).split('/')[0] === r.e.p.id) go(); else location.hash = r.e.p.id;
    }
    // Another page clears the marks; a page opened from the list gets them. This runs after the router (a timeout), which has
    // shown the page and scrolled to the top by then.
    window.addEventListener('hashchange', () => setTimeout(() => {
      if (!pending) { clearMarks(); return; }
      const r = pending;
      pending = null;
      const m = markPage(r.e.p, r.use);
      if (m) m.scrollIntoView({ block: 'center' });
    }, 0));
    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (list.childElementCount && input.value.trim()) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); if (!list.hidden) close(); else if (input.value) { input.value = ''; clearMarks(); } } // the first press closes the list (a search field would also clear itself)
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!list.hidden) open(active >= 0 ? active : 0); });
    list.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      open(Number(a.dataset.i));
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
    return form;
  }

  // ---------- routing ----------
  function route() {
    const raw = decodeURIComponent(location.hash.slice(1));
    const [id, nRaw] = raw.split('/');
    let p = pages.find((x) => x.id === id);
    if (!p) {
      p = pages[0];
      if (raw) history.replaceState(null, '', '#' + p.id);
    }
    show(p, nRaw ? Number(nRaw) - 1 : null);
  }
  function show(p, k) {
    pages.forEach((x) => { const on = x === p; x.page.classList.toggle('on', on); x.page.hidden = !on; });
    if (p.kind !== 'overview') state.at = p.id; // in memory only; a first view below saves it together with the page
    if ((p.kind === 'theory' || p.kind === 'extra') && !state.seen.includes(p.id)) { state.seen.push(p.id); persist(); }
    const locked = (p.kind === 'set' || p.kind === 'extra') && !gateOpen();
    if (p.kind === 'set' || p.kind === 'extra') paintLock(p, locked);
    if (p.kind === 'set' && !locked) {
      const first = p.tasks.findIndex((t) => ['open', 'hinted'].includes(status(t.idx)));
      const pos = k !== null && k >= 0 && k < p.tasks.length ? k : (setPos.has(p.id) ? setPos.get(p.id) : Math.max(0, first));
      showTask(p, pos);
    }
    document.querySelectorAll('.lr-rail a').forEach((a) => { if (a.dataset.page === p.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const sel = document.getElementById('lrSel');
    if (sel) sel.value = p.id;
    paintResume();
    paintSeen();
    window.scrollTo(0, 0);
  }
  function paintLock(p, locked) {
    const box = p.page.querySelector('.lr-locked');
    const body = p.page.querySelector('.lr-setbody');
    if (body) body.hidden = locked;
    box.hidden = !locked;
    if (!locked) return;
    const missing = pages.filter((x) => x.kind === 'theory' && !state.seen.includes(x.id));
    box.replaceChildren(
      h('span', { class: 'lr-gi', html: ICON.lock }),
      h('div', {},
        h('h3', { text: 'Vaje so še zaklenjene' }),
        h('p', { text: 'Odklenejo se, ko pregledaš vse razlage. Ostalo jih je še ' + missing.length + ':' }),
        h('ul', {}, ...missing.map((x) => h('li', {}, h('a', { href: '#' + x.id, text: x.group.title + ': ' + x.title })))),
        h('a', { class: 'lr-btn lr-primary', href: '#' + missing[0].id, text: 'Na prvo nepregledano razlago' })));
  }
  function showTask(s, k) {
    setPos.set(s.id, k);
    s.tasks.forEach((t, j) => cards.get(t.idx).classList.toggle('lr-off', j !== k));
    s.page.querySelectorAll('.lr-num').forEach((b) => { if (Number(b.dataset.k) === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    s.page.querySelector('.lr-prev').disabled = k === 0;
    const next = s.page.querySelector('.lr-next');
    next.disabled = k === s.tasks.length - 1;
  }
  function step(s, d) {
    const k = (setPos.get(s.id) || 0) + d;
    if (k < 0 || k >= s.tasks.length) return;
    location.hash = s.id + '/' + (k + 1);
  }
  function paintResume() {
    const box = document.getElementById('lrResume');
    if (!box) return;
    const p = pages.find((x) => x.id === state.at);
    box.hidden = !p || p.kind === 'overview';
    if (!p) return;
    box.replaceChildren(h('span', { text: 'Nazadnje si bil pri: ' }), h('a', { href: '#' + p.id, text: p.kind === 'set' || p.kind === 'extra' ? 'Vaje ' + setLabel(p) : p.title }));
  }

  // ---------- for the importer ----------
  function catalog() {
    const LEVEL = { 1: 'lažja', 2: 'srednja', 3: 'težja' };
    const tasks = [];
    pages.filter((p) => p.kind === 'set').forEach((s) => s.tasks.forEach((t) => {
      const src = TASKS[t.idx].task;
      tasks.push({ i: t.idx, level: LEVEL[TASKS[t.idx].level] || '', max: TASKS[t.idx].max, ...(TASKS[t.idx].self ? { self: true } : {}), section: s.title, q: String(src.q || '').replace(/\*\*/g, '').replace(/\n- /g, '\n').replace(/\s+/g, ' ').trim().slice(0, 160) });
    }));
    tasks.sort((a, b) => a.i - b.i);
    return {
      pages: pages.map((p) => ({ id: p.id, chapter: p.kind === 'theory' || p.kind === 'overview' ? 'Teorija' : 'Naloge', label: p.kind === 'set' || p.kind === 'extra' ? 'Vaje ' + setLabel(p) : p.title })),
      tasks,
      gate: gate.slice(),
      tags: pages.filter((p) => p.kind === 'set' || p.kind === 'extra').map((p) => p.tag),
    };
  }
})();
