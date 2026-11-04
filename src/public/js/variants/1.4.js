// Exercise 1.4: ranges and checked function lists agreed in "LAV-ELS: naloge s spremenljivimi števili".
(function () {
  'use strict';
  var bits = function (m) { return m.toString(2).padStart(3, '0'); };
  var ABC = ['A', 'B', 'C'];
  var minterm = function (m) { return ABC.map(function (v, i) { return bits(m)[i] === '1' ? v : '¬' + v; }).join('·'); };
  var maxform = function (m) { return ABC.map(function (v, i) { return bits(m)[i] === '1' ? v : '¬' + v; }).join('+'); };
  var joinIn = function (l) { return l.slice(0, -1).join(', ') + ' in ' + l[l.length - 1]; };
  var ENIC = { 2: 'dve enici', 3: 'tri enice', 4: 'štiri enice', 5: 'pet enic', 6: 'šest enic' };
  var rowsOf = function (expr) {
    var out = [];
    BOOL.table(BOOL.parse(expr), V3).forEach(function (y, m) { if (y) out.push(m); });
    return out;
  };
  // Y = P·¬Q + R, or with the negation on the first variable, in any order of A, B, C.
  var form = function (r) {
    var s = r.shuffle(ABC), neg = r.int(0, 1), prod = neg ? '¬' + s[0] + '·' + s[1] : s[0] + '·¬' + s[1];
    return { p: s[0], q: s[1], z: s[2], negv: neg ? s[0] : s[1], prod: prod, x: prod + '+' + s[2] };
  };
  var gens = {
    0: function (r) {
      var m = r.int(0, 7), s = bits(m), c = minterm(m);
      return Object.assign({ params: { m: m },
        q: 'Kateri minterm (produkt) je enak 1 samo v vrstici A = ' + s[0] + ', B = ' + s[1] + ', C = ' + s[2] + '?',
        hint: 'Spremenljivko z vrednostjo 1 zapišeš, z 0 jo negiraš.',
        sol: ans('Odgovor:', '') + EQ(c, '') + '<p>Pri A = ' + s[0] + ', B = ' + s[1] + ', C = ' + s[2] + ' so vsi trije faktorji 1, v vseh drugih vrsticah je vsaj en faktor 0.</p>' },
      r.mc(H(c), [H(minterm(7 - m)), H(minterm(m ^ 2)), H(maxform(m))]));
    },
    1: function (r) {
      var n = r.int(2, 6);
      return { params: { n: n },
        q: 'Tabela funkcije treh spremenljivk ima v stolpcu Y ' + ENIC[n] + '. Koliko produktov (mintermov) ima PDNO?',
        fields: [F('Produktov', n, 'dec')], hint: 'Za vsako enico en minterm.', sol: ans('Odgovor:', n) };
    },
    2: function (r) {
      var on = r.pick([[1, 6], [0, 5], [2, 7], [3, 4], [1, 4, 7], [0, 3, 6]]), x = on.map(minterm).join('+');
      var ys = [0, 1, 2, 3, 4, 5, 6, 7].map(function (m) { return on.indexOf(m) >= 0 ? 1 : 0; });
      return Object.assign(exq('srednja', 'te', 'Zapiši enačbo za funkcijo s to tabelo (lahko PDNO ali krajše).' + qtab(V3, ys), { x: x, vars: V3, on: on },
        'Enice so v vrsticah ' + joinIn(on.map(bits)) + '. Za vsako zapiši produkt.', EQ(x)), { params: { on: on } });
    },
    3: function (r) {
      var f = form(r);
      return Object.assign(ttq('srednja', 'te', 'Izračunaj tabelo za Y = ' + H(f.x) + '.', V3, { Y: f.x },
        'Kjer je ' + f.z + ' = 1, je Y zagotovo 1. Drugje preveri ' + H(f.prod) + '.',
        solTab(V3, [[NG(f.negv), '¬' + f.negv], [H(f.prod), f.prod], ['Y', f.x]])), { params: { x: f.x } });
    },
    4: function (r) {
      var f = form(r), a = rowsOf(f.z), b = rowsOf(f.prod), all = rowsOf(f.x);
      return { params: { x: f.x },
        q: 'V katerih vrsticah tabele (A je najvišji bit) je Y = ' + H(f.x) + ' enak 1? Vpiši številke vrstic, ločene z vejicami, od najmanjše do največje.',
        fields: [F('Vrstice', all.join(','), 'txt', { ph: 'npr. 0,2,6' })],
        hint: f.z + ' = 1 v vrsticah ' + joinIn(a) + '. ' + H(f.prod) + ' = 1 v vrsticah ' + joinIn(b) + '.',
        sol: stp('Unija vrstic', [f.z + ' = 1: ' + a.join(', '), H(f.prod) + ' = 1: ' + b.join(', ')], 'Y = Σm(' + all.join(', ') + ')') };
    },
    5: function (r) {
      var f = r.pick([
        { on: [0, 1, 2, 3, 7], x: '¬A+B·C', big: '¬A', add: 'B·C' },
        { on: [3, 4, 5, 6, 7], x: 'A+B·C', big: 'A', add: 'B·C' },
        { on: [0, 1, 4, 5, 7], x: '¬B+A·C', big: '¬B', add: 'A·C' },
        { on: [2, 3, 5, 6, 7], x: 'B+A·C', big: 'B', add: 'A·C' },
        { on: [0, 2, 4, 6, 7], x: '¬C+A·B', big: '¬C', add: 'A·B' },
        { on: [0, 1, 3, 5, 7], x: 'C+¬A·¬B', big: 'C', add: '¬A·¬B' },
      ]);
      var big = rowsOf(f.big), extra = f.on.filter(function (m) { return big.indexOf(m) < 0; })[0];
      var near = big.filter(function (m) { var d = m ^ extra; return d === 1 || d === 2 || d === 4; })[0];
      var val = f.big[0] === '¬' ? f.big[1] + ' = 0' : f.big + ' = 1';
      return Object.assign(exq('srednja', 'te', 'Funkcija je Y = Σm(' + f.on.join(', ') + '). Zapiši najkrajši izraz.', { x: f.x, vars: V3, on: f.on, min: true },
        'Vrstice ' + joinIn(big) + ' imajo ' + val + '. Vrstica ' + extra + ' se združi z vrstico ' + near + '.', KMS), { solKm: { names: V3, on: f.on }, params: { on: f.on } });
    },
    6: function (r) {
      var p = r.pick([['A', 'C'], ['A', 'B'], ['B', 'C']]), xor = r.int(0, 1) === 1, a = p[0], b = p[1];
      var other = ABC.filter(function (v) { return p.indexOf(v) < 0; })[0];
      var t1 = xor ? '¬' + a + '·' + b : '¬' + a + '·¬' + b, t2 = xor ? a + '·¬' + b : a + '·' + b, x = t1 + '+' + t2, on = rowsOf(x);
      var describe = function (t) {
        var rows = rowsOf(t), vals = t.split('·').map(function (l) { return l[0] === '¬' ? l[1] + ' = 0' : l + ' = 1'; });
        return 'vrstici ' + rows.join(' in ') + ' imata ' + vals.join(' in ');
      };
      return Object.assign(exq('težka', 'te', 'Funkcija je Y = Σm(' + on.join(', ') + '). Zapiši najkrajši izraz.', { x: x, vars: V3, on: on, min: true },
        'Nariši diagram. V' + describe(t1).slice(1) + ', ' + describe(t2) + '.',
        KMS + '<p>Y = ' + H(x) + ' = ' + (xor ? a + ' ⊕ ' + b : H('¬(' + a + '⊕' + b + ')')) + '. Spremenljivka ' + other + ' ne vpliva na izhod.</p>'), { solKm: { names: V3, on: on }, params: { on: on } });
    },
    9: function (r) {
      var s = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 2);
      var calc = function (m) { var d = bits(m), a = +d[0], b = +d[1], c = +d[2], x = a | b; return { label: 'A = ' + a + ', B = ' + b + ', C = ' + c, x: x, c: c, y: 1 - (x & c) }; };
      var v = s.map(calc);
      return { params: { list: s },
        q: 'Izračunaj izhod vezja na sliki za dve kombinaciji vhodov.',
        fields: v.map(function (e) { return F(e.label, e.y, 'dec', { ph: '0 ali 1' }); }),
        hint: 'X1 = A + B, Y = ' + H('¬(X·C)') + ' (NAND).',
        sol: stp('Po vratih', v.map(function (e) { return e.label + ': X1 = ' + e.x + ', Y = ' + H('¬(' + e.x + '·' + e.c + ')') + ' = ' + e.y; }), v[0].y + ' in ' + v[1].y) };
    },
  };
  LavelsVariants.run(gens, TASKS);
})();
