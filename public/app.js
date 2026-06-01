const els = {
  generatedAt: document.querySelector("#generatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  breadcrumb: document.querySelector("#breadcrumb"),
  pageTitle: document.querySelector("#pageTitle"),
  navItems: document.querySelectorAll("[data-view-target]"),
  views: document.querySelectorAll("[data-view]"),
  containerTotal: document.querySelector("#containerTotal"),
  containerDetail: document.querySelector("#containerDetail"),
  dockerHealth: document.querySelector("#dockerHealth"),
  dockerDetail: document.querySelector("#dockerDetail"),
  requestCount: document.querySelector("#requestCount"),
  requestDetail: document.querySelector("#requestDetail"),
  sslDays: document.querySelector("#sslDays"),
  sslDetail: document.querySelector("#sslDetail"),
  dockerBadge: document.querySelector("#dockerBadge"),
  containerCards: document.querySelector("#containerCards"),
  trafficSummary: document.querySelector("#trafficSummary"),
  runtimeChecks: document.querySelector("#runtimeChecks"),
  eventHealthGrid: document.querySelector("#eventHealthGrid"),
  funnelList: document.querySelector("#funnelList"),
  alertList: document.querySelector("#alertList"),
  alertBadge: document.querySelector("#alertBadge"),
  hostBreakdown: document.querySelector("#hostBreakdown"),
  hostBadge: document.querySelector("#hostBadge"),
  qualityChecks: document.querySelector("#qualityChecks"),
  qualityBadge: document.querySelector("#qualityBadge"),
  noiseSummary: document.querySelector("#noiseSummary"),
  noiseBadge: document.querySelector("#noiseBadge"),
  latestPurchase: document.querySelector("#latestPurchase"),
  purchaseBadge: document.querySelector("#purchaseBadge"),
  businessBadge: document.querySelector("#businessBadge"),
  businessPurchases: document.querySelector("#businessPurchases"),
  businessPurchaseDetail: document.querySelector("#businessPurchaseDetail"),
  businessRevenue: document.querySelector("#businessRevenue"),
  businessRevenueDetail: document.querySelector("#businessRevenueDetail"),
  businessAov: document.querySelector("#businessAov"),
  businessAovDetail: document.querySelector("#businessAovDetail"),
  businessDuplicates: document.querySelector("#businessDuplicates"),
  businessDuplicateDetail: document.querySelector("#businessDuplicateDetail"),
  reconciliationBadge: document.querySelector("#reconciliationBadge"),
  reconciliationGrid: document.querySelector("#reconciliationGrid"),
  logModeBadge: document.querySelector("#logModeBadge"),
  accessLog: document.querySelector("#accessLog"),
  errorLog: document.querySelector("#errorLog"),
  dockerLog: document.querySelector("#dockerLog"),
  eventLogSummary: document.querySelector("#eventLogSummary"),
  dockerLogSource: document.querySelector("#dockerLogSource"),
  dockerLogHelp: document.querySelector("#dockerLogHelp"),
  settingsGrid: document.querySelector("#settingsGrid"),
  eventStatusFilter: document.querySelector("#eventStatusFilter"),
  eventTypeFilter: document.querySelector("#eventTypeFilter"),
  clientFilter: document.querySelector("#clientFilter"),
  requestUrlFilter: document.querySelector("#requestUrlFilter"),
  purchaseSearch: document.querySelector("#purchaseSearch"),
  purchaseInspector: document.querySelector("#purchaseInspector"),
  purchaseInspectorBadge: document.querySelector("#purchaseInspectorBadge"),
  analyticsSummary: document.querySelector("#analyticsSummary"),
  analyticsTotal: document.querySelector("#analyticsTotal"),
  analyticsModeBadge: document.querySelector("#analyticsModeBadge"),
  analyticsLegend: document.querySelector("#analyticsLegend"),
  analyticsChart: document.querySelector("#analyticsChart"),
  hourlyTrend: document.querySelector("#hourlyTrend"),
  historyBadge: document.querySelector("#historyBadge"),
  dailyHistory: document.querySelector("#dailyHistory"),
  clientBreakdown: document.querySelector("#clientBreakdown"),
  clientChart: document.querySelector("#clientChart"),
  deploymentBadge: document.querySelector("#deploymentBadge"),
  deploymentChecks: document.querySelector("#deploymentChecks"),
  deploymentRecommendations: document.querySelector("#deploymentRecommendations"),
  provisioningBadge: document.querySelector("#provisioningBadge"),
  provisioningForm: document.querySelector("#provisioningForm"),
  provisioningFormMessage: document.querySelector("#provisioningFormMessage"),
  provisioningQueueBadge: document.querySelector("#provisioningQueueBadge"),
  provisioningRequests: document.querySelector("#provisioningRequests"),
  adminBadge: document.querySelector("#adminBadge"),
  customersBadge: document.querySelector("#customersBadge"),
  customersList: document.querySelector("#customersList"),
  adminActions: document.querySelector("#adminActions"),
  wizardBadge: document.querySelector("#wizardBadge"),
  setupWizard: document.querySelector("#setupWizard"),
  integrationsBadge: document.querySelector("#integrationsBadge"),
  storeWebhookBadge: document.querySelector("#storeWebhookBadge"),
  storeWebhookList: document.querySelector("#storeWebhookList"),
  adPlatformBadge: document.querySelector("#adPlatformBadge"),
  adPlatformChecks: document.querySelector("#adPlatformChecks"),
  integrationExamples: document.querySelector("#integrationExamples"),
  billingBadge: document.querySelector("#billingBadge"),
  planBadge: document.querySelector("#planBadge"),
  billingGrid: document.querySelector("#billingGrid"),
  packageGrid: document.querySelector("#packageGrid"),
  docsList: document.querySelector("#docsList")
};

const viewTitles = {
  dashboard: ["Dashboard", "Server Overview"],
  logs: ["Containers / Event Logs", "Event Logs"],
  analytics: ["Tracking / Analytics", "Analytics"],
  settings: ["Account & Others / Settings", "Settings"],
  deployment: ["Operations / Deployment", "Deployment Health"],
  provisioning: ["Operations / Provisioning", "Container Provisioning"],
  admin: ["Service / Admin", "Admin"],
  integrations: ["Service / Integrations", "Integrations"],
  billing: ["Service / Billing", "Usage & Billing"],
  docs: ["Public / Docs", "Landing & Docs"]
};

let latestData = null;

function text(value, fallback = "--") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function escapeHtml(value) {
  return text(value, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function setView(name) {
  const next = viewTitles[name] ? name : "dashboard";
  els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === next));
  els.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.viewTarget === next));
  els.breadcrumb.textContent = viewTitles[next][0];
  els.pageTitle.textContent = viewTitles[next][1];
  window.location.hash = next;
}

function setBadge(el, status, label) {
  el.className = "badge";
  if (status) el.classList.add(status);
  el.textContent = label;
}

function stateClass(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function levelFromMessage(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("exception")) return "error";
  if (lower.includes("warn")) return "warn";
  if (lower.includes("debug")) return "debug";
  return "info";
}

function normalizeEventName(value) {
  const compact = String(value || "")
    .trim()
    .replace(/[-_\s]+/g, "")
    .toLowerCase();
  const names = {
    pageview: "PageView",
    page_view: "PageView",
    viewcontent: "ViewContent",
    viewitem: "ViewContent",
    viewcart: "ViewCart",
    productview: "ViewContent",
    addtocart: "AddToCart",
    initiatecheckout: "BeginCheckout",
    begincheckout: "BeginCheckout",
    checkout: "BeginCheckout",
    purchase: "Purchase",
    ordercomplete: "Purchase",
    lead: "Lead",
    signup: "Lead",
    search: "Search",
    scriptload: "ScriptLoad"
  };
  return names[compact] || "";
}

function queryEventName(path) {
  try {
    const parsed = new URL(path, "https://sgtm.local");
    const eventKeys = ["event", "event_name", "en", "e", "action", "type", "name"];
    for (const key of eventKeys) {
      const eventName = normalizeEventName(parsed.searchParams.get(key));
      if (eventName) return eventName;
    }
  } catch {
    return "";
  }
  return "";
}

function isTrackingPath(path) {
  const raw = String(path || "").toLowerCase();
  const endpoint = raw.split("?")[0];
  return [
    "/g/collect",
    "/collect",
    "/mp/collect",
    "/data"
  ].some((prefix) => endpoint.startsWith(prefix));
}

function inferAccessEvent({ path, method, status }) {
  const code = Number(status);
  const raw = decodeURIComponent(String(path || "")).toLowerCase();
  const queryEvent = queryEventName(path);
  const suspiciousPhp = /\.php(?:[?#]|$)/.test(raw) && !raw.includes("index.php");
  const blocked = code >= 400;
  const trackingPath = isTrackingPath(path);

  if (blocked && suspiciousPhp) {
    return {
      name: "Blocked Bot Request",
      outcome: "Blocked",
      description: "A likely automated scan hit a random PHP path and the server rejected it."
    };
  }

  if (queryEvent && trackingPath) {
    return {
      name: queryEvent,
      outcome: blocked ? "Not accepted" : "Tracked",
      description: `The request explicitly reported a ${queryEvent} event.`
    };
  }

  const checks = [
    ["Purchase", ["purchase", "order", "thank_you", "payment_success", "complete"]],
    ["BeginCheckout", ["checkout", "initiate_checkout", "begin_checkout"]],
    ["AddToCart", ["add_to_cart", "addtocart", "cart/add", "add-to-cart"]],
    ["ViewCart", ["view_cart", "viewcart", "cart"]],
    ["ViewItem", ["view_item", "viewitem", "product", "item"]],
    ["ViewContent", ["viewcontent", "content"]],
    ["Lead", ["lead", "signup", "register", "subscribe"]],
    ["Search", ["search", "query="]],
    ["ScriptLoad", ["service_worker", "sw.js", "gtm.js", "loader", "script"]]
  ];

  for (const [name, needles] of checks) {
    if (trackingPath && needles.some((needle) => raw.includes(needle))) {
      return {
        name,
        outcome: blocked ? "Not accepted" : "Tracked",
        description: `This looks like a ${name} event based on the request URL.`
      };
    }
  }

  if (method === "GET" && !blocked && trackingPath) {
    return {
      name: "PageView",
      outcome: "Tracked",
      description: "A visitor or browser loaded a page or tracking endpoint."
    };
  }

  return {
    name: blocked ? "Rejected Request" : "Other",
    outcome: blocked ? "Not accepted" : "Processed",
    description: blocked
      ? "The server rejected this request before it became a clean tracking event."
      : "This is Nginx traffic, but it does not look like an SGTM tracking endpoint."
  };
}

function parseNginxTime(value) {
  const match = String(value || "").match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, zone] = match;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const offset = `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const iso = `${year}-${months[month]}-${day}T${hour}:${minute}:${second}${offset}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayRequestDate(rawTime) {
  const date = parseNginxTime(rawTime);
  if (!date) return rawTime;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function inferClient(path, agent) {
  const lower = `${path || ""} ${agent || ""}`.toLowerCase();
  if (lower.includes("/g/collect") || lower.includes("tid=g-") || lower.includes("gtag")) return "GA4";
  if (lower.includes("/data") || lower.includes("data_client") || lower.includes("event=")) return "Data Client";
  if (lower.includes("meta") || lower.includes("fbp") || lower.includes("facebook")) return "Meta";
  if (lower.includes("tiktok") || lower.includes("ttclid")) return "TikTok";
  return "Other";
}

function displayRequestUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${window.location.origin}${path || "/"}`;
}

function parseNginxAccess(line) {
  const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) (HTTP\/[^"]+)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/);
  if (!match) {
    return { source: "access", level: "info", primary: line, meta: "Unparsed access line", detail: "" };
  }

  const [, ip, time, method, path, protocol, status, bytes, referer, agent] = match;
  const code = Number(status);
  const level = code >= 500 ? "error" : code >= 400 ? "warn" : "info";
  const event = inferAccessEvent({ path, method, status });
  const client = inferClient(path, agent);
  const requestUrl = displayRequestUrl(path);
  const tracking = isTrackingPath(path);
  return {
    source: "access",
    level,
    status,
    method,
    path,
    time,
    date: parseNginxTime(time),
    displayDate: displayRequestDate(time),
    client,
    requestUrl,
    tracking,
    eventName: event.name,
    primary: event.name,
    meta: `${event.outcome} - ${status} - ${time}`,
    detail: `${event.description} Path: ${path}. Visitor IP: ${ip}. ${protocol} - ${bytes} bytes${referer !== "-" ? ` - from ${referer}` : ""}${agent !== "-" ? ` - ${agent}` : ""}`
  };
}

function parseNginxError(line) {
  const match = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] \d+#\d+: (.*)$/);
  if (!match) {
    return { source: "error", level: levelFromMessage(line), primary: line, meta: "Nginx error log", detail: "" };
  }

  const [, time, level, message] = match;
  return {
    source: "error",
    level: level === "crit" ? "error" : level,
    primary: message,
    meta: `${level.toUpperCase()} - ${time}`,
    detail: ""
  };
}

function parseDockerLog(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\S+?)\s+(.*)$/);
  const message = match ? match[2] : line;
  return {
    source: "docker",
    level: levelFromMessage(message),
    primary: message,
    meta: match ? formatShortDate(match[1]) : "Docker log",
    detail: ""
  };
}

function parseLogLines(log, kind) {
  if (!log?.available) return [];
  const parser = kind === "access" ? parseNginxAccess : kind === "error" ? parseNginxError : parseDockerLog;
  return log.lines.map(parser);
}

function visibleLog(item, sourceFilter, statusFilter) {
  const sourceOk = sourceFilter === "all" || item.source === sourceFilter;
  const statusOk = statusFilter === "all" || item.level === statusFilter;
  return sourceOk && statusOk;
}

function visibleEvent(item) {
  const statusFilter = els.eventStatusFilter.value;
  const eventFilter = els.eventTypeFilter.value;
  const clientFilter = els.clientFilter.value;
  const urlFilter = els.requestUrlFilter.value.trim().toLowerCase();
  const statusGroup = `${String(item.status || "").charAt(0)}00`;

  return (
    (statusFilter === "all" || item.status === statusFilter || statusGroup === statusFilter) &&
    (eventFilter === "all" || item.eventName === eventFilter) &&
    (clientFilter === "all" || item.client === clientFilter) &&
    (!urlFilter || item.requestUrl.toLowerCase().includes(urlFilter))
  );
}

function setSelectOptions(select, values, firstLabel) {
  const current = select.value;
  select.replaceChildren(new Option(firstLabel, "all"), ...values.map((value) => new Option(value, value)));
  select.value = values.includes(current) ? current : "all";
}

function updateEventFilters(items) {
  const eventTypes = [...new Set(items.map((item) => item.eventName).filter(Boolean))].sort();
  const clients = [...new Set(items.map((item) => item.client).filter(Boolean))].sort();
  setSelectOptions(els.eventTypeFilter, eventTypes, "All events");
  setSelectOptions(els.clientFilter, clients, "All clients");
}

function eventDetail(item) {
  return [
    item.method && item.path ? `${item.method} ${item.path}` : "",
    item.protocol || "",
    item.ip ? `Visitor IP: ${item.ip}` : "",
    item.bytes !== undefined && item.bytes !== null ? `${item.bytes} bytes` : "",
    item.referer ? `From: ${item.referer}` : "",
    item.agent || ""
  ].filter(Boolean).join(" - ");
}

function serverEventRows(data) {
  const rows = data.nginx?.todayEvents?.recentEvents;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((item) => ({
    source: "access",
    level: Number(item.status) >= 500 ? "error" : Number(item.status) >= 400 ? "warn" : "info",
    status: item.status,
    method: item.method,
    path: item.path,
    date: item.date ? new Date(item.date) : null,
    displayDate: formatDate(item.date),
    client: item.client || "Other",
    host: item.host || "Unknown host",
    requestUrl: item.requestUrl || item.path || "",
    tracking: true,
    eventName: item.eventName || "Other",
    value: item.value,
    currency: item.currency,
    eventId: item.eventId,
    transactionId: item.transactionId,
    detail: eventDetail(item)
  }));
}

function renderEventTable(data) {
  const summary = data.nginx?.todayEvents;
  const serverItems = serverEventRows(data);
  const log = data.nginx?.accessLog;

  if (summary?.available && serverItems.length) {
    updateEventFilters(serverItems);
    const visibleItems = serverItems.filter(visibleEvent);
    const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
    els.eventLogSummary.textContent = `Showing ${visibleItems.length.toLocaleString()} of the latest ${serverItems.length.toLocaleString()} tracking events today (${errors.toLocaleString()} errors).`;
    renderEventRows(visibleItems, "No matching tracking events found for today's filters.");
    return;
  }

  if (!log?.available) {
    els.eventLogSummary.textContent = log?.detail || log?.message || "Access log unavailable.";
    els.accessLog.innerHTML = `<tr><td colspan="6">${escapeHtml(`${log?.message || "Unavailable"} ${log?.detail || ""}`.trim())}</td></tr>`;
    return;
  }

  const items = parseLogLines(log, "access").filter((item) => item.tracking);
  updateEventFilters(items);
  const visibleItems = items.filter(visibleEvent);
  const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
  els.eventLogSummary.textContent = `Showing ${visibleItems.length.toLocaleString()} records (${errors.toLocaleString()} errors) from the recent access log sample.`;

  renderEventRows(visibleItems, "No SGTM event collection requests found in the recent sample. The full-day summary may still have older events.");
}

function renderEventRows(visibleItems, emptyMessage) {
  if (!visibleItems.length) {
    els.accessLog.innerHTML = `<tr><td colspan="6">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }

  els.accessLog.replaceChildren(
    ...visibleItems.map((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.displayDate)}</td>
        <td><span class="status-code ${Number(item.status) >= 400 ? "bad" : "good"}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.eventName || "Other")}</td>
        <td>${escapeHtml(item.client || "Other")}</td>
        <td><span class="request-url">${escapeHtml(item.requestUrl)}</span></td>
        <td><button class="more-button" type="button" title="${escapeHtml(item.detail)}" aria-label="Request details">→</button></td>
      `;
      return row;
    })
  );
}

function renderPurchaseInspector(data) {
  const query = els.purchaseSearch.value.trim().toLowerCase();
  const rows = purchaseRows(data).filter((item) => {
    const haystack = [
      item.eventId,
      item.transactionId,
      item.value,
      item.currency,
      item.host,
      item.path,
      item.client
    ].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  els.purchaseInspectorBadge.className = "badge";
  els.purchaseInspectorBadge.classList.add(rows.length ? "ok" : "warn");
  els.purchaseInspectorBadge.textContent = `${rows.length} match${rows.length === 1 ? "" : "es"}`;

  if (!rows.length) {
    els.purchaseInspector.innerHTML = '<div class="empty-log">No purchase requests matched.</div>';
    return;
  }

  els.purchaseInspector.replaceChildren(
    ...rows.slice(0, 12).map((item) => {
      const card = document.createElement("article");
      card.className = "inspector-card";
      card.innerHTML = `
        <div class="inspector-card-top">
          <strong>${escapeHtml(item.displayDate)}</strong>
          <span class="status-code ${Number(item.status) >= 400 ? "bad" : "good"}">${escapeHtml(item.status)}</span>
        </div>
        <div class="inspector-grid">
          <span>Client</span><strong>${escapeHtml(item.client || "Other")}</strong>
          <span>Host</span><strong>${escapeHtml(item.host || "Unknown host")}</strong>
          <span>Value</span><strong>${escapeHtml(item.value && item.currency ? `${item.value} ${item.currency}` : "Missing")}</strong>
          <span>Event ID</span><strong>${escapeHtml(item.eventId || "Missing")}</strong>
          <span>Transaction ID</span><strong>${escapeHtml(item.transactionId || "Missing")}</strong>
          <span>URL</span><strong>${escapeHtml(item.path || "")}</strong>
        </div>
      `;
      return card;
    })
  );
}

function setLog(el, log, kind) {
  if (!log?.available) {
    el.innerHTML = `<div class="empty-log">${escapeHtml(`${log?.message || "Unavailable"} ${log?.detail || ""}`.trim())}</div>`;
    return;
  }

  const sourceFilter = "all";
  const statusFilter = "all";
  const items = parseLogLines(log, kind).filter((item) => visibleLog(item, sourceFilter, statusFilter));

  if (!items.length) {
    el.innerHTML = '<div class="empty-log">No matching log lines.</div>';
    return;
  }

  el.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("article");
      row.className = `log-row ${stateClass(item.level)}`;
      row.innerHTML = `
        <div class="log-row-top">
          <span class="log-level">${escapeHtml(item.level)}</span>
          <span class="log-meta">${escapeHtml(item.meta)}</span>
        </div>
        <p class="log-message">${escapeHtml(item.primary)}</p>
        ${item.detail ? `<p class="log-detail">${escapeHtml(item.detail)}</p>` : ""}
      `;
      return row;
    })
  );
}

function renderContainers(docker) {
  if (!docker.available) {
    els.containerCards.innerHTML = `<div class="empty-log">${escapeHtml(docker.message)}<br>${escapeHtml(text(docker.detail, ""))}</div>`;
    setBadge(els.dockerBadge, "danger", "Unavailable");
    return;
  }

  setBadge(els.dockerBadge, docker.totals.unhealthy ? "danger" : "ok", "Docker live");

  if (!docker.containers.length) {
    els.containerCards.innerHTML = '<div class="empty-log">No Docker containers found.</div>';
    return;
  }

  els.containerCards.replaceChildren(
    ...docker.containers.map((container) => {
      const card = document.createElement("article");
      card.className = "container-card";
      card.innerHTML = `
        <div>
          <div class="container-title">
            <strong>${escapeHtml(container.name)}</strong>
            <span class="state ${stateClass(container.state)}">${escapeHtml(container.state)}</span>
            <span class="state ${stateClass(container.health)}">${escapeHtml(container.health)}</span>
          </div>
          <p class="container-meta">${escapeHtml(container.image)}</p>
          <p class="container-meta">${escapeHtml(text(container.ports, "No exposed ports"))}</p>
        </div>
        <div class="container-stats">
          <span class="state">exit ${escapeHtml(text(container.exitCode, "n/a"))}</span>
          <span class="state">restarts ${escapeHtml(text(container.restartCount, "0"))}</span>
        </div>
      `;
      return card;
    })
  );
}

function renderSummaryList(el, items) {
  el.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("article");
      row.className = "summary-item";
      row.innerHTML = `<strong>${escapeHtml(item.label)}</strong><span class="state ${stateClass(item.status)}">${escapeHtml(item.value)}</span>`;
      return row;
    })
  );
}

function trackingEvents(data) {
  return parseLogLines(data.nginx.accessLog, "access").filter((item) => item.tracking);
}

function canonicalEventName(name) {
  if (name === "ViewContent") return "ViewItem";
  return name || "Other";
}

function todayEventStats(data) {
  const summary = data.nginx?.todayEvents;
  if (!summary?.available || !Array.isArray(summary.events)) return null;

  return summary.events.reduce((stats, item) => {
    stats.set(canonicalEventName(item.name), {
      count: Number(item.count) || 0,
      rawCount: Number(item.rawCount || item.count) || 0,
      uniqueCount: Number.isFinite(Number(item.uniqueCount)) ? Number(item.uniqueCount) : null,
      duplicateCount: Number(item.duplicateCount) || 0,
      keyedCount: Number(item.keyedCount) || 0,
      estimatedKeyCount: Number(item.estimatedKeyCount) || 0,
      missingKeyCount: Number(item.missingKeyCount) || 0,
      uniqueRevenue: Number(item.uniqueRevenue) || 0,
      rawRevenue: Number(item.rawRevenue) || 0,
      averageOrderValue: Number(item.averageOrderValue) || 0,
      currency: item.currency || "",
      errors: Number(item.errors) || 0,
      lastSeen: item.lastSeen ? new Date(item.lastSeen) : null
    });
    return stats;
  }, new Map());
}

function reliableEventStats(data) {
  return todayEventStats(data) || eventStats(trackingEvents(data));
}

function todayRows(data) {
  return serverEventRows(data).length ? serverEventRows(data) : trackingEvents(data);
}

function eventStats(items) {
  return items.reduce((stats, item) => {
    const key = canonicalEventName(item.eventName);
    const current = stats.get(key) || { count: 0, lastSeen: null };
    current.count += 1;
    if (item.date && (!current.lastSeen || item.date > current.lastSeen)) current.lastSeen = item.date;
    stats.set(key, current);
    return stats;
  }, new Map());
}

function eventDisplayCount(name, stat) {
  const canonical = canonicalEventName(name);
  if (canonical === "Purchase" && Number.isFinite(Number(stat?.uniqueCount))) {
    return Number(stat.uniqueCount);
  }
  return Number(stat?.count || 0);
}

function eventRawCount(stat) {
  return Number(stat?.rawCount || stat?.count || 0);
}

function purchaseSummary(data) {
  const orderToday = data.orders?.today;
  if (orderToday?.count) {
    return {
      rawCount: Number(orderToday.count) || 0,
      uniqueCount: Number(orderToday.count) || 0,
      duplicateCount: 0,
      keyedCount: Number(orderToday.count) || 0,
      estimatedKeyCount: 0,
      uniqueRevenue: Number(orderToday.revenue) || 0,
      rawRevenue: Number(orderToday.revenue) || 0,
      averageOrderValue: Number(orderToday.averageOrderValue) || 0,
      currency: orderToday.currency || "",
      source: "orders"
    };
  }

  const summary = data.nginx?.todayEvents?.purchases;
  const stat = reliableEventStats(data).get("Purchase");
  return {
    rawCount: Number(summary?.rawCount ?? eventRawCount(stat)) || 0,
    uniqueCount: Number(summary?.uniqueCount ?? eventDisplayCount("Purchase", stat)) || 0,
    duplicateCount: Number(summary?.duplicateCount ?? stat?.duplicateCount) || 0,
    keyedCount: Number(summary?.keyedCount ?? stat?.keyedCount) || 0,
    estimatedKeyCount: Number(summary?.estimatedKeyCount ?? stat?.estimatedKeyCount) || 0,
    uniqueRevenue: Number(summary?.uniqueRevenue ?? stat?.uniqueRevenue) || 0,
    rawRevenue: Number(summary?.rawRevenue ?? stat?.rawRevenue) || 0,
    averageOrderValue: Number(summary?.averageOrderValue ?? stat?.averageOrderValue) || 0,
    currency: summary?.currency || stat?.currency || "",
    source: "tracking"
  };
}

function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

function eventStatusText(name, stat) {
  if (canonicalEventName(name) === "Purchase" && Number(stat?.duplicateCount || 0) > 0) {
    const mode = Number(stat?.keyedCount || 0) ? "" : "estimated · ";
    return `${eventRawCount(stat).toLocaleString()} raw requests · ${mode}${relativeTime(stat.lastSeen)}`;
  }
  return relativeTime(stat?.lastSeen);
}

function relativeTime(date) {
  if (!date) return "Not seen";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderEventHealth(data) {
  const required = ["PageView", "ViewItem", "AddToCart", "BeginCheckout", "Purchase"];
  const stats = reliableEventStats(data);
  els.logModeBadge.textContent = data.config?.usingDedicatedLogs ? "Dedicated log" : "Shared log";

  els.eventHealthGrid.replaceChildren(
    ...required.map((name) => {
      const stat = stats.get(name) || { count: 0, lastSeen: null };
      const count = eventDisplayCount(name, stat);
      const raw = eventRawCount(stat);
      const label = name === "Purchase" ? "Tracked Purchase" : name;
      const detail = name === "Purchase" && raw !== count
        ? `${raw.toLocaleString()} platform hits · ${eventStatusText(name, stat)}`
        : eventStatusText(name, stat);
      const card = document.createElement("article");
      card.className = `health-card ${count ? "healthy" : "warning"}`;
      card.innerHTML = `
        <span>${escapeHtml(label)}</span>
        <strong>${count.toLocaleString()}</strong>
        <small>${escapeHtml(detail)}</small>
      `;
      return card;
    })
  );

  const base = Math.max(1, eventDisplayCount("PageView", stats.get("PageView")));
  els.funnelList.replaceChildren(
    ...required.map((name) => {
      const count = eventDisplayCount(name, stats.get(name));
      const percent = Math.min(100, Math.round((count / base) * 100));
      const row = document.createElement("article");
      row.className = "funnel-row";
      const label = name === "Purchase" ? "Tracked Purchase" : name;
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${count.toLocaleString()} deduped event${count === 1 ? "" : "s"}</span>
        </div>
        <div class="funnel-meter" aria-label="${escapeHtml(name)} ${percent}%">
          <span style="width: ${percent}%"></span>
        </div>
      `;
      return row;
    })
  );
}

function collectAlerts(data) {
  const stats = reliableEventStats(data);
  const rows = todayRows(data);
  const purchaseRows = rows.filter((item) => canonicalEventName(item.eventName) === "Purchase");
  const purchaseStat = stats.get("Purchase");
  const knownHosts = data.nginx?.todayEvents?.hosts?.filter((host) => host.name !== "Unknown host") || [];
  const alerts = [];

  if (!data.config?.usingDedicatedLogs) {
    alerts.push({
      label: "Shared Nginx log",
      value: "Use SGTM_ACCESS_LOG before trusting mixed-domain data",
      status: "warning"
    });
  }
  if (data.nginx?.todayEvents?.available && data.nginx.todayEvents.count > 0 && !knownHosts.length) {
    alerts.push({
      label: "Host not visible",
      value: "Nginx log format does not expose the request host",
      status: "warning"
    });
  }
  if (!data.docker.available || data.docker.totals?.unhealthy) {
    alerts.push({
      label: "Docker",
      value: data.docker.available ? "Unhealthy container found" : "Docker unavailable",
      status: "error"
    });
  }
  if (data.ssl.available && data.ssl.daysRemaining <= 14) {
    alerts.push({
      label: "SSL",
      value: `${data.ssl.daysRemaining} days remaining`,
      status: data.ssl.daysRemaining <= 7 ? "error" : "warning"
    });
  }
  if (!stats.get("PageView")?.count) {
    alerts.push({
      label: "PageView",
      value: "No recent PageView event",
      status: "warning"
    });
  }
  if (stats.get("PageView")?.count && !stats.get("ViewItem")?.count) {
    alerts.push({
      label: "ViewItem",
      value: "PageView seen, product views missing",
      status: "warning"
    });
  }
  if (stats.get("AddToCart")?.count && !stats.get("BeginCheckout")?.count) {
    alerts.push({
      label: "Checkout",
      value: "AddToCart seen, BeginCheckout missing",
      status: "warning"
    });
  }
  if (stats.get("BeginCheckout")?.count && !eventDisplayCount("Purchase", purchaseStat)) {
    alerts.push({
      label: "Purchase",
      value: "BeginCheckout seen, Purchase missing",
      status: "warning"
    });
  }
  if (purchaseRows.length && purchaseRows.some((item) => !item.value || !item.currency)) {
    alerts.push({
      label: "Purchase value",
      value: "Some purchase requests are missing value or currency",
      status: "warning"
    });
  }
  if (purchaseRows.length && purchaseRows.some((item) => !item.eventId && !item.transactionId)) {
    alerts.push({
      label: "Deduplication",
      value: "Some purchase requests are missing event ID or transaction ID",
      status: "warning"
    });
  }
  return alerts;
}

function renderAlerts(data) {
  const alerts = collectAlerts(data);
  const hasError = alerts.some((alert) => alert.status === "error");
  els.alertBadge.className = "badge";
  els.alertBadge.classList.add(hasError ? "danger" : alerts.length ? "warn" : "ok");
  els.alertBadge.textContent = alerts.length ? `${alerts.length} issue${alerts.length === 1 ? "" : "s"}` : "Clear";
  renderSummaryList(
    els.alertList,
    alerts.length ? alerts : [{ label: "Tracking health", value: "No immediate issues", status: "healthy" }]
  );
}

function renderHostBreakdown(data) {
  const summary = data.nginx?.todayEvents;
  const hosts = summary?.hosts || [];
  const knownHosts = hosts.filter((item) => item.name !== "Unknown host");
  const unknown = hosts.find((item) => item.name === "Unknown host");
  const rows = (knownHosts.length ? knownHosts : hosts).slice(0, 6).map((item) => ({
    label: item.name,
    value: `${Number(item.count || 0).toLocaleString()} requests${item.errors ? `, ${Number(item.errors).toLocaleString()} errors` : ""}`,
    status: item.name === "Unknown host" ? "warning" : Number(item.errors) ? "warning" : "healthy"
  }));

  els.hostBadge.className = "badge";
  els.hostBadge.classList.add(!summary?.available ? "danger" : knownHosts.length ? "ok" : "warn");
  els.hostBadge.textContent = knownHosts.length ? `${knownHosts.length} host${knownHosts.length === 1 ? "" : "s"}` : "Unverified";

  renderSummaryList(
    els.hostBreakdown,
    rows.length
      ? rows
      : [{ label: "Host detection", value: summary?.available ? "No tracking requests today" : "Access log unavailable", status: summary?.available ? "healthy" : "error" }]
  );

  if (unknown && knownHosts.length) {
    const note = document.createElement("article");
    note.className = "summary-item";
    note.innerHTML = `<strong>Unknown host</strong><span class="state warning">${Number(unknown.count || 0).toLocaleString()} requests need log host field</span>`;
    els.hostBreakdown.append(note);
  }
}

function qualityItems(data) {
  const stats = reliableEventStats(data);
  const rows = todayRows(data);
  const purchaseRows = rows.filter((item) => canonicalEventName(item.eventName) === "Purchase");
  const purchaseStat = stats.get("Purchase");
  const purchaseCount = eventDisplayCount("Purchase", purchaseStat);
  const checks = [
    {
      label: "Dedicated logs",
      pass: Boolean(data.config?.usingDedicatedLogs),
      value: data.config?.usingDedicatedLogs ? "Enabled" : "Use SGTM_ACCESS_LOG"
    },
    {
      label: "Host visibility",
      pass: !data.nginx?.todayEvents?.count || Boolean(data.nginx?.todayEvents?.hosts?.some((host) => host.name !== "Unknown host")),
      value: !data.nginx?.todayEvents?.count
        ? "Waiting for requests"
        : data.nginx.todayEvents.hosts?.some((host) => host.name !== "Unknown host")
          ? "Host detected in logs"
          : "Log format missing host"
    },
    {
      label: "ViewItem",
      pass: !stats.get("PageView")?.count || Boolean(stats.get("ViewItem")?.count),
      value: stats.get("ViewItem")?.count ? `${stats.get("ViewItem").count.toLocaleString()} events` : "Missing after PageView"
    },
    {
      label: "Checkout flow",
      pass: !stats.get("AddToCart")?.count || Boolean(stats.get("BeginCheckout")?.count),
      value: stats.get("BeginCheckout")?.count ? `${stats.get("BeginCheckout").count.toLocaleString()} BeginCheckout` : "No BeginCheckout after AddToCart"
    },
    {
      label: "Purchase flow",
      pass: !stats.get("BeginCheckout")?.count || Boolean(purchaseCount),
      value: purchaseCount ? `${purchaseCount.toLocaleString()} Purchase` : "No Purchase after BeginCheckout"
    },
    {
      label: "Purchase metadata",
      pass: !purchaseRows.length || purchaseRows.every((item) => item.value && item.currency),
      value: purchaseRows.length ? "Value and currency checked" : "No purchase today"
    },
    {
      label: "Deduplication IDs",
      pass: !purchaseRows.length || purchaseRows.every((item) => item.eventId || item.transactionId),
      value: purchaseRows.length ? "Event ID or transaction ID checked" : "No purchase today"
    },
    {
      label: "Purchase dedupe",
      pass: !purchaseRows.length || Boolean(purchaseCount),
      value: Number(purchaseStat?.duplicateCount || 0)
        ? `${purchaseCount.toLocaleString()} orders from ${eventRawCount(purchaseStat).toLocaleString()} requests${Number(purchaseStat?.keyedCount || 0) ? "" : " (estimated)"}`
        : "No duplicate purchase requests"
    }
  ];

  return checks.map((check) => ({
    label: check.label,
    value: check.value,
    status: check.pass ? "healthy" : "warning"
  }));
}

function renderQualityChecks(data) {
  const items = qualityItems(data);
  const issues = items.filter((item) => item.status !== "healthy").length;
  els.qualityBadge.className = "badge";
  els.qualityBadge.classList.add(issues ? "warn" : "ok");
  els.qualityBadge.textContent = issues ? `${issues} check${issues === 1 ? "" : "s"}` : "Clean";
  renderSummaryList(els.qualityChecks, items);
}

function purchaseRows(data) {
  return todayRows(data).filter((item) => canonicalEventName(item.eventName) === "Purchase");
}

function renderNoiseSummary(data) {
  const summary = data.nginx?.todayEvents;
  const noise = Number(summary?.noise || 0);
  const clean = Number(summary?.count || 0);
  const total = Number(summary?.totalLines || clean + noise);
  const percent = total ? Math.round((noise / total) * 100) : 0;
  const rows = [
    { label: "Clean SGTM events", value: clean.toLocaleString(), status: clean ? "healthy" : "warning" },
    { label: "Non-tracking traffic", value: `${noise.toLocaleString()} (${percent}%)`, status: noise ? "warning" : "healthy" },
    { label: "Likely bot scans", value: Number(summary?.botNoise || 0).toLocaleString(), status: summary?.botNoise ? "warning" : "healthy" },
    ...((summary?.noiseReasons || []).slice(0, 3).map((item) => ({
      label: item.name,
      value: Number(item.count || 0).toLocaleString(),
      status: item.name?.includes("scan") || item.name === "Crawler" ? "warning" : "healthy"
    })))
  ];

  els.noiseBadge.className = "badge";
  els.noiseBadge.classList.add(noise ? "warn" : "ok");
  els.noiseBadge.textContent = noise ? `${percent}% noise` : "Clean";
  renderSummaryList(els.noiseSummary, rows);
}

function renderLatestPurchase(data) {
  const latestOrder = data.orders?.today?.latest;
  if (latestOrder) {
    els.purchaseBadge.className = "badge ok";
    els.purchaseBadge.textContent = "Store order";
    renderSummaryList(els.latestPurchase, [
      { label: "Time", value: formatDate(latestOrder.createdAt), status: "healthy" },
      { label: "Value", value: latestOrder.amount !== null && latestOrder.amount !== undefined ? formatMoney(latestOrder.amount, latestOrder.currency) : "Missing", status: latestOrder.amount !== null && latestOrder.amount !== undefined ? "healthy" : "warning" },
      { label: "Order ID", value: latestOrder.id || "Missing", status: latestOrder.id ? "healthy" : "warning" },
      { label: "Order type", value: latestOrder.orderType || latestOrder.source || "store", status: "healthy" }
    ]);
    return;
  }

  const latest = purchaseRows(data)[0];
  if (!latest) {
    els.purchaseBadge.className = "badge warn";
    els.purchaseBadge.textContent = "No purchase";
    renderSummaryList(els.latestPurchase, [{ label: "Purchase", value: "No purchase request found today", status: "warning" }]);
    return;
  }

  els.purchaseBadge.className = "badge ok";
  els.purchaseBadge.textContent = "Found";
  renderSummaryList(els.latestPurchase, [
    { label: "Time", value: latest.displayDate, status: "healthy" },
    { label: "Value", value: latest.value && latest.currency ? `${latest.value} ${latest.currency}` : "Missing", status: latest.value && latest.currency ? "healthy" : "warning" },
    { label: "ID", value: latest.eventId || latest.transactionId || "Missing", status: latest.eventId || latest.transactionId ? "healthy" : "warning" },
    { label: "Host", value: latest.host || "Unknown host", status: latest.host && latest.host !== "Unknown host" ? "healthy" : "warning" }
  ]);
}

function renderBusinessSnapshot(data) {
  const summary = purchaseSummary(data);
  const hasPurchases = summary.rawCount > 0 || summary.uniqueCount > 0;
  const fromOrders = summary.source === "orders";
  const exact = summary.keyedCount > 0;
  const estimated = !exact && summary.estimatedKeyCount > 0;
  const duplicateRate = summary.rawCount ? Math.round((summary.duplicateCount / summary.rawCount) * 100) : 0;

  els.businessBadge.className = "badge";
  els.businessBadge.classList.add(!hasPurchases ? "warn" : fromOrders || exact ? "ok" : "warn");
  els.businessBadge.textContent = !hasPurchases ? "No purchases" : fromOrders ? "Store orders" : exact ? "Exact" : "Estimated";

  els.businessPurchases.textContent = summary.uniqueCount.toLocaleString();
  els.businessPurchaseDetail.textContent = summary.duplicateCount
    ? `${summary.rawCount.toLocaleString()} raw purchase requests`
    : fromOrders ? "From order webhook" : "No duplicate purchase hits";

  els.businessRevenue.textContent = summary.uniqueRevenue ? formatMoney(summary.uniqueRevenue, summary.currency) : "--";
  els.businessRevenueDetail.textContent = summary.rawRevenue && summary.rawRevenue !== summary.uniqueRevenue
    ? `${formatMoney(summary.rawRevenue, summary.currency)} before dedupe`
    : fromOrders ? "Actual store order value" : "Deduped order value";

  els.businessAov.textContent = summary.averageOrderValue ? formatMoney(summary.averageOrderValue, summary.currency) : "--";
  els.businessAovDetail.textContent = summary.uniqueCount ? `${summary.uniqueCount.toLocaleString()} unique purchase${summary.uniqueCount === 1 ? "" : "s"}` : "Waiting for purchase value";

  els.businessDuplicates.textContent = summary.duplicateCount.toLocaleString();
  els.businessDuplicateDetail.textContent = summary.duplicateCount
    ? `${duplicateRate}% duplicate rate${estimated ? " · estimated" : ""}`
    : fromOrders ? "Tracking duplicates do not affect orders" : "No duplicate purchase hits";
}

function renderBusinessGrid(el, items) {
  el.replaceChildren(
    ...items.map((item) => {
      const card = document.createElement("article");
      card.className = "business-item";
      card.innerHTML = `
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      `;
      return card;
    })
  );
}

function renderReconciliation(data) {
  const rec = data.reconciliation || {};
  const status = rec.status === "healthy" ? "ok" : rec.status === "waiting" ? "warn" : "warn";
  els.reconciliationBadge.className = `badge ${status}`;
  els.reconciliationBadge.textContent = rec.status === "healthy" ? "Covered" : rec.status === "waiting" ? "Waiting" : "Needs review";
  renderBusinessGrid(els.reconciliationGrid, [
    {
      label: "Actual store orders",
      value: Number(rec.storeOrders || 0).toLocaleString(),
      detail: "From ecommerce order webhook"
    },
    {
      label: "Deduped tracked purchases",
      value: Number(rec.trackedUnique || 0).toLocaleString(),
      detail: "Estimated unique purchases from SGTM logs"
    },
    {
      label: "Tracked purchase hits",
      value: Number(rec.trackedHits || 0).toLocaleString(),
      detail: `${Number(rec.duplicateHits || 0).toLocaleString()} extra platform/tag copies`
    },
    {
      label: "Tracking coverage",
      value: `${Number(rec.coverage || 0).toLocaleString()}%`,
      detail: Number(rec.missing || 0) ? `${Number(rec.missing || 0).toLocaleString()} order(s) not seen in SGTM purchases` : "Store and SGTM purchases line up"
    }
  ]);
}

function renderDashboard(data) {
  const docker = data.docker;
  const totals = docker.totals || { total: 0, running: 0, stopped: 0, unhealthy: 0 };
  els.containerTotal.textContent = text(totals.total, "0");
  els.containerDetail.textContent = docker.available ? `${totals.running} running, ${totals.stopped} stopped` : docker.message;
  els.dockerHealth.textContent = docker.available ? (totals.unhealthy ? `${totals.unhealthy} issue` : "OK") : "Offline";
  els.dockerDetail.textContent = docker.available ? docker.message : text(docker.detail, docker.message);

  const requestCount = data.nginx.requestCountToday;
  els.requestCount.textContent = requestCount.available ? requestCount.count.toLocaleString() : "--";
  els.requestDetail.textContent = requestCount.available
    ? `Matched ${requestCount.token} in latest ${Number(requestCount.sampledLines || requestCount.summaryTailLines || 0).toLocaleString()} lines`
    : text(requestCount.detail, requestCount.message);

  if (data.ssl.available) {
    els.sslDays.textContent = `${data.ssl.daysRemaining}d`;
    els.sslDetail.textContent = `Expires ${formatDate(data.ssl.expiresAt)}`;
  } else {
    els.sslDays.textContent = "--";
    els.sslDetail.textContent = text(data.ssl.detail, data.ssl.message);
  }

  const stats = reliableEventStats(data);
  const topEvents = [...stats.entries()]
    .sort((a, b) => eventDisplayCount(b[0], b[1]) - eventDisplayCount(a[0], a[1]))
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      value: eventDisplayCount(label, value).toLocaleString(),
      status: label.includes("Blocked") || label.includes("Rejected") ? "warning" : "healthy"
    }));
  renderSummaryList(
    els.trafficSummary,
    topEvents.length ? topEvents : [{ label: "Visitor events", value: "0", status: "healthy" }]
  );

  renderSummaryList(els.runtimeChecks, [
    { label: "Docker collector", value: docker.available ? "Available" : "Unavailable", status: docker.available ? "healthy" : "error" },
    { label: "Nginx access log", value: data.nginx.accessLog.available ? "Readable" : "Blocked", status: data.nginx.accessLog.available ? "healthy" : "error" },
    { label: "Nginx error log", value: data.nginx.errorLog.available ? "Readable" : "Blocked", status: data.nginx.errorLog.available ? "healthy" : "error" },
    { label: "SSL check", value: data.ssl.available ? "Configured" : "Missing", status: data.ssl.available ? "healthy" : "warning" }
  ]);
  renderEventHealth(data);
  renderAlerts(data);
  renderHostBreakdown(data);
  renderQualityChecks(data);
  renderNoiseSummary(data);
  renderLatestPurchase(data);
  renderBusinessSnapshot(data);
  renderReconciliation(data);
}

function eventCounts(items) {
  return items.reduce((counts, item) => {
    const key = item.eventName || "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
}

function clientCounts(items) {
  return items.reduce((counts, item) => {
    const key = item.client || "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
}

function renderLegend(counts) {
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.analyticsLegend.replaceChildren(
    ...rows.map(([label, value], index) => {
      const row = document.createElement("div");
      row.className = "legend-item";
      row.innerHTML = `<span class="legend-dot dot-${index % 4}"></span><span>${escapeHtml(label)}</span><strong>${value.toLocaleString()}</strong>`;
      return row;
    })
  );
}

function renderLegendRows(rows) {
  els.analyticsLegend.replaceChildren(
    ...rows.slice(0, 6).map((row, index) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-dot dot-${index % 4}"></span><span>${escapeHtml(row.label)}</span><strong>${row.value.toLocaleString()}</strong>`;
      return item;
    })
  );
}

function chartPoints(items, bucketCount = 12) {
  const dated = items.filter((item) => item.date).sort((a, b) => a.date - b.date);
  if (!dated.length) return [];
  const first = dated[0].date.getTime();
  const last = dated[dated.length - 1].date.getTime();
  const span = Math.max(last - first, 1);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: index + 1,
    total: 0,
    errors: 0
  }));

  for (const item of dated) {
    const index = Math.min(bucketCount - 1, Math.floor(((item.date.getTime() - first) / span) * bucketCount));
    buckets[index].total += 1;
    if (Number(item.status) >= 400) buckets[index].errors += 1;
  }

  return buckets;
}

function areaPath(values, width, height, padding, key) {
  const max = Math.max(1, ...values.map((point) => point[key]));
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point[key] / max) * (height - padding * 2);
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  return { line, area };
}

function renderChart(el, items, mode = "total") {
  const buckets = chartPoints(items);
  if (!buckets.length) {
    el.innerHTML = '<div class="empty-log">No chart data yet.</div>';
    return;
  }

  const width = 720;
  const height = 260;
  const padding = 28;
  const total = areaPath(buckets, width, height, padding, "total");
  const errors = areaPath(buckets, width, height, padding, "errors");
  const xLines = buckets
    .map((_, index) => {
      const x = padding + index * ((width - padding * 2) / Math.max(buckets.length - 1, 1));
      return `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" />`;
    })
    .join("");

  el.innerHTML = `
    <svg class="analytics-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Requests over recent log sample">
      <g class="chart-grid">${xLines}<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" /></g>
      <path class="chart-area total" d="${total.area}"></path>
      <path class="chart-line total" d="${total.line}"></path>
      ${mode === "client" ? "" : `<path class="chart-area error" d="${errors.area}"></path><path class="chart-line error" d="${errors.line}"></path>`}
    </svg>
  `;
}

function renderBarChart(el, rows) {
  const visibleRows = rows.slice(0, 8);
  const max = Math.max(1, ...visibleRows.map((row) => row.value));
  if (!visibleRows.length) {
    el.innerHTML = '<div class="empty-log">No chart data yet.</div>';
    return;
  }

  el.innerHTML = `
    <div class="bar-chart" role="img" aria-label="Today request totals">
      ${visibleRows.map((row) => {
        const percent = Math.max(2, Math.round((row.value / max) * 100));
        return `
          <div class="bar-row">
            <div class="bar-row-top">
              <strong>${escapeHtml(row.label)}</strong>
              <span>${row.value.toLocaleString()}</span>
            </div>
            <div class="bar-track">
              <span style="width: ${percent}%"></span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderHourlyTrend(data) {
  const hourly = data.nginx?.todayEvents?.hourly || [];
  const max = Math.max(1, ...hourly.map((item) => Number(item.total || 0)));
  if (!hourly.length) {
    els.hourlyTrend.innerHTML = '<div class="empty-log">No hourly data yet.</div>';
    return;
  }

  els.hourlyTrend.innerHTML = `
    <div class="hourly-chart" role="img" aria-label="Hourly event trend">
      ${hourly.map((item) => {
        const total = Number(item.total || 0);
        const errors = Number(item.errors || 0);
        const purchases = Number(item.purchases || 0);
        const height = Math.max(3, Math.round((total / max) * 100));
        const label = `${String(item.hour).padStart(2, "0")}:00`;
        return `
          <div class="hourly-column" title="${label}: ${total} events, ${errors} errors, ${purchases} purchases">
            <div class="hourly-bars">
              <span class="hourly-total" style="height: ${height}%"></span>
              ${errors ? `<span class="hourly-errors" style="height: ${Math.max(3, Math.round((errors / max) * 100))}%"></span>` : ""}
              ${purchases ? `<span class="hourly-purchases" style="height: ${Math.max(3, Math.round((purchases / max) * 100))}%"></span>` : ""}
            </div>
            <small>${item.hour % 3 === 0 ? escapeHtml(String(item.hour).padStart(2, "0")) : ""}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderClientSummaryRows(rows) {
  if (!rows.length) {
    els.clientBreakdown.innerHTML = '<tr><td colspan="4">No request data available.</td></tr>';
    return;
  }

  els.clientBreakdown.replaceChildren(
    ...rows.slice(0, 10).map((item) => {
      const row = document.createElement("tr");
      const errorRate = item.total ? `${((item.errors / item.total) * 100).toFixed(1)}%` : "0%";
      row.innerHTML = `
        <td>${escapeHtml(item.label)}</td>
        <td>${item.total.toLocaleString()}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${errorRate}</td>
      `;
      return row;
    })
  );
}

function renderClientBreakdown(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = `${item.eventName || "Other"}|${item.client || "Other"}`;
    const current = grouped.get(key) || { event: item.eventName || "Other", client: item.client || "Other", total: 0, errors: 0 };
    current.total += 1;
    if (Number(item.status) >= 400) current.errors += 1;
    grouped.set(key, current);
  }

  const rows = [...grouped.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  if (!rows.length) {
    els.clientBreakdown.innerHTML = '<tr><td colspan="4">No request data available.</td></tr>';
    return;
  }

  els.clientBreakdown.replaceChildren(
    ...rows.map((item) => {
      const row = document.createElement("tr");
      const errorRate = item.total ? `${((item.errors / item.total) * 100).toFixed(1)}%` : "0%";
      row.innerHTML = `
        <td>${escapeHtml(item.event)}</td>
        <td>${item.total.toLocaleString()}</td>
        <td>${escapeHtml(item.client)}</td>
        <td>${errorRate}</td>
      `;
      return row;
    })
  );
}

function eventTotal(rows, name) {
  const item = (rows || []).find((row) => canonicalEventName(row.name) === name);
  if (canonicalEventName(name) === "Purchase" && Number.isFinite(Number(item?.uniqueCount))) {
    return Number(item.uniqueCount);
  }
  return Number(item?.count || 0);
}

function renderDailyHistory(data) {
  const history = data.history;
  const rows = history?.daily || [];
  els.historyBadge.className = "badge";
  els.historyBadge.classList.add(history?.available ? "ok" : "danger");
  els.historyBadge.textContent = history?.available
    ? `${rows.length} day${rows.length === 1 ? "" : "s"}`
    : "Unavailable";

  if (!rows.length) {
    els.dailyHistory.innerHTML = '<tr><td colspan="6">No persisted history yet.</td></tr>';
    return;
  }

  els.dailyHistory.replaceChildren(
    ...rows.slice(0, 30).map((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.date)}</td>
        <td>${Number(item.total || 0).toLocaleString()}</td>
        <td>${eventTotal(item.events, "Purchase").toLocaleString()}</td>
        <td>${Number(item.errors || 0).toLocaleString()}</td>
        <td>${Number(item.noise || 0).toLocaleString()}</td>
        <td>${escapeHtml(formatShortDate(item.updatedAt))}</td>
      `;
      return row;
    })
  );
}

function renderAnalytics(data) {
  const summary = data.nginx?.todayEvents;
  if (summary?.available) {
    const eventRows = (summary.events || [])
      .map((item) => {
        const label = canonicalEventName(item.name);
        const stat = {
          count: Number(item.count) || 0,
          rawCount: Number(item.rawCount || item.count) || 0,
          uniqueCount: Number.isFinite(Number(item.uniqueCount)) ? Number(item.uniqueCount) : null,
          duplicateCount: Number(item.duplicateCount) || 0,
          keyedCount: Number(item.keyedCount) || 0
        };
        return {
          label,
          value: eventDisplayCount(label, stat),
          total: eventRawCount(stat),
          errors: Number(item.errors) || 0,
          type: label === "Purchase" && stat.duplicateCount
            ? Number(stat.keyedCount || 0) ? "Unique orders" : "Estimated orders"
            : "Event"
        };
      })
      .sort((a, b) => b.value - a.value);
    const clientRows = (summary.clients || [])
      .map((item) => ({
        label: item.name || "Other",
        value: Number(item.count) || 0,
        total: Number(item.count) || 0,
        errors: Number(item.errors) || 0,
        type: "Client"
      }))
      .sort((a, b) => b.value - a.value);

    els.analyticsModeBadge.textContent = "Today";
    els.analyticsSummary.textContent = `${summary.count.toLocaleString()} requests today across ${eventRows.length.toLocaleString()} event types and ${clientRows.length.toLocaleString()} clients.`;
    els.analyticsTotal.textContent = `Total requests: ${summary.count.toLocaleString()}${summary.errors ? `, ${summary.errors.toLocaleString()} errors` : ""}`;
    renderLegendRows(eventRows);
    renderBarChart(els.analyticsChart, eventRows);
    renderHourlyTrend(data);
    renderDailyHistory(data);
    renderClientSummaryRows(clientRows);
    renderBarChart(els.clientChart, clientRows);
    return;
  }

  const items = trackingEvents(data);
  const errors = items.filter((item) => Number(item.status) >= 400).length;
  const counts = eventCounts(items);
  const clients = clientCounts(items);
  els.analyticsModeBadge.textContent = "Recent sample";
  els.analyticsSummary.textContent = `${items.length.toLocaleString()} requests across ${counts.size.toLocaleString()} event types and ${clients.size.toLocaleString()} clients.`;
  els.analyticsTotal.textContent = `Total requests: ${items.length.toLocaleString()}`;
  renderLegend(counts);
  renderChart(els.analyticsChart, items);
  renderHourlyTrend(data);
  renderDailyHistory(data);
  renderClientBreakdown(items);
  renderChart(els.clientChart, items.filter((item) => Number(item.status) < 400 || errors === items.length), "client");
}

function renderSettings(data) {
  const settings = [
    ["Host", data.config?.host],
    ["Port", data.config?.port],
    ["Nginx access log", data.config?.accessLog],
    ["Nginx error log", data.config?.errorLog],
    ["SSL source", data.ssl?.source || data.config?.sslDomain || "Not configured"],
    ["Log tail lines", data.config?.logTailLines],
    ["Summary scan lines", data.config?.summaryTailLines],
    ["Event log limit", data.config?.eventLogLimit],
    ["Data directory", data.config?.dataDir],
    ["History retention", `${text(data.config?.historyRetentionDays, "0")} days`],
    ["Dedicated logs", data.config?.usingDedicatedLogs ? "Enabled" : "Not enabled"],
    ["Order webhook", data.config?.orderWebhookEnabled ? "Enabled" : "Disabled"],
    ["Alert webhook", data.config?.alertWebhookEnabled ? "Enabled" : "Disabled"]
  ];

  els.settingsGrid.replaceChildren(
    ...settings.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "setting-card";
      card.innerHTML = `<strong>${escapeHtml(label)}</strong><code>${escapeHtml(text(value))}</code><span>Read from the server environment.</span>`;
      return card;
    })
  );
}

function renderDeployment(data) {
  const checks = data.deploymentChecks || [];
  const issues = checks.filter((item) => item.status === "warning" || item.status === "error" || item.status === "critical").length;
  els.deploymentBadge.textContent = issues ? `${issues} issue${issues === 1 ? "" : "s"}` : "Ready";
  els.deploymentBadge.className = `status-dot ${issues ? "warn" : ""}`;
  renderSummaryList(els.deploymentChecks, checks.length ? checks : [{ label: "Deployment checks", value: "Unavailable", status: "warning" }]);

  const recommendations = [
    ["PORT", "3100"],
    ["HOST", "127.0.0.1"],
    ["SGTM_ACCESS_LOG", "/var/log/nginx/sgtm-access.log"],
    ["SGTM_ERROR_LOG", "/var/log/nginx/sgtm-error.log"],
    ["EVENT_LOG_LIMIT", text(data.config?.eventLogLimit, "500")],
    ["DATA_DIR", text(data.config?.dataDir, "/var/www/sgtm-control-panel/data")],
    ["HISTORY_RETENTION_DAYS", text(data.config?.historyRetentionDays, "90")],
    ["PROVISION_PORT_START", text(data.config?.provisionPortStart, "8200")],
    ["PROVISION_PORT_END", text(data.config?.provisionPortEnd, "8999")],
    ["PROVISION_DNS_TARGET", text(data.config?.provisionDnsTarget, "server.example.com")],
    ["TRACKING_HOSTS", (data.config?.trackingHosts || []).join(",") || "sgtm.shobaz.com,server.shobaz.com,shobaz.com"],
    ["AUTH_ENABLED", "true"],
    ["AUTH_SECRET", "openssl rand -hex 32"]
  ];

  els.deploymentRecommendations.replaceChildren(
    ...recommendations.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "setting-card";
      card.innerHTML = `<strong>${escapeHtml(label)}</strong><code>${escapeHtml(value)}</code><span>Recommended production value.</span>`;
      return card;
    })
  );
}

function codeBlock(label, value) {
  return `
    <details class="plan-block">
      <summary>${escapeHtml(label)}</summary>
      <pre><code>${escapeHtml(value || "Not generated")}</code></pre>
    </details>
  `;
}

function renderProvisioning(data) {
  const requests = data.provisioning?.requests || [];
  const pending = requests.filter((item) => item.status === "pending_launch" || item.status === "pending_admin_approval").length;
  els.provisioningBadge.textContent = pending ? `${pending} queued` : "Launch queue";
  els.provisioningQueueBadge.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;

  if (!requests.length) {
    els.provisioningRequests.innerHTML = '<div class="empty-log">No provisioning requests yet.</div>';
    return;
  }

  els.provisioningRequests.replaceChildren(
    ...requests.map((request) => {
      const card = document.createElement("article");
      card.className = "provisioning-card";
      const plan = request.plan || {};
      card.innerHTML = `
        <div class="provisioning-card-head">
          <div>
            <strong>${escapeHtml(request.instanceName)}</strong>
            <span>${escapeHtml(request.domain)} · auto port ${escapeHtml(request.port)}</span>
          </div>
          <span class="state warning">${escapeHtml(request.status.replaceAll("_", " "))}</span>
        </div>
        ${request.preparedFiles ? `
          <div class="summary-list compact-list">
            <article class="summary-item"><strong>Docker files</strong><span class="state prepared">${escapeHtml(request.preparedFiles.composePath)}</span></article>
            <article class="summary-item"><strong>Nginx draft</strong><span class="state prepared">${escapeHtml(request.preparedFiles.nginxPath)}</span></article>
          </div>
        ` : ""}
        <div class="summary-list compact-list">
          ${(plan.checks || []).map((check) => `
            <article class="summary-item">
              <strong>${escapeHtml(check.label)}</strong>
              <span class="state ${stateClass(check.status)}">${escapeHtml(check.value)}</span>
            </article>
          `).join("")}
        </div>
        ${request.ownerEmail ? `<p class="provisioning-meta">Owner: ${escapeHtml(request.ownerEmail)}</p>` : ""}
        ${request.notes ? `<p class="provisioning-meta">${escapeHtml(request.notes)}</p>` : ""}
        ${codeBlock("Environment file", plan.env)}
        ${codeBlock("Docker Compose", plan.dockerCompose)}
        ${codeBlock("Nginx server block", plan.nginx)}
        ${codeBlock("Admin commands", (plan.commands || []).join("\n"))}
        <button class="button" type="button" data-provision-prepare="${escapeHtml(request.id)}">Prepare Docker + Nginx Files</button>
      `;
      return card;
    })
  );

  els.provisioningRequests.querySelectorAll("[data-provision-prepare]").forEach((button) => {
    button.addEventListener("click", () => prepareProvisioningFiles(button.dataset.provisionPrepare));
  });
}

function renderAdmin(data) {
  const customers = data.customers?.tenants || [];
  els.adminBadge.textContent = customers.length ? `${customers.length} tenant${customers.length === 1 ? "" : "s"}` : "No tenants";
  els.customersBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
  els.customersBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;

  renderSummaryList(
    els.customersList,
    customers.length
      ? customers.map((customer) => ({
        label: customer.name || customer.id,
        value: `${customer.domain || "No domain"} · ${customer.plan || "No plan"} · ${String(customer.status || "unknown").replaceAll("_", " ")}`,
        status: customer.status === "active" ? "healthy" : "warning"
      }))
      : [{ label: "Customer model", value: "Configure TENANT_* or create provisioning requests", status: "warning" }]
  );

  renderSummaryList(els.adminActions, [
    { label: "Provisioning", value: "Generate plans and files before launch", status: "healthy" },
    { label: "Docker/Nginx mutation", value: "Manual/admin approved only", status: "warning" },
    { label: "Webhook secrets", value: data.config?.orderWebhookEnabled ? "Configured" : "Missing", status: data.config?.orderWebhookEnabled ? "healthy" : "warning" },
    { label: "Log isolation", value: data.config?.usingDedicatedLogs ? "Dedicated SGTM logs" : "Shared log warning", status: data.config?.usingDedicatedLogs ? "healthy" : "warning" }
  ]);

  const wizard = data.setupWizard || { complete: 0, total: 0, steps: [] };
  els.wizardBadge.className = `badge ${wizard.complete === wizard.total ? "ok" : "warn"}`;
  els.wizardBadge.textContent = `${wizard.complete}/${wizard.total}`;
  els.setupWizard.replaceChildren(
    ...wizard.steps.map((step, index) => {
      const row = document.createElement("article");
      row.className = `wizard-step ${step.status}`;
      row.innerHTML = `
        <span>${index + 1}</span>
        <div>
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.detail)}</p>
        </div>
        <em>${escapeHtml(step.status)}</em>
      `;
      return row;
    })
  );
}

function renderIntegrations(data) {
  const integrations = data.integrations || {};
  const orderWebhook = integrations.orderWebhook || {};
  const meta = integrations.metaCapi || { checks: [] };

  els.integrationsBadge.textContent = orderWebhook.enabled ? "Configured" : "Needs setup";
  els.storeWebhookBadge.className = `badge ${orderWebhook.status === "healthy" ? "ok" : "warn"}`;
  els.storeWebhookBadge.textContent = orderWebhook.status || "Webhook";
  renderSummaryList(els.storeWebhookList, [
    { label: "Order webhook", value: orderWebhook.enabled ? "Enabled" : "Set ORDER_WEBHOOK_SECRET", status: orderWebhook.enabled ? "healthy" : "warning" },
    { label: "Endpoint", value: orderWebhook.endpoint || "/api/orders/webhook", status: "healthy" },
    { label: "Latest order", value: orderWebhook.lastOrder?.id || "Waiting", status: orderWebhook.lastOrder ? "healthy" : "warning" },
    { label: "Supported stores", value: "Custom API, Shopify, WooCommerce", status: "healthy" }
  ]);

  els.adPlatformBadge.className = `badge ${meta.status === "detected" ? "ok" : "warn"}`;
  els.adPlatformBadge.textContent = meta.status || "Waiting";
  renderSummaryList(
    els.adPlatformChecks,
    (meta.checks || []).map((check) => ({
      label: check.label,
      value: check.status === "healthy" ? "OK" : "Needs attention",
      status: check.status === "healthy" ? "healthy" : "warning"
    }))
  );

  const examples = [
    {
      title: "Custom store",
      body: `POST /api/orders/webhook\nHeaders: x-order-webhook-secret: <secret>\n\n{"order_id":"0478","total":359,"currency":"BDT","created_at":"2026-06-02T00:22:00+06:00","source":"store","order_type":"custom"}`
    },
    {
      title: "Shopify mapping",
      body: `order_id: order.name or order.id\ntotal: total_price\ncurrency: currency\ncreated_at: created_at\norder_type: shopify`
    },
    {
      title: "WooCommerce mapping",
      body: `order_id: id or number\ntotal: total\ncurrency: currency\ncreated_at: date_created_gmt\norder_type: woocommerce`
    }
  ];
  renderDocsGrid(els.integrationExamples, examples);
}

function renderDocsGrid(el, items) {
  el.replaceChildren(
    ...items.map((item) => {
      const card = document.createElement("article");
      card.className = "doc-card";
      card.innerHTML = `<strong>${escapeHtml(item.title)}</strong><pre>${escapeHtml(item.body)}</pre>`;
      return card;
    })
  );
}

function renderBilling(data) {
  const usage = data.usage || {};
  const statusClass = usage.status === "healthy" ? "ok" : usage.status === "unmetered" ? "ok" : "warn";
  els.billingBadge.textContent = usage.status === "over_limit" ? "Over limit" : usage.status === "warning" ? "Watch usage" : "Healthy";
  els.planBadge.className = `badge ${statusClass}`;
  els.planBadge.textContent = usage.plan || "Plan";
  renderBusinessGrid(els.billingGrid, [
    { label: "Plan", value: usage.plan || "--", detail: `${Number(usage.containerLimit || 0).toLocaleString()} container limit` },
    { label: "Requests this month", value: Number(usage.requestsMonth || 0).toLocaleString(), detail: `${Number(usage.usagePercent || 0)}% of plan` },
    { label: "Monthly limit", value: Number(usage.requestLimit || 0).toLocaleString(), detail: usage.period || "Current month" },
    { label: "Requests today", value: Number(usage.requestsToday || 0).toLocaleString(), detail: "Clean SGTM event requests" }
  ]);

  renderDocsGrid(els.packageGrid, [
    { title: "Starter", body: "1 container\n1 custom domain\n100k requests/month\nLogs + basic monitoring" },
    { title: "Growth", body: "500k requests/month\nOrder reconciliation\nMeta/GA4 diagnostics\nEmail alerts" },
    { title: "Pro", body: "1M requests/month\nMultiple domains\nAdvanced monitoring\nPriority support" },
    { title: "Agency", body: "Multiple customers\nTeam access\nWhite-label reports\nCustom limits" }
  ]);
}

function renderDocs(data) {
  const base = data.config?.publicBaseUrl || window.location.origin;
  renderDocsGrid(els.docsList, [
    {
      title: "Positioning",
      body: "Managed server-side Google Tag Manager hosting with order reconciliation, tracking diagnostics, logs, monitoring, and customer setup support."
    },
    {
      title: "Customer DNS",
      body: `Create a subdomain such as server.customer.com and point it to ${data.config?.provisionDnsTarget || "your SGTM host"}. Wait for DNS, then issue SSL.`
    },
    {
      title: "GTM install",
      body: `Install web GTM globally and load the container from the customer SGTM domain. Verify Tag Assistant sees the web container and SGTM logs receive events.`
    },
    {
      title: "Order webhook",
      body: `POST ${base}/api/orders/webhook with x-order-webhook-secret. Send order_id, total, currency, created_at, source, and order_type.`
    },
    {
      title: "Reliability promise",
      body: "Do not promise 100% recovery. Promise hosted SGTM, first-party domain setup, diagnostics, monitoring, and clear reporting when tracking misses real store orders."
    },
    {
      title: "Launch checklist",
      body: "Auth enabled\nDedicated customer logs\nSSL healthy\nDocker healthy\nOrder webhook connected\nPurchase tracking coverage visible\nUsage limits configured"
    }
  ]);
}

async function prepareProvisioningFiles(id) {
  els.provisioningFormMessage.textContent = "Preparing Docker and Nginx draft files...";
  try {
    const response = await fetch(`/api/provisioning/requests/${encodeURIComponent(id)}/prepare`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Prepare failed"]).join(" "));
    els.provisioningFormMessage.textContent = "Docker and Nginx draft files prepared.";
    await loadDashboard();
    setView("provisioning");
  } catch (error) {
    els.provisioningFormMessage.textContent = error.message;
  }
}

function renderLogs(data) {
  renderEventTable(data);
  renderPurchaseInspector(data);
  setLog(els.errorLog, data.nginx.errorLog, "error");
  setLog(els.dockerLog, data.dockerLogs, "docker");
  els.dockerLogSource.textContent = data.dockerLogs.container || "tail";
  els.dockerLogHelp.textContent = data.dockerLogs.container
    ? `Preview from ${data.dockerLogs.container}.`
    : "Preview from the first running container.";
}

function renderAll(data) {
  els.generatedAt.textContent = `Updated ${formatDate(data.generatedAt)}`;
  renderDashboard(data);
  renderContainers(data.docker);
  renderLogs(data);
  renderAnalytics(data);
  renderSettings(data);
  renderDeployment(data);
  renderProvisioning(data);
  renderAdmin(data);
  renderIntegrations(data);
  renderBilling(data);
  renderDocs(data);
}

async function loadDashboard() {
  els.refreshButton.disabled = true;
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
    latestData = data;
    renderAll(data);
  } catch (error) {
    els.generatedAt.textContent = "Update failed";
    els.containerCards.innerHTML = `<div class="empty-log">${escapeHtml(error.message)}</div>`;
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.viewTarget));
});

els.refreshButton.addEventListener("click", loadDashboard);
els.eventStatusFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.eventTypeFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.clientFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.requestUrlFilter.addEventListener("input", () => latestData && renderLogs(latestData));
els.purchaseSearch.addEventListener("input", () => latestData && renderPurchaseInspector(latestData));
els.provisioningForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.provisioningFormMessage.textContent = "Submitting request...";
  const payload = Object.fromEntries(new FormData(els.provisioningForm).entries());
  try {
    const response = await fetch("/api/provisioning/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Request failed"]).join(" "));
    els.provisioningForm.reset();
    els.provisioningFormMessage.textContent = `Instance request queued. Auto-assigned port ${result.request.port}.`;
    await loadDashboard();
    setView("provisioning");
  } catch (error) {
    els.provisioningFormMessage.textContent = error.message;
  }
});
window.addEventListener("hashchange", () => setView(window.location.hash.replace("#", "") || "dashboard"));

setView(window.location.hash.replace("#", "") || "dashboard");
loadDashboard();
