// Tagioo tracking checker: run a scan and render the report.
(() => {
  const form = document.getElementById("scanForm");
  const input = document.getElementById("scanUrl");
  const button = document.getElementById("scanButton");
  const progress = document.getElementById("scanProgress");
  const errorBox = document.getElementById("scanStatus");
  const report = document.getElementById("scanReport");
  const scope = document.getElementById("scanScope");
  if (!form) return;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SEVERITY = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  const SERVER = {
    confirmed: ["Server-side ✓", "ok"],
    configured: ["Configured", "warn"],
    possible: ["Possible", "warn"],
    "not-detected": ["Browser-only", "bad"]
  };
  const VIA = { page: "Page code", "site-script": "Site JavaScript", gtm: "GTM", "shopify-app": "Shopify app" };
  const SERVER_STACK = {
    confirmed: ["Live server container", "ok"],
    configured: ["Configured, not confirmed", "warn"],
    likely: ["Likely (app or vendor)", "warn"],
    none: ["Not found — browser-only", "bad"]
  };

  // Step-by-step progress while the request runs (about 5–15 seconds).
  let timer = 0;
  function startProgress() {
    const steps = [...progress.querySelectorAll("li")];
    steps.forEach((li) => li.removeAttribute("data-state"));
    progress.hidden = false;
    let i = 0;
    steps[0].dataset.state = "active";
    timer = setInterval(() => {
      if (i < steps.length - 1) {
        steps[i].dataset.state = "done";
        steps[++i].dataset.state = "active";
      }
    }, 2200);
  }
  function stopProgress() {
    clearInterval(timer);
    progress.hidden = true;
  }

  const tone = (score) => (score >= 75 ? "ok" : score >= 50 ? "warn" : "bad");
  const AREA_TAG = { analytics: "Analytics", ads: "Advertising", server: "Server-side", privacy: "Consent" };

  // Half-circle gauge for the overall score.
  function gauge(score, grade) {
    if (score === null) return `<div class="tc-gauge tc-gauge-unknown"><span>?</span></div>`;
    const word = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Weak" : "Poor";
    return `<div class="tc-gauge tc-tone-${tone(score)}" role="img" aria-label="Score ${score} out of 100, grade ${esc(grade)}">
      <svg viewBox="0 0 120 66" aria-hidden="true"><path d="M10 60 A50 50 0 0 1 110 60" class="tc-gauge-bg" pathLength="100"/><path d="M10 60 A50 50 0 0 1 110 60" class="tc-gauge-fg" pathLength="100" stroke-dasharray="${score} 100"/></svg>
      <span class="tc-gauge-word">${word}</span><span class="tc-gauge-grade">Grade ${esc(grade)}</span></div>`;
  }

  function iconFor(domain, name) {
    const letter = esc((name || "?").trim().charAt(0).toUpperCase());
    if (!domain) return `<span class="tc-chip-icon tc-chip-letter" aria-hidden="true">${letter}</span>`;
    return `<span class="tc-chip-icon" aria-hidden="true"><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&amp;sz=64" alt="" width="16" height="16" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent='${letter}';this.parentNode.classList.add('tc-chip-letter')"></span>`;
  }

  function headerCard(r, host) {
    const site = r.site || {};
    const when = new Date(r.savedAt || r.scannedAt);
    const stamp = isNaN(when) ? "" : when.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const thumb = site.image
      ? `<img class="tc-thumb" src="${esc(site.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'tc-thumb tc-thumb-empty',textContent:'${esc(host.charAt(0).toUpperCase())}'}))">`
      : `<span class="tc-thumb tc-thumb-empty">${site.icon ? `<img src="${esc(site.icon)}" alt="" width="28" height="28" referrerpolicy="no-referrer" onerror="this.remove()">` : esc(host.charAt(0).toUpperCase())}</span>`;
    return `<header class="tc-card tc-head">
      ${thumb}
      <div class="tc-head-body"><p class="tc-mono">Website tracking report${stamp ? ` · Scanned ${esc(stamp)}` : ""}</p>
        <h2><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>${esc(host)}</h2>
        ${site.title ? `<p class="tc-head-title">${esc(site.title)}</p>` : ""}</div>
      <button type="button" class="tc-mono-btn" id="scanAgainTop">Run new scan ↗</button>
    </header>`;
  }

  function scoresBlock(r) {
    const counts = ["critical", "high", "medium", "low"].filter((s) => r.counts[s]).map((s) => `<span class="tc-count tc-sev-${s}">${r.counts[s]} ${SEVERITY[s]}</span>`).join("");
    const areas = (r.areas || []).map((a) => `<div class="tc-area">
        <div class="tc-area-top"><h3>${esc(a.label)}</h3><span class="tc-mono tc-tag">${a.issues} issue${a.issues === 1 ? "" : "s"}</span></div>
        <p class="tc-area-rating tc-text-${tone(a.score)}">${esc(a.rating)}</p>
        <div class="tc-bar" role="img" aria-label="${esc(a.label)} ${a.score} out of 100"><span class="tc-fill-${tone(a.score)}" style="width:${Math.max(4, a.score)}%"></span></div>
      </div>`).join("");
    return `<div class="tc-scores">
      <div class="tc-card tc-overall">
        <div class="tc-area-top"><h3>Overall score</h3><span class="tc-mono tc-tag">${r.destinations.length} tracker${r.destinations.length === 1 ? "" : "s"} detected</span></div>
        <div class="tc-overall-main"><p class="tc-big">${r.score === null ? "?" : r.score}<span>/100</span></p>${gauge(r.score, r.grade)}</div>
        <p class="tc-summary-text">${esc(r.summary)}</p>
        <div class="tc-counts">${counts}</div>
      </div>
      ${areas ? `<div class="tc-card tc-areas">${areas}</div>` : ""}
    </div>`;
  }

  function techBlock(r) {
    const list = r.technologies || [];
    if (!list.length) return "";
    return `<section class="tc-card tc-section"><div class="tc-section-head"><h2>Detected technologies</h2><span class="tc-mono tc-tag">${list.length} found</span></div>
      <ul class="tc-chips">${list.map((t) => `<li>${iconFor(t.domain, t.name)}${esc(t.name)}</li>`).join("")}</ul></section>`;
  }

  function actionsBlock(r) {
    if (!r.issues.length) return "";
    const rows = r.issues.map((i, n) => `<details class="tc-action tc-sev-${i.severity}"${n === 0 ? " open" : ""}>
      <summary><div class="tc-action-main"><h3>${esc(i.title)}</h3>
        <div class="tc-action-tags"><span class="tc-mono tc-tag">${esc(AREA_TAG[i.area] || "Tracking")}</span><span class="tc-mono tc-sevtag tc-sev-${i.severity}">${SEVERITY[i.severity]}</span></div></div>
        <div class="tc-points"><strong>+${i.points}</strong><span>to score</span></div></summary>
      <div class="tc-action-body"><p>${esc(i.detail)}</p><h4>How to fix it</h4><ol>${i.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
        ${i.tagioo ? `<p class="tc-tagioo"><strong>With Tagioo:</strong> ${esc(i.tagioo)} <a data-signup href="${signupHref()}">Start free →</a></p>` : ""}</div>
    </details>`).join("");
    return `<section class="tc-card tc-actions"><div class="tc-actions-side"><h2>Recommended actions</h2><p class="tc-big">${r.issues.length}</p><p class="tc-small tc-muted">Sorted by impact. Each fix shows the points it adds to your score.</p></div>
      <div class="tc-actions-list">${rows}</div></section>`;
  }

  let leadEmail = "";
  const signupHref = () => `/signup${leadEmail ? `?email=${encodeURIComponent(leadEmail)}` : ""}`;

  function shareBlock(r) {
    if (!r.shareId) return "";
    const link = `${location.origin}/website-tracking-checker/r/${r.shareId}`;
    return `<section class="tc-share" aria-label="Share or save this report">
      <div class="tc-share-link"><h2>Share this report</h2><p>Send it to your developer or agency. The link works for 90 days.</p>
        <div class="tc-copy"><input type="text" readonly value="${esc(link)}" aria-label="Report link" id="shareLink"><button type="button" id="copyLink">Copy link</button></div></div>
      ${r.shared ? "" : `<form class="tc-email" id="emailForm" novalidate><h2>Email me this report</h2><p>Get the score, top fixes and the link in your inbox. Optional.</p>
        <div class="tc-copy"><label class="sr-only" for="leadEmail">Email address</label><input type="email" id="leadEmail" autocomplete="email" placeholder="you@yourstore.com" required maxlength="254"><button type="submit">Send report</button></div>
        <label class="tc-optin"><input type="checkbox" id="leadOptIn"> Also send me occasional tracking tips from Tagioo</label>
        <p class="tc-email-status" id="emailStatus" role="status" aria-live="polite"></p></form>`}
    </section>`;
  }

  function wireShare(r) {
    const copy = document.getElementById("copyLink");
    if (copy) copy.addEventListener("click", async () => {
      const field = document.getElementById("shareLink");
      try { await navigator.clipboard.writeText(field.value); } catch { field.select(); document.execCommand("copy"); }
      copy.textContent = "Copied ✓";
      setTimeout(() => { copy.textContent = "Copy link"; }, 2000);
    });
    const emailForm = document.getElementById("emailForm");
    if (!emailForm) return;
    emailForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const field = document.getElementById("leadEmail");
      const status = document.getElementById("emailStatus");
      const email = field.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { status.textContent = "Enter a valid email address."; status.dataset.tone = "bad"; field.focus(); return; }
      const submit = emailForm.querySelector("button");
      submit.disabled = true; submit.textContent = "Sending…";
      try {
        const res = await fetch(`/api/public/tracking-checker/r/${encodeURIComponent(r.shareId)}/email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, optIn: document.getElementById("leadOptIn").checked }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "We couldn't send the email. Please try again.");
        leadEmail = email;
        status.textContent = `Sent to ${email}. Check your inbox (and spam folder).`;
        status.dataset.tone = "ok";
        document.querySelectorAll("[data-signup]").forEach((a) => { a.href = signupHref(); });
        try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "generate_lead", lead_source: "tracking_checker" }); } catch {}
      } catch (error) {
        status.textContent = error.message; status.dataset.tone = "bad";
      } finally { submit.disabled = false; submit.textContent = "Send report"; }
    });
  }

  function emqBlock(r) {
    if (!r.emq) return "";
    const e = r.emq;
    const tone = e.score >= 8 ? "ok" : e.score >= 6 ? "ok" : e.score >= 4 ? "warn" : "bad";
    return `<section class="tc-card tc-section tc-emq"><div class="tc-section-head"><h2>Meta Event Match Quality</h2><span class="tc-mono tc-tag">Estimate</span></div>
      <div class="tc-emq-card"><div class="tc-emq-score tc-tone-${tone}"><strong>${e.score}</strong><span>/ 10</span><em>${esc(e.label)}</em></div>
      <div><ul class="tc-keys">${e.keys.map((k) => `<li class="${k.sent ? "is-on" : "is-off"}">${k.sent ? "✓" : "✕"} ${esc(k.label)}</li>`).join("")}</ul>
      <p class="tc-muted tc-small">${esc(e.note)}${e.automaticAdvancedMatching ? " Automatic Advanced Matching is on for your pixel." : ""}</p>
      <details class="tc-how"><summary>How we estimate this</summary><p class="tc-small">Meta scores each event from 0 to 10 based on the customer information it receives, and doesn't publish the formula. We give points for each piece of information your setup can send, weighted the way Meta ranks them: email and click ID count most, then phone, external ID and browser ID, then name and address. We can't see how often each one arrives or what your server sends, so treat this as what your setup can reach on purchase events. Page views usually score lower because visitors haven't entered an email yet.</p></details></div></div></section>`;
  }

  function googleBlock(r) {
    if (!r.googleSignals) return "";
    return `<section class="tc-card tc-section"><div class="tc-section-head"><h2>Google match signals</h2></div><ul class="tc-keys tc-keys-wide">${r.googleSignals.map((g) => `<li class="${g.ok ? "is-on" : "is-off"}">${g.ok ? "✓" : "✕"} ${esc(g.label)}</li>`).join("")}</ul></section>`;
  }

  // "What better tracking could be worth": published platform averages applied to this site's gaps.
  function impactBlock(r) {
    const imp = r.adImpact;
    if (!imp || !imp.factors.length) return "";
    const meta = imp.factors.find((f) => f.platform === "meta");
    const calc = meta && meta.uplift > 0;
    const intro = !meta ? "A prediction based on averages Google has published, applied only to the gaps found on this site."
      : meta.mode === "covered" ? "Your Meta Conversions API is live, so the main gain Meta has measured is already in your results. Keep match quality high to hold on to it."
      : meta.mode === "unconfirmed" ? "We found a server-side setup but couldn't confirm Meta Conversions API events. If they aren't actually reaching Meta, this is what adding them could be worth, based on Meta's published average."
      : "A prediction based on averages Meta has published, applied only to the gaps found on this site. Your results will differ.";
    const field = (key, label, value, min, max, step) => `<div class="tc-field"><label for="imp-${key}">${label}</label>
      <div class="tc-money"><span>$</span><input id="imp-${key}" type="number" inputmode="decimal" min="${min}" step="${step}" value="${value}" data-imp="${key}"></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-imp-range="${key}" aria-label="${label}">
      <div class="tc-range-scale tc-mono"><span>$${min.toLocaleString()}</span><span>$${max.toLocaleString()}</span></div></div>`;
    return `<section class="tc-card tc-impact" id="impact">
      <div class="tc-section-head"><h2>What fixing this could be worth</h2><span class="tc-mono tc-tag">Prediction</span></div>
      <p class="tc-small">${esc(intro)}</p>
      ${calc ? `<div class="tc-impact-grid">
        <div class="tc-impact-inputs">${field("meta", "Your monthly Meta ad spend", 1000, 0, 50000, 100)}${field("cpa", "Your average cost per purchase", 30, 1, 300, 1)}</div>
        <div class="tc-impact-out" aria-live="polite">
          <div class="tc-impact-big"><p class="tc-mono">Estimated extra purchases</p><strong id="impMonth">–</strong><span>per month</span></div>
          <div class="tc-impact-periods">
            <div><p class="tc-mono">Per day</p><strong id="impDay">–</strong></div>
            <div><p class="tc-mono">Per $100 spend</p><strong id="impPer100">–</strong></div>
            <div><p class="tc-mono">Same results, less spend</p><strong id="impSaved">–</strong></div>
          </div>
          <p id="impMonthly" class="tc-small"></p></div>
      </div>` : ""}
      <ul class="tc-sources">${imp.factors.map((f) => `<li><strong>${esc(f.label)}:</strong> ${esc(f.basis)} <a href="${esc(f.url)}" target="_blank" rel="noopener">Source: ${esc(f.source)}</a></li>`).join("")}</ul>
      <p class="tc-muted tc-small">${esc(imp.disclaimer)}</p></section>`;
  }

  function wireImpact(r) {
    const box = document.getElementById("impact");
    if (!box || !box.querySelector("#impMonth")) return;
    const val = (k) => Math.max(0, Number(box.querySelector(`[data-imp="${k}"]`)?.value || 0));
    const fmt = (n) => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString());
    const money = (n) => `$${Math.round(n).toLocaleString()}`;
    const update = () => {
      const cpa = Math.max(1, val("cpa"));
      let extra = 0, spend = 0, saved = 0;
      for (const platform of ["meta"]) {
        const factors = r.adImpact.factors.filter((f) => f.platform === platform);
        if (!factors.length) continue;
        const s = val(platform);
        spend += s;
        const uplift = factors.reduce((m, f) => m * (1 + (f.uplift || 0)), 1) - 1;
        extra += (s / cpa) * uplift;
        // Lower cost per result: the same results would cost s / (1 + uplift).
        saved += s - s / (1 + uplift);
      }
      const per100 = spend ? (extra / spend) * 100 : 0;
      box.querySelector("#impMonth").textContent = spend ? `+${fmt(extra)}` : "–";
      box.querySelector("#impDay").textContent = spend ? `+${fmt(extra / 30)}` : "–";
      box.querySelector("#impPer100").textContent = spend ? `+${per100 < 1 ? per100.toFixed(2) : per100.toFixed(1)}` : "–";
      box.querySelector("#impSaved").textContent = spend ? `${money(saved)}/mo` : "–";
      box.querySelector("#impMonthly").textContent = spend ? `From ${fmt(Math.round(spend / cpa))} to about ${fmt(Math.round(spend / cpa) + extra)} purchases a month on ${money(spend)} of spend (about ${money(spend / 30)} a day), at $${cpa} per purchase today.` : "Enter your monthly ad spend.";
    };
    box.querySelectorAll("[data-imp-range]").forEach((range) => {
      const num = box.querySelector(`[data-imp="${range.dataset.impRange}"]`);
      range.addEventListener("input", () => { num.value = range.value; update(); });
      num.addEventListener("input", () => { range.value = num.value; update(); });
    });
    update();
  }

  function render(r) {
    const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    const ss = SERVER_STACK[r.stack.serverSide.status] || SERVER_STACK.none;
    const facts = [
      ["Platform", r.platforms.length ? r.platforms.join(" · ") : "Not identified"],
      ["Tag manager", r.stack.gtmIds.length ? r.stack.tagManagers.map((t) => `${t.id}${t.status === "ok" ? ` · ${t.tags} tags` : t.status === "not-found" ? " · not published" : ""}`).join(", ") : "None found"],
      ["Server-side", `<span class="tc-pill tc-${ss[1]}">${ss[0]}</span>${r.stack.serverSide.vendor ? ` <span class="tc-muted">${esc(r.stack.serverSide.vendor)}</span>` : ""}`, true],
      ["Consent", r.stack.cmps.length ? `${r.stack.cmps.join(", ")}${r.stack.consentMode ? " · Consent Mode" : ""}` : "No banner found"]
    ];
    const destRows = r.destinations.map((d) => {
      const [label, tone] = SERVER[d.server.status] || SERVER["not-detected"];
      return `<tr><th scope="row">${esc(d.name)}</th><td>${d.via.map((v) => esc(VIA[v] || v)).join(", ")}</td><td class="tc-ids">${d.ids.length ? d.ids.map(esc).join("<br>") : "<span class='tc-muted'>—</span>"}</td>
        <td><span class="tc-pill tc-${tone}">${label}</span>${d.server.detail ? `<div class="tc-detail">${esc(d.server.detail)}</div>` : ""}</td></tr>`;
    }).join("");

    const passed = r.passed.map((p) => `<li><strong>${esc(p.title)}</strong><span>${esc(p.detail)}</span></li>`).join("");

    const endpoints = r.stack.serverSide.endpoints.map((e) => `<li>${esc(e.host)} — ${e.healthy ? "live (health check passed)" : "not responding"}, ${e.firstParty ? "your domain" : "third-party domain"}</li>`).join("");
    const tech = `
      <dl class="tc-tech">
        <dt>Pages inspected</dt><dd>${esc(r.inspected.page)}${r.inspected.productPage ? `<br>${esc(r.inspected.productPage)}` : ""}</dd>
        <dt>GTM containers</dt><dd>${r.stack.tagManagers.length ? r.stack.tagManagers.map((t) => `${esc(t.id)} — ${t.status === "ok" ? `published, ${t.tags} tags${t.version ? `, version ${esc(t.version)}` : ""}` : t.status === "not-found" ? "no published version" : "couldn't be read"}`).join("<br>") : "None"}</dd>
        <dt>GTM events</dt><dd>${r.stack.gtmEvents.length ? r.stack.gtmEvents.map(esc).join(", ") : "—"}</dd>
        <dt>Server endpoints</dt><dd>${endpoints ? `<ul>${endpoints}</ul>` : "None found"}</dd>
        <dt>Tag loading</dt><dd>${esc(r.stack.loader)}</dd>
        <dt>Server-side vendors</dt><dd>${r.stack.vendors.length ? esc(r.stack.vendors.join(", ")) : "—"}</dd>
        <dt>Other analytics</dt><dd>${r.stack.analyticsTools.length ? esc(r.stack.analyticsTools.join(", ")) : "—"}</dd>
        <dt>Tracking plugins</dt><dd>${r.stack.wooPlugins.length ? esc(r.stack.wooPlugins.join(", ")) : "—"}</dd>
        <dt>Shopify app pixels</dt><dd>${r.stack.shopifyAppPixels || "—"}</dd>
        <dt>Scan time</dt><dd>${(r.durationMs / 1000).toFixed(1)}s${r.cached ? " (cached)" : ""}</dd>
      </dl>
      ${r.warnings.length ? `<p class="tc-muted">${r.warnings.map(esc).join(" ")}</p>` : ""}`;

    const saved = r.shared ? `<p class="tc-saved">Saved report from ${esc(new Date(r.savedAt || r.scannedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }))}. Tracking may have changed since. <a href="/website-tracking-checker?url=${encodeURIComponent(host)}">Run a fresh check →</a></p>` : "";
    report.innerHTML = `${saved}
      ${headerCard(r, host)}
      ${scoresBlock(r)}
      ${techBlock(r)}
      <section class="tc-card tc-section"><div class="tc-section-head"><h2>Tracking setup</h2></div>
        <dl class="tc-facts">${facts.map(([k, v, html]) => `<div><dt class="tc-mono">${k}</dt><dd>${html ? v : esc(v)}</dd></div>`).join("")}</dl>
        ${r.destinations.length ? `<div class="tc-table-wrap"><table class="tc-table"><thead><tr><th>Platform</th><th>Installed via</th><th>IDs</th><th>Server-side</th></tr></thead><tbody>${destRows}</tbody></table></div>` : ""}</section>
      ${impactBlock(r)}
      ${actionsBlock(r)}
      <div class="tc-two">${emqBlock(r)}${googleBlock(r)}</div>
      ${passed ? `<section class="tc-card tc-section"><div class="tc-section-head"><h2>What's working</h2><span class="tc-mono tc-tag">${r.passed.length} checks passed</span></div><ul class="tc-passed">${passed}</ul></section>` : ""}
      ${shareBlock(r)}
      <section class="tc-cta"><div><h2>Give your tracking a quick fix</h2><p>Tagioo runs your server-side tracking on your own domain and sets up GA4, Meta CAPI, Google Ads and TikTok for you. Free plan, and free setup help if you get stuck.</p></div>
        <div class="tc-cta-actions"><a class="tc-btn" data-signup href="${signupHref()}">Start free →</a><a class="tc-btn tc-btn-ghost" href="mailto:hello@tagioo.com?subject=Tracking%20report%20for%20${encodeURIComponent(host)}">Ask for a free review</a></div></section>
      <details class="tc-card tc-section tc-technical"><summary>Technical details</summary>${tech}</details>
      <p class="tc-limits">${esc(r.limitations)}</p>
      <p><button type="button" class="tc-again" id="scanAgain">Check another website</button></p>`;
    report.hidden = false;
    scope.hidden = true;
    wireShare(r);
    wireImpact(r);
    report.focus({ preventScroll: true });
    report.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    const again = () => {
      if (r.shared) { location.href = "/website-tracking-checker"; return; }
      report.hidden = true;
      scope.hidden = false;
      input.value = "";
      history.replaceState(null, "", "/website-tracking-checker");
      window.scrollTo({ top: 0, behavior: "smooth" });
      input.focus({ preventScroll: true });
    };
    document.getElementById("scanAgain").addEventListener("click", again);
    document.getElementById("scanAgainTop").addEventListener("click", again);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = input.value.trim();
    if (!url) return;
    errorBox.hidden = true;
    report.hidden = true;
    button.disabled = true;
    button.textContent = "Checking…";
    startProgress();
    try {
      const res = await fetch("/api/public/tracking-checker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json().catch(() => ({}));
      stopProgress();
      if (!res.ok) throw new Error(data.error || "The scan didn't finish. Please try again.");
      render(data);
      if (data.shareId) history.replaceState(null, "", `/website-tracking-checker/r/${data.shareId}`);
      try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "tracking_check", check_score: data.score, check_issues: data.issues.length }); } catch {}
    } catch (error) {
      stopProgress();
      errorBox.textContent = error.message || "The scan didn't finish. Please try again.";
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Check my tracking →";
    }
  });

  // Shared report links: /website-tracking-checker/r/<id>
  const sharedId = (location.pathname.match(/^\/website-tracking-checker\/r\/([A-Za-z0-9]{12})$/) || [])[1];
  if (sharedId) {
    progress.hidden = true;
    fetch(`/api/public/tracking-checker/r/${sharedId}`).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "This report couldn't be loaded.");
      render(data);
    }).catch((error) => { errorBox.textContent = error.message; errorBox.hidden = false; });
    return;
  }

  // Allow ?url= links, e.g. from the blog: /website-tracking-checker?url=example.com
  const preset = new URLSearchParams(location.search).get("url");
  if (preset) { input.value = preset; form.requestSubmit(); }
})();
