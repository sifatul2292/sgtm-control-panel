// Ad landing pages: site header/mobile menu (same behaviour as the homepage),
// scroll-reveal animations, mobile sticky CTA and single-open FAQ.
(function () {
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header + mobile menu
  var menuBtn = doc.getElementById("menuBtn");
  var mobileNav = doc.getElementById("mobileNav");
  function setMenu(open) {
    if (!menuBtn || !mobileNav) return;
    mobileNav.classList.toggle("open", open);
    mobileNav.inert = !open;
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuBtn.setAttribute("aria-expanded", String(open));
    mobileNav.setAttribute("aria-hidden", String(!open));
  }
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () { setMenu(!mobileNav.classList.contains("open")); });
    mobileNav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") { setMenu(false); menuBtn.focus(); }
    });
  }
  var header = doc.getElementById("siteHeader");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // FAQ: one answer open at a time
  doc.querySelectorAll(".faq details").forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      doc.querySelectorAll(".faq details[open]").forEach(function (other) { if (other !== item) other.removeAttribute("open"); });
    });
  });

  if (!("IntersectionObserver" in window)) return;

  // Mobile sticky CTA: hidden while the hero buttons are on screen
  var bar = doc.querySelector(".sticky-cta"), heroCtas = doc.querySelector(".hero .hero-ctas");
  if (bar && heroCtas) {
    new IntersectionObserver(function (entries) { bar.classList.toggle("is-hidden", entries[0].isIntersecting); }).observe(heroCtas);
  }

  // Scroll reveal. Content stays visible without JS or with reduced motion;
  // the hidden state only applies once html.reveal-ready is set here.
  if (reduce) return;
  root.classList.add("reveal-ready");
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      seen.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  doc.querySelectorAll("[data-reveal]").forEach(function (el) {
    var group = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty("--d", Math.min(group, 6) * 80 + "ms");
    seen.observe(el);
  });
})();
