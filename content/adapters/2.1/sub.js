/* Subtraction as addition of the complement, with the carries drawn from column to column (agreed 10. 11. 2026).
   Inserted into the artifact by content/adapters/2.1.js; it uses the artifact's own helpers (al, sub, dc, dg, stripZ, esc). */
const CS_NAMES = {
  2: { c1: "eniški komplement", c2: "dvojiški komplement", rule: "vsak bit obrneš (0 postane 1, 1 postane 0)" },
  8: { c1: "komplement do 7", c2: "komplement do 8", rule: "vsako števko d zamenjaš s 7 − d" },
  16: { c1: "komplement do F", c2: "komplement do 16", rule: "vsako števko d zamenjaš s F − d (F je 15)" },
};

/* x + y for digit-value arrays of equal length (most significant first). cin[i] enters column i, cout leaves the leftmost column. */
function addDigits(x, y, base) {
  const L = x.length, res = Array(L), cin = Array(L).fill(0);
  let c = 0;
  for (let i = L - 1; i >= 0; i--) { cin[i] = c; const t = x[i] + y[i] + c; res[i] = t % base; c = t >= base ? 1 : 0; }
  return { res, cin, cout: c };
}

/* One aligned grid. rows: {l, d (array of characters), k, ln}. With carry = {cin, cout} a carry row is drawn on top:
   a ring with 1 above every column that receives a carry and an arrow between the columns it travels from and to. */
function csGrid(rows, w, carry) {
  const arrow = on => `<td class="ar${on ? " on" : ""}">${on ? "◀" : ""}</td>`;
  let h = `<div class="tbl fit"><table class="al cs"><tbody>`;
  if (carry) {
    h += `<tr class="carry"><th scope="row">prenos</th><td class="ch ov"><b class="${carry.cout ? "on disc" : "none"}">${carry.cout}</b></td>`;
    for (let i = 0; i < w; i++) h += arrow((i === 0 ? carry.cout : carry.cin[i - 1]) === 1) + `<td class="ch">${carry.cin[i] ? `<b class="on">1</b>` : ""}</td>`;
    h += `</tr>`;
  }
  for (const r of rows) {
    h += `<tr class="${r.k || "num"}${r.ln ? " ln" : ""}"><th scope="row">${r.l || ""}</th>${carry ? `<td class="ov"></td>` : ""}`;
    for (let i = 0; i < w; i++) h += (carry ? `<td class="ar"></td>` : "") + `<td>${r.d[i]}</td>`;
    h += `</tr>`;
  }
  return h + `</tbody></table></div>`;
}

function subGraph(A, B, base) {
  const s = sub(base), va = parseInt(A, base), vb = parseInt(B, base), nm = CS_NAMES[base], top = base - 1;
  const w = Math.max(A.length, B.length);
  const dv = str => [...str.padStart(w, "0")].map(dg), ch = arr => arr.map(dc);
  const a = dv(A), b = dv(B), one = [...Array(w - 1).fill(0), 1];
  const comp = b.map(d => top - d);
  const s2 = addDigits(comp, one, base);       // -B
  const s3 = addDigits(a, s2.res, base);       // A + (-B)
  const neg = va < vb;
  const R = ch(s3.res).join("");
  let steps = `<li><b>${nm.c1[0].toUpperCase() + nm.c1.slice(1)} števila B:</b> ${nm.rule}.${csGrid([{ l: "B", d: ch(b) }, { l: "", d: b.map(() => "↓"), k: "dn" }, { l: nm.c1, d: ch(comp), k: "res" }], w, null)}</li>`;
  steps += `<li><b>${nm.c2[0].toUpperCase() + nm.c2.slice(1)}: prištej 1.</b> Tako dobiš −B. Prenos, ki nastane (krožec ◀), se prepiše v stolpec na levi.${csGrid([{ l: nm.c1, d: ch(comp) }, { l: "+ 1", d: ch(one), ln: true }, { l: "−B", d: ch(s2.res), k: "res" }], w, s2)}</li>`;
  steps += `<li><b>Seštej A + (−B).</b> Prenos nastane, ko vsota stolpca doseže ${base}: zapišeš ostanek, prenos 1 pa gre v naslednji stolpec levo.${csGrid([{ l: "A", d: ch(a) }, { l: "+ (−B)", d: ch(s2.res), ln: true }, { l: "=", d: ch(s3.res), k: "res" }], w, s3)}</li>`;
  let tail, M = null;
  if (vb === 0) {
    tail = `<li><b>Odštevanje ničle</b> števila ne spremeni, zato ostane rezultat <b>${stripZ(R)}</b>.</li>`;
  } else if (!neg) {
    tail = `<li><b>Prenos čez zgornje mesto zavržeš</b> (prekrižan krožec). Rezultat: <b>${stripZ(R)}</b>${s}. Ker je prenos nastal, je A ≥ B in je rezultat pozitiven.</li>`;
  } else {
    const compR = s3.res.map(d => top - d), s4 = addDigits(compR, one, base);
    M = stripZ(ch(s4.res).join(""));
    tail = `<li><b>Prenosa čez zgornje mesto ni</b> (krožec 0). To pomeni, da je A &lt; B in je rezultat negativen: ${R}${s} je zapisan v komplementu. Absolutno vrednost dobiš z istim postopkom (komplement, nato +1):${csGrid([{ l: "rezultat", d: ch(s3.res) }, { l: nm.c1, d: ch(compR) }, { l: "+ 1", d: ch(one), ln: true }, { l: "velikost", d: ch(s4.res), k: "res" }], w, s4)}Torej A − B = <b>−${M}</b>${s}.</li>`;
  }
  // the check reads the value off the digits that were drawn, then compares it with the plain subtraction
  const shown = neg ? `−${M}` : stripZ(R), got = neg ? -parseInt(M, base) : parseInt(R, base), val = va - vb, mi = n => String(n).replace("-", "−");
  if (got !== val) throw new Error(`subGraph: ${A} - ${B} in base ${base} gave ${got}, expected ${val}`);
  return `<div class="ex"><strong>${A}${s} − ${B}${s}</strong><p class="prv">Račun v ${w} mestih (krajše število dopolniš z ničlami na levi). Odštevanje je seštevanje komplementa: <b>A − B = A + (−B)</b>.</p>
    <ol class="stp big">${steps}${tail}</ol>
    <p class="prv"><b>Preizkus:</b> ${va} − ${vb} = ${mi(val)}, rezultat ${shown}${s} = ${mi(got)} ✓</p></div>`;
}
