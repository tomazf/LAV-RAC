// Login page: the lamps are real bits. Flipping one changes the byte, and the byte shows its character.
(function () {
  'use strict';
  var panel = document.querySelector('[data-panel]');
  if (!panel) return;
  var decoder;
  try { decoder = new TextDecoder('windows-1250'); } catch (e) { return; }
  var cols = Array.prototype.slice.call(panel.querySelectorAll('[data-col]'));
  var lamps = cols.map(function (c) { return Array.prototype.slice.call(c.querySelectorAll('.lamp')); });
  var reset = panel.querySelector('[data-reset]');
  var say = panel.querySelector('[data-say]');
  var valueOf = function (c) {
    return lamps[c].reduce(function (a, l) { return a + (l.getAttribute('aria-pressed') === 'true' ? Number(l.dataset.w) : 0); }, 0);
  };
  var initial = cols.map(function (_, c) { return valueOf(c); });
  var glyphOf = function (b) {
    var ch = decoder.decode(new Uint8Array([b]));
    var code = ch.charCodeAt(0);
    // Control codes, the non-breaking space and the soft hyphen have nothing to show.
    return code < 33 || (code >= 127 && code < 161) || code === 173 ? '·' : ch;
  };
  var hexOf = function (b) { return (b < 16 ? '0' : '') + b.toString(16).toUpperCase(); };
  function show(c, announce) {
    var b = valueOf(c);
    var g = glyphOf(b);
    panel.querySelector('[data-glyph="' + c + '"]').textContent = g;
    panel.querySelector('[data-hex="' + c + '"]').textContent = hexOf(b);
    if (announce) say.textContent = 'Znak ' + (c + 1) + ': ' + (g === '·' ? 'brez znaka' : g) + ', desetiško ' + b + ', šestnajstiško ' + hexOf(b) + '.';
  }
  function changed() { return initial.some(function (b, c) { return valueOf(c) !== b; }); }
  function flip(l, c) {
    panel.classList.add('live');
    l.setAttribute('aria-pressed', l.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    show(c, true);
    reset.hidden = !changed();
  }
  function focus(c, r) {
    lamps.forEach(function (col) { col.forEach(function (l) { l.tabIndex = -1; }); });
    lamps[c][r].tabIndex = 0;
    lamps[c][r].focus();
  }
  lamps.forEach(function (col, c) {
    col.forEach(function (l, r) {
      l.addEventListener('click', function () { focus(c, r); flip(l, c); });
      l.addEventListener('keydown', function (e) {
        var move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!move) return;
        e.preventDefault();
        focus(Math.min(lamps.length - 1, Math.max(0, c + move[0])), Math.min(7, Math.max(0, r + move[1])));
      });
    });
  });
  reset.addEventListener('click', function () {
    lamps.forEach(function (col, c) {
      col.forEach(function (l) { l.setAttribute('aria-pressed', initial[c] & Number(l.dataset.w) ? 'true' : 'false'); });
      show(c, false);
    });
    say.textContent = 'Znaki so povrnjeni.';
    reset.hidden = true;
    lamps[0][0].tabIndex = 0;
    lamps[0][0].focus();
  });
})();
