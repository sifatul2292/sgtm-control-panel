// Region-specific marketing markup, resolved at serve time so the HTML a visitor
// receives is already correct without JavaScript or CSS. Elements marked
// data-bd-only (WhatsApp, bKash/Nagad) exist only in the Bangladesh render and
// data-intl-only elements only in the international one. The marker attribute is
// removed from whatever survives, so nothing is left for geo.js/CSS to hide.
const MARKER_RE = /<([a-z][a-z0-9]*)\b[^>]*?\sdata-(bd|intl)-only(?:=(?:""|''))?[^>]*>/gi;
const MARKER_ATTR_RE = /\sdata-(?:bd|intl)-only(?:=(?:""|''))?/i;

export function renderMarketingRegion(html, region) {
  const drop = region === "bd" ? "intl" : "bd";
  const re = new RegExp(MARKER_RE.source, "gi");
  let out = "";
  let pos = 0;
  let match;
  while ((match = re.exec(html))) {
    const [openTag, tag, kind] = match;
    out += html.slice(pos, match.index);
    if (kind === drop) {
      pos = closingTagEnd(html, tag, match.index + openTag.length);
    } else {
      out += openTag.replace(MARKER_ATTR_RE, "");
      pos = match.index + openTag.length;
    }
    re.lastIndex = pos;
  }
  return out + html.slice(pos);
}

// Index just past the tag that closes the element opened before `from`,
// counting nested elements of the same name (e.g. <span> inside <span>).
function closingTagEnd(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = re.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error(`Unclosed <${tag}> region element`);
}
