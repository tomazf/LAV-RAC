// Varied numbers: every generated task checked against an independent calculation, and solved through the real page.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const variants = JSON.parse(readFileSync(path.join(root, 'test/fixtures/content/variants.json'), 'utf8'));
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const SEEDS = 1500;

function page(ex, seed) {
  const boot = { variant: seed === null ? null : { seed, keep: [] } };
  const safe = (js) => `<script>${js}</script>`;
  return read(`test/fixtures/content/exercises/${ex}.html`)
    .replace('<!--LAVELS:BOOT-->', () => safe(`window.__LAVELS=${JSON.stringify(boot)}`))
    .replace('<!--LAVELS:VARIANTS-->', () => safe(read('src/public/js/variants/core.js')) + safe(read(`src/public/js/variants/${ex}.js`)));
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(ex, seed) {
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('http://lav.test/', (r) => r.fulfill({ contentType: 'text/html', body: page(ex, seed) }));
  await p.route(/lav\.test\/(?!$)/, (r) => r.abort());
  await p.goto('http://lav.test/');
  return { p, errors };
}

const conv = (n, base) => n.toString(base).toUpperCase();
const bin = (n, w) => conv(n, 2).padStart(w, '0');
const tc = (n, w) => bin(n < 0 ? 2 ** w + n : n, w);
const tc8 = (n) => tc(n, 8);
const gray = (n) => { const b = bin(n, 8); let g = b[0]; for (let i = 1; i < 8; i++) g += b[i] === b[i - 1] ? '0' : '1'; return g; };
const ungray4 = (g) => { const s = bin(g, 4); let out = s[0]; for (let i = 1; i < 4; i++) out += out[i - 1] === s[i] ? '0' : '1'; return out; };
const ones = (s) => [...s].filter((c) => c === '1').length;
const bcd = (s) => [...s].map((d) => bin(Number(d), 4)).join('');
const inRange = (x, lo, hi, what) => assert.ok(x >= lo && x <= hi, `${what}: ${x}`);
const s = (x) => String(x);
const rowsWhere = (n, f) => { const out = []; for (let m = 0; m < 2 ** n; m++) if (f((k) => (m >> (n - 1 - k)) & 1)) out.push(m); return out.join(','); };
// Evaluate a small expression in A,B,C,D by plain JavaScript, not by the exercise's own parser.
const evalExpr = (expr, n) => {
  const js = expr.replace(/·/g, '&&').replace(/\+/g, '||').replace(/¬/g, '!');
  const fn = new Function('A', 'B', 'C', 'D', `return (${js}) ? 1 : 0`);
  return rowsWhere(n, (v) => fn(!!v(0), !!v(1), !!v(2), n > 3 && !!v(3)));
};
const SEG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

const oracle = {
  '1.1': {
    1: ({ v }) => { inRange(v, 9, 19, 'v'); assert.ok(v / 10 > 0.8 && v / 10 < 2); return ['Ne vemo: napetost je v prepovedanem območju']; },
    12: ({ n }) => { inRange(n, 2, 5, 'n'); return [s(2 ** n)]; },
    13: ({ a, b, c }) => [s((a && !b) || c ? 1 : 0)],
    16: ({ list }) => {
      assert.equal(new Set(list.map((p) => `${p.v}${p.o}${p.g}`)).size, 3);
      const y = list.map((p) => (p.v && (p.o || p.g) ? 1 : 0));
      assert.ok(y.includes(0) && y.includes(1));
      return y.map(s);
    },
    17: ({ n }) => { inRange(n, 3, 6, 'n'); return [s(2 ** n)]; },
    18: ({ n }) => { inRange(n, 1, 6, 'n'); return [s(n)]; },
    21: ({ neg }) => [rowsWhere(3, (v) => ({ A: (!v(0) && v(1)) || v(2), B: (v(0) && !v(1)) || v(2), C: (v(0) && v(1)) || !v(2) })[neg])],
  },
  '1.2': {
    2: ({ n }) => { inRange(n, 1, 14, 'n'); return ['0', '1']; },
    15: ({ list }) => { assert.notEqual(ones(bin(list[0], 3)) % 2, ones(bin(list[1], 3)) % 2); return list.map((m) => s(ones(bin(m, 3)) % 2)); },
    17: ({ d, k }) => { inRange(d, 1, 14, 'd'); return [bin(k ? d ^ 15 : d, 4)]; },
    21: ({ n, rise }) => { inRange(n, 2, 5, 'n'); let t = 0; let out = rise; for (let i = 0; i < n; i++) { t += out ? 7 : 11; out = !out; } return [s(t)]; },
    23: ({ g, h, side }) => {
      const pins = { '1A': 1, '1B': 2, '1Y': 3, '2A': 4, '2B': 5, '2Y': 6, '3Y': 8, '3A': 9, '3B': 10, '4Y': 11, '4A': 12, '4B': 13 };
      return [s(pins[`${g}Y`]), s(pins[`${h}${side}`])];
    },
  },
  '1.3': {
    10: ({ x, y }) => { assert.notEqual(x, y); return [x < y ? '2,3' : '1,3']; },
    11: ({ out }) => [evalExpr(['A', 'B', 'C'].filter((v) => v !== out).join('·'), 3)],
    14: ({ x, y }) => { assert.notEqual(x, y); return [x < y ? '2,3' : '1,3']; },
    18: ({ z }) => [evalExpr(`(${['A', 'B', 'C'].filter((v) => v !== z).join('·')})+${z}`, 3)],
    19: ({ lit }) => { const r = evalExpr(lit, 3); assert.equal(r.split(',').length, 4); return [r]; },
    21: ({ k }) => { inRange(k, 1, 3, 'k'); return [s(k), s(4 - k)]; },
    23: ({ target }) => { const r = evalExpr(target, 4); assert.equal(r.split(',').length, 7, target); return [r]; },
    24: ({ prod }) => {
      const zeros = evalExpr(prod, 4).split(',');
      assert.equal(zeros.length, 4);
      return [rowsWhere(4, (v) => { let m = 0; for (let k = 0; k < 4; k++) m = m * 2 + v(k); return !zeros.includes(s(m)); })];
    },
    29: ({ x, groups }) => {
      const r = evalExpr(x, 4);
      assert.equal(r.split(',').length, 6, x);
      assert.deepEqual(groups.map((g) => g.length), [4, 2]);
      return [r];
    },
  },
  '1.4': {
    0: ({ m }) => { inRange(m, 0, 7, 'm'); const b = bin(m, 3); return [['A', 'B', 'C'].map((v, i) => (b[i] === '1' ? v : `¬${v}`)).join('·')]; },
    1: ({ n }) => { inRange(n, 2, 6, 'n'); return [s(n)]; },
    2: ({ on }) => [on.join(',')],
    3: ({ x }) => [evalExpr(x, 3)],
    4: ({ x }) => [evalExpr(x, 3)],
    5: ({ on }) => { assert.equal(on.length, 5); return [on.join(',')]; },
    6: ({ on }) => { assert.equal(on.length, 4); return [on.join(',')]; },
    9: ({ list }) => { assert.notEqual(list[0], list[1]); return list.map((m) => { const b = bin(m, 3); const x = b[0] === '1' || b[1] === '1'; return s(x && b[2] === '1' ? 0 : 1); }); },
  },
    '2.1': {
      1: ({ n }) => { inRange(n, 8, 15, 'n'); return [String(n)]; },
      2: ({ n }) => { inRange(n, 8, 31, 'n'); return [conv(n, 2)]; },
      4: ({ n }) => { inRange(n, 32, 63, 'n'); return [conv(n, 2)]; },
      5: ({ n }) => { inRange(n, 128, 254, 'n'); return [String(n)]; },
      6: ({ n }) => { inRange(n, 100, 255, 'n'); return [conv(n, 16)]; },
      7: ({ n }) => { inRange(n, 16, 255, 'n'); assert.match(conv(n, 16), /[A-F]/); return [bin(n, 8)]; },
      8: ({ n }) => { inRange(n, 128, 254, 'n'); return [conv(n, 16), conv(n, 8)]; },
      9: ({ n }) => { inRange(n, 65, 255, 'n'); return [String(n)]; },
      10: ({ n }) => { inRange(n, 64, 255, 'n'); return [conv(n, 8)]; },
      15: ({ x }) => [{ 0.125: '0.001', 0.375: '0.011', 0.625: '0.101', 0.875: '0.111' }[x]],
      20: ({ a, b }) => { inRange(a + b, 260, 400, 'sum'); assert.ok(a % 10 === 0 && b % 10 === 0 && a < 256 && b < 256); return [bin(a + b - 256, 8), '1']; },
      22: ({ a, b }) => { inRange(a, 64, 240, 'a'); inRange(b, 64, 240, 'b'); assert.ok(a + b > 255); return [bin(a + b - 256, 8), '1']; },
      25: ({ n }) => { inRange(n, 2, 15, 'n'); return [tc8(-n)]; },
      26: ({ n }) => { inRange(n, 2, 16, 'n'); return [String(-n)]; },
      27: ({ n }) => { inRange(n, 17, 60, 'n'); return [tc8(-n)]; },
      29: ({ n }) => { inRange(n, 100, 127, 'n'); return [String(-n)]; },
      32: ({ a, b }) => { inRange(a, 10, 40, 'a'); inRange(b, 2, a - 1, 'b'); return [bin(a - b, 8)]; },
      33: ({ a, b }) => { inRange(a, 1, 15, 'a'); inRange(b, a + 1, 20, 'b'); return [tc8(a - b), String(a - b)]; },
      36: ({ a, b }) => { inRange(a, 40, 100, 'a'); inRange(b, 40, 100, 'b'); inRange(a + b, 128, 200, 'sum'); return [bin(a + b, 8), String(a + b - 256)]; },
      37: ({ a, b }) => { inRange(a, 100, 250, 'a'); inRange(b, 10, a - 1, 'b'); return [bin(a - b, 8), '1']; },
    },
    '2.2': {
      1: ({ n }) => { inRange(n, 0, 9, 'n'); return [bin(n, 4)]; },
      2: ({ n }) => { inRange(n, 10, 99, 'n'); return [bcd(String(n))]; },
      3: ({ n }) => { inRange(n, 100, 999, 'n'); return [String(n)]; },
      5: ({ n }) => { inRange(n, 10, 99, 'n'); return [bcd(String(n)), conv(n, 2)]; },
      6: ({ h, m }) => { inRange(h, 0, 23, 'h'); inRange(m, 0, 59, 'm'); return [bcd(String(h).padStart(2, '0') + String(m).padStart(2, '0'))]; },
      8: ({ n }) => { inRange(n, 1, 15, 'n'); return [gray(n).slice(4)]; },
      9: ({ n }) => { inRange(n, 8, 15, 'n'); return [gray(n).slice(4)]; },
      10: ({ g }) => { inRange(g, 8, 15, 'g'); return [ungray4(g)]; },
      12: ({ g }) => { inRange(g, 8, 15, 'g'); return [ungray4(g), String(parseInt(ungray4(g), 2))]; },
      13: ({ n }) => { inRange(n, 64, 200, 'n'); return [gray(n)]; },
      16: ({ c }) => { inRange(c, 65, 90, 'c'); return [String(c)]; },
      23: ({ c }) => { inRange(c, 32, 126, 'c'); return [String(ones(bin(c, 7)) % 2)]; },
      24: ({ c }) => { inRange(c, 65, 90, 'c'); const b = bin(c, 7); return [b + (ones(b) % 2)]; },
      25: ({ c }) => { inRange(c, 65, 90, 'c'); const b = bin(c, 7); return [b + (1 - ones(b) % 2)]; },
      28: ({ c }) => { inRange(c, 48, 57, 'c'); const b = bin(c, 7); return [b, b + (ones(b) % 2)]; },
    },
  '3.1': {
    4: ({ a, b, c }) => { const n = a + b + c; return [`S = ${n % 2}, Cout = ${n > 1 ? 1 : 0}`]; },
    13: ({ a, b, c }) => { const P = a ^ b; const G = a & b; const Q = P & c; return [P, G, Q, P ^ c, a + b + c > 1 ? 1 : 0].map(s); },
    15: ({ a, b }) => { inRange(a, 0, 3, 'a'); inRange(b, 0, 3, 'b'); return [bin(a + b, 3)]; },
    16: ({ a, b }) => { inRange(a + b, 2, 15, 'sum'); return [`0${bin(a + b, 4)}`]; },
    18: ({ a, b }) => { inRange(a, 0, 15, 'a'); inRange(b, 0, 15, 'b'); inRange(a + b, 8, 25, 'sum'); return [bin((a + b) % 16, 4), s(a + b > 15 ? 1 : 0)]; },
    22: ({ a, b }) => { inRange(a, 64, 240, 'a'); inRange(b, 64, 240, 'b'); return [bin((a + b) % 256, 8), s(a + b > 255 ? 1 : 0)]; },
    24: ({ a, b }) => { inRange(a, 0xA0, 0xFF, 'a'); inRange(b, 1, 0xFF, 'b'); return [conv(a + b, 16).padStart(4, '0'), '0']; },
    25: ({ a, b }) => { inRange(a, 1, 127, 'a'); inRange(b, 1, 127, 'b'); return [a + b > 127 ? 'Da' : 'Ne']; },
    26: ({ a, b }) => { inRange(a, -128, -1, 'a'); inRange(b, -128, -1, 'b'); return [a + b < -128 ? 'Da' : 'Ne']; },
    27: ({ a, b }) => { inRange(a, 1, 7, 'a'); inRange(b, 1, 7, 'b'); return [bin(a + b, 4), '0', s(a + b > 7 ? 1 : 0)]; },
    30: ({ n }) => { inRange(n, 1, 7, 'n'); return [tc(-n, 4)]; },
    35: ({ n }) => { inRange(n, 2, 100, 'n'); return [tc(-n, 8)]; },
    36: ({ a, b }) => { inRange(a, 2, 15, 'a'); inRange(b, 1, a - 1, 'b'); return [bin(15 - b, 4), bin(a - b, 4), '1']; },
    40: ({ a, b }) => { inRange(a, 10, 60, 'a'); inRange(b, 1, a - 1, 'b'); return [bin(a - b, 8)]; },
    41: ({ a, b }) => { inRange(a, 0, 29, 'a'); inRange(b, a + 1, 30, 'b'); return [tc(a - b, 8), s(a - b), '0']; },
    42: ({ a, b }) => { inRange(a, -8, 7, 'a'); inRange(b, -8, 7, 'b'); return [a - b < -8 || a - b > 7 ? 'Da' : 'Ne']; },
  },
  '3.2': {
    0: ({ k }) => [bin(k, 2)],
    1: ({ k }) => [`I${k}`],
    3: ({ d }) => { inRange(d, 0, 9, 'd'); return [bin(d, 4)]; },
    5: ({ k }) => [`Y${k}`],
    9: ({ k }) => [`celica ${k}`],
    12: ({ n }) => [s(ones(bin(n, 8)) % 2)],
    13: ({ a, b }) => { assert.ok(a < b); return [bin(b, 2)]; },
    15: ({ d }) => [s(SEG[d].length)],
    17: ({ d }) => {
      const b = bin(d, 4); const [A, B, C, D] = [...b].map(Number);
      return [s(A || C || (B && D) || (!B && !D) ? 1 : 0)];
    },
  },
  '3.3': {
    0: ({ k }) => [bin(k, 2)],
    3: ({ a, b }) => [a > b ? 'A&gt;B' : a < b ? 'A&lt;B' : 'A=B'],
    5: ({ p }) => { assert.equal(p.length, 2); return [`${bin(p[0], 2)} in ${bin(p[1], 2)}`]; },
    8: ({ d, k }) => [d ? `Y${k}` : 'Noben'],
    11: ({ a, b }) => {
      const rel = a > b ? 'A&gt;B' : a < b ? 'A&lt;B' : 'A=B';
      return [`${rel}, ogrevanje je ${a < b ? 'vklopljeno' : 'izklopljeno'}`];
    },
    14: ({ n }) => [`${n < 4 ? 'Zgornji' : 'Spodnji'} MUX, vhod I${n}`],
    15: ({ s: x }) => { const rev = [...x].reverse().join(''); assert.notEqual(rev, x); return [rev]; },
  },
};

// What the page itself would accept as the answer, in one shape for all task kinds.
const answerOf = () => {
  window.__answerOf = (t) => {
    const onOf = (x) => { const out = []; BOOL.table(BOOL.parse(x), t.vars).forEach((y, m) => { if (y) out.push(m); }); return out.join(','); };
    if (t.type === 'in') return t.fields.map((f) => f.a);
    if (t.type === 'tt') {
      const n = t.ins.length, out = [];
      for (let m = 0; m < 2 ** n; m++) { const row = []; for (let b = n - 1; b >= 0; b--) row.push((m >> b) & 1); if (t.fn(row)[0]) out.push(m); }
      return [out.join(',')];
    }
    if (t.type === 'ex' || t.type === 'grp') return [onOf(t.x)];
    if (t.type === 'km') return [onOf(t.target)];
    if (t.opts) return [t.opts[t.ans]];
    if (t.t === 'ch') return [t.o[t.a]];
    if (t.t === 'num') return [t.a[0]];
    if (t.t === 'multi') return t.f.map((f) => f.a[0]);
    if (t.t === 'bits') return [t.tgt];
    return null;
  };
};

for (const ex of Object.keys(variants)) {
  test(`${ex}: every sampled answer matches an independent calculation`, async () => {
    const { p, errors } = await open(ex, null);
    await p.evaluate(answerOf);
    const data = await p.evaluate((SEEDS) => LavelsVariants.indexes().map((i) => {
      const orig = LavelsVariants.tasks()[i];
      const shape = (t) => t.fields ? t.fields.map((f) => [f.f, f.w]).join() : t.f ? t.f.length : t.w ? t.w.join() : '';
      const list = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const v = LavelsVariants.sample(i, seed * 7919);
        const t = Object.assign({}, orig, v);
        const text = [t.q, t.hint, t.sol, ...(t.h || []), ...(t.opts || []), ...(t.o || [])].join(' ');
        const options = t.opts || t.o;
        let accepted = true;
        if (t.type === 'in') accepted = t.fields.every((f) => LIB.same(f.a, f));
        if ((t.type === 'ex' || t.type === 'grp') && t.min !== false && (t.min || t.type === 'grp')) {
          const on = t.on || (() => { const o = []; BOOL.table(BOOL.parse(t.target), t.vars).forEach((y, m) => { if (y) o.push(m); }); return o; })();
          const best = BOOL.lits(BOOL.parse(t.pos ? BOOL.pos(on, t.vars, []) : BOOL.sop(on, t.vars, [])));
          accepted = BOOL.lits(BOOL.parse(t.x)) <= best;
        }
        list.push({ params: v.params, a: window.__answerOf(t), accepted, shape: shape(t), shape0: shape(orig), key: t.q + (t.fields ? t.fields.map((f) => f.l).join() : ''),
          bad: /undefined|NaN|null|\[object/.test(text), nopts: options ? new Set(options).size : null, nopts0: options ? options.length : null, ncount: (orig.opts || orig.o || []).length,
          lvl: [v.lvl, v.lv, v.mod, v.m], sol: t.sol, q: t.q });
      }
      return [i, orig.lvl || orig.lv, orig.mod, list];
    }), SEEDS);
    assert.deepEqual(data.map((x) => x[0]), variants[ex], `${ex} list matches variants.json`);
    for (const [i, lvl, mod, list] of data) {
      const name = `${ex} #${i + 1}`;
      assert.ok(oracle[ex][i], `${name} has a check`);
      for (const v of list) {
        assert.deepEqual(v.a.map((x) => String(x).replace(/<span class="ng">(.*?)<\/span>/g, '¬$1')), oracle[ex][i](v.params), `${name} ${JSON.stringify(v.params)}`);
        assert.ok(v.accepted, `${name} accepted ${JSON.stringify(v.params)}`);
        assert.equal(v.shape, v.shape0, `${name} same kind of answer boxes`);
        assert.ok(!v.bad, `${name} text ${v.q}`);
        if (v.nopts !== null) { assert.equal(v.nopts, v.nopts0, `${name} options distinct: ${v.q}`); assert.equal(v.nopts, v.ncount, `${name} option count`); }
        if (v.lvl[0] !== undefined) assert.equal(v.lvl[0], lvl);
        if (v.lvl[2] !== undefined) assert.equal(v.lvl[2], mod);
        if (ex === '2.2' && [24, 25, 28].includes(i)) assert.ok(v.sol.includes(`beseda = ${v.a.at(-1)}`), `${name} solution shows the answer`);
      }
      assert.ok(new Set(list.map((v) => v.key)).size >= 3, `${name} variety`);
    }
    assert.deepEqual(errors, []);
    await p.close();
  });

  test(`${ex}: the correct answers earn the points on the real page`, async () => {
    for (const seed of [11, 4242, 987654]) {
      const { p, errors } = await open(ex, seed);
      await p.evaluate(answerOf);
      const out = await p.evaluate(async (list) => {
        const results = [];
        const T = LavelsVariants.tasks();
        for (const i of list) {
          const t = T[i], card = document.getElementById(`t${i}`);
          if (!card) { results.push([i, 'no card']); continue; }
          if (t.type === 'in') t.fields.forEach((f, j) => { card.querySelector(`#t${i}f${j}`).value = f.a.replace('.', ','); });
          else if (t.type === 'tt') {
            const rows = []; const n = t.ins.length;
            card.querySelectorAll('.cell').forEach((c) => {
              const m = +c.dataset.r, row = []; for (let b = n - 1; b >= 0; b--) row.push((m >> b) & 1);
              const want = t.fn(row)[+c.dataset.j]; c.click(); if (want) c.click();
            });
          } else if (t.type === 'ex') card.querySelector('input.xin').value = t.x;
          else if (t.type === 'km') {
            const on = window.__answerOf(t)[0].split(',').map(Number);
            for (const m of on) card.querySelector(`.kmh [data-m="${m}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
          } else if (t.type === 'grp') {
            for (const term of t.x.split('+')) {
              const g = []; BOOL.table(BOOL.parse(term), t.vars).forEach((y, m) => { if (y) g.push(m); });
              for (const m of g) {
                card.querySelector(`.kmh [data-m="${m}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                window.dispatchEvent(new PointerEvent('pointerup'));
              }
              card.querySelector('.gadd').click();
            }
            card.querySelector('input.xin').value = t.x;
          } else if (t.t === 'num') card.querySelector(`#t${i}-0`).value = t.a[0];
          else if (t.t === 'multi') t.f.forEach((f, k) => { card.querySelector(`#t${i}-${k}`).value = f.a[0]; });
          else if (t.t === 'bits') card.querySelectorAll('[data-tb]').forEach((b, k) => { if (t.tgt[k] === '1') b.click(); });
          else {
            const idx = t.t === 'ch' ? t.a : t.ans;
            card.querySelector(`input[name="t${i}"][value="${idx}"]`).checked = true;
          }
          card.querySelector('[data-act="check"]').click();
          const q = card.querySelector('.qt');
          results.push([i, card.querySelector('.fb').textContent, q ? q.textContent.length > 0 : true]);
        }
        return results;
      }, variants[ex]);
      for (const [i, fb] of out) assert.match(fb, /(^|\s)Pravilno/, `${ex} #${i + 1} seed ${seed}: ${fb}`);
      assert.deepEqual(errors, []);
      await p.close();
    }
  });

  test(`${ex}: without a seed the original tasks stay as they were`, async () => {
    const { p } = await open(ex, null);
    const qs = await p.evaluate(() => LavelsVariants.tasks().map((t) => t.q));
    const again = await open(ex, null);
    assert.deepEqual(await again.p.evaluate(() => LavelsVariants.tasks().map((t) => t.q)), qs);
    await p.close();
    await again.p.close();
  });
}
