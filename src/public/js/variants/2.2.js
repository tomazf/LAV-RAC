// Exercise 2.2: number ranges agreed in "LAV-ELS: naloge s spremenljivimi števili". Uses the exercise's own helpers.
(function () {
  'use strict';
  var groups = function (s) { return bcd(s).join(''); };
  var letter = function (r) { return r.int(65, 90); };
  var enic = function (n) { return n === 1 ? 'eno enico' : n === 2 ? 'dve enici' : n === 3 ? 'tri enice' : n === 4 ? 'štiri enice' : n === 5 ? 'pet enic' : n === 6 ? 'šest enic' : n === 7 ? 'sedem enic' : 'nič enic'; };
  var word = function (code, mode) { var b = B2(code, 7); return b + LIB.pbit(b, mode === 'liha' ? 'liho' : mode); };
  var gens = {
    1: function (r) { var d = r.int(0, 9); return { params: { n: d },
      q: 'Zapiši desetiško števko ' + d + ' v kodi BCD (štirje biti).', fields: [F('BCD', B2(d, 4), 'bin', { w: 4, ph: '4 števke' })],
      hint: 'Uteži v skupini so 8, 4, 2, 1. Katere seštejejo ' + d + '?', sol: bcdSol(String(d)) }; },
    2: function (r) { var n = r.int(10, 99), s = String(n); return { params: { n: n },
      q: 'Zapiši desetiško število ' + n + ' v kodi BCD (osem bitov brez presledka).', fields: [F('BCD, 8 mest', groups(s), 'bin', { w: 8, ph: '8 števk' })],
      hint: 'Vsako števko zapiši posebej s štirimi biti: ' + s[0] + ' in ' + s[1] + '.', sol: bcdSol(s) }; },
    3: function (r) { var n = r.int(100, 999), s = String(n), g = bcd(s); return { params: { n: n },
      q: 'Koda BCD ' + mm(g.join(' ')) + ' pomeni desetiško število. Katero?', fields: [F('Desetiško', n, 'dec', { u: '₁₀' })],
      hint: 'Razdeli kodo v skupine po štiri bite in vsako pretvori v števko.',
      sol: stp('Skupine po štiri bite', g.map(function (x, k) { return x + ' = ' + s[k]; }), s) }; },
    5: function (r) { var n = r.int(10, 99), s = String(n); return { params: { n: n },
      q: 'Število ' + n + ' zapiši v kodi BCD in kot navadno dvojiško število.',
      fields: [F('BCD, 8 mest', groups(s), 'bin', { w: 8, ph: '8 števk' }), F('Navadno dvojiško', B2(n), 'bin', { ph: 'brez vodilnih ničel' })],
      hint: 'BCD: ' + s[0] + ' in ' + s[1] + ' vsaka posebej. Dvojiško: pretvori celo število, zato gre za drugačen zapis.', sol: bcdSol(s) + LIB.divSteps(n, 2) }; },
    6: function (r) { var h = r.int(0, 23), m = r.int(0, 59), s = String(h).padStart(2, '0') + String(m).padStart(2, '0'); return { params: { h: h, m: m },
      q: 'Digitalna ura kaže ' + s.slice(0, 2) + ':' + s.slice(2) + '. Vsaka od štirih števk je v kodi BCD. Zapiši vseh 16 bitov skupaj (brez presledkov).',
      fields: [F('Koda, 16 mest', groups(s), 'bin', { w: 16, ph: '16 števk' })],
      hint: 'Štiri števke ' + s.split('').join(', ') + '. Vsaka dobi štiri bite.', sol: bcdSol(s) }; },
    8: function (r) { var n = r.int(1, 15); return { params: { n: n },
      q: 'Zapiši število ' + n + ' (' + B2(n, 4) + ') v Grayevi kodi.', fields: [F('Gray', B2(LIB.gray(n), 4), 'bin', { w: 4, ph: '4 števke' })],
      hint: 'Najvišji bit prepiši, ostale dobiš z XOR sosednjih bitov dvojiškega števila.', sol: graySol(n, 4) }; },
    9: function (r) { var n = r.int(8, 15); return { params: { n: n },
      q: 'Pretvori dvojiško število ' + nb(B2(n, 4), 2) + ' v Grayevo kodo.', fields: [F('Gray', B2(LIB.gray(n), 4), 'bin', { w: 4, ph: '4 števke' })],
      hint: 'G3 = B3, G2 = B3 ⊕ B2, G1 = B2 ⊕ B1, G0 = B1 ⊕ B0.', sol: graySol(n, 4) }; },
    10: function (r) { var g = r.int(8, 15); return { params: { g: g },
      q: 'Pretvori Grayevo kodo ' + mm(B2(g, 4)) + ' v dvojiško število.', fields: [F('Dvojiško', B2(LIB.ungray(g), 4), 'bin', { w: 4, ph: '4 števke' })],
      hint: 'B3 = G3, nato vsak naslednji bit je XOR že izračunanega bita levo in Grayevega bita.', sol: ungraySol(g, 4) }; },
    12: function (r) { var g = r.int(8, 15), v = LIB.ungray(g), b = B2(v, 4); return { params: { g: g },
      q: 'Merilnik kota daje Grayevo kodo ' + mm(B2(g, 4)) + '. Zapiši ustrezno dvojiško število in njegovo desetiško vrednost.',
      fields: [F('Dvojiško', b, 'bin', { w: 4, ph: '4 števke' }), F('Desetiško', v, 'dec', { u: '₁₀' })],
      hint: 'Najprej pretvori Gray v dvojiško (XOR verige), nato preberi uteži.', sol: ungraySol(g, 4) + '<p>' + b + ' = ' + v + '</p>' }; },
    13: function (r) { var n = r.int(64, 200); return { params: { n: n },
      q: 'Zapiši število ' + n + ' v 8-bitni Grayevi kodi.', fields: [F('Gray, 8 mest', B2(LIB.gray(n), 8), 'bin', { w: 8, ph: '8 števk' })],
      hint: n + ' = ' + B2(n, 8) + '. Vsak bit razen najvišjega je XOR istoležnega bita in bita levo od njega.', sol: graySol(n, 8) }; },
    16: function (r) { var c = letter(r), ch = String.fromCharCode(c); return { params: { c: c },
      q: 'Kakšna je desetiška koda velike črke ' + ch + ' v kodi ASCII?', fields: [F('Koda', c, 'dec', { u: '₁₀' })],
      hint: 'Velike črke se začnejo pri 65 (A). ' + ch + ' je ' + (c - 64) + '. črka angleške abecede.',
      sol: ans('Odgovor:', c) + '<p>A = 65, B = 66, C = 67, in tako naprej do Z = 90.</p>' }; },
    23: function (r) {
      var c;
      do { c = r.int(32, 126); } while (c === 38 || c === 60 || c === 62);
      var b = B2(c, 7), o = LIB.ones(b);
      return { params: { c: c },
        q: 'Podatek ' + b + ' ima ' + enic(o) + '. Kolikšen paritetni bit dodamo pri sodi pariteti?', fields: [F('Paritetni bit', LIB.pbit(b, 'soda'), 'dec', { ph: '0 ali 1' })],
        hint: 'Skupaj mora biti sodo število enic. Preveri, ali je število ' + o + ' že sodo.', sol: parSol(c, 'soda') };
    },
    24: function (r) { var c = letter(r), b = B2(c, 7); return { params: { c: c },
      q: 'Znak »' + String.fromCharCode(c) + '« je v kodi ASCII zapisan kot ' + b + '. Zapiši 8-bitno besedo s sodim paritetnim bitom na desni.',
      fields: [F('Beseda, 8 mest', word(c, 'soda'), 'bin', { w: 8, ph: '8 števk' })],
      hint: 'Preštej enice v ' + b + '. Če je število liho, dodaj 1.', sol: parSol(c, 'soda') }; },
    25: function (r) { var c = letter(r), b = B2(c, 7); return { params: { c: c },
      q: 'Znak »' + String.fromCharCode(c) + '« je v kodi ASCII zapisan kot ' + b + '. Zapiši 8-bitno besedo z lihim paritetnim bitom na desni.',
      fields: [F('Beseda, 8 mest', word(c, 'liha'), 'bin', { w: 8, ph: '8 števk' })],
      hint: 'Preštej enice v ' + b + '. Pri lihi pariteti mora biti skupaj liho število enic.', sol: parSol(c, 'liha') }; },
    28: function (r) { var d = r.int(0, 9), c = 48 + d, b = B2(c, 7); return { params: { c: c },
      q: 'Znak »' + d + '« ima kodo ASCII ' + c + '. Zapiši 7-bitno kodo in 8-bitno besedo s sodim paritetnim bitom na desni.',
      fields: [F('Koda ASCII, 7 mest', b, 'bin', { w: 7, ph: '7 števk' }), F('Beseda, 8 mest', word(c, 'soda'), 'bin', { w: 8, ph: '8 števk' })],
      hint: 'Pretvori ' + c + ' v dvojiško. Nato preštej enice: če je njihovo število sodo, je paritetni bit 0.', sol: LIB.divSteps(c, 2) + parSol(c, 'soda') }; },
  };
  LavelsVariants.run(gens, TASKS);
})();
