// Two buttons in the header, on the portal's pages and inside every exercise:
//  - »Prikaz«: theme, text size, spacing, contrast and motion, saved in the user's account (the server writes them into the <html> tag);
//  - »Prijava«: a short message to the admin about a bug or a mistake; the place (exercise, page, task) is filled in by this page.
(function () {
  'use strict';
  var root = document.getElementById('hd-root');
  var cfg = window.__LAVHD || (root ? { csrf: root.getAttribute('data-csrf'), report: root.getAttribute('data-report') === '1', unseen: Number(root.getAttribute('data-unseen')) || 0, exercise: null } : null);
  if (!cfg) return;
  var html = document.documentElement;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); });
  }
  var ICON_VIEW = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path class="fill" d="M12 3.5a8.5 8.5 0 0 1 0 17z"/></svg>';
  var ICON_FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 21V3.5"/><path d="M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg>';

  // ---------- display settings ----------
  var DEF = { theme: 'auto', size: 'normal', spacing: 'normal', contrast: 'normal', motion: 'auto' };
  var ATTR = { theme: 'data-theme', size: 'data-size', spacing: 'data-spacing', contrast: 'data-contrast', motion: 'data-motion' };
  var GROUPS = [
    ['theme', 'Tema', [['auto', 'Samodejno (kot v sistemu)'], ['light', 'Svetla'], ['dark', 'Temna']]],
    ['size', 'Velikost besedila', [['normal', 'Običajna'], ['large', 'Večja'], ['xlarge', 'Največja']]],
    ['spacing', 'Razmik med vrsticami in črkami', [['normal', 'Običajen'], ['wide', 'Povečan']]],
    ['contrast', 'Kontrast', [['normal', 'Običajen'], ['high', 'Visok']]],
    ['motion', 'Animacije', [['auto', 'Kot v sistemu'], ['reduce', 'Zmanjšane']]]
  ];
  function current() {
    var p = {};
    Object.keys(DEF).forEach(function (k) { p[k] = html.getAttribute(ATTR[k]) || DEF[k]; });
    return p;
  }
  function apply(p) {
    Object.keys(DEF).forEach(function (k) { if (p[k] === DEF[k]) html.removeAttribute(ATTR[k]); else html.setAttribute(ATTR[k], p[k]); });
  }
  var viewDlg = null;
  function openView() {
    if (!viewDlg) {
      var msg = el('p', { class: 'hd-msg', role: 'status' });
      var timer = null;
      var form = el('form', { method: 'dialog' });
      var save = function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          post('/api/prikaz', { csrf: cfg.csrf, prefs: current() }).then(function (x) {
            if (x.status === 200 && x.d.ok) { msg.className = 'hd-msg ok'; msg.textContent = 'Shranjeno pri tvojem računu.'; }
            else { msg.className = 'hd-msg bad'; msg.textContent = 'Nastavitve so spremenjene samo v tej strani; shranjevanje ni uspelo.'; }
          }).catch(function () { msg.className = 'hd-msg bad'; msg.textContent = 'Ni povezave. Nastavitve so spremenjene samo v tej strani.'; });
        }, 250);
      };
      GROUPS.forEach(function (g) {
        var seg = el('div', { class: 'hd-seg' });
        g[2].forEach(function (o) {
          var input = el('input', { type: 'radio', name: 'hd-' + g[0], value: o[0] });
          input.addEventListener('change', function () { var p = current(); p[g[0]] = o[0]; apply(p); save(); });
          seg.appendChild(el('label', {}, [input, el('span', { text: o[1] })]));
        });
        form.appendChild(el('fieldset', {}, [el('legend', { text: g[1] }), seg]));
      });
      var reset = el('button', { type: 'button', class: 'hd-act ghost', text: 'Ponastavi' });
      reset.addEventListener('click', function () { apply(DEF); sync(); save(); });
      var close = el('button', { type: 'submit', class: 'hd-act', text: 'Zapri' });
      form.appendChild(el('div', { class: 'hd-row' }, [close, reset]));
      form.appendChild(msg);
      viewDlg = el('dialog', { class: 'hd-dlg', 'aria-labelledby': 'hd-view-t' }, [el('div', { class: 'hd-in' }, [
        el('h2', { id: 'hd-view-t', text: 'Prikaz' }),
        el('p', { text: 'Nastavitve veljajo povsod v portalu, tudi v vajah, in se shranijo pri tvojem računu.' }),
        form])]);
      viewDlg.addEventListener('click', function (e) { if (e.target === viewDlg) viewDlg.close(); });
      document.body.appendChild(viewDlg);
    }
    sync();
    viewDlg.querySelector('[role=status]').textContent = '';
    viewDlg.showModal();
  }
  function sync() {
    var p = current();
    Object.keys(DEF).forEach(function (k) {
      viewDlg.querySelectorAll('input[name="hd-' + k + '"]').forEach(function (i) { i.checked = i.value === p[k]; });
    });
  }

  // ---------- reports ----------
  var repDlg = null;
  var MAX = 2000;
  // Where the user is: in an exercise the page and the task, elsewhere the address.
  function place() {
    if (!cfg.exercise) {
      return { text: (document.title || location.pathname).split(' | ')[0], data: { path: location.pathname } };
    }
    var title = document.querySelector('.lr-name b');
    var page = document.querySelector('.lr-rail a[aria-current="page"] .lr-tx');
    var on = document.querySelector('.page.on');
    var kick = on && on.querySelector('.lr-kick');
    var num = on && on.querySelector('.lr-num[aria-current="step"]');
    var m = kick && /sklop\s+([A-Z])/.exec(kick.textContent);
    var label = m && num ? m[1] + '.' + num.textContent.trim() : null;
    // Year and chapter first, as the teacher names them: »4. letnik · 2. poglavje · title › page › naloga B.11«.
    var name = title ? title.textContent.trim() : 'Vaja ' + cfg.exercise;
    var parts = [[cfg.year ? cfg.year + '. letnik' : '', cfg.chapter ? cfg.chapter + '. poglavje' : '', name].filter(Boolean).join(' · ')];
    if (page) parts.push(page.textContent.trim());
    if (label) parts.push('naloga ' + label);
    return { text: parts.join(' › '), data: { exercise: cfg.exercise, hash: decodeURIComponent(location.hash.replace(/^#/, '')), label: label } };
  }
  function openReport() {
    if (!repDlg) {
      var where = el('p', { class: 'hd-where' });
      var area = el('textarea', { id: 'hd-rep-text', maxlength: String(MAX), rows: '5' });
      var count = el('span', { class: 'hd-count' });
      var msg = el('p', { class: 'hd-msg', role: 'status' });
      var send = el('button', { type: 'submit', class: 'hd-act', text: 'Oddaj' });
      var cancel = el('button', { type: 'button', class: 'hd-act ghost', text: 'Zapri' });
      var mine = el('a', { class: 'hd-link', href: '/prijave', text: 'Moje prijave' });
      var form = el('form', {}, [
        where,
        el('label', { class: 'hd-lab', for: 'hd-rep-text', text: 'Kaj ni v redu?' }), area,
        el('div', { class: 'hd-row' }, [send, cancel, el('span', { class: 'hd-grow' }), count, mine]),
        msg]);
      var update = function () { count.textContent = area.value.length + ' / ' + MAX; send.disabled = !area.value.trim(); };
      area.addEventListener('input', update);
      cancel.addEventListener('click', function () { repDlg.close(); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!area.value.trim()) return;
        send.disabled = true;
        msg.className = 'hd-msg'; msg.textContent = 'Pošiljam …';
        var data = repDlg._place.data;
        post('/api/prijava', { csrf: cfg.csrf, text: area.value, exercise: data.exercise, hash: data.hash, label: data.label, path: data.path }).then(function (x) {
          if (x.status === 200 && x.d.ok) {
            area.value = ''; update(); send.disabled = true;
            msg.className = 'hd-msg ok'; msg.textContent = 'Hvala, prijava je oddana. Odgovor in stanje najdeš v razdelku »Moje prijave«.';
          } else {
            send.disabled = false;
            msg.className = 'hd-msg bad'; msg.textContent = (x.d && x.d.error) || 'Prijave ni bilo mogoče oddati. Poskusi znova.';
          }
        }).catch(function () { send.disabled = false; msg.className = 'hd-msg bad'; msg.textContent = 'Ni povezave. Poskusi znova.'; });
      });
      repDlg = el('dialog', { class: 'hd-dlg', 'aria-labelledby': 'hd-rep-t' }, [el('div', { class: 'hd-in' }, [
        el('h2', { id: 'hd-rep-t', text: 'Prijavi napako ali težavo' }),
        el('p', { text: 'Napaka v nalogi ali besedilu, nejasno navodilo, program ali stran ne deluje. Skrbnik bo videl, kje v portalu si.' }),
        form])]);
      repDlg._where = where; repDlg._area = area; repDlg._update = update; repDlg._msg = msg;
      repDlg.addEventListener('click', function (e) { if (e.target === repDlg) repDlg.close(); });
      document.body.appendChild(repDlg);
    }
    repDlg._place = place();
    repDlg._where.replaceChildren(document.createTextNode('Kraj: '), el('b', { text: repDlg._place.text }));
    repDlg._msg.textContent = '';
    repDlg._update();
    repDlg.showModal();
    repDlg._area.focus();
  }

  // ---------- the buttons ----------
  function mount() {
    var kids = [];
    var view = el('button', { type: 'button', class: 'hd-btn', title: 'Prikaz: tema, velikost besedila, kontrast', 'aria-label': 'Prikaz', html: ICON_VIEW });
    view.addEventListener('click', openView);
    kids.push(view);
    if (cfg.report) {
      var rep = el('button', { type: 'button', class: 'hd-btn', title: 'Prijavi napako ali težavo', 'aria-label': 'Prijavi napako ali težavo', html: ICON_FLAG });
      if (cfg.unseen > 0) rep.appendChild(el('span', { class: 'hd-badge', text: String(cfg.unseen), title: 'Odgovori na tvoje prijave' }));
      rep.addEventListener('click', openReport);
      kids.push(rep);
    }
    var box = el('span', { class: 'hd-btns' }, kids);
    var tracked = document.querySelector('.lvs-right');
    var who = document.getElementById('hd-root');
    var top = document.querySelector('.lr-top-in');
    if (tracked) tracked.insertBefore(box, tracked.querySelector('.lvs-out'));
    else if (top) top.appendChild(box);
    else if (who) who.insertBefore(box, who.firstChild);
    else { box.className += ' hd-float'; document.body.appendChild(box); }
  }
  // A confirmed flag (opozorilo) of the teacher on this exercise: a short notice at the top of the page.
  function notice() {
    if (!cfg.notice) return;
    var bar = el('div', { class: 'hd-notice', role: 'status' }, [el('b', { text: '! Opozorilo: ' }), document.createTextNode(cfg.notice)]);
    document.body.insertBefore(bar, document.body.firstChild);
  }
  // After the tracker has built its part of the exercise header (it does that when the page is read).
  if (document.readyState === 'complete') { mount(); notice(); } else document.addEventListener('DOMContentLoaded', function () { mount(); notice(); });
})();
