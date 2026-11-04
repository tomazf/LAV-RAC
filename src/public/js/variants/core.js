// Gives each student's attempt its own numbers. Runs after an exercise defines TASKS and before it draws them.
window.LavelsVariants = (function () {
  'use strict';
  function rng(seed, index) {
    var a = (seed ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
    };
  }
  var gens = {};
  return {
    sample: function (index, seed) { return gens[index](rng(seed, index)); },
    indexes: function () { return Object.keys(gens).map(Number); },
    run: function (generators, tasks) {
      gens = generators;
      var v = window.__LAVELS && window.__LAVELS.variant;
      if (!v || v.seed === null || v.seed === undefined) return;
      Object.keys(gens).forEach(function (key) {
        var i = Number(key);
        if (v.keep.indexOf(i) >= 0 || !tasks[i]) return;
        var s = gens[i](rng(v.seed, i));
        tasks[i].q = s.q; tasks[i].fields = s.fields; tasks[i].hint = s.hint; tasks[i].sol = s.sol;
      });
    },
  };
})();
