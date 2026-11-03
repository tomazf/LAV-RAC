(function () {
  document.querySelectorAll('form[data-autosubmit] input[type=checkbox]').forEach(function (box) {
    box.addEventListener('change', function () { box.form.submit(); });
  });
})();
