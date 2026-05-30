import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "public");

await loadDotEnv(join(rootDir, ".env"));

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  accessLog: process.env.SGTM_ACCESS_LOG || process.env.NGINX_ACCESS_LOG || "/var/log/nginx/access.log",
  errorLog: process.env.SGTM_ERROR_LOG || process.env.NGINX_ERROR_LOG || "/var/log/nginx/error.log",
  usingDedicatedLogs: Boolean(process.env.SGTM_ACCESS_LOG || process.env.SGTM_ERROR_LOG),
  logTailLines: Number(process.env.LOG_TAIL_LINES || 80),
  eventLogLimit: Number(process.env.EVENT_LOG_LIMIT || 500),
  dataDir: process.env.DATA_DIR ? resolve(rootDir, normalize(process.env.DATA_DIR)) : join(rootDir, "data"),
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 90),
  provisionPortStart: Number(process.env.PROVISION_PORT_START || 8200),
  provisionPortEnd: Number(process.env.PROVISION_PORT_END || 8999),
  provisionDnsTarget: process.env.PROVISION_DNS_TARGET || "",
  trackingPaths: parseCsv(process.env.TRACKING_PATHS || "/g/collect,/collect,/mp/collect,/data"),
  trackingHosts: parseCsv(process.env.TRACKING_HOSTS || inferHostFromCertPath(process.env.SSL_CERT_PATH || "") || process.env.SSL_DOMAIN || ""),
  dockerLogExclude: parseCsv(process.env.DOCKER_LOG_EXCLUDE || "Sending aggregate usage beacon,googletagmanager.com/sgtm/a"),
  authEnabled: process.env.AUTH_ENABLED !== "false",
  authUsername: process.env.AUTH_USERNAME || "admin",
  authPassword: process.env.AUTH_PASSWORD || "",
  authSecret: process.env.AUTH_SECRET || "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
  alertMinIntervalMinutes: Number(process.env.ALERT_MIN_INTERVAL_MINUTES || 60),
  sslCertPath: process.env.SSL_CERT_PATH || "",
  sslDomain: process.env.SSL_DOMAIN || "",
  sslPort: Number(process.env.SSL_PORT || 443)
};

const authSecret = config.authSecret || config.authPassword || randomBytes(32).toString("hex");
const alertMemory = new Map();
const databasePath = join(config.dataDir, "history.json");

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferHostFromCertPath(pathname) {
  const match = String(pathname || "").match(/\/live\/([^/]+)\//);
  return match ? match[1] : "";
}

async function loadDotEnv(pathname) {
  try {
    const content = await readFile(pathname, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function htmlResponse(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, {
    location,
    "cache-control": "no-store"
  });
  res.end();
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function signSession(value) {
  return createHmac("sha256", authSecret).update(value).digest("hex");
}

function makeSessionCookie() {
  const issuedAt = String(Date.now());
  const payload = `${config.authUsername}:${issuedAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${signSession(payload)}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function isAuthenticated(req) {
  if (!config.authEnabled) return true;
  if (!config.authPassword) return false;
  const token = parseCookies(req.headers.cookie).sgtm_session;
  if (!token || !token.includes(".")) return false;

  const [encoded, signature] = token.split(".");
  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const [username, issuedAt] = payload.split(":");
  const age = Date.now() - Number(issuedAt);
  return (
    username === config.authUsername &&
    Number.isFinite(age) &&
    age >= 0 &&
    age < 1000 * 60 * 60 * 12 &&
    safeEqual(signature, signSession(payload))
  );
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Form body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(new URLSearchParams(body)));
    req.on("error", reject);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50000) {
        reject(new Error("JSON body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function loginPage(error = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Login - SGTM Panel</title>
    <link rel="stylesheet" href="/tokens.css" />
    <link rel="stylesheet" href="/login.css" />
  </head>
  <body>
    <main class="login-shell">
      <form class="login-card" method="post" action="/login">
        <span class="brand-mark">S</span>
        <h1>SGTM Panel</h1>
        <p>Sign in to view Docker, Nginx, and tracking diagnostics.</p>
        ${error ? `<div class="login-error">${error}</div>` : ""}
        <label>
          Username
          <input name="username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
}

function command(commandName, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      commandName,
      args,
      {
        timeout: options.timeout || 5000,
        maxBuffer: options.maxBuffer || 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            error: error.message
          });
          return;
        }

        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
      }
    );
  });
}

function runWithInput(commandName, args, input) {
  return new Promise((resolve) => {
    const child = spawn(commandName, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({ ok: false, stdout, stderr, error: "Command timed out" });
    }, 5000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        error: code === 0 ? "" : `${commandName} exited with code ${code}`
      });
    });

    child.stdin.end(input);
  });
}

function unavailable(message, detail = "") {
  return { available: false, message, detail };
}

function buildServerAlerts({ docker, requestCount, accessLog, errorLog, ssl }) {
  const alerts = [];
  if (!docker.available) {
    alerts.push({ key: "docker-unavailable", severity: "error", title: "Docker unavailable", message: docker.detail || docker.message });
  } else if (docker.totals.unhealthy) {
    alerts.push({ key: "docker-unhealthy", severity: "error", title: "Docker unhealthy", message: `${docker.totals.unhealthy} unhealthy container(s)` });
  }
  if (!accessLog.available) {
    alerts.push({ key: "access-log-unreadable", severity: "warning", title: "Access log unreadable", message: accessLog.detail || accessLog.message });
  }
  if (!errorLog.available) {
    alerts.push({ key: "error-log-unreadable", severity: "warning", title: "Error log unreadable", message: errorLog.detail || errorLog.message });
  }
  if (ssl.available && ssl.daysRemaining <= 14) {
    alerts.push({
      key: "ssl-expiring",
      severity: ssl.daysRemaining <= 7 ? "error" : "warning",
      title: "SSL expiring soon",
      message: `${ssl.daysRemaining} day(s) remaining`
    });
  }
  if (requestCount.available && requestCount.count === 0) {
    alerts.push({
      key: "no-tracking-requests",
      severity: "warning",
      title: "No tracking requests today",
      message: "No SGTM collection requests matched the configured tracking paths."
    });
  }
  return alerts;
}

async function sendAlertHooks(alerts) {
  if (!config.alertWebhookUrl || !alerts.length) return;
  const now = Date.now();
  const interval = config.alertMinIntervalMinutes * 60 * 1000;
  const due = alerts.filter((alert) => {
    const last = alertMemory.get(alert.key) || 0;
    if (now - last < interval) return false;
    alertMemory.set(alert.key, now);
    return true;
  });
  if (!due.length) return;

  try {
    await fetch(config.alertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "sgtm-control-panel",
        generatedAt: new Date().toISOString(),
        alerts: due
      })
    });
  } catch {
    // Alert hooks must never break dashboard loading.
  }
}

async function getDockerSummary() {
  const ps = await command("docker", [
    "ps",
    "-a",
    "--format",
    "{{json .}}"
  ]);

  if (!ps.ok) {
    return {
      available: false,
      message: "Docker is not available to this process.",
      detail: ps.stderr || ps.error,
      containers: [],
      totals: { running: 0, stopped: 0, unhealthy: 0, total: 0 }
    };
  }

  const containers = ps.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const item = JSON.parse(line);
        const status = item.Status || "";
        return {
          id: item.ID,
          name: item.Names,
          image: item.Image,
          status,
          state: item.State,
          ports: item.Ports || "",
          health: status.includes("(unhealthy)")
            ? "unhealthy"
            : status.includes("(healthy)")
              ? "healthy"
              : "unknown"
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const inspectedContainers = await addDockerInspectState(containers);

  return {
    available: true,
    message: "Docker container data loaded.",
    containers: inspectedContainers,
    totals: {
      running: inspectedContainers.filter((container) => container.state === "running").length,
      stopped: inspectedContainers.filter((container) => container.state !== "running").length,
      unhealthy: inspectedContainers.filter((container) => container.health === "unhealthy").length,
      total: inspectedContainers.length
    }
  };
}

async function addDockerInspectState(containers) {
  if (!containers.length) return containers;

  const inspect = await command("docker", [
    "inspect",
    "--format",
    "{{json .State}}",
    ...containers.map((container) => container.id)
  ]);

  if (!inspect.ok) return containers;

  const states = inspect.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    });

  return containers.map((container, index) => {
    const state = states[index];
    if (!state) return container;

    return {
      ...container,
      state: state.Status || container.state,
      health: state.Health?.Status || container.health,
      startedAt: state.StartedAt || "",
      finishedAt: state.FinishedAt || "",
      restartCount: state.RestartCount ?? null,
      exitCode: state.ExitCode ?? null
    };
  });
}

async function getDockerLogs(containers) {
  if (!containers.length) {
    return unavailable("No containers found for Docker log preview.");
  }

  const running = containers.find((container) => container.state === "running") || containers[0];
  const logs = await command("docker", [
    "logs",
    "--timestamps",
    "--tail",
    String(config.logTailLines),
    running.id
  ]);

  if (!logs.ok) {
    return unavailable("Docker logs are not available.", logs.stderr || logs.error);
  }

  return {
    available: true,
    container: running.name,
    containerId: running.id,
    lines: filterDockerLogLines(splitLines([logs.stdout, logs.stderr].filter(Boolean).join("\n")))
  };
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function filterDockerLogLines(lines) {
  return lines.filter((line) => {
    const lower = line.toLowerCase();
    return !config.dockerLogExclude.some((pattern) => lower.includes(pattern.toLowerCase()));
  });
}

function filterLogLinesForHosts(lines) {
  if (!config.trackingHosts.length) return lines;
  return lines.filter((line) => {
    const lower = line.toLowerCase();
    return config.trackingHosts.some((host) => lower.includes(host.toLowerCase()));
  });
}

async function tailFile(pathname, lineCount) {
  const result = await command("tail", ["-n", String(lineCount), pathname]);
  if (!result.ok) {
    return {
      available: false,
      path: pathname,
      message: "Log file could not be read.",
      detail: result.stderr || result.error,
      lines: []
    };
  }

  return {
    available: true,
    path: pathname,
    message: "Log file loaded.",
    lines: splitLines(result.stdout)
  };
}

function nginxDateToken(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTrackingLogLine(line) {
  const request = String(line || "").match(/"([A-Z]+)\s+([^"]+?)\s+HTTP\/[^"]+"/);
  if (!request) return false;
  const path = request[2].toLowerCase();
  return config.trackingPaths.some((prefix) => path.startsWith(prefix.toLowerCase()));
}

function normalizeEventName(value) {
  const compact = String(value || "")
    .trim()
    .replace(/[-_\s]+/g, "")
    .toLowerCase();
  const names = {
    pageview: "PageView",
    page_view: "PageView",
    viewcontent: "ViewItem",
    viewitem: "ViewItem",
    viewcart: "ViewCart",
    productview: "ViewItem",
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

function queryEventName(pathname) {
  try {
    const parsed = new URL(pathname, "https://sgtm.local");
    for (const key of ["event", "event_name", "en", "e", "action", "type", "name"]) {
      const eventName = normalizeEventName(parsed.searchParams.get(key));
      if (eventName) return eventName;
    }
  } catch {
    return "";
  }
  return "";
}

function inferEventName(pathname, method, status) {
  let raw = String(pathname || "").toLowerCase();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw URL when a bot or malformed client sends broken encoding.
  }
  const queryEvent = queryEventName(pathname);
  const blocked = Number(status) >= 400;

  if (queryEvent) return queryEvent;

  const checks = [
    ["Purchase", ["purchase", "order", "thank_you", "payment_success", "complete"]],
    ["BeginCheckout", ["checkout", "initiate_checkout", "begin_checkout"]],
    ["AddToCart", ["add_to_cart", "addtocart", "cart/add", "add-to-cart"]],
    ["ViewCart", ["view_cart", "viewcart", "cart"]],
    ["ViewItem", ["view_item", "viewitem", "product", "item"]],
    ["Lead", ["lead", "signup", "register", "subscribe"]],
    ["Search", ["search", "query="]],
    ["ScriptLoad", ["service_worker", "sw.js", "gtm.js", "loader", "script"]]
  ];

  for (const [name, needles] of checks) {
    if (needles.some((needle) => raw.includes(needle))) return name;
  }

  if (method === "GET" && !blocked) return "PageView";
  return blocked ? "Rejected Request" : "Other";
}

function inferClient(pathname, agent) {
  const lower = `${pathname || ""} ${agent || ""}`.toLowerCase();
  if (lower.includes("/g/collect") || lower.includes("tid=g-") || lower.includes("gtag")) return "GA4";
  if (lower.includes("/data") || lower.includes("data_client") || lower.includes("event=")) return "Data Client";
  if (lower.includes("meta") || lower.includes("fbp") || lower.includes("facebook")) return "Meta";
  if (lower.includes("tiktok") || lower.includes("ttclid")) return "TikTok";
  return "Other";
}

function queryValue(pathname, keys) {
  try {
    const parsed = new URL(pathname, "https://sgtm.local");
    for (const key of keys) {
      const value = parsed.searchParams.get(key);
      if (value !== null && value !== "") return value;
    }
  } catch {
    return "";
  }
  return "";
}

function inferHost(line, pathname) {
  try {
    const parsed = new URL(pathname);
    if (parsed.hostname) return parsed.hostname;
  } catch {
    // Relative SGTM paths are normal in Nginx logs.
  }

  const explicit = String(line || "").match(/\b(?:host|server_name)=["']?([^"'\s]+)|"host"\s*:\s*"([^"]+)"/i);
  if (explicit) return explicit[1] || explicit[2] || "";

  const lower = String(line || "").toLowerCase();
  const configured = config.trackingHosts.find((host) => lower.includes(host.toLowerCase()));
  return configured || "";
}

function parseNginxLogDate(value) {
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
  const date = new Date(`${year}-${months[month]}-${day}T${hour}:${minute}:${second}${zone.slice(0, 3)}:${zone.slice(3)}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTrackingAccessLine(line) {
  const match = String(line || "").match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) (HTTP\/[^"]+)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/);
  if (!match) return null;

  const [, ip, time, method, pathname, protocol, status, bytes, referer, agent] = match;
  if (!isTrackingLogLine(line)) return null;

  const date = parseNginxLogDate(time);
  const eventName = inferEventName(pathname, method, status);
  const client = inferClient(pathname, agent);
  const host = inferHost(line, pathname);
  return {
    eventName,
    client,
    host,
    status,
    date,
    method,
    path: pathname,
    protocol,
    bytes: bytes === "-" ? null : Number(bytes),
    referer: referer === "-" ? "" : referer,
    agent: agent === "-" ? "" : agent,
    ip,
    value: queryValue(pathname, ["value", "ep.value", "price", "revenue"]),
    currency: queryValue(pathname, ["currency", "ep.currency", "cu"]),
    eventId: queryValue(pathname, ["event_id", "eventId", "eid", "x-fb-event-id"]),
    transactionId: queryValue(pathname, ["transaction_id", "transactionId", "tid", "ep.transaction_id"])
  };
}

function parseAccessLine(line) {
  const match = String(line || "").match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) (HTTP\/[^"]+)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/);
  if (!match) return null;
  const [, ip, time, method, pathname, protocol, status, bytes, referer, agent] = match;
  return {
    ip,
    time,
    method,
    path: pathname,
    protocol,
    status,
    bytes,
    referer,
    agent,
    date: parseNginxLogDate(time)
  };
}

function classifyNoise(line, parsed) {
  const lower = `${parsed?.path || ""} ${parsed?.agent || ""} ${line || ""}`.toLowerCase();
  if (/\.(php|env|git|bak|sql|zip)(?:[?#\s]|$)/.test(lower)) return "Bot scan";
  if (lower.includes("wp-") || lower.includes("wordpress") || lower.includes("xmlrpc")) return "WordPress scan";
  if (lower.includes("service_worker") || lower.includes("sw.js") || lower.includes("gtm.js")) return "Loader/script";
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) return "Crawler";
  if (Number(parsed?.status) >= 400) return "Rejected non-tracking";
  return "Other non-tracking";
}

function serializeSummaryMap(map) {
  return [...map.entries()]
    .map(([name, value]) => ({ name, ...value, lastSeen: value.lastSeen ? value.lastSeen.toISOString() : null }))
    .sort((a, b) => b.count - a.count);
}

function serializeEventRow(item) {
  return {
    eventName: item.eventName,
    client: item.client,
    host: item.host,
    status: item.status,
    method: item.method,
    path: item.path,
    requestUrl: item.path,
    date: item.date ? item.date.toISOString() : null,
    protocol: item.protocol,
    bytes: item.bytes,
    referer: item.referer,
    agent: item.agent,
    ip: item.ip,
    value: item.value,
    currency: item.currency,
    eventId: item.eventId,
    transactionId: item.transactionId
  };
}

async function readDatabase() {
  try {
    const content = await readFile(databasePath, "utf8");
    const parsed = JSON.parse(content);
    return {
      available: true,
      path: databasePath,
      data: {
        version: 1,
        daily: {},
        provisioning: { requests: [] },
        ...parsed,
        daily: parsed.daily || {},
        provisioning: parsed.provisioning || { requests: [] }
      }
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { available: true, path: databasePath, data: { version: 1, daily: {}, provisioning: { requests: [] } } };
    }
    return {
      available: false,
      path: databasePath,
      message: "Summary database could not be read.",
      detail: error.message,
      data: { version: 1, daily: {}, provisioning: { requests: [] } }
    };
  }
}

async function writeDatabase(data) {
  await mkdir(config.dataDir, { recursive: true });
  const tempPath = `${databasePath}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, databasePath);
}

function pruneDailyHistory(daily) {
  const keys = Object.keys(daily).sort().reverse();
  const keep = new Set(keys.slice(0, config.historyRetentionDays));
  for (const key of keys) {
    if (!keep.has(key)) delete daily[key];
  }
}

function topRows(rows, limit = 12) {
  return (rows || []).slice(0, limit).map((item) => ({ ...item }));
}

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function validDomain(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(String(value || ""));
}

function validateProvisioningRequest(input) {
  const errors = [];
  const domain = String(input.domain || "").trim().toLowerCase();
  const instanceName = sanitizeId(input.instanceName || domain.split(".")[0] || "sgtm");
  const containerConfig = String(input.containerConfig || "").trim();
  const previewUrl = String(input.previewUrl || "").trim();
  const ownerEmail = String(input.ownerEmail || "").trim();

  if (!validDomain(domain)) errors.push("Enter a valid tracking subdomain.");
  if (!instanceName) errors.push("Enter an instance name.");
  if (!containerConfig) errors.push("Container config is required before launch.");
  if (previewUrl && !/^https?:\/\//i.test(previewUrl)) errors.push("Preview URL must start with http:// or https://.");
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) errors.push("Owner email is not valid.");

  return {
    errors,
    value: {
      instanceName,
      domain,
      containerName: sanitizeId(`sgtm-${instanceName}`),
      ownerEmail,
      previewUrl,
      containerConfig,
      notes: String(input.notes || "").trim().slice(0, 1000)
    }
  };
}

function allocateProvisionPort(requests) {
  const used = new Set(
    (requests || [])
      .map((request) => Number(request.port))
      .filter((port) => Number.isInteger(port))
  );
  for (let port = config.provisionPortStart; port <= config.provisionPortEnd; port += 1) {
    if (!used.has(port)) return port;
  }
  return null;
}

function provisioningPlan(request) {
  const safeEnvPath = `/var/www/sgtm-instances/${request.instanceName}/.env`;
  const accessLog = `/var/log/nginx/${request.instanceName}-sgtm-access.log`;
  const errorLog = `/var/log/nginx/${request.instanceName}-sgtm-error.log`;
  const previewLine = request.previewUrl ? `PREVIEW_SERVER_URL=${request.previewUrl}\n` : "";

  return {
    summary: [
      `Auto-assigned ${request.containerName} to 127.0.0.1:${request.port}`,
      `Proxy ${request.domain} to the container through Nginx`,
      `Issue SSL with certbot after DNS points to the VPS`,
      "Launch runner is not enabled yet, so this plan is queued for admin execution"
    ],
    envPath: safeEnvPath,
    env: `CONTAINER_CONFIG=${request.containerConfig}\n${previewLine}RUN_AS_PREVIEW_SERVER=false\nPORT=8080\n`,
    dockerCompose: `services:\n  ${request.containerName}:\n    image: gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable\n    container_name: ${request.containerName}\n    restart: unless-stopped\n    env_file:\n      - ${safeEnvPath}\n    ports:\n      - "127.0.0.1:${request.port}:8080"\n`,
    nginx: `server {\n    listen 80;\n    server_name ${request.domain};\n\n    access_log ${accessLog} sgtm_panel;\n    error_log ${errorLog} warn;\n\n    location / {\n        proxy_pass http://127.0.0.1:${request.port};\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}\n`,
    commands: [
      `sudo mkdir -p /var/www/sgtm-instances/${request.instanceName}`,
      `sudo nano ${safeEnvPath}`,
      `sudo nano /etc/nginx/sites-available/${request.domain}`,
      `sudo ln -s /etc/nginx/sites-available/${request.domain} /etc/nginx/sites-enabled/${request.domain}`,
      "sudo nginx -t",
      "sudo systemctl reload nginx",
      `sudo certbot --nginx -d ${request.domain}`,
      `docker compose -f /var/www/sgtm-instances/${request.instanceName}/docker-compose.yml up -d`,
      `curl -I https://${request.domain}/healthy`
    ],
    checks: [
      { label: "DNS", value: config.provisionDnsTarget ? `${request.domain} CNAME/A to ${config.provisionDnsTarget}` : `${request.domain} must point to the target VPS`, status: "pending" },
      { label: "Port", value: `Auto-assigned 127.0.0.1:${request.port}`, status: "pending" },
      { label: "SSL", value: `certbot --nginx -d ${request.domain}`, status: "pending" },
      { label: "Health", value: `https://${request.domain}/healthy`, status: "pending" }
    ]
  };
}

async function addProvisioningRequest(input) {
  const validated = validateProvisioningRequest(input);
  if (validated.errors.length) {
    return { ok: false, errors: validated.errors };
  }

  const loaded = await readDatabase();
  if (!loaded.available) {
    return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  }

  const data = loaded.data;
  data.provisioning ||= { requests: [] };
  const port = allocateProvisionPort(data.provisioning.requests);
  if (!port) {
    return { ok: false, errors: [`No available provisioning ports in ${config.provisionPortStart}-${config.provisionPortEnd}.`] };
  }
  const request = {
    id: `req_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    status: "pending_launch",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    port,
    autoAssignedPort: true,
    ...validated.value
  };
  request.plan = provisioningPlan(request);
  data.provisioning.requests.unshift(request);
  data.provisioning.requests = data.provisioning.requests.slice(0, 100);
  await writeDatabase(data);
  return { ok: true, request };
}

async function getProvisioningSummary() {
  const loaded = await readDatabase();
  const requests = loaded.data.provisioning?.requests || [];
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests
  };
}

async function persistDailySummary(summary) {
  const loaded = await readDatabase();
  if (!loaded.available || !summary.available) {
    return {
      available: loaded.available,
      path: databasePath,
      message: loaded.message || "Summary database is available.",
      detail: loaded.detail || "",
      daily: Object.values(loaded.data.daily || {}).sort((a, b) => b.date.localeCompare(a.date))
    };
  }

  const data = loaded.data;
  const today = localDateKey();
  const purchases = (summary.recentEvents || []).filter((item) => item.eventName === "Purchase").slice(0, 50);
  data.daily[today] = {
    date: today,
    token: summary.token,
    updatedAt: new Date().toISOString(),
    total: summary.count,
    errors: summary.errors,
    totalLines: summary.totalLines,
    noise: summary.noise,
    botNoise: summary.botNoise,
    events: topRows(summary.events),
    clients: topRows(summary.clients),
    hosts: topRows(summary.hosts),
    noiseReasons: topRows(summary.noiseReasons),
    hourly: summary.hourly || [],
    purchases
  };
  pruneDailyHistory(data.daily);

  try {
    await writeDatabase(data);
    return {
      available: true,
      path: databasePath,
      retentionDays: config.historyRetentionDays,
      daily: Object.values(data.daily).sort((a, b) => b.date.localeCompare(a.date))
    };
  } catch (error) {
    return {
      available: false,
      path: databasePath,
      message: "Summary database could not be written.",
      detail: error.message,
      daily: Object.values(data.daily).sort((a, b) => b.date.localeCompare(a.date))
    };
  }
}

async function summarizeRequestsToday(pathname) {
  const token = nginxDateToken();

  return new Promise((resolve) => {
    let count = 0;
    let errors = 0;
    let totalLines = 0;
    let noise = 0;
    let botNoise = 0;
    const events = new Map();
    const clients = new Map();
    const hosts = new Map();
    const noiseReasons = new Map();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, errors: 0, purchases: 0 }));
    const recentEvents = [];
    let settled = false;
    const stream = createReadStream(pathname, { encoding: "utf8" });
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    const resolveOnce = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    reader.on("line", (line) => {
      if (!line.includes(token)) return;
      totalLines += 1;
      const parsed = parseTrackingAccessLine(line);
      if (!parsed) {
        const generic = parseAccessLine(line);
        const reason = classifyNoise(line, generic);
        noise += 1;
        if (reason.includes("scan") || reason === "Crawler") botNoise += 1;
        const current = noiseReasons.get(reason) || { count: 0 };
        current.count += 1;
        noiseReasons.set(reason, current);
        return;
      }

      count += 1;
      if (Number(parsed.status) >= 400) errors += 1;
      if (parsed.date) {
        const bucket = hourly[parsed.date.getHours()];
        bucket.total += 1;
        if (Number(parsed.status) >= 400) bucket.errors += 1;
        if (parsed.eventName === "Purchase") bucket.purchases += 1;
      }

      const event = events.get(parsed.eventName) || { count: 0, errors: 0, lastSeen: null };
      event.count += 1;
      if (Number(parsed.status) >= 400) event.errors += 1;
      if (parsed.date && (!event.lastSeen || parsed.date > event.lastSeen)) event.lastSeen = parsed.date;
      events.set(parsed.eventName, event);

      const client = clients.get(parsed.client) || { count: 0, errors: 0, lastSeen: null };
      client.count += 1;
      if (Number(parsed.status) >= 400) client.errors += 1;
      if (parsed.date && (!client.lastSeen || parsed.date > client.lastSeen)) client.lastSeen = parsed.date;
      clients.set(parsed.client, client);

      const hostName = parsed.host || "Unknown host";
      const host = hosts.get(hostName) || { count: 0, errors: 0, lastSeen: null };
      host.count += 1;
      if (Number(parsed.status) >= 400) host.errors += 1;
      if (parsed.date && (!host.lastSeen || parsed.date > host.lastSeen)) host.lastSeen = parsed.date;
      hosts.set(hostName, host);

      recentEvents.push(serializeEventRow(parsed));
      if (recentEvents.length > config.eventLogLimit) recentEvents.shift();
    });
    reader.on("close", () => {
      resolveOnce({
        available: true,
        count,
        errors,
        totalLines,
        noise,
        botNoise,
        token,
        path: pathname,
        filter: "tracking-only",
        trackingPaths: config.trackingPaths,
        events: serializeSummaryMap(events),
        clients: serializeSummaryMap(clients),
        hosts: serializeSummaryMap(hosts),
        hourly,
        noiseReasons: serializeSummaryMap(noiseReasons),
        recentEvents: recentEvents.reverse(),
        eventLogLimit: config.eventLogLimit
      });
    });
    reader.on("error", (error) => {
      resolveOnce({
        available: false,
        count: 0,
        errors: 0,
        totalLines: 0,
        noise: 0,
        botNoise: 0,
        token,
        path: pathname,
        message: "Request count could not be calculated.",
        detail: error.message,
        events: [],
        clients: [],
        hosts: [],
        hourly: [],
        noiseReasons: [],
        recentEvents: [],
        eventLogLimit: config.eventLogLimit
      });
    });
    stream.on("error", (error) => {
      resolveOnce({
        available: false,
        count: 0,
        errors: 0,
        totalLines: 0,
        noise: 0,
        botNoise: 0,
        token,
        path: pathname,
        message: "Request count could not be calculated.",
        detail: error.message,
        events: [],
        clients: [],
        hosts: [],
        hourly: [],
        noiseReasons: [],
        recentEvents: [],
        eventLogLimit: config.eventLogLimit
      });
    });
  });
}

function parseOpenSslDate(value) {
  const raw = value.replace("notAfter=", "").trim();
  const expiresAt = new Date(raw);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const now = new Date();
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
  return {
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
    status: daysRemaining <= 7 ? "critical" : daysRemaining <= 30 ? "warning" : "healthy"
  };
}

async function getSslFromCertFile(pathname) {
  const result = await command("openssl", ["x509", "-enddate", "-noout", "-in", pathname]);
  if (!result.ok) {
    return unavailable("SSL certificate file could not be inspected.", result.stderr || result.error);
  }

  const parsed = parseOpenSslDate(result.stdout);
  return parsed
    ? { available: true, source: pathname, ...parsed }
    : unavailable("SSL expiry date could not be parsed.", result.stdout);
}

async function getSslFromDomain(domain, port) {
  const sClient = await command("openssl", [
    "s_client",
    "-servername",
    domain,
    "-connect",
    `${domain}:${port}`,
    "-showcerts"
  ]);

  if (!sClient.ok && !sClient.stdout) {
    return unavailable("SSL domain could not be reached.", sClient.stderr || sClient.error);
  }

  const x509 = await runWithInput("openssl", ["x509", "-enddate", "-noout"], sClient.stdout);
  if (!x509.ok) {
    return unavailable("SSL expiry date could not be inspected.", x509.stderr || x509.error);
  }

  const parsed = parseOpenSslDate(x509.stdout);
  return parsed
    ? { available: true, source: `${domain}:${port}`, ...parsed }
    : unavailable("SSL expiry date could not be parsed.", x509.stdout);
}

async function getSslSummary() {
  if (config.sslCertPath) return getSslFromCertFile(config.sslCertPath);
  if (config.sslDomain) return getSslFromDomain(config.sslDomain, config.sslPort);
  return unavailable("Set SSL_CERT_PATH or SSL_DOMAIN to enable SSL expiry checks.");
}

function buildDeploymentChecks({ docker, requestSummary, accessLog, errorLog, ssl, database }) {
  return [
    {
      label: "Panel bind",
      value: config.host === "127.0.0.1" ? `${config.host}:${config.port}` : `Public bind ${config.host}:${config.port}`,
      status: config.host === "127.0.0.1" ? "healthy" : "warning"
    },
    {
      label: "Authentication",
      value: config.authEnabled && config.authPassword ? "Enabled" : "Missing",
      status: config.authEnabled && config.authPassword ? "healthy" : "error"
    },
    {
      label: "Dedicated SGTM logs",
      value: config.usingDedicatedLogs ? "Enabled" : "Use SGTM_ACCESS_LOG",
      status: config.usingDedicatedLogs ? "healthy" : "warning"
    },
    {
      label: "Access log",
      value: accessLog.available ? "Readable" : "Unreadable",
      status: accessLog.available ? "healthy" : "error"
    },
    {
      label: "Error log",
      value: errorLog.available ? "Readable" : "Unreadable",
      status: errorLog.available ? "healthy" : "error"
    },
    {
      label: "Docker socket",
      value: docker.available ? "Available" : "Unavailable",
      status: docker.available ? "healthy" : "warning"
    },
    {
      label: "SSL",
      value: ssl.available ? `${ssl.daysRemaining} days remaining` : "Not configured",
      status: ssl.available ? ssl.status : "warning"
    },
    {
      label: "Tracking traffic",
      value: requestSummary.available ? `${requestSummary.count.toLocaleString()} requests today` : "Unavailable",
      status: requestSummary.available && requestSummary.count > 0 ? "healthy" : "warning"
    },
    {
      label: "Summary database",
      value: database.available ? "Persisting history" : "Write failed",
      status: database.available ? "healthy" : "error"
    },
    {
      label: "Host field",
      value: requestSummary.hosts?.some((host) => host.name !== "Unknown host") ? "Detected" : "Missing from logs",
      status: !requestSummary.count || requestSummary.hosts?.some((host) => host.name !== "Unknown host") ? "healthy" : "warning"
    }
  ];
}

async function getDashboardData() {
  const [docker, requestSummary, accessLog, errorLog, ssl] = await Promise.all([
    getDockerSummary(),
    summarizeRequestsToday(config.accessLog),
    tailFile(config.accessLog, config.logTailLines),
    tailFile(config.errorLog, config.logTailLines),
    getSslSummary()
  ]);

  const dockerLogs = docker.available
    ? await getDockerLogs(docker.containers)
    : unavailable("Docker logs are not available because Docker could not be queried.", docker.detail);

  if (errorLog.available) {
    errorLog.lines = filterLogLinesForHosts(errorLog.lines);
    errorLog.message = errorLog.lines.length
      ? errorLog.message
      : "No recent Nginx errors matched the configured tracking host filter.";
  }
  const history = await persistDailySummary(requestSummary);
  const provisioning = await getProvisioningSummary();
  const alerts = buildServerAlerts({ docker, requestCount: requestSummary, accessLog, errorLog, ssl });
  const deploymentChecks = buildDeploymentChecks({ docker, requestSummary, accessLog, errorLog, ssl, database: history });
  await sendAlertHooks(alerts);

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    docker,
    nginx: {
      requestCountToday: requestSummary,
      todayEvents: requestSummary,
      accessLog,
      errorLog
    },
    dockerLogs,
    alerts,
    deploymentChecks,
    history,
    provisioning,
    ssl,
    config: {
      host: config.host,
      port: config.port,
      accessLog: config.accessLog,
      errorLog: config.errorLog,
      usingDedicatedLogs: config.usingDedicatedLogs,
      logTailLines: config.logTailLines,
      eventLogLimit: config.eventLogLimit,
      dataDir: config.dataDir,
      historyRetentionDays: config.historyRetentionDays,
      provisionPortStart: config.provisionPortStart,
      provisionPortEnd: config.provisionPortEnd,
      provisionDnsTarget: config.provisionDnsTarget,
      trackingPaths: config.trackingPaths,
      trackingHosts: config.trackingHosts,
      alertWebhookEnabled: Boolean(config.alertWebhookUrl),
      sslDomain: config.sslDomain,
      sslPort: config.sslPort
    }
  };
}

async function serveStatic(req, res) {
  const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(publicDir, normalizedPath);

  if (!absolutePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(absolutePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(absolutePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", `http://${req.headers.host}`).pathname;

    if (pathname === "/login" && req.method === "GET") {
      if (isAuthenticated(req)) {
        redirect(res, "/");
        return;
      }
      htmlResponse(res, 200, loginPage(config.authPassword ? "" : "Set AUTH_PASSWORD in .env before using the panel."));
      return;
    }

    if (pathname === "/login" && req.method === "POST") {
      const form = await readForm(req);
      const username = form.get("username") || "";
      const password = form.get("password") || "";
      const ok =
        config.authPassword &&
        safeEqual(username, config.authUsername) &&
        safeEqual(password, config.authPassword);

      if (!ok) {
        htmlResponse(res, 401, loginPage("Invalid username or password."));
        return;
      }

      res.writeHead(302, {
        location: "/",
        "set-cookie": `sgtm_session=${makeSessionCookie()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    if (pathname === "/logout") {
      res.writeHead(302, {
        location: "/login",
        "set-cookie": "sgtm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    if (pathname !== "/login" && pathname !== "/tokens.css" && pathname !== "/login.css" && !isAuthenticated(req)) {
      if (pathname.startsWith("/api/")) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      redirect(res, "/login");
      return;
    }

    if (req.url?.startsWith("/api/dashboard")) {
      jsonResponse(res, 200, await getDashboardData());
      return;
    }

    if (pathname === "/api/provisioning/requests" && req.method === "POST") {
      const body = await readJson(req);
      const result = await addProvisioningRequest(body);
      jsonResponse(res, result.ok ? 201 : 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    jsonResponse(res, 500, {
      error: "Dashboard failed to load.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`SGTM control panel running at http://${config.host}:${config.port}`);
});
