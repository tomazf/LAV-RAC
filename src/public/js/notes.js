// Student notes: a note icon (a page with lines), a popup to write in, and the saved text shown next to the item.
(function () {
  'use strict';
  var sheet = document.createElement('link');
  var own = document.currentScript ? document.currentScript.src.split('?')[1] : '';
  sheet.rel = 'stylesheet'; sheet.href = '/static/css/notes.css' + (own ? '?' + own : '');
  (document.head || document.documentElement).appendChild(sheet);
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 3.5h9.5L19 8v12.5H5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M14.5 3.5V8H19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8.5 12.5h7M8.5 16h4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  function button(label, has) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lvn-btn';
    b.innerHTML = ICON;
    if (label) { var s = document.createElement('span'); s.textContent = label; b.appendChild(s); }
    mark(b, has);
    return b;
  }
  function mark(b, has) {
    b.classList.toggle('lvn-has', !!has);
    b.setAttribute('aria-label', has ? 'Uredi opombo' : 'Dodaj opombo');
    b.title = has ? 'Uredi opombo' : 'Dodaj opombo';
  }
  function show(box, text, btn) {
    if (box) { box.textContent = text || ''; box.hidden = !text; }
    if (btn) mark(btn, !!text);
  }
  function edit(o) {
    var d = document.createElement('dialog');
    d.className = 'lvn-dialog';
    var f = document.createElement('form');
    var h = document.createElement('h2'); h.textContent = o.heading;
    var hint = document.createElement('p'); hint.className = 'lvn-hint'; hint.textContent = 'V portalu jo vidiš samo ti.';
    var label = document.createElement('label'); label.className = 'lvn-sr'; label.textContent = o.heading; label.htmlFor = 'lvn-area';
    var area = document.createElement('textarea'); area.id = 'lvn-area'; area.rows = 7; area.maxLength = 5000; area.value = o.value || '';
    var err = document.createElement('p'); err.className = 'lvn-err'; err.setAttribute('role', 'alert'); err.hidden = true;
    var row = document.createElement('div'); row.className = 'lvn-row';
    var save = document.createElement('button'); save.type = 'submit'; save.className = 'lvn-save'; save.textContent = 'Shrani opombo';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'lvn-cancel'; cancel.textContent = 'Prekliči';
    row.appendChild(save); row.appendChild(cancel);
    if (o.value) {
      var del = document.createElement('button'); del.type = 'button'; del.className = 'lvn-del'; del.textContent = 'Izbriši opombo';
      del.addEventListener('click', function () { area.value = ''; submit(); });
      row.appendChild(del);
    }
    [h, hint, label, area, err, row].forEach(function (x) { f.appendChild(x); });
    d.appendChild(f);
    document.body.appendChild(d);
    function close() { d.close(); d.remove(); }
    function submit() {
      save.disabled = true; err.hidden = true;
      fetch('/api/notes', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: o.csrf, exercise: o.exercise || null, task: o.task === undefined ? null : o.task, body: area.value }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (x) { return { ok: r.ok && x.ok, x: x, status: r.status }; });
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Prijava je potekla. Kopiraj besedilo in se prijavi znova.' : 'Opombe ni bilo mogoče shraniti. Poskusi znova.');
        o.onSaved(r.x.body);
        close();
      }).catch(function (e) {
        err.textContent = e.message === 'Failed to fetch' ? 'Ni povezave. Poskusi znova.' : e.message;
        err.hidden = false; save.disabled = false;
      });
    }
    f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    cancel.addEventListener('click', close);
    d.addEventListener('cancel', function () { d.remove(); });
    d.addEventListener('click', function (e) { e.stopPropagation(); });
    d.showModal();
    area.focus();
  }
  window.LavelsNotes = { button: button, show: show, edit: edit };

  // Portal pages: buttons rendered by the server.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-note-slot]').forEach(function (slot) {
      var box = document.getElementById(slot.dataset.box);
      var value = box.textContent;
      var btn = button(slot.dataset.label || '', !!value);
      btn.addEventListener('click', function () {
        edit({
          heading: slot.dataset.heading, value: value, csrf: slot.dataset.csrf, exercise: slot.dataset.exercise || null,
          onSaved: function (text) { value = text; show(box, text, btn); },
        });
      });
      slot.appendChild(btn);
    });
  });
})();
