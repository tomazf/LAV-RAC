// End of the school year: "all" / "none" for the students of one class, and the count beside them.
(function () {
  function count(card) {
    var boxes = card.querySelectorAll('input[type=checkbox]');
    var on = card.querySelectorAll('input[type=checkbox]:checked').length;
    var out = card.querySelector('[data-count]');
    if (out) out.textContent = on + ' od ' + boxes.length + ' označenih';
  }
  document.querySelectorAll('.year-card').forEach(function (card) {
    card.querySelectorAll('button[data-check]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('data-check') === 'all';
        card.querySelectorAll('input[type=checkbox]').forEach(function (b) { b.checked = on; });
        count(card);
      });
    });
    card.addEventListener('change', function () { count(card); });
    count(card);
  });
})();
