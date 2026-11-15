// End of the school year: "all" / "none" for the students of one class, the count beside them, and the live list of
// who is erased and who is left without a class (shown before the confirmation).
(function () {
  var form = document.querySelector('.year-end');
  function count(card) {
    var boxes = card.querySelectorAll('input[type=checkbox]');
    var on = card.querySelectorAll('input[type=checkbox]:checked').length;
    var out = card.querySelector('[data-count]');
    if (out) out.textContent = on + ' od ' + boxes.length + ' označenih';
  }
  function names(sel) {
    return Array.prototype.map.call(form.querySelectorAll(sel), function (b) { return b.closest('label').textContent.trim(); });
  }
  function fill(key, list) {
    var p = form.querySelector('[data-sum=' + key + ']');
    if (!p) return;
    list.sort(function (a, b) { return a.localeCompare(b, 'sl'); });
    p.hidden = !list.length;
    p.querySelector('[data-n]').textContent = list.length;
    p.querySelector('[data-names]').textContent = list.join(', ');
  }
  function sum() {
    if (!form) return;
    var erase = names('input[name=erase]:checked');
    fill('erase', erase);
    fill('free', names('input[name=erase]:not(:checked)').concat(names('input[name=keep]:not(:checked)')));
    var ack = form.querySelector('[data-ack]');
    if (ack) { ack.hidden = !erase.length; ack.querySelector('input').required = erase.length > 0; }
  }
  document.querySelectorAll('.year-card').forEach(function (card) {
    card.querySelectorAll('button[data-check]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('data-check') === 'all';
        card.querySelectorAll('input[type=checkbox]').forEach(function (b) { b.checked = on; });
        count(card);
        sum();
      });
    });
    card.addEventListener('change', function () { count(card); sum(); });
    count(card);
  });
  sum();
})();
