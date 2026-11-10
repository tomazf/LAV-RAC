/* Gate symbols as IEC rectangles with the label inside (agreed 10. 11. 2026). Inserted into the artifact by content/adapters/2.2.js
   in front of the artifact's own ANSI/IEEE drawing, which stays only as gateSvgAnsi / gBodyAnsi for the comparison table in the introduction.
   They use the artifact's GM (names and labels) and G_ (family, negation) tables. */
const iecLab = t => GM[t][1].replace("&", "&amp;");

/* the gate as a picture of its own (gate laboratory, tasks A1-A4, comparison table) */
function gateSvg(t, cls){
  const inv = /^(NAND|NOR|XNOR|NOT)$/.test(t), u = t === "NOT";
  const x0 = u ? 34 : 30, w = u ? 30 : 40, y0 = u ? 11 : 4, h = u ? 28 : 42, x1 = x0 + w;
  const wires = (u ? `M0 25H${x0}` : `M0 15H${x0}M0 35H${x0}`) + `M${x1 + (inv ? 8 : 0)} 25H100`;
  return `<svg ${cls ? `class="${cls}" ` : ""}viewBox="0 0 100 50" role="img" aria-label="${GM[t][0]}"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/><path d="${wires}"/>${inv ? `<circle cx="${x1 + 4}" cy="25" r="4"/>` : ""}<text x="${x0 + w / 2}" y="25.5" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none" font-size="17" font-weight="700" style="font-family:var(--f-mono)">${iecLab(t)}</text></g></svg>`;
}

/* the body used by every circuit (two-level circuits, De Morgan symbols, adders): same contract as the artifact's gBody */
function gBody(t, H){
  const [fam, inv] = G_[t];
  const W = fam === "not" ? 30 : 40, h = fam === "not" ? Math.min(H, 28) : H;
  return { W, H: h, body: `M0 0H${W}V${h}H0Z`, inv, pinX: () => 0, fam,
    xr: `<text class="gl" x="${W / 2}" y="${h / 2 + .5}" text-anchor="middle" dominant-baseline="central">${iecLab(t)}</text>` };
}
