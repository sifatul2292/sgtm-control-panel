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

  function scoreRing(score, grade) {
    if (score === null) return `<div class="tc-ring tc-ring-unknown"><span>?</span></div>`;
    const r = 52, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    const tone = score >= 75 ? "ok" : score >= 50 ? "warn" : "bad";
    return `<div class="tc-ring tc-tone-${tone}" role="img" aria-label="Score ${score} out of 100, grade ${esc(grade)}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="tc-ring-bg"/><circle cx="60" cy="60" r="${r}" class="tc-ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>
      <span class="tc-ring-score">${score}</span><span class="tc-ring-grade">Grade ${esc(grade)}</span></div>`;
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
    return `<section class="tc-block tc-emq"><h2>Meta Event Match Quality <span class="tc-muted">(estimate)</span></h2>
      <div class="tc-emq-card"><div class="tc-emq-score tc-tone-${tone}"><strong>${e.score}</strong><span>/ 10</span><em>${esc(e.label)}</em></div>
      <div><ul class="tc-keys">${e.keys.map((k) => `<li class="${k.sent ? "is-on" : "is-off"}">${k.sent ? "✓" : "✕"} ${esc(k.label)}</li>`).join("")}</ul>
      <p class="tc-muted tc-small">${esc(e.note)}${e.automaticAdvancedMatching ? " Automatic Advanced Matching is on for your pixel." : ""}</p></div></div></section>`;
  }

  function googleBlock(r) {
    if (!r.googleSignals) return "";
    return `<section class="tc-block"><h2>Google match signals</h2><ul class="tc-keys tc-keys-wide">${r.googleSignals.map((g) => `<li class="${g.ok ? "is-on" : "is-off"}">${g.ok ? "✓" : "✕"} ${esc(g.label)}</li>`).join("")}</ul></section>`;
  }

  // "What better tracking could be worth": published platform averages applied to this site's gaps.
  function impactBlock(r) {
    const imp = r.adImpact;
    if (!imp || !imp.factors.length) return "";
    const calc = imp.factors.some((f) => f.platform === "meta" && f.uplift > 0);
    return `<section class="tc-block tc-impact" id="impact"><h2>What fixing this could be worth</h2>
      <p class="tc-small">A prediction based on averages Meta and Google have published, applied only to the gaps found on this site. Your results will differ.</p>
      ${calc ? `<div class="tc-impact-grid">
        <div class="tc-impact-inputs">
          <label>Monthly Meta ads spend ($)<input type="number" min="0" step="100" value="1000" data-imp="meta"></label>
          <label>Your average cost per purchase on Meta ($)<input type="number" min="1" step="1" value="30" data-imp="cpa"></label>
        </div>
        <div class="tc-impact-out" aria-live="polite"><div class="tc-impact-big"><strong id="impPer100">–</strong><span>more purchases per $100 of Meta ad spend</span></div>
          <p id="impMonthly" class="tc-small"></p></div>
      </div>` : ""}
      <ul class="tc-sources">${imp.factors.map((f) => `<li><strong>${esc(f.label)}:</strong> ${esc(f.basis)} <a href="${esc(f.url)}" target="_blank" rel="noopener">Source: ${esc(f.source)}</a></li>`).join("")}</ul>
      <p class="tc-muted tc-small">${esc(imp.disclaimer)}</p></section>`;
  }

  function wireImpact(r) {
    const box = document.getElementById("impact");
    if (!box || !box.querySelector("#impPer100")) return;
    const val = (k) => Math.max(0, Number(box.querySelector(`[data-imp="${k}"]`)?.value || 0));
    const update = () => {
      const cpa = Math.max(1, val("cpa"));
      let extra = 0, spend = 0;
      for (const platform of ["meta"]) {
        const factors = r.adImpact.factors.filter((f) => f.platform === platform);
        if (!factors.length) continue;
        const s = val(platform);
        spend += s;
        const uplift = factors.reduce((m, f) => m * (1 + (f.uplift || 0)), 1) - 1;
        extra += (s / cpa) * uplift;
      }
      const per100 = spend ? (extra / spend) * 100 : 0;
      box.querySelector("#impPer100").textContent = `+${per100 < 1 ? per100.toFixed(2) : per100.toFixed(1)}`;
      box.querySelector("#impMonthly").textContent = spend ? `About ${extra < 10 ? extra.toFixed(1) : Math.round(extra)} more purchases a month on $${spend.toLocaleString()} of spend, at $${cpa} per purchase.` : "Enter your monthly ad spend.";
    };
    box.addEventListener("input", update);
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
    const counts = ["critical", "high", "medium", "low"].filter((s) => r.counts[s]).map((s) => `<span class="tc-count tc-sev-${s}">${r.counts[s]} ${SEVERITY[s]}</span>`).join("");

    const destRows = r.destinations.map((d) => {
      const [label, tone] = SERVER[d.server.status] || SERVER["not-detected"];
      return `<tr><th scope="row">${esc(d.name)}</th><td>${d.via.map((v) => esc(VIA[v] || v)).join(", ")}</td><td class="tc-ids">${d.ids.length ? d.ids.map(esc).join("<br>") : "<span class='tc-muted'>—</span>"}</td>
        <td><span class="tc-pill tc-${tone}">${label}</span>${d.server.detail ? `<div class="tc-detail">${esc(d.server.detail)}</div>` : ""}</td></tr>`;
    }).join("");

    const issues = r.issues.map((i, n) => `<article class="tc-issue tc-sev-${i.severity}">
      <div class="tc-issue-head"><span class="tc-badge tc-sev-${i.severity}">${SEVERITY[i.severity]}</span><h3>${esc(i.title)}</h3></div>
      <p>${esc(i.detail)}</p>
      <details${n < 3 ? " open" : ""}><summary>How to fix it</summary><ol>${i.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
      ${i.tagioo ? `<p class="tc-tagioo"><strong>With Tagioo:</strong> ${esc(i.tagioo)} <a data-signup href="${signupHref()}">Start free →</a></p>` : ""}</details>
    </article>`).join("");

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
      <div class="tc-summary">
        ${scoreRing(r.score, r.grade)}
        <div class="tc-summary-body">
          <p class="tc-eyebrow">Tracking report</p>
          <h2>${esc(host)}</h2>
          <p class="tc-summary-text">${esc(r.summary)}</p>
          <div class="tc-counts">${counts}</div>
        </div>
        <dl class="tc-facts">${facts.map(([k, v, html]) => `<div><dt>${k}</dt><dd>${html ? v : esc(v)}</dd></div>`).join("")}</dl>
      </div>
      ${r.destinations.length ? `<section class="tc-block"><h2>Where your tracking goes</h2>
        <div class="tc-table-wrap"><table class="tc-table"><thead><tr><th>Platform</th><th>Installed via</th><th>IDs</th><th>Server-side</th></tr></thead><tbody>${destRows}</tbody></table></div></section>` : ""}
      ${issues ? `<section class="tc-block"><h2>Issues to fix <span class="tc-muted">(${r.issues.length})</span></h2>${issues}</section>` : ""}
      ${impactBlock(r)}
      ${emqBlock(r)}
      ${googleBlock(r)}
      ${passed ? `<section class="tc-block"><h2>What's working</h2><ul class="tc-passed">${passed}</ul></section>` : ""}
      ${shareBlock(r)}
      <section class="tc-cta"><div><h2>Want these fixed for you?</h2><p>Tagioo runs your server-side tracking on your own domain and sets up GA4, Meta CAPI, Google Ads and TikTok. Free plan, and free setup help if you get stuck.</p></div>
        <div class="tc-cta-actions"><a class="tc-btn" data-signup href="${signupHref()}">Start free →</a><a class="tc-btn tc-btn-ghost" href="mailto:hello@tagioo.com?subject=Tracking%20report%20for%20${encodeURIComponent(host)}">Ask for a free review</a></div></section>
      <details class="tc-block tc-technical"><summary>Technical details</summary>${tech}</details>
      <p class="tc-limits">${esc(r.limitations)}</p>
      <p><button type="button" class="tc-again" id="scanAgain">Check another website</button></p>`;
    report.hidden = false;
    scope.hidden = true;
    wireShare(r);
    wireImpact(r);
    report.focus({ preventScroll: true });
    report.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    document.getElementById("scanAgain").addEventListener("click", () => {
      if (r.shared) { location.href = "/website-tracking-checker"; return; }
      report.hidden = true;
      scope.hidden = false;
      input.value = "";
      input.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
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
