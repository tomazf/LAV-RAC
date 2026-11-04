// Exercise 1.1: ranges agreed in "LAV-ELS: naloge s spremenljivimi števili". Uses the exercise's own helpers.
(function () {
  'use strict';
  var WORD = { 2: 'dveh', 3: 'treh', 4: 'štirih', 5: 'petih', 6: 'šestih' };
  var SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
  var bit01 = { ph: '0 ali 1' };
  var twos = function (n) { var o = []; while (n--) o.push(2); return o.join('·'); };
  var gens = {
    1: function (r) {
      var v = r.int(9, 19), s = (v / 10).toFixed(1).replace('.', ',') + ' V';
      return { params: { v: v },
        q: 'Na vhod vrat TTL pripeljemo ' + s + '. Kaj vrata preberejo?',
        hint: 'Primerjaj ' + s + ' z V<sub>IL</sub> = 0,8 V in V<sub>IH</sub> = 2,0 V.',
        sol: ans('Odgovor:', 'prepovedano območje') + '<p>' + s + ' je nad 0,8 V in pod 2,0 V. Proizvajalec za to območje ne zagotavlja ničesar. Logično vezje ne pozna »polovične« vrednosti.</p>' };
    },
    12: function (r) {
      var n = r.int(2, 5), c = 1 << n;
      return { params: { n: n },
        q: 'Koliko različnih kombinacij vhodov ima logična funkcija ' + WORD[n] + ' spremenljivk?', fields: [F('Kombinacij', c, 'dec')],
        hint: 'Vsaka spremenljivka ima dve vrednosti: ' + twos(n) + '.', sol: ans('Odgovor:', '2' + SUP[n] + ' = ' + c) };
    },
    13: function (r) {
      var a = r.int(0, 1), b = r.int(0, 1), c = r.int(0, 1), nb = 1 - b, p = a & nb, y = p | c;
      return { params: { a: a, b: b, c: c },
        q: 'Izračunaj Y = A·' + NG('B') + ' + C pri A = ' + a + ', B = ' + b + ' in C = ' + c + '.', fields: [F('Y', y, 'dec', Object.assign({}, bit01))],
        hint: 'Najprej negacija, nato IN, na koncu ALI.',
        sol: stp('Po vrstnem redu', [NG('B') + ' = ' + NG(b) + ' = ' + nb, 'A·' + NG('B') + ' = ' + a + '·' + nb + ' = ' + p, 'Y = ' + p + ' + C = ' + p + ' + ' + c], 'Y = ' + y) };
    },
    16: function (r) {
      var all = [0, 1, 2, 3, 4, 5, 6, 7], val = function (m) { return (m >> 2) & (((m >> 1) | m) & 1); }, list;
      do { list = r.shuffle(all).slice(0, 3); } while (list.every(function (m) { return val(m) === val(list[0]); }));
      var parts = list.map(function (m) { return { v: m >> 2, o: (m >> 1) & 1, g: m & 1, y: val(m) }; });
      var label = function (p) { return 'V = ' + p.v + ', O = ' + p.o + ', G = ' + p.g; };
      return { params: { list: parts },
        q: 'Sirena alarma je Y = V·(O + G). Izračunaj Y za tri primere.',
        fields: parts.map(function (p) { return F(label(p), p.y, 'dec', Object.assign({}, bit01)); }),
        hint: 'Najprej izračunaj oklepaj, nato IN z V.',
        sol: stp('Izračun', parts.map(function (p) { var s = p.o | p.g; return label(p) + ': O + G = ' + s + ', Y = ' + p.v + '·' + s + ' = ' + p.y; }), parts.map(function (p) { return p.y; }).join(', ')) };
    },
    17: function (r) {
      var n = r.int(3, 6), c = 1 << n;
      return { params: { n: n },
        q: 'Koliko vrstic ima pravilnostna tabela funkcije ' + WORD[n] + ' spremenljivk?', fields: [F('Vrstic', c, 'dec')],
        hint: 'Vrstic je 2<sup>n</sup>.', sol: ans('Odgovor:', '2' + SUP[n] + ' = ' + c) };
    },
    18: function (r) {
      var n = r.int(1, 6), a = (n >> 2) & 1, b = (n >> 1) & 1, c = n & 1;
      return { params: { n: n },
        q: 'V tabeli s spremenljivkami A, B, C (A je najvišji bit) poišči vrstico A = ' + a + ', B = ' + b + ', C = ' + c + '. Katera je njena številka (začnemo z 0)?',
        fields: [F('Vrstica', n, 'dec')], hint: 'Preberi ABC kot dvojiško število.',
        sol: stp('Dvojiško število ABC', ['' + a + b + c + '₂ = ' + (a * 4) + ' + ' + (b * 2) + ' + ' + c], 'vrstica ' + n) };
    },
    21: function (r) {
      var V = ['A', 'B', 'C'], forms = {
        A: { x: '¬A·B+C', show: NG('A') + '·B + C', cols: [[NG('A'), '¬A'], [NG('A') + '·B', '¬A·B'], ['Y', '¬A·B+C']], hint: 'Za vsako vrstico izračunaj ' + NG('A') + '·B, nato ALI s C. Kjer je C = 1, je Y zagotovo 1.' },
        B: { x: 'A·¬B+C', show: 'A·' + NG('B') + ' + C', cols: [[NG('B'), '¬B'], ['A·' + NG('B'), 'A·¬B'], ['Y', 'A·¬B+C']], hint: 'Za vsako vrstico izračunaj A·' + NG('B') + ', nato ALI s C. Kjer je C = 1, je Y zagotovo 1.' },
        C: { x: 'A·B+¬C', show: 'A·B + ' + NG('C'), cols: [['A·B', 'A·B'], [NG('C'), '¬C'], ['Y', 'A·B+¬C']], hint: 'Za vsako vrstico izračunaj A·B, nato ALI z ' + NG('C') + '. Kjer je C = 0, je Y zagotovo 1.' },
      };
      var neg = r.pick(V), f = forms[neg];
      return Object.assign(ttq('težka', 'tab', 'Izpolni tabelo za Y = ' + f.show + '.', V, { Y: f.x }, f.hint, solTab(V, f.cols)), { params: { neg: neg } });
    },
  };
  LavelsVariants.run(gens, TASKS);
})();
