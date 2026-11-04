// Exercise 3.3: ranges agreed in "LAV-ELS: naloge s spremenljivimi števili".
(function () {
  'use strict';
  var bin = function (n, w) { return n.toString(2).padStart(w, '0'); };
  var SRC = ['HDMI 1', 'HDMI 2', 'AV', 'antena'];
  var REL = { lt: 'A&lt;B', gt: 'A&gt;B', eq: 'A=B' };
  var relOf = function (a, b) { return a < b ? 'lt' : a > b ? 'gt' : 'eq'; };
  var gens = {
    0: function (r) {
      var k = r.int(0, 3), c = bin(k, 2), name = SRC[k];
      return { params: { k: k },
        q: 'Televizor ima multiplekser 4→1 za izbiro vira: I0 = HDMI 1, I1 = HDMI 2, I2 = AV, I3 = antena. Kakšna naj bo kombinacija S1S0, da na zaslon pride ' + name + '?',
        ans: k, hint: name + ' je vhod I' + k + '. Številko ' + k + ' zapiši dvojiško.',
        sol: name + ' je vhod I' + k + '. Številka ' + k + ' je dvojiško ' + c + ', zato je S1 = ' + c[0] + ' in S0 = ' + c[1] + '.' };
    },
    3: function (r) {
      var a = r.int(0, 1), b = r.int(0, 1), rel = relOf(a, b);
      return { params: { a: a, b: b },
        q: '1-bitni primerjalnik dobi A = ' + a + ' in B = ' + b + '. Kateri izhod je aktiven?', ans: { gt: 0, eq: 1, lt: 2 }[rel],
        hint: 'Preveri, kateri bit je večji.',
        sol: rel === 'eq' ? 'Bita sta enaka, zato je aktiven izhod A=B.' : (rel === 'gt' ? 'A = 1 je večji od B = 0, zato je aktiven izhod A&gt;B.' : 'A = 0 je manjši od B = 1, zato je aktiven izhod A&lt;B.') };
    },
    5: function (r) {
      var p = r.pick([[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]), rest = [0, 1, 2, 3].filter(function (k) { return p.indexOf(k) < 0; });
      var v = [0, 1, 2, 3].map(function (k) { return p.indexOf(k) >= 0 ? 1 : 0; });
      var A = bin(p[0], 2), B = bin(p[1], 2);
      return Object.assign({ params: { p: p },
        q: 'Multiplekser 4→1 ima na vhodih I3 I2 I1 I0 = ' + v[3] + v[2] + v[1] + v[0] + '. Pri katerih kombinacijah S1S0 je Y = 1?',
        hint: 'Zapiši vhode po vrsti: I0 = ' + v[0] + ', I1 = ' + v[1] + ', I2 = ' + v[2] + ', I3 = ' + v[3] + '.',
        sol: 'I' + p[0] + ' = 1 in I' + p[1] + ' = 1. I' + p[0] + ' izbere S1S0 = ' + A + ', I' + p[1] + ' pa S1S0 = ' + B + '. Pri ' + bin(rest[0], 2) + ' in ' + bin(rest[1], 2) + ' so izbrani vhodi 0.' },
      r.mc(A + ' in ' + B, [bin(rest[0], 2) + ' in ' + bin(rest[1], 2), 'Samo ' + A, 'Samo ' + B]));
    },
    8: function (r) {
      var d = r.int(0, 1), k = r.int(0, 3), s = bin(k, 2), right = d ? 'Y' + k : 'Noben';
      var others = [0, 1, 2, 3].filter(function (j) { return j !== k; }).slice(0, 2).map(function (j) { return 'Y' + j; });
      var wrong = d ? others.concat(['Noben']) : [k].concat([0, 1, 2, 3].filter(function (j) { return j !== k; }).slice(0, 2)).map(function (j) { return 'Y' + j; });
      return Object.assign({ params: { d: d, k: k },
        q: 'Demultiplekser 1→4 ima D = ' + d + ' in S1S0 = ' + s + '. Kateri izhod je 1?',
        hint: 'Kaj demultiplekser pošlje na izbrani izhod, če je podatek D enak ' + d + '?',
        sol: d ? 'Izbran je Y' + k + ', vanj pride D = 1. Vsi ostali izhodi so 0, zato je 1 samo Y' + k + '.' : 'Izbran je Y' + k + ', vanj pride D = 0. Vsi ostali izhodi so tudi 0, zato ni nobenega izhoda z vrednostjo 1.' },
      r.mc(right, wrong));
    },
    11: function (r) {
      var a = r.int(0, 3), b = r.int(0, 3), rel = relOf(a, b), on = rel === 'lt';
      var word = function (x) { return x ? 'vklopljeno' : 'izklopljeno'; };
      var text = function (k, x) { return REL[k] + ', ogrevanje je ' + word(x); };
      var others = ['lt', 'gt', 'eq'].filter(function (k) { return k !== rel; });
      var A = bin(a, 2), B = bin(b, 2), step = A[0] !== B[0]
        ? 'Višja bita se razlikujeta (' + A[0] + ' in ' + B[0] + '), zato odločata ona.'
        : 'Višja bita sta enaka (' + A[0] + ' = ' + B[0] + '), zato odloča nižji: A0 = ' + A[1] + ', B0 = ' + B[1] + '.';
      return Object.assign({ params: { a: a, b: b },
        q: 'Termostat primerja izmerjeno temperaturo A = ' + A + ' (stopnja ' + a + ') z nastavljeno B = ' + B + ' (stopnja ' + b + '). Ogrevanje se vklopi, ko je A manjši od B. Kaj velja?',
        hint: 'Najprej primerjaj višja bita (' + A[0] + ' in ' + B[0] + '), nato nižja.',
        sol: step + ' Torej ' + REL[rel] + ' in ogrevanje je ' + word(on) + '.' },
      r.mc(text(rel, on), [text(rel, !on), text(others[0], true), text(others[1], true)]));
    },
    14: function (r) {
      var n = r.int(0, 7), s = bin(n, 3), up = n < 4, k = n & 3, c = bin(k, 2), box = function (x) { return x ? 'Zgornji MUX' : 'Spodnji MUX'; };
      var range = up ? 'I0 do I3' : 'I4 do I7', base = up ? 0 : 4, ord = ['prvi', 'drugi', 'tretji', 'četrti'][k];
      var wrong = [box(!up) + ', vhod I' + (n ^ 4), box(up) + ', vhod I' + (base + ((k + 1) & 3)), box(up) + ', vhod I' + (base + ((k + 2) & 3))];
      return Object.assign({ params: { n: n },
        q: 'MUX 8→1 sestavimo iz dveh MUX 4→1 (zgornji I0 do I3, spodnji I4 do I7) in enega MUX 2→1, ki ga vodi S2. Pri S2S1S0 = ' + s + ': kateri MUX 4→1 prispeva signal in kateri vhod pride na izhod Y?',
        hint: 'S2 = ' + s[0] + ' izbere ' + (up ? 'zgornji' : 'spodnji') + ' MUX. Znotraj njega S1S0 = ' + c + ' izbere ' + ord + ' vhod.',
        sol: 'S2 = ' + s[0] + ' izbere ' + (up ? 'zgornji' : 'spodnji') + ' MUX 4→1 (vhodi ' + range + '). V njem S1S0 = ' + c + ' izbere ' + ord + ' vhod, to je I' + n + '. Cela kombinacija ' + s + ' je dvojiško ' + n + ', zato Y = I' + n + '.' },
      r.mc(box(up) + ', vhod I' + n, wrong));
    },
    15: function (r) {
      var inv = function (x) { return x.split('').map(function (c) { return c === '1' ? '0' : '1'; }).join(''); };
      var s, rev, wrong;
      // Patterns like 01010101 have too few different wrong answers.
      do {
        s = bin(r.int(0, 255), 8);
        rev = s.split('').reverse().join('');
        wrong = [s, s.slice(4) + s.slice(0, 4), inv(rev), inv(s), rev.slice(1) + rev[0]].filter(function (w, k, all) { return w !== rev && all.indexOf(w) === k; });
      } while (s === rev || wrong.length < 3);
      var parts = rev.split('').map(function (c, k) { return 'I' + k + ' = ' + c; }).join(', ');
      return Object.assign({ params: { s: s },
        q: 'Osem bitov I7 … I0 = ' + s + ' pošiljamo serijsko prek MUX 8→1. Števec S2S1S0 šteje od 000 do 111, na izhodu se najprej pojavi I0. Kakšen je serijski niz (prvi poslan bit je levo)?',
        hint: 'Prvi se pošlje I0, zadnji I7. Podatke preberi od desne proti levi.',
        sol: parts + '. Niz je ' + rev + ', torej obrnjen podatek.' },
      r.mc(rev, wrong));
    },
  };
  LavelsVariants.run(gens, TASKS);
})();
