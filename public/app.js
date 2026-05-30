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
  accessLog: document.querySelector("#accessLog"),
  errorLog: document.querySelector("#errorLog"),
  dockerLog: document.querySelector("#dockerLog"),
  dockerLogSource: document.querySelector("#dockerLogSource"),
  dockerLogHelp: document.querySelector("#dockerLogHelp"),
  settingsGrid: document.querySelector("#settingsGrid"),
  logSourceFilter: document.querySelector("#logSourceFilter"),
  logStatusFilter: document.querySelector("#logStatusFilter")
};

const viewTitles = {
  dashboard: ["Dashboard", "Server Overview"],
  logs: ["Containers / Event Logs", "Event Logs"],
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

function parseNginxAccess(line) {
  const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) (HTTP\/[^"]+)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/);
  if (!match) {
    return { source: "access", level: "info", primary: line, meta: "Unparsed access line", detail: "" };
  }

  const [, ip, time, method, path, protocol, status, bytes, referer, agent] = match;
  const code = Number(status);
  const level = code >= 500 ? "error" : code >= 400 ? "warn" : "info";
  return {
    source: "access",
    level,
    status,
    method,
    path,
    primary: `${method} ${path}`,
    meta: `${status} - ${ip} - ${time}`,
    detail: `${protocol} - ${bytes} bytes${referer !== "-" ? ` - from ${referer}` : ""}${agent !== "-" ? ` - ${agent}` : ""}`
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

function setLog(el, log, kind) {
  if (!log?.available) {
    el.innerHTML = `<div class="empty-log">${escapeHtml(`${log?.message || "Unavailable"} ${log?.detail || ""}`.trim())}</div>`;
    return;
  }

  const sourceFilter = els.logSourceFilter.value;
  const statusFilter = els.logStatusFilter.value;
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

  const accessItems = parseLogLines(data.nginx.accessLog, "access");
  const errors = accessItems.filter((item) => item.level === "error").length;
  const warnings = accessItems.filter((item) => item.level === "warn").length;
  const ok = accessItems.length - errors - warnings;
  renderSummaryList(els.trafficSummary, [
    { label: "Successful requests", value: String(ok), status: "healthy" },
    { label: "Client warnings", value: String(warnings), status: warnings ? "warning" : "healthy" },
    { label: "Server errors", value: String(errors), status: errors ? "error" : "healthy" }
  ]);

  renderSummaryList(els.runtimeChecks, [
    { label: "Docker collector", value: docker.available ? "Available" : "Unavailable", status: docker.available ? "healthy" : "error" },
    { label: "Nginx access log", value: data.nginx.accessLog.available ? "Readable" : "Blocked", status: data.nginx.accessLog.available ? "healthy" : "error" },
    { label: "Nginx error log", value: data.nginx.errorLog.available ? "Readable" : "Blocked", status: data.nginx.errorLog.available ? "healthy" : "error" },
    { label: "SSL check", value: data.ssl.available ? "Configured" : "Missing", status: data.ssl.available ? "healthy" : "warning" }
  ]);
}

function renderSettings(data) {
  const settings = [
    ["Host", data.config?.host],
    ["Port", data.config?.port],
    ["Nginx access log", data.config?.accessLog],
    ["Nginx error log", data.config?.errorLog],
    ["SSL source", data.ssl?.source || data.config?.sslDomain || "Not configured"],
    ["Log tail lines", data.config?.logTailLines]
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
  setLog(els.accessLog, data.nginx.accessLog, "access");
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
els.logSourceFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.logStatusFilter.addEventListener("change", () => latestData && renderLogs(latestData));
window.addEventListener("hashchange", () => setView(window.location.hash.replace("#", "") || "dashboard"));

setView(window.location.hash.replace("#", "") || "dashboard");
loadDashboard();
