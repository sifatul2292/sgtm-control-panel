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

function setLog(el, log) {
  if (!log?.available) {
    el.textContent = `${log?.message || "Unavailable"}\n${log?.detail || ""}`.trim();
    return;
  }

  el.textContent = log.lines.length ? log.lines.join("\n") : "No recent log lines.";
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
    setLog(els.accessLog, data.nginx.accessLog);
    setLog(els.errorLog, data.nginx.errorLog);
    setLog(els.dockerLog, data.dockerLogs);
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
