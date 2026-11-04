// Exercise 1.2: ranges agreed in "LAV-ELS: naloge s spremenljivimi števili". Uses the exercise's own helpers.
(function () {
  'use strict';
  var bits = function (n, w) { return n.toString(2).padStart(w, '0'); };
  var ENIC = ['nič enic', 'ena enica', 'dve enici', 'tri enice'];
  var WORD = { 2: 'dveh', 3: 'treh', 4: 'štirih', 5: 'petih' };
  var ORD = { 2: 'drugega', 3: 'tretjega', 4: 'četrtega', 5: 'petega' };
  var STAGE = ['Prvi', 'drugi', 'tretji', 'četrti', 'peti'];
  var PINS = { 1: { A: 1, B: 2, Y: 3 }, 2: { A: 4, B: 5, Y: 6 }, 3: { A: 9, B: 10, Y: 8 }, 4: { A: 12, B: 13, Y: 11 } };
  var gate = function (k) { return 'vrata ' + k + ': vhoda ' + PINS[k].A + ' in ' + PINS[k].B + ', izhod ' + PINS[k].Y; };
  var gens = {
    2: function (r) {
      var n = r.int(1, 14), s = bits(n, 4), d = s.split(''), zero = 'ABCD'[s.indexOf('0')];
      return { params: { n: n },
        q: 'Vhodi so A = ' + d[0] + ', B = ' + d[1] + ', C = ' + d[2] + ', D = ' + d[3] + '. Kaj dajo vrata IN s štirimi vhodi in kaj vrata ALI s štirimi vhodi?',
        fields: [F('IN: Y =', '0', 'dec', { ph: '0 ali 1' }), F('ALI: Y =', '1', 'dec', { ph: '0 ali 1' })],
        hint: 'Za IN zadošča ena ničla, da je izhod 0. Za ALI zadošča ena enica, da je izhod 1.',
        sol: stp('Izračun', ['IN: ' + d.join('·') + ' = 0 (' + zero + ' = 0)', 'ALI: ' + d.join(' + ') + ' = 1'], 'IN = 0, ALI = 1') };
    },
    15: function (r) {
      var ones = function (m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1); };
      var odd = r.pick([1, 2, 4, 7]), even = r.pick([0, 3, 5, 6]);
      var list = r.int(0, 1) ? [odd, even] : [even, odd];
      var label = function (m) { var s = bits(m, 3); return 'A = ' + s[0] + ', B = ' + s[1] + ', C = ' + s[2]; };
      return { params: { list: list },
        q: 'Izračunaj Y = A ⊕ B ⊕ C za dve kombinaciji vhodov.',
        fields: list.map(function (m) { return F(label(m), ones(m) % 2, 'dec', { ph: '0 ali 1' }); }),
        hint: 'EXOR več vhodov da 1, ko je med vhodi liho število enic.',
        sol: stp('Štetje enic', list.map(function (m) { var o = ones(m); return bits(m, 3) + ': ' + ENIC[o] + ', ' + (o % 2 ? 'liho → 1' : 'sodo → 0'); }), list.map(function (m) { return ones(m) % 2; }).join(' in ')) };
    },
    17: function (r) {
      var d = r.int(1, 14), k = r.int(0, 1), s = bits(d, 4), y = bits(k ? 15 - d : d, 4);
      return { params: { d: d, k: k },
        q: 'Štirje biti D = ' + s + ' gredo skozi krmiljeni negator (štiri vrata EXOR) s krmilnim bitom K = ' + k + '. Kaj je na izhodu?',
        fields: [F('Y (4 biti)', y, 'bin', { w: 4, ph: '4 števke' })],
        hint: k ? 'D ⊕ 1 = ' + NG('D') + '. Obrni vsak bit.' : 'D ⊕ 0 = D. Vsak bit ostane enak.',
        sol: stp('Vsak bit EXOR s K = ' + k, s.split('').map(function (c, i) { return c + ' ⊕ ' + k + ' = ' + y[i]; }), 'Y = ' + y) };
    },
    21: function (r) {
      var n = r.int(2, 5), rise = r.int(0, 1) === 1, lines = [], sum = [], hint = [], lvl = rise ? 1 : 0;
      for (var i = 0; i < n; i++) {
        var out = 1 - lvl, t = out ? 11 : 7, name = out ? 't<sub>PLH</sub>' : 't<sub>PHL</sub>';
        lines.push((i + 1) + '. negator: ' + lvl + ' → ' + out + ', ' + name + ' = ' + t + ' ns');
        hint.push(STAGE[i] + ' negator gre iz ' + lvl + ' v ' + out);
        sum.push(t);
        lvl = out;
      }
      var total = sum.reduce(function (a, b) { return a + b; }, 0);
      return { params: { n: n, rise: rise },
        q: 'Vhod verige ' + WORD[n] + ' negatorjev 7404 (TTL) se ' + (rise ? 'dvigne iz 0 v 1' : 'spusti iz 1 v 0') + '. Po koliko ns se spremeni izhod ' + ORD[n] + ' negatorja? Uporabi t<sub>PLH</sub> = 11 ns in t<sub>PHL</sub> = 7 ns.',
        fields: [F('Zakasnitev', total, 'dec', { u: 'ns' })], hint: hint.join(', ') + '.',
        sol: stp('Seštej zakasnitve', lines, sum.join(' + ') + ' = ' + total + ' ns') };
    },
    23: function (r) {
      var g = r.int(1, 4), h, side = r.pick(['A', 'B']);
      do { h = r.int(1, 4); } while (h === g);
      var shown = [1, 2, 3].filter(function (k) { return k !== g && k !== h; })[0];
      return { params: { g: g, h: h, side: side },
        q: 'Uporabljaš čip 7400 (' + gate(shown) + '). Na katero nožico je vezan izhod vrat ' + g + ' in na katero vhod ' + h + side + '?',
        fields: [F('izhod ' + g + 'Y', PINS[g].Y, 'dec', { u: 'nožica' }), F('vhod ' + h + side, PINS[h][side], 'dec', { u: 'nožica' })],
        hint: 'Spodnja vrsta ima nožice 1 do 7, zgornja 8 do 14. Poglej simulacijo čipa.',
        sol: stp('Razpored nožic 7400', ['1A 1, 1B 2, 1Y 3 · 2A 4, 2B 5, 2Y 6 · GND 7', '3Y 8, 3A 9, 3B 10 · 4Y 11, 4A 12, 4B 13 · V<sub>CC</sub> 14'], g + 'Y = ' + PINS[g].Y + ', ' + h + side + ' = ' + PINS[h][side]) };
    },
  };
  LavelsVariants.run(gens, TASKS);
})();
