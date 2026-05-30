import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
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
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function isTrackingLogLine(line) {
  const request = String(line || "").match(/"([A-Z]+)\s+([^"]+?)\s+HTTP\/[^"]+"/);
  if (!request) return false;
  const path = request[2].toLowerCase();
  return config.trackingPaths.some((prefix) => path.startsWith(prefix.toLowerCase()));
}

async function countRequestsToday(pathname) {
  const token = nginxDateToken();

  return new Promise((resolve) => {
    let count = 0;
    let settled = false;
    const stream = createReadStream(pathname, { encoding: "utf8" });
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    const resolveOnce = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    reader.on("line", (line) => {
      if (line.includes(token) && isTrackingLogLine(line)) count += 1;
    });
    reader.on("close", () => {
      resolveOnce({
        available: true,
        count,
        token,
        path: pathname,
        filter: "tracking-only",
        trackingPaths: config.trackingPaths
      });
    });
    reader.on("error", (error) => {
      resolveOnce({
        available: false,
        count: 0,
        token,
        path: pathname,
        message: "Request count could not be calculated.",
        detail: error.message
      });
    });
    stream.on("error", (error) => {
      resolveOnce({
        available: false,
        count: 0,
        token,
        path: pathname,
        message: "Request count could not be calculated.",
        detail: error.message
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

async function getDashboardData() {
  const [docker, requestCount, accessLog, errorLog, ssl] = await Promise.all([
    getDockerSummary(),
    countRequestsToday(config.accessLog),
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
  const alerts = buildServerAlerts({ docker, requestCount, accessLog, errorLog, ssl });
  await sendAlertHooks(alerts);

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    docker,
    nginx: {
      requestCountToday: requestCount,
      accessLog,
      errorLog
    },
    dockerLogs,
    alerts,
    ssl,
    config: {
      host: config.host,
      port: config.port,
      accessLog: config.accessLog,
      errorLog: config.errorLog,
      usingDedicatedLogs: config.usingDedicatedLogs,
      logTailLines: config.logTailLines,
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
