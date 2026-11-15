// Cleanup: "all" / "none" for the listed students, the count beside them, and no deleting when nobody is ticked.
(function () {
  var form = document.querySelector('.clean-form');
  if (!form) return;
  var boxes = form.querySelectorAll('input[name=id]');
  var out = form.querySelector('[data-count]');
  var del = form.querySelector('[data-delete]');
  function count() {
    var on = form.querySelectorAll('input[name=id]:checked').length;
    out.textContent = on + ' od ' + boxes.length + ' označenih';
    del.disabled = on === 0;
  }
  form.querySelectorAll('button[data-check]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('data-check') === 'all';
      boxes.forEach(function (b) { b.checked = on; });
      count();
    });
  });
  form.addEventListener('change', count);
  count();
})();
