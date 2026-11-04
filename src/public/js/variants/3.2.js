// Exercise 3.2: ranges agreed in "LAV-ELS: naloge s spremenljivimi števili".
(function () {
  'use strict';
  var bin = function (n, w) { return n.toString(2).padStart(w, '0'); };
  var CODES = ['00', '01', '10', '11'];
  var SEGS = ['a, b, c, d, e, f', 'b, c', 'a, b, d, e, g', 'a, b, c, d, g', 'b, c, f, g', 'a, c, d, f, g', 'a, c, d, e, f, g', 'a, b, c', 'a, b, c, d, e, f, g', 'a, b, c, d, f, g'];
  var HOW = { 2: 'to sta dva segmenta', 3: 'to so trije segmenti', 4: 'to so štirje segmenti', 5: 'to je pet segmentov', 6: 'to je šest segmentov', 7: 'to je sedem segmentov' };
  var ENIC = ['Nič enic', 'Ena enica', 'Dve enici', 'Tri enice', 'Štiri enice', 'Pet enic', 'Šest enic', 'Sedem enic', 'Osem enic'];
  var weights = function (d) { return [8, 4, 2, 1].filter(function (w) { return d & w; }).join(' + '); };
  var gens = {
    0: function (r) {
      var k = r.int(0, 3);
      return { params: { k: k }, q: 'Koder 4→2 (vhodi I0 do I3, izhoda Y1 Y0) ima aktiven samo vhod I' + k + '. Kakšen je izhod?', ans: k,
        hint: 'Preberi tabelo kodiranja: I' + k + ' ustreza kodi, ki jo zapišemo kot Y1Y0.',
        sol: 'I' + k + ' → Y1Y0 = ' + CODES[k] + '. Torej je Y1 = ' + CODES[k][0] + ' in Y0 = ' + CODES[k][1] + '.' };
    },
    1: function (r) {
      var k = r.int(0, 3);
      return { params: { k: k }, q: 'Na izhodu koderja 4→2 je Y1Y0 = ' + CODES[k] + '. Kateri vhod je aktiven?', ans: k,
        hint: 'Kodo ' + CODES[k] + ' smo videli v tabeli kodirnika.', sol: 'Koda ' + CODES[k] + ' pripada vhodu I' + k + '.' };
    },
    3: function (r) {
      var d = r.int(0, 9), c = bin(d, 4), sum = weights(d), single = sum === String(d);
      return Object.assign({ params: { d: d }, q: 'Tipka ' + d + ' na tipkovnici pošlje BCD kodo. Katera je pravilna?',
        hint: 'BCD uteži so 8-4-2-1. ' + (!d ? 'Število 0 ne uporabi nobene uteži.' : single ? 'Število ' + d + ' uporabi samo eno utež.' : 'Število ' + d + ' je ' + sum + '.'),
        sol: (!d ? '0 ne uporabi nobene uteži' : single ? d + ' uporabi samo utež ' + d : d + ' = ' + sum) + ', zato bite ' + c + '.' },
      r.mc(c, [bin((d + 1) % 10, 4), bin((d + 9) % 10, 4), bin(d ^ 8, 4), bin(d ^ 3, 4)]));
    },
    5: function (r) {
      var k = r.int(0, 3), s = CODES[k];
      return { params: { k: k }, q: 'Dekodirnik 2→4 ima E = 1, A = ' + s[0] + ' in B = ' + s[1] + '. Kateri izhod je aktiven?', ans: k,
        hint: 'Vrednost AB = ' + s + ' je dvojiško število ' + k + '.', sol: 'AB = ' + s + ' = ' + k + ', zato je aktiven Y' + k + '.' };
    },
    9: function (r) {
      var k = r.int(0, 3), s = CODES[k];
      return { params: { k: k }, q: 'Dekodirnik 2→4 naslavlja štiri celice. Naslov AB = ' + s + '. Katera celica je izbrana?', ans: k,
        hint: 'AB = ' + s + ' je dvojiško število ' + k + '.', sol: 'AB = ' + s + ' = ' + k + ', izbrana je celica ' + k + '.' };
    },
    12: function (r) {
      var n = r.int(0, 255), s = bin(n, 8), o = s.split('1').length - 1, p = o % 2;
      return { params: { n: n }, q: 'Prečna pariteta: vrstica ' + s.split('').join(' ') + ' (osem bitov). Kolikšen je bit parnosti te vrstice?', ans: p,
        hint: 'Preštej enice v osmih bitih. Pri sodem številu enic je bit 0, pri lihem 1.',
        sol: ENIC[o] + ', ' + (p ? 'liho' : 'sodo') + ', zato je bit P = ' + p + '.' };
    },
    13: function (r) {
      var b = r.int(1, 3), a = r.int(0, b - 1);
      return { params: { a: a, b: b }, q: 'Prioritetni koder 4→2: hkrati sta aktivna I' + a + ' in I' + b + '. Kakšen je izhod Y1Y0?', ans: b - 1,
        hint: 'Vhod z najvišjo prioriteto ima prednost.', sol: 'I' + b + ' ima višjo prioriteto kot I' + a + ', zato je izhod ' + CODES[b] + '.' };
    },
    15: function (r) {
      var d = r.int(0, 9), list = SEGS[d], n = list.split(', ').length, lo = Math.min(4, Math.max(2, n - 2)), opts = [lo, lo + 1, lo + 2, lo + 3].map(String);
      return { params: { d: d }, q: 'BCD → 7-segmentni dekodirnik dobi vhod ' + bin(d, 4) + ' (cifra ' + d + '). Koliko segmentov sveti?', opts: opts, ans: opts.indexOf(String(n)),
        hint: 'Preberi vrstico za ' + d + ' v tabeli 7-segmentnega prikaza in preštej enice.', sol: 'Za ' + d + ' svetijo ' + list + ': ' + HOW[n] + '.' };
    },
    17: function (r) {
      var d = r.int(0, 9), s = bin(d, 4), A = +s[0], B = +s[1], C = +s[2], D = +s[3], bd = B & D, nn = (1 - B) & (1 - D), y = A | C | bd | nn;
      return { params: { d: d }, q: 'Po enačbi a = A + C + B·D + ¬B·¬D izračunaj a za cifro ' + d + ' (' + s + '). Kakšen je a?', ans: y,
        hint: 'Za ' + s + ' ocenjuj člene A, C, B·D in ¬B·¬D po vrsti.',
        sol: 'A = ' + A + ', C = ' + C + ', B·D = ' + bd + ', ¬B·¬D = ' + nn + '. Zato je a = ' + y + '.' };
    },
  };
  LavelsVariants.define(gens);
})();
