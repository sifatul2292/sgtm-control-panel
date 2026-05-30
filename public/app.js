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
  analyticsSummary: document.querySelector("#analyticsSummary"),
  analyticsTotal: document.querySelector("#analyticsTotal"),
  analyticsModeBadge: document.querySelector("#analyticsModeBadge"),
  analyticsLegend: document.querySelector("#analyticsLegend"),
  analyticsChart: document.querySelector("#analyticsChart"),
  clientBreakdown: document.querySelector("#clientBreakdown"),
  clientChart: document.querySelector("#clientChart")
};

const viewTitles = {
  dashboard: ["Dashboard", "Server Overview"],
  logs: ["Containers / Event Logs", "Event Logs"],
  analytics: ["Tracking / Analytics", "Analytics"],
  settings: ["Account & Others / Settings", "Settings"]
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
    requestUrl: item.requestUrl || item.path || "",
    tracking: true,
    eventName: item.eventName || "Other",
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
      errors: Number(item.errors) || 0,
      lastSeen: item.lastSeen ? new Date(item.lastSeen) : null
    });
    return stats;
  }, new Map());
}

function reliableEventStats(data) {
  return todayEventStats(data) || eventStats(trackingEvents(data));
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
      const card = document.createElement("article");
      card.className = `health-card ${stat.count ? "healthy" : "warning"}`;
      card.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <strong>${stat.count.toLocaleString()}</strong>
        <small>${escapeHtml(relativeTime(stat.lastSeen))}</small>
      `;
      return card;
    })
  );

  const base = Math.max(1, stats.get("PageView")?.count || 0);
  els.funnelList.replaceChildren(
    ...required.map((name) => {
      const count = stats.get(name)?.count || 0;
      const percent = Math.min(100, Math.round((count / base) * 100));
      const row = document.createElement("article");
      row.className = "funnel-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span>${count.toLocaleString()} events</span>
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
  const alerts = [];

  if (!data.config?.usingDedicatedLogs) {
    alerts.push({
      label: "Shared Nginx log",
      value: "Use SGTM_ACCESS_LOG for cleaner data",
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
  if (stats.get("AddToCart")?.count && !stats.get("BeginCheckout")?.count) {
    alerts.push({
      label: "Checkout",
      value: "AddToCart seen, BeginCheckout missing",
      status: "warning"
    });
  }
  if (stats.get("BeginCheckout")?.count && !stats.get("Purchase")?.count) {
    alerts.push({
      label: "Purchase",
      value: "BeginCheckout seen, Purchase missing",
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

function renderDashboard(data) {
  const docker = data.docker;
  const totals = docker.totals || { total: 0, running: 0, stopped: 0, unhealthy: 0 };
  els.containerTotal.textContent = text(totals.total, "0");
  els.containerDetail.textContent = docker.available ? `${totals.running} running, ${totals.stopped} stopped` : docker.message;
  els.dockerHealth.textContent = docker.available ? (totals.unhealthy ? `${totals.unhealthy} issue` : "OK") : "Offline";
  els.dockerDetail.textContent = docker.available ? docker.message : text(docker.detail, docker.message);

  const requestCount = data.nginx.requestCountToday;
  els.requestCount.textContent = requestCount.available ? requestCount.count.toLocaleString() : "--";
  els.requestDetail.textContent = requestCount.available ? `Matched ${requestCount.token}` : text(requestCount.detail, requestCount.message);

  if (data.ssl.available) {
    els.sslDays.textContent = `${data.ssl.daysRemaining}d`;
    els.sslDetail.textContent = `Expires ${formatDate(data.ssl.expiresAt)}`;
  } else {
    els.sslDays.textContent = "--";
    els.sslDetail.textContent = text(data.ssl.detail, data.ssl.message);
  }

  const stats = reliableEventStats(data);
  const topEvents = [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      value: value.count.toLocaleString(),
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

function renderAnalytics(data) {
  const summary = data.nginx?.todayEvents;
  if (summary?.available) {
    const eventRows = (summary.events || [])
      .map((item) => ({
        label: canonicalEventName(item.name),
        value: Number(item.count) || 0,
        total: Number(item.count) || 0,
        errors: Number(item.errors) || 0,
        type: "Event"
      }))
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
    ["Event log limit", data.config?.eventLogLimit],
    ["Dedicated logs", data.config?.usingDedicatedLogs ? "Enabled" : "Not enabled"],
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

function renderLogs(data) {
  renderEventTable(data);
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
window.addEventListener("hashchange", () => setView(window.location.hash.replace("#", "") || "dashboard"));

setView(window.location.hash.replace("#", "") || "dashboard");
loadDashboard();
