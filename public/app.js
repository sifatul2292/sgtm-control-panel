const els = {
  generatedAt: document.querySelector("#generatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  containerTotal: document.querySelector("#containerTotal"),
  containerDetail: document.querySelector("#containerDetail"),
  dockerHealth: document.querySelector("#dockerHealth"),
  dockerDetail: document.querySelector("#dockerDetail"),
  requestCount: document.querySelector("#requestCount"),
  requestDetail: document.querySelector("#requestDetail"),
  sslDays: document.querySelector("#sslDays"),
  sslDetail: document.querySelector("#sslDetail"),
  dockerBadge: document.querySelector("#dockerBadge"),
  containerRows: document.querySelector("#containerRows"),
  accessLog: document.querySelector("#accessLog"),
  errorLog: document.querySelector("#errorLog"),
  dockerLog: document.querySelector("#dockerLog"),
  dockerLogSource: document.querySelector("#dockerLogSource")
};

function text(value, fallback = "--") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function setBadge(el, status, label) {
  el.className = "badge";
  if (status) el.classList.add(status);
  el.textContent = label;
}

function escapeHtml(value) {
  return text(value, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function levelFromMessage(message = "") {
  const lower = message.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("exception")) return "error";
  if (lower.includes("warn")) return "warn";
  if (lower.includes("debug")) return "debug";
  return "info";
}

function formatMaybeDate(value) {
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

function parseNginxAccess(line) {
  const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) (HTTP\/[^"]+)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/);
  if (!match) {
    return {
      level: "info",
      primary: line,
      meta: "Unparsed Nginx access line",
      detail: ""
    };
  }

  const [, ip, time, method, path, protocol, status, bytes, referer, agent] = match;
  const code = Number(status);
  const level = code >= 500 ? "error" : code >= 400 ? "warn" : "info";
  return {
    level,
    primary: `${method} ${path}`,
    meta: `${status} - ${ip} - ${time}`,
    detail: `${protocol} - ${bytes} bytes${referer !== "-" ? ` - from ${referer}` : ""}${agent !== "-" ? ` - ${agent}` : ""}`
  };
}

function parseNginxError(line) {
  const match = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] \d+#\d+: (.*)$/);
  if (!match) {
    return {
      level: levelFromMessage(line),
      primary: line,
      meta: "Nginx error log",
      detail: ""
    };
  }

  const [, time, level, message] = match;
  return {
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
    level: levelFromMessage(message),
    primary: message,
    meta: match ? formatMaybeDate(match[1]) : "Docker log",
    detail: ""
  };
}

function logParser(kind) {
  if (kind === "access") return parseNginxAccess;
  if (kind === "error") return parseNginxError;
  return parseDockerLog;
}

function setLog(el, log, kind) {
  if (!log?.available) {
    el.innerHTML = `<div class="empty-log">${escapeHtml(`${log?.message || "Unavailable"} ${log?.detail || ""}`.trim())}</div>`;
    return;
  }

  if (!log.lines.length) {
    el.innerHTML = '<div class="empty-log">No recent log lines.</div>';
    return;
  }

  const parse = logParser(kind);
  el.replaceChildren(
    ...log.lines.map((line) => {
      const item = parse(line);
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

function stateClass(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function renderContainers(docker) {
  if (!docker.available) {
    els.containerRows.innerHTML = `<tr><td colspan="5" class="muted-row">${docker.message}<br>${text(docker.detail, "")}</td></tr>`;
    setBadge(els.dockerBadge, "danger", "Unavailable");
    return;
  }

  setBadge(els.dockerBadge, docker.totals.unhealthy ? "danger" : "ok", "Read only");

  if (!docker.containers.length) {
    els.containerRows.innerHTML = '<tr><td colspan="5" class="muted-row">No Docker containers found.</td></tr>';
    return;
  }

  els.containerRows.replaceChildren(
    ...docker.containers.map((container) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${text(container.name)}</td>
        <td>${text(container.image)}</td>
        <td><span class="state ${stateClass(container.state)}">${text(container.state)}</span></td>
        <td><span class="state ${stateClass(container.health)}">${text(container.health)}</span></td>
        <td>${text(container.ports, "No exposed ports")}</td>
      `;
      return row;
    })
  );
}

function renderSummary(data) {
  const docker = data.docker;
  const totals = docker.totals || { total: 0, running: 0, unhealthy: 0 };
  els.containerTotal.textContent = text(totals.total, "0");
  els.containerDetail.textContent = docker.available
    ? `${totals.running} running, ${totals.stopped} stopped`
    : docker.message;

  els.dockerHealth.textContent = docker.available
    ? totals.unhealthy
      ? `${totals.unhealthy} unhealthy`
      : "OK"
    : "Offline";
  els.dockerDetail.textContent = docker.available ? docker.message : text(docker.detail, docker.message);

  const requestCount = data.nginx.requestCountToday;
  els.requestCount.textContent = requestCount.available ? requestCount.count.toLocaleString() : "--";
  els.requestDetail.textContent = requestCount.available
    ? `Matched ${requestCount.token}`
    : text(requestCount.detail, requestCount.message);

  if (data.ssl.available) {
    els.sslDays.textContent = `${data.ssl.daysRemaining}d`;
    els.sslDetail.textContent = `Expires ${formatDate(data.ssl.expiresAt)}`;
  } else {
    els.sslDays.textContent = "--";
    els.sslDetail.textContent = text(data.ssl.detail, data.ssl.message);
  }
}

async function loadDashboard() {
  els.refreshButton.disabled = true;
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Request failed");

    els.generatedAt.textContent = `Updated ${formatDate(data.generatedAt)}`;
    renderSummary(data);
    renderContainers(data.docker);
    setLog(els.accessLog, data.nginx.accessLog, "access");
    setLog(els.errorLog, data.nginx.errorLog, "error");
    setLog(els.dockerLog, data.dockerLogs, "docker");
    els.dockerLogSource.textContent = data.dockerLogs.container || "tail";
  } catch (error) {
    els.generatedAt.textContent = "Update failed";
    els.containerRows.innerHTML = `<tr><td colspan="5" class="muted-row">${error.message}</td></tr>`;
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
