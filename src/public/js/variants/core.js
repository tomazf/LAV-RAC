// Gives each student's attempt its own numbers. Runs after an exercise defines its tasks and before it draws them.
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
    var r = {
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      shuffle: function (list) {
        var out = list.slice();
        for (var i = out.length - 1; i > 0; i--) { var j = r.int(0, i), x = out[i]; out[i] = out[j]; out[j] = x; }
        return out;
      },
      // A multiple choice with the correct answer in a random place.
      mc: function (correct, wrong) {
        var c = String(correct), seen = {}, opts = [];
        seen[c] = true;
        wrong.forEach(function (w) { w = String(w); if (!seen[w] && opts.length < 3) { seen[w] = true; opts.push(w); } });
        var ans = r.int(0, opts.length);
        opts.splice(ans, 0, c);
        return { opts: opts, ans: ans };
      },
    };
    return r;
  }
  var gens = {}, list = [];
  function apply(tasks) {
    list = tasks;
    var v = window.__LAVELS && window.__LAVELS.variant;
    if (!v || v.seed === null || v.seed === undefined) return;
    Object.keys(gens).forEach(function (key) {
      var i = Number(key);
      if (v.keep.indexOf(i) >= 0 || !tasks[i]) return;
      var s = gens[i](rng(v.seed, i));
      delete s.params;
      Object.assign(tasks[i], s);
    });
  }
  return {
    sample: function (index, seed) { return gens[index](rng(seed, index)); },
    indexes: function () { return Object.keys(gens).map(Number); },
    tasks: function () { return list; },
    define: function (generators) { gens = generators; },
    apply: apply,
    run: function (generators, tasks) { gens = generators; apply(tasks); },
  };
})();
