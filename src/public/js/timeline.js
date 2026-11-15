// Pop-up for the timeline on the teacher's student page. Hover, a touch or drag across the bars, and the arrow keys all show it.
// The text of each pop-up is in the page itself, in a <template> inside its column.
(() => {
  const bars = document.querySelector('.bars');
  if (!bars) return;
  const cols = [...bars.querySelectorAll('.bar-col')];
  if (!cols.length) return;
  cols.forEach((c) => c.removeAttribute('title')); // the plain tooltip is only the fallback without this script
  const tip = document.createElement('div');
  tip.className = 'tl-tip-box';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true'); // every column already says the same in its aria-label
  document.body.appendChild(tip);

  let on = null;
  const hide = () => {
    if (on) on.classList.remove('on');
    on = null;
    tip.hidden = true;
  };
  const place = (col) => {
    const r = col.getBoundingClientRect();
    const b = bars.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), Math.max(8, innerWidth - w - 8))}px`;
    // Above the bars when there is room, otherwise below them and their dates.
    tip.style.top = `${Math.max(8, b.top - h - 8 >= 8 ? b.top - h - 8 : Math.min(b.bottom + 36, innerHeight - h - 8))}px`;
  };
  const show = (col) => {
    if (col === on) return;
    if (on) on.classList.remove('on');
    on = col;
    col.classList.add('on');
    tip.replaceChildren(col.querySelector('template').content.cloneNode(true));
    tip.hidden = false;
    place(col);
  };

  // Every column is as tall as the chart, so the pointer finds it anywhere above its bar, and a finger can slide across them.
  const at = (e) => {
    const r = bars.getBoundingClientRect();
    return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(((e.clientX - r.left) / r.width) * cols.length)))];
  };
  bars.addEventListener('pointermove', (e) => show(at(e)));
  bars.addEventListener('pointerdown', (e) => show(at(e)));
  bars.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); }); // a finger lifted off the chart leaves the text to read
  document.addEventListener('pointerdown', (e) => { if (!bars.contains(e.target)) hide(); });
  addEventListener('scroll', hide, { passive: true });
  addEventListener('resize', hide);

  // Keyboard: one tab stop for the chart, then the arrows walk along the columns.
  bars.addEventListener('focusin', (e) => { const c = e.target.closest('.bar-col'); if (c) show(c); });
  bars.addEventListener('focusout', hide);
  bars.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return hide();
    const i = cols.indexOf(document.activeElement);
    const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: cols.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    const next = cols[Math.max(0, Math.min(cols.length - 1, to))];
    cols.forEach((c) => { c.tabIndex = -1; });
    next.tabIndex = 0;
    next.focus();
  });
})();
