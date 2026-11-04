// Exercise 2.1: number ranges agreed in "LAV-ELS: naloge s spremenljivimi števili". Uses the exercise's own helpers.
(function () {
  'use strict';
  var bit8 = { w: 8, u: '₂', ph: '8 števk' };
  var cout = { ph: '0 ali 1' };
  var neg = function (n) { return String(n).replace('-', '−'); };
  var weights = function (bits) {
    var out = [];
    bits.split('').forEach(function (c, k) { if (c === '1') out.push(1 << (bits.length - 1 - k)); });
    return out.join(', ');
  };
  var hexWithLetter = function (r) {
    var n;
    do { n = r.int(16, 255); } while (!/[A-F]/.test(n.toString(16).toUpperCase()));
    return n;
  };
  var gens = {
    1: function (r) { var n = r.int(8, 15), s = B2(n); return { params: { n: n },
      q: 'Pretvori ' + nb(s, 2) + ' v desetiški sistem.', fields: [F('Desetiško', n, 'dec', { u: '₁₀' })],
      hint: 'Uteži so 8, 4, 2, 1. Enice so pri utežeh ' + weights(s) + '.', sol: LIB.weightSum(s, 2) }; },
    2: function (r) { var n = r.int(8, 31); return { params: { n: n },
      q: 'Pretvori ' + nb(n, 10) + ' v dvojiški sistem.', fields: [F('Dvojiško', B2(n), 'bin', { u: '₂' })],
      hint: 'Deli z 2 in zapisuj ostanke. Beri od spodaj navzgor.', sol: LIB.divSteps(n, 2) }; },
    4: function (r) { var n = r.int(32, 63); return { params: { n: n },
      q: 'Pretvori ' + nb(n, 10) + ' v dvojiški sistem.', fields: [F('Dvojiško', B2(n), 'bin', { u: '₂' })],
      hint: 'Največja utež, ki gre v ' + n + ', je 32. Nadaljuj z ostankom ali deli z 2.', sol: LIB.divSteps(n, 2) }; },
    5: function (r) { var n = r.int(128, 254), s = B2(n); return { params: { n: n },
      q: 'Pretvori ' + nb(s, 2) + ' v desetiški sistem.', fields: [F('Desetiško', n, 'dec', { u: '₁₀' })],
      hint: 'Enice so pri utežeh ' + weights(s) + '.', sol: LIB.weightSum(s, 2) }; },
    6: function (r) { var n = r.int(100, 255); return { params: { n: n },
      q: 'Pretvori ' + nb(n, 10) + ' v šestnajstiški sistem.', fields: [F('Šestnajstiško', LIB.toB(n, 16), 'hex', { u: '₁₆' })],
      hint: 'Deli s 16. Ostanek nad 9 zapiši s črko: 10 = A, 15 = F.', sol: LIB.divSteps(n, 16) }; },
    7: function (r) { var n = hexWithLetter(r), h = LIB.toB(n, 16), b = B2(n, 8); return { params: { n: n },
      q: 'Zapiši ' + nb(h, 16) + ' kot 8-bitno dvojiško število (z vodilnimi ničlami).', fields: [F('Dvojiško, 8 mest', b, 'bin', Object.assign({}, bit8))],
      hint: 'Vsako šestnajstiško števko zapiši s štirimi biti.', sol: LIB.x2bin(h, 16) + '<p>Z vodilnimi ničlami do 8 mest: <strong class="m">' + b + '</strong></p>' }; },
    8: function (r) { var n = r.int(128, 254), s = B2(n); return { params: { n: n },
      q: 'Pretvori ' + nb(s, 2) + ' v šestnajstiški in v osmiški sistem.', fields: [F('Šestnajstiško', LIB.toB(n, 16), 'hex', { u: '₁₆' }), F('Osmiško', LIB.toB(n, 8), 'oct', { u: '₈' })],
      hint: 'Za šestnajstiško skupine po 4 biti, za osmiško po 3 bite, vedno od desne.', sol: LIB.bin2x(s, 16) + LIB.bin2x(s, 8) }; },
    9: function (r) { var n = r.int(65, 255), o = LIB.toB(n, 8); return { params: { n: n },
      q: 'Pretvori ' + nb(o, 8) + ' v desetiški sistem.', fields: [F('Desetiško', n, 'dec', { u: '₁₀' })],
      hint: 'Uteži osmiškega sistema so 1, 8, 64. Števke so ' + o.split('').join(', ') + '.', sol: LIB.weightSum(o, 8) }; },
    10: function (r) { var n = r.int(64, 255); return { params: { n: n },
      q: 'Pretvori ' + nb(n, 10) + ' v osmiški sistem.', fields: [F('Osmiško', LIB.toB(n, 8), 'oct', { u: '₈' })],
      hint: 'Deli z 8 in beri ostanke od spodaj navzgor.', sol: LIB.divSteps(n, 8) }; },
    15: function (r) { var x = r.pick([0.125, 0.375, 0.625, 0.875]), b = LIB.fromNum(x, 2).s; var shown = LIB.dcm(x), res = '0,' + b.split('.')[1]; return { params: { x: x },
      q: 'Pretvori ' + nb(shown, 10) + ' v dvojiški sistem.', fields: [F('Dvojiško', '0.' + b.split('.')[1], 'bin', { u: '₂', ph: 'npr. 0,101' })],
      hint: 'Ulomek množi z 2 in beri celi del od zgoraj navzdol. Konča se po treh korakih.', sol: LIB.mulSteps(x, 2) + '<p>Rezultat: <strong class="m">' + res + '</strong></p>' }; },
    20: function (r) { var a = r.int(13, 24) * 10, b = r.int(Math.ceil(Math.max(260 - a, 100) / 10), Math.floor(Math.min(400 - a, 250) / 10)) * 10; return { params: { a: a, b: b },
      q: 'Seštej 8-bitni števili ' + nb(B2(a, 8), 2) + ' (' + a + ') in ' + nb(B2(b, 8), 2) + ' (' + b + '). Zapiši, kaj ostane v 8-bitnem registru, in prenos ven (Cout).',
      fields: [F('Register, 8 mest', B2((a + b) & 255, 8), 'bin', Object.assign({}, bit8)), F('Cout', '1', 'dec', Object.assign({}, cout))],
      hint: a + ' + ' + b + ' = ' + (a + b) + ', največje 8-bitno število pa je 255. Odvečni deveti bit je prenos ven.', sol: addSol(a, b, 8) }; },
    22: function (r) { var a = r.int(64, 240), b = r.int(Math.max(64, 256 - a), 240); return { params: { a: a, b: b },
      q: 'Seštej ' + nb(B2(a, 8), 2) + ' (' + a + ') in ' + nb(B2(b, 8), 2) + ' (' + b + ') v 8 bitih. Zapiši vsoto v registru in prenos ven.',
      fields: [F('Register, 8 mest', B2((a + b) & 255, 8), 'bin', Object.assign({}, bit8)), F('Cout', '1', 'dec', Object.assign({}, cout))],
      hint: a + ' + ' + b + ' = ' + (a + b) + '. Odštej 256, pa dobiš vrednost v registru. Deveti bit je prenos.', sol: addSol(a, b, 8) }; },
    25: function (r) { var n = r.int(2, 15); return { params: { n: n },
      q: 'Zapiši število −' + n + ' kot 8-bitno število v dvojiškem komplementu.', fields: [F('Dvojiško, 8 mest', LIB.tc(-n, 8), 'bin', Object.assign({}, bit8))],
      hint: 'Zapiši ' + n + ' v 8 bitih, obrni vse bite in prištej 1.', sol: tcSol(n, 8) }; },
    26: function (r) { var n = r.int(2, 16), s = LIB.tc(-n, 8); return { params: { n: n },
      q: '8-bitni vzorec ' + nb(s, 2) + ' je zapisan v dvojiškem komplementu. Katero desetiško število predstavlja?', fields: [F('Desetiško', -n, 'dec', { u: '₁₀', ph: 'npr. −7' })],
      hint: 'Najvišji bit je 1, torej je število negativno. Utež najvišjega bita je −128.', sol: sw(s) + tcSol(n, 8) }; },
    27: function (r) { var n = r.int(17, 60); return { params: { n: n },
      q: 'Zapiši število −' + n + ' kot 8-bitno število v dvojiškem komplementu.', fields: [F('Dvojiško, 8 mest', LIB.tc(-n, 8), 'bin', Object.assign({}, bit8))],
      hint: n + ' = ' + B2(n, 8) + '. Obrni bite in prištej 1.', sol: tcSol(n, 8) }; },
    29: function (r) { var n = r.int(100, 127), s = LIB.tc(-n, 8); return { params: { n: n },
      q: '8-bitni vzorec ' + nb(s, 2) + ' je zapisan v dvojiškem komplementu. Katero desetiško število predstavlja?', fields: [F('Desetiško', -n, 'dec', { u: '₁₀', ph: 'npr. −7' })],
      hint: 'Utež najvišjega bita je −128, ostali biti prispevajo ' + (128 - n) + '.', sol: sw(s) }; },
    32: function (r) { var a = r.int(10, 40), b = r.int(2, a - 1); return { params: { a: a, b: b },
      q: 'Izračunaj ' + a + ' − ' + b + ' v 8 bitih z dvojiškim komplementom. Zapiši rezultat z 8 mesti.', fields: [F('Rezultat, 8 mest', B2(a - b, 8), 'bin', Object.assign({}, bit8))],
      hint: a + ' = ' + B2(a, 8) + ', ' + b + ' = ' + B2(b, 8) + '. Obrni ' + b + ', prištej 1, nato seštej in zavrzi deveti bit.', sol: subSol(a, b, 8) }; },
    33: function (r) { var a = r.int(1, 15), b = r.int(a + 1, 20), s = LIB.tc(a - b, 8); return { params: { a: a, b: b },
      q: 'Izračunaj ' + a + ' − ' + b + ' v 8 bitih. Zapiši rezultat v dvojiškem komplementu in njegovo desetiško vrednost.',
      fields: [F('Rezultat, 8 mest', s, 'bin', Object.assign({}, bit8)), F('Vrednost', a - b, 'dec', { ph: 'npr. −4' })],
      hint: 'Rezultat je negativen, zato bo najvišji bit 1. Vrednost preberi z utežmi, kjer ima najvišji bit utež −128.', sol: subSol(a, b, 8) + sw(s) }; },
    36: function (r) { var a = r.int(40, 100), b = r.int(Math.max(40, 128 - a), Math.min(100, 200 - a)), s = B2(a + b, 8), v = a + b - 256; return { params: { a: a, b: b },
      q: 'Seštej ' + a + ' in ' + b + ' kot 8-bitni števili s predznakom. Zapiši rezultat v registru in njegovo vrednost, če ga beremo kot število s predznakom.',
      fields: [F('Register, 8 mest', s, 'bin', Object.assign({}, bit8)), F('Vrednost', v, 'dec', { ph: 'npr. −4' })],
      hint: a + ' = ' + B2(a, 8) + ', ' + b + ' = ' + B2(b, 8) + '. Rezultat ima najvišji bit 1, čeprav sta oba seštevanca pozitivna.',
      sol: addSol(a, b, 8) + sw(s) + '<p>Preliv: pravilni rezultat je ' + (a + b) + ', v registru pa je ' + neg(v) + '.</p>' }; },
    37: function (r) { var a = r.int(100, 250), b = r.int(10, a - 1); return { params: { a: a, b: b },
      q: 'Izračunaj ' + a + ' − ' + b + ' kot 8-bitni števili brez predznaka (A + ¬B + 1). Zapiši rezultat in prenos ven Cout.',
      fields: [F('Rezultat, 8 mest', B2(a - b, 8), 'bin', Object.assign({}, bit8)), F('Cout', '1', 'dec', Object.assign({}, cout))],
      hint: a + ' = ' + B2(a, 8) + ', ' + b + ' = ' + B2(b, 8) + '. Obrni ' + b + ', prištej 1 in seštej. Če je Cout = 1, je A ≥ B.', sol: subSol(a, b, 8) + '<p>Cout = 1 pomeni, da je A večji ali enak B.</p>' }; },
  };
  LavelsVariants.run(gens, TASKS);
})();
