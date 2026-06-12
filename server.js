import { createServer } from "node:http";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "public");

await loadDotEnv(join(rootDir, ".env"));

const configuredDataDir = process.env.DATA_DIR ? resolve(rootDir, normalize(process.env.DATA_DIR)) : join(rootDir, "data");

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  accessLog: process.env.SGTM_ACCESS_LOG || process.env.NGINX_ACCESS_LOG || "/var/log/nginx/access.log",
  errorLog: process.env.SGTM_ERROR_LOG || process.env.NGINX_ERROR_LOG || "/var/log/nginx/error.log",
  usingDedicatedLogs: Boolean(process.env.SGTM_ACCESS_LOG || process.env.SGTM_ERROR_LOG),
  logTailLines: Number(process.env.LOG_TAIL_LINES || 80),
  summaryTailLines: Number(process.env.SUMMARY_TAIL_LINES || 50000),
  customerSummaryTailLines: Number(process.env.CUSTOMER_SUMMARY_TAIL_LINES || Math.min(Number(process.env.SUMMARY_TAIL_LINES || 50000), 10000)),
  eventLogLimit: Number(process.env.EVENT_LOG_LIMIT || 500),
  dataDir: configuredDataDir,
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 90),
  // SQLite event store: raw event lines kept 35 days (30-day dashboard window + buffer)
  eventRetentionDays: Number(process.env.EVENT_RETENTION_DAYS || 35),
  ingestIntervalMs: Number(process.env.INGEST_INTERVAL_MS || 60000),
  ingestMaxBytesPerTick: Number(process.env.INGEST_MAX_BYTES_PER_TICK || 5 * 1024 * 1024),
  workerIngestSecret: process.env.WORKER_INGEST_SECRET || "",
  provisionPortStart: Number(process.env.PROVISION_PORT_START || 8200),
  provisionPortEnd: Number(process.env.PROVISION_PORT_END || 8999),
  provisionDnsTarget: process.env.PROVISION_DNS_TARGET || "",
  provisionOutputDir: process.env.PROVISION_OUTPUT_DIR ? resolve(rootDir, normalize(process.env.PROVISION_OUTPUT_DIR)) : join(configuredDataDir, "provisioning"),
  maxProvisioningRecords: Number(process.env.MAX_PROVISIONING_RECORDS || 2500),
  maxCustomerSetupRecords: Number(process.env.MAX_CUSTOMER_SETUP_RECORDS || 2500),
  localWorkerId: process.env.LOCAL_WORKER_ID || "local-bdix-1",
  localWorkerName: process.env.LOCAL_WORKER_NAME || "Local BDIX Worker",
  localWorkerRegion: process.env.LOCAL_WORKER_REGION || "Bangladesh BDIX",
  localWorkerPublicHost: process.env.LOCAL_WORKER_PUBLIC_HOST || process.env.PROVISION_DNS_TARGET || "",
  localWorkerIp: process.env.LOCAL_WORKER_IP || "",
  localWorkerCpuCores: Number(process.env.LOCAL_WORKER_CPU_CORES || 16),
  localWorkerMemoryGb: Number(process.env.LOCAL_WORKER_MEMORY_GB || 32),
  localWorkerDiskGb: Number(process.env.LOCAL_WORKER_DISK_GB || 400),
  localWorkerMaxContainers: Number(process.env.LOCAL_WORKER_MAX_CONTAINERS || 200),
  defaultContainerMemoryMb: Number(process.env.DEFAULT_CONTAINER_MEMORY_MB || 512),
  defaultContainerCpuLimit: process.env.DEFAULT_CONTAINER_CPU_LIMIT || "0.50",
  autoLaunchEnabled: process.env.AUTO_LAUNCH_ENABLED === "true",
  autoLaunchUseSudo: process.env.AUTO_LAUNCH_USE_SUDO === "true",
  autoLaunchRequireDns: process.env.AUTO_LAUNCH_REQUIRE_DNS !== "false",
  autoLaunchCertbot: process.env.AUTO_LAUNCH_CERTBOT === "true",
  autoLaunchCertbotEmail: process.env.AUTO_LAUNCH_CERTBOT_EMAIL || "",
  nginxSitesAvailableDir: process.env.NGINX_SITES_AVAILABLE_DIR || "/etc/nginx/sites-available",
  nginxSitesEnabledDir: process.env.NGINX_SITES_ENABLED_DIR || "/etc/nginx/sites-enabled",
  nginxLogFormat: process.env.NGINX_LOG_FORMAT || "",
  trackingPaths: parseCsv(process.env.TRACKING_PATHS || "/g/collect,/collect,/mp/collect,/data"),
  trackingHosts: parseCsv(process.env.TRACKING_HOSTS || inferHostFromCertPath(process.env.SSL_CERT_PATH || "") || process.env.SSL_DOMAIN || ""),
  dockerLogExclude: parseCsv(process.env.DOCKER_LOG_EXCLUDE || "Sending aggregate usage beacon,googletagmanager.com/sgtm/a"),
  authEnabled: process.env.AUTH_ENABLED !== "false",
  authUsername: process.env.AUTH_USERNAME || "admin",
  authPassword: process.env.AUTH_PASSWORD || "",
  authSecret: process.env.AUTH_SECRET || "",
  orderWebhookSecret: process.env.ORDER_WEBHOOK_SECRET || "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
  alertMinIntervalMinutes: Number(process.env.ALERT_MIN_INTERVAL_MINUTES || 60),
  serviceName: process.env.SERVICE_NAME || "SGTM Panel",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  tenantId: process.env.TENANT_ID || "default",
  tenantName: process.env.TENANT_NAME || "Default Customer",
  tenantDomain: process.env.TENANT_DOMAIN || "",
  billingPlan: process.env.BILLING_PLAN || "Starter",
  subscriptionStatus: process.env.SUBSCRIPTION_STATUS || "active",
  paymentStatus: process.env.PAYMENT_STATUS || "paid",
  renewalDate: process.env.RENEWAL_DATE || "",
  monthlyAmount: Number(process.env.MONTHLY_AMOUNT || 0),
  monthlyRequestLimit: Number(process.env.MONTHLY_REQUEST_LIMIT || 100000),
  monthlyContainerLimit: Number(process.env.MONTHLY_CONTAINER_LIMIT || 1),
  customerSupportEmail: process.env.CUSTOMER_SUPPORT_EMAIL || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3100}`,
  sslCertPath: process.env.SSL_CERT_PATH || "",
  sslDomain: process.env.SSL_DOMAIN || "",
  sslPort: Number(process.env.SSL_PORT || 443),
  nginxConfdDir: process.env.NGINX_CONF_D_DIR || "/etc/nginx/conf.d"
};

const authSecret = config.authSecret || config.authPassword || randomBytes(32).toString("hex");
const PURCHASE_ESTIMATE_WINDOW_MS = 5 * 60 * 1000;
const EVENT_ESTIMATE_WINDOW_MS = 10 * 1000;
const DASHBOARD_COMMAND_TIMEOUT_MS = 1000;
const DOCKER_INSPECT_TIMEOUT_MS = 700;
const DOCKER_LOG_TIMEOUT_MS = 600;
const SSL_NETWORK_TIMEOUT_MS = 1000;
const SUMMARY_CACHE_TTL_MS = Number(process.env.SUMMARY_CACHE_TTL_MS || 30000);
// Customer summaries are less time-sensitive than owner real-time view.
// Longer TTL means fewer cold-cache misses on customer dashboard reloads.
const CUSTOMER_SUMMARY_CACHE_TTL_MS = Number(process.env.CUSTOMER_SUMMARY_CACHE_TTL_MS || 120000);
const alertMemory = new Map();
const summaryCache = new Map();
const resetTokens = new Map();
const databasePath = join(config.dataDir, "history.json");

// SQLite event store (data/events.db). Optional: if the native module fails to load
// the panel keeps working on the log-tail + history.json path, so a bad build can
// never take the dashboard down.
let eventStore = null;
try {
  const { openEventStore } = await import("./db.js");
  eventStore = openEventStore(config.dataDir);
  console.log(`[events] SQLite event store ready: ${join(config.dataDir, "events.db")}`);
} catch (error) {
  console.error(`[events] SQLite event store unavailable (${error.message}); using log tail + history.json only`);
}
const powerUpMapsPath = join(config.nginxConfdDir, "tagioo-powerups-maps.conf");
let powerUpsActive = false;

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

async function jsonResponseGzip(req, res, status, body) {
  const json = Buffer.from(JSON.stringify(body), "utf8");
  const acceptsGzip = /gzip/.test(req.headers["accept-encoding"] || "");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };
  if (acceptsGzip && json.length > 2048) {
    try {
      const compressed = await gzipAsync(json);
      headers["content-encoding"] = "gzip";
      headers["vary"] = "Accept-Encoding";
      res.writeHead(status, headers);
      res.end(compressed);
      return;
    } catch {
      // Fall through to uncompressed
    }
  }
  res.writeHead(status, headers);
  res.end(json);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function encodeSessionPayload(account) {
  const issuedAt = String(Date.now());
  return JSON.stringify({
    username: account.username,
    role: account.role,
    tenantId: account.tenantId || config.tenantId,
    issuedAt
  });
}

function makeSessionCookie(account) {
  const payload = encodeSessionPayload(account);
  return `${Buffer.from(payload).toString("base64url")}.${signSession(payload)}`;
}

function parseSessionPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    return {
      username: String(parsed.username || ""),
      role: parsed.role === "customer" ? "customer" : "owner",
      tenantId: sanitizeId(parsed.tenantId || config.tenantId),
      issuedAt: parsed.issuedAt
    };
  } catch {
    const [username, issuedAt] = payload.split(":");
    return {
      username,
      role: "owner",
      tenantId: config.tenantId,
      issuedAt
    };
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, expected] = String(storedHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

async function findCustomerAccountByEmail(email) {
  const loaded = await readDatabase();
  const normalized = String(email || "").trim().toLowerCase();
  return (loaded.data.customerAccounts || []).find(
    (a) => String(a.email || a.username || "").toLowerCase() === normalized
  ) || null;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!config.resendApiKey) {
    console.error("[reset] RESEND_API_KEY not set — cannot send reset email");
    return { ok: false };
  }
  try {
    const fromAddr = config.customerSupportEmail || "noreply@tagioo.com";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Tagioo <${fromAddr}>`,
        to: [toEmail],
        subject: "Reset your Tagioo password",
        html: [
          `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px">`,
          `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Reset your password</p>`,
          `<p style="color:#5B6B8A;margin:0 0 28px;line-height:1.6">Click the button below to set a new password for your Tagioo account. This link expires in <strong>1 hour</strong>.</p>`,
          `<a href="${resetUrl}" style="display:inline-block;background:#5B21B6;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Reset password →</a>`,
          `<p style="color:#9BA8C0;font-size:13px;margin:32px 0 0">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>`,
          `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">`,
          `<p style="color:#C4CCDB;font-size:12px;margin:0">Tagioo · Server-side tracking for Bangladesh ecommerce</p>`,
          `</div>`
        ].join("")
      })
    });
    if (!r.ok) console.error("[reset] Resend API error:", r.status);
    return { ok: r.ok };
  } catch (e) {
    console.error("[reset] email send error:", e.message);
    return { ok: false };
  }
}

function getSession(req) {
  if (!config.authEnabled) {
    return {
      username: config.authUsername,
      role: "owner",
      tenantId: config.tenantId
    };
  }
  if (!config.authPassword && !config.customerPassword) return null;
  const token = parseCookies(req.headers.cookie).sgtm_session;
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const session = parseSessionPayload(payload);
  const age = Date.now() - Number(session.issuedAt);
  const knownUser =
    (session.role === "owner" && Boolean(config.authPassword) && session.username === config.authUsername) ||
    (session.role === "customer" && Boolean(session.username) && Boolean(session.tenantId));
  const valid =
    knownUser &&
    Number.isFinite(age) &&
    age >= 0 &&
    age < 1000 * 60 * 60 * 12 &&
    safeEqual(signature, signSession(payload));

  return valid ? session : null;
}

function isAuthenticated(req) {
  return Boolean(getSession(req));
}

function isOwner(req) {
  return getSession(req)?.role === "owner";
}

async function authenticateLogin(username, password) {
  if (config.authPassword && safeEqual(username, config.authUsername) && safeEqual(password, config.authPassword)) {
    return {
      username: config.authUsername,
      role: "owner",
      tenantId: config.tenantId
    };
  }

  const account = await findCustomerAccountByUsername(username);
  if (account && account.status === "active" && verifyPassword(password, account.passwordHash)) {
    void markCustomerAccountLogin(account.id);
    return {
      username: account.username,
      role: "customer",
      tenantId: account.tenantId,
      accountId: account.id
    };
  }
  return null;
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

function readRawBody(req, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
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

function cleanTemplateValue(value, fallback = "YOUR_VALUE_HERE") {
  const cleaned = String(value || "").trim();
  return cleaned || fallback;
}

function selectedDestinations(input) {
  const allowed = new Set(["ga4", "meta", "googleAds", "tiktok"]);
  const destinations = Array.isArray(input.destinations) ? input.destinations : String(input.destinations || "").split(",");
  const selected = destinations.map((item) => String(item).trim()).filter((item) => allowed.has(item));
  return selected.length ? selected : ["ga4", "meta", "googleAds", "tiktok"];
}

function gtmTemplateParam(key, value) {
  return { type: "TEMPLATE", key, value: String(value ?? "") };
}

function gtmBooleanParam(key, value) {
  return { type: "BOOLEAN", key, value: value ? "true" : "false" };
}

function gtmListParam(key, rows) {
  return {
    type: "LIST",
    key,
    list: rows.map((row) => ({
      type: "MAP",
      map: Object.entries(row).map(([parameter, parameterValue]) => gtmTemplateParam(parameter, parameterValue))
    }))
  };
}

function gtmConstVariable(id, name, value, folderId = "1") {
  return {
    accountId: "0",
    containerId: "0",
    variableId: String(id),
    name,
    type: "c",
    parameter: [gtmTemplateParam("value", value)],
    fingerprint: String(Date.now()),
    parentFolderId: folderId
  };
}

function gtmDataLayerVariable(id, name, path, folderId = "2") {
  return {
    accountId: "0",
    containerId: "0",
    variableId: String(id),
    name,
    type: "v",
    parameter: [
      { type: "INTEGER", key: "dataLayerVersion", value: "2" },
      gtmBooleanParam("setDefaultValue", false),
      gtmTemplateParam("name", path)
    ],
    fingerprint: String(Date.now()),
    parentFolderId: folderId
  };
}

function gtmEventDataVariable(id, name, key, folderId = "2") {
  return {
    accountId: "0",
    containerId: "0",
    variableId: String(id),
    name,
    type: "ed",
    parameter: [gtmTemplateParam("keyPath", key)],
    fingerprint: String(Date.now()),
    parentFolderId: folderId
  };
}

function gtmRequestHeaderVariable(id, name, headerName, folderId = "2") {
  return {
    accountId: "0",
    containerId: "0",
    variableId: String(id),
    name,
    type: "smhttp_request_header",
    parameter: [gtmTemplateParam("headerName", headerName)],
    fingerprint: String(Date.now()),
    parentFolderId: folderId
  };
}

function gtmTrigger(id, name, eventName, filterClient = "") {
  const trigger = {
    accountId: "0",
    containerId: "0",
    triggerId: String(id),
    name,
    type: "CUSTOM_EVENT",
    customEventFilter: [
      {
        type: "EQUALS",
        parameter: [gtmTemplateParam("arg0", "{{_event}}"), gtmTemplateParam("arg1", eventName)]
      }
    ],
    fingerprint: String(Date.now())
  };
  if (filterClient) {
    trigger.filter = [
      {
        type: "CONTAINS",
        parameter: [gtmTemplateParam("arg0", "{{Client Name}}"), gtmTemplateParam("arg1", filterClient)]
      }
    ];
  }
  return trigger;
}

function gtmTag(id, name, type, parameters, triggerIds, folderId = "1") {
  return {
    accountId: "0",
    containerId: "0",
    tagId: String(id),
    name,
    type,
    parameter: parameters,
    fingerprint: String(Date.now()),
    firingTriggerId: triggerIds.map(String),
    parentFolderId: folderId,
    tagFiringOption: "ONCE_PER_EVENT",
    monitoringMetadata: { type: "MAP" },
    consentSettings: { consentStatus: "NOT_SET" }
  };
}

function gtmFolder(id, name) {
  return {
    accountId: "0",
    containerId: "0",
    folderId: String(id),
    name,
    fingerprint: String(Date.now())
  };
}

function gtmExport(kind, name, payload, content) {
  const tagiooSetup = {
    generatedBy: "Tagioo Setup Assistant",
    businessType: payload.businessType,
    platform: payload.platform,
    destinations: payload.destinations,
    trackingDomain: payload.trackingDomain,
    note: "Import into Google Tag Manager, preview, then publish only after testing."
  };
  if (payload.galleryTemplates) {
    tagiooSetup.galleryTemplates = payload.galleryTemplates;
  }
  if (payload.fieldMappings) {
    tagiooSetup.fieldMappings = payload.fieldMappings;
  }
  if (Array.isArray(content.variable)) {
    // GTM import rejects constant variables whose value is empty.
    content.variable = content.variable.filter(
      (variable) => variable.type !== "c" || (variable.parameter?.[0]?.value || "") !== ""
    );
  }
  return {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      path: "accounts/0/containers/0/versions/0",
      accountId: "0",
      containerId: "0",
      containerVersionId: "0",
      container: {
        path: "accounts/0/containers/0",
        accountId: "0",
        containerId: "0",
        name,
        publicId: kind === "server" ? "GTM-SERVER-TAGIOO" : "GTM-WEB-TAGIOO",
        usageContext: [kind === "server" ? "SERVER" : "WEB"],
        fingerprint: String(Date.now())
      },
      ...content,
      fingerprint: String(Date.now()),
      tagManagerUrl: "https://tagmanager.google.com/"
    },
    tagiooSetup
  };
}

function tagiooGalleryTemplateGuide(destinations) {
  const guide = [];
  if (destinations.includes("meta")) {
    guide.push({
      destination: "Meta CAPI",
      container: "Server GTM",
      gallerySearch: "Facebook Conversion API",
      installBeforeImport: true,
      manualTagName: "Tagioo Meta CAPI - All Events",
      fieldMappings: [
        { field: "Pixel ID", value: "{{Tagioo - meta_pixel_id}}" },
        { field: "Access Token", value: "{{Tagioo - meta_capi_token}}" },
        { field: "Test Event Code", value: "{{Tagioo - meta_test_event_code}}" },
        { field: "Event Name", value: "{{Event Name}}" },
        { field: "Event ID", value: "{{ed - event_id}}" },
        { field: "Action Source", value: "website" },
        { field: "Value", value: "{{ed - value}}" },
        { field: "Currency", value: "{{ed - currency}}" },
        { field: "Transaction ID", value: "{{ed - transaction_id}}" },
        { field: "Email", value: "{{ed - email_address}}" },
        { field: "Phone", value: "{{ed - phone_number}}" },
        { field: "First Name", value: "{{ed - first_name}}" },
        { field: "Last Name", value: "{{ed - last_name}}" },
        { field: "External ID", value: "{{ed - external_id}}" },
        { field: "Country", value: "{{rh - country}}" },
        { field: "fbp (Browser ID)", value: "{{rh - fb_browser_id}}" },
        { field: "fbc (Click ID)", value: "{{rh - fb_click_cookie}}" },
        { field: "Client IP Address", value: "{{rh - fb_client_ipv6}}" }
      ]
    });
  }
  if (destinations.includes("tiktok")) {
    guide.push({
      destination: "TikTok Events API",
      container: "Server GTM",
      gallerySearch: "TikTok Events API",
      installBeforeImport: true,
      manualTagName: "Tagioo TikTok Events API - All Events",
      fieldMappings: [
        { field: "Pixel ID", value: "{{Tagioo - tiktok_pixel_id}}" },
        { field: "Access Token", value: "{{Tagioo - tiktok_access_token}}" },
        { field: "Event Name", value: "{{Event Name}}" },
        { field: "Event ID", value: "{{ed - event_id}}" },
        { field: "Value", value: "{{ed - value}}" },
        { field: "Currency", value: "{{ed - currency}}" },
        { field: "Content / Items", value: "{{ed - items}}" },
        { field: "Email", value: "{{ed - email_address}}" },
        { field: "Phone", value: "{{ed - phone_number}}" }
      ]
    });
  }
  return guide;
}

function buildWebGtmTemplate(input) {
  const destinations = selectedDestinations(input);
  const payload = {
    businessType: cleanTemplateValue(input.businessType, "ecommerce"),
    platform: cleanTemplateValue(input.platform, "custom"),
    destinations,
    trackingDomain: cleanTemplateValue(input.trackingDomain, "https://track.yourdomain.com"),
    currency: cleanTemplateValue(input.currency, "BDT")
  };
  const folders = [gtmFolder(1, "Tagioo - Config"), gtmFolder(2, "Tagioo - Data Layer"), gtmFolder(3, "Tagioo - GA4"), gtmFolder(4, "Tagioo - Meta"), gtmFolder(5, "Tagioo - Google Ads"), gtmFolder(6, "Tagioo - TikTok")];
  const variables = [
    gtmConstVariable(1, "Tagioo - server_container_url", payload.trackingDomain, "1"),
    gtmConstVariable(2, "Tagioo - ga4_measurement_id", cleanTemplateValue(input.ga4MeasurementId), "1"),
    gtmConstVariable(3, "Tagioo - meta_pixel_id", cleanTemplateValue(input.metaPixelId), "1"),
    gtmConstVariable(4, "Tagioo - google_ads_conversion_id", cleanTemplateValue(input.googleAdsConversionId), "1"),
    gtmConstVariable(5, "Tagioo - tiktok_pixel_id", cleanTemplateValue(input.tiktokPixelId), "1"),
    gtmConstVariable(6, "Tagioo - default_currency", payload.currency, "1"),
    gtmDataLayerVariable(9, "dlv - event_id", "event_id"),
    gtmDataLayerVariable(10, "dlv - ecommerce.value", "ecommerce.value"),
    gtmDataLayerVariable(11, "dlv - ecommerce.currency", "ecommerce.currency"),
    gtmDataLayerVariable(12, "dlv - ecommerce.transaction_id", "ecommerce.transaction_id"),
    gtmDataLayerVariable(13, "dlv - ecommerce.items", "ecommerce.items"),
    gtmDataLayerVariable(14, "dlv - user_data.email_address", "user_data.email_address"),
    gtmDataLayerVariable(15, "dlv - user_data.phone_number", "user_data.phone_number"),
    gtmDataLayerVariable(16, "dlv - user_data.first_name", "user_data.first_name"),
    gtmDataLayerVariable(17, "dlv - user_data.last_name", "user_data.last_name"),
    gtmDataLayerVariable(18, "dlv - user_data.external_id", "user_data.external_id")
  ];
  const triggers = [
    { accountId: "0", containerId: "0", triggerId: "1", name: "Tagioo - DOM Ready PageView", type: "DOM_READY", fingerprint: String(Date.now()) },
    gtmTrigger(2, "Tagioo - view_item", "view_item"),
    gtmTrigger(3, "Tagioo - add_to_cart", "add_to_cart"),
    gtmTrigger(4, "Tagioo - begin_checkout", "begin_checkout"),
    gtmTrigger(5, "Tagioo - purchase", "purchase")
  ];
  const tags = [];
  if (destinations.includes("ga4")) {
    tags.push(gtmTag(1, "Tagioo GA4 - Config", "googtag", [
      gtmTemplateParam("tagId", "{{Tagioo - ga4_measurement_id}}"),
      gtmListParam("configSettingsTable", [
        { parameter: "server_container_url", parameterValue: "{{Tagioo - server_container_url}}" },
        { parameter: "send_page_view", parameterValue: "false" }
      ])
    ], ["2147479573"], "3"));
    const eventMap = [["page_view", "1"], ["view_item", "2"], ["add_to_cart", "3"], ["begin_checkout", "4"], ["purchase", "5"]];
    for (const [eventName, triggerId] of eventMap) {
      const eventSettingsRows = [
        { parameter: "server_container_url", parameterValue: "{{Tagioo - server_container_url}}" },
        { parameter: "event_id", parameterValue: "{{dlv - event_id}}" },
        { parameter: "user_data.email_address", parameterValue: "{{dlv - user_data.email_address}}" },
        { parameter: "user_data.phone_number", parameterValue: "{{dlv - user_data.phone_number}}" },
        { parameter: "user_data.first_name", parameterValue: "{{dlv - user_data.first_name}}" },
        { parameter: "user_data.last_name", parameterValue: "{{dlv - user_data.last_name}}" },
        { parameter: "user_data.external_id", parameterValue: "{{dlv - user_data.external_id}}" }
      ];
      if (["view_item", "add_to_cart", "begin_checkout"].includes(eventName)) {
        eventSettingsRows.push(
          { parameter: "currency", parameterValue: "{{dlv - ecommerce.currency}}" },
          { parameter: "value", parameterValue: "{{dlv - ecommerce.value}}" },
          { parameter: "items", parameterValue: "{{dlv - ecommerce.items}}" }
        );
      }
      if (eventName === "purchase") {
        eventSettingsRows.push(
          { parameter: "currency", parameterValue: "{{dlv - ecommerce.currency}}" },
          { parameter: "value", parameterValue: "{{dlv - ecommerce.value}}" },
          { parameter: "transaction_id", parameterValue: "{{dlv - ecommerce.transaction_id}}" },
          { parameter: "items", parameterValue: "{{dlv - ecommerce.items}}" }
        );
      }
      tags.push(gtmTag(tags.length + 1, `Tagioo GA4 - ${eventName}`, "gaawe", [
        gtmBooleanParam("sendEcommerceData", false),
        gtmBooleanParam("enhancedUserId", false),
        gtmTemplateParam("eventName", eventName),
        gtmTemplateParam("measurementIdOverride", "{{Tagioo - ga4_measurement_id}}"),
        gtmListParam("eventSettingsTable", eventSettingsRows)
      ], [triggerId], "3"));
    }
  }
  if (destinations.includes("meta")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo Meta - Pixel Base", "html", [
      gtmTemplateParam("html", "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{{Tagioo - meta_pixel_id}}');fbq('track','PageView');</script>")
    ], ["2147479553"], "4"));
  }
  if (destinations.includes("tiktok")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo TikTok - Pixel Base", "html", [
      gtmTemplateParam("html", "<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];var n=d.createElement('script');n.type='text/javascript';n.async=!0;n.src=i;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(n,a)};ttq.load('{{Tagioo - tiktok_pixel_id}}');ttq.page();}(window,document,'ttq');</script>")
    ], ["2147479553"], "6"));
  }
  return gtmExport("web", "Tagioo Web GTM Template", payload, {
    tag: tags,
    trigger: triggers,
    variable: variables,
    folder: folders,
    builtInVariable: [{ accountId: "0", containerId: "0", type: "EVENT", name: "Event" }]
  });
}

function buildServerGtmTemplate(input) {
  const destinations = selectedDestinations(input);
  const payload = {
    businessType: cleanTemplateValue(input.businessType, "ecommerce"),
    platform: cleanTemplateValue(input.platform, "custom"),
    destinations,
    trackingDomain: cleanTemplateValue(input.trackingDomain, "https://track.yourdomain.com"),
    galleryTemplates: tagiooGalleryTemplateGuide(destinations),
    fieldMappings: {
      ga4: "Native server-side GA4 forwarding tag is included.",
      googleAds: "Native Google Ads Conversion Linker, Purchase, and Remarketing tags are included.",
      meta: destinations.includes("meta") ? "Install the Facebook Conversion API template from the Server GTM Community Template Gallery, then map the fields listed in tagiooSetup.galleryTemplates." : "Not selected.",
      tiktok: destinations.includes("tiktok") ? "Install the TikTok Events API template from the Server GTM Community Template Gallery, then map the fields listed in tagiooSetup.galleryTemplates." : "Not selected."
    }
  };
  const folders = [gtmFolder(1, "Tagioo - Config"), gtmFolder(2, "Tagioo - Event Data"), gtmFolder(3, "Tagioo - GA4"), gtmFolder(4, "Tagioo - Meta"), gtmFolder(5, "Tagioo - Google Ads"), gtmFolder(6, "Tagioo - TikTok")];
  const variables = [
    gtmConstVariable(1, "Tagioo - ga4_api_secret", cleanTemplateValue(input.ga4ApiSecret), "1"),
    gtmConstVariable(2, "Tagioo - meta_pixel_id", cleanTemplateValue(input.metaPixelId), "1"),
    gtmConstVariable(3, "Tagioo - meta_capi_token", cleanTemplateValue(input.metaAccessToken), "1"),
    gtmConstVariable(4, "Tagioo - meta_test_event_code", cleanTemplateValue(input.metaTestEventCode, ""), "1"),
    gtmConstVariable(5, "Tagioo - google_ads_conversion_id", cleanTemplateValue(input.googleAdsConversionId), "1"),
    gtmConstVariable(6, "Tagioo - google_ads_purchase_label", cleanTemplateValue(input.googleAdsPurchaseLabel), "1"),
    gtmConstVariable(7, "Tagioo - tiktok_pixel_id", cleanTemplateValue(input.tiktokPixelId), "1"),
    gtmConstVariable(8, "Tagioo - tiktok_access_token", cleanTemplateValue(input.tiktokAccessToken), "1"),
    gtmEventDataVariable(20, "ed - value", "value"),
    gtmEventDataVariable(21, "ed - currency", "currency"),
    gtmEventDataVariable(22, "ed - transaction_id", "transaction_id"),
    gtmEventDataVariable(23, "ed - event_id", "event_id"),
    gtmEventDataVariable(24, "ed - email_address", "user_data.email_address"),
    gtmEventDataVariable(25, "ed - phone_number", "user_data.phone_number"),
    gtmEventDataVariable(26, "ed - items", "items"),
    gtmEventDataVariable(27, "ed - client_id", "client_id"),
    gtmEventDataVariable(28, "ed - page_location", "page_location"),
    gtmEventDataVariable(29, "ed - user_agent", "user_agent"),
    gtmEventDataVariable(30, "ed - ip_override", "ip_override"),
    gtmRequestHeaderVariable(31, "rh - fb_browser_id", "X-FB-Browser-ID", "4"),
    gtmRequestHeaderVariable(32, "rh - fb_click_id", "X-FB-Click-ID", "4"),
    gtmEventDataVariable(33, "ed - first_name", "user_data.first_name"),
    gtmEventDataVariable(34, "ed - last_name", "user_data.last_name"),
    gtmEventDataVariable(35, "ed - external_id", "user_data.external_id"),
    gtmRequestHeaderVariable(36, "rh - fb_click_cookie", "X-FB-Click-Cookie", "4"),
    gtmRequestHeaderVariable(37, "rh - fb_client_ipv6", "X-FB-Client-IPv6", "4"),
    gtmRequestHeaderVariable(38, "rh - country", "X-Tagioo-Country", "4")
  ];
  const triggers = [
    { accountId: "0", containerId: "0", triggerId: "1", name: "Tagioo - GA4 Client", type: "ALWAYS", filter: [{ type: "CONTAINS", parameter: [gtmTemplateParam("arg0", "{{Client Name}}"), gtmTemplateParam("arg1", "GA4")] }], fingerprint: String(Date.now()) },
    gtmTrigger(2, "Tagioo - GA4 purchase", "purchase", "GA4"),
    gtmTrigger(3, "Tagioo - GA4 add_to_cart", "add_to_cart", "GA4"),
    gtmTrigger(4, "Tagioo - GA4 begin_checkout", "begin_checkout", "GA4")
  ];
  const tags = [];
  const clients = [];
  if (destinations.includes("ga4")) {
    clients.push({
      accountId: "0",
      containerId: "0",
      clientId: "1",
      name: "Tagioo - GA4 Client",
      type: "gaaw_client",
      parameter: [],
      fingerprint: String(Date.now())
    });
    tags.push(gtmTag(1, "Tagioo GA4 - Forward Events", "sgtmgaaw", [
      gtmBooleanParam("redactVisitorIp", false),
      gtmTemplateParam("epToIncludeDropdown", "all"),
      gtmTemplateParam("upToIncludeDropdown", "all")
    ], ["1"], "3"));
  }
  if (destinations.includes("googleAds")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo Google Ads - Conversion Linker", "sgtmadscl", [
      gtmBooleanParam("enableLinkerParams", false),
      gtmBooleanParam("enableCookieOverrides", false)
    ], ["1"], "5"));
    tags.push(gtmTag(tags.length + 1, "Tagioo Google Ads - Purchase", "sgtmadsct", [
      gtmTemplateParam("productReportingDataSource", "EVENT"),
      gtmBooleanParam("enableConversionLinker", true),
      gtmBooleanParam("enableProductReporting", true),
      gtmTemplateParam("conversionId", "{{Tagioo - google_ads_conversion_id}}"),
      gtmTemplateParam("conversionLabel", "{{Tagioo - google_ads_purchase_label}}"),
      gtmBooleanParam("rdp", false)
    ], ["2"], "5"));
    tags.push(gtmTag(tags.length + 1, "Tagioo Google Ads - Remarketing", "sgtmadsremarket", [
      gtmBooleanParam("enableConversionLinker", true),
      gtmBooleanParam("enableDynamicRemarketing", true),
      gtmTemplateParam("remarketingEventDataSource", "EVENT_DATA"),
      gtmTemplateParam("conversionId", "{{Tagioo - google_ads_conversion_id}}"),
      gtmBooleanParam("rdp", false)
    ], ["1"], "5"));
  }
  return gtmExport("server", "Tagioo Server GTM Template", payload, {
    tag: tags,
    trigger: triggers,
    variable: variables,
    folder: folders,
    builtInVariable: [
      { accountId: "0", containerId: "0", type: "EVENT_NAME", name: "Event Name" },
      { accountId: "0", containerId: "0", type: "CLIENT_NAME", name: "Client Name" }
    ],
    client: clients
  });
}

function buildSetupAssistantTemplates(input) {
  const destinations = selectedDestinations(input);
  const web = buildWebGtmTemplate({ ...input, destinations });
  const server = buildServerGtmTemplate({ ...input, destinations });
  const warnings = [];
  if (destinations.includes("meta") || destinations.includes("tiktok")) {
    warnings.push("Before importing server.json, add the selected Meta/TikTok templates from the Server GTM Community Template Gallery. The downloaded server.json includes Tagioo variables and field mappings for those templates.");
  }
  return {
    fileNames: {
      web: "tagioo-web-template.json",
      server: "tagioo-server-template.json"
    },
    web,
    server,
    warnings
  };
}

function loginPage(error = "", opts = {}) {
  const { resetSent = false, resetDone = false } = opts;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
  </head>
  <body class="login-body">
    <div class="login-layout">

      <!-- ── Brand panel ── -->
      <aside class="login-brand">
        <a class="lb-logo" href="/">
          <span class="lb-mark">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" fill="white"/>
              <path d="M9 5L13 7.5V12.5L9 15L5 12.5V7.5L9 5Z" fill="#3B0764" opacity="0.8"/>
            </svg>
          </span>
          <span>Tagioo</span>
        </a>
        <div class="lb-hero">
          <h2>Track every purchase.<br>Boost every campaign.</h2>
          <p>Server-side GTM built for Bangladesh ecommerce. Recover lost conversions and feed Meta &amp; Google clean data.</p>
        </div>
        <div class="lb-stats">
          <div class="lb-stat">
            <span class="lb-stat-num">+31%</span>
            <small>avg ROAS lift</small>
          </div>
          <div class="lb-stat">
            <span class="lb-stat-num">+58%</span>
            <small>more purchases seen</small>
          </div>
          <div class="lb-stat">
            <span class="lb-stat-num">15ms</span>
            <small>BDIX response</small>
          </div>
        </div>
        <div class="lb-trust">
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            SSL Secured
          </span>
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            BDIX Hosted
          </span>
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            99.9% Uptime
          </span>
        </div>
        <p class="lb-footer">© 2025 Tagioo · Made in Bangladesh 🇧🇩</p>
      </aside>

      <!-- ── Form panel ── -->
      <main class="login-form-panel">
        <div class="login-form-wrap">

          <!-- Sign in view -->
          <div id="loginView">
            <div class="lf-header">
              <h1>Welcome back</h1>
              <p class="lf-subtitle">Sign in to view your tracking dashboard.</p>
            </div>
            ${resetDone ? `<div class="lf-success">Password updated. Sign in with your new password.</div>` : ""}
            ${error ? `<div class="lf-error">${error}</div>` : ""}
            <form method="post" action="/login" class="lf-form">
              <div class="lf-field">
                <label for="username">Username</label>
                <input id="username" name="username" type="text" autocomplete="username" placeholder="your-username" required />
              </div>
              <div class="lf-field">
                <div class="lf-label-row">
                  <label for="password">Password</label>
                  <button type="button" id="forgotBtn" class="lf-forgot-link">Forgot password?</button>
                </div>
                <div class="lf-pw-wrap">
                  <input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
                  <button type="button" class="lf-pw-toggle" id="pwToggle" aria-label="Show password">
                    <svg id="eyeShow" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
                    <svg id="eyeHide" width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:none"><path d="M1 1L17 17M7.5 4.2C8 4.07 8.5 4 9 4C14 4 17 9 17 9C16.4 10.1 15.5 11.3 14.4 12.3M10.6 13.8C10.1 13.93 9.6 14 9 14C4 14 1 9 1 9C1.6 7.9 2.5 6.7 3.6 5.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
              <button type="submit" class="lf-btn-primary">Sign in →</button>
            </form>
            <p class="lf-signup-prompt">New customer? <a href="/signup">Create an account</a></p>
          </div>

          <!-- Forgot password view -->
          <div id="forgotView" class="lf-forgot-panel" ${resetSent ? "" : "hidden"}>
            <button type="button" id="backBtn" class="lf-back-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Back to sign in
            </button>
            ${resetSent ? `
            <div class="lf-header" style="margin-top:8px">
              <h1>Check your inbox</h1>
              <p class="lf-subtitle">If that email is registered, you'll receive a reset link shortly. Check your spam folder too.</p>
            </div>
            <div class="lf-reset-sent-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" stroke="#5B21B6" stroke-width="2" stroke-opacity="0.15"/><path d="M8 18L24 28L40 18" stroke="#5B21B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.4"/><rect x="8" y="14" width="32" height="22" rx="4" stroke="#5B21B6" stroke-width="2"/><path d="M17 32L21 28M31 32L27 28" stroke="#5B21B6" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.35"/></svg>
            </div>
            ` : `
            <div class="lf-header" style="margin-top:8px">
              <h1>Forgot password?</h1>
              <p class="lf-subtitle">Enter your account email and we'll send you a reset link.</p>
            </div>
            <form method="post" action="/forgot-password" class="lf-form">
              <div class="lf-field">
                <label for="resetEmail">Email address</label>
                <input id="resetEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
              </div>
              <button type="submit" class="lf-btn-primary">Send reset link →</button>
            </form>
            `}
          </div>

        </div>
      </main>
    </div>

    <script>
      // Toggle password visibility
      const pwInput = document.getElementById("password");
      const pwToggle = document.getElementById("pwToggle");
      const eyeShow = document.getElementById("eyeShow");
      const eyeHide = document.getElementById("eyeHide");
      pwToggle.addEventListener("click", () => {
        const isText = pwInput.type === "text";
        pwInput.type = isText ? "password" : "text";
        eyeShow.style.display = isText ? "" : "none";
        eyeHide.style.display = isText ? "none" : "";
      });

      // Forgot password toggle
      const loginView = document.getElementById("loginView");
      const forgotView = document.getElementById("forgotView");
      ${resetSent ? "loginView.hidden = true;" : ""}
      document.getElementById("forgotBtn").addEventListener("click", () => {
        loginView.hidden = true;
        forgotView.hidden = false;
      });
      document.getElementById("backBtn").addEventListener("click", () => {
        forgotView.hidden = true;
        loginView.hidden = false;
      });
    </script>
  </body>
</html>`;
}

function resetPasswordPage(token = "", error = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset password — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
  </head>
  <body class="login-body">
    <div class="login-layout">
      <aside class="login-brand">
        <a class="lb-logo" href="/">
          <span class="lb-mark">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" fill="white"/>
              <path d="M9 5L13 7.5V12.5L9 15L5 12.5V7.5L9 5Z" fill="#3B0764" opacity="0.8"/>
            </svg>
          </span>
          <span>Tagioo</span>
        </a>
        <div class="lb-hero">
          <h2>Track every purchase.<br>Boost every campaign.</h2>
          <p>Server-side GTM built for Bangladesh ecommerce. Recover lost conversions and feed Meta &amp; Google clean data.</p>
        </div>
        <div class="lb-stats">
          <div class="lb-stat"><span class="lb-stat-num">+31%</span><small>avg ROAS lift</small></div>
          <div class="lb-stat"><span class="lb-stat-num">+58%</span><small>more purchases seen</small></div>
          <div class="lb-stat"><span class="lb-stat-num">15ms</span><small>BDIX response</small></div>
        </div>
        <p class="lb-footer">© 2025 Tagioo · Made in Bangladesh 🇧🇩</p>
      </aside>
      <main class="login-form-panel">
        <div class="login-form-wrap">
          <div class="lf-header">
            <h1>${token ? "Set new password" : "Link expired"}</h1>
            <p class="lf-subtitle">${token ? "Choose a strong password for your Tagioo account." : "This reset link has expired or already been used."}</p>
          </div>
          ${error ? `<div class="lf-error">${error}</div>` : ""}
          ${token ? `
          <form method="post" action="/reset-password" class="lf-form">
            <input type="hidden" name="token" value="${token}" />
            <div class="lf-field">
              <label for="password">New password</label>
              <div class="lf-pw-wrap">
                <input id="password" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8" />
                <button type="button" class="lf-pw-toggle" id="pwToggle" aria-label="Show password">
                  <svg id="eyeShow" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
                  <svg id="eyeHide" width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:none"><path d="M1 1L17 17M7.5 4.2C8 4.07 8.5 4 9 4C14 4 17 9 17 9C16.4 10.1 15.5 11.3 14.4 12.3M10.6 13.8C10.1 13.93 9.6 14 9 14C4 14 1 9 1 9C1.6 7.9 2.5 6.7 3.6 5.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
            <div class="lf-field">
              <label for="confirm">Confirm new password</label>
              <input id="confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat password" required minlength="8" />
            </div>
            <button type="submit" class="lf-btn-primary">Update password →</button>
          </form>
          <script>
            const pwInput = document.getElementById("password");
            const pwToggle = document.getElementById("pwToggle");
            const eyeShow = document.getElementById("eyeShow");
            const eyeHide = document.getElementById("eyeHide");
            pwToggle.addEventListener("click", () => {
              const isText = pwInput.type === "text";
              pwInput.type = isText ? "password" : "text";
              eyeShow.style.display = isText ? "" : "none";
              eyeHide.style.display = isText ? "none" : "";
            });
          </script>
          ` : `
          <a href="/login" class="lf-btn-primary" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Request a new link →</a>
          `}
        </div>
      </main>
    </div>
  </body>
</html>`;
}

function signupPage(error = "", values = {}) {
  const selectedCountry = values.country || "BD";
  const countryOptions = [
    ["BD", "Bangladesh (+880)"],
    ["IN", "India (+91)"],
    ["PK", "Pakistan (+92)"],
    ["SG", "Singapore (+65)"],
    ["US", "United States (+1)"],
    ["GB", "United Kingdom (+44)"],
    ["OTHER", "Other"]
  ].map(([value, label]) => `<option value="${value}"${selectedCountry === value ? " selected" : ""}>${label}</option>`)
    .join("");
  const referralOptions = ["", "Google Search", "Facebook", "YouTube", "Friend or colleague", "Agency", "Other"]
    .map((item) => `<option value="${escapeHtml(item)}"${values.referral === item ? " selected" : ""}>${item || "Select an option (optional)"}</option>`)
    .join("");
  const eyeSvg = (id) => `
    <svg id="${id}Show" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg>
    <svg id="${id}Hide" width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:none"><path d="M1 1L17 17M7.5 4.2C8 4.07 8.5 4 9 4C14 4 17 9 17 9C16.4 10.1 15.5 11.3 14.4 12.3M10.6 13.8C10.1 13.93 9.6 14 9 14C4 14 1 9 1 9C1.6 7.9 2.5 6.7 3.6 5.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Create account — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
  </head>
  <body class="login-body">
    <div class="login-layout">

      <!-- ── Brand panel ── -->
      <aside class="login-brand">
        <a class="lb-logo" href="/">
          <span class="lb-mark">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" fill="white"/>
              <path d="M9 5L13 7.5V12.5L9 15L5 12.5V7.5L9 5Z" fill="#3B0764" opacity="0.8"/>
            </svg>
          </span>
          <span>Tagioo</span>
        </a>
        <div class="lb-hero">
          <h2>Start tracking smarter.<br>Launch in minutes.</h2>
          <p>Server-side GTM built for Bangladesh ecommerce. Recover lost conversions and feed Meta &amp; Google clean, accurate data.</p>
        </div>
        <div class="su-steps">
          <div class="su-step su-step--active">
            <span class="su-step-num">1</span>
            Create your account
          </div>
          <div class="su-step">
            <span class="su-step-num">2</span>
            Connect your domain
          </div>
          <div class="su-step">
            <span class="su-step-num">3</span>
            Go live &amp; track
          </div>
        </div>
        <div class="lb-trust" style="margin-top:28px">
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            No credit card required
          </span>
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Setup in under 10 minutes
          </span>
          <span class="lb-trust-item">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            BDIX Hosted · 99.9% Uptime
          </span>
        </div>
        <p class="lb-footer">© 2025 Tagioo · Made in Bangladesh 🇧🇩</p>
      </aside>

      <!-- ── Form panel ── -->
      <main class="login-form-panel su-form-panel">
        <div class="login-form-wrap su-form-wrap">

          <div class="lf-header su-anim" style="--d:0ms">
            <h1>Create your account</h1>
            <p class="lf-subtitle">Already have one? <a href="/login" class="su-signin-link">Sign in →</a></p>
          </div>

          ${error ? `<div class="lf-error su-anim" style="--d:40ms">${escapeHtml(error)}</div>` : ""}

          <form method="post" action="/signup" class="lf-form" id="signupForm">

            <div class="lf-field su-anim" style="--d:80ms">
              <label for="suFullName">Full name</label>
              <input id="suFullName" name="fullName" type="text" autocomplete="name" placeholder="e.g. Rahim Hossain" value="${escapeHtml(values.fullName || "")}" required />
            </div>

            <div class="lf-field su-anim" style="--d:130ms">
              <label for="suEmail">Email address</label>
              <input id="suEmail" name="email" type="email" autocomplete="email" placeholder="you@company.com" value="${escapeHtml(values.email || values.username || "")}" required />
            </div>

            <div class="su-row su-anim" style="--d:180ms">
              <div class="lf-field">
                <label for="suCountry">Country</label>
                <select id="suCountry" name="country" class="su-select">${countryOptions}</select>
              </div>
              <div class="lf-field">
                <label for="suPhone">Phone</label>
                <input id="suPhone" name="phone" type="tel" autocomplete="tel" placeholder="1712345678" value="${escapeHtml(values.phone || "")}" required />
              </div>
            </div>

            <div class="lf-field su-anim" style="--d:230ms">
              <label for="suPw">Password</label>
              <div class="lf-pw-wrap">
                <input id="suPw" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8" />
                <button type="button" class="lf-pw-toggle" id="pw1Toggle" aria-label="Show password">${eyeSvg("eye1")}</button>
              </div>
            </div>

            <div class="lf-field su-anim" style="--d:280ms">
              <label for="suPwConfirm">Confirm password</label>
              <div class="lf-pw-wrap">
                <input id="suPwConfirm" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password" required minlength="8" />
                <button type="button" class="lf-pw-toggle" id="pw2Toggle" aria-label="Show password">${eyeSvg("eye2")}</button>
              </div>
            </div>

            <div class="lf-field su-anim" style="--d:330ms">
              <label for="suReferral">How did you find us? <span class="su-optional">(optional)</span></label>
              <select id="suReferral" name="referral" class="su-select">${referralOptions}</select>
            </div>

            <button type="submit" class="lf-btn-primary su-anim" style="--d:380ms" id="suSubmit">
              Create account →
            </button>
          </form>

          <p class="su-back-row su-anim" style="--d:420ms">
            <a href="/" class="su-back-link">← Back to homepage</a>
          </p>
        </div>
      </main>
    </div>

    <script>
      function setupPwToggle(inputId, toggleId, showId, hideId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(toggleId);
        const show = document.getElementById(showId);
        const hide = document.getElementById(hideId);
        btn.addEventListener("click", () => {
          const isText = input.type === "text";
          input.type = isText ? "password" : "text";
          show.style.display = isText ? "" : "none";
          hide.style.display = isText ? "none" : "";
        });
      }
      setupPwToggle("suPw", "pw1Toggle", "eye1Show", "eye1Hide");
      setupPwToggle("suPwConfirm", "pw2Toggle", "eye2Show", "eye2Hide");

      document.getElementById("signupForm").addEventListener("submit", () => {
        const btn = document.getElementById("suSubmit");
        btn.textContent = "Creating account…";
        btn.disabled = true;
      });
    </script>
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

function runWithInput(commandName, args, input, timeout = 5000) {
  return new Promise((resolve) => {
    const child = spawn(commandName, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({ ok: false, stdout, stderr, error: "Command timed out" });
    }, timeout);

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

function systemCommand(commandName, args, options = {}) {
  return config.autoLaunchUseSudo
    ? command("sudo", [commandName, ...args], options)
    : command(commandName, args, options);
}

async function dockerComposeCommand(args, options = {}) {
  const pluginCheck = await systemCommand("docker", ["compose", "version"], { timeout: 3000, maxBuffer: 20000 });
  if (pluginCheck.ok) {
    return systemCommand("docker", ["compose", ...args], options);
  }

  const classicCheck = await systemCommand("docker-compose", ["version"], { timeout: 3000, maxBuffer: 20000 });
  if (classicCheck.ok) {
    return systemCommand("docker-compose", args, options);
  }

  return {
    ok: false,
    stdout: "",
    stderr: [pluginCheck.stderr, classicCheck.stderr].filter(Boolean).join("\n"),
    error: "Neither `docker compose` nor `docker-compose` is available to the app user."
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Power-Ups: Cookie Keeper, Click ID Restorer, Custom Loader
// ─────────────────────────────────────────────────────────────────────────────

function generatePowerUpMapsContent() {
  return [
    "# Tagioo Power-Ups — nginx map variables",
    "# Auto-generated by Tagioo. Do not edit manually.",
    "# Required by: Cookie Keeper, Click ID Restorer, Bot Detection, User Agent Info",
    "",
    "# Cookie Keeper: renew analytics cookies via first-party tracking domain",
    "# nginx skips Set-Cookie when map value is empty string, so missing cookies are safe.",
    `map $cookie__ga $tagioo_ck_ga { default "_ga=$cookie__ga; Max-Age=34560000; SameSite=Lax; Path=/"; "" ""; }`,
    `map $cookie__fbp $tagioo_ck_fbp { default "_fbp=$cookie__fbp; Max-Age=34560000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $cookie__gcl_aw $tagioo_ck_gcl_aw { default "_gcl_aw=$cookie__gcl_aw; Max-Age=34560000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $cookie__ttp $tagioo_ck_ttp { default "_ttp=$cookie__ttp; Max-Age=34560000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $cookie__gcl_gb $tagioo_ck_gcl_gb { default "_gcl_gb=$cookie__gcl_gb; Max-Age=34560000; SameSite=None; Secure; Path=/"; "" ""; }`,
    "",
    "# Click ID Restorer: capture fbclid/gclid/ttclid/msclkid from URL params into cookies",
    `map $arg_fbclid $tagioo_cid_fbclid { default "tagioo_fbclid=$arg_fbclid; Max-Age=7776000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $arg_gclid $tagioo_cid_gclid { default "tagioo_gclid=$arg_gclid; Max-Age=7776000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $arg_ttclid $tagioo_cid_ttclid { default "tagioo_ttclid=$arg_ttclid; Max-Age=7776000; SameSite=None; Secure; Path=/"; "" ""; }`,
    `map $arg_msclkid $tagioo_cid_msclkid { default "tagioo_msclkid=$arg_msclkid; Max-Age=7776000; SameSite=None; Secure; Path=/"; "" ""; }`,
    "",
    "# Bot Detection: flag known bots and crawlers so sGTM can skip ad tag firing",
    "map $http_user_agent $tagioo_is_bot {",
    "    default                                                                           0;",
    "    ~*(?i)(bot|crawl|spider|slurp|wget|curl|python-requests|java/|go-http-client|scrapy|phantomjs|headless) 1;",
    "    ~*(?i)(Googlebot|Googlebot-Image|bingbot|Baiduspider|YandexBot|DuckDuckBot|facebookexternalhit|AhrefsBot|SemrushBot|MJ12bot|Dotbot) 1;",
    "}",
    "",
    "# Meta IPv6: prefer visitor's IPv6 address (from Cloudflare) for higher EMQ",
    "# nginx skips proxy_set_header when map value is empty — safe for non-CF or IPv4-only visitors",
    `map $http_cf_connecting_ipv6 $tagioo_fb_client_ipv6 { default $http_cf_connecting_ipv6; "" ""; }`,
    "",
    "# User Agent Info: device type classification for sGTM segmentation",
    "map $http_user_agent $tagioo_device_type {",
    "    default                                                                      \"desktop\";",
    "    ~*(?i)(android(?!.*tablet)|iphone|ipod|blackberry|windows\\s+phone|mobile)  \"mobile\";",
    "    ~*(?i)(ipad|android.*tablet|tablet)                                          \"tablet\";",
    "}",
    ""
  ].join("\n");
}

async function initPowerUpMaps() {
  const steps = [];
  const content = generatePowerUpMapsContent();
  // Write to data dir first (we own it), then sudo-copy to nginx conf.d
  const tmpPath = join(config.dataDir, "tagioo-powerups-maps.conf.tmp");
  try {
    await mkdir(config.dataDir, { recursive: true });
    await writeFile(tmpPath, content, "utf8");
    steps.push({ label: "Write maps temp file", ok: true });
  } catch (err) {
    steps.push({ label: "Write maps temp file", ok: false, error: err.message });
    return { ok: false, steps };
  }

  const cpResult = await command("sudo", ["cp", tmpPath, powerUpMapsPath], { timeout: 5000 });
  steps.push({ label: "Copy to nginx conf.d", ok: cpResult.ok, error: cpResult.ok ? null : cpResult.stderr });
  if (!cpResult.ok) return { ok: false, steps };

  const testResult = await command("sudo", ["nginx", "-t"], { timeout: 8000, maxBuffer: 1024 * 1024 });
  steps.push({ label: "nginx -t", ok: testResult.ok, error: testResult.ok ? null : (testResult.stderr || testResult.stdout) });
  if (!testResult.ok) {
    // Revert — remove the maps file to avoid breaking nginx
    await command("sudo", ["rm", "-f", powerUpMapsPath], { timeout: 5000 });
    steps.push({ label: "Revert maps file (nginx test failed)", ok: true });
    return { ok: false, steps };
  }

  const reloadResult = await command("sudo", ["systemctl", "reload", "nginx"], { timeout: 10000 });
  steps.push({ label: "systemctl reload nginx", ok: reloadResult.ok, error: reloadResult.ok ? null : reloadResult.stderr });
  return { ok: reloadResult.ok, steps, mapsPath: powerUpMapsPath };
}

async function regenNginxForContainer(request) {
  if (!request?.plan?.nginxPath || !request?.domain) {
    return { ok: false, error: "Invalid request: missing plan.nginxPath or domain." };
  }
  // Regenerate the plan (picks up current powerUpsActive flag)
  request.plan = provisioningPlan(request);
  await writeFile(request.plan.nginxPath, request.plan.nginx, "utf8");

  const nginxTarget = join(config.nginxSitesAvailableDir, request.domain);
  const cpResult = await command("sudo", ["cp", request.plan.nginxPath, nginxTarget], { timeout: 5000 });
  if (!cpResult.ok) return { ok: false, error: `cp failed: ${cpResult.stderr}` };

  const testResult = await command("sudo", ["nginx", "-t"], { timeout: 8000, maxBuffer: 1024 * 1024 });
  if (!testResult.ok) return { ok: false, error: `nginx -t failed: ${testResult.stderr || testResult.stdout}` };

  const reloadResult = await command("sudo", ["systemctl", "reload", "nginx"], { timeout: 10000 });
  if (!reloadResult.ok) return { ok: false, error: reloadResult.stderr };

  // Re-run certbot to restore SSL after rebuilding the nginx config from template.
  // buildNginxConfig generates HTTP-only (port 80); certbot --nginx re-adds the SSL block
  // without re-issuing the certificate (idempotent when cert is still valid).
  const runCertbot = () =>
    command(
      "sudo",
      ["certbot", "--nginx", "-d", request.domain, "--non-interactive", "--agree-tos", "--redirect"],
      { timeout: 60000, maxBuffer: 1024 * 1024 }
    ).catch((err) => ({ ok: false, stdout: "", stderr: err.message }));

  let certbotResult = await runCertbot();

  // Verify certbot actually injected the SSL block. If the live config still has no
  // "listen 443", certbot silently failed (rate-limit, DNS hiccup, 60s timeout).
  // Retry once — this is the recurring cause of HTTPS events stopping.
  const nginxLivePath = join(config.nginxSitesAvailableDir, request.domain);
  const liveConfig = await readFile(nginxLivePath, "utf8").catch(() => "");
  const hasSSL = liveConfig.includes("listen 443") || liveConfig.includes("ssl_certificate");

  if (!hasSSL) {
    certbotResult = await runCertbot();
    const liveConfigRetry = await readFile(nginxLivePath, "utf8").catch(() => "");
    const hasSSLRetry = liveConfigRetry.includes("listen 443") || liveConfigRetry.includes("ssl_certificate");
    if (hasSSLRetry) {
      // Reload nginx to pick up the SSL block added on retry
      await command("sudo", ["systemctl", "reload", "nginx"], { timeout: 10000 });
    } else {
      // Certbot failed twice — return error so caller knows SSL is broken
      return {
        ok: false,
        error: `Certbot failed to add SSL for ${request.domain}. HTTPS events will not arrive until SSL is restored. Run manually: certbot --nginx -d ${request.domain} --non-interactive --agree-tos --redirect`,
        certbot: "ssl-failed",
        certbotError: certbotResult.stderr || certbotResult.stdout || null
      };
    }
  }

  return {
    ok: true,
    certbot: certbotResult.ok ? "ssl-restored" : "ssl-restored-on-retry",
    certbotError: certbotResult.ok ? null : (certbotResult.stderr || certbotResult.stdout || null)
  };
}

function buildNginxConfig({ domain, port, accessLogLine, errorLog }) {
  const powerUpSetCookies = powerUpsActive ? `
        # ── Cookie Keeper ──────────────────────────────────────────────────
        # Renews analytics cookies via first-party domain on every response.
        # nginx skips headers with empty value (no cookie present = no header).
        add_header Set-Cookie $tagioo_ck_ga always;
        add_header Set-Cookie $tagioo_ck_fbp always;
        add_header Set-Cookie $tagioo_ck_gcl_aw always;
        add_header Set-Cookie $tagioo_ck_ttp always;
        add_header Set-Cookie $tagioo_ck_gcl_gb always;
        # ── Click ID Restorer ───────────────────────────────────────────────
        # Captures fbclid/gclid/ttclid/msclkid from URL into 90-day cookies.
        # Passes stored click IDs to sGTM via request headers.
        add_header Set-Cookie $tagioo_cid_fbclid always;
        add_header Set-Cookie $tagioo_cid_gclid always;
        add_header Set-Cookie $tagioo_cid_ttclid always;
        add_header Set-Cookie $tagioo_cid_msclkid always;
        proxy_set_header X-FB-Click-ID $cookie_tagioo_fbclid;
        proxy_set_header X-GCL-Click-ID $cookie_tagioo_gclid;
        proxy_set_header X-TT-Click-ID $cookie_tagioo_ttclid;
        # ── Bot Detection ───────────────────────────────────────────────────
        # Flags bots/crawlers so sGTM can skip firing ad conversion tags.
        # Read in sGTM via Request Header variable: X-Tagioo-Bot (1 = bot, 0 = human).
        proxy_set_header X-Tagioo-Bot $tagioo_is_bot;
        # ── User Agent Info ─────────────────────────────────────────────────
        # Device type (mobile/tablet/desktop) and raw UA for sGTM segmentation.
        # Use as sGTM Request Header variables: X-Tagioo-Device, X-Tagioo-UA.
        proxy_set_header X-Tagioo-Device $tagioo_device_type;
        proxy_set_header X-Tagioo-UA $http_user_agent;
        # ── Meta IPv6 ───────────────────────────────────────────────────────────
        # Forwards Cloudflare visitor IPv6 so Meta CAPI prefers IPv6 over IPv4 (higher EMQ).
        # Map $tagioo_fb_client_ipv6 is defined in tagioo-powerups-maps.conf.
        # nginx drops this header automatically when value is empty (IPv4-only or non-CF visitors).
        proxy_set_header X-FB-Client-IPv6 $tagioo_fb_client_ipv6;` : "";

  const customLoaderLocation = powerUpsActive ? `
    # ── Custom Loader ────────────────────────────────────────────────────────
    # Serves GTM/gtag scripts via first-party domain to bypass ad blockers.
    # Web GTM snippet: replace gtm.js URL with https://${domain}/tagioo-loader/gtm.js
    location ~* ^/tagioo-loader/(.+)$ {
        resolver 8.8.8.8 valid=60s;
        proxy_pass https://www.googletagmanager.com/$1$is_args$args;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_set_header Host www.googletagmanager.com;
        proxy_set_header Accept-Encoding "";
        proxy_set_header Referer "";
        proxy_hide_header Set-Cookie;
        add_header Cache-Control "public, max-age=1800";
        add_header X-Tagioo-Loader "1" always;
    }` : "";

  return `server {
    listen 80;
    server_name ${domain};

${accessLogLine}
    error_log ${errorLog} warn;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        # ── GEO Headers ─────────────────────────────────────────────────────
        # Passes visitor country and IP to sGTM on every request.
        # X-Tagioo-Country: ISO country code from Cloudflare (CF-IPCountry header).
        # X-Tagioo-Client-IP: real visitor IP for geo lookup in sGTM if no CDN.
        proxy_set_header X-Tagioo-Country $http_cf_ipcountry;
        proxy_set_header X-Tagioo-Client-IP $remote_addr;
        # ── Meta Signal Quality ─────────────────────────────────────────────
        # Forwards _fbp and _fbc cookies as explicit headers so sGTM CAPI
        # template can read them via Request Header variables (higher EMQ).
        proxy_set_header X-FB-Browser-ID $cookie__fbp;
        proxy_set_header X-FB-Click-Cookie $cookie__fbc;${powerUpSetCookies}
    }${customLoaderLocation}
}
`;
}

function isDockerComposeContainerConfigError(result) {
  return /ContainerConfig/.test(`${result?.error || ""}\n${result?.stderr || ""}\n${result?.stdout || ""}`);
}

async function dnsResolves(domain) {
  const dns = await command("getent", ["ahosts", domain], { timeout: 1000, maxBuffer: 20000 });
  return Boolean(dns.ok && dns.stdout);
}

function timeoutResult(message, detail = "Collector timed out.") {
  return unavailable(message, detail);
}

function withTimeout(promise, timeout, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeout);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        resolve(unavailable(fallback.message || "Collector failed.", error.message));
      });
  });
}

function unavailable(message, detail = "") {
  return { available: false, message, detail };
}

function cloneJson(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

async function cachedSummary(key, producer, { allowStale = true, ttl = SUMMARY_CACHE_TTL_MS } = {}) {
  const now = Date.now();
  const cached = summaryCache.get(key);
  if (cached?.value && now - cached.updatedAt < ttl) {
    return { ...cloneJson(cached.value), cached: true };
  }
  if (cached?.promise) return cached.promise;
  if (allowStale && cached?.value) {
    const refresh = producer()
      .then((value) => {
        summaryCache.set(key, { value, updatedAt: Date.now(), promise: null });
        return value;
      })
      .catch((error) => {
        summaryCache.set(key, { ...cached, promise: null });
        return unavailable("Cached summary refresh failed.", error.message);
      });
    summaryCache.set(key, { ...cached, promise: refresh });
    return { ...cloneJson(cached.value), cached: true, refreshing: true };
  }

  const promise = producer()
    .then((value) => {
      summaryCache.set(key, { value, updatedAt: Date.now(), promise: null });
      return value;
    })
    .catch((error) => {
      summaryCache.delete(key);
      return unavailable("Summary could not be calculated.", error.message);
    });
  summaryCache.set(key, { value: cached?.value || null, updatedAt: cached?.updatedAt || 0, promise });
  return promise;
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
      signal: AbortSignal.timeout(1000),
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
  ], { timeout: DASHBOARD_COMMAND_TIMEOUT_MS });

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
  ], { timeout: DOCKER_INSPECT_TIMEOUT_MS });

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
  ], { timeout: DOCKER_LOG_TIMEOUT_MS });

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
  const result = await command("tail", ["-n", String(lineCount), pathname], { timeout: DASHBOARD_COMMAND_TIMEOUT_MS });
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
  const normalized = compact.endsWith("stape") ? compact.slice(0, -"stape".length) : compact;
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
  return names[normalized] || "";
}

function searchParamsForPath(pathname) {
  try {
    return new URL(pathname, "https://sgtm.local").searchParams;
  } catch {
    return null;
  }
}

function queryValueFromParams(params, keys) {
  if (!params) return "";
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== "") return value;
  }
  return "";
}

function queryEventNameFromParams(params) {
  for (const key of ["event", "event_name", "en", "e", "action", "type", "name"]) {
    const eventName = normalizeEventName(params?.get(key));
    if (eventName) return eventName;
  }
  return "";
}

function queryEventName(pathname) {
  return queryEventNameFromParams(searchParamsForPath(pathname));
}

function inferEventName(pathname, method, status, params = null) {
  let raw = String(pathname || "").toLowerCase();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the raw URL when a bot or malformed client sends broken encoding.
  }
  const queryEvent = queryEventNameFromParams(params || searchParamsForPath(pathname));
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

  return blocked ? "Rejected Request" : "Tracking Request";
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
  return queryValueFromParams(searchParamsForPath(pathname), keys);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function decodeBase64Json(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function payloadValue(payload, keys) {
  if (!payload || typeof payload !== "object") return "";
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function dataTagPayloadFromParams(params) {
  return decodeBase64Json(queryValueFromParams(params, ["dtdc", "data", "payload"])) || {};
}

function dataTagPayload(pathname) {
  return dataTagPayloadFromParams(searchParamsForPath(pathname));
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

  const params = searchParamsForPath(pathname);
  const date = parseNginxLogDate(time);
  const eventName = inferEventName(pathname, method, status, params);
  const client = inferClient(pathname, agent);
  const host = inferHost(line, pathname);
  const payload = dataTagPayloadFromParams(params);
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
    value: firstNonEmpty(
      queryValueFromParams(params, ["value", "ep.value", "epn.value", "epn.ecomm_totalvalue", "price", "revenue"]),
      payloadValue(payload, ["value", "revenue", "total", "amount", "ecomm_totalvalue"])
    ),
    currency: firstNonEmpty(
      queryValueFromParams(params, ["currency", "ep.currency", "cu"]),
      payloadValue(payload, ["currency", "currencyCode"])
    ),
    eventId: firstNonEmpty(
      queryValueFromParams(params, ["event_id", "eventId", "eid", "x-fb-event-id"]),
      payloadValue(payload, ["event_id", "eventId", "fb_event_id"])
    ),
    transactionId: firstNonEmpty(
      queryValueFromParams(params, ["transaction_id", "transactionId", "ep.transaction_id", "ep.order_id", "tr", "order_id", "orderId"]),
      payloadValue(payload, ["transaction_id", "transactionId", "order_id", "orderId", "order_number"])
    ),
    pageLocation: firstNonEmpty(
      queryValueFromParams(params, ["dl", "page_location", "ep.page_location", "url"]),
      payloadValue(payload, ["page_location", "url", "source_url"])
    ),
    pagePath: firstNonEmpty(
      queryValueFromParams(params, ["dp", "page_path", "ep.page_path"]),
      payloadValue(payload, ["page_path", "path"])
    ),
    eventKey: firstNonEmpty(
      queryValueFromParams(params, ["_p", "cid", "client_id", "sid", "session_id"]),
      payloadValue(payload, ["client_id", "session_id", "fbp", "fbc"])
    )
  };
}

function purchaseTransactionIdentity(item) {
  if (item.eventName !== "Purchase") return "";
  const transactionId = String(item.transactionId || "").trim();
  if (transactionId) return `transaction:${transactionId}`;
  return "";
}

function estimatedPurchaseSignature(item) {
  const host = String(item.host || "unknown-host").trim().toLowerCase();
  return host;
}

function isTrackedBusinessEvent(name) {
  return ["PageView", "ViewItem", "ViewCart", "AddToCart", "BeginCheckout", "Purchase", "Lead", "Search"].includes(name);
}

function eventExactIdentity(item) {
  if (!isTrackedBusinessEvent(item.eventName)) return "";
  if (item.eventName === "Purchase") return purchaseTransactionIdentity(item);
  if (item.eventId) return `event:${item.eventName}:${item.eventId}`;
  if (item.eventKey) return `key:${item.eventName}:${item.eventKey}`;
  return "";
}

function eventEstimateSignature(item) {
  const host = String(item.host || "unknown-host").trim().toLowerCase();
  const page = String(item.pageLocation || item.pagePath || "").trim().toLowerCase();
  const ip = String(item.ip || "").trim();
  return `${item.eventName}|${host}|${page || "no-page"}|${ip || "no-ip"}`;
}

function markUniqueEvent(item, state) {
  if (!isTrackedBusinessEvent(item.eventName)) return false;
  const exact = eventExactIdentity(item);
  if (exact) {
    if (state.exact.has(exact)) return false;
    state.exact.add(exact);
    return true;
  }

  if (!item.date) return true;
  const signature = eventEstimateSignature(item);
  const timestamp = item.date.getTime();
  const lastSeen = state.estimated.get(signature);
  if (lastSeen && timestamp - lastSeen <= EVENT_ESTIMATE_WINDOW_MS) {
    state.estimated.set(signature, timestamp);
    return false;
  }
  state.estimated.set(signature, timestamp);
  return true;
}

function parseMoney(value) {
  const amount = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function estimatedPurchaseGroups(items) {
  const groups = [];
  const sorted = [...items]
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date);

  for (const item of sorted) {
    const signature = estimatedPurchaseSignature(item);
    const timestamp = item.date.getTime();
    const group = groups.find((candidate) => (
      candidate.signature === signature &&
      timestamp - candidate.lastSeen <= PURCHASE_ESTIMATE_WINDOW_MS
    ));
    const amount = parseMoney(item.value);
    const currency = String(item.currency || "").trim().toUpperCase();
    if (group) {
      group.lastSeen = timestamp;
      if (group.amount === null && amount !== null) group.amount = amount;
      if (!group.currency && currency) group.currency = currency;
      continue;
    }
    groups.push({ signature, firstSeen: timestamp, lastSeen: timestamp, amount, currency });
  }

  return groups;
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

function classifyTrackingNoise(item) {
  const lower = `${item.path || ""} ${item.agent || ""}`.toLowerCase();
  if (lower.includes("gtm_debug") || lower.includes("gtm_preview") || lower.includes("tagassistant")) return "Preview/debug traffic";
  if (/(bot|crawler|spider|headless|phantom|python|curl|wget|httpclient|scrapy|go-http-client|uptime|monitor)/i.test(lower)) {
    return "Tracking bot";
  }
  return "";
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
    transactionId: item.transactionId,
    pageLocation: item.pageLocation,
    pagePath: item.pagePath,
    eventKey: item.eventKey
  };
}

async function readDatabase() {
  const defaults = {
    version: 3,
    settings: {},
    daily: {},
    tenantDailyRequests: {},
    tenantEventHistory: {},
    provisioning: { requests: [] },
    workerNodes: [],
    orders: [],
    tenants: [],
    customerAccounts: [],
    customerSetupRequests: [],
    alerts: [],
    integrations: []
  };
  try {
    const content = await readFile(databasePath, "utf8");
    const parsed = JSON.parse(content);
    return {
      available: true,
      path: databasePath,
      data: {
        ...defaults,
        ...parsed,
        settings: parsed.settings || {},
        daily: parsed.daily || {},
        tenantDailyRequests: parsed.tenantDailyRequests || {},
        tenantEventHistory: parsed.tenantEventHistory || {},
        provisioning: parsed.provisioning || { requests: [] },
        workerNodes: parsed.workerNodes || [],
        orders: parsed.orders || [],
        tenants: parsed.tenants || [],
        customerAccounts: parsed.customerAccounts || [],
        customerSetupRequests: parsed.customerSetupRequests || [],
        alerts: parsed.alerts || [],
        integrations: parsed.integrations || []
      }
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { available: true, path: databasePath, data: defaults };
    }
    return {
      available: false,
      path: databasePath,
      message: "Summary database could not be read.",
      detail: error.message,
      data: defaults
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

function historySnapshotFromSummary(summary, date = localDateKey()) {
  return {
    date,
    token: summary.token,
    updatedAt: new Date().toISOString(),
    total: Number(summary.count || 0),
    errors: Number(summary.errors || 0),
    totalLines: Number(summary.totalLines || 0),
    noise: Number(summary.noise || 0),
    botNoise: Number(summary.botNoise || 0),
    events: topRows(summary.events),
    clients: topRows(summary.clients),
    hosts: topRows(summary.hosts),
    noiseReasons: topRows(summary.noiseReasons),
    hourly: summary.hourly || [],
    purchaseSummary: summary.purchases || {
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      keyedCount: 0,
      estimatedKeyCount: 0,
      missingKeyCount: 0,
      uniqueRevenue: 0,
      rawRevenue: 0,
      averageOrderValue: 0,
      currency: ""
    },
    recentEvents: (summary.recentEvents || []).slice(0, config.eventLogLimit)
  };
}

function storeTenantEventSnapshot(data, tenantId, summary, date = localDateKey()) {
  if (!tenantId || !summary?.available) return;
  if (!data.tenantEventHistory) data.tenantEventHistory = {};
  if (!data.tenantEventHistory[tenantId]) data.tenantEventHistory[tenantId] = {};
  // After logrotate or a container restart the fresh access log undercounts the day,
  // so a tail-based summary can come back smaller than what we already recorded.
  // Never replace a stored snapshot with a smaller one for the same date.
  const existing = data.tenantEventHistory[tenantId][date];
  if (existing && Number(existing.total || 0) > Number(summary.count || 0)) return;
  data.tenantEventHistory[tenantId][date] = historySnapshotFromSummary(summary, date);
}

function pruneTenantEventHistory(history, days = 30) {
  const cutoffDate = localDateKey(addDays(new Date(), -(days - 1)));
  for (const tenantId of Object.keys(history || {})) {
    for (const dateKey of Object.keys(history[tenantId] || {})) {
      if (dateKey < cutoffDate) delete history[tenantId][dateKey];
    }
    if (!Object.keys(history[tenantId] || {}).length) delete history[tenantId];
  }
}

function mergeHistoryRows(snapshots, key) {
  const rows = new Map();
  for (const snapshot of snapshots) {
    for (const row of snapshot[key] || []) {
      const name = row.name || "Other";
      const current = rows.get(name) || { name, lastSeen: null };
      for (const [field, value] of Object.entries(row)) {
        if (field === "name" || field === "lastSeen") continue;
        if (typeof value === "number") current[field] = Number(current[field] || 0) + value;
        else if (current[field] === undefined) current[field] = value;
      }
      if (row.lastSeen && (!current.lastSeen || new Date(row.lastSeen) > new Date(current.lastSeen))) {
        current.lastSeen = row.lastSeen;
      }
      rows.set(name, current);
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
}

function mergeHistoryHourly(snapshots) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, errors: 0, purchases: 0, pageView: 0, viewItem: 0, addToCart: 0, beginCheckout: 0 }));
  for (const snapshot of snapshots) {
    for (const row of snapshot.hourly || []) {
      const bucket = hourly[Number(row.hour)];
      if (!bucket) continue;
      for (const key of Object.keys(bucket)) {
        if (key !== "hour") bucket[key] += Number(row[key] || 0);
      }
    }
  }
  return hourly;
}

function mergeHistoryPurchases(snapshots) {
  const rows = snapshots.map((snapshot) => snapshot.purchaseSummary || {});
  const uniqueCount = rows.reduce((total, row) => total + Number(row.uniqueCount || 0), 0);
  const uniqueRevenue = rows.reduce((total, row) => total + Number(row.uniqueRevenue || 0), 0);
  const currencies = new Set(rows.map((row) => row.currency).filter(Boolean));
  return {
    rawCount: rows.reduce((total, row) => total + Number(row.rawCount || 0), 0),
    uniqueCount,
    duplicateCount: rows.reduce((total, row) => total + Number(row.duplicateCount || 0), 0),
    keyedCount: rows.reduce((total, row) => total + Number(row.keyedCount || 0), 0),
    estimatedKeyCount: rows.reduce((total, row) => total + Number(row.estimatedKeyCount || 0), 0),
    missingKeyCount: rows.reduce((total, row) => total + Number(row.missingKeyCount || 0), 0),
    uniqueRevenue,
    rawRevenue: rows.reduce((total, row) => total + Number(row.rawRevenue || 0), 0),
    averageOrderValue: uniqueCount ? uniqueRevenue / uniqueCount : 0,
    currency: currencies.size === 1 ? [...currencies][0] : ""
  };
}

function retainedSummaryFromSnapshots(snapshots, fallbackSummary = null) {
  const rows = (snapshots || [])
    .filter(Boolean)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  if (!rows.length) return fallbackSummary || emptyCustomerRequestSummary();
  const recentEvents = rows
    .flatMap((snapshot) => snapshot.recentEvents || [])
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, config.eventLogLimit);
  return {
    ...(fallbackSummary || {}),
    available: true,
    count: rows.reduce((total, row) => total + Number(row.total || 0), 0),
    errors: rows.reduce((total, row) => total + Number(row.errors || 0), 0),
    totalLines: rows.reduce((total, row) => total + Number(row.totalLines || 0), 0),
    noise: rows.reduce((total, row) => total + Number(row.noise || 0), 0),
    botNoise: rows.reduce((total, row) => total + Number(row.botNoise || 0), 0),
    token: `last ${rows.length} day${rows.length === 1 ? "" : "s"}`,
    retentionDays: 30,
    dateRange: { start: rows[0].date, end: rows.at(-1).date },
    events: mergeHistoryRows(rows, "events"),
    clients: mergeHistoryRows(rows, "clients"),
    hosts: mergeHistoryRows(rows, "hosts"),
    noiseReasons: mergeHistoryRows(rows, "noiseReasons"),
    purchases: mergeHistoryPurchases(rows),
    hourly: mergeHistoryHourly(rows),
    recentEvents,
    eventLogLimit: config.eventLogLimit
  };
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function orderDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeOrderPayload(body) {
  const id = String(firstValue(body, ["order_id", "orderId", "orderNo", "order_no", "id", "transaction_id", "transactionId"])).trim();
  const amount = parseMoney(firstValue(body, ["amount", "total", "totalAmount", "total_amount", "value", "revenue"]));
  const currency = String(firstValue(body, ["currency", "currencyCode", "currency_code"]) || "BDT").trim().toUpperCase();
  const createdAt = orderDate(firstValue(body, ["created_at", "createdAt", "ordered_at", "orderedAt", "date", "time"]));
  const tenantId = sanitizeId(firstValue(body, ["tenant_id", "tenantId", "customer_id", "customerId"]) || config.tenantId);
  const orderType = sanitizeId(firstValue(body, ["order_type", "orderType", "channel", "source_type"]) || "store");

  return {
    id,
    amount,
    currency,
    createdAt: createdAt.toISOString(),
    tenantId,
    orderType,
    source: String(body.source || "webhook"),
    raw: body
  };
}

function isOrderWebhookAuthorized(req) {
  if (!config.orderWebhookSecret) return false;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const secret = req.headers["x-order-webhook-secret"] || bearer;
  return safeEqual(String(secret || ""), config.orderWebhookSecret);
}

function isWooOrderWebhookAuthorized(req, rawBody, secret) {
  if (!secret) return false;
  const signature = String(req.headers["x-wc-webhook-signature"] || "");
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(signature, expected);
}

// WooCommerce sends date_created_gmt as "2026-06-12T08:00:00" with no timezone
// marker, so it must be pinned to UTC before Date parses it as local time.
function wooGmtDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`;
}

function normalizeWooOrderPayload(body, tenantId) {
  return {
    order_id: String(body.id ?? body.order_id ?? "").trim(),
    total: body.total,
    currency: body.currency,
    created_at: wooGmtDate(body.date_created_gmt || body.date_created),
    tenant_id: tenantId || config.tenantId,
    order_type: sanitizeId(body.created_via || "") || "store",
    status: body.status,
    source: "woocommerce"
  };
}

async function addOrderWebhook(body) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const order = normalizeOrderPayload(body);
  if (!order.id) return { ok: false, errors: ["Order id is required."] };

  const data = loaded.data;
  data.orders = data.orders || [];
  const index = data.orders.findIndex((item) => item.id === order.id);
  if (index === -1) data.orders.push(order);
  else data.orders[index] = { ...data.orders[index], ...order, updatedAt: new Date().toISOString() };

  await writeDatabase(data);
  return { ok: true, order, created: index === -1 };
}

function getOrderSummaryFromData(loadedDb) {
  const today = localDateKey();
  const orders = ((loadedDb.data || loadedDb).orders || []).filter((order) => localDateKey(orderDate(order.createdAt)) === today);
  const currencies = new Set(orders.map((order) => order.currency).filter(Boolean));
  const currency = currencies.size === 1 ? [...currencies][0] : "";
  const revenue = orders.reduce((total, order) => (
    order.amount === null || order.amount === undefined ? total : total + Number(order.amount || 0)
  ), 0);
  const latest = orders
    .slice()
    .sort((a, b) => orderDate(b.createdAt) - orderDate(a.createdAt))[0] || null;
  const available = loadedDb.available ?? true;
  return {
    available,
    configured: Boolean(config.orderWebhookSecret),
    path: databasePath,
    message: loadedDb.message || "",
    detail: loadedDb.detail || "",
    rawToday: orders,
    today: {
      date: today,
      count: orders.length,
      revenue,
      currency,
      averageOrderValue: orders.length ? revenue / orders.length : 0,
      latest
    }
  };
}

async function getOrderSummary() {
  const loaded = await readDatabase();
  const today = localDateKey();
  const orders = (loaded.data.orders || []).filter((order) => localDateKey(orderDate(order.createdAt)) === today);
  const currencies = new Set(orders.map((order) => order.currency).filter(Boolean));
  const currency = currencies.size === 1 ? [...currencies][0] : "";
  const revenue = orders.reduce((total, order) => (
    order.amount === null || order.amount === undefined ? total : total + Number(order.amount || 0)
  ), 0);
  const latest = orders
    .slice()
    .sort((a, b) => orderDate(b.createdAt) - orderDate(a.createdAt))[0] || null;

  return {
    available: loaded.available,
    configured: Boolean(config.orderWebhookSecret),
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    rawToday: orders,
    today: {
      date: today,
      count: orders.length,
      revenue,
      currency,
      averageOrderValue: orders.length ? revenue / orders.length : 0,
      latest
    }
  };
}

function publicCustomerAccount(account) {
  return {
    id: account.id,
    tenantId: account.tenantId,
    tenantName: account.tenantName || account.tenantId,
    username: account.username,
    fullName: account.fullName || account.tenantName || "",
    email: account.email || account.username || "",
    country: account.country || "",
    phone: account.phone || "",
    referral: account.referral || "",
    status: account.status || "active",
    createdAt: account.createdAt || "",
    updatedAt: account.updatedAt || "",
    lastLoginAt: account.lastLoginAt || ""
  };
}

async function findCustomerAccountByUsername(username) {
  const loaded = await readDatabase();
  return (loaded.data.customerAccounts || []).find((account) => account.username === String(username || "").trim()) || null;
}

function validateCustomerAccountInput(input) {
  const tenantId = sanitizeId(input.tenantId || input.tenant_id || "");
  const tenantName = String(input.tenantName || input.tenant_name || tenantId).trim().slice(0, 120);
  const username = String(input.username || "").trim().toLowerCase();
  const password = String(input.password || "");
  const plan = String(input.plan || input.planName || config.billingPlan || "Starter").trim();
  const domain = String(input.domain || "").trim().toLowerCase();
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl || input.website_url || "");
  const source = String(input.source || "customer_account").trim().toLowerCase();
  const subscriptionStatus = String(input.subscriptionStatus || input.subscription_status || "active").trim().toLowerCase();
  const paymentStatus = String(input.paymentStatus || input.payment_status || "paid").trim().toLowerCase();
  const fullName = String(input.fullName || input.full_name || tenantName).trim().slice(0, 120);
  const email = String(input.email || username).trim().toLowerCase();
  const country = String(input.country || "").trim().slice(0, 40);
  const phone = String(input.phone || "").trim().slice(0, 40);
  const referral = String(input.referral || "").trim().slice(0, 120);
  const errors = [];

  if (!tenantId) errors.push("Tenant ID is required.");
  if (!/^[a-z0-9][a-z0-9._@-]{2,127}$/i.test(username)) errors.push("Username must be at least 3 characters and use letters, numbers, dot, dash, underscore, or @.");
  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (domain && !validDomain(domain)) errors.push("Domain must be a valid hostname.");
  if ((input.websiteUrl || input.website_url) && !websiteUrl) errors.push("Website must be a valid URL.");

  return {
    errors,
    value: {
      tenantId,
      tenantName,
      username,
      password,
      plan,
      domain,
      websiteUrl,
      source,
      subscriptionStatus,
      paymentStatus,
      fullName,
      email,
      country,
      phone,
      referral,
      status: String(input.status || "active").trim().toLowerCase()
    }
  };
}

async function addCustomerAccount(input, options = {}) {
  const allowUpdate = options.allowUpdate !== false;
  const validated = validateCustomerAccountInput(input);
  if (validated.errors.length) return { ok: false, errors: validated.errors };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  data.customerAccounts ||= [];
  data.tenants ||= [];
  const duplicate = data.customerAccounts.find((account) =>
    account.username === validated.value.username && account.tenantId !== validated.value.tenantId
  );
  if (duplicate) return { ok: false, errors: ["Username is already used by another customer."] };

  const now = new Date().toISOString();
  const accountIndex = data.customerAccounts.findIndex((account) => account.tenantId === validated.value.tenantId);
  if (!allowUpdate && accountIndex !== -1) return { ok: false, errors: ["An account already exists for this customer."] };
  const account = {
    id: accountIndex === -1 ? `acct_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}` : data.customerAccounts[accountIndex].id,
    tenantId: validated.value.tenantId,
    tenantName: validated.value.tenantName,
    username: validated.value.username,
    fullName: validated.value.fullName,
    email: validated.value.email,
    country: validated.value.country,
    phone: validated.value.phone,
    referral: validated.value.referral,
    passwordHash: hashPassword(validated.value.password),
    status: validated.value.status === "disabled" ? "disabled" : "active",
    createdAt: accountIndex === -1 ? now : data.customerAccounts[accountIndex].createdAt,
    updatedAt: now
  };

  if (accountIndex === -1) data.customerAccounts.push(account);
  else data.customerAccounts[accountIndex] = { ...data.customerAccounts[accountIndex], ...account };

  const tenantIndex = data.tenants.findIndex((tenant) => tenant.id === validated.value.tenantId);
  const tenantProfile = resourceProfileForPlan(validated.value.plan);
  const tenant = {
    id: validated.value.tenantId,
    name: validated.value.tenantName,
    fullName: validated.value.fullName,
    email: validated.value.email,
    country: validated.value.country,
    phone: validated.value.phone,
    referral: validated.value.referral,
    domain: validated.value.domain,
    websiteUrl: validated.value.websiteUrl,
    plan: validated.value.plan,
    subscriptionStatus: validated.value.subscriptionStatus,
    paymentStatus: validated.value.paymentStatus,
    requestLimit: tenantProfile.monthlyRequestLimit,
    containerLimit: tenantProfile.containerLimit,
    monthlyAmount: monthlyAmountForPlan(validated.value.plan),
    status: "active",
    source: validated.value.source,
    updatedAt: now
  };
  if (tenantIndex === -1) data.tenants.push({ ...tenant, createdAt: now });
  else data.tenants[tenantIndex] = { ...data.tenants[tenantIndex], ...tenant };

  await writeDatabase(data);
  return { ok: true, account: publicCustomerAccount(account) };
}

async function resetCustomerAccountPassword(id, password) {
  const accountId = String(id || "").trim();
  const nextPassword = String(password || "");
  if (!accountId) return { ok: false, status: 400, errors: ["Customer account is required."] };
  if (nextPassword.length < 8) return { ok: false, status: 400, errors: ["Password must be at least 8 characters."] };

  const loaded = await readDatabase();
  if (!loaded.available) {
    return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  }

  const data = loaded.data;
  data.customerAccounts ||= [];
  const account = data.customerAccounts.find((item) => item.id === accountId || item.tenantId === accountId || item.username === accountId);
  if (!account) return { ok: false, status: 404, errors: ["Customer login was not found."] };

  account.passwordHash = hashPassword(nextPassword);
  account.updatedAt = new Date().toISOString();
  await writeDatabase(data);
  return { ok: true, account: publicCustomerAccount(account) };
}

async function updateCustomerProfile(session, input) {
  const fullName = String(input.fullName || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().slice(0, 254);
  const phone = String(input.phone || "").trim().slice(0, 40);
  const errors = [];
  if (!fullName) errors.push("Name is required.");
  if (!email) errors.push("Email is required.");
  if (errors.length) return { ok: false, status: 400, errors };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || "Database unavailable."] };
  const data = loaded.data;
  data.customerAccounts ||= [];
  const account = data.customerAccounts.find((a) => a.id === session.accountId || a.tenantId === session.tenantId);
  if (!account) return { ok: false, status: 404, errors: ["Account not found."] };

  account.fullName = fullName;
  account.email = email;
  account.phone = phone;
  account.updatedAt = new Date().toISOString();

  const tenant = (data.tenants || []).find((t) => t.id === account.tenantId);
  if (tenant) {
    tenant.fullName = fullName;
    tenant.email = email;
    tenant.phone = phone;
    tenant.updatedAt = account.updatedAt;
  }

  await writeDatabase(data);
  return { ok: true, account: publicCustomerAccount(account) };
}

async function changeCustomerPassword(session, input) {
  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");
  if (!currentPassword) return { ok: false, status: 400, errors: ["Current password is required."] };
  if (newPassword.length < 8) return { ok: false, status: 400, errors: ["New password must be at least 8 characters."] };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || "Database unavailable."] };
  const data = loaded.data;
  data.customerAccounts ||= [];
  const account = data.customerAccounts.find((a) => a.id === session.accountId || a.tenantId === session.tenantId);
  if (!account) return { ok: false, status: 404, errors: ["Account not found."] };
  if (!verifyPassword(currentPassword, account.passwordHash)) return { ok: false, status: 400, errors: ["Current password is incorrect."] };

  account.passwordHash = hashPassword(newPassword);
  account.updatedAt = new Date().toISOString();
  await writeDatabase(data);
  return { ok: true };
}

function signupTenantBase(input) {
  const fullName = String(input.fullName || input.tenantName || "").trim();
  const usernameBase = String(input.email || input.username || "").split("@")[0];
  return sanitizeId(fullName || usernameBase || "customer") || "customer";
}

function uniqueTenantId(base, data) {
  const existing = new Set([
    ...(data.tenants || []).map((tenant) => tenant.id),
    ...(data.customerAccounts || []).map((account) => account.tenantId)
  ].filter(Boolean));
  if (!existing.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = sanitizeId(`${base}-${index}`);
    if (!existing.has(candidate)) return candidate;
  }
  return sanitizeId(`${base}-${Date.now().toString(36)}`);
}

async function addCustomerSignup(input) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  data.customerAccounts ||= [];
  data.tenants ||= [];
  const fullName = String(input.fullName || "").trim();
  const email = String(input.email || input.username || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const confirmPassword = String(input.confirmPassword || input.confirm_password || "");
  const errors = [];

  if (!fullName) errors.push("Full name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
  if (!phone) errors.push("Phone number is required.");
  if (password.length < 8) errors.push("Password must be at least 8 characters.");
  if (password !== confirmPassword) errors.push("Passwords do not match.");
  if (errors.length) return { ok: false, errors };

  const username = email;
  if (data.customerAccounts.some((account) => account.username === username)) {
    return { ok: false, errors: ["An account already exists with this email or username."] };
  }

  const tenantId = uniqueTenantId(signupTenantBase(input), data);
  const result = await addCustomerAccount({
    tenantId,
    tenantName: fullName,
    fullName,
    email,
    username,
    password,
    phone,
    country: input.country || "BD",
    referral: input.referral || "",
    plan: "Starter",
    source: "self_signup",
    subscriptionStatus: "trial",
    paymentStatus: "pending",
    status: "active"
  }, { allowUpdate: false });

  return result;
}

async function selectCustomerPlan(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const planName = String(input.plan || input.planName || "").trim();
  if (!planResourceProfiles[planName] || planName === "Customer") {
    return { ok: false, status: 400, errors: ["Choose a valid plan."] };
  }

  const loaded = await readDatabase();
  if (!loaded.available) {
    return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  }

  const data = loaded.data;
  data.tenants ||= [];
  const tenantIndex = data.tenants.findIndex((tenant) => tenant.id === session.tenantId);
  if (tenantIndex === -1) return { ok: false, status: 404, errors: ["Customer account was not found."] };

  const profile = resourceProfileForPlan(planName);
  const now = new Date();
  const renewalDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  data.tenants[tenantIndex] = {
    ...data.tenants[tenantIndex],
    plan: planName,
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit,
    monthlyAmount: monthlyAmountForPlan(planName),
    subscriptionStatus: planName === "Free" ? "trial" : "active",
    paymentStatus: planName === "Free" ? "free" : "pending",
    renewalDate,
    updatedAt: now.toISOString()
  };

  await writeDatabase(data);
  return { ok: true, tenant: data.tenants[tenantIndex] };
}

async function rotateCustomerWebhookSecret(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const loaded = await readDatabase();
  if (!loaded.available) {
    return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  }
  const data = loaded.data;
  data.tenants ||= [];
  const tenantIndex = data.tenants.findIndex((tenant) => tenant.id === session.tenantId);
  if (tenantIndex === -1) return { ok: false, status: 404, errors: ["Customer account was not found."] };

  const webhookSecret = randomBytes(24).toString("hex");
  data.tenants[tenantIndex] = {
    ...data.tenants[tenantIndex],
    webhookSecret,
    webhookSecretUpdatedAt: new Date().toISOString()
  };
  await writeDatabase(data);
  return { ok: true, webhookSecret };
}

function tenantWebhookSecret(data, tenantId) {
  if (!tenantId) return "";
  return (data.tenants || []).find((tenant) => tenant.id === tenantId)?.webhookSecret || "";
}

async function markCustomerAccountLogin(id) {
  try {
    const loaded = await readDatabase();
    if (!loaded.available) return;
    const account = (loaded.data.customerAccounts || []).find((item) => item.id === id);
    if (!account) return;
    account.lastLoginAt = new Date().toISOString();
    await writeDatabase(loaded.data);
  } catch {
    // Login telemetry should never block authentication.
  }
}

async function getCustomerAccountsSummary() {
  const loaded = await readDatabase();
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    accounts: (loaded.data.customerAccounts || []).map(publicCustomerAccount)
  };
}

function normalizeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function publicSetupRequest(request) {
  const normalizedConfig = normalizeContainerConfig(request.containerConfig || "");
  const gtmMatch = normalizedConfig.decoded.match(/(?:^|&)id=(GTM-[A-Z0-9]+)(?:&|$)/i);
  const previewMatch = normalizedConfig.decoded.match(/(?:^|&)preview=([^&]+)(?:&|$)/i);
  return {
    id: request.id,
    tenantId: request.tenantId,
    tenantName: request.tenantName,
    containerName: request.containerName || request.tenantName || request.tenantId,
    containerType: request.containerType || "sGTM",
    websiteUrl: request.websiteUrl,
    trackingDomain: request.trackingDomain,
    platform: request.platform,
    containerConfig: request.containerConfig ? "configured" : "",
    sgtmContainerId: gtmMatch ? gtmMatch[1].toUpperCase() : "",
    previewEnvironment: previewMatch ? decodeURIComponent(previewMatch[1]) : "",
    serverLocation: request.serverLocation || "Bangladesh BDIX",
    provisioningRequestId: request.provisioningRequestId || "",
    workerId: request.workerId || "",
    workerName: request.workerName || "",
    resourceLimits: request.resourceLimits || null,
    status: request.status,
    statusDetail: request.statusDetail || "",
    notes: request.notes || "",
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}

function validateCustomerSetupInput(input, session) {
  const tenantId = sanitizeId(session.role === "owner" ? input.tenantId || input.tenant_id || session.tenantId : session.tenantId);
  const tenantName = String(input.tenantName || input.tenant_name || tenantId).trim().slice(0, 120);
  const containerName = String(input.containerName || input.container_name || input.name || tenantName || tenantId).trim().slice(0, 120);
  const containerType = String(input.containerType || input.container_type || "sGTM").trim().slice(0, 40);
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl || input.website_url || input.siteUrl || input.site_url);
  const trackingDomain = String(input.trackingDomain || input.tracking_domain || input.serverDomain || input.server_domain || "").trim().toLowerCase();
  const platform = String(input.platform || "custom").trim().slice(0, 40);
  const normalizedContainerConfig = normalizeContainerConfig(input.containerConfig || input.container_config || "");
  const containerConfig = normalizedContainerConfig.value;
  const serverLocation = String(input.serverLocation || input.server_location || "Bangladesh BDIX").trim().slice(0, 80);
  const notes = String(input.notes || "").trim().slice(0, 1000);
  const errors = [];

  if (!tenantId) errors.push("Tenant ID is missing.");
  if (!containerName) errors.push("Container name is required.");
  if (!websiteUrl) errors.push("Enter a valid website URL.");
  if (!validDomain(trackingDomain)) errors.push("Enter a valid tracking subdomain, such as server.example.com.");
  if (!containerConfig) errors.push("Container Config is required. Copy it from Google Tag Manager server container settings.");
  if (containerConfig && !validContainerConfig(containerConfig, normalizedContainerConfig.decoded)) {
    errors.push("Container Config is not valid. Copy the full value from Google Tag Manager > Admin > Container Settings > Manually provision tagging server.");
  }

  return {
    errors,
    value: { tenantId, tenantName, containerName, containerType, websiteUrl, trackingDomain, platform, containerConfig, serverLocation, notes }
  };
}

async function addCustomerSetupRequest(input, session) {
  const validated = validateCustomerSetupInput(input, session);
  if (validated.errors.length) return { ok: false, errors: validated.errors };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  data.customerSetupRequests ||= [];
  data.tenants ||= [];
  data.provisioning ||= { requests: [] };
  ensureWorkerNodes(data);
  const now = new Date().toISOString();
  const tenantIndex = data.tenants.findIndex((tenant) => tenant.id === validated.value.tenantId);
  const existingTenant = tenantIndex === -1 ? null : data.tenants[tenantIndex];
  const planName = existingTenant?.plan || config.billingPlan || "Starter";
  const resourceLimits = resourceProfileForPlan(planName);
  if (existingTenant?.name && validated.value.tenantName === validated.value.tenantId) {
    validated.value.tenantName = existingTenant.name;
  }
  const request = {
    id: `setup_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    ...validated.value
  };

  const existingProvision = data.provisioning.requests.find((item) => item.sourceRequestId === request.id);
  if (!existingProvision) {
    const worker = selectWorkerNode(data, request.serverLocation);
    if (!worker) return { ok: false, errors: ["No healthy worker node has available capacity. Add a worker or increase worker capacity from Admin."] };
    const port = allocateProvisionPort(data.provisioning.requests, worker.id);
    if (!port) return { ok: false, errors: [`No available provisioning ports in ${config.provisionPortStart}-${config.provisionPortEnd}.`] };
    request.workerId = worker.id;
    request.workerName = worker.name;
    request.resourceLimits = resourceLimits;
    const provisionRequest = {
      id: `req_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
      source: "customer_container",
      sourceRequestId: request.id,
      tenantId: request.tenantId,
      websiteUrl: request.websiteUrl,
      serverLocation: request.serverLocation,
      status: "pending_launch",
      createdAt: now,
      updatedAt: now,
      workerId: worker.id,
      workerName: worker.name,
      workerRegion: worker.region,
      workerHost: worker.publicHost || worker.ip || "",
      port,
      autoAssignedPort: true,
      instanceName: sanitizeId(request.containerName || request.tenantName || request.tenantId),
      domain: request.trackingDomain,
      containerName: sanitizeId(`sgtm-${request.containerName || request.tenantId}`),
      ownerEmail: "",
      planName,
      requestLimit: resourceLimits.monthlyRequestLimit,
      resourceLimits,
      previewUrl: "",
      containerConfig: request.containerConfig,
      notes: `Customer-created container for ${request.websiteUrl}${request.notes ? `\n${request.notes}` : ""}`
    };
    provisionRequest.plan = provisioningPlan(provisionRequest);
    data.provisioning.requests.unshift(provisionRequest);
    data.provisioning.requests = data.provisioning.requests.slice(0, config.maxProvisioningRecords);
    request.provisioningRequestId = provisionRequest.id;
    await autoLaunchProvisioningRequest(data, provisionRequest);
    request.status = provisionRequest.status;
    request.updatedAt = provisionRequest.updatedAt;
  }
  data.customerSetupRequests.unshift(request);
  data.customerSetupRequests = data.customerSetupRequests.slice(0, config.maxCustomerSetupRecords);

  const tenantUpdate = {
    id: request.tenantId,
    name: request.tenantName,
    containerName: request.containerName,
    websiteUrl: request.websiteUrl,
    domain: request.trackingDomain,
    platform: request.platform,
    containerType: request.containerType,
    serverLocation: request.serverLocation,
    setupStatus: "requested",
    workerId: request.workerId,
    workerName: request.workerName,
    resourceLimits: request.resourceLimits,
    updatedAt: now
  };
  if (tenantIndex === -1) {
    data.tenants.push({
      ...tenantUpdate,
      plan: config.billingPlan,
      subscriptionStatus: "active",
      paymentStatus: "paid",
      requestLimit: resourceLimits.monthlyRequestLimit,
      containerLimit: resourceLimits.containerLimit,
      status: "setup_requested",
      source: "customer_setup",
      createdAt: now
    });
  } else {
    data.tenants[tenantIndex] = {
      ...data.tenants[tenantIndex],
      ...tenantUpdate
    };
  }

  await writeDatabase(data);
  return { ok: true, request: publicSetupRequest(request) };
}

async function getCustomerSetupSummary() {
  const loaded = await readDatabase();
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests: (loaded.data.customerSetupRequests || []).map(publicSetupRequest)
  };
}

function activeProvisioningRequests(requests = []) {
  return requests.filter((request) => !["deleted", "delete_requested"].includes(String(request.status || "")));
}

function isDeletedStatus(status) {
  return ["deleted", "delete_requested"].includes(String(status || "").toLowerCase());
}

function defaultWorkerNode() {
  return {
    id: sanitizeId(config.localWorkerId) || "local-bdix-1",
    name: config.localWorkerName,
    region: config.localWorkerRegion,
    ip: config.localWorkerIp,
    publicHost: config.localWorkerPublicHost,
    role: "local",
    status: "active",
    maxContainers: config.localWorkerMaxContainers,
    cpuCores: config.localWorkerCpuCores,
    memoryGb: config.localWorkerMemoryGb,
    diskGb: config.localWorkerDiskGb,
    notes: "Default worker for the current VPS. Add more workers from Admin as you scale.",
    createdAt: "",
    updatedAt: ""
  };
}

function ensureWorkerNodes(data) {
  data.workerNodes ||= [];
  if (!data.workerNodes.length) data.workerNodes.push(defaultWorkerNode());
  return data.workerNodes;
}

function publicWorkerNode(node, requests = []) {
  const activeRequests = activeProvisioningRequests(requests);
  const assigned = activeRequests.filter((request) => (request.workerId || config.localWorkerId) === node.id);
  const failed = assigned.filter((request) => String(request.status || "").includes("failed")).length;
  const dnsPending = assigned.filter((request) => request.status === "dns_pending").length;
  const live = assigned.filter((request) => ["live", "http_live"].includes(request.status)).length;
  const memoryReservedMb = assigned.reduce((total, request) => total + Number(request.resourceLimits?.memoryMb || 0), 0);
  const cpuReserved = assigned.reduce((total, request) => total + Number(request.resourceLimits?.cpuLimit || 0), 0);
  const maxContainers = Math.max(0, Number(node.maxContainers || 0));
  const capacityPercent = maxContainers ? Math.round((assigned.length / maxContainers) * 100) : 0;
  const health = node.status === "active" && (!maxContainers || assigned.length < maxContainers) ? "healthy" : node.status === "active" ? "full" : "offline";

  return {
    id: node.id,
    name: node.name || node.id,
    region: node.region || "Bangladesh BDIX",
    ip: node.ip || "",
    publicHost: node.publicHost || "",
    role: node.role || "remote",
    status: node.status || "active",
    maxContainers,
    cpuCores: Number(node.cpuCores || 0),
    memoryGb: Number(node.memoryGb || 0),
    diskGb: Number(node.diskGb || 0),
    notes: node.notes || "",
    currentContainers: assigned.length,
    liveContainers: live,
    failedContainers: failed,
    dnsPendingContainers: dnsPending,
    memoryReservedMb,
    cpuReserved,
    capacityPercent,
    health,
    createdAt: node.createdAt || "",
    updatedAt: node.updatedAt || ""
  };
}

function getWorkerSummaryFromData(data) {
  const nodes = ensureWorkerNodes(data);
  const requests = data.provisioning?.requests || [];
  const publicNodes = nodes.map((node) => publicWorkerNode(node, requests));
  const activeNodes = publicNodes.filter((node) => node.status === "active");
  return {
    available: true,
    nodes: publicNodes,
    metrics: {
      totalWorkers: publicNodes.length,
      activeWorkers: activeNodes.length,
      totalCapacity: publicNodes.reduce((total, node) => total + Number(node.maxContainers || 0), 0),
      currentContainers: publicNodes.reduce((total, node) => total + Number(node.currentContainers || 0), 0),
      failedContainers: publicNodes.reduce((total, node) => total + Number(node.failedContainers || 0), 0),
      dnsPendingContainers: publicNodes.reduce((total, node) => total + Number(node.dnsPendingContainers || 0), 0)
    }
  };
}

async function getWorkerSummary() {
  const loaded = await readDatabase();
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    ...getWorkerSummaryFromData(loaded.data)
  };
}

function selectWorkerNode(data, preferredRegion = "") {
  const requests = data.provisioning?.requests || [];
  const nodes = getWorkerSummaryFromData(data).nodes.filter((node) => node.status === "active" && node.health !== "full");
  if (!nodes.length) return null;
  const preferred = preferredRegion
    ? nodes.filter((node) => node.region.toLowerCase() === String(preferredRegion).toLowerCase())
    : [];
  return (preferred.length ? preferred : nodes)
    .sort((a, b) => a.capacityPercent - b.capacityPercent || a.currentContainers - b.currentContainers || a.name.localeCompare(b.name))[0] || null;
}

function findWorkerNode(data, id) {
  return ensureWorkerNodes(data).find((node) => node.id === id) || ensureWorkerNodes(data)[0] || defaultWorkerNode();
}

function validateWorkerNodeInput(input) {
  const id = sanitizeId(input.id || input.workerId || input.name || "");
  const name = String(input.name || id).trim().slice(0, 120);
  const region = String(input.region || "Bangladesh BDIX").trim().slice(0, 80);
  const ip = String(input.ip || "").trim();
  const publicHost = String(input.publicHost || input.public_host || "").trim().toLowerCase();
  const role = String(input.role || "remote").trim().toLowerCase() === "local" ? "local" : "remote";
  const status = String(input.status || "active").trim().toLowerCase() === "maintenance" ? "maintenance" : "active";
  const maxContainers = Number(input.maxContainers || input.max_containers || 200);
  const cpuCores = Number(input.cpuCores || input.cpu_cores || 16);
  const memoryGb = Number(input.memoryGb || input.memory_gb || 32);
  const diskGb = Number(input.diskGb || input.disk_gb || 400);
  const notes = String(input.notes || "").trim().slice(0, 1000);
  const errors = [];

  if (!id) errors.push("Worker ID is required.");
  if (!name) errors.push("Worker name is required.");
  if (publicHost && !validDomain(publicHost)) errors.push("Public host must be a valid hostname.");
  if (!Number.isFinite(maxContainers) || maxContainers <= 0) errors.push("Max containers must be a positive number.");
  if (!Number.isFinite(cpuCores) || cpuCores <= 0) errors.push("CPU cores must be a positive number.");
  if (!Number.isFinite(memoryGb) || memoryGb <= 0) errors.push("Memory GB must be a positive number.");
  if (!Number.isFinite(diskGb) || diskGb <= 0) errors.push("Disk GB must be a positive number.");

  return {
    errors,
    value: { id, name, region, ip, publicHost, role, status, maxContainers, cpuCores, memoryGb, diskGb, notes }
  };
}

async function addWorkerNode(input) {
  const validated = validateWorkerNodeInput(input);
  if (validated.errors.length) return { ok: false, errors: validated.errors };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  ensureWorkerNodes(data);
  const now = new Date().toISOString();
  const index = data.workerNodes.findIndex((node) => node.id === validated.value.id);
  const node = {
    ...(index === -1 ? {} : data.workerNodes[index]),
    ...validated.value,
    createdAt: index === -1 ? now : data.workerNodes[index].createdAt || now,
    updatedAt: now
  };
  if (index === -1) data.workerNodes.push(node);
  else data.workerNodes[index] = node;
  await writeDatabase(data);
  return { ok: true, worker: publicWorkerNode(node, data.provisioning?.requests || []) };
}

function monthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

function orderBreakdown(orders, key) {
  const counts = new Map();
  for (const order of orders) {
    const label = String(order[key] || "unknown");
    const current = counts.get(label) || { name: label, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += Number(order.amount || 0);
    counts.set(label, current);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

const planMonthlyAmounts = {
  Free: 0,
  Starter: 900,
  Growth: 2500,
  Pro: 2500,
  Enterprise: 15000,
  Agency: 7500
};

const planResourceProfiles = {
  Free:       { memoryMb: 512,  cpuLimit: "0.50", monthlyRequestLimit: 15000,    containerLimit: 1  },
  Starter:    { memoryMb: 512,  cpuLimit: "0.50", monthlyRequestLimit: 300000,   containerLimit: 1  },
  Growth:     { memoryMb: 768,  cpuLimit: "0.75", monthlyRequestLimit: 1500000,  containerLimit: 2  },
  Pro:        { memoryMb: 768,  cpuLimit: "0.75", monthlyRequestLimit: 1500000,  containerLimit: 2  },
  Agency:     { memoryMb: 1536, cpuLimit: "1.50", monthlyRequestLimit: 8000000,  containerLimit: 10 },
  Enterprise: { memoryMb: 2048, cpuLimit: "2.00", monthlyRequestLimit: 20000000, containerLimit: 50 },
  Customer:   { memoryMb: 512,  cpuLimit: "0.50", monthlyRequestLimit: 300000,   containerLimit: 1  }
};

function monthlyAmountForPlan(planName) {
  return planMonthlyAmounts[String(planName || "").trim()] || 0;
}

function resourceProfileForPlan(planName, overrides = {}) {
  const profile = planResourceProfiles[String(planName || "").trim()] || planResourceProfiles.Customer;
  const memoryMb = Number(overrides.memoryMb || overrides.memory_mb || profile.memoryMb || config.defaultContainerMemoryMb);
  const monthlyRequestLimit = Number(overrides.requestLimit || overrides.request_limit || overrides.monthlyRequestLimit || profile.monthlyRequestLimit || config.monthlyRequestLimit);
  const containerLimit = Number(overrides.containerLimit || overrides.container_limit || profile.containerLimit || config.monthlyContainerLimit);
  return {
    memoryMb: Number.isFinite(memoryMb) && memoryMb > 0 ? memoryMb : config.defaultContainerMemoryMb,
    cpuLimit: String(overrides.cpuLimit || overrides.cpu_limit || profile.cpuLimit || config.defaultContainerCpuLimit),
    monthlyRequestLimit: Number.isFinite(monthlyRequestLimit) && monthlyRequestLimit > 0 ? monthlyRequestLimit : config.monthlyRequestLimit,
    containerLimit: Number.isFinite(containerLimit) && containerLimit > 0 ? containerLimit : config.monthlyContainerLimit
  };
}

function normalizeLifecycleStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["trial", "active", "cancelled", "canceled", "overdue", "expired"].includes(value)) {
    return value === "canceled" ? "cancelled" : value;
  }
  if (value.includes("pending") || value.includes("prepared")) return "pending";
  if (value.includes("active") || value.includes("healthy")) return "active";
  if (value.includes("attention") || value.includes("warning")) return "attention";
  return value || "unknown";
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function customerRequestCount(customer, requestSummary, { soleCustomer = false } = {}) {
  const hostRows = requestSummary?.hosts || [];
  const domain = normalizeHost(customer.domain);
  // No host data in log (default combined format) → cannot separate tenants. Treat the
  // environment tenant, or the only customer on a single-VPS setup, as owner of all requests.
  const hasHostInfo = hostRows.some((host) => {
    const name = normalizeHost(host.name);
    return name && name !== "unknown host";
  });
  const sharedFallback = (customer.source === "environment" || soleCustomer) ? Number(requestSummary?.count || 0) : 0;
  if (!domain || !hasHostInfo) return sharedFallback;

  const count = hostRows
    .filter((host) => {
      const name = normalizeHost(host.name);
      return name === domain || name.endsWith(`.${domain}`) || domain.endsWith(`.${name}`);
    })
    .reduce((total, host) => total + Number(host.count || 0), 0);

  return count || sharedFallback;
}

function customerContainerHealth(customer, docker) {
  if (!docker?.available) return { total: 0, running: 0, unhealthy: 0 };
  const terms = [
    customer.id,
    customer.name,
    customer.domain,
    normalizeHost(customer.domain).split(".")[0]
  ]
    .map((item) => sanitizeId(item))
    .filter(Boolean);

  const matched = (docker.containers || []).filter((container) => {
    const haystack = sanitizeId(`${container.name || ""}-${container.image || ""}`);
    return terms.some((term) => term && haystack.includes(term));
  });
  const containers = matched.length ? matched : customer.source === "environment" ? (docker.containers || []) : [];
  return {
    total: containers.length,
    running: containers.filter((container) => container.state === "running").length,
    unhealthy: containers.filter((container) => container.health === "unhealthy").length
  };
}

function isPastDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date < new Date();
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function billingPeriodForTenant(tenant, setupRequests = []) {
  const now = new Date();
  const renewal = validDate(tenant?.renewalDate);
  if (renewal) {
    const start = addDays(renewal, -30);
    return {
      start,
      end: renewal > now ? now : renewal,
      renewal,
      label: `${localDateKey(start)} to ${localDateKey(renewal)}`
    };
  }

  const createdCandidates = [
    tenant?.createdAt,
    tenant?.signupAt,
    ...(setupRequests || []).map((request) => request.createdAt)
  ]
    .map(validDate)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const start = createdCandidates[0] || addDays(now, -30);
  const end = addDays(start, 30);
  return {
    start,
    end: end > now ? now : end,
    renewal: end,
    label: `${localDateKey(start)} to ${localDateKey(end)}`
  };
}

function hasNumericValue(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function getTenantContainers(tenantId, tenant = null, setupRequests = [], provisioningRequests = []) {
  const requests = setupRequests || [];
  const provisioning = provisioningRequests || [];
  const provisioningBySource = new Map(provisioning.filter((request) => request.sourceRequestId).map((request) => [request.sourceRequestId, request]));
  const setupContainers = requests
    .filter((request) => request.tenantId === tenantId && !isDeletedStatus(request.status))
    .map((request) => {
      const provision = provisioningBySource.get(request.id);
      return {
        id: request.id,
        provisioningRequestId: provision?.id || request.provisioningRequestId || "",
        name: request.containerName || tenant?.containerName || tenant?.name || tenantId,
        type: request.containerType || "sGTM",
        websiteUrl: request.websiteUrl || tenant?.websiteUrl || "",
        domain: request.trackingDomain || tenant?.domain || "",
        status: provision?.status || request.status || "requested",
        serverLocation: request.serverLocation || "Bangladesh BDIX",
        workerName: provision?.workerName || request.workerName || "",
        resourceLimits: provision?.resourceLimits || request.resourceLimits || null,
        createdAt: request.createdAt || "",
        source: "customer"
      };
    });
  const provisioningContainers = provisioning
    .filter((request) => !request.sourceRequestId && request.tenantId === tenantId)
    .map((request) => ({
      id: request.id,
      name: request.instanceName,
      type: "sGTM",
      websiteUrl: request.websiteUrl || "",
      domain: request.domain,
      status: request.status,
      serverLocation: request.serverLocation || "Bangladesh BDIX",
      workerName: request.workerName || "",
      resourceLimits: request.resourceLimits || null,
      createdAt: request.createdAt || "",
      source: "provisioning"
    }));
  const merged = [...setupContainers, ...provisioningContainers];
  return merged.filter((container, index, all) =>
    all.findIndex((item) => item.domain === container.domain && item.name === container.name) === index
  );
}

function buildOwnerDashboard({ customers, docker, ssl, orders, requestSummary, usage, reconciliation, customerSetup, provisioning, workers, tenantUsage = {} }) {
  const soleCustomer = (customers.tenants || []).length === 1;
  const enrichedCustomers = (customers.tenants || []).map((customer) => {
    const customerContainers = getTenantContainers(customer.id, customer, customerSetup?.requests || [], provisioning?.requests || []);
    const plan = customer.plan || config.billingPlan;
    const requestLimit = Number(customer.requestLimit || config.monthlyRequestLimit || 0);
    const requestsToday = customerRequestCount(customer, requestSummary, { soleCustomer });
    const periodUsage = tenantUsage[customer.id] || null;
    const requestsMonth = Number(
      customer.requestsMonth ??
      periodUsage?.requestsMonth ??
      (customer.source === "environment" ? usage.requestsMonth : requestsToday)
    );
    const usagePercent = requestLimit ? Math.min(100, Math.round((requestsMonth / requestLimit) * 1000) / 10) : 0;
    const containers = customerContainerHealth(customer, docker);
    const subscriptionStatus = normalizeLifecycleStatus(customer.subscriptionStatus || customer.status || "active");
    const paymentStatus = normalizeLifecycleStatus(customer.paymentStatus || "paid");
    const renewalDate = customer.renewalDate || "";
    const expired = isPastDate(renewalDate) && ["active", "trial"].includes(subscriptionStatus);
    const unpaid = ["unpaid", "overdue", "expired"].includes(paymentStatus) || ["overdue", "expired"].includes(subscriptionStatus) || expired;
    const isDefaultCustomer = customer.source === "environment";
    const brokenPurchaseTracking = isDefaultCustomer && ["undertracked", "overtracked", "waiting"].includes(reconciliation.status);
    const noTrackingToday = ["active", "trial"].includes(subscriptionStatus) && requestsToday === 0;

    return {
      ...customer,
      plan,
      subscriptionStatus,
      paymentStatus: unpaid && paymentStatus === "paid" ? "expired" : paymentStatus,
      renewalDate,
      monthlyAmount: Number(customer.monthlyAmount || monthlyAmountForPlan(plan)),
      customerContainers,
      requestedContainers: customerContainers.filter((container) => container.status === "requested").length,
      requestsToday,
      requestsMonth,
      usagePeriod: periodUsage?.period || usage.period || "",
      requestLimit,
      usagePercent,
      usageStatus: requestLimit && usagePercent >= 100 ? "over_limit" : requestLimit && usagePercent >= 80 ? "warning" : "healthy",
      containers,
      sslDaysRemaining: isDefaultCustomer ? customer.sslDaysRemaining : customer.sslDaysRemaining ?? null,
      trackingStatus: brokenPurchaseTracking ? "purchase_attention" : noTrackingToday ? "no_tracking" : "healthy",
      brokenPurchaseTracking,
      noTrackingToday,
      unpaid,
      expired,
      ordersToday: isDefaultCustomer ? Number(orders.today?.count || 0) : Number(customer.ordersToday || 0),
      purchaseCoverage: isDefaultCustomer ? Number(reconciliation.coverage || 0) : null
    };
  });

  const lifecycleCounts = enrichedCustomers.reduce((counts, customer) => {
    const key = customer.subscriptionStatus || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const payingCustomers = enrichedCustomers.filter((customer) => ["active", "trial"].includes(customer.subscriptionStatus) && !customer.unpaid);
  const mrr = payingCustomers.reduce((total, customer) => total + Number(customer.monthlyAmount || 0), 0);
  const unpaidCustomers = enrichedCustomers.filter((customer) => customer.unpaid);
  const noTrackingCustomers = enrichedCustomers.filter((customer) => customer.noTrackingToday);
  const brokenPurchaseCustomers = enrichedCustomers.filter((customer) => customer.brokenPurchaseTracking);
  const unhealthyCustomers = enrichedCustomers.filter((customer) => customer.containers.unhealthy > 0);
  const sslAttention = enrichedCustomers.filter((customer) => hasNumericValue(customer.sslDaysRemaining) && Number(customer.sslDaysRemaining) <= 14);
  const totalCustomerContainers = enrichedCustomers.reduce((total, customer) => total + Number(customer.customerContainers?.length || 0), 0);
  const pendingCustomerContainers = enrichedCustomers.reduce((total, customer) =>
    total + (customer.customerContainers || []).filter((container) => ["requested", "queued", "pending_launch", "worker_assigned"].includes(container.status)).length, 0
  );
  const workerCapacityPercent = workers?.metrics?.totalCapacity
    ? Math.round((Number(workers.metrics.currentContainers || 0) / Number(workers.metrics.totalCapacity || 1)) * 100)
    : 0;

  const issues = [
    {
      label: "Unpaid or expired subscriptions",
      value: unpaidCustomers.length ? unpaidCustomers.map((customer) => customer.name).join(", ") : "None",
      status: unpaidCustomers.length ? "warning" : "healthy"
    },
    {
      label: "Customers with no tracking today",
      value: noTrackingCustomers.length ? noTrackingCustomers.map((customer) => customer.name).join(", ") : "None",
      status: noTrackingCustomers.length ? "warning" : "healthy"
    },
    {
      label: "Broken purchase tracking",
      value: brokenPurchaseCustomers.length ? brokenPurchaseCustomers.map((customer) => customer.name).join(", ") : "None",
      status: brokenPurchaseCustomers.length ? "warning" : "healthy"
    },
    {
      label: "Unhealthy containers",
      value: unhealthyCustomers.length ? unhealthyCustomers.map((customer) => customer.name).join(", ") : "None",
      status: unhealthyCustomers.length ? "error" : "healthy"
    },
    {
      label: "SSL expiring in 14 days",
      value: sslAttention.length ? sslAttention.map((customer) => `${customer.name}: ${customer.sslDaysRemaining}d`).join(", ") : "None",
      status: sslAttention.length ? "warning" : "healthy"
    }
  ];

  return {
    currency: "BDT",
    metrics: {
      totalCustomers: enrichedCustomers.length,
      activeCustomers: lifecycleCounts.active || 0,
      trialCustomers: lifecycleCounts.trial || 0,
      pendingCustomers: (lifecycleCounts.pending || 0) + (customers.queued || 0),
      cancelledCustomers: lifecycleCounts.cancelled || 0,
      overdueCustomers: unpaidCustomers.length,
      healthySubscriptions: payingCustomers.length,
      mrr,
      totalCustomerContainers,
      pendingCustomerContainers,
      requestsToday: enrichedCustomers.reduce((total, customer) => total + Number(customer.requestsToday || 0), 0),
      requestsMonth: enrichedCustomers.reduce((total, customer) => total + Number(customer.requestsMonth || 0), 0),
      unhealthyCustomers: unhealthyCustomers.length,
      sslAttention: sslAttention.length,
      noTrackingToday: noTrackingCustomers.length,
      brokenPurchaseTracking: brokenPurchaseCustomers.length,
      activeWorkers: workers?.metrics?.activeWorkers || 0,
      workerCapacityPercent: workers?.metrics?.currentContainers && workerCapacityPercent === 0 ? 1 : workerCapacityPercent,
      failedLaunches: workers?.metrics?.failedContainers || 0,
      dnsPendingContainers: workers?.metrics?.dnsPendingContainers || 0
    },
    lifecycleCounts,
    issues,
    customers: enrichedCustomers,
    infrastructure: {
      dockerAvailable: Boolean(docker.available),
      totalContainers: docker.totals?.total || 0,
      runningContainers: docker.totals?.running || 0,
      unhealthyContainers: docker.totals?.unhealthy || 0,
      sslAvailable: Boolean(ssl.available),
      sslDaysRemaining: ssl.available ? ssl.daysRemaining : null,
      workers: workers?.nodes || [],
      workerMetrics: workers?.metrics || {}
    }
  };
}

async function getCustomerCatalog({ docker, ssl, orders }) {
  const loaded = await readDatabase();
  return getCustomerCatalogFromData(loaded.data, { docker, ssl, orders, available: loaded.available });
}

function getCustomerCatalogFromData(data, { docker, ssl, orders, available = true }) {
  const provisioned = data.provisioning?.requests || [];
  const storedTenants = data.tenants || [];
  const defaultDomain = config.tenantDomain || config.trackingHosts[0] || config.sslDomain || inferHostFromCertPath(config.sslCertPath) || "";
  const defaultTenant = {
    id: config.tenantId,
    name: config.tenantName,
    domain: defaultDomain,
    plan: config.billingPlan,
    subscriptionStatus: config.subscriptionStatus,
    paymentStatus: config.paymentStatus,
    renewalDate: config.renewalDate,
    monthlyAmount: config.monthlyAmount || monthlyAmountForPlan(config.billingPlan),
    status: docker.available && (!docker.totals?.unhealthy) ? "active" : "attention",
    requestLimit: config.monthlyRequestLimit,
    containerLimit: config.monthlyContainerLimit,
    containers: docker.totals?.total || 0,
    ordersToday: orders.today?.count || 0,
    sslDaysRemaining: ssl.available ? ssl.daysRemaining : null,
    source: "environment"
  };

  const queuedTenants = provisioned.filter((request) => request.source !== "customer_container").map((request) => ({
    id: request.id,
    name: request.instanceName,
    domain: request.domain,
    plan: request.planName || "Pending",
    subscriptionStatus: "pending",
    paymentStatus: "pending",
    renewalDate: "",
    monthlyAmount: monthlyAmountForPlan(request.planName),
    status: request.status,
    requestLimit: request.requestLimit || config.monthlyRequestLimit,
    containerLimit: 1,
    containers: 0,
    ordersToday: 0,
    sslDaysRemaining: null,
    source: "provisioning"
  }));

  const tenants = [
    defaultTenant,
    ...storedTenants,
    ...queuedTenants
  ].filter((tenant, index, all) => all.findIndex((item) => item.id === tenant.id) === index);

  return {
    available,
    tenants,
    active: tenants.filter((tenant) => tenant.status === "active").length,
    queued: tenants.filter((tenant) => String(tenant.status || "").includes("pending") || String(tenant.status || "").includes("prepared")).length
  };
}

function getUsageSummary({ requestSummary, history }) {
  const currentMonth = monthKey();
  const dailyRows = history?.daily || [];
  const persistedMonthly = dailyRows
    .filter((row) => String(row.date || "").startsWith(currentMonth))
    .reduce((total, row) => total + Number(row.total || 0), 0);
  const todayPersisted = dailyRows.find((row) => row.date === localDateKey());
  const todayRequests = Number(requestSummary?.count || 0);
  const monthlyRequests = persistedMonthly + (todayPersisted ? 0 : todayRequests);
  const limit = Math.max(0, Number(config.monthlyRequestLimit || 0));
  const percent = limit ? Math.round((monthlyRequests / limit) * 100) : 0;
  return {
    plan: config.billingPlan,
    period: currentMonth,
    requestLimit: limit,
    requestsToday: todayRequests,
    requestsMonth: monthlyRequests,
    usagePercent: percent,
    status: !limit ? "unmetered" : percent >= 100 ? "over_limit" : percent >= 80 ? "warning" : "healthy",
    containerLimit: config.monthlyContainerLimit
  };
}

function baseCustomerUsageSummary() {
  const profile = resourceProfileForPlan(config.billingPlan);
  const limit = Number(config.monthlyRequestLimit || profile.monthlyRequestLimit || 0);
  return {
    plan: config.billingPlan,
    period: "Current billing period",
    requestLimit: limit,
    requestsToday: 0,
    requestsMonth: 0,
    usagePercent: 0,
    status: limit ? "healthy" : "unmetered",
    containerLimit: Number(config.monthlyContainerLimit || profile.containerLimit || 1),
    subscriptionStatus: config.subscriptionStatus,
    paymentStatus: config.paymentStatus,
    renewalDate: config.renewalDate,
    monthlyAmount: config.monthlyAmount || monthlyAmountForPlan(config.billingPlan)
  };
}

function getReconciliationSummary({ requestSummary, orders }) {
  const storeOrders = Number(orders.today?.count || 0);
  const tracked = requestSummary?.purchases || {};
  const trackedUnique = Number(tracked.uniqueCount || 0);
  const trackedHits = Number(tracked.rawCount || 0);
  const coverage = storeOrders ? Math.round((trackedUnique / storeOrders) * 100) : (trackedUnique ? 100 : 0);
  const missing = Math.max(0, storeOrders - trackedUnique);
  const extraTracked = Math.max(0, trackedUnique - storeOrders);
  return {
    available: Boolean(requestSummary?.available || orders.available),
    storeOrders,
    trackedUnique,
    trackedHits,
    missing,
    extraTracked,
    coverage,
    duplicateHits: Math.max(0, trackedHits - trackedUnique),
    status: !storeOrders && !trackedUnique ? "waiting" : missing ? "undertracked" : extraTracked ? "overtracked" : "healthy",
    explanation: storeOrders
      ? "Store orders come from the ecommerce webhook. Tracked purchases come from SGTM logs."
      : "Waiting for store order webhook data."
  };
}

function getIntegrationSummary({ orders, requestSummary }) {
  const purchaseRows = requestSummary?.recentEvents?.filter((item) => item.eventName === "Purchase") || [];
  const hasValue = purchaseRows.some((item) => item.value && item.currency);
  const hasId = purchaseRows.some((item) => item.transactionId || item.eventId);
  return {
    orderWebhook: {
      enabled: Boolean(config.orderWebhookSecret),
      status: orders.today?.count ? "healthy" : config.orderWebhookSecret ? "waiting" : "missing",
      lastOrder: orders.today?.latest || null,
      endpoint: "/api/orders/webhook"
    },
    shopify: {
      status: "planned",
      endpoint: "/api/orders/webhook",
      fields: ["order_id", "total_price", "currency", "created_at", "order_type"]
    },
    woocommerce: {
      status: config.orderWebhookSecret ? "ready" : "missing",
      endpoint: "/api/orders/woocommerce",
      fields: ["id", "total", "currency", "date_created_gmt", "created_via", "status"]
    },
    metaCapi: {
      status: purchaseRows.length ? "detected" : "waiting",
      checks: [
        { label: "Purchase event", status: purchaseRows.length ? "healthy" : "warning" },
        { label: "Value and currency", status: !purchaseRows.length || hasValue ? "healthy" : "warning" },
        { label: "Event or transaction ID", status: !purchaseRows.length || hasId ? "healthy" : "warning" }
      ]
    }
  };
}

function getSetupWizard({ customers, provisioning, integrations, ssl, requestSummary }) {
  const hasCustomer = customers.tenants.length > 0;
  const hasProvisioning = (provisioning.requests || []).length > 0;
  const hasDns = Boolean(config.provisionDnsTarget || config.publicBaseUrl || config.trackingHosts.length);
  const hasSsl = Boolean(ssl.available);
  const hasTraffic = Boolean(requestSummary.available && requestSummary.count);
  const hasOrders = integrations.orderWebhook.status === "healthy";
  const steps = [
    { key: "account", title: "Create customer workspace", status: hasCustomer ? "complete" : "todo", detail: "Customer and tenant record exists." },
    { key: "provision", title: "Provision SGTM instance", status: hasProvisioning ? "complete" : "todo", detail: "Generate Docker, Nginx, log, and SSL plan." },
    { key: "dns", title: "Verify DNS", status: hasDns ? "complete" : "todo", detail: config.provisionDnsTarget || "Set PROVISION_DNS_TARGET." },
    { key: "ssl", title: "Verify SSL", status: hasSsl ? "complete" : "todo", detail: hasSsl ? `${ssl.daysRemaining} days remaining` : "Configure SSL_CERT_PATH or SSL_DOMAIN." },
    { key: "gtm", title: "Validate GTM/SGTM traffic", status: hasTraffic ? "complete" : "todo", detail: hasTraffic ? `${requestSummary.count} tracking requests today` : "Waiting for SGTM events." },
    { key: "orders", title: "Connect order webhook", status: hasOrders ? "complete" : "todo", detail: hasOrders ? "Store orders received." : "Send real ecommerce orders to /api/orders/webhook." }
  ];
  return {
    complete: steps.filter((step) => step.status === "complete").length,
    total: steps.length,
    steps
  };
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

function normalizeContainerConfig(value) {
  const compact = String(value || "").replace(/\s+/g, "").trim();
  if (!compact) return { value: "", decoded: "" };
  const padding = "=".repeat((4 - (compact.length % 4)) % 4);
  const padded = `${compact}${padding}`;
  let decoded = "";
  try {
    decoded = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    decoded = "";
  }
  return { value: padded, decoded };
}

function validContainerConfig(value, decoded = "") {
  return (
    /^[A-Za-z0-9+/_-]+={0,2}$/.test(String(value || "")) &&
    /(?:^|&)id=GTM-[A-Z0-9]+(?:&|$)/i.test(decoded) &&
    /(?:^|&)auth=[^&]+/i.test(decoded)
  );
}

function validateProvisioningRequest(input) {
  const errors = [];
  const domain = String(input.domain || "").trim().toLowerCase();
  const instanceName = sanitizeId(input.instanceName || domain.split(".")[0] || "sgtm");
  const normalizedContainerConfig = normalizeContainerConfig(input.containerConfig || "");
  const containerConfig = normalizedContainerConfig.value;
  const previewUrl = String(input.previewUrl || "").trim();
  const ownerEmail = String(input.ownerEmail || "").trim();
  const planName = String(input.planName || config.billingPlan || "Starter").trim();
  const requestLimit = Number(input.requestLimit || config.monthlyRequestLimit);
  const resourceLimits = resourceProfileForPlan(planName, {
    requestLimit,
    memoryMb: input.memoryMb || input.memory_mb,
    cpuLimit: input.cpuLimit || input.cpu_limit,
    containerLimit: input.containerLimit || input.container_limit
  });

  if (!validDomain(domain)) errors.push("Enter a valid tracking subdomain.");
  if (!instanceName) errors.push("Enter an instance name.");
  if (!containerConfig) errors.push("Container config is required before launch.");
  if (containerConfig && !validContainerConfig(containerConfig, normalizedContainerConfig.decoded)) {
    errors.push("Container Config is not valid. Copy the full value from Google Tag Manager > Admin > Container Settings > Manually provision tagging server.");
  }
  if (previewUrl && !/^https?:\/\//i.test(previewUrl)) errors.push("Preview URL must start with http:// or https://.");
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) errors.push("Owner email is not valid.");
  if (!Number.isFinite(requestLimit) || requestLimit <= 0) errors.push("Monthly request limit must be a positive number.");

  return {
    errors,
    value: {
      instanceName,
      domain,
      containerName: sanitizeId(`sgtm-${instanceName}`),
      ownerEmail,
      planName,
      requestLimit: resourceLimits.monthlyRequestLimit,
      resourceLimits,
      previewUrl,
      containerConfig,
      notes: String(input.notes || "").trim().slice(0, 1000)
    }
  };
}

function allocateProvisionPort(requests, workerId = "") {
  const used = new Set(
    (requests || [])
      .filter((request) => !workerId || (request.workerId || config.localWorkerId) === workerId)
      .map((request) => Number(request.port))
      .filter((port) => Number.isInteger(port))
  );
  for (let port = config.provisionPortStart; port <= config.provisionPortEnd; port += 1) {
    if (!used.has(port)) return port;
  }
  return null;
}

function provisioningPlan(request) {
  const instanceDir = join(config.provisionOutputDir, request.instanceName);
  const safeEnvPath = join(instanceDir, ".env");
  const composePath = join(instanceDir, "docker-compose.yml");
  const nginxPath = join(instanceDir, `${request.domain}.conf`);
  const accessLog = `/var/log/nginx/${request.instanceName}-sgtm-access.log`;
  const errorLog = `/var/log/nginx/${request.instanceName}-sgtm-error.log`;
  const previewLine = request.previewUrl ? `PREVIEW_SERVER_URL=${request.previewUrl}\n` : "";
  const memoryMb = Number(request.resourceLimits?.memoryMb || config.defaultContainerMemoryMb);
  const cpuLimit = String(request.resourceLimits?.cpuLimit || config.defaultContainerCpuLimit);
  const accessLogLine = config.nginxLogFormat
    ? `    access_log ${accessLog} ${config.nginxLogFormat};`
    : `    access_log ${accessLog};`;
  const workerSummary = request.workerName
    ? `Assigned to ${request.workerName}${request.workerRegion ? ` (${request.workerRegion})` : ""}`
    : "Assigned to the local worker";

  return {
    summary: [
      `Auto-assigned ${request.containerName} to 127.0.0.1:${request.port}`,
      workerSummary,
      `Resource limit ${memoryMb}MB RAM / ${cpuLimit} CPU`,
      `Proxy ${request.domain} to the container through Nginx`,
      `Issue SSL with certbot after DNS points to the VPS`,
      "Launch runner is not enabled yet, so this plan is queued for admin execution"
    ],
    instanceDir,
    composePath,
    nginxPath,
    accessLog,
    errorLog,
    envPath: safeEnvPath,
    env: `CONTAINER_CONFIG=${request.containerConfig}\n${previewLine}RUN_AS_PREVIEW_SERVER=false\nPORT=8080\n`,
    dockerCompose: `services:\n  ${request.containerName}:\n    image: gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable\n    container_name: ${request.containerName}\n    restart: unless-stopped\n    mem_limit: ${memoryMb}m\n    cpus: "${cpuLimit}"\n    env_file:\n      - ${safeEnvPath}\n    ports:\n      - "127.0.0.1:${request.port}:8080"\n`,
    nginx: buildNginxConfig({ domain: request.domain, port: request.port, accessLogLine, errorLog }),
    commands: [
      `sudo cp ${nginxPath} /etc/nginx/sites-available/${request.domain}`,
      `sudo ln -s /etc/nginx/sites-available/${request.domain} /etc/nginx/sites-enabled/${request.domain}`,
      "sudo nginx -t",
      "sudo systemctl reload nginx",
      `sudo certbot --nginx -d ${request.domain}`,
      `docker compose -f ${composePath} up -d`,
      `docker-compose -f ${composePath} up -d`,
      `curl -I https://${request.domain}/healthy`
    ],
    checks: [
      { label: "DNS", value: config.provisionDnsTarget ? `${request.domain} CNAME/A to ${config.provisionDnsTarget}` : `${request.domain} must point to the target VPS`, status: "pending" },
      { label: "Worker", value: workerSummary, status: request.workerId ? "prepared" : "pending" },
      { label: "Resources", value: `${memoryMb}MB RAM / ${cpuLimit} CPU / ${Number(request.requestLimit || 0).toLocaleString()} requests`, status: "prepared" },
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
  ensureWorkerNodes(data);
  const worker = selectWorkerNode(data, validated.value.serverLocation || "");
  if (!worker) return { ok: false, errors: ["No healthy worker node has available capacity. Add a worker or increase worker capacity from Admin."] };
  const port = allocateProvisionPort(data.provisioning.requests, worker.id);
  if (!port) {
    return { ok: false, errors: [`No available provisioning ports in ${config.provisionPortStart}-${config.provisionPortEnd}.`] };
  }
  const request = {
    id: `req_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    status: "pending_launch",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workerId: worker.id,
    workerName: worker.name,
    workerRegion: worker.region,
    workerHost: worker.publicHost || worker.ip || "",
    port,
    autoAssignedPort: true,
    ...validated.value
  };
  request.plan = provisioningPlan(request);
  data.provisioning.requests.unshift(request);
  data.provisioning.requests = data.provisioning.requests.slice(0, config.maxProvisioningRecords);
  await autoLaunchProvisioningRequest(data, request);
  await writeDatabase(data);
  return { ok: true, request };
}

async function writeProvisioningFiles(request) {
  request.plan = provisioningPlan(request);
  const plan = request.plan;
  await mkdir(plan.instanceDir, { recursive: true });
  await writeFile(plan.envPath, plan.env, { encoding: "utf8", mode: 0o600 });
  await writeFile(plan.composePath, plan.dockerCompose, "utf8");
  await writeFile(plan.nginxPath, plan.nginx, "utf8");
  request.preparedAt = new Date().toISOString();
  request.preparedFiles = {
    envPath: plan.envPath,
    composePath: plan.composePath,
    nginxPath: plan.nginxPath
  };
  request.plan.checks = request.plan.checks.map((check) =>
    check.label === "Port"
      ? { ...check, status: "prepared" }
      : check
  );
  return request;
}

async function prepareProvisioningFiles(id) {
  const loaded = await readDatabase();
  if (!loaded.available) {
    return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  }

  const data = loaded.data;
  const requests = data.provisioning?.requests || [];
  const request = requests.find((item) => item.id === id);
  if (!request) return { ok: false, errors: ["Provisioning request was not found."] };

  await writeProvisioningFiles(request);
  request.status = "files_prepared";
  request.updatedAt = new Date().toISOString();
  await writeDatabase(data);
  return { ok: true, request };
}

function recordLaunchStep(request, label, result) {
  request.launchLog ||= [];
  request.launchLog.push({
    label,
    ok: Boolean(result.ok),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || "",
    at: new Date().toISOString()
  });
}

function certbotArgs(domain) {
  const args = ["--nginx", "-d", domain, "--non-interactive", "--agree-tos", "--redirect"];
  if (config.autoLaunchCertbotEmail) args.push("-m", config.autoLaunchCertbotEmail);
  else args.push("--register-unsafely-without-email");
  return args;
}

async function launchProvisioningRequest(request) {
  await writeProvisioningFiles(request);
  request.status = "launching";
  request.updatedAt = new Date().toISOString();

  if (config.autoLaunchRequireDns && !(await dnsResolves(request.domain))) {
    request.status = "dns_pending";
    request.updatedAt = new Date().toISOString();
    request.launchLog ||= [];
    request.launchLog.push({
      label: "DNS check",
      ok: false,
      error: `${request.domain} does not resolve yet.`,
      at: request.updatedAt
    });
    return request;
  }

  let dockerUp = await dockerComposeCommand(["-f", request.plan.composePath, "up", "-d"], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  recordLaunchStep(request, "Docker compose up", dockerUp);
  if (!dockerUp.ok && isDockerComposeContainerConfigError(dockerUp)) {
    const removeStale = await systemCommand("docker", ["rm", "-f", request.containerName], { timeout: 10000, maxBuffer: 1024 * 1024 });
    recordLaunchStep(request, "Remove stale Docker container", removeStale);
    if (removeStale.ok) {
      dockerUp = await dockerComposeCommand(["-f", request.plan.composePath, "up", "-d"], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
      recordLaunchStep(request, "Docker compose up retry", dockerUp);
    }
  }
  if (!dockerUp.ok) {
    request.status = "docker_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const nginxTarget = join(config.nginxSitesAvailableDir, request.domain);
  const nginxEnabled = join(config.nginxSitesEnabledDir, request.domain);
  const makeAvailableDir = await systemCommand("mkdir", ["-p", config.nginxSitesAvailableDir], { timeout: 5000 });
  recordLaunchStep(request, "Ensure Nginx sites-available directory", makeAvailableDir);
  if (!makeAvailableDir.ok) {
    request.status = "nginx_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const makeEnabledDir = await systemCommand("mkdir", ["-p", config.nginxSitesEnabledDir], { timeout: 5000 });
  recordLaunchStep(request, "Ensure Nginx sites-enabled directory", makeEnabledDir);
  if (!makeEnabledDir.ok) {
    request.status = "nginx_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const copyNginx = await systemCommand("cp", [request.plan.nginxPath, nginxTarget], { timeout: 5000 });
  recordLaunchStep(request, "Install Nginx site", copyNginx);
  if (!copyNginx.ok) {
    request.status = "nginx_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const linkNginx = await systemCommand("ln", ["-sf", nginxTarget, nginxEnabled], { timeout: 5000 });
  recordLaunchStep(request, "Enable Nginx site", linkNginx);
  if (!linkNginx.ok) {
    request.status = "nginx_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const nginxTest = await systemCommand("nginx", ["-t"], { timeout: 5000, maxBuffer: 1024 * 1024 });
  recordLaunchStep(request, "Nginx config test", nginxTest);
  if (!nginxTest.ok) {
    request.status = "nginx_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  const nginxReload = await systemCommand("systemctl", ["reload", "nginx"], { timeout: 7000 });
  recordLaunchStep(request, "Reload Nginx", nginxReload);
  if (!nginxReload.ok) {
    request.status = "nginx_reload_failed";
    request.updatedAt = new Date().toISOString();
    return request;
  }

  if (config.autoLaunchCertbot) {
    const certbot = await systemCommand("certbot", certbotArgs(request.domain), {
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024
    });
    recordLaunchStep(request, "Issue SSL", certbot);
    if (!certbot.ok) {
      request.status = "ssl_failed";
      request.updatedAt = new Date().toISOString();
      return request;
    }
  }

  request.status = config.autoLaunchCertbot ? "live" : "http_live";
  request.launchedAt = new Date().toISOString();
  request.updatedAt = request.launchedAt;
  request.plan.checks = request.plan.checks.map((check) => {
    if (check.label === "Port") return { ...check, status: "prepared" };
    if (check.label === "DNS") return { ...check, status: "healthy" };
    if (check.label === "SSL") return { ...check, status: config.autoLaunchCertbot ? "healthy" : "pending" };
    if (check.label === "Health") return { ...check, status: "pending" };
    return check;
  });
  return request;
}

async function autoLaunchProvisioningRequest(data, request) {
  if (!config.autoLaunchEnabled) return request;
  const worker = findWorkerNode(data, request.workerId || config.localWorkerId);
  if (worker.role !== "local") {
    request.status = "worker_assigned";
    request.updatedAt = new Date().toISOString();
    request.launchLog ||= [];
    request.launchLog.push({
      label: "Worker assignment",
      ok: true,
      stdout: `${worker.name || worker.id} is remote. Container is assigned and waiting for worker-side launch automation.`,
      at: request.updatedAt
    });
    if (request.sourceRequestId) {
      const setup = (data.customerSetupRequests || []).find((item) => item.id === request.sourceRequestId);
      if (setup) {
        setup.status = request.status;
        setup.updatedAt = request.updatedAt;
        setup.provisioningRequestId = request.id;
      }
    }
    return request;
  }
  const launched = await launchProvisioningRequest(request);
  if (request.sourceRequestId) {
    const setup = (data.customerSetupRequests || []).find((item) => item.id === request.sourceRequestId);
    if (setup) {
      setup.status = launched.status;
      setup.updatedAt = launched.updatedAt;
      setup.provisioningRequestId = launched.id;
    }
  }
  return launched;
}

async function launchExistingProvisioningRequest(id) {
  if (!config.autoLaunchEnabled) {
    return { ok: false, errors: ["AUTO_LAUNCH_ENABLED is not true for the running app process."] };
  }

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  const request = (data.provisioning?.requests || []).find((item) => item.id === id);
  if (!request) return { ok: false, errors: ["Provisioning request was not found."] };

  await autoLaunchProvisioningRequest(data, request);
  await writeDatabase(data);
  return { ok: true, request };
}

async function removePath(pathname) {
  if (!pathname) return { ok: true, stdout: "", stderr: "" };
  return systemCommand("rm", ["-rf", pathname], { timeout: 5000, maxBuffer: 1024 * 1024 });
}

function commandMissingTarget(result, patterns = []) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}\n${result.error || ""}`.toLowerCase();
  return patterns.some((pattern) => output.includes(pattern));
}

async function deleteProvisionedContainer(request) {
  request.plan = request.plan || provisioningPlan(request);
  request.deleteLog ||= [];
  const logStep = (label, result) => {
    request.deleteLog.push({
      label,
      ok: Boolean(result.ok),
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error || "",
      at: new Date().toISOString()
    });
  };

  const dockerDown = await dockerComposeCommand(["-f", request.plan.composePath, "down", "--remove-orphans"], {
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024
  });
  logStep("Docker compose down", dockerDown);

  const removeContainer = await systemCommand("docker", ["rm", "-f", request.containerName], {
    timeout: 10000,
    maxBuffer: 1024 * 1024
  });
  logStep("Force remove Docker container", removeContainer);

  const nginxTarget = join(config.nginxSitesAvailableDir, request.domain);
  const nginxEnabled = join(config.nginxSitesEnabledDir, request.domain);
  const removeEnabled = await removePath(nginxEnabled);
  logStep("Disable Nginx site", removeEnabled);
  const removeAvailable = await removePath(nginxTarget);
  logStep("Remove Nginx site", removeAvailable);

  const nginxTest = await systemCommand("nginx", ["-t"], { timeout: 5000, maxBuffer: 1024 * 1024 });
  logStep("Nginx config test", nginxTest);
  if (nginxTest.ok) {
    const nginxReload = await systemCommand("systemctl", ["reload", "nginx"], { timeout: 7000 });
    logStep("Reload Nginx", nginxReload);
  }

  if (config.autoLaunchCertbot) {
    const removeCert = await systemCommand("certbot", ["delete", "--cert-name", request.domain, "--non-interactive"], {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    logStep("Remove SSL certificate", removeCert);
  }

  const removeFiles = await removePath(request.plan.instanceDir);
  logStep("Remove generated files", removeFiles);

  const dockerRemoved = dockerDown.ok || removeContainer.ok || commandMissingTarget(removeContainer, ["no such container", "no such object"]);
  const nginxRemoved = removeEnabled.ok && removeAvailable.ok && nginxTest.ok;
  const filesRemoved = removeFiles.ok;
  request.updatedAt = new Date().toISOString();
  if (dockerRemoved && nginxRemoved && filesRemoved) {
    request.status = "deleted";
    request.statusDetail = "";
    request.deletedAt = request.updatedAt;
  } else {
    const failed = request.deleteLog.filter((entry) => !entry.ok).map((entry) => entry.label).join(", ");
    request.status = "delete_failed";
    request.statusDetail = failed ? `Delete needs attention: ${failed}` : "Delete needs attention.";
  }
  return request;
}

async function deleteCustomerContainer(id, session) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const data = loaded.data;
  data.customerSetupRequests ||= [];
  data.provisioning ||= { requests: [] };
  const request = data.customerSetupRequests.find((item) => item.id === id);
  if (!request) return { ok: false, errors: ["Container was not found."] };
  if (session.role !== "owner" && request.tenantId !== session.tenantId) {
    return { ok: false, status: 403, errors: ["You can only delete your own containers."] };
  }

  const provision = data.provisioning.requests.find((item) => item.id === request.provisioningRequestId || item.sourceRequestId === request.id);
  request.status = "delete_requested";
  request.updatedAt = new Date().toISOString();

  if (provision && config.autoLaunchEnabled) {
    await deleteProvisionedContainer(provision);
    request.status = provision.status;
    request.statusDetail = provision.statusDetail || "";
    request.deletedAt = provision.deletedAt;
    request.updatedAt = provision.updatedAt;
    if (provision.status !== "deleted") {
      await writeDatabase(data);
      return {
        ok: false,
        status: 500,
        errors: [provision.statusDetail || "Container deletion did not complete. Check the provisioning delete log."],
        request: publicSetupRequest(request),
        provisioning: provision
      };
    }
  } else if (provision) {
    provision.status = "delete_requested";
    provision.updatedAt = request.updatedAt;
  } else {
    request.status = "deleted";
    request.deletedAt = request.updatedAt;
  }

  await writeDatabase(data);
  return { ok: true, request: publicSetupRequest(request), provisioning: provision || null };
}

async function getProvisioningSummary() {
  const loaded = await readDatabase();
  const requests = loaded.data.provisioning?.requests || [];
  // Skip live DNS lookups on the dashboard hot path. Each enrichProvisioningRequest
  // ran a `getent ahosts` per record (800ms timeout each), which dominated reload time
  // once many provisioning records existed. Static plan.checks still render; the live
  // DNS status is available on demand via GET /api/provisioning/checks.
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests: requests.map((request) => ({ ...request, plan: request.plan || provisioningPlan(request) }))
  };
}

async function getEnrichedProvisioningSummary() {
  const loaded = await readDatabase();
  const requests = loaded.data.provisioning?.requests || [];
  const enriched = await Promise.all(requests.map(enrichProvisioningRequest));
  return {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests: enriched
  };
}

async function enrichProvisioningRequest(request) {
  const plan = request.plan || provisioningPlan(request);
  const checks = [...(plan.checks || [])];
  const dns = await command("getent", ["ahosts", request.domain], { timeout: 800, maxBuffer: 20000 });
  checks.push({
    label: "DNS live check",
    value: dns.ok && dns.stdout ? dns.stdout.split("\n")[0].trim() : "No server-side DNS answer yet",
    status: dns.ok && dns.stdout ? "healthy" : "warning"
  });
  return { ...request, plan: { ...plan, checks } };
}

async function persistDailySummary(summary) {
  const loaded = await readDatabase();
  // Only a DB read failure blocks persistence. An unavailable shared-log summary must
  // NOT skip the per-tenant section below — tenants with dedicated per-container logs
  // would otherwise never get daily snapshots stored, and their event history would
  // reset after every nightly logrotate or watchdog container restart.
  if (!loaded.available) {
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
  if (summary.available) {
    // Same guard as storeTenantEventSnapshot: a freshly rotated log undercounts the
    // day, so never replace today's stored snapshot with a smaller one.
    const existingToday = data.daily[today];
    if (!existingToday || Number(existingToday.total || 0) <= Number(summary.count || 0)) {
      data.daily[today] = historySnapshotFromSummary(summary, today);
      data.daily[today].purchases = (summary.recentEvents || []).filter((item) => item.eventName === "Purchase").slice(0, 50);
    }
    pruneDailyHistory(data.daily);
  }

  // Persist per-tenant daily request counts so billing-period totals survive log rotation.
  // After nightly logrotate the per-container access log starts fresh; without this,
  // tail-based period summaries reset to 0. We store each tenant's count for today.
  //
  // TWO sources:
  //  1. Shared log (summary.hosts) — covers tenants whose traffic appears in the global log.
  //  2. Dedicated per-container logs — covers tenants with their own sgtm-access.log.
  //     These tenants never appear in summary.hosts so source-1 always stored 0 for them,
  //     causing requestsMonth to reset to today-only after every nightly log rotation.
  const allTenants = [...(data.tenants || []), ...(data.owner?.customers || []), ...(data.customers?.tenants || [])];
  if (!data.tenantDailyRequests) data.tenantDailyRequests = {};
  if (!data.tenantEventHistory) data.tenantEventHistory = {};

  // Source 1: shared log host counts (multi-tenant setups where one log covers all)
  if (allTenants.length && Array.isArray(summary.hosts) && summary.hosts.length) {
    const summaryHasHostInfo = (summary.recentEvents || []).some((event) => {
      const host = normalizeHost(event.host);
      return host && host !== "unknown host";
    });
    for (const tenant of allTenants) {
      if (!tenant?.id) continue;
      const tenantHostCount = summaryHasHostInfo
        ? summary.hosts
          .filter((h) => hostMatchesTenant(h.key || h.name, tenant))
          .reduce((s, h) => s + Number(h.count || 0), 0)
        : Number(summary.count || 0);
      if (!data.tenantDailyRequests[tenant.id]) data.tenantDailyRequests[tenant.id] = {};
      if (tenantHostCount > 0) {
        // Only overwrite if the shared log actually has data for this tenant,
        // and never lower today's stored count (rotated log undercounts the day).
        const existingCount = Number(data.tenantDailyRequests[tenant.id][today] || 0);
        data.tenantDailyRequests[tenant.id][today] = Math.max(existingCount, tenantHostCount);
        storeTenantEventSnapshot(data, tenant.id, filterRequestSummaryForTenant(summary, tenant), today);
      }
    }
  }

  // Source 2: dedicated per-container access logs.
  // Build a lightweight data shape that customerAccessLogPaths can use from the DB content.
  if (allTenants.length) {
    const dbShape = {
      customerSetup: { requests: (data.customerSetupRequests || []) },
      provisioning: data.provisioning || { requests: [] }
    };
    await Promise.all(allTenants.map(async (tenant) => {
      if (!tenant?.id) return;
      const paths = customerAccessLogPaths(dbShape, tenant.id);
      if (!paths.length) return;
      const todaySummary = await summarizeRequestsTodayForPaths(paths).catch(() => null);
      const liveCount = todaySummary?.available ? Number(todaySummary.count || 0) : 0;
      if (liveCount > 0) {
        if (!data.tenantDailyRequests[tenant.id]) data.tenantDailyRequests[tenant.id] = {};
        // Take the max: dedicated log count wins over the shared-log count (which would be 0)
        const existing = Number(data.tenantDailyRequests[tenant.id][today] || 0);
        data.tenantDailyRequests[tenant.id][today] = Math.max(existing, liveCount);
        storeTenantEventSnapshot(data, tenant.id, todaySummary, today);
      }
    }));
  }

  // Prune entries older than 35 days (billing period is 30 days + 5-day buffer)
  if (Object.keys(data.tenantDailyRequests).length) {
    const cutoffDate = localDateKey(addDays(new Date(), -35));
    for (const tenantId of Object.keys(data.tenantDailyRequests)) {
      for (const dateKey of Object.keys(data.tenantDailyRequests[tenantId])) {
        if (dateKey < cutoffDate) delete data.tenantDailyRequests[tenantId][dateKey];
      }
    }
  }
  pruneTenantEventHistory(data.tenantEventHistory, 30);

  try {
    await writeDatabase(data);
    return {
      available: true,
      path: databasePath,
      retentionDays: config.historyRetentionDays,
      tenantDailyRequests: data.tenantDailyRequests || {},
      tenantEventHistory: data.tenantEventHistory || {},
      daily: Object.values(data.daily).sort((a, b) => b.date.localeCompare(a.date))
    };
  } catch (error) {
    return {
      available: false,
      path: databasePath,
      message: "Summary database could not be written.",
      detail: error.message,
      tenantDailyRequests: data.tenantDailyRequests || {},
      tenantEventHistory: data.tenantEventHistory || {},
      daily: Object.values(data.daily).sort((a, b) => b.date.localeCompare(a.date))
    };
  }
}

async function summarizeRequestsTodayUncached(pathname, lineLimit = config.summaryTailLines) {
  const token = nginxDateToken();
  const emptyPurchases = {
    rawCount: 0,
    uniqueCount: 0,
    duplicateCount: 0,
    keyedCount: 0,
    estimatedKeyCount: 0,
    missingKeyCount: 0,
    uniqueRevenue: 0,
    rawRevenue: 0,
    averageOrderValue: 0,
    currency: ""
  };
  const tail = await command("tail", ["-n", String(lineLimit), pathname], {
    timeout: DASHBOARD_COMMAND_TIMEOUT_MS,
    maxBuffer: Math.max(5 * 1024 * 1024, lineLimit * 1024)
  });
  if (!tail.ok) {
    return {
      available: false,
      count: 0,
      errors: 0,
      totalLines: 0,
      noise: 0,
      botNoise: 0,
      token,
      path: pathname,
      message: "Request count could not be calculated.",
      detail: tail.stderr || tail.error,
      events: [],
      clients: [],
      hosts: [],
      hourly: [],
      noiseReasons: [],
      recentEvents: [],
      purchases: emptyPurchases,
      eventLogLimit: config.eventLogLimit,
      summaryTailLines: lineLimit
    };
  }

  return aggregateTrackingLines(splitLines(tail.stdout), { token, path: pathname, lineLimit });
}

// Shared aggregation over raw access-log lines. Used by both the live tail path and
// the SQLite event store, so dashboard numbers are identical regardless of source.
// `token` (nginx date token like "12/Jun/2026") filters lines to a single day; pass
// an empty token when the lines are already scoped to one day.
function aggregateTrackingLines(lines, { token = "", path: pathname = "", lineLimit = config.summaryTailLines } = {}) {
  let count = 0;
  let errors = 0;
  let totalLines = 0;
  let noise = 0;
  let botNoise = 0;
  let rawPurchaseRevenue = 0;
  let purchaseMissingKeys = 0;
  const events = new Map();
  const clients = new Map();
  const hosts = new Map();
  const noiseReasons = new Map();
  const purchaseKeys = new Set();
  const purchaseOrders = new Map();
  const estimatedPurchases = [];
  const eventDedupe = { exact: new Set(), estimated: new Map() };
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, errors: 0, purchases: 0, pageView: 0, viewItem: 0, addToCart: 0, beginCheckout: 0 }));
  const recentEvents = [];

  for (const line of lines) {
    if (token && !line.includes(token)) continue;
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
      continue;
    }

    const trackingNoise = classifyTrackingNoise(parsed);
    if (trackingNoise) {
      noise += 1;
      if (trackingNoise.includes("bot")) botNoise += 1;
      const current = noiseReasons.get(trackingNoise) || { count: 0 };
      current.count += 1;
      noiseReasons.set(trackingNoise, current);
      continue;
    }

    count += 1;
    if (Number(parsed.status) >= 400) errors += 1;
    if (parsed.date) {
      const bucket = hourly[parsed.date.getHours()];
      bucket.total += 1;
      if (Number(parsed.status) >= 400) bucket.errors += 1;
      if (parsed.eventName === "Purchase") bucket.purchases += 1;
      else if (parsed.eventName === "PageView") bucket.pageView += 1;
      else if (parsed.eventName === "ViewItem") bucket.viewItem += 1;
      else if (parsed.eventName === "AddToCart") bucket.addToCart += 1;
      else if (parsed.eventName === "BeginCheckout") bucket.beginCheckout += 1;
    }

    if (parsed.eventName === "Purchase") {
      const key = purchaseTransactionIdentity(parsed);
      const amount = parseMoney(parsed.value);
      const currency = String(parsed.currency || "").trim().toUpperCase();
      if (amount !== null) rawPurchaseRevenue += amount;
      if (key) {
        purchaseKeys.add(key);
        if (!purchaseOrders.has(key)) purchaseOrders.set(key, { amount, currency });
      } else if (parsed.date) {
        estimatedPurchases.push(parsed);
      } else {
        purchaseMissingKeys += 1;
        purchaseOrders.set(`missing:${purchaseMissingKeys}`, { amount, currency });
      }
    }

    const uniqueBusinessEvent = isTrackedBusinessEvent(parsed.eventName)
      ? markUniqueEvent(parsed, eventDedupe)
      : true;
    const event = events.get(parsed.eventName) || { count: 0, rawCount: 0, duplicateCount: 0, errors: 0, lastSeen: null };
    event.rawCount += 1;
    if (uniqueBusinessEvent) event.count += 1;
    event.duplicateCount = Math.max(0, event.rawCount - event.count);
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
  }

  const purchaseEvent = events.get("Purchase");
  const estimatedGroups = estimatedPurchaseGroups(estimatedPurchases);
  for (const [index, group] of estimatedGroups.entries()) {
    purchaseOrders.set(`estimated:${index}:${group.signature}:${group.firstSeen}`, {
      amount: group.amount,
      currency: group.currency
    });
  }
  const purchaseCurrencies = new Set([...purchaseOrders.values()].map((item) => item.currency).filter(Boolean));
  const revenueCurrency = purchaseCurrencies.size === 1 ? [...purchaseCurrencies][0] : "";
  const uniquePurchaseRevenue = [...purchaseOrders.values()].reduce((total, item) => (
    item.amount === null ? total : total + item.amount
  ), 0);
  const uniquePurchaseCount = purchaseOrders.size;
  const rawPurchaseCount = Number(purchaseEvent?.rawCount || purchaseEvent?.count || 0);
  const duplicatePurchaseCount = Math.max(0, rawPurchaseCount - uniquePurchaseCount);
  const averageOrderValue = uniquePurchaseCount ? uniquePurchaseRevenue / uniquePurchaseCount : 0;
  const purchases = {
    rawCount: rawPurchaseCount,
    uniqueCount: uniquePurchaseCount,
    duplicateCount: duplicatePurchaseCount,
    keyedCount: purchaseKeys.size,
    estimatedKeyCount: estimatedGroups.length,
    missingKeyCount: purchaseMissingKeys,
    uniqueRevenue: uniquePurchaseRevenue,
    rawRevenue: rawPurchaseRevenue,
    averageOrderValue,
    currency: revenueCurrency
  };
  if (purchaseEvent) {
    Object.assign(purchaseEvent, {
      uniqueCount: uniquePurchaseCount,
      rawCount: rawPurchaseCount,
      duplicateCount: duplicatePurchaseCount,
      keyedCount: purchaseKeys.size,
      estimatedKeyCount: estimatedGroups.length,
      missingKeyCount: purchaseMissingKeys,
      uniqueRevenue: uniquePurchaseRevenue,
      rawRevenue: rawPurchaseRevenue,
      averageOrderValue,
      currency: revenueCurrency
    });
    events.set("Purchase", purchaseEvent);
  }

  return {
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
    sampledLines: lines.length,
    summaryTailLines: lineLimit,
    events: serializeSummaryMap(events),
    clients: serializeSummaryMap(clients),
    hosts: serializeSummaryMap(hosts),
    purchases,
    hourly,
    noiseReasons: serializeSummaryMap(noiseReasons),
    recentEvents: recentEvents.reverse(),
    eventLogLimit: config.eventLogLimit
  };
}

async function summarizeRequestsToday(pathname, { lineLimit = config.summaryTailLines, ttl = SUMMARY_CACHE_TTL_MS } = {}) {
  const key = `today:${pathname}:${lineLimit}:${config.eventLogLimit}:${nginxDateToken()}`;
  return cachedSummary(key, () => summarizeRequestsTodayUncached(pathname, lineLimit), { ttl });
}

async function summarizeRequestsForPeriodUncached(pathname, period, lineLimit = config.summaryTailLines) {
  const tail = await command("tail", ["-n", String(lineLimit), pathname], {
    timeout: DASHBOARD_COMMAND_TIMEOUT_MS,
    maxBuffer: Math.max(5 * 1024 * 1024, lineLimit * 1024)
  });
  if (!tail.ok) {
    return {
      available: false,
      count: 0,
      path: pathname,
      message: "Billing-period request count could not be calculated.",
      detail: tail.stderr || tail.error,
      sampledLines: 0
    };
  }

  let count = 0;
  let sampledLines = 0;
  for (const line of splitLines(tail.stdout)) {
    sampledLines += 1;
    const parsed = parseTrackingAccessLine(line);
    if (!parsed || !parsed.date) continue;
    if (parsed.date < period.start || parsed.date > period.end) continue;
    if (classifyTrackingNoise(parsed)) continue;
    count += 1;
  }

  return {
    available: true,
    count,
    path: pathname,
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: period.label
    },
    sampledLines
  };
}

async function summarizeRequestsForPeriod(pathname, period, { lineLimit = config.summaryTailLines, ttl = SUMMARY_CACHE_TTL_MS } = {}) {
  const key = [
    "period",
    pathname,
    lineLimit,
    period.start.toISOString(),
    period.end.toISOString()
  ].join(":");
  return cachedSummary(key, () => summarizeRequestsForPeriodUncached(pathname, period, lineLimit), { ttl });
}

function mergeSummaryRows(summaries, key) {
  const rows = new Map();
  for (const summary of summaries) {
    for (const row of summary[key] || []) {
      const name = row.name || "Other";
      const current = rows.get(name) || { name, lastSeen: null };
      for (const [field, value] of Object.entries(row)) {
        if (field === "name" || field === "lastSeen") continue;
        if (typeof value === "number") current[field] = Number(current[field] || 0) + value;
        else if (current[field] === undefined) current[field] = value;
      }
      if (row.lastSeen && (!current.lastSeen || new Date(row.lastSeen) > new Date(current.lastSeen))) {
        current.lastSeen = row.lastSeen;
      }
      rows.set(name, current);
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
}

function mergePurchaseSummaries(summaries) {
  const purchaseRows = summaries.map((summary) => summary.purchases || {});
  const currencies = new Set(purchaseRows.map((row) => row.currency).filter(Boolean));
  const uniqueCount = purchaseRows.reduce((total, row) => total + Number(row.uniqueCount || 0), 0);
  const uniqueRevenue = purchaseRows.reduce((total, row) => total + Number(row.uniqueRevenue || 0), 0);
  return {
    rawCount: purchaseRows.reduce((total, row) => total + Number(row.rawCount || 0), 0),
    uniqueCount,
    duplicateCount: purchaseRows.reduce((total, row) => total + Number(row.duplicateCount || 0), 0),
    keyedCount: purchaseRows.reduce((total, row) => total + Number(row.keyedCount || 0), 0),
    estimatedKeyCount: purchaseRows.reduce((total, row) => total + Number(row.estimatedKeyCount || 0), 0),
    missingKeyCount: purchaseRows.reduce((total, row) => total + Number(row.missingKeyCount || 0), 0),
    uniqueRevenue,
    rawRevenue: purchaseRows.reduce((total, row) => total + Number(row.rawRevenue || 0), 0),
    averageOrderValue: uniqueCount ? uniqueRevenue / uniqueCount : 0,
    currency: currencies.size === 1 ? [...currencies][0] : ""
  };
}

async function summarizeRequestsTodayForPaths(paths, options = {}) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!uniquePaths.length) return unavailable("No container access log is available yet.", "Create a live container first.");
  const summaries = await Promise.all(uniquePaths.map((pathname) => summarizeRequestsToday(pathname, options)));
  const readable = summaries.filter((summary) => summary.available);
  if (!readable.length) {
    return {
      ...summaries[0],
      path: uniquePaths.join(", "),
      message: "Container request count could not be calculated.",
      detail: summaries.map((summary) => `${summary.path}: ${summary.detail || summary.message}`).join(" | ")
    };
  }
  const recentEvents = readable
    .flatMap((summary) => summary.recentEvents || [])
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, config.eventLogLimit);
  return {
    ...readable[0],
    path: uniquePaths.join(", "),
    count: readable.reduce((total, summary) => total + Number(summary.count || 0), 0),
    errors: readable.reduce((total, summary) => total + Number(summary.errors || 0), 0),
    totalLines: readable.reduce((total, summary) => total + Number(summary.totalLines || 0), 0),
    noise: readable.reduce((total, summary) => total + Number(summary.noise || 0), 0),
    botNoise: readable.reduce((total, summary) => total + Number(summary.botNoise || 0), 0),
    sampledLines: readable.reduce((total, summary) => total + Number(summary.sampledLines || 0), 0),
    events: mergeSummaryRows(readable, "events"),
    clients: mergeSummaryRows(readable, "clients"),
    hosts: mergeSummaryRows(readable, "hosts"),
    noiseReasons: mergeSummaryRows(readable, "noiseReasons"),
    purchases: mergePurchaseSummaries(readable),
    recentEvents,
    message: "Customer container request summary loaded."
  };
}

async function summarizeRequestsForPeriodForPaths(paths, period, options = {}) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!uniquePaths.length) {
    return unavailable("No container access log is available yet.", "Create a live container first.");
  }

  const summaries = await Promise.all(uniquePaths.map((pathname) => summarizeRequestsForPeriod(pathname, period, options)));
  const readable = summaries.filter((summary) => summary.available);
  if (!readable.length) {
    return {
      ...summaries[0],
      path: uniquePaths.join(", "),
      message: "Billing-period request count could not be calculated.",
      detail: summaries.map((summary) => `${summary.path}: ${summary.detail || summary.message}`).join(" | ")
    };
  }

  return {
    available: true,
    count: readable.reduce((total, summary) => total + Number(summary.count || 0), 0),
    path: uniquePaths.join(", "),
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: period.label
    },
    sampledLines: readable.reduce((total, summary) => total + Number(summary.sampledLines || 0), 0)
  };
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
  const result = await command("openssl", ["x509", "-enddate", "-noout", "-in", pathname], {
    timeout: DASHBOARD_COMMAND_TIMEOUT_MS
  });
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
  ], { timeout: SSL_NETWORK_TIMEOUT_MS });

  if (!sClient.ok && !sClient.stdout) {
    return unavailable("SSL domain could not be reached.", sClient.stderr || sClient.error);
  }

  const x509 = await runWithInput("openssl", ["x509", "-enddate", "-noout"], sClient.stdout, DASHBOARD_COMMAND_TIMEOUT_MS);
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

function publicRuntimeConfig() {
  return {
    serviceName: config.serviceName,
    publicBaseUrl: config.publicBaseUrl,
    tenantId: config.tenantId,
    tenantName: config.tenantName,
    tenantDomain: config.tenantDomain,
    billingPlan: config.billingPlan,
    subscriptionStatus: config.subscriptionStatus,
    paymentStatus: config.paymentStatus,
    renewalDate: config.renewalDate,
    monthlyAmount: config.monthlyAmount,
    monthlyRequestLimit: config.monthlyRequestLimit,
    monthlyContainerLimit: config.monthlyContainerLimit,
    customerSupportEmail: config.customerSupportEmail,
    host: config.host,
    port: config.port,
    accessLog: config.accessLog,
    errorLog: config.errorLog,
    usingDedicatedLogs: config.usingDedicatedLogs,
    logTailLines: config.logTailLines,
    summaryTailLines: config.summaryTailLines,
    customerSummaryTailLines: config.customerSummaryTailLines,
    eventLogLimit: config.eventLogLimit,
    dataDir: config.dataDir,
    historyRetentionDays: config.historyRetentionDays,
    provisionPortStart: config.provisionPortStart,
    provisionPortEnd: config.provisionPortEnd,
    provisionDnsTarget: config.provisionDnsTarget,
    provisionOutputDir: config.provisionOutputDir,
    maxProvisioningRecords: config.maxProvisioningRecords,
    maxCustomerSetupRecords: config.maxCustomerSetupRecords,
    localWorkerId: config.localWorkerId,
    localWorkerName: config.localWorkerName,
    localWorkerRegion: config.localWorkerRegion,
    localWorkerMaxContainers: config.localWorkerMaxContainers,
    defaultContainerMemoryMb: config.defaultContainerMemoryMb,
    defaultContainerCpuLimit: config.defaultContainerCpuLimit,
    autoLaunchEnabled: config.autoLaunchEnabled,
    autoLaunchRequireDns: config.autoLaunchRequireDns,
    autoLaunchCertbot: config.autoLaunchCertbot,
    autoLaunchCertbotEmail: config.autoLaunchCertbotEmail,
    autoLaunchUseSudo: config.autoLaunchUseSudo,
    nginxSitesAvailableDir: config.nginxSitesAvailableDir,
    nginxSitesEnabledDir: config.nginxSitesEnabledDir,
    nginxLogFormat: config.nginxLogFormat,
    trackingPaths: config.trackingPaths,
    trackingHosts: config.trackingHosts,
    orderWebhookEnabled: Boolean(config.orderWebhookSecret),
    alertWebhookEnabled: Boolean(config.alertWebhookUrl),
    sslDomain: config.sslDomain,
    sslPort: config.sslPort
  };
}

async function getSystemMetrics() {
  try {
    const [loadavgRaw, meminfoRaw, uptimeRaw, dfResult] = await Promise.all([
      readFile("/proc/loadavg", "utf8").catch(() => null),
      readFile("/proc/meminfo", "utf8").catch(() => null),
      readFile("/proc/uptime", "utf8").catch(() => null),
      command("df", ["-BM", "/"], { timeout: 2000, maxBuffer: 16384 }).catch(() => null)
    ]);

    const load1 = loadavgRaw ? parseFloat(loadavgRaw.split(" ")[0]) : null;
    const load5 = loadavgRaw ? parseFloat(loadavgRaw.split(" ")[1]) : null;

    let memTotalMb = null, memAvailableMb = null;
    if (meminfoRaw) {
      const totalMatch = meminfoRaw.match(/MemTotal:\s+(\d+)/);
      const availableMatch = meminfoRaw.match(/MemAvailable:\s+(\d+)/);
      if (totalMatch) memTotalMb = Math.round(Number(totalMatch[1]) / 1024);
      if (availableMatch) memAvailableMb = Math.round(Number(availableMatch[1]) / 1024);
    }
    const memUsedMb = memTotalMb && memAvailableMb !== null ? memTotalMb - memAvailableMb : null;
    const memPercent = memTotalMb && memUsedMb !== null ? Math.round((memUsedMb / memTotalMb) * 100) : null;

    const uptimeSeconds = uptimeRaw ? parseFloat(uptimeRaw.split(" ")[0]) : null;
    let uptimeLabel = null;
    if (uptimeSeconds !== null) {
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      uptimeLabel = days ? `${days}d ${hours}h` : `${hours}h`;
    }

    let diskTotalMb = null, diskUsedMb = null, diskPercent = null;
    if (dfResult?.ok) {
      const lines = dfResult.stdout.trim().split("\n");
      if (lines[1]) {
        const parts = lines[1].trim().split(/\s+/);
        diskTotalMb = parts[1] ? parseInt(parts[1], 10) : null;
        diskUsedMb = parts[2] ? parseInt(parts[2], 10) : null;
        diskPercent = parts[4] ? parseInt(parts[4], 10) : null;
      }
    }

    return { available: true, load1, load5, memTotalMb, memUsedMb, memAvailableMb, memPercent, diskTotalMb, diskUsedMb, diskPercent, uptimeLabel };
  } catch {
    return { available: false };
  }
}

async function getDashboardData() {
  const [docker, requestSummary, accessLog, errorLog, ssl, system] = await Promise.all([
    getDockerSummary(),
    summarizeRequestsToday(config.accessLog),
    tailFile(config.accessLog, config.logTailLines),
    tailFile(config.errorLog, config.logTailLines),
    getSslSummary(),
    getSystemMetrics()
  ]);

  const dockerLogs = docker.available
    ? await withTimeout(
      getDockerLogs(docker.containers),
      DOCKER_LOG_TIMEOUT_MS + 200,
      timeoutResult("Docker logs are not available.", "Docker log collection timed out.")
    )
    : unavailable("Docker logs are not available because Docker could not be queried.", docker.detail);

  if (errorLog.available) {
    errorLog.lines = filterLogLinesForHosts(errorLog.lines);
    errorLog.message = errorLog.lines.length
      ? errorLog.message
      : "No recent Nginx errors matched the configured tracking host filter.";
  }
  // Run independent DB-backed collectors in parallel. Only persistDailySummary writes
  // (atomic temp+rename), the rest read, so concurrent access is safe.
  const [history, provisioning, workers, orders, customerAccounts, customerSetup] = await Promise.all([
    persistDailySummary(requestSummary),
    getProvisioningSummary(),
    getWorkerSummary(),
    getOrderSummary(),
    getCustomerAccountsSummary(),
    getCustomerSetupSummary()
  ]);
  const customers = await getCustomerCatalog({ docker, ssl, orders });
  const usage = getUsageSummary({ requestSummary, history });
  const tenantUsage = await tenantBillingUsageMap({ customerSetup, provisioning, tenantDailyRequests: history.tenantDailyRequests || {} }, customers.tenants || []);
  const reconciliation = getReconciliationSummary({ requestSummary, orders });
  const integrations = getIntegrationSummary({ orders, requestSummary });
  const setupWizard = getSetupWizard({ customers, provisioning, integrations, ssl, requestSummary });
  const owner = buildOwnerDashboard({ customers, docker, ssl, orders, requestSummary, usage, reconciliation, customerSetup, provisioning, workers, tenantUsage });
  const alerts = buildServerAlerts({ docker, requestCount: requestSummary, accessLog, errorLog, ssl });
  const deploymentChecks = buildDeploymentChecks({ docker, requestSummary, accessLog, errorLog, ssl, database: history });
  const retainedEvents = retainedSummaryFromSnapshots((history.daily || []).slice(0, 30), requestSummary);
  void sendAlertHooks(alerts);

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    docker,
    nginx: {
      requestCountToday: requestSummary,
      todayEvents: requestSummary,
      retainedEvents,
      accessLog,
      errorLog
    },
    dockerLogs,
    alerts,
    deploymentChecks,
    history,
    orders,
    customers,
    customerAccounts,
    customerSetup,
    owner,
    usage,
    reconciliation,
    integrations,
    setupWizard,
    provisioning,
    workers,
    ssl,
    system,
    config: publicRuntimeConfig()
  };
}

function publicCustomerConfig(data) {
  return {
    serviceName: data.config.serviceName,
    publicBaseUrl: data.config.publicBaseUrl,
    tenantId: data.config.tenantId,
    tenantName: data.config.tenantName,
    tenantDomain: data.config.tenantDomain,
    billingPlan: data.config.billingPlan,
    subscriptionStatus: data.config.subscriptionStatus,
    paymentStatus: data.config.paymentStatus,
    renewalDate: data.config.renewalDate,
    monthlyAmount: data.config.monthlyAmount,
    monthlyRequestLimit: data.config.monthlyRequestLimit,
    monthlyContainerLimit: data.config.monthlyContainerLimit,
    customerSupportEmail: data.config.customerSupportEmail,
    provisionDnsTarget: data.config.provisionDnsTarget,
    trackingPaths: data.config.trackingPaths,
    trackingHosts: data.config.trackingHosts,
    orderWebhookEnabled: data.config.orderWebhookEnabled,
    sslDomain: data.config.sslDomain,
    sslPort: data.config.sslPort
  };
}

function customerDockerPlaceholder() {
  return {
    available: true,
    message: "Customer infrastructure status is loaded from your live containers.",
    detail: "",
    containers: [],
    totals: {
      running: 0,
      stopped: 0,
      unhealthy: 0,
      total: 0
    }
  };
}

function emptyCustomerRequestSummary() {
  return {
    available: true,
    count: 0,
    errors: 0,
    totalLines: 0,
    noise: 0,
    botNoise: 0,
    path: "",
    filter: "tracking-only",
    trackingPaths: config.trackingPaths,
    sampledLines: 0,
    summaryTailLines: config.summaryTailLines,
    events: [],
    clients: [],
    hosts: [],
    purchases: {
      rawCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      keyedCount: 0,
      estimatedKeyCount: 0,
      missingKeyCount: 0,
      uniqueRevenue: 0,
      rawRevenue: 0,
      averageOrderValue: 0,
      currency: ""
    },
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, errors: 0, purchases: 0 })),
    noiseReasons: [],
    recentEvents: [],
    eventLogLimit: config.eventLogLimit
  };
}

async function getCustomerDashboardData(session) {
  const loaded = await readDatabase();
  const raw = loaded.data;
  const docker = customerDockerPlaceholder();
  // Reuse already-loaded DB data instead of calling readDatabase() again inside getOrderSummary
  const orders = getOrderSummaryFromData(loaded);
  const customerSetup = {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests: (raw.customerSetupRequests || []).map(publicSetupRequest)
  };
  const provisioning = {
    available: loaded.available,
    path: databasePath,
    message: loaded.message || "",
    detail: loaded.detail || "",
    requests: raw.provisioning?.requests || []
  };
  const customers = getCustomerCatalogFromData(raw, {
    docker,
    ssl: unavailable("SSL is checked by the owner dashboard."),
    orders,
    available: loaded.available
  });
  const requestSummary = emptyCustomerRequestSummary();
  const data = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    docker,
    nginx: {
      requestCountToday: requestSummary,
      todayEvents: requestSummary,
      retainedEvents: requestSummary,
      accessLog: unavailable("Container access log is loaded after a live container is found."),
      errorLog: unavailable("Nginx error logs are owner-only.")
    },
    dockerLogs: unavailable("Docker logs are owner-only."),
    alerts: loaded.available ? [] : [{
      key: "database-unavailable",
      severity: "error",
      title: "Customer data unavailable",
      message: loaded.detail || loaded.message || "Could not read customer records."
    }],
    deploymentChecks: [],
    history: { available: loaded.available, daily: [], tenantDailyRequests: raw.tenantDailyRequests || {}, tenantEventHistory: raw.tenantEventHistory || {} },
    orders,
    customers,
    customerAccounts: { available: true, path: "", accounts: [] },
    customerSetup,
    owner: null,
    usage: baseCustomerUsageSummary(),
    reconciliation: getReconciliationSummary({ requestSummary, orders }),
    integrations: getIntegrationSummary({ orders, requestSummary }),
    setupWizard: {},
    provisioning,
    workers: { available: true, nodes: [], metrics: {} },
    ssl: unavailable("SSL is checked by the owner dashboard."),
    config: publicRuntimeConfig(),
    webhookSecret: tenantWebhookSecret(raw, session.tenantId)
  };

  return customerDashboardData(data, session);
}

function provisioningRequestsForTenant(data, tenantId) {
  const setupIds = new Set((data.customerSetup?.requests || [])
    .filter((request) => request.tenantId === tenantId && !isDeletedStatus(request.status))
    .map((request) => request.id));
  return (data.provisioning?.requests || []).filter((request) =>
    !isDeletedStatus(request.status) && (request.tenantId === tenantId || setupIds.has(request.sourceRequestId))
  );
}

function logPathsForProvisioningRequest(request) {
  const plan = request.plan || provisioningPlan(request);
  const instanceName = sanitizeId(request.instanceName || request.containerName || String(request.domain || "").split(".")[0]);
  return {
    accessLog: plan.accessLog || (instanceName ? `/var/log/nginx/${instanceName}-sgtm-access.log` : ""),
    errorLog: plan.errorLog || (instanceName ? `/var/log/nginx/${instanceName}-sgtm-error.log` : "")
  };
}

function customerAccessLogPaths(data, tenantId) {
  const requests = provisioningRequestsForTenant(data, tenantId);
  const paths = requests
    .map((request) => logPathsForProvisioningRequest(request).accessLog)
    .filter(Boolean);
  return [...new Set(paths)];
}

async function customerAccessLogForTenant(data, tenantId) {
  const paths = customerAccessLogPaths(data, tenantId);
  if (!paths.length) {
    return unavailable("No container access log is available yet.", "Create a live container first.");
  }

  const logs = await Promise.all(paths.map(async (pathname) => {
    const log = await tailFile(pathname, config.logTailLines);
    return { pathname, log };
  }));
  const readable = logs.filter((item) => item.log.available);
  if (!readable.length) {
    return unavailable(
      "Container access log is not readable yet.",
      logs.map((item) => `${item.pathname}: ${item.log.detail || item.log.message}`).join(" | ")
    );
  }

  return {
    available: true,
    path: readable.map((item) => item.pathname).join(", "),
    message: "Customer container access logs loaded.",
    lines: readable.flatMap((item) => item.log.lines)
  };
}

async function tenantBillingUsageMap(data, tenants = []) {
  const entries = await Promise.all((tenants || []).map(async (tenant) => {
    const tenantSetupRequests = (data.customerSetup?.requests || []).filter((request) => request.tenantId === tenant.id && !isDeletedStatus(request.status));
    const period = billingPeriodForTenant(tenant, tenantSetupRequests);
    const paths = tenant.source === "environment" ? [config.accessLog].filter(Boolean) : customerAccessLogPaths(data, tenant.id);

    // Compute accumulated billing-period count from stored daily data (rotation-safe)
    const tenantDailyReqs = (data.tenantDailyRequests || {})[tenant.id] || {};
    const startKey = localDateKey(period.start);
    const todayKey = localDateKey();
    const historicCount = Object.entries(tenantDailyReqs)
      .filter(([d]) => d >= startKey && d < todayKey)
      .reduce((sum, [, c]) => sum + Number(c), 0);
    const todayStored = Number(tenantDailyReqs[todayKey] || 0);
    const accumulatedCount = historicCount + todayStored;

    if (!paths.length) {
      return [tenant.id, {
        requestsMonth: Math.max(accumulatedCount, Number(tenant.requestsMonth || 0)),
        period: period.label,
        available: Boolean(accumulatedCount > 0)
      }];
    }
    const summary = await summarizeRequestsForPeriodForPaths(paths, period);
    const livePeriodCount = summary.available ? Number(summary.count || 0) : 0;
    return [tenant.id, {
      requestsMonth: Math.max(accumulatedCount, livePeriodCount),
      period: period.label,
      available: Boolean(summary.available)
    }];
  }));
  return Object.fromEntries(entries);
}

async function customerDashboardData(data, session) {
  const customerRows = data.owner?.customers || data.customers?.tenants || [];
  const tenant = customerRows.find((customer) => customer.id === session.tenantId) || customerRows[0] || null;
  const tenantOrders = filterOrdersForTenant(data.orders, tenant);
  const tenantLogPaths = customerAccessLogPaths(data, session.tenantId);
  const tenantSetupRequests = (data.customerSetup.requests || []).filter((request) => request.tenantId === session.tenantId && !isDeletedStatus(request.status));
  const billingPeriod = billingPeriodForTenant(tenant, tenantSetupRequests);
  const customerSummaryOptions = { lineLimit: config.customerSummaryTailLines, ttl: CUSTOMER_SUMMARY_CACHE_TTL_MS };

  // Run all three I/O operations in parallel instead of sequentially.
  // On cold cache (first load or after TTL) each can block up to DASHBOARD_COMMAND_TIMEOUT_MS.
  // Serial: 3× timeout = 3–9s. Parallel: max(all three) = ~1s worst case.
  // When the tenant has its own per-container access log, use it (multi-tenant prod).
  // Otherwise fall back to the shared nginx access log so single-VPS / pre-provisioning
  // setups still show real tracking events instead of zeros.
  const useDedicatedLogs = tenantLogPaths.length > 0;
  const fallbackPaths = useDedicatedLogs ? tenantLogPaths : [config.accessLog].filter(Boolean);
  const [tenantAccessLog, rawTodaySummary, rawPeriodSummary] = await Promise.all([
    useDedicatedLogs
      ? customerAccessLogForTenant(data, session.tenantId)
      : tailFile(config.accessLog, config.logTailLines),
    fallbackPaths.length
      ? summarizeRequestsTodayForPaths(fallbackPaths, customerSummaryOptions)
      : Promise.resolve(data.nginx.todayEvents),
    fallbackPaths.length
      ? summarizeRequestsForPeriodForPaths(fallbackPaths, billingPeriod, customerSummaryOptions)
      : Promise.resolve({ available: false, count: tenant?.requestsMonth || 0, period: billingPeriod })
  ]);
  const tenantRequestSummary = filterRequestSummaryForTenant(rawTodaySummary, tenant);
  const tenantPeriodSummary = rawPeriodSummary;
  const requestLimit = tenant?.requestLimit || data.usage.requestLimit;
  const todayKey = localDateKey();
  const tenantEventHistory = (data.history?.tenantEventHistory || data.tenantEventHistory || {})[session.tenantId] || {};
  const eventHistoryCutoff = localDateKey(addDays(new Date(), -29));
  const retainedSnapshotsByDate = Object.fromEntries(
    Object.entries(tenantEventHistory).filter(([dateKey]) => dateKey >= eventHistoryCutoff)
  );
  if (tenantRequestSummary.available) {
    retainedSnapshotsByDate[todayKey] = historySnapshotFromSummary(tenantRequestSummary, todayKey);
  }
  // SQLite event store: per-day snapshots rebuilt from raw ingested lines. Survives
  // log rotation and works across worker VPSes. Per date, keep whichever source saw
  // more events (tail summaries undercount after rotation; SQLite may lag a tick).
  const sqliteSnapshotsByDate = sqliteSnapshotsForTenant(session.tenantId, tenant);
  for (const [dateKey, snapshot] of Object.entries(sqliteSnapshotsByDate)) {
    const existing = retainedSnapshotsByDate[dateKey];
    if (!existing || Number(snapshot.total || 0) > Number(existing.total || 0)) {
      retainedSnapshotsByDate[dateKey] = snapshot;
    }
  }
  const retainedEventsSummary = retainedSummaryFromSnapshots(Object.values(retainedSnapshotsByDate), tenantRequestSummary);

  // Compute billing-period event count that survives nightly log rotation.
  // Strategy: sum stored per-tenant daily counts for past days (from persistDailySummary)
  // plus today's live count from the current nginx log. If the live period summary
  // (tail-based) returns a higher value—meaning the log hasn't rotated yet and covers
  // the full billing period—we use that instead so we never under-report.
  const tenantDailyReqs = (data.history?.tenantDailyRequests || data.tenantDailyRequests || {})[session.tenantId] || {};
  const tenantDailyHistory = Object.entries(tenantDailyReqs)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30)
    .map(([date, count]) => ({ date, total: Number(count) }));
  const billingStartKey = localDateKey(billingPeriod.start);
  // Per past day take the larger of the JSON-stored count and the SQLite snapshot
  // total (clean events), so a day missed by one source is covered by the other.
  const billingDayKeys = new Set([
    ...Object.keys(tenantDailyReqs).filter((d) => d >= billingStartKey && d < todayKey),
    ...Object.keys(sqliteSnapshotsByDate).filter((d) => d >= billingStartKey && d < todayKey)
  ]);
  const historicCount = [...billingDayKeys].reduce((sum, d) => sum + Math.max(
    Number(tenantDailyReqs[d] || 0),
    Number(sqliteSnapshotsByDate[d]?.total || 0)
  ), 0);
  const todayLiveCount = Math.max(
    Number(tenantRequestSummary.count || 0),
    Number(sqliteSnapshotsByDate[todayKey]?.total || 0)
  );
  const accumulatedCount = historicCount + todayLiveCount;
  // Keep whichever is higher: accumulated (rotation-safe) vs live log period scan
  const livePeriodCount = tenantPeriodSummary.available ? Number(tenantPeriodSummary.count || 0) : 0;
  const requestsMonth = Math.max(accumulatedCount, livePeriodCount);
  const usagePercent = requestLimit ? Math.min(100, Math.round((requestsMonth / requestLimit) * 1000) / 10) : 0;
  const tenantUsage = {
    ...data.usage,
    plan: tenant?.plan || data.usage.plan,
    subscriptionStatus: tenant?.subscriptionStatus || data.usage.subscriptionStatus,
    paymentStatus: tenant?.paymentStatus || data.usage.paymentStatus,
    renewalDate: tenant?.renewalDate || data.usage.renewalDate,
    monthlyAmount: tenant?.monthlyAmount ?? data.usage.monthlyAmount,
    containerLimit: tenant?.containerLimit || data.usage.containerLimit,
    requestsToday: todayLiveCount,
    requestsMonth,
    requestLimit,
    period: billingPeriod.label,
    periodStart: billingPeriod.start.toISOString(),
    periodEnd: billingPeriod.renewal.toISOString(),
    renewalDate: tenant?.renewalDate || billingPeriod.renewal.toISOString(),
    periodSummary: tenantPeriodSummary,
    usagePercent,
    status: !requestLimit ? "unmetered" : usagePercent >= 100 ? "over_limit" : usagePercent >= 80 ? "warning" : "healthy"
  };
  const tenantReconciliation = getReconciliationSummary({ requestSummary: tenantRequestSummary, orders: tenantOrders });

  return {
    ...data,
    session,
    owner: null,
    workers: { available: true, nodes: [], metrics: {} },
    customerAccounts: { available: true, path: "", accounts: [] },
    customerSetup: {
      available: data.customerSetup.available,
      path: "",
      requests: tenantSetupRequests
    },
    customers: tenant
      ? {
        available: data.customers.available,
        active: tenant.subscriptionStatus === "active" ? 1 : 0,
        queued: 0,
        tenants: [tenant]
      }
      : { available: data.customers.available, active: 0, queued: 0, tenants: [] },
    provisioning: { available: true, path: "", requests: [] },
    deploymentChecks: [],
    alerts: data.alerts.filter((alert) => ["no-tracking-requests", "ssl-expiring"].includes(alert.key)),
    docker: {
      available: data.docker.available,
      message: data.docker.available ? "Customer infrastructure is monitored." : data.docker.message,
      detail: "",
      containers: [],
      totals: {
        running: tenant?.containers?.running || 0,
        stopped: Math.max(0, Number(tenant?.containers?.total || 0) - Number(tenant?.containers?.running || 0)),
        unhealthy: tenant?.containers?.unhealthy || 0,
        total: tenant?.containers?.total || 0
      }
    },
    dockerLogs: unavailable("Docker logs are owner-only."),
    nginx: {
      ...data.nginx,
      requestCountToday: tenantRequestSummary,
      todayEvents: tenantRequestSummary,
      retainedEvents: retainedEventsSummary,
      accessLog: tenantAccessLog,
      errorLog: unavailable("Nginx error logs are owner-only.")
    },
    // tenantEventHistory is only consumed server-side to build tenantDailyHistory;
    // shipping the all-tenants map to the browser leaked cross-tenant data and
    // inflated the payload, so the customer response carries an empty map.
    history: { available: data.history.available, daily: tenantDailyHistory, tenantEventHistory: {} },
    orders: tenantOrders,
    usage: tenantUsage,
    reconciliation: tenantReconciliation,
    integrations: getIntegrationSummary({ orders: tenantOrders, requestSummary: tenantRequestSummary }),
    config: publicCustomerConfig(data)
  };
}

function hostMatchesTenant(host, tenant) {
  if (!tenant) return true;
  const domain = normalizeHost(tenant.domain);
  if (!domain) return tenant.source === "environment";
  const hostName = normalizeHost(host);
  return hostName === domain || hostName.endsWith(`.${domain}`) || domain.endsWith(`.${hostName}`);
}

function filterRequestSummaryForTenant(summary, tenant) {
  if (!summary?.available || !tenant || (!tenant.domain && tenant.source === "environment")) return summary;

  // If the nginx log format does not expose the request host (default `combined`
  // format does not), every event reads as "Unknown host" and domain matching would
  // filter everything to zero. On a single-VPS setup all requests belong to the only
  // customer, so return the full summary instead of zeroing it out.
  const hasHostInfo = (summary.recentEvents || []).some((event) => {
    const host = normalizeHost(event.host);
    return host && host !== "unknown host";
  });
  if (!hasHostInfo) return summary;

  const recentEvents = (summary.recentEvents || []).filter((event) => hostMatchesTenant(event.host, tenant));
  const eventCounts = new Map();
  const clientCounts = new Map();
  const hostCounts = new Map();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, errors: 0, purchases: 0, pageView: 0, viewItem: 0, addToCart: 0, beginCheckout: 0 }));
  const purchases = {
    rawCount: 0,
    uniqueCount: 0,
    duplicateCount: 0,
    keyedCount: 0,
    estimatedKeyCount: 0,
    missingKeyCount: 0,
    uniqueRevenue: 0,
    rawRevenue: 0,
    averageOrderValue: 0,
    currency: ""
  };
  const purchaseKeys = new Set();
  const purchaseCurrencies = new Set();
  let errors = 0;

  for (const event of recentEvents) {
    if (Number(event.status) >= 400) errors += 1;
    const eventEntry = eventCounts.get(event.eventName) || { count: 0, rawCount: 0, duplicateCount: 0, errors: 0, lastSeen: null };
    eventEntry.count += 1;
    eventEntry.rawCount += 1;
    if (Number(event.status) >= 400) eventEntry.errors += 1;
    if (event.date && (!eventEntry.lastSeen || new Date(event.date) > eventEntry.lastSeen)) eventEntry.lastSeen = new Date(event.date);
    eventCounts.set(event.eventName, eventEntry);

    const clientEntry = clientCounts.get(event.client) || { count: 0, errors: 0, lastSeen: null };
    clientEntry.count += 1;
    if (Number(event.status) >= 400) clientEntry.errors += 1;
    if (event.date && (!clientEntry.lastSeen || new Date(event.date) > clientEntry.lastSeen)) clientEntry.lastSeen = new Date(event.date);
    clientCounts.set(event.client, clientEntry);

    const hostName = event.host || "Unknown host";
    const hostEntry = hostCounts.get(hostName) || { count: 0, errors: 0, lastSeen: null };
    hostEntry.count += 1;
    if (Number(event.status) >= 400) hostEntry.errors += 1;
    if (event.date && (!hostEntry.lastSeen || new Date(event.date) > hostEntry.lastSeen)) hostEntry.lastSeen = new Date(event.date);
    hostCounts.set(hostName, hostEntry);

    const date = event.date ? new Date(event.date) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const bucket = hourly[date.getHours()];
      bucket.total += 1;
      if (Number(event.status) >= 400) bucket.errors += 1;
      if (event.eventName === "Purchase") bucket.purchases += 1;
      else if (event.eventName === "PageView") bucket.pageView += 1;
      else if (event.eventName === "ViewItem") bucket.viewItem += 1;
      else if (event.eventName === "AddToCart") bucket.addToCart += 1;
      else if (event.eventName === "BeginCheckout") bucket.beginCheckout += 1;
    }

    if (event.eventName === "Purchase") {
      purchases.rawCount += 1;
      purchases.uniqueCount += 1;
      const amount = parseMoney(event.value);
      if (amount !== null) {
        purchases.rawRevenue += amount;
        purchases.uniqueRevenue += amount;
      }
      if (event.transactionId || event.eventId) purchaseKeys.add(event.transactionId || event.eventId);
      if (event.currency) purchaseCurrencies.add(String(event.currency).toUpperCase());
    }
  }

  purchases.keyedCount = purchaseKeys.size;
  purchases.averageOrderValue = purchases.uniqueCount ? purchases.uniqueRevenue / purchases.uniqueCount : 0;
  purchases.currency = purchaseCurrencies.size === 1 ? [...purchaseCurrencies][0] : "";

  return {
    ...summary,
    count: recentEvents.length,
    errors,
    events: serializeSummaryMap(eventCounts),
    clients: serializeSummaryMap(clientCounts),
    hosts: serializeSummaryMap(hostCounts),
    hourly,
    recentEvents,
    purchases
  };
}

function filterOrdersForTenant(orders, tenant) {
  if (!tenant || tenant.source === "environment") return orders;
  const todayOrders = orders.today || {};
  const rawOrders = (orders.rawToday || []).filter((order) => order.tenantId === tenant.id);
  const revenue = rawOrders.reduce((total, order) => total + Number(order.amount || 0), 0);
  const currencies = new Set(rawOrders.map((order) => order.currency).filter(Boolean));
  return {
    ...orders,
    today: {
      ...todayOrders,
      count: rawOrders.length,
      revenue,
      currency: currencies.size === 1 ? [...currencies][0] : "",
      averageOrderValue: rawOrders.length ? revenue / rawOrders.length : 0,
      latest: rawOrders.slice().sort((a, b) => orderDate(b.createdAt) - orderDate(a.createdAt))[0] || null
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
    const [content, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const etag = `"${fileStat.mtime.getTime().toString(16)}-${fileStat.size.toString(16)}"`;

    // Ctrl+R sends If-None-Match; 304 means browser uses cached copy → zero download
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304);
      res.end();
      return;
    }

    const mime = mimeTypes[extname(absolutePath)] || "application/octet-stream";
    const acceptsGzip = /gzip/.test(req.headers["accept-encoding"] || "");
    const compressible = /javascript|css|html|json|text\//.test(mime);

    const headers = {
      "content-type": mime,
      // max-age=0 + must-revalidate: browser always validates via ETag (Ctrl+R gets 304, not full download)
      "cache-control": "public, max-age=0, must-revalidate",
      "etag": etag,
      "last-modified": fileStat.mtime.toUTCString()
    };

    if (acceptsGzip && compressible && content.length > 1024) {
      const compressed = await gzipAsync(content);
      headers["content-encoding"] = "gzip";
      headers["vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      res.writeHead(200, headers);
      res.end(content);
    }
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function servePublicPage(res, filename) {
  try {
    const content = await readFile(join(publicDir, filename));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
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
    const reqUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = reqUrl.pathname;
    const hostname = String(req.headers.host || "").split(":")[0].toLowerCase();

    if (pathname === "/" && !isAuthenticated(req)) {
      if (hostname.startsWith("app.")) {
        redirect(res, "/login");
        return;
      }
      await servePublicPage(res, "landing.html");
      return;
    }

    if (pathname === "/landing.css" || pathname === "/terms.css" || pathname.startsWith("/assets/")) {
      await serveStatic(req, res);
      return;
    }

    if (pathname === "/terms") {
      await servePublicPage(res, "terms.html");
      return;
    }

    if (pathname === "/privacy") {
      await servePublicPage(res, "privacy.html");
      return;
    }

    if (pathname === "/login" && req.method === "GET") {
      if (isAuthenticated(req)) {
        redirect(res, "/");
        return;
      }
      const resetParam = reqUrl.searchParams.get("reset");
      const opts = { resetSent: resetParam === "sent", resetDone: resetParam === "done" };
      htmlResponse(res, 200, loginPage(config.authPassword ? "" : "Set AUTH_PASSWORD in .env before using the panel.", opts));
      return;
    }

    if (pathname === "/forgot-password" && req.method === "POST") {
      const form = await readForm(req);
      const email = String(form.get("email") || "").trim().toLowerCase();
      if (email) {
        const account = await findCustomerAccountByEmail(email);
        if (account) {
          for (const [k, v] of resetTokens) if (v.expires < Date.now()) resetTokens.delete(k);
          const token = randomBytes(32).toString("hex");
          resetTokens.set(token, { email, username: account.username, expires: Date.now() + 3_600_000 });
          const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
          await sendPasswordResetEmail(email, resetUrl);
        }
      }
      res.writeHead(302, { location: "/login?reset=sent", "cache-control": "no-store" });
      res.end();
      return;
    }

    if (pathname === "/reset-password" && req.method === "GET") {
      const token = reqUrl.searchParams.get("token") || "";
      const entry = resetTokens.get(token);
      if (!token || !entry || entry.expires < Date.now()) {
        htmlResponse(res, 400, resetPasswordPage("", ""));
        return;
      }
      htmlResponse(res, 200, resetPasswordPage(token, ""));
      return;
    }

    if (pathname === "/reset-password" && req.method === "POST") {
      const form = await readForm(req);
      const token = String(form.get("token") || "");
      const password = String(form.get("password") || "");
      const confirm = String(form.get("confirm") || "");
      const entry = resetTokens.get(token);
      if (!entry || entry.expires < Date.now()) {
        htmlResponse(res, 400, resetPasswordPage("", "This reset link has expired. Please request a new one."));
        return;
      }
      if (password.length < 8) {
        htmlResponse(res, 400, resetPasswordPage(token, "Password must be at least 8 characters."));
        return;
      }
      if (password !== confirm) {
        htmlResponse(res, 400, resetPasswordPage(token, "Passwords do not match."));
        return;
      }
      const db = await readDatabase();
      const account = (db.data.customerAccounts || []).find((a) => a.username === entry.username);
      if (!account) {
        htmlResponse(res, 400, resetPasswordPage("", "Account not found. Please contact support."));
        return;
      }
      account.passwordHash = hashPassword(password);
      await writeDatabase(db.data);
      resetTokens.delete(token);
      res.writeHead(302, { location: "/login?reset=done", "cache-control": "no-store" });
      res.end();
      return;
    }

    if (pathname === "/signup" && req.method === "GET") {
      if (isAuthenticated(req)) {
        redirect(res, "/");
        return;
      }
      htmlResponse(res, 200, signupPage());
      return;
    }

    if (pathname === "/signup" && req.method === "POST") {
      const form = await readForm(req);
      const values = Object.fromEntries(form.entries());
      const result = await addCustomerSignup(values);
      if (!result.ok) {
        htmlResponse(res, 400, signupPage((result.errors || ["Signup failed."]).join(" "), values));
        return;
      }

      const account = {
        username: result.account.username,
        role: "customer",
        tenantId: result.account.tenantId,
        accountId: result.account.id
      };
      res.writeHead(302, {
        location: "/#customerContainers",
        "set-cookie": `sgtm_session=${makeSessionCookie(account)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    if (pathname === "/login" && req.method === "POST") {
      const form = await readForm(req);
      const username = form.get("username") || "";
      const password = form.get("password") || "";
      const account = await authenticateLogin(username, password);

      if (!account) {
        htmlResponse(res, 401, loginPage("Invalid username or password."));
        return;
      }

      res.writeHead(302, {
        location: "/",
        "set-cookie": `sgtm_session=${makeSessionCookie(account)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
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

    if (pathname === "/api/orders/webhook" && req.method === "POST") {
      if (!isOrderWebhookAuthorized(req)) {
        jsonResponse(res, 401, { error: "Order webhook is not authorized." });
        return;
      }
      const body = await readJson(req);
      const result = await addOrderWebhook(body);
      jsonResponse(res, result.ok ? 202 : 400, result.ok ? { order: result.order, created: result.created } : { errors: result.errors });
      return;
    }

    // Native WooCommerce webhook target. WooCommerce cannot send custom headers;
    // it signs the raw body with HMAC-SHA256 (base64) in x-wc-webhook-signature
    // using the webhook Secret field, so this verifies against the raw bytes and
    // must stay above the session auth gate below.
    if (pathname === "/api/orders/woocommerce" && req.method === "POST") {
      const tenantParam = sanitizeId(reqUrl.searchParams.get("tenant") || "");
      // Per-tenant secret (generated from the customer dashboard) wins; the
      // global ORDER_WEBHOOK_SECRET stays as fallback for single-tenant setups.
      const loadedForSecret = await readDatabase();
      const perTenantSecret = loadedForSecret.available ? tenantWebhookSecret(loadedForSecret.data, tenantParam) : "";
      const webhookSecret = perTenantSecret || config.orderWebhookSecret;
      if (!webhookSecret) {
        jsonResponse(res, 503, { error: "No webhook secret is configured. Generate one from the Setup Assistant." });
        return;
      }
      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch (error) {
        jsonResponse(res, 413, { error: error.message });
        return;
      }
      if (!isWooOrderWebhookAuthorized(req, rawBody, webhookSecret)) {
        jsonResponse(res, 401, { error: "Invalid WooCommerce webhook signature." });
        return;
      }
      const rawText = rawBody.toString("utf8");
      // WooCommerce verifies a new webhook with a form-encoded ping (webhook_id=N).
      if (/^webhook_id=\d+/.test(rawText.trim())) {
        jsonResponse(res, 200, { ping: true });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(rawText);
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON payload." });
        return;
      }
      const result = await addOrderWebhook(normalizeWooOrderPayload(payload, tenantParam));
      jsonResponse(res, result.ok ? 202 : 400, result.ok ? { order: result.order, created: result.created } : { errors: result.errors });
      return;
    }

    // Worker VPS agents ship raw tracking log lines here. Authenticated by HMAC
    // signature over the raw body (shared WORKER_INGEST_SECRET), not by session,
    // so this route must stay above the session auth gate below.
    if (pathname === "/api/worker/ingest" && req.method === "POST") {
      if (!eventStore) {
        jsonResponse(res, 503, { error: "Event store is not available on this panel." });
        return;
      }
      if (!config.workerIngestSecret) {
        jsonResponse(res, 503, { error: "WORKER_INGEST_SECRET is not configured on the panel." });
        return;
      }
      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch (error) {
        jsonResponse(res, 413, { error: error.message });
        return;
      }
      const signature = String(req.headers["x-worker-signature"] || "");
      const expected = createHmac("sha256", config.workerIngestSecret).update(rawBody).digest("hex");
      if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        jsonResponse(res, 401, { error: "Invalid worker signature." });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON body." });
        return;
      }
      const workerId = String(payload.workerId || "").slice(0, 100);
      const batchId = String(payload.batchId || "").slice(0, 200);
      const tenantId = String(payload.tenantId || "").slice(0, 200);
      const source = String(payload.source || "").slice(0, 500);
      const lines = Array.isArray(payload.lines) ? payload.lines.slice(0, 20000) : [];
      if (!workerId || !batchId) {
        jsonResponse(res, 400, { error: "workerId and batchId are required." });
        return;
      }
      // At-least-once delivery from agents: a retried batch must not double-count.
      if (eventStore.hasBatch(batchId)) {
        jsonResponse(res, 200, { ok: true, inserted: 0, duplicate: true });
        return;
      }
      const rows = trackingRowsFromLines(lines, { tenantId, workerId, source });
      const inserted = rows.length ? eventStore.insertLines(rows) : 0;
      eventStore.markBatch(batchId, workerId);
      jsonResponse(res, 200, { ok: true, inserted, skipped: lines.length - rows.length });
      return;
    }

    if (pathname !== "/login" && pathname !== "/signup" && pathname !== "/tokens.css" && pathname !== "/login.css" && !isAuthenticated(req)) {
      if (pathname.startsWith("/api/")) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      redirect(res, "/login");
      return;
    }

    if (req.url?.startsWith("/api/dashboard")) {
      const session = getSession(req);
      const startedAt = Date.now();
      if (session?.role === "customer") {
        const payload = await getCustomerDashboardData(session);
        payload.timing = { dashboardMs: Date.now() - startedAt, role: "customer" };
        if (payload.timing.dashboardMs > 2000) {
          console.warn(`[dashboard] customer dashboard took ${payload.timing.dashboardMs}ms for tenant ${session.tenantId}`);
        }
        await jsonResponseGzip(req, res, 200, payload);
        return;
      }
      const dashboardData = await getDashboardData();
      const payload = { ...dashboardData, session, timing: { dashboardMs: Date.now() - startedAt, role: session?.role || "unknown" } };
      if (payload.timing.dashboardMs > 2000) {
        console.warn(`[dashboard] owner dashboard took ${payload.timing.dashboardMs}ms`);
      }
      await jsonResponseGzip(req, res, 200, payload);
      return;
    }

    if (pathname === "/api/customer/setup" && req.method === "POST") {
      const session = getSession(req);
      if (!session) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      const body = await readJson(req);
      const result = await addCustomerSetupRequest(body, session);
      jsonResponse(res, result.ok ? 201 : 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/webhook-secret" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await rotateCustomerWebhookSecret(session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { webhookSecret: result.webhookSecret } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/setup-assistant/templates" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const templates = buildSetupAssistantTemplates(body);
      jsonResponse(res, 200, templates);
      return;
    }

    const customerDeleteMatch = pathname.match(/^\/api\/customer\/containers\/([^/]+)$/);
    if (customerDeleteMatch && req.method === "DELETE") {
      const session = getSession(req);
      if (!session) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      const result = await deleteCustomerContainer(decodeURIComponent(customerDeleteMatch[1]), session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/subscription" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await selectCustomerPlan(body, session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { tenant: result.tenant } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/me" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const loaded = await readDatabase();
      if (!loaded.available) {
        jsonResponse(res, 500, { error: loaded.detail || "Database unavailable." });
        return;
      }
      const account = (loaded.data.customerAccounts || []).find((a) => a.id === session.accountId || a.tenantId === session.tenantId);
      if (!account) {
        jsonResponse(res, 404, { error: "Account not found." });
        return;
      }
      jsonResponse(res, 200, { account: publicCustomerAccount(account) });
      return;
    }

    if (pathname === "/api/customer/me" && req.method === "PATCH") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await updateCustomerProfile(session, body);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { account: result.account } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/me/password" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await changeCustomerPassword(session, body);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { ok: true } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer-accounts" && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const body = await readJson(req);
      const result = await addCustomerAccount(body);
      jsonResponse(res, result.ok ? 201 : 400, result.ok ? { account: result.account } : { errors: result.errors });
      return;
    }

    const customerPasswordMatch = pathname.match(/^\/api\/customer-accounts\/([^/]+)\/password$/);
    if (customerPasswordMatch && req.method === "PATCH") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const body = await readJson(req);
      const result = await resetCustomerAccountPassword(decodeURIComponent(customerPasswordMatch[1]), body.password);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { account: result.account } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/worker-nodes" && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const body = await readJson(req);
      const result = await addWorkerNode(body);
      jsonResponse(res, result.ok ? 201 : 400, result.ok ? { worker: result.worker } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/provisioning/requests" && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const body = await readJson(req);
      const result = await addProvisioningRequest(body);
      jsonResponse(res, result.ok ? 201 : 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/provisioning/checks" && req.method === "GET") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const enriched = await getEnrichedProvisioningSummary();
      jsonResponse(res, 200, enriched);
      return;
    }

    const prepareMatch = pathname.match(/^\/api\/provisioning\/requests\/([^/]+)\/prepare$/);
    if (prepareMatch && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = await prepareProvisioningFiles(decodeURIComponent(prepareMatch[1]));
      jsonResponse(res, result.ok ? 200 : 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    const launchMatch = pathname.match(/^\/api\/provisioning\/requests\/([^/]+)\/launch$/);
    if (launchMatch && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = await launchExistingProvisioningRequest(decodeURIComponent(launchMatch[1]));
      jsonResponse(res, result.ok ? 200 : 400, result.ok ? { request: result.request } : { errors: result.errors });
      return;
    }

    // ── Power-Ups ───────────────────────────────────────────────────────────

    if (pathname === "/api/powerups/status" && req.method === "GET") {
      if (!getSession(req)) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      // Customers get status (read-only). Owners also get mapsPath.
      const extra = isOwner(req) ? { mapsPath: powerUpMapsPath } : {};
      jsonResponse(res, 200, { powerUpsEnabled: powerUpsActive, ...extra });
      return;
    }

    if (pathname === "/api/powerups/init" && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = await initPowerUpMaps();
      if (result.ok) {
        powerUpsActive = true;
        // Persist in database
        const loaded = await readDatabase();
        if (loaded.available) {
          loaded.data.settings = { ...(loaded.data.settings || {}), powerUpsEnabled: true };
          await writeDatabase(loaded.data);
        }
      }
      jsonResponse(res, result.ok ? 200 : 500, { ok: result.ok, steps: result.steps, mapsPath: result.mapsPath });
      return;
    }

    if (pathname === "/api/powerups/regen-nginx" && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      if (!powerUpsActive) {
        jsonResponse(res, 400, { error: "Power-Ups not initialized. Run /api/powerups/init first." });
        return;
      }
      const loaded = await readDatabase();
      if (!loaded.available) {
        jsonResponse(res, 500, { error: "Database unavailable." });
        return;
      }
      const requests = loaded.data.provisioning?.requests || [];
      const active = requests.filter((r) => r.status === "live" || r.status === "files_prepared" || r.status === "launching");
      const results = [];
      for (const request of active) {
        const regenResult = await regenNginxForContainer(request);
        results.push({ domain: request.domain, ...regenResult });
      }
      await writeDatabase(loaded.data);
      const allOk = results.every((r) => r.ok);
      jsonResponse(res, allOk ? 200 : 207, { ok: allOk, containers: results });
      return;
    }

    // ── Power-Ups per-container regen ────────────────────────────────────────

    const regenNginxMatch = pathname.match(/^\/api\/provisioning\/requests\/([^/]+)\/regen-nginx$/);
    if (regenNginxMatch && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      if (!powerUpsActive) {
        jsonResponse(res, 400, { error: "Power-Ups not initialized. Run /api/powerups/init first." });
        return;
      }
      const loaded = await readDatabase();
      if (!loaded.available) {
        jsonResponse(res, 500, { error: "Database unavailable." });
        return;
      }
      const requests = loaded.data.provisioning?.requests || [];
      const request = requests.find((r) => r.id === decodeURIComponent(regenNginxMatch[1]));
      if (!request) {
        jsonResponse(res, 404, { error: "Provisioning request not found." });
        return;
      }
      const regenResult = await regenNginxForContainer(request);
      if (regenResult.ok) {
        request.updatedAt = new Date().toISOString();
        await writeDatabase(loaded.data);
      }
      jsonResponse(res, regenResult.ok ? 200 : 500, { ok: regenResult.ok, domain: request.domain, error: regenResult.error || null });
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

// Load power-ups state from database on startup
(async () => {
  try {
    const loaded = await readDatabase();
    if (loaded.data.settings?.powerUpsEnabled) {
      powerUpsActive = true;
      console.log("Power-Ups: enabled (Cookie Keeper, Click ID Restorer, Custom Loader active)");
    }
  } catch (_) {
    // Non-fatal; power-ups default to off
  }
})();

// ---------------------------------------------------------------------------
// SQLite event ingest
// ---------------------------------------------------------------------------
// Tails local access logs by byte offset (rotation-aware via inode) and stores raw
// tracking lines per tenant per day, so event history survives logrotate and
// container restarts. Remote worker VPSes ship their lines to /api/worker/ingest.

const NGINX_MONTH_KEYS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function dateKeyFromNginxLine(line) {
  const match = String(line || "").match(/\[(\d{2})\/([A-Za-z]{3})\/(\d{4}):/);
  if (!match) return "";
  const month = NGINX_MONTH_KEYS[match[2]];
  return month ? `${match[3]}-${month}-${match[1]}` : "";
}

function trackingRowsFromLines(lines, { tenantId = "", workerId = "local", source = "" } = {}) {
  const rows = [];
  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line || !isTrackingLogLine(line)) continue;
    const dateKey = dateKeyFromNginxLine(line) || localDateKey();
    rows.push({ tenantId, workerId, source, dateKey, line });
  }
  return rows;
}

// Read new bytes from a log file since the stored cursor. Inode change or shrink
// means the file was rotated, so reading restarts from byte 0 of the new file.
async function ingestLogFile(source, tenantId) {
  if (!eventStore) return;
  const fileStat = await stat(source).catch(() => null);
  if (!fileStat) return;
  const cursor = eventStore.getCursor(source);
  let offset = Number(cursor.offset) || 0;
  if (Number(cursor.inode) !== Number(fileStat.ino) || fileStat.size < offset) offset = 0;
  if (fileStat.size === offset) {
    if (Number(cursor.inode) !== Number(fileStat.ino)) eventStore.setCursor(source, fileStat.ino, offset);
    return;
  }
  const handle = await open(source, "r");
  try {
    const toRead = Math.min(fileStat.size - offset, config.ingestMaxBytesPerTick);
    const buffer = Buffer.alloc(toRead);
    const { bytesRead } = await handle.read(buffer, 0, toRead, offset);
    if (!bytesRead) return;
    const chunk = buffer.subarray(0, bytesRead).toString("utf8");
    const lastNewline = chunk.lastIndexOf("\n");
    if (lastNewline === -1) {
      // Only a partial line so far; try again next tick once the line completes.
      eventStore.setCursor(source, fileStat.ino, offset);
      return;
    }
    const complete = chunk.slice(0, lastNewline);
    const consumedBytes = Buffer.byteLength(chunk.slice(0, lastNewline + 1), "utf8");
    const rows = trackingRowsFromLines(complete.split("\n"), { tenantId, source });
    if (rows.length) eventStore.insertLines(rows);
    eventStore.setCursor(source, fileStat.ino, offset + consumedBytes);
  } finally {
    await handle.close();
  }
}

let ingestTickRunning = false;
let lastEventPruneDate = "";
async function ingestLocalLogsTick() {
  if (!eventStore || ingestTickRunning) return;
  ingestTickRunning = true;
  try {
    // Shared nginx log: tenant resolved at query time via host matching (tenant_id '').
    if (config.accessLog) await ingestLogFile(config.accessLog, "");
    // Dedicated per-container logs: tenant known from the provisioning record.
    const loaded = await readDatabase();
    if (loaded.available) {
      const dbShape = {
        customerSetup: { requests: loaded.data.customerSetupRequests || [] },
        provisioning: loaded.data.provisioning || { requests: [] }
      };
      const tenantIds = new Set([
        ...(loaded.data.tenants || []).map((tenant) => tenant?.id),
        ...(loaded.data.customerSetupRequests || []).map((request) => request?.tenantId)
      ].filter(Boolean));
      for (const tenantId of tenantIds) {
        for (const logPath of customerAccessLogPaths(dbShape, tenantId)) {
          await ingestLogFile(logPath, tenantId);
        }
      }
    }
    // Retention: prune once per day.
    const today = localDateKey();
    if (lastEventPruneDate !== today) {
      lastEventPruneDate = today;
      const pruned = eventStore.prune(config.eventRetentionDays);
      if (pruned.lines || pruned.summaries) {
        console.log(`[events] pruned ${pruned.lines} lines, ${pruned.summaries} summaries older than ${pruned.cutoff}`);
      }
    }
  } catch (error) {
    console.error(`[events] ingest tick failed: ${error.message}`);
  } finally {
    ingestTickRunning = false;
  }
}

// Build per-day snapshots for a tenant from the SQLite store, in the exact shape
// history.json snapshots use. Closed days are computed once and cached; today is
// always computed live from the stored lines.
// Today's snapshot is recomputed from raw lines on demand. Aggregating tens of
// thousands of lines is synchronous and was blocking every dashboard load for
// seconds, so reuse the result until new lines arrive for that tenant+day.
const todaySnapshotCache = new Map();

function sqliteSnapshotsForTenant(tenantId, tenant, days = 30) {
  if (!eventStore) return {};
  const fromKey = localDateKey(addDays(new Date(), -(days - 1)));
  const todayKey = localDateKey();
  const snapshots = {};
  try {
    const lineCounts = eventStore.dateCountsForTenant(tenantId, fromKey);
    for (const dateKey of eventStore.tenantDates(tenantId, fromKey)) {
      if (dateKey !== todayKey) {
        const cached = eventStore.getDailySummary(tenantId, dateKey);
        if (cached) {
          snapshots[dateKey] = cached;
          continue;
        }
      } else {
        const cached = todaySnapshotCache.get(tenantId);
        if (cached && cached.dateKey === todayKey && cached.lineCount === (lineCounts[dateKey] || 0)) {
          snapshots[dateKey] = cached.snapshot;
          continue;
        }
      }
      const lines = eventStore.linesForTenantDate(tenantId, dateKey);
      if (!lines.length) continue;
      const summary = filterRequestSummaryForTenant(
        aggregateTrackingLines(lines, { path: "sqlite:events.db" }),
        tenant
      );
      if (!summary?.available) continue;
      const snapshot = historySnapshotFromSummary(summary, dateKey);
      snapshots[dateKey] = snapshot;
      if (dateKey !== todayKey) eventStore.setDailySummary(tenantId, dateKey, snapshot);
      else todaySnapshotCache.set(tenantId, { dateKey, lineCount: lines.length, snapshot });
    }
  } catch (error) {
    console.error(`[events] snapshot build failed for tenant ${tenantId}: ${error.message}`);
  }
  return snapshots;
}

if (eventStore) {
  setInterval(ingestLocalLogsTick, config.ingestIntervalMs).unref();
  setTimeout(ingestLocalLogsTick, 5 * 1000).unref();
}

// Persist daily event snapshots in the background. Previously snapshots were only
// written when the owner dashboard API ran, so on days with only customer logins
// (or no logins) nothing was stored — and the nightly logrotate / watchdog container
// restart then erased that day's events for good, making dashboard totals "reset".
const persistSnapshotIntervalMs = Number(process.env.PERSIST_SNAPSHOT_INTERVAL_MS || 10 * 60 * 1000);
let persistSnapshotRunning = false;
async function persistSnapshotTick() {
  if (persistSnapshotRunning) return;
  persistSnapshotRunning = true;
  try {
    const summary = await summarizeRequestsToday(config.accessLog);
    await persistDailySummary(summary);
  } catch (error) {
    console.error(`[history] scheduled snapshot persist failed: ${error.message}`);
  } finally {
    persistSnapshotRunning = false;
  }
}
setInterval(persistSnapshotTick, persistSnapshotIntervalMs).unref();
setTimeout(persistSnapshotTick, 30 * 1000).unref();

server.listen(config.port, config.host, () => {
  console.log(`SGTM control panel running at http://${config.host}:${config.port}`);
});
