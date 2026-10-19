// Server-side rendering of hand-edited marketing content (content/marketing.json)
// into static marketing HTML. Pages carry markers such as
//   <!-- tagioo:case-studies limit=2 platform=Shopify -->
//   <!-- tagioo:video shopify -->
// which servePublicPage replaces before caching/compressing, so the output is
// still plain HTML: no client JS, CDN-cacheable.

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function visibleCaseStudies(content, { platform = "", limit = 0 } = {}) {
  const list = (content?.caseStudies || [])
    .filter((study) => !study.placeholder || content.showPlaceholders)
    .filter((study) => !platform || String(study.platform).toLowerCase() === platform.toLowerCase());
  return limit > 0 ? list.slice(0, limit) : list;
}

export function renderCaseStudyCard(study) {
  const metrics = (study.metrics || []).map((m) => `
        <div class="cs-metric"><span class="cs-metric-label">${esc(m.label)}</span><span class="cs-metric-values"><span><small>Before</small> ${esc(m.before)}</span><span><small>After</small> ${esc(m.after)}</span></span></div>`).join("");
  const quote = study.quote ? `
      <blockquote class="cs-quote"><p>“${esc(study.quote)}”</p>${study.quoteAuthor ? `<cite>${esc(study.quoteAuthor)}</cite>` : ""}</blockquote>` : "";
  return `
    <article class="cs-card${study.placeholder ? " cs-placeholder" : ""}" id="${esc(study.slug)}">${study.placeholder ? `
      <p class="cs-flag">PLACEHOLDER — not a real customer. Replace in content/marketing.json.</p>` : ""}
      <header><span class="cs-platform">${esc(study.platform)}</span><span class="cs-type">${esc(study.storeType)}</span></header>
      <h3>${esc(study.storeName)}</h3>
      <dl>
        <dt>Problem</dt><dd>${esc(study.problem)}</dd>
        <dt>What we did</dt><dd>${esc(study.whatWeDid)}</dd>
      </dl>
      <div class="cs-metrics">${metrics}
      </div>${study.period ? `
      <p class="cs-period">${esc(study.period)}</p>` : ""}${quote}
    </article>`;
}

export function renderCaseStudies(content, options = {}) {
  const list = visibleCaseStudies(content, options);
  if (!list.length) return "";
  return `<div class="cs-grid">${list.map(renderCaseStudyCard).join("")}
  </div>`;
}

// Click-to-load YouTube: only a thumbnail until the visitor presses play, so no
// YouTube scripts or cookies load with the page. Empty id → labelled placeholder.
export function renderVideo(content, key, title) {
  const id = String(content?.videos?.[key] || "");
  if (!/^[\w-]{11}$/.test(id)) {
    return `<div class="video-embed video-placeholder" role="img" aria-label="${esc(title)} — video coming soon"><span>${esc(title)}<br><small>Video coming soon</small></span></div>`;
  }
  return `<div class="video-embed"><a class="video-load" href="https://www.youtube.com/watch?v=${id}" data-video-id="${id}" target="_blank" rel="noopener" aria-label="Play video: ${esc(title)}">`
    + `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async"><span class="video-play" aria-hidden="true"></span></a></div>`;
}

const MARKER_RE = /<!-- tagioo:(case-studies|video|robots-if-placeholder)([^>]*?)-->/g;

export function applyMarketingContent(html, content) {
  return html.replace(MARKER_RE, (_, kind, rawArgs) => {
    const args = Object.fromEntries([...rawArgs.matchAll(/(\w+)=("[^"]*"|\S+)/g)].map(([, k, v]) => [k, v.replace(/^"|"$/g, "")]));
    const positional = rawArgs.trim().split(/\s+/)[0] || "";
    if (kind === "video") return renderVideo(content, positional, args.title || "Setup video");
    if (kind === "robots-if-placeholder") {
      const real = (content?.caseStudies || []).some((study) => !study.placeholder);
      return real ? "" : '<meta name="robots" content="noindex, follow" />';
    }
    const block = renderCaseStudies(content, { platform: args.platform || "", limit: Number(args.limit) || 0 });
    if (!args.heading) return block || (args.empty ? `<p class="cs-empty">${esc(args.empty)}</p>` : "");
    // Section form: omitted entirely when there is nothing to show.
    return block ? `<section class="section cs-section" id="case-studies">
      <div class="section-heading centered"><p class="eyebrow">Case studies</p><h2>${esc(args.heading)}</h2></div>
      ${block}
    </section>` : "";
  });
}
