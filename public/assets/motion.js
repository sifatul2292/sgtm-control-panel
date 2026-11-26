// Small motion helper for marketing pages. Plays a group's animation the first
// time it scrolls into view; a [data-replay] button inside the group plays it again.
//
//   [data-motion]     a group; gets .m-play when it should animate
//   [data-count-to]   number counts up from 0 (optional data-prefix, data-suffix, data-decimals)
//   [data-stagger]    children fade in one by one, blurred to sharp (motion.css)
//   [data-grow]       children grow up from the bottom, like chart bars (motion.css)
//   [data-fill]       element grows from the left, like a progress bar (motion.css)
//   [data-draw]       SVG paths with pathLength="1" draw themselves (motion.css)
//   [data-pop]        element pops in after the rest (motion.css)
//
// The HTML always holds the final state, so pages look complete without JS and
// with reduced motion; the hidden start state only applies under html.m-ready.
(function () {
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  var PARTS = "[data-count-to],[data-stagger],[data-grow],[data-fill],[data-draw],[data-pop]";

  // A part with no group of its own becomes its own group.
  doc.querySelectorAll(PARTS).forEach(function (el) {
    if (!el.closest("[data-motion]")) el.setAttribute("data-motion", "");
  });
  doc.querySelectorAll("[data-stagger],[data-grow]").forEach(function (list) {
    [].forEach.call(list.children, function (child, i) { child.style.setProperty("--i", i); });
  });

  function format(el, value) {
    var decimals = Number(el.getAttribute("data-decimals") || 0);
    return (el.getAttribute("data-prefix") || "") +
      value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
      (el.getAttribute("data-suffix") || "");
  }

  var counters = [].slice.call(doc.querySelectorAll("[data-count-to]"));
  counters.forEach(function (el) { el.textContent = format(el, 0); });

  function count(el) {
    var to = parseFloat(el.getAttribute("data-count-to"));
    if (!isFinite(to)) return;
    var start = null, duration = 1100;
    if (el._raf) cancelAnimationFrame(el._raf);
    function tick(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var decimals = Number(el.getAttribute("data-decimals") || 0);
      var factor = Math.pow(10, decimals);
      el.textContent = format(el, Math.round(to * eased * factor) / factor);
      if (p < 1) el._raf = requestAnimationFrame(tick);
    }
    el._raf = requestAnimationFrame(tick);
  }

  function play(group) {
    group.classList.remove("m-play");
    void group.offsetWidth; // restart CSS animations
    group.classList.add("m-play");
    counters.forEach(function (el) { if (el.closest("[data-motion]") === group) count(el); });
  }

  root.classList.add("m-ready");

  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      seen.unobserve(entry.target);
      play(entry.target);
    });
  }, { threshold: 0.35 });
  doc.querySelectorAll("[data-motion]").forEach(function (group) { seen.observe(group); });

  doc.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("[data-replay]");
    if (!button) return;
    var group = button.closest("[data-motion]");
    if (group) play(group);
  });
})();
