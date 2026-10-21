#!/usr/bin/env node
// Builds the static blog from Markdown sources.
//   docs/marketing/blog/<slug>.md  ->  public/blog/<slug>.html
// Also rewrites the post list in public/blog/index.html and regenerates public/sitemap.xml.
// No dependencies: a small Markdown subset is supported (see docs/marketing/blog-writing-brief.md).
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const srcDir = new URL("docs/marketing/blog/", root);
const outDir = new URL("public/blog/", root);
const SITE = "https://tagioo.com";
const CSS_VERSION = 5;
const CATEGORY_ORDER = ["Getting started", "Ecommerce", "Meta", "Google", "TikTok", "Privacy", "Comparisons", "Troubleshooting", "Lead generation"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const longDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function parseFrontMatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*?)(?:\s+#.*)?\s*$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  for (const key of ["title", "description", "category", "published", "updated", "summary"]) {
    if (!meta[key]) throw new Error(`${file}: front matter missing "${key}"`);
  }
  meta.related = (meta.related || "").split(",").map((s) => s.trim()).filter(Boolean);
  meta.featured = meta.featured === "true";
  return { meta, body: text.slice(m[0].length) };
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
      return `<a href="${href}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

// Returns { html, h1, toc: [{id,text}], faq: [{q,a}], words }
function markdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out = [];
  const toc = [];
  const faq = [];
  const usedIds = new Set();
  let h1 = "";
  let inFaq = false;
  let faqCurrent = null;
  let words = 0;
  const images = [];
  const videos = [];
  const uniqueId = (text) => {
    let id = slugify(text) || "section";
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(text)}-${n}`;
    usedIds.add(id);
    return id;
  };
  const pushFaqText = (html) => { if (faqCurrent) faqCurrent.a.push(html); };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith("```")) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    let m;
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/))) {
      const [, alt, src, caption] = m;
      const size = imageSize(src);
      images.push(src.startsWith("/") ? SITE + src : src);
      out.push(`<figure><a href="${esc(src)}" class="figure-zoom" aria-label="Open full-size image"><img src="${esc(src)}" alt="${esc(alt)}"${size ? ` width="${size.w}" height="${size.h}"` : ""} loading="lazy" decoding="async"></a>${caption ? `<figcaption>${inline(caption)}</figcaption>` : ""}</figure>`);
      i++;
      continue;
    }
    if ((m = line.match(/^@\[youtube\]\(([\w-]{11})\s+"([^"]+)"(?:\s+(\d{4}-\d{2}-\d{2}))?\)\s*$/))) {
      const [, id, title, date] = m;
      videos.push({ id, title, date });
      out.push(`<figure class="video"><a class="video-facade" href="https://www.youtube.com/watch?v=${id}" data-yt="${id}" aria-label="Play video: ${esc(title)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async"><span class="video-play" aria-hidden="true"></span></a><figcaption>Video: ${esc(title)}</figcaption></figure>`);
      i++;
      continue;
    }
    if ((m = line.match(/^# (.+)/))) { h1 = m[1].trim(); i++; continue; }
    if ((m = line.match(/^## (.+)/))) {
      const text = m[1].trim();
      const id = uniqueId(text);
      inFaq = /^(frequently asked questions|faqs?|related questions)$/i.test(text);
      faqCurrent = null;
      toc.push({ id, text });
      out.push(`<h2 id="${id}">${inline(text)}</h2>`);
      words += text.split(/\s+/).length;
      i++;
      continue;
    }
    if ((m = line.match(/^### (.+)/))) {
      const text = m[1].trim();
      out.push(`<h3 id="${uniqueId(text)}">${inline(text)}</h3>`);
      if (inFaq) faq.push(faqCurrent = { q: text, a: [] });
      words += text.split(/\s+/).length;
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      for (; i < lines.length && lines[i].startsWith("|"); i++) rows.push(lines[i]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(/^\|[\s:|-]+\|$/.test(rows[1] || "") ? 2 : 1).map(cells);
      words += rows.join(" ").split(/\s+/).length;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i + 1])) item += " " + lines[++i].trim();
        items.push(item);
      }
      words += items.join(" ").split(/\s+/).length;
      const tag = ordered ? "ol" : "ul";
      const html = `<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`;
      out.push(html);
      pushFaqText(html);
      continue;
    }
    if (line.startsWith(">")) {
      const quote = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) quote.push(lines[i].replace(/^>\s?/, ""));
      words += quote.join(" ").split(/\s+/).length;
      // Callout: paragraphs, plus "- " lines rendered as a list (e.g. key takeaways).
      const parts = [];
      for (const q of quote) {
        if (/^[-*]\s+/.test(q)) {
          const item = `<li>${inline(q.replace(/^[-*]\s+/, ""))}</li>`;
          if (parts.length && parts[parts.length - 1].startsWith("<ul>")) parts[parts.length - 1] = parts[parts.length - 1].replace(/<\/ul>$/, item + "</ul>");
          else parts.push(`<ul>${item}</ul>`);
        } else if (q.trim()) {
          if (parts.length && parts[parts.length - 1].startsWith("<p>")) parts[parts.length - 1] = parts[parts.length - 1].replace(/<\/p>$/, " " + inline(q) + "</p>");
          else parts.push(`<p>${inline(q)}</p>`);
        }
      }
      out.push(`<aside class="callout">${parts.join("")}</aside>`);
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,3} |```|\||>|!\[|@\[|\s*([-*]|\d+\.)\s+)/.test(lines[i]); i++) para.push(lines[i].trim());
    const text = para.join(" ");
    words += text.split(/\s+/).length;
    const html = `<p>${inline(text)}</p>`;
    out.push(html);
    pushFaqText(html);
  }
  return { html: out.join("\n"), h1, toc, faq, words, images, videos };
}

// Intrinsic size for local SVG/PNG images, so figures don't shift layout while loading.
function imageSize(src) {
  if (!src.startsWith("/")) return null;
  const file = new URL("public" + src.split("?")[0], root);
  try {
    const buf = readFileSync(file);
    if (src.endsWith(".svg")) {
      const vb = buf.toString("utf8", 0, 600).match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
      return vb ? { w: Math.round(+vb[1]), h: Math.round(+vb[2]) } : null;
    }
    if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    throw new Error(`Image not found: ${src}`);
  }
  return null;
}

const stripTags = (html) => html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// ── Site chrome: the blog reuses the marketing site's own header, mobile menu, footer, CSS and scripts,
// extracted from public/features.html at build time so the two never drift apart.
function siteChrome(features) {
  const pick = (re, what) => {
    const m = features.match(re);
    if (!m) throw new Error(`Could not find the site ${what} in public/features.html`);
    return m[0];
  };
  const markBlog = (html) => html.replace(/<a href="\/blog"([^>]*)>Blog<\/a>/g, '<a href="/blog"$1 aria-current="page">Blog</a>');
  const header = markBlog(pick(/<header class="site-header"[\s\S]*?<\/header>/, "header"));
  const mobileNav = markBlog(pick(/<div class="mobile-nav" id="mobileNav"[\s\S]*?<\/nav>\s*<\/div>/, "mobile menu"));
  const footer = pick(/<footer class="site-footer">[\s\S]*?<\/footer>/, "footer");
  const floats = (features.match(/<a class="whatsapp-float"[\s\S]*?<\/a>\s*<a class="support-float"[\s\S]*?<\/a>/) || [""])[0];
  const headEnd = features.indexOf("</head>");
  const styles = [...features.slice(0, headEnd).matchAll(/<link rel="(?:stylesheet|preload)"[^>]*>/g)].map((m) => m[0]).join("");
  const scripts = [...features.matchAll(/<script src="\/assets\/(?:marketing|geo)\.js[^"]*"[^>]*><\/script>/g)].map((m) => m[0]).join("");
  const gtm = pick(/<!-- Tagioo boot \+ Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/, "GTM snippet").replace(/\n\s*/g, "\n");
  return { header: header + mobileNav, footer: footer + floats, styles, scripts, gtm };
}

const coverPath = (slug) => `/assets/blog/covers/${slug}.jpg`;
const coverOf = (post) => post.meta.image || (existsSync(new URL(`public${coverPath(post.slug)}`, root)) ? coverPath(post.slug) : null);
const readMinutes = (post) => Math.max(1, Math.round(post.md.words / 230));
const shortDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const SEARCH_ICON = `<svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m13 13 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

function pageHead({ title, description, url, type, image, extra = "" }, chrome) {
  const img = SITE + (image || "/assets/og-tagioo.png");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}">` +
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">` +
    `<meta property="og:site_name" content="Tagioo"><meta property="og:title" content="${esc(title.replace(/ \| Tagioo$/, ""))}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:type" content="${type}"><meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` +
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">${extra}` +
    `<link rel="icon" type="image/png" sizes="64x64" href="/assets/tagioo-icon-64.png?v=1" />${chrome.styles}<link rel="stylesheet" href="/assets/blog.css?v=${CSS_VERSION}">${chrome.gtm}</head>`;
}

function pageBody(main, chrome) {
  return `<body class="legacy-page blog-page"><a class="skip-link" href="#main-content">Skip to content</a>${chrome.header}${main}${chrome.footer}` +
    `${chrome.scripts}<script src="/assets/blog.js?v=${CSS_VERSION}" defer></script></body></html>\n`;
}

function postCard(post, { eager = false } = {}) {
  const { meta, slug } = post;
  const cover = coverOf(post);
  return `<article class="post-card" data-category="${esc(meta.category)}"><a class="card-link" href="/blog/${slug}">` +
    (cover ? `<div class="card-cover"><img src="${cover}" alt="" width="1200" height="630"${eager ? "" : ' loading="lazy"'} decoding="async"></div>` : "") +
    `<div class="card-body"><span class="card-cat">${esc(meta.category)}</span><h3>${esc(meta.title)}</h3><p>${esc(meta.summary)}</p>` +
    `<span class="card-meta">${readMinutes(post)} min read · ${shortDate(meta.updated)}</span></div></a></article>`;
}

function articlePage(post, all, chrome) {
  const { meta, md, slug } = post;
  const url = `${SITE}/blog/${slug}`;
  const cover = coverOf(post);
  const minutes = readMinutes(post);
  const tocItems = md.toc.map((t) => `<li><a href="#${t.id}">${esc(stripTags(inline(t.text)))}</a></li>`).join("");
  const related = meta.related.map((s) => all.find((p) => p.slug === s)).filter(Boolean)
    .concat(all.filter((p) => p.slug !== slug && p.meta.category === meta.category && !meta.related.includes(p.slug)))
    .concat(all.filter((p) => p.meta.featured))
    .filter((p, i, arr) => p.slug !== slug && arr.indexOf(p) === i).slice(0, 3);
  const images = [cover ? SITE + cover : `${SITE}/assets/og-tagioo.png`, ...md.images];
  const graph = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: meta.title,
      description: meta.description,
      image: images,
      mainEntityOfPage: url,
      datePublished: meta.published,
      dateModified: meta.updated,
      inLanguage: "en-US",
      wordCount: md.words,
      ...(meta.keyword ? { keywords: meta.keyword } : {}),
      articleSection: meta.category,
      author: { "@type": "Organization", "@id": `${SITE}/#organization`, name: "Tagioo", url: `${SITE}/` },
      publisher: { "@type": "Organization", "@id": `${SITE}/#organization`, name: "Tagioo", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/tagioo-logo-284.png` } },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: meta.title, item: url },
      ],
    },
  ];
  for (const v of md.videos.filter((v) => v.date)) {
    graph.push({ "@type": "VideoObject", name: v.title, description: v.title, thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, uploadDate: v.date, contentUrl: `https://www.youtube.com/watch?v=${v.id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}` });
  }
  if (md.faq.length) {
    graph.push({ "@type": "FAQPage", mainEntity: md.faq.map((f) => ({ "@type": "Question", name: stripTags(inline(f.q)), acceptedAnswer: { "@type": "Answer", text: stripTags(f.a.join(" ")) } })) });
  }
  const head = pageHead({
    title: meta.seoTitle || `${meta.title} | Tagioo`,
    description: meta.description,
    url,
    type: "article",
    image: cover,
    extra: `<meta property="article:published_time" content="${meta.published}"><meta property="article:modified_time" content="${meta.updated}"><meta property="article:section" content="${esc(meta.category)}">${jsonLd({ "@context": "https://schema.org", "@graph": graph })}`,
  }, chrome);
  const main = `<div class="read-progress" aria-hidden="true"><span></span></div><main id="main-content" class="post">` +
    `<header class="post-hero"><div class="post-hero-inner">` +
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog">Blog</a><span aria-hidden="true">/</span><a href="/blog?topic=${encodeURIComponent(meta.category)}">${esc(meta.category)}</a></nav>` +
    `<h1>${inline(md.h1 || meta.title)}</h1><p class="post-dek">${esc(meta.description)}</p>` +
    `<div class="post-meta"><span class="post-author"><img src="/assets/tagioo-icon-64.png?v=1" alt="" width="28" height="28">Tagioo team</span>` +
    `<span>Updated <time datetime="${meta.updated}">${longDate(meta.updated)}</time></span><span>${minutes} min read</span></div></div>` +
    (cover ? `<figure class="post-cover"><img src="${cover}" alt="" width="1200" height="630" fetchpriority="high" decoding="async"></figure>` : "") +
    `</header><div class="post-layout">` +
    `<aside class="post-toc"><nav aria-label="On this page"><p>On this page</p><ol>${tocItems}</ol></nav></aside>` +
    `<article class="post-body"><details class="toc-mobile"><summary>On this page</summary><ol>${tocItems}</ol></details>\n${md.html}` +
    `<section class="post-cta"><h2>See your own events, server-side.</h2><p>Tagioo hosts your server-side GTM container on your own domain and generates the GA4, Google Ads, Meta and TikTok setup for you. Free for 15,000 events a month, no card needed.</p><div class="post-cta-actions"><a class="btn-primary" href="/signup">Start free →</a><a class="btn-ghost" href="/pricing">See pricing</a></div></section>` +
    `</article></div>` +
    (related.length ? `<section class="post-related"><div class="wrap"><h2>Keep reading</h2><div class="card-grid">${related.map((p) => postCard(p)).join("")}</div></div></section>` : "") +
    `</main>`;
  return head + pageBody(main, chrome);
}

function indexPage(posts, chrome) {
  const featured = posts.find((p) => p.meta.featured) || posts[0];
  const rest = posts.filter((p) => p !== featured);
  const categories = CATEGORY_ORDER.filter((c) => posts.some((p) => p.meta.category === c));
  const fCover = coverOf(featured);
  const schema = jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/blog#collection`,
    name: "Server-side tracking guides",
    description: "Guides to server-side tracking, server-side GTM, Google Ads, Meta Conversions API, GA4 and ecommerce conversion tracking.",
    url: `${SITE}/blog`,
    publisher: { "@id": `${SITE}/#organization` },
    mainEntity: { "@type": "ItemList", itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/blog/${p.slug}`, name: p.meta.title })) },
  });
  const head = pageHead({
    title: "Server-Side Tracking Guides & Tutorials | Tagioo Blog",
    description: "Server-side tracking guides: server-side GTM setup, Google Ads, Meta Conversions API, GA4, WooCommerce and Shopify tracking, ad blockers, costs and Stape alternatives.",
    url: `${SITE}/blog`,
    type: "website",
    extra: schema,
  }, chrome);
  const main = `<main id="main-content" class="blog-home">` +
    `<section class="blog-hero"><div class="blog-hero-inner"><p class="blog-eyebrow">Tagioo blog</p>` +
    `<h1>Server-side tracking guides</h1><p class="blog-hero-sub">Practical, step-by-step guides to server-side GTM, Google Ads, Meta Conversions API, GA4 and ecommerce tracking. Find the missing purchases, fix duplicate events and learn what actually reaches your ad platforms.</p>` +
    `<label class="blog-search">${SEARCH_ICON}<span class="sr-only">Search guides</span><input type="search" id="guideSearch" placeholder="Search guides: Meta CAPI, GA4, Shopify…" autocomplete="off"></label></div></section>` +
    `<section class="blog-featured wrap" aria-label="Featured guide"><a class="featured-card" href="/blog/${featured.slug}">` +
    (fCover ? `<div class="featured-cover"><img src="${fCover}" alt="" width="1200" height="630" fetchpriority="high" decoding="async"></div>` : "") +
    `<div class="featured-body"><span class="card-cat">Start here · ${esc(featured.meta.category)}</span><h2>${esc(featured.meta.title)}</h2><p>${esc(featured.meta.summary)}</p>` +
    `<span class="card-meta">${readMinutes(featured)} min read · Updated ${shortDate(featured.meta.updated)}</span><span class="featured-cta">Read the guide →</span></div></a></section>` +
    `<section class="blog-library wrap" aria-labelledby="libraryTitle"><div class="library-head"><h2 id="libraryTitle">All guides</h2><p id="guideCount" aria-live="polite">${posts.length} guides</p></div>` +
    `<div class="topic-chips" role="group" aria-label="Filter guides by topic"><button type="button" data-topic="All guides" aria-pressed="true">All</button>${categories.map((c) => `<button type="button" data-topic="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}</div>` +
    `<div class="card-grid" id="guideGrid">${[featured, ...rest].map((p, i) => postCard(p, { eager: i < 3 })).join("")}</div>` +
    `<p class="empty-guides" hidden>No guides match that search yet. Try another word, or <a href="mailto:hello@tagioo.com">tell us what to write next</a>.</p></section>` +
    `<section class="blog-cta-band"><div class="wrap"><div><p class="blog-eyebrow">Get something working</p><h2>Reading helps. Testing one event helps more.</h2><p>Start free with 15,000 events a month. Connect your tracking and see exactly what reaches your server.</p></div>` +
    `<div class="post-cta-actions"><a class="btn-primary" href="/signup">Start free →</a><a class="btn-ghost" href="/how-it-works">How it works</a></div></div></section></main>`;
  return head + pageBody(main, chrome);
}


// Homepage "Tagioo Journal" slider in public/landing.html: kept in sync with the blog
// (current titles, cover images, guide count) on every build.
const HOME_GUIDE_COUNT = 8;
const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
function homeGuidesSection(posts) {
  const featured = posts.find((p) => p.meta.featured) || posts[0];
  const picks = [featured, ...posts.filter((p) => p !== featured)].slice(0, HOME_GUIDE_COUNT);
  const count = NUMBER_WORDS[picks.length] || String(picks.length);
  const cards = picks.map((p) => {
    const cover = coverOf(p);
    return `<article class="home-guide">` +
      (cover ? `<a class="guide-cover" href="/blog/${p.slug}" tabindex="-1" aria-hidden="true"><img src="${cover}" alt="" width="1200" height="630" loading="lazy" decoding="async"></a>` : "") +
      `<div class="guide-copy"><span class="home-guide-topic">${esc(p.meta.category)}</span><h3><a href="/blog/${p.slug}">${esc(p.meta.title)}</a></h3><p>${esc(p.meta.summary)}</p>` +
      `<span class="home-guide-meta">${readMinutes(p)} min read</span><a class="home-guide-link" href="/blog/${p.slug}" aria-label="Read ${esc(p.meta.title)}">Read guide →</a></div></article>`;
  }).join("");
  return `<section id="guides" class="section homepage-guides"><div class="section-heading centered"><div class="eyebrow">THE TAGIOO JOURNAL</div><h2>Server-side tracking guides.</h2>` +
    `<p class="section-sub">Step-by-step guides to server-side GTM, Google Ads, Meta Conversions API, GA4, WooCommerce and Shopify tracking.</p></div>` +
    `<div class="guide-toolbar"><span>${count} popular guides. Pick your next step.</span><div class="guide-controls"><button type="button" class="guide-prev" aria-label="Previous guides" aria-controls="guide-track">←</button><button type="button" class="guide-next" aria-label="Next guides" aria-controls="guide-track">→</button></div></div>` +
    `<div class="home-guide-grid" id="guide-track" tabindex="0" aria-label="Tracking guides slider">${cards}</div>` +
    `<div class="home-guide-all"><a href="/blog">View all ${posts.length} guides →</a></div></section>`;
}

// Marketing pages in the sitemap: [path, source file used for lastmod].
const STATIC_PAGES = [
  ["/", "public/landing.html", "1.0"],
  ["/features", "public/features.html", "0.8"],
  ["/pricing", "public/pricing.html", "0.9"],
  ["/how-it-works", "public/how-it-works.html", "0.8"],
  ["/compare", "public/compare.html", "0.8"],
  ["/woocommerce", "public/woocommerce.html", "0.9"],
  ["/shopify", "public/shopify.html", "0.9"],
  ["/website-tracking-checker", "public/tracking-checker.html", "0.7"],
  ["/docs", "public/docs.html", "0.6"],
  ["/terms", "public/terms.html", "0.2"],
  ["/privacy", "public/privacy.html", "0.2"],
  ["/refunds", "public/refunds.html", "0.2"],
];

function lastModified(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: new URL(".", root).pathname, encoding: "utf8" }).trim();
    if (out) return out;
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

function buildSitemap(posts) {
  const newest = posts.reduce((d, p) => (p.meta.updated > d ? p.meta.updated : d), "");
  const urls = [
    ...STATIC_PAGES.map(([path, file, priority]) => ({ loc: SITE + path, lastmod: lastModified(file), priority })),
    { loc: `${SITE}/blog`, lastmod: newest, priority: "0.8" },
    ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.meta.updated, priority: p.meta.featured ? "0.8" : "0.7" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
}

function buildLlms(posts) {
  const pages = [
    ["Homepage", "/", "Managed server-side GTM hosting with first-party tracking domains."],
    ["Pricing", "/pricing", "Free plan with 15,000 events per 30 days; paid plans from $30/month."],
    ["Features", "/features", "Meta Conversions API, GA4, TikTok Events API, Google Ads, Event Logs, Purchase Inspector."],
    ["WooCommerce", "/woocommerce", "Tagioo for WooCommerce plugin with a server-side purchase backstop."],
    ["Shopify", "/shopify", "Guided Shopify Custom Pixel setup for Meta and GA4."],
    ["How it works", "/how-it-works", "Account, server container, DNS, template import, publish and verify."],
    ["Compare", "/compare", "Managed Tagioo hosting vs self-hosted server-side GTM."],
    ["Website Tracking Checker", "/website-tracking-checker", "Free scan of a public site's tags, IDs and first-party routing."],
    ["Docs", "/docs", "Setup and troubleshooting documentation."],
  ];
  return `# Tagioo\n\n> Tagioo is managed server-side Google Tag Manager (sGTM) hosting. Each customer gets a dedicated sGTM container on their own tracking subdomain, plus generated GTM setups for Meta Conversions API, GA4, TikTok Events API and Google Ads, with plugins for WooCommerce and a Custom Pixel flow for Shopify.\n\n## Product\n\n${pages.map(([n, path, d]) => `- [${n}](${SITE}${path}): ${d}`).join("\n")}\n\n## Guides\n\n${posts.map((p) => `- [${p.meta.title}](${SITE}/blog/${p.slug}): ${p.meta.description}`).join("\n")}\n`;
}

const chrome = siteChrome(await readFile(new URL("public/features.html", root), "utf8"));

// Posts with a future `published` date are held back (drip publishing). BUILD_DATE=YYYY-MM-DD overrides "today".
const TODAY = process.env.BUILD_DATE || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const scheduled = [];
const files = (await readdir(srcDir)).filter((f) => f.endsWith(".md")).sort();
const posts = [];
for (const file of files) {
  const slug = file.slice(0, -3);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Bad slug: ${slug}`);
  const { meta, body } = parseFrontMatter(await readFile(new URL(file, srcDir), "utf8"), file);
  if (meta.draft === "true") continue;
  if (meta.published > TODAY) { scheduled.push({ slug, date: meta.published }); continue; }
  posts.push({ slug, meta, md: markdown(body) });
}
// Links to posts that aren't live yet become plain text until their publish day.
const scheduledSlugs = new Set(scheduled.map((s) => s.slug));
for (const post of posts) {
  post.md.html = post.md.html.replace(/<a href="\/blog\/([a-z0-9-]+)(?:#[^"]*)?">([\s\S]*?)<\/a>/g, (m, target, label) => (scheduledSlugs.has(target) ? label : m));
  // A "Recommended article" box whose only link was removed has nothing to recommend yet.
  post.md.html = post.md.html.replace(/<aside class="callout"><p><strong>Recommended article:<\/strong>(?:(?!<a |<\/aside>)[\s\S])*<\/aside>\n?/g, "");
  post.meta.related = post.meta.related.filter((r) => !scheduledSlugs.has(r));
}
// Featured first, then newest, then by category order.
posts.sort((a, b) => (b.meta.featured - a.meta.featured) || b.meta.published.localeCompare(a.meta.published) || CATEGORY_ORDER.indexOf(a.meta.category) - CATEGORY_ORDER.indexOf(b.meta.category));

const slugs = new Set(posts.map((p) => p.slug));
for (const post of posts) {
  for (const r of post.meta.related) if (!slugs.has(r)) console.warn(`warn: ${post.slug} relates to missing post "${r}"`);
  for (const [, target] of post.md.html.matchAll(/href="\/blog\/([^"#?]+)/g)) if (!slugs.has(target)) throw new Error(`${post.slug}: broken internal link /blog/${target}`);
  await writeFile(new URL(`${post.slug}.html`, outDir), articlePage(post, posts, chrome));
}
for (const { slug } of scheduled) await rm(new URL(`${slug}.html`, outDir), { force: true });
await writeFile(new URL("index.html", outDir), indexPage(posts, chrome));
const landingUrl = new URL("public/landing.html", root);
const landing = await readFile(landingUrl, "utf8");
const guidesRe = /<section id="guides" class="section homepage-guides">[\s\S]*?<\/section>/;
if (!guidesRe.test(landing)) throw new Error("public/landing.html: homepage guides section not found");
await writeFile(landingUrl, landing.replace(guidesRe, homeGuidesSection(posts)));
await writeFile(new URL("public/sitemap.xml", root), buildSitemap(posts));
await writeFile(new URL("public/llms.txt", root), buildLlms(posts));

for (const p of posts) console.log(`${String(p.md.words).padStart(5)} words  ${p.md.faq.length} faq  ${p.slug}`);
console.log(`Built ${posts.length} posts, blog index and sitemap (as of ${TODAY}).`);
if (scheduled.length) console.log(`Scheduled: ${scheduled.sort((a, b) => a.date.localeCompare(b.date)).map((s) => `${s.date} ${s.slug}`).join(", ")}`);
