(function () {
  try {
    Object.keys(localStorage).forEach(function (k) { if (/^(scnm_|lavels_)/.test(k)) localStorage.removeItem(k); });
  } catch (e) { /* storage may be blocked */ }
  location.replace(document.getElementById('odjava').dataset.target);
})();
