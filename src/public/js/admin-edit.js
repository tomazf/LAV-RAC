// The edit windows of the admin lists (classes, users): the pencil opens one, Cancel, Escape or a click outside closes it.
(() => {
  for (const b of document.querySelectorAll('[data-edit]')) {
    b.addEventListener('click', () => document.getElementById(b.dataset.edit)?.showModal());
  }
  for (const d of document.querySelectorAll('dialog.edit-dlg')) {
    for (const b of d.querySelectorAll('[data-close]')) b.addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // the backdrop belongs to the dialog itself
    // A class can only revisit years below its own: the boxes of the other years are off while its year is chosen.
    const year = d.querySelector('[data-year]');
    if (year) {
      const sync = () => {
        for (const box of d.querySelectorAll('[data-past] input')) {
          box.disabled = !(Number(year.value) > Number(box.value));
          if (box.disabled) box.checked = false;
        }
      };
      year.addEventListener('change', sync);
    }
  }
})();
