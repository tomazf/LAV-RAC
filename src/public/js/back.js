(function () {
  var link = document.querySelector('[data-back]');
  link.addEventListener('click', function (e) {
    // Return to the page the user came from on this site; otherwise the link goes home.
    if (document.referrer.indexOf(location.origin + '/') === 0 && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
})();
