// Tagioo blog: guide search + topic filter, reading progress, active TOC link,
// shared-header scroll state, share buttons and click-to-load YouTube embeds.
(() => {
  // Shared header gets its "scrolled" style like the rest of the site.
  const header = document.getElementById("siteHeader");
  const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ── Blog home: search and topic chips ──
  const grid = document.getElementById("guideGrid");
  if (grid) {
    const cards = [...grid.querySelectorAll(".post-card")];
    const chips = [...document.querySelectorAll("[data-topic]")];
    const search = document.getElementById("guideSearch");
    const count = document.getElementById("guideCount");
    const empty = document.querySelector(".empty-guides");
    const featured = document.querySelector(".blog-featured");
    let topic = new URLSearchParams(location.search).get("topic") || "All guides";
    if (!chips.some((c) => c.dataset.topic === topic)) topic = "All guides";

    const apply = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const card of cards) {
        const match = (topic === "All guides" || card.dataset.category === topic) && (!q || card.textContent.toLowerCase().includes(q));
        card.hidden = !match;
        if (match) shown++;
      }
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.topic === topic)));
      count.textContent = `${shown} ${shown === 1 ? "guide" : "guides"}`;
      empty.hidden = shown > 0;
      if (featured) featured.hidden = Boolean(q) || topic !== "All guides";
    };
    chips.forEach((chip) => chip.addEventListener("click", () => {
      topic = chip.dataset.topic;
      const url = new URL(location.href);
      if (topic === "All guides") url.searchParams.delete("topic"); else url.searchParams.set("topic", topic);
      history.replaceState(null, "", url);
      apply();
    }));
    search.addEventListener("input", apply);
    apply();
  }

  // ── Article: reading progress ──
  const body = document.querySelector(".post-body");
  const bar = document.querySelector(".read-progress span");
  if (body && bar) {
    let ticking = false;
    const update = () => {
      const rect = body.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const done = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      bar.style.transform = `scaleX(${done})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ── Article: highlight the current section in the table of contents ──
  const tocLinks = [...document.querySelectorAll(".post-toc a")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const setActive = (id) => tocLinks.forEach((a) => a.classList.toggle("is-active", a === byId.get(id)));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: "-90px 0px -65% 0px" });
    headings.forEach((h) => observer.observe(h));
  }

  // ── Article: share buttons (copy link, native share sheet, GA4 "share" event) ──
  const shareRow = document.querySelector("[data-share-url]");
  if (shareRow) {
    const pageUrl = shareRow.dataset.shareUrl;
    const track = (method) => (window.dataLayer = window.dataLayer || []).push({ event: "share", method, content_type: "article", item_id: location.pathname });
    const announce = (text) => document.querySelectorAll("[data-share-status]").forEach((el) => { el.textContent = text; });
    if (navigator.share) document.querySelectorAll("[data-share-native]").forEach((btn) => { btn.hidden = false; });
    document.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-net]");
      if (link) { track(link.dataset.net); return; }
      if (event.target.closest("[data-share-native]")) {
        const title = document.querySelector('meta[property="og:title"]')?.content || document.title;
        try { await navigator.share({ title, url: pageUrl }); track("native"); } catch { /* dismissed */ }
        return;
      }
      const copy = event.target.closest("[data-share-copy]");
      if (!copy) return;
      try {
        await navigator.clipboard.writeText(pageUrl);
      } catch {
        const field = document.createElement("textarea");
        field.value = pageUrl;
        document.body.append(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      track("copy_link");
      const text = copy.querySelector(".share-text");
      copy.classList.add("is-copied");
      if (text) text.textContent = "Copied!";
      copy.title = "Link copied";
      announce("Link copied to clipboard");
      setTimeout(() => {
        copy.classList.remove("is-copied");
        if (text) text.textContent = "Copy link";
        copy.title = "Copy link";
        announce("");
      }, 2000);
    });
  }

  // ── Videos load from youtube-nocookie only after a click ──
  document.addEventListener("click", (event) => {
    const facade = event.target.closest("[data-yt]");
    if (!facade) return;
    event.preventDefault();
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${facade.dataset.yt}?autoplay=1`;
    frame.title = facade.getAttribute("aria-label") || "Video";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    facade.replaceWith(frame);
  });
})();
