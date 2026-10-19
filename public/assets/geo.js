// Region switch for cached marketing pages. HTML is identical for every visitor
// (CDN-cacheable), so Bangladesh-only content (BDT, bKash/Nagad, WhatsApp) is
// revealed here by adding html.geo-bd. Default and failure case: international.
(function () {
  var root = document.documentElement;
  function apply(geo) {
    var bd = geo && geo.currency === "BDT";
    root.classList.toggle("geo-bd", bd);
    root.setAttribute("data-currency", bd ? "BDT" : "USD");
    // /api/geo flags office IPs listed in TAGIOO_INTERNAL_IPS; remember it so
    // the boot snippet skips GTM on every later page view.
    if (geo && geo.internal && document.cookie.indexOf("tg_internal=1") === -1) {
      document.cookie = "tg_internal=1;path=/;max-age=31536000;SameSite=Lax";
    }
  }
  // Keyed on the manual /bd or /global choice so switching takes effect at once.
  var forced = (document.cookie.match(/(?:^|; )tg_currency=(\w+)/) || [])[1] || "";
  var key = "tg_geo:" + forced;
  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) {}
  if (cached) { apply(cached); return; }
  fetch("/api/geo", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (geo) {
      try { sessionStorage.setItem(key, JSON.stringify(geo)); } catch (_) {}
      apply(geo);
    })
    .catch(function () { apply(null); });
})();
