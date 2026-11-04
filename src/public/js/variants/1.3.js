// Exercise 1.3: ranges and checked function lists agreed in "LAV-ELS: naloge s spremenljivimi števili".
(function () {
  'use strict';
  var ABC = ['A', 'B', 'C'];
  var and = function (list) { return list.join(' in '); };
  var joinRows = function (rows) { return rows.slice(0, -1).join(', ') + ' in ' + rows[rows.length - 1]; };
  var rowsOf = function (expr, names) {
    var out = [];
    BOOL.table(BOOL.parse(expr), names).forEach(function (y, m) { if (y) out.push(m); });
    return out;
  };
  var pair = function (r) { var s = r.shuffle(ABC); return [s[0], s[1], s[2]]; };
  var sorted = function (a, b) { return a < b ? [a, b] : [b, a]; };
  var plural = function (n, one, two, few) { return n === 1 ? one : n === 2 ? two : few; };
  var LIT = function (l) { return l[0] === '¬' ? l[1] + ' = 0' : l + ' = 1'; };
  var flip = function (l) { return l[0] === '¬' ? l[1] : '¬' + l; };
  var gens = {
    10: function (r) {
      var p = pair(r), x = p[0], y = p[1], target = x + '·' + y + '+' + x + '·¬' + y;
      return Object.assign(exq('lahka', 'kr', 'Poenostavi Y = ' + H(target) + '.', { x: x, vars: sorted(x, y), target: target, min: true },
        'Izpostavi ' + x + '.', stp('Izpostavljanje', [H(target) + ' = ' + x + '·(' + H(y + '+¬' + y) + ')', '= ' + x + '·1'], 'Y = ' + x)), { params: { x: x, y: y } });
    },
    11: function (r) {
      var out = r.pick(ABC), rest = ABC.filter(function (v) { return v !== out; }).join('·');
      var term = function (neg) { return ABC.map(function (v) { return v === out && neg ? '¬' + v : v; }).join('·'); };
      var target = term(true) + '+' + term(false);
      return Object.assign(exq('srednja', 'kr', 'Poenostavi Y = ' + H(target) + '.', { x: rest, vars: V3, target: target, min: true },
        'Oba člena vsebujeta ' + rest + '.', stp('Izpostavljanje', [rest + '·(' + H('¬' + out + '+' + out) + ')', '= ' + rest + '·1'], 'Y = ' + rest)), { params: { out: out } });
    },
    14: function (r) {
      var p = pair(r), x = p[0], y = p[1], target = '(' + x + '+' + y + ')·(' + x + '+¬' + y + ')';
      return Object.assign(exq('težka', 'kr', 'Poenostavi Y = ' + H(target) + '.', { x: x, vars: sorted(x, y), target: target, min: true },
        'Uporabi drugo obliko distributivnosti: (A + X)·(A + Y) = A + X·Y.', stp('Po korakih', [H(target) + ' = ' + x + ' + ' + H(y + '·¬' + y), '= ' + x + ' + 0'], 'Y = ' + x)), { params: { x: x, y: y } });
    },
    18: function (r) {
      var p = pair(r), s = sorted(p[0], p[1]), prod = s[0] + '·' + s[1], z = p[2];
      var target = r.int(0, 1) ? prod + '+' + z : z + '+' + prod;
      return Object.assign(kmq('srednja', 'vk', 'Vpiši funkcijo Y = ' + H(target) + ' v Veitchev diagram treh spremenljivk.', { vars: V3, target: target },
        z + ' = 1 so vse celice ob črti ' + z + '. ' + prod + ' sta celici ob črtah ' + s[0] + ' in ' + s[1] + '.',
        '<p>Enice so v vrsticah ' + rowsOf(z, V3).join(', ') + ' (' + z + ' = 1) in ' + rowsOf(prod, V3).join(', ') + ' (' + prod + ').</p>'), { params: { z: z } });
    },
    19: function (r) {
      var lit = r.pick(['A', '¬A', 'B', '¬B', 'C', '¬C']), on = rowsOf(lit, V3);
      return Object.assign(exq('srednja', 'vk', 'V diagramu so enice v vrsticah ' + joinRows(on) + '. Zapiši najkrajši izraz.', { x: lit, vars: V3, on: on, min: true },
        'Vse štiri enice imajo ' + LIT(lit) + '.', KMS), { qkm: { names: V3, on: on }, solKm: { names: V3, on: on }, params: { lit: lit } });
    },
    21: function (r) {
      var k = r.int(1, 3), size = 1 << k, rest = 4 - k;
      return { params: { k: k },
        q: 'V diagramu štirih spremenljivk je skupina ' + ({ 2: 'dveh', 4: 'štirih', 8: 'osmih' })[size] + ' celic. Koliko spremenljivk izpade in koliko literalov ima ustrezni produkt?',
        fields: [F('izpade', k, 'dec', { u: plural(k, 'spremenljivka', 'spremenljivki', 'spremenljivke') }), F('ostane', rest, 'dec', { u: plural(rest, 'literal', 'literala', 'literali') })],
        hint: 'Skupina 2<sup>k</sup> celic izloči k spremenljivk.',
        sol: stp('Velikost skupine', [size + ' = 2' + ({ 1: '¹', 2: '²', 3: '³' })[k] + ' → ' + plural(k, 'izpade 1 spremenljivka', 'izpadeta 2 spremenljivki', 'izpadejo 3 spremenljivke'), '4 − ' + k + ' = ' + rest], k + ' in ' + rest) };
    },
    23: function (r) {
      var f = r.pick([['¬B·¬D', 'A·C'], ['¬A·¬C', 'B·D'], ['A·¬D', '¬B·C'], ['¬A·D', 'B·¬C'], ['A·B', '¬C·¬D'], ['¬A·¬B', 'C·D']]), target = f[0] + '+' + f[1];
      return Object.assign(kmq('težka', 'vk', 'Vpiši funkcijo Y = ' + H(target) + ' v diagram štirih spremenljivk.', { vars: V4, target: target },
        'Vsak produkt zajema štiri celice. Vpiši ju enega za drugim. Ena celica je skupna.',
        '<p>Enice: ' + rowsOf(f[0], V4).join(', ') + ' (' + H(f[0]) + ') in ' + rowsOf(f[1], V4).join(', ') + ' (' + H(f[1]) + ').</p>'), { params: { target: target } });
    },
    24: function (r) {
      var f = r.pick([['C', 'D'], ['A', 'B'], ['A', 'C'], ['B', 'D'], ['¬A', 'D'], ['B', '¬C'], ['¬B', '¬D'], ['A', '¬D']]);
      var prod = f.join('·'), zeros = rowsOf(prod, V4), on = rowsOf('¬(' + prod + ')', V4), x = flip(f[0]) + '+' + flip(f[1]);
      return Object.assign(exq('težka', 'vk', 'Funkcija štirih spremenljivk ima ničle samo v vrsticah ' + joinRows(zeros) + ', povsod drugje so enice. Zapiši najkrajši izraz (vsoto ali produkt).', { x: x, vars: V4, on: on, min: true, pos: true },
        'Združi ničle. Vse ničle imajo ' + and([LIT(f[0]), LIT(f[1])]) + '.',
        KMS + '<p>Ena skupina štirih ničel: ' + and([LIT(f[0]), LIT(f[1])]) + '. Vsota je (' + H(x) + '), kar je po De Morganu ' + H('¬(' + prod + ')') + '.</p>'), { solKm: { names: V4, on: on, pos: true }, params: { prod: prod } });
    },
    29: function (r) {
      var f = r.pick([['¬B·¬D', '¬A·B·D'], ['B·D', '¬A·¬B·¬D'], ['A·C', '¬A·¬B·¬C'], ['¬A·D', 'A·B·¬D'], ['B·¬C', '¬B·C·D'], ['¬C·¬D', 'A·C·D']]);
      var big = rowsOf(f[0], V4), small = rowsOf(f[1], V4), on = big.concat(small).sort(function (a, b) { return a - b; }), x = f[0] + '+' + f[1];
      return Object.assign(grq('težka', 'vk', 'Signalna lučka L sveti v vrsticah ' + joinRows(on) + ' pravilnostne tabele (vhodi A, B, C, D). Funkcija je vpisana v diagram. Označi skupine enic in zapiši minimalno PDNO.', { x: x, vars: V4, on: on },
        'Ena skupina ima štiri celice, druga dve.',
        KMS + '<p>Skupina celic ' + big.join(', ') + ' da ' + H(f[0]) + '. Celici ' + small.join(' in ') + ' dasta ' + H(f[1]) + '. L = ' + H(x) + '.</p>', { solKm: { names: V4, on: on } }), { params: { x: x, groups: [big, small] } });
    },
  };
  LavelsVariants.run(gens, TASKS);
})();
