// Exercise 3.1: ranges agreed in "LAV-ELS: naloge s spremenljivimi števili".
(function () {
  'use strict';
  var bin = function (n, w) { return n.toString(2).padStart(w, '0'); };
  var tc = function (n, w) { return bin(n < 0 ? (1 << w) + n : n, w); };
  var neg = function (n) { return String(n).replace('-', '−'); };
  var sub = function (s, w) { return s.slice(0, s.length - w) + ' ' + s.slice(s.length - w); };
  var hex = function (n) { return n.toString(16).toUpperCase().padStart(4, '0'); };
  var FA = function (a, b, c) { var n = a + b + c; return { n: n, s: n & 1, c: n >> 1 }; };
  var gens = {
    4: function (r) {
      var a = r.int(0, 1), b = r.int(0, 1), c = r.int(0, 1), f = FA(a, b, c);
      return { params: { a: a, b: b, c: c },
        q: 'Polni seštevalnik ima A = ' + a + ', B = ' + b + ', Cin = ' + c + '. Kakšna sta izhoda?', a: f.s + 2 * f.c,
        h: ['Seštej desetiško: ' + a + ' + ' + b + ' + ' + c + '.', f.n + ' zapiši z dvema bitoma: ' + f.n + ' = ' + bin(f.n, 2) + '₂ (Cout, S).'],
        sol: a + ' + ' + b + ' + ' + c + ' = ' + f.n + ' = ' + bin(f.n, 2) + '₂, zato je S = ' + f.s + ' in Cout = ' + f.c + '.' };
    },
    13: function (r) {
      var a = r.int(0, 1), b = r.int(0, 1), c = r.int(0, 1), P = a ^ b, G = a & b, Q = P & c, S = P ^ c, O = G | Q;
      return { params: { a: a, b: b, c: c },
        q: 'Polni seštevalnik iz dveh polovičnih ima A = ' + a + ', B = ' + b + ', Cin = ' + c + '. Določi vmesne signale in izhoda.',
        f: [{ l: 'P = A ⊕ B', a: [String(P)] }, { l: 'G = A · B', a: [String(G)] }, { l: 'Q = P · Cin', a: [String(Q)] }, { l: 'S', a: [String(S)] }, { l: 'Cout', a: [String(O)] }],
        h: ['P in G dobiš v HA1 iz A in B.', 'HA2: S = P ⊕ Cin in Q = P · Cin. Na koncu Cout = G + Q.'],
        sol: 'P = ' + P + ', G = ' + G + ', Q = ' + P + ' · ' + c + ' = ' + Q + ', S = ' + P + ' ⊕ ' + c + ' = ' + S + ', Cout = ' + G + ' + ' + Q + ' = ' + O + '.' };
    },
    15: function (r) {
      var a = r.int(0, 3), b = r.int(0, 3), s = a + b, t = bin(s, 3);
      return { params: { a: a, b: b },
        q: '2-bitni seštevalnik: izračunaj ' + bin(a, 2) + '₂ + ' + bin(b, 2) + '₂. Odgovor vpiši s 3 biti (Cout S₁ S₀).', a: [t],
        h: ['Desetiško: ' + a + ' + ' + b + ' = ?', s + ' = ' + t + '₂.'],
        sol: bin(a, 2) + '₂ + ' + bin(b, 2) + '₂ = ' + a + ' + ' + b + ' = ' + s + ' = <b class="m">' + t + '</b>₂ (Cout = ' + t[0] + ', S₁ = ' + t[1] + ', S₀ = ' + t[2] + ').' };
    },
    16: function (r) {
      var a = r.int(1, 14), b = r.int(1, 15 - a), s = a + b, t = bin(s, 4);
      return { params: { a: a, b: b },
        q: '4-bitni seštevalnik sešteje ' + bin(a, 4) + ' + ' + bin(b, 4) + '. Nastavi izhode (klikaj bite).', tgt: '0' + t,
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + '.', s + ' = ' + t + '₂. Rezultat gre v 4 bite, zato je Cout = 0.'],
        sol: a + ' + ' + b + ' = ' + s + ' = ' + t + '₂: Cout = 0, S = ' + t + '.' };
    },
    18: function (r) {
      var a = r.int(1, 15), b = r.int(Math.max(1, 8 - a), Math.min(15, 25 - a)), s = a + b, c = s >> 4, t = bin(s & 15, 4);
      return { params: { a: a, b: b },
        q: '4-bitni seštevalnik: ' + bin(a, 4) + ' + ' + bin(b, 4) + '.', f: [{ l: 'S (4 biti)', a: [t] }, { l: 'Cout', a: [String(c)] }],
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + '.', c ? s + ' = ' + bin(s, 5) + '₂. Najvišja enica je Cout, preostali 4 biti so S.' : s + ' = ' + t + '₂. Rezultat gre v 4 bite, zato je Cout = 0.'],
        sol: a + ' + ' + b + ' = ' + s + ' = ' + (c ? sub(bin(s, 5), 4) : t) + '₂: S = ' + t + ', Cout = ' + c + '.' };
    },
    22: function (r) {
      var a = r.int(64, 240), b = r.int(64, 240), s = a + b, c = s >> 8, t = bin(s & 255, 8);
      return { params: { a: a, b: b },
        q: '8-bitni seštevalnik: ' + bin(a, 8) + ' + ' + bin(b, 8) + '.', f: [{ l: 'S (8 bitov)', a: [t] }, { l: 'Cout', a: [String(c)] }],
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + '.', c ? s + ' = 256 + ' + (s - 256) + '. Del 256 je Cout, ' + (s - 256) + ' ostane v S.' : s + ' je manj kot 256, zato je Cout = 0.'],
        sol: a + ' + ' + b + ' = ' + s + ': S = ' + t + ', Cout = ' + c + '.' };
    },
    24: function (r) {
      var a = r.int(0xA0, 0xFF), b = r.int(1, 0xFF), s = a + b;
      return { params: { a: a, b: b },
        q: '16-bitni seštevalnik: A = ' + hex(a) + '₁₆, B = ' + hex(b) + '₁₆. Vpiši vsoto šestnajstiško (4 števke) in Cout.',
        f: [{ l: 'S (šestnajstiško)', a: [hex(s)] }, { l: 'Cout', a: ['0'] }],
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + '.', 'Rezultat je manjši od FFFF₁₆, zato je Cout = 0.'],
        sol: hex(a) + ' + ' + hex(b) + ' = ' + hex(s) + '₁₆ (' + a + ' + ' + b + ' = ' + s + '), Cout = 0.' };
    },
    25: function (r) {
      var over = r.int(0, 1) === 1, a = over ? r.int(1, 127) : r.int(1, 126), b = over ? r.int(128 - a, 127) : r.int(1, 127 - a), s = a + b;
      var c7 = s >> 7, res = bin(s, 8);
      return { params: { a: a, b: b },
        q: 'Števila s predznakom (8 bitov): ' + bin(a, 8) + ' + ' + bin(b, 8) + '. Ali pride do prekoračitve (V = 1)?', a: over ? 0 : 1,
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + '. Ali je ' + s + ' v obsegu −128 … 127?', 'Prenos v bit 7 je c₇, prenos iz bita 7 (Cout) je c₈. V = c₇ ⊕ c₈.'],
        sol: (over ? 'Da. ' : 'Ne. ') + 'c₇ = ' + c7 + ', c₈ = 0, V = ' + c7 + ' ⊕ 0 = ' + c7 + '. ' + (over ? 'Rezultat ' + res + ' se prebere kot ' + neg(s - 256) + ' namesto +' + s + '.' : 'Rezultat ' + res + ' je pravilen: +' + s + '.') };
    },
    26: function (r) {
      var over = r.int(0, 1) === 1, a = over ? r.int(-128, -1) : r.int(-127, -1), b = over ? r.int(-128, -129 - a) : r.int(-128 - a, -1), s = a + b;
      var ua = a + 256, ub = b + 256, c7 = ((ua & 127) + (ub & 127)) >> 7, c8 = (ua + ub) >> 8, res = bin((ua + ub) & 255, 8);
      return { params: { a: a, b: b },
        q: 'Števila s predznakom (8 bitov): ' + bin(ua, 8) + ' + ' + bin(ub, 8) + '. Ali pride do prekoračitve?', a: over ? 0 : 1,
        h: ['Pretvori: ' + bin(ua, 8) + ' = ' + neg(a) + ', ' + bin(ub, 8) + ' = ' + neg(b) + '.', 'Ali je ' + neg(s) + ' še v obsegu −128 … 127? Preveri tudi c₇ in c₈.'],
        sol: (over ? 'Da. ' : 'Ne. ') + neg(a) + ' + (' + neg(b) + ') = ' + neg(s) + (over ? ', kar je zunaj obsega. ' : ' = ' + res + '. ') + 'c₇ = ' + c7 + ', c₈ = ' + c8 + ', V = ' + (c7 ^ c8) + '. ' + (over ? 'Rezultat ' + res + ' se prebere kot +' + ((ua + ub) & 255) + '.' : 'Cout = 1 tu ni napaka.') };
    },
    27: function (r) {
      var a = r.int(1, 7), b = r.int(1, 7), s = a + b, c3 = s >> 3, t = bin(s, 4);
      return { params: { a: a, b: b },
        q: '4-bitni seštevalnik, števila s predznakom: ' + bin(a, 4) + ' + ' + bin(b, 4) + '.', f: [{ l: 'S (4 biti)', a: [t] }, { l: 'Cout', a: ['0'] }, { l: 'V', a: [String(c3)] }],
        h: ['Desetiško: ' + a + ' + ' + b + ' = ' + s + ', 4-bitni obseg s predznakom pa je −8 … 7.', 'Prenos v bit 3 je c₃ = ' + c3 + ', Cout = c₄ = 0. V = c₃ ⊕ c₄.'],
        sol: 'S = ' + t + (c3 ? ' (prebrano ' + neg(s - 16) + ', kar je narobe)' : ' = ' + s) + ', Cout = 0, V = ' + c3 + ' ⊕ 0 = ' + c3 + (c3 ? ': prekoračitev.' : ': ni prekoračitve.') };
    },
    30: function (r) {
      var n = r.int(1, 7), p = bin(n, 4), inv = bin(15 - n, 4), t = tc(-n, 4);
      return { params: { n: n },
        q: 'Zapiši −' + n + ' v 4-bitnem dvojiškem komplementu.', a: [t],
        h: [n + ' = ' + p + '. Invertiraj vse bite.', inv + ' + 1 = ?'],
        sol: p + ' → ' + inv + ' → + 1 → <b class="m">' + t + '</b>.' };
    },
    35: function (r) {
      var n = r.int(2, 100), p = bin(n, 8), inv = bin(255 - n, 8), t = tc(-n, 8);
      return { params: { n: n },
        q: 'Zapiši −' + n + ' v 8-bitnem dvojiškem komplementu.', a: [t],
        h: [n + ' = ' + p + '.', 'Invertiraj (' + inv + ') in prištej 1.'],
        sol: p + ' → ' + inv + ' → + 1 → <b class="m">' + t + '</b>.' };
    },
    36: function (r) {
      var a = r.int(2, 15), b = r.int(1, a - 1), nb = 15 - b, res = bin(a - b, 4), sum = bin(a + nb + 1, 5);
      return { params: { a: a, b: b },
        q: '4 biti: izračunaj ' + bin(a, 4) + ' − ' + bin(b, 4) + ' s komplementom.', f: [{ l: 'NOT B', a: [bin(nb, 4)] }, { l: 'Rezultat (4 biti)', a: [res] }, { l: 'Cout', a: ['1'] }],
        h: ['NOT ' + bin(b, 4) + ' = ' + bin(nb, 4) + ', c₀ = 1.', bin(a, 4) + ' + ' + bin(nb, 4) + ' + 1 = ' + sum + '. Najvišji bit je Cout.'],
        sol: 'NOT B = ' + bin(nb, 4) + '. ' + bin(a, 4) + ' + ' + bin(nb, 4) + ' + 1 = ' + sub(sum, 4) + ': rezultat ' + res + ' = ' + (a - b) + ', Cout = 1 (A ≥ B).' };
    },
    40: function (r) {
      var a = r.int(10, 60), b = r.int(1, a - 1), nb = 255 - b, m = bin(nb + 1, 8), res = bin(a - b, 8), sum = bin(a + nb + 1, 9);
      return { params: { a: a, b: b },
        q: '8 bitov: izračunaj ' + bin(a, 8) + ' − ' + bin(b, 8) + ' (' + a + ' − ' + b + '). Vpiši 8-bitni rezultat.', a: [res],
        h: ['NOT ' + bin(b, 8) + ' = ' + bin(nb, 8) + ', nato prištej 1: ' + m + '.', bin(a, 8) + ' + ' + m + ' = ' + sub(sum, 8) + '. Cout zavrzi.'],
        sol: bin(a, 8) + ' + ' + m + ' = ' + sub(sum, 8) + '. Rezultat <b class="m">' + res + '</b> = ' + (a - b) + '.' };
    },
    41: function (r) {
      var a = r.int(1, 29), b = r.int(a + 1, 30), nb = 255 - b, m = bin(nb + 1, 8), res = tc(a - b, 8);
      return { params: { a: a, b: b },
        q: '8 bitov: izračunaj ' + bin(a, 8) + ' − ' + bin(b, 8) + ' (' + a + ' − ' + b + ').', f: [{ l: 'Rezultat (8 bitov)', a: [res] }, { l: 'Desetiško s predznakom', a: [String(a - b)] }, { l: 'Cout', a: ['0'] }],
        h: ['NOT ' + bin(b, 8) + ' = ' + bin(nb, 8) + ', + 1 = ' + m + '.', bin(a, 8) + ' + ' + m + ' = ? Cout = 0 pomeni A < B.'],
        sol: bin(a, 8) + ' + ' + m + ' = ' + res + ' = ' + neg(a - b) + ', Cout = 0 (pravi rezultat je negativen).' };
    },
    42: function (r) {
      var over = r.int(0, 1) === 1, a, b, d;
      do { a = r.int(-8, 7); b = r.int(-8, 7); d = a - b; } while ((d < -8 || d > 7) !== over);
      var ua = a & 15, ub = b & 15, nb = 15 - ub, s = ua + nb + 1, c4 = s >> 4, c3 = ((ua & 7) + (nb & 7) + 1) >> 3, res = bin(s & 15, 4);
      var show = neg(a) + ' − ' + (b < 0 ? '(' + neg(b) + ')' : b);
      var sr = s & 15, val = sr > 7 ? sr - 16 : sr;
      return { params: { a: a, b: b },
        q: '4 biti s predznakom: ' + bin(ua, 4) + ' − ' + bin(ub, 4) + ', torej ' + show + '. Ali pride do prekoračitve?', a: over ? 0 : 1,
        h: ['Desetiško: ' + show + ' = ' + neg(d) + '. Je ' + neg(d) + ' v obsegu −8 … 7?', 'Izračunaj ' + bin(ua, 4) + ' + ' + bin(nb, 4) + ' + 1 in primerjaj c₃ ter c₄.'],
        sol: (over ? 'Da. ' : 'Ne. ') + bin(ua, 4) + ' + ' + bin(nb, 4) + ' + 1 = ' + res + ' (' + neg(val) + '), c₃ = ' + c3 + ', c₄ = ' + c4 + ', V = ' + (c3 ^ c4) + '.' };
    },
  };
  LavelsVariants.define(gens);
})();
