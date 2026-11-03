(function () {
  document.querySelectorAll('[data-filter]').forEach(function (input) {
    var list = document.querySelector(input.dataset.filter);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      list.querySelectorAll('li').forEach(function (li) { li.hidden = q && li.textContent.toLowerCase().indexOf(q) < 0; });
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  });
})();
