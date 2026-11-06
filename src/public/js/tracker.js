// LAV-ELS tracker. Loaded before the exercise's own code: gives it this student's saved progress,
// sends every change to the server, and counts active time per page.
(function () {
  'use strict';
  var B = window.__LAVELS;
  if (!B) return;
  var PENDING = 'lavels_pending_' + B.uid + '_' + B.id;
  var HEARTBEAT = 15000, IDLE_AFTER = 60000;
  var lastSaved = null;
  var attempt = B.attempt, dirty = false, sending = false, pendingReset = false, stopped = false;
  var store = window.localStorage;
  var realSet = Storage.prototype.setItem;
  var status = null;

  function rawSet(k, v) { try { realSet.call(store, k, v); } catch (e) { /* storage may be full or blocked */ } }
  function rawGet(k) { try { return store.getItem(k); } catch (e) { return null; } }
  function rawDel(k) { try { store.removeItem(k); } catch (e) { /* ignore */ } }

  // Another student's data must never be visible: drop other exercises and other users' unsent work.
  try {
    Object.keys(store).forEach(function (k) {
      if (/^scnm_/.test(k) && k !== 'scnm_lavele_sym' && k !== B.key) store.removeItem(k);
      if (/^lavels_pending_/.test(k) && k.indexOf('lavels_pending_' + B.uid + '_') !== 0) store.removeItem(k);
    });
  } catch (e) { /* ignore */ }

  var seed = B.state && Object.keys(B.state).length ? JSON.stringify(B.state) : null;
  var unsent = rawGet(PENDING);
  if (unsent) {
    try {
      var u = JSON.parse(unsent);
      if (u.attempt === attempt && u.state) { seed = JSON.stringify(u.state); dirty = true; }
      else rawDel(PENDING);
    } catch (e) { rawDel(PENDING); }
  }
  if (seed) rawSet(B.key, seed); else rawDel(B.key);

  Storage.prototype.setItem = function (k, v) {
    realSet.call(this, k, v);
    if (this === store && k === B.key) {
      lastSaved = { attempt: attempt, state: JSON.parse(v), reset: pendingReset };
      rawSet(PENDING, JSON.stringify(lastSaved));
      dirty = true;
      show('Shranjujem …');
      schedule();
    }
  };
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#resetYes')) pendingReset = true;
  }, true);

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 400); }
  function current() {
    var raw = rawGet(PENDING);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function show(text, kind, link) {
    if (!status) return;
    status.textContent = text;
    status.className = 'lvs-status' + (kind ? ' lvs-' + kind : '');
    if (link) {
      var a = document.createElement('a');
      a.href = link.href; a.textContent = link.text;
      status.appendChild(document.createTextNode(' '));
      status.appendChild(a);
    }
  }
  function post(url, body) {
    var text = JSON.stringify(body);
    return fetch(url, { method: 'POST', credentials: 'same-origin', keepalive: text.length < 60000, headers: { 'Content-Type': 'application/json' }, body: text });
  }
  function flush() {
    if (!dirty || sending || stopped) return;
    // Another tab that just opened may have cleared this tab's waiting copy.
    var cur = current() || lastSaved;
    if (!cur) { dirty = false; return; }
    var snapshot = JSON.stringify(cur);
    var wasReset = !!(cur.reset || pendingReset);
    sending = true;
    show('Shranjujem …');
    post('/api/progress/' + encodeURIComponent(B.id), { csrf: B.csrf, attempt: cur.attempt, state: cur.state, reset: wasReset })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
      })
      .then(function (x) {
        sending = false;
        if (x.status === 200 && x.d.ok) {
          if (wasReset) pendingReset = false;
          // A new attempt means new numbers, which the page only gets by loading again.
          if (wasReset && B.variant) { rawDel(PENDING); dirty = false; stopped = true; location.reload(); return; }
          if (x.d.attempt !== attempt) attempt = x.d.attempt;
          var after = current();
          if (after && JSON.stringify(after) !== snapshot) {
            after.attempt = attempt; after.reset = false;
            rawSet(PENDING, JSON.stringify(after));
            schedule();
          } else { rawDel(PENDING); dirty = false; }
          show('Shranjeno');
        } else if (x.status === 409) {
          rawDel(PENDING); dirty = false; stopped = true;
          show('Vaja je bila medtem ponastavljena ali spremenjena.', 'warn', { href: location.pathname, text: 'Osveži stran' });
        } else if (x.status === 403 && x.d.code === 'closed') {
          rawDel(PENDING); dirty = false; stopped = true;
          show('Učitelj je zaprl to vajo. Novi odgovori se ne shranijo.', 'warn', { href: '/vaje', text: 'Na seznam vaj' });
        } else if (x.status === 401 || x.status === 403) {
          stopped = true;
          show('Prijava je potekla. Odgovori so varni v tem brskalniku.', 'warn', { href: '/', text: 'Prijavi se znova' });
        } else { show('Shranjevanje ni uspelo. Poskušam znova.', 'warn'); }
      })
      .catch(function () { sending = false; show('Ni povezave. Odgovori se shranijo, ko se povezava vrne.', 'warn'); });
  }

  // Active time: tab visible and some input in the last minute.
  var lastInput = Date.now(), lastTick = Date.now(), active = 0;
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInput = Date.now(); }, { passive: true, capture: true });
  });
  function pageId() {
    var el = document.querySelector('.page.on');
    return el ? el.id : null;
  }
  var page = null;
  function account() {
    var now = Date.now(), delta = now - lastTick;
    lastTick = now;
    if (document.visibilityState === 'visible' && now - lastInput < IDLE_AFTER && delta < HEARTBEAT * 2) active += delta;
  }
  function sendTime(usePage) {
    var seconds = Math.round(active / 1000);
    if (!usePage || stopped) { active = 0; return; }
    if (seconds < 1 && usePage === lastSeen) return;
    lastSeen = usePage;
    active = 0;
    var body = JSON.stringify({ csrf: B.csrf, page: usePage, seconds: seconds });
    var url = '/api/time/' + encodeURIComponent(B.id);
    if (document.visibilityState === 'hidden' && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    else post(url, JSON.parse(body)).catch(function () {});
  }
  var lastSeen = null;
  function tick() {
    account();
    var now = pageId();
    if (now !== page) { sendTime(page || now); page = now; sendTime(page); }
    else if (active >= HEARTBEAT) sendTime(page);
    if (dirty) flush();
  }
  document.addEventListener('visibilitychange', function () { account(); if (document.visibilityState === 'hidden') { sendTime(page); flush(); } lastTick = Date.now(); });
  window.addEventListener('pagehide', function () { account(); sendTime(page); });

  function bar() {
    var css = document.createElement('style');
    css.textContent = '.lvs-bar{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;justify-content:space-between;background:#0a1020;color:#e8edf6;font:15px/1.4 "Atkinson Hyperlegible",system-ui,sans-serif;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px))}'
      + '.lvs-bar a{color:#fff;font-weight:700;text-underline-offset:3px}.lvs-right{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center}.lvs-out{margin:0}.lvs-out button{background:none;border:0;color:#fff;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 0}.lvs-bar .lvn-btn{color:#fff}.lvs-exnote{margin:0 auto;max-width:1180px;width:calc(100% - 32px)}.lvs-exnote:not([hidden]){margin-top:12px}.lvs-status{opacity:.85;font-size:14px}.lvs-warn{opacity:1;color:#f1b95a}.lvs-warn a{color:#f1b95a}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.className = 'lvs-bar';
    var back = document.createElement('a');
    back.href = '/vaje'; back.textContent = '‹ Vse vaje';
    status = document.createElement('span');
    status.className = 'lvs-status'; status.setAttribute('aria-live', 'polite');
    var out = document.createElement('form');
    out.method = 'post'; out.action = '/auth/logout'; out.className = 'lvs-out';
    var tok = document.createElement('input');
    tok.type = 'hidden'; tok.name = '_csrf'; tok.value = B.csrf;
    var btn = document.createElement('button');
    btn.textContent = 'Odjava';
    out.appendChild(tok); out.appendChild(btn);
    out.addEventListener('submit', function (e) {
      if (!dirty) return;
      e.preventDefault();
      flush();
      setTimeout(function () { out.submit(); }, 700);
    });
    var right = document.createElement('span');
    right.className = 'lvs-right';
    right.appendChild(status);
    var exNote = null, exBtn = null;
    if (B.notes) {
      exNote = document.createElement('div');
      exNote.className = 'lvn-text lvs-exnote';
      exBtn = noteButton('Opomba k vaji ' + (B.no || B.id), null, exNote, 'Moja opomba');
      right.appendChild(exBtn);
    }
    right.appendChild(out);
    el.appendChild(back); el.appendChild(right);
    document.body.insertBefore(el, document.body.firstChild);
    if (exNote) {
      el.parentNode.insertBefore(exNote, el.nextSibling);
      LavelsNotes.show(exNote, B.notes.exercise, exBtn);
    }
  }
  // A letter icon opens the note; a saved note is shown next to what it belongs to.
  function noteButton(heading, task, box, label) {
    var value = task === null ? B.notes.exercise : (B.notes.tasks[task] || '');
    var btn = LavelsNotes.button(label, !!value);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      LavelsNotes.edit({
        heading: heading, value: task === null ? B.notes.exercise : (B.notes.tasks[task] || ''), csrf: B.csrf, exercise: B.id, task: task,
        onSaved: function (text) {
          if (task === null) B.notes.exercise = text; else B.notes.tasks[task] = text;
          LavelsNotes.show(box, text, btn);
        },
      });
    });
    return btn;
  }
  function decorateTasks() {
    if (!B.notes) return;
    document.querySelectorAll('.task').forEach(function (card) {
      if (card.querySelector('.lvn-btn')) return;
      var i = Number(card.id.replace(/^t/, ''));
      var crumb = card.querySelector('.crumb');
      if (!crumb || isNaN(i)) return;
      var q = card.querySelector('.qt, .q');
      var n = crumb.textContent.match(/Naloga (\d+)/);
      var box = document.createElement('div');
      box.className = 'lvn-text';
      if (q) q.parentNode.insertBefore(box, q.nextSibling); else card.appendChild(box);
      var btn = noteButton('Opomba k nalogi ' + (n ? n[1] : i + 1), i, box, '');
      var right = crumb.querySelector('.lv');
      (right || crumb).appendChild(btn);
      LavelsNotes.show(box, B.notes.tasks[i] || '', btn);
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    bar();
    decorateTasks();
    var list = document.getElementById('tasks');
    if (list) new MutationObserver(decorateTasks).observe(list, { childList: true });
    page = pageId();
    setInterval(tick, 5000);
    sendTime(page);
    if (dirty) flush();
  });
  // Exercises put the page id in the address; don't let the browser jump past the header on opening.
  var openedWithHash = !!location.hash;
  window.addEventListener('load', function () {
    if (!openedWithHash) setTimeout(function () { window.scrollTo(0, 0); }, 0);
  });
  window.addEventListener('online', flush);
})();
