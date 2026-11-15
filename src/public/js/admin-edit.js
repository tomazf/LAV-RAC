// The edit windows of the admin lists (classes, users): the pencil opens one, Cancel, Escape or a click outside closes it.
(() => {
  for (const b of document.querySelectorAll('[data-edit]')) {
    b.addEventListener('click', () => document.getElementById(b.dataset.edit)?.showModal());
  }
  for (const d of document.querySelectorAll('dialog.edit-dlg')) {
    for (const b of d.querySelectorAll('[data-close]')) b.addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // the backdrop belongs to the dialog itself
    // A person is a student (one class) or a teacher (any number of classes): only the matching part is shown.
    if (d.querySelector('[data-roles]')) {
      const panels = () => {
        const teacher = d.querySelector('input[name=role]:checked')?.value === 'teacher';
        for (const p of d.querySelectorAll('[data-panel]')) p.hidden = (p.dataset.panel === 'teacher') !== teacher;
      };
      for (const r of d.querySelectorAll('input[name=role]')) r.addEventListener('change', panels);
      panels();
    }
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
