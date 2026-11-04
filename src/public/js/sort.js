// Switches a list between the order by name and by surname. The order itself comes from the server.
(function () {
  document.querySelectorAll('[data-sort-for]').forEach(function (bar) {
    var list = document.querySelector(bar.dataset.sortFor);
    var buttons = bar.querySelectorAll('button[data-sort]');
    if (!list) return;
    bar.hidden = false;
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.dataset.sort;
        Array.prototype.slice.call(list.children)
          .sort(function (a, b) { return Number(a.dataset[key]) - Number(b.dataset[key]); })
          .forEach(function (item) { list.appendChild(item); });
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      });
    });
  });
})();
