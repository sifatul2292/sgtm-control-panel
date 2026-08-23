import { createServer } from "node:http";
import { mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { deflateRawSync, gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

// Minimal ZIP builder (no extra deps). Used for the WooCommerce plugin and the
// multi-file Laravel Bridge source bundle.
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function buildZip(entries) {
  const now = new Date();
  const dosDate = (((now.getFullYear() - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0xF) << 5) | (now.getDate() & 0x1F);
  const dosTime = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | (Math.floor(now.getSeconds() / 2) & 0x1F);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(String(entry.name).replace(/^\/+/, ""));
    const data = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(deflated.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28); nameBuf.copy(local, 30);
    localParts.push(local, deflated);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10); central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(deflated.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);
    offset += local.length + deflated.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}
function buildSingleFileZip(filename, content) {
  return buildZip([{ name: filename, content }]);
}

async function filesForZip(directory, prefix = "") {
  const entries = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    const absolute = join(directory, item.name);
    if (item.isDirectory()) entries.push(...await filesForZip(absolute, relative));
    else if (item.isFile()) entries.push({ name: relative, content: await readFile(absolute) });
  }
  return entries;
}

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
  monthlyRequestLimit: Number(process.env.MONTHLY_REQUEST_LIMIT || 500000),
  monthlyContainerLimit: Number(process.env.MONTHLY_CONTAINER_LIMIT || 1),
  customerSupportEmail: process.env.CUSTOMER_SUPPORT_EMAIL || "",
  // The standalone cPanel bridge is a staged pilot. Keep it off in production
  // until a throwaway Laravel tenant has completed doctor + test-order checks.
  cpanelBridgeEnabled: process.env.CPANEL_BRIDGE_ENABLED === "true",
  cpanelBridgeTenants: parseCsv(process.env.CPANEL_BRIDGE_TENANTS || ""),
  brevoApiKey: process.env.BREVO_API_KEY || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3100}`,
  sslCertPath: process.env.SSL_CERT_PATH || "",
  sslDomain: process.env.SSL_DOMAIN || "",
  sslPort: Number(process.env.SSL_PORT || 443),
  nginxConfdDir: process.env.NGINX_CONF_D_DIR || "/etc/nginx/conf.d",
  // Picked by PADDLE_ENV so the right key is live regardless of which one
  // is also set — matches the naming Paddle's own Claude Code plugin expects.
  paddleApiKey: (process.env.PADDLE_ENV || "sandbox") === "production"
    ? (process.env.PADDLE_LIVE_API_KEY || "")
    : (process.env.PADDLE_SANDBOX_API_KEY || ""),
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET || "",
  paddleEnv: process.env.PADDLE_ENV || "sandbox",
  paddleApiBase: (process.env.PADDLE_ENV || "sandbox") === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com",
  paddleClientToken: process.env.PADDLE_CLIENT_TOKEN || "",
  paddlePriceIds: {
    Starter: process.env.PADDLE_PRICE_ID_STARTER || "",
    Pro: process.env.PADDLE_PRICE_ID_PRO || "",
    Enterprise: process.env.PADDLE_PRICE_ID_ENTERPRISE || ""
  }
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
// Unverified signups awaiting email code confirmation. Keyed by an opaque token
// stored in an HttpOnly cookie. No customer account exists until the code is
// confirmed, so an unverified email never becomes a usable login.
//
// In-memory fallback only. The real store is SQLite (see pendingSignupStore below):
// a process Map was losing every in-flight signup on each deploy/restart, sending
// the visitor to "Your verification session expired" mid-flow — the prime suspect
// for the signup-page → verified-signup drop-off.
const pendingSignups = new Map();
const SIGNUP_VERIFY_TTL_MS = 60 * 60 * 1000;
const databasePath = join(config.dataDir, "history.json");
const backupsDir = join(config.dataDir, "backups");
const BACKUPS_TO_KEEP = 4;
const BACKUP_ID_PATTERN = /^backup-[0-9]{8}T[0-9]{6}-[a-f0-9]{6}\.json$/;

// SQLite event store (data/events.db). Optional: if the native module fails to load
// the panel keeps working on the log-tail + history.json path, so a bad build can
// never take the dashboard down.
let eventStore = null;
try {
  const { openEventStore } = await import("./db.js");
  eventStore = openEventStore(config.dataDir);
  console.log(`[events] SQLite event store ready: ${join(config.dataDir, "events.db")}`);
  // One-time backfill: re-key stored event lines to their Asia/Dhaka day so
  // historical dashboard counts align with the live Dhaka-pinned aggregation.
  // Analytics-only; the live tracking path is untouched.
  try {
    const rekey = eventStore.rekeyDateKeys(nginxLineDhakaKey);
    if (rekey.migrated) console.log(`[events] Dhaka date_key backfill: ${rekey.updated}/${rekey.scanned} rows re-keyed`);
  } catch (error) {
    console.error(`[events] Dhaka date_key backfill skipped (${error.message})`);
  }
} catch (error) {
  console.error(`[events] SQLite event store unavailable (${error.message}); using log tail + history.json only`);
}

// Pending signups persist in SQLite so a restart mid-verification doesn't strand the
// visitor. Falls back to the in-memory Map when the native module didn't load, which
// keeps signup working (just as restart-fragile as before) rather than failing closed.
const pendingSignupStore = {
  put(token, record) {
    if (eventStore) { eventStore.putPendingSignup(token, record); return; }
    pendingSignups.set(token, record);
  },
  get(token) {
    if (eventStore) return eventStore.getPendingSignup(token);
    const record = pendingSignups.get(token);
    if (!record) return null;
    if (record.expires < Date.now()) { pendingSignups.delete(token); return null; }
    return record;
  },
  delete(token) {
    if (eventStore) { eventStore.deletePendingSignup(token); return; }
    pendingSignups.delete(token);
  },
  sweep() {
    if (eventStore) { eventStore.expirePendingSignups(); return; }
    for (const [key, value] of pendingSignups) if (value.expires < Date.now()) pendingSignups.delete(key);
  }
};
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

// Plain-text fallback for the HTML body. Gmail and Yahoo's bulk-sender rules
// favour multipart messages, so every send carries both parts.
function htmlToPlainText(html) {
  return String(html)
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|hr)\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Generic transactional email sender. Wraps `bodyHtml` in the standard Tagioo
// email shell so every message looks consistent. Resend is the sender; Brevo is
// used only when RESEND_API_KEY is empty, so setting BREVO_API_KEY alone is
// never enough to divert live mail.
// Never throws — email failure must not break a signup or payment handler.
async function sendEmail({ to, subject, bodyHtml }) {
  if (!config.brevoApiKey && !config.resendApiKey) {
    console.error(`[email] no provider key set — cannot send "${subject}" to ${to}`);
    return { ok: false };
  }
  if (!to) {
    console.error(`[email] no recipient for "${subject}"`);
    return { ok: false };
  }
  try {
    const fromAddr = config.customerSupportEmail || "noreply@tagioo.com";
    const html = [
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px">`,
      bodyHtml,
      `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">`,
      `<p style="color:#C4CCDB;font-size:12px;margin:0">Tagioo · Server-side tracking for Bangladesh ecommerce</p>`,
      `</div>`
    ].join("");
    const provider = config.resendApiKey ? "Resend" : "Brevo";
    const r = config.resendApiKey
      ? await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `Tagioo <${fromAddr}>`,
            to: [to],
            subject,
            html,
            text: htmlToPlainText(html)
          })
        })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": config.brevoApiKey,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            sender: { name: "Tagioo", email: fromAddr },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: htmlToPlainText(html)
          })
        });
    // `r.ok` covers both: Resend answers 200, Brevo 201. Log the body too — the
    // provider's error message tells a bad key apart from an unverified sender
    // domain, which a bare status code cannot.
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error(`[email] ${provider} API error for "${subject}":`, r.status, detail.slice(0, 300));
    }
    return { ok: r.ok };
  } catch (e) {
    console.error(`[email] send error for "${subject}":`, e.message);
    return { ok: false };
  }
}

async function notifyOwnerLaravelManagedSetup(tenant, setup) {
  const to = config.customerSupportEmail;
  if (!to || !tenant || !setup) return { ok: false };
  return sendEmail({
    to,
    subject: `Laravel setup requested — ${tenant.id}`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Laravel managed setup requested</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">A customer requested complete Laravel purchase tracking. Contact them before asking for any temporary, limited website access.</p>`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#0F0A1E">`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Tenant</td><td style="padding:6px 0;font-weight:700">${escapeHtml(tenant.id)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Customer</td><td style="padding:6px 0;font-weight:700">${escapeHtml(tenant.fullName || tenant.name || "")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Email</td><td style="padding:6px 0;font-weight:700">${escapeHtml(tenant.email || tenant.username || "")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Phone</td><td style="padding:6px 0;font-weight:700">${escapeHtml(tenant.phone || "")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Store</td><td style="padding:6px 0;font-weight:700">${escapeHtml(setup.storeUrl)}</td></tr>`,
      `</table>`,
      `<a href="${escapeHtml(config.appUrl)}/#customers" style="display:inline-block;margin:22px 0 0;background:#5B21B6;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Open customer dashboard →</a>`
    ].join("")
  });
}

async function emailWelcome(toEmail, fullName) {
  const name = String(fullName || "").trim().split(" ")[0] || "there";
  return sendEmail({
    to: toEmail,
    subject: "👋 Welcome to Tagioo — let's recover your lost sales",
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Welcome, ${escapeHtml(name)}!</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">Your Tagioo account is ready. You're on the <strong>Free</strong> plan — 15,000 tracked events per month, no card needed. Here's how to go live:</p>`,
      `<ol style="color:#0F0A1E;margin:0 0 20px;padding-left:20px;line-height:1.9">`,
      `<li>Open <strong>Setup</strong> in your dashboard and enter your domain + GTM config.</li>`,
      `<li>Install the first-party loader so Brave &amp; ad-blockers can't strip your tracking.</li>`,
      `<li>Run the tracking test to confirm Meta &amp; GA4 are receiving events.</li>`,
      `</ol>`,
      `<a href="https://tagioo.com/#setupAssistant" style="display:inline-block;background:#5B21B6;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Start setup →</a>`,
      `<p style="color:#9BA8C0;font-size:13px;margin:24px 0 0">Need a hand? Reply to this email and we'll help you get live.</p>`
    ].join("")
  });
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  return sendEmail({
    to: toEmail,
    subject: "Reset your Tagioo password",
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Reset your password</p>`,
      `<p style="color:#5B6B8A;margin:0 0 28px;line-height:1.6">Click the button below to set a new password for your Tagioo account. This link expires in <strong>1 hour</strong>.</p>`,
      `<a href="${resetUrl}" style="display:inline-block;background:#5B21B6;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Reset password →</a>`,
      `<p style="color:#9BA8C0;font-size:13px;margin:32px 0 0">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>`
    ].join("")
  });
}

// Notify the owner that a customer submitted a manual payment claim to verify.
async function notifyOwnerPaymentClaim(payment, ownerEmail) {
  const to = ownerEmail || config.customerSupportEmail;
  return sendEmail({
    to,
    subject: `💰 Payment claim: ${payment.amount} BDT — ${payment.tenantId}`,
    bodyHtml: [
      `<p style="font-size:20px;font-weight:900;margin:0 0 8px;color:#0F0A1E">New payment to verify</p>`,
      `<p style="color:#5B6B8A;margin:0 0 20px;line-height:1.6">A customer submitted a manual payment. Verify the transaction ID in your ${escapeHtml(payment.method)} app, then confirm it in Admin → Payments.</p>`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#0F0A1E">`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Invoice</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.invoiceNo)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Customer</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.tenantId)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Plan</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.plan)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Amount</td><td style="padding:6px 0;font-weight:700">৳${escapeHtml(String(payment.amount))}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Method</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.method)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Transaction ID</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.txnId)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#5B6B8A">Sender</td><td style="padding:6px 0;font-weight:700">${escapeHtml(payment.senderNumber)}</td></tr>`,
      `</table>`,
      `<a href="${escapeHtml(config.appUrl)}/#admin" style="display:inline-block;margin:22px 0 0;background:#5B21B6;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Review &amp; confirm in Admin →</a>`
    ].join("")
  });
}

// Acknowledge to the customer that we received their payment claim (verifying).
async function emailCustomerClaimReceived(toEmail, payment) {
  return sendEmail({
    to: toEmail,
    subject: `⏳ We received your payment — verifying now`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Payment received — verifying</p>`,
      `<p style="color:#5B6B8A;margin:0 0 16px;line-height:1.6">Thanks! We got your payment details for invoice <strong>${escapeHtml(payment.invoiceNo)}</strong> (<strong>${escapeHtml(payment.plan)}</strong> · ৳${escapeHtml(String(payment.amount))}). We're verifying the transaction now and will activate your plan shortly — usually within a few hours.</p>`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#0F0A1E">`,
      `<tr><td style="padding:5px 0;color:#5B6B8A">Transaction ID</td><td style="padding:5px 0;font-weight:700">${escapeHtml(payment.txnId)}</td></tr>`,
      `<tr><td style="padding:5px 0;color:#5B6B8A">Method</td><td style="padding:5px 0;font-weight:700">${escapeHtml(payment.method)}</td></tr>`,
      `</table>`,
      `<p style="color:#9BA8C0;font-size:13px;margin:20px 0 0">You'll get another email the moment your plan goes live.</p>`
    ].join("")
  });
}

// Tell the customer their plan is active after the owner confirms payment.
async function emailCustomerActivated(toEmail, payment, renewalDate) {
  const renew = renewalDate ? new Date(renewalDate).toISOString().slice(0, 10) : "";
  return sendEmail({
    to: toEmail,
    subject: `✅ Your Tagioo ${payment.plan} plan is active`,
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Payment confirmed 🎉</p>`,
      `<p style="color:#5B6B8A;margin:0 0 20px;line-height:1.6">We verified your payment for invoice <strong>${escapeHtml(payment.invoiceNo)}</strong>. Your <strong>${escapeHtml(payment.plan)}</strong> plan is now active${renew ? ` until <strong>${renew}</strong>` : ""}. Tracking is running.</p>`,
      `<a href="https://tagioo.com/#dashboard" style="display:inline-block;background:#059669;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Open dashboard →</a>`
    ].join("")
  });
}

// Owner manually changed a customer's plan from the admin dashboard — tell the
// customer their plan was updated by the Tagioo team.
async function emailPlanUpgradedByAdmin(toEmail, fullName, plan) {
  return sendEmail({
    to: toEmail,
    subject: `🚀 Your Tagioo plan was updated to ${plan}`,
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Plan updated 🚀</p>`,
      `<p style="color:#5B6B8A;margin:0 0 20px;line-height:1.6">Hi ${escapeHtml(fullName || "there")}, the Tagioo team has updated your account to the <strong>${escapeHtml(plan)}</strong> plan. Your new limits are active now — nothing more to do on your end.</p>`,
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:#5B21B6;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">View your plan →</a>`
    ].join("")
  });
}

// Confirm an extra-container add-on purchase to the customer.
async function emailExtraContainerConfirmed(toEmail, fullName, containerLimit) {
  return sendEmail({
    to: toEmail,
    subject: `✅ Extra container added to your Tagioo account`,
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Extra container ready 📦</p>`,
      `<p style="color:#5B6B8A;margin:0 0 20px;line-height:1.6">Hi ${escapeHtml(fullName || "there")}, we verified your payment and added an extra sGTM container. You can now run up to <strong>${Number(containerLimit || 0)}</strong> containers. The ৳${EXTRA_CONTAINER_PRICE.toLocaleString()}/month add-on is included in your next renewal.</p>`,
      `<a href="https://tagioo.com/#customerContainers" style="display:inline-block;background:#059669;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Create your container →</a>`
    ].join("")
  });
}

// Tell the customer their payment claim was rejected (wrong / duplicate TxnID).
async function emailCustomerPaymentRejected(toEmail, payment, reason) {
  return sendEmail({
    to: toEmail,
    subject: `⚠️ We couldn't verify your Tagioo payment`,
    bodyHtml: [
      `<p style="font-size:20px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Payment not verified</p>`,
      `<p style="color:#5B6B8A;margin:0 0 16px;line-height:1.6">We couldn't match the transaction for invoice <strong>${escapeHtml(payment.invoiceNo)}</strong>${reason ? `: ${escapeHtml(reason)}` : "."}. Please double-check the transaction ID and submit it again from your dashboard.</p>`,
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:#5B21B6;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Resubmit payment →</a>`
    ].join("")
  });
}

// ── Phase 2: Free-tier usage nudges ────────────────────────────────────────
// Locked SaaS rule: one upgrade nudge at 12K, then a hard cap at 15K.
// `purchases`/`revenue` show the customer what's at stake.
const FREE_NUDGE_TIERS = {
  12000: { color: "#B45309", emoji: "⚠️", heading: "80% of your free events used",
    tone: "You've used 12,000 of 15,000 free events this cycle. At 15,000 your tracking pauses until your cycle resets — Meta and GA4 stop receiving conversions." }
};

function purchaseStatHtml({ purchases, revenue, currency }) {
  if (!purchases) return "";
  const rev = revenue ? ` worth ${currency ? escapeHtml(currency) + " " : "৳"}${Math.round(revenue).toLocaleString()}` : "";
  return `<p style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;color:#0F0A1E;margin:0 0 20px;line-height:1.6">Tagioo has already tracked <strong>${purchases.toLocaleString()} purchase${purchases === 1 ? "" : "s"}${rev}</strong> for you this cycle. If your tracking pauses, sales like these stop reaching your ad platforms.</p>`;
}

async function emailFreeTierNudge(toEmail, tenant, threshold, used, limit, purchaseData) {
  const tier = FREE_NUDGE_TIERS[threshold] || FREE_NUDGE_TIERS[12000];
  const remaining = Math.max(0, limit - used);
  return sendEmail({
    to: toEmail,
    subject: `${tier.emoji} ${tier.heading} — Tagioo`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:${tier.color}">${tier.emoji} ${escapeHtml(tier.heading)}</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">${escapeHtml(tier.tone)}</p>`,
      `<div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;margin:0 0 18px"><div style="height:8px;background:#E5E7EB;border-radius:99px;overflow:hidden"><div style="height:8px;width:${Math.min(100, Math.round((used / limit) * 100))}%;background:${tier.color}"></div></div><p style="margin:8px 0 0;font-size:13px;color:#5B6B8A"><strong style="color:${tier.color}">${used.toLocaleString()}</strong> / ${limit.toLocaleString()} events used · ${remaining.toLocaleString()} left this cycle</p></div>`,
      purchaseStatHtml(purchaseData || {}),
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:${tier.color};color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Upgrade now →</a>`
    ].join("")
  });
}

async function emailFreeTierCapped(toEmail, tenant, purchaseData) {
  return sendEmail({
    to: toEmail,
    subject: `🛑 Tracking paused — you hit your free limit`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:#DC2626">🛑 Your tracking is paused</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">You've used all 15,000 free events this cycle, so your sGTM container is paused. New conversions are <strong>not</strong> reaching Meta, GA4, or Google Ads right now. Upgrade to a paid plan to resume tracking immediately.</p>`,
      purchaseStatHtml(purchaseData || {}),
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:#DC2626;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Upgrade & resume tracking →</a>`
    ].join("")
  });
}

// ── Phase 4: paid-plan renewal + dunning ───────────────────────────────────
// Block showing the customer how to pay their renewal (numbers + invoice).
function renewalPayHtml(tenant, data) {
  const s = paymentSettings(data);
  const numbers = [
    s.bkashNumber ? `bKash <strong>${escapeHtml(s.bkashNumber)}</strong>` : "",
    s.nagadNumber ? `Nagad <strong>${escapeHtml(s.nagadNumber)}</strong>` : ""
  ].filter(Boolean).join(" · ");
  return `<p style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;color:#0F0A1E;margin:0 0 18px;line-height:1.7">Plan <strong>${escapeHtml(tenant.plan)}</strong> · Amount <strong>৳${Number(tenant.monthlyAmount || 0).toLocaleString()}</strong>${numbers ? `<br>Send to: ${numbers}` : ""}</p>`;
}

async function emailRenewalReminder(toEmail, tenant, daysLeft, data) {
  const urgent = daysLeft <= 1;
  const color = urgent ? "#DC2626" : daysLeft <= 3 ? "#EA580C" : "#5B21B6";
  const when = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  return sendEmail({
    to: toEmail,
    subject: `${urgent ? "🚨 " : "🔔 "}Your Tagioo ${tenant.plan} plan renews ${when}`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:${color}">${urgent ? "🚨 " : "🔔 "}Renewal due ${escapeHtml(when)}</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">Your <strong>${escapeHtml(tenant.plan)}</strong> plan expires on <strong>${escapeHtml(String(tenant.renewalDate || "").slice(0, 10))}</strong>. Pay now to keep your server-side tracking running without interruption.</p>`,
      renewalPayHtml(tenant, data),
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:${color};color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Renew now →</a>`
    ].join("")
  });
}

async function emailOverdue(toEmail, tenant, data, graceDays) {
  return sendEmail({
    to: toEmail,
    subject: `⚠️ Your Tagioo payment is overdue`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:#EA580C">⚠️ Payment overdue</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">Your <strong>${escapeHtml(tenant.plan)}</strong> plan renewal hasn't been received. Your tracking is still running, but it will <strong>pause in ${Number(graceDays || 7)} days</strong> if payment isn't confirmed. Renew now to avoid losing conversion data.</p>`,
      renewalPayHtml(tenant, data),
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:#EA580C;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Pay now →</a>`
    ].join("")
  });
}

async function emailExpiredSuspended(toEmail, tenant, data) {
  return sendEmail({
    to: toEmail,
    subject: `🛑 Tracking paused — renew to resume`,
    bodyHtml: [
      `<p style="font-size:21px;font-weight:900;margin:0 0 8px;color:#DC2626">🛑 Your service is paused</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">Your <strong>${escapeHtml(tenant.plan)}</strong> plan expired and the renewal grace period has ended, so your sGTM container is paused. New conversions are <strong>not</strong> reaching Meta, GA4, or Google Ads. Renew now to resume immediately.</p>`,
      renewalPayHtml(tenant, data),
      `<a href="https://tagioo.com/#billing" style="display:inline-block;background:#DC2626;color:#fff;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px">Renew & resume →</a>`
    ].join("")
  });
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

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

const rateLimitBuckets = new Map();

function checkRateLimit(req, name, limit, windowMs) {
  const key = `${name}:${getClientIp(req)}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    rateLimitBuckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.windowStart < cutoff) rateLimitBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

function tooManyRequests(res) {
  res.writeHead(429, { "content-type": "text/plain", "retry-after": "60", "cache-control": "no-store" });
  res.end("Too many requests. Try again later.");
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

function readJson(req, maxBytes = 50000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
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

function gtmCustomTemplate(id, name, templateData) {
  return {
    accountId: "0",
    containerId: "0",
    templateId: String(id),
    name,
    fingerprint: String(Date.now()),
    templateData
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

function tagiooMetaCapiTemplateData() {
  return `___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_0_101",
  "version": 1,
  "securityGroups": [],
  "displayName": "Tagioo Meta CAPI",
  "categories": ["ADVERTISING", "ANALYTICS", "CONVERSIONS"],
  "brand": {
    "id": "tagioo",
    "displayName": "Tagioo"
  },
  "description": "Sends GA4-client server events from Tagioo Server GTM to Meta Conversions API.",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "pixelId",
    "displayName": "Meta Pixel ID",
    "simpleValueType": true,
    "valueValidators": [{ "type": "NON_EMPTY" }]
  },
  {
    "type": "TEXT",
    "name": "accessToken",
    "displayName": "Meta CAPI Access Token",
    "simpleValueType": true,
    "valueValidators": [{ "type": "NON_EMPTY" }]
  },
  {
    "type": "TEXT",
    "name": "testEventCode",
    "displayName": "Meta Test Event Code",
    "simpleValueType": true
  },
  {
    "type": "SELECT",
    "name": "actionSource",
    "displayName": "Action Source",
    "simpleValueType": true,
    "selectItems": [
      { "value": "website", "displayValue": "Website" },
      { "value": "email", "displayValue": "Email" },
      { "value": "app", "displayValue": "App" },
      { "value": "phone_call", "displayValue": "Phone Call" },
      { "value": "chat", "displayValue": "Chat" },
      { "value": "physical_store", "displayValue": "Physical Store" },
      { "value": "system_generated", "displayValue": "System Generated" },
      { "value": "other", "displayValue": "Other" }
    ],
    "defaultValue": "website"
  },
  {
    "type": "CHECKBOX",
    "name": "enableDebugLog",
    "checkboxText": "Log Meta response in Server GTM preview",
    "simpleValueType": true,
    "defaultValue": true
  }
]


___SANDBOXED_JS_FOR_SERVER___

const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const Math = require('Math');
const makeString = require('makeString');
const makeNumber = require('makeNumber');
const sendHttpRequest = require('sendHttpRequest');
const sha256Sync = require('sha256Sync');

const eventData = getAllEventData();
const eventMap = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  search: 'Search',
  sign_up: 'CompleteRegistration',
  generate_lead: 'Lead'
};

function firstValue() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function isHash(value) {
  return value && makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function hash(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const stringValue = makeString(value).trim().toLowerCase();
  if (!stringValue) return undefined;
  if (isHash(stringValue)) return stringValue;
  return sha256Sync(stringValue, { outputEncoding: 'hex' });
}

function addHashed(target, key, value) {
  const hashed = hash(value);
  if (hashed !== undefined) target[key] = hashed;
}

function addRaw(target, key, value) {
  if (value !== undefined && value !== null && value !== '') target[key] = makeString(value);
}

const mappedEventName = eventMap[eventData.event_name];
if (!mappedEventName) {
  if (data.enableDebugLog) {
    logToConsole('Tagioo Meta CAPI: skipping unmapped event ' + eventData.event_name);
  }
  data.gtmOnSuccess();
  return;
}

const userData = eventData.user_data || {};

// Meta rejects events whose event_time is older than 7 days. Honor the
// upstream event_time (so COD orders attribute to the real purchase moment),
// but clamp anything stale back to now so a late order still lands instead of
// being dropped.
const nowSec = Math.round(getTimestampMillis() / 1000);
let eventTime = nowSec;
if (eventData.event_time) {
  eventTime = makeNumber(eventData.event_time);
  if (!eventTime || eventTime < nowSec - 604800) eventTime = nowSec;
}

const event = {
  event_name: mappedEventName,
  event_time: eventTime,
  action_source: eventData.action_source || data.actionSource || 'website',
  event_source_url: firstValue(eventData.page_location, getRequestHeader('referer')),
  event_id: firstValue(eventData.event_id, eventData.transaction_id),
  user_data: {},
  custom_data: {}
};

addHashed(event.user_data, 'em', firstValue(userData.email_address, userData.email, eventData.email_address, eventData.email));
addHashed(event.user_data, 'ph', firstValue(userData.phone_number, eventData.phone_number));
addHashed(event.user_data, 'fn', firstValue(userData.first_name, eventData.first_name));
addHashed(event.user_data, 'ln', firstValue(userData.last_name, eventData.last_name));
// external_id: prefer the storefront-supplied id; else fall back to the stable
// first-party FPID cookie the GA4 client sets on every visitor. This puts an
// external_id on every event (incl. PageView/ViewContent) without any storefront
// change, lifting Meta event match quality.
addHashed(event.user_data, 'external_id', firstValue(userData.external_id, eventData.external_id, getCookieValues('FPID', true)[0]));
addHashed(event.user_data, 'ct', firstValue(userData.city, eventData.city));
addHashed(event.user_data, 'st', firstValue(userData.region, eventData.region));
addHashed(event.user_data, 'zp', firstValue(userData.postal_code, eventData.postal_code));
// Country must reflect the actual buyer, not a fixed value. Hash the incoming
// 2-letter code; fall back to the store default (bd) when none is sent.
addHashed(event.user_data, 'country', firstValue(userData.country, eventData.country, 'bd'));

addRaw(event.user_data, 'fbp', firstValue(userData.fbp, eventData.fbp, eventData._fbp, getCookieValues('_fbp', true)[0]));
// _fbc: prefer the cookie/event value; else reconstruct from the raw fbclid
// nginx stashed in tagioo_fbclid (covers entry-via-fbclid with no _fbc yet).
let fbcValue = firstValue(userData.fbc, eventData.fbc, eventData._fbc, getCookieValues('_fbc', true)[0]);
if (!fbcValue) {
  const fbclidCookie = getCookieValues('tagioo_fbclid', true)[0];
  if (fbclidCookie) fbcValue = 'fb.1.' + getTimestampMillis() + '.' + fbclidCookie;
}
addRaw(event.user_data, 'fbc', fbcValue);
addRaw(event.user_data, 'client_ip_address', firstValue(eventData.ip_override, getRequestHeader('x-forwarded-for'), getRequestHeader('x-real-ip')));
addRaw(event.user_data, 'client_user_agent', firstValue(eventData.user_agent, getRequestHeader('user-agent')));

addRaw(event.custom_data, 'currency', eventData.currency);
if (eventData.value !== undefined && eventData.value !== null && eventData.value !== '') {
  event.custom_data.value = eventData.value;
}
addRaw(event.custom_data, 'order_id', firstValue(eventData.transaction_id, eventData.order_id));
if (getType(eventData.items) === 'array') {
  let numItems = 0;
  const contentIds = [];
  event.custom_data.contents = eventData.items.map((item) => {
    const id = firstValue(item.item_id, item.id, item.item_name);
    if (id) contentIds.push(makeString(id));
    const qty = makeNumber(item.quantity) || 1;
    numItems = numItems + qty;
    return { id: id, quantity: item.quantity, item_price: item.price };
  });
  // content_ids + num_items drive Meta DPA / Advantage+ catalog retargeting and
  // match the browser Pixel's payload so the deduped event carries both.
  if (contentIds.length) event.custom_data.content_ids = contentIds;
  event.custom_data.content_type = 'product';
  if (numItems > 0) event.custom_data.num_items = numItems;
}

const body = { data: [event], partner_agent: 'tagioo-sgtm-1.0' };
if (data.testEventCode) body.test_event_code = data.testEventCode;

const url = 'https://graph.facebook.com/v20.0/' + data.pixelId + '/events?access_token=' + data.accessToken;
sendHttpRequest(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' }
}, JSON.stringify(body)).then((response) => {
  if (data.enableDebugLog) {
    logToConsole('Tagioo Meta CAPI response: ' + response.statusCode + ' ' + response.body);
  }
  if (response.statusCode >= 200 && response.statusCode < 300) {
    data.gtmOnSuccess();
  } else {
    data.gtmOnFailure();
  }
}, () => data.gtmOnFailure());


___SERVER_PERMISSIONS___

[
  {
    "instance": {
      "key": { "publicId": "read_event_data", "versionId": "1" },
      "param": [{ "key": "eventDataAccess", "value": { "type": 1, "string": "any" } }]
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "send_http", "versionId": "1" },
      "param": [
        { "key": "allowedUrls", "value": { "type": 1, "string": "specific" } },
        { "key": "urls", "value": { "type": 2, "listItem": [{ "type": 1, "string": "https://graph.facebook.com/" }] } }
      ]
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "get_cookies", "versionId": "1" },
      "param": [
        { "key": "cookieAccess", "value": { "type": 1, "string": "specific" } },
        { "key": "cookieNames", "value": { "type": 2, "listItem": [{ "type": 1, "string": "_fbp" }, { "type": 1, "string": "_fbc" }, { "type": 1, "string": "tagioo_fbclid" }, { "type": 1, "string": "FPID" }] } }
      ]
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "read_request", "versionId": "1" },
      "param": [
        { "key": "requestAccess", "value": { "type": 1, "string": "specific" } },
        { "key": "headerAccess", "value": { "type": 1, "string": "specific" } },
        { "key": "headersAllowed", "value": { "type": 8, "boolean": true } },
        {
          "key": "headerWhitelist",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 3, "mapKey": [{ "type": 1, "string": "headerName" }], "mapValue": [{ "type": 1, "string": "x-forwarded-for" }] },
              { "type": 3, "mapKey": [{ "type": 1, "string": "headerName" }], "mapValue": [{ "type": 1, "string": "x-real-ip" }] },
              { "type": 3, "mapKey": [{ "type": 1, "string": "headerName" }], "mapValue": [{ "type": 1, "string": "user-agent" }] },
              { "type": 3, "mapKey": [{ "type": 1, "string": "headerName" }], "mapValue": [{ "type": 1, "string": "referer" }] }
            ]
          }
        }
      ]
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "logging", "versionId": "1" },
      "param": [{ "key": "environments", "value": { "type": 1, "string": "debug" } }]
    },
    "isRequired": true
  }
]


___NOTES___

Generated by Tagioo Setup Assistant.`;
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
        { field: "Country / fbp / fbc / Client IP", value: "Leave on automatic — the template reads these from cookies and the incoming request." }
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

// Resolve the dedup id + the ecommerce object for the dataLayer message that
// actually fired this tag.
//
// The id comes from {{Tagioo - event_id}}, which resolves against the dataLayer
// state at the triggering message — NOT from scanning window.dataLayer at
// runtime. The old runtime scan took the newest event_id in the whole
// dataLayer, so on storefronts that push several events per page load (the
// WooCommerce plugin pushes a queued add_to_cart in wp_footer after
// begin_checkout renders in the body) the browser pixel attached the WRONG
// event's id while the server GA4 tag sent the right one — the two never
// deduplicated.
//
// The ecommerce object is then taken from the dataLayer push carrying that same
// event_id, falling back to the newest ecommerce object when the storefront
// sends no event_id at all. The comparison re-applies the variable's sanitiser
// so a storefront id containing stripped characters still matches its own push.
// GTM substitutes variables into custom HTML raw and writes the bare token
// `undefined` when a variable errors, hence the quoted read plus the
// "undefined" string guard.
const PIXEL_CONTEXT_SCRIPT =
  "var eid='{{Tagioo - event_id}}';if(eid==='undefined')eid='';" +
  "function s(v){return String(v).replace(/[^A-Za-z0-9_.:@-]/g,'').substring(0,120);}" +
  "var dl=window.dataLayer||[],ec=null,fb=null;" +
  "for(var i=dl.length-1;i>=0;i--){var e=dl[i];if(!e||!e.ecommerce)continue;" +
  "if(eid&&e.event_id&&s(e.event_id)===eid){ec=e.ecommerce;break;}if(!fb)fb=e.ecommerce;}" +
  "ec=ec||fb||{};";

// Browser-side Meta Pixel event tag. eventID is omitted entirely when no id
// exists, to avoid sending the literal string "undefined".
function metaPixelEventScript(metaEventName) {
  const orderId = metaEventName === "Purchase" ? "if(ec.transaction_id)p.order_id=ec.transaction_id;" : "";
  return "<script>(function(){" + PIXEL_CONTEXT_SCRIPT + "var pixel='{{Tagioo - meta_pixel_id}}';var sent=window.__tagiooMetaSent=window.__tagiooMetaSent||{};var key=pixel+'|" + metaEventName + "|'+(eid||location.href);if(sent[key])return;sent[key]=1;var items=ec.items||[];var ids=items.map(function(it){return String(it.item_id||it.id||'');});var contents=items.map(function(it){return {id:String(it.item_id||it.id||''),quantity:it.quantity||1,item_price:it.price};});var p={content_type:'product',content_ids:ids,contents:contents};if(ec.currency)p.currency=ec.currency;if(ec.value!=null&&ec.value!=='')p.value=ec.value;" + orderId + "if(window.fbq)fbq('track','" + metaEventName + "',p,eid?{eventID:String(eid)}:{});})();</script>";
}

// Browser-side TikTok Pixel event tag. Same message-anchored id + fallback.
function tiktokPixelEventScript(tiktokEventName) {
  return "<script>(function(){" + PIXEL_CONTEXT_SCRIPT + "var items=ec.items||[];var contents=items.map(function(it){return {content_id:String(it.item_id||it.id||''),content_name:it.item_name,quantity:it.quantity||1,price:it.price};});var p={contents:contents,content_type:'product'};if(ec.currency)p.currency=ec.currency;if(ec.value!=null&&ec.value!=='')p.value=ec.value;if(window.ttq)ttq.track('" + tiktokEventName + "',p,eid?{event_id:String(eid)}:{});})();</script>";
}

function cleanLaravelTrackerConfig(input) {
  const clean = (value, limit = 300) => String(value || "").trim().slice(0, limit);
  return {
    currency: clean(input.currency || "BDT", 12).toUpperCase(),
    productPattern: clean(input.laravelProductPattern),
    checkoutPattern: clean(input.laravelCheckoutPattern),
    purchasePattern: clean(input.laravelPurchasePattern),
    addToCartSelector: clean(input.laravelAddToCartSelector),
    orderIdSelector: clean(input.laravelOrderIdSelector),
    orderTotalSelector: clean(input.laravelOrderTotalSelector)
  };
}

// Browser-only storefront adapter for Laravel/custom shops. Laravel has no
// standard ecommerce DOM, so this deliberately prefers structured Product/Order
// JSON-LD and lets the no-code assistant supply URL/selector overrides. Purchase
// is never fabricated: both a real order id and a positive total are required.
function laravelAutoTrackerScript(input) {
  const configJson = JSON.stringify(cleanLaravelTrackerConfig(input)).replace(/</g, "\\u003c");
  return `<script>(function(){
if(window.__tagiooLaravelTracker)return;window.__tagiooLaravelTracker=true;
var cfg=${configJson},seen={},dl=window.dataLayer=window.dataLayer||[];
function text(sel){if(!sel)return'';try{var el=document.querySelector(sel);return el?String(el.getAttribute('content')||el.getAttribute('data-value')||el.textContent||'').trim():'';}catch(e){return'';}}
function within(root,sel){if(!sel)return'';try{var el=(root||document).querySelector(sel);return el?String(el.value||el.getAttribute('content')||el.getAttribute('data-value')||el.getAttribute('data-price')||el.textContent||'').trim():'';}catch(e){return'';}}
function meta(name){var el=document.querySelector('meta[property="'+name+'"],meta[name="'+name+'"]');return el?String(el.content||'').trim():'';}
function number(v){var s=String(v==null?'':v).replace(/[^0-9,.-]/g,'');if(s.indexOf(',')>-1&&s.indexOf('.')<0)s=s.replace(',','.');else s=s.replace(/,/g,'');var n=Number(s);return isFinite(n)?n:0;}
function id(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();return'tagioo-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);}
function typeIs(node,type){var t=node&&node['@type'];return Array.isArray(t)?t.indexOf(type)>-1:String(t||'').toLowerCase()===type.toLowerCase();}
function findType(node,type){if(!node||typeof node!=='object')return null;if(typeIs(node,type))return node;if(Array.isArray(node)){for(var i=0;i<node.length;i++){var a=findType(node[i],type);if(a)return a;}}else{for(var k in node){if(Object.prototype.hasOwnProperty.call(node,k)){var b=findType(node[k],type);if(b)return b;}}}return null;}
function schema(type){var nodes=document.querySelectorAll('script[type="application/ld+json"]');for(var i=0;i<nodes.length;i++){try{var found=findType(JSON.parse(nodes[i].textContent),type);if(found)return found;}catch(e){}}return null;}
function wildcard(pattern,value){if(!pattern)return false;var raw=String(pattern),escaped='';for(var i=0;i<raw.length;i++){var ch=raw.charAt(i);if(ch==='*'){escaped+='.*';continue;}if('^$+?.()|{}[]'.indexOf(ch)>-1)escaped+='\\\\';escaped+=ch;}try{return new RegExp('^'+escaped+'$','i').test(value);}catch(e){return false;}}
function matches(pattern){return wildcard(pattern,location.pathname)||wildcard(pattern,location.pathname+location.search)||wildcard(pattern,location.href);}
function offer(product){var o=product&&(Array.isArray(product.offers)?product.offers[0]:product.offers);return o||{};}
function product(root,strict){root=root||document;var p=schema('Product'),o=offer(p);var productSignal=within(root,'input[name="product_id"],[data-product-id],form[action*="cart/add"]');var detailSignal=within(document,'.product-title,h1[itemprop="name"],form.add-to-cart-detail');if(!p&&!cfg.productPattern&&!productSignal)return null;if(strict&&!p&&!cfg.productPattern&&!detailSignal)return null;if(cfg.productPattern&&!matches(cfg.productPattern)&&!p&&strict)return null;var price=number(o.price||o.lowPrice||meta('product:price:amount')||within(root,'[itemprop="price"],[data-price],.new-price,.sale-price,.product-price,.price'));var itemId=String((p&&(p.sku||p.productID||p.mpn))||meta('product:retailer_item_id')||within(root,'input[name="product_id"],[data-product-id],input[name="id"],input[name="product"]')||'').trim();var name=String((p&&p.name)||within(root,'.product-title,.product-name,[itemprop="name"],h1,h2,h3')||meta('og:title')||document.title||'').trim();var quantity=number(within(root,'input[name="quantity"],input[name="qty"],#qtyInput'))||1;if(!itemId)itemId=location.pathname.replace(/^\\/+|\\/+$/g,'').split('/').pop()||name;return{currency:String(o.priceCurrency||meta('product:price:currency')||cfg.currency||'BDT').toUpperCase(),value:price*quantity,items:[{item_id:itemId,item_name:name,price:price,quantity:quantity}]};}
function layerHas(event,from,externalOnly){for(var i=Math.max(0,from||0);i<dl.length;i++){var row=dl[i];if(row&&row.event===event&&(!externalOnly||!row.tagioo_auto))return true;}return false;}
function push(event,ecommerce,eventId){dl.push({ecommerce:null});dl.push({event:event,event_id:eventId||id(),ecommerce:ecommerce,tagioo_auto:true});}
function cartSave(ec){try{sessionStorage.setItem('tagioo_laravel_cart',JSON.stringify(ec));}catch(e){}}
function cartLoad(){try{return JSON.parse(sessionStorage.getItem('tagioo_laravel_cart')||'null');}catch(e){return null;}}
function fireView(from){var key='view:'+location.href;if(seen[key])return;if(layerHas('view_item',from||0,true)){seen[key]=1;return;}var ec=product(document,true);if(!ec)return;seen[key]=1;push('view_item',ec);}
function fireCheckout(from){var key='checkout:'+location.href;if(seen[key])return;if(layerHas('begin_checkout',from||0,true)){seen[key]=1;return;}var ec=cartLoad()||product(document,true);if(!ec)return;seen[key]=1;push('begin_checkout',ec);}
function orderItems(order){var rows=order&&(order.orderedItem||order.acceptedOffer);if(!rows)return(cartLoad()||{}).items||[];if(!Array.isArray(rows))rows=[rows];return rows.map(function(row){var item=row.itemOffered||row.item||row;var price=number(row.price||item.price);return{item_id:String(item.sku||item.productID||item.identifier||item.name||''),item_name:String(item.name||''),price:price,quantity:number(row.orderQuantity||row.quantity)||1};});}
function firePurchase(from){if(layerHas('purchase',from||0,true))return;var order=schema('Order');if(!order&&!cfg.purchasePattern)return;if(cfg.purchasePattern&&!matches(cfg.purchasePattern)&&!order)return;var orderId=String(text(cfg.orderIdSelector)||(order&&(order.orderNumber||order.orderId||order.identifier))||'').trim().replace(/^#+\s*/,'');var total=number(text(cfg.orderTotalSelector)||(order&&(order.price||order.totalPrice||(order.priceSpecification&&order.priceSpecification.price))));if(!orderId||total<=0)return;var storageKey='tagioo_purchase_'+orderId;try{if(localStorage.getItem(storageKey))return;localStorage.setItem(storageKey,'1');}catch(e){if(seen[storageKey])return;seen[storageKey]=1;}var currency=String((order&&(order.priceCurrency||(order.priceSpecification&&order.priceSpecification.priceCurrency)))||cfg.currency||'BDT').toUpperCase();push('purchase',{transaction_id:orderId,value:total,currency:currency,items:orderItems(order)},orderId);}
function scan(from){fireView(from);if(matches(cfg.checkoutPattern))fireCheckout(from);firePurchase(from);}
document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest?ev.target.closest('a,button,input[type="submit"],[role="button"]'):null;if(!el)return;var label=String(el.textContent||el.value||el.getAttribute('aria-label')||'').trim();var href=String(el.getAttribute('href')||''),hrefLower=href.toLowerCase();var isCart=false;if(cfg.addToCartSelector){try{isCart=!!ev.target.closest(cfg.addToCartSelector);}catch(e){}}if(!isCart)isCart=/add.{0,5}(to)?.{0,5}(cart|bag)|buy now|কার্ট|অর্ডার করুন/i.test(label)||hrefLower.indexOf('cart/add')>-1||hrefLower.indexOf('add-to-cart')>-1;if(isCart){if(layerHas('add_to_cart',0,true))return;var root=el.closest('form,.product-card,[data-product],article')||document;var ec=product(root,false),start=dl.length;if(ec)setTimeout(function(){if(layerHas('add_to_cart',start,true))return;cartSave(ec);push('add_to_cart',ec);},150);return;}if(/checkout|proceed.{0,6}(order|payment)|place order|চেকআউট|অর্ডার/i.test(label+' '+href)){var start=dl.length;if(!layerHas('begin_checkout',0,true))setTimeout(function(){fireCheckout(start);},150);}},false);
var oldPush=history.pushState,oldReplace=history.replaceState;function route(fn){return function(){var start=dl.length,result=fn.apply(this,arguments);setTimeout(function(){scan(start);},150);return result;};}history.pushState=route(oldPush);history.replaceState=route(oldReplace);window.addEventListener('popstate',function(){var start=dl.length;setTimeout(function(){scan(start);},150);});
function initialScan(){setTimeout(function(){scan(0);},150);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialScan);else initialScan();
})(window);</script>`;
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
    gtmDataLayerVariable(23, "dlv - ecommerce.coupon", "ecommerce.coupon"),
    gtmDataLayerVariable(24, "dlv - ecommerce.shipping", "ecommerce.shipping"),
    gtmDataLayerVariable(25, "dlv - ecommerce.tax", "ecommerce.tax"),
    gtmDataLayerVariable(33, "dlv - gtm.uniqueEventId", "gtm.uniqueEventId"),
    gtmDataLayerVariable(14, "dlv - user_data.email_address", "user_data.email_address"),
    gtmDataLayerVariable(15, "dlv - user_data.phone_number", "user_data.phone_number"),
    gtmDataLayerVariable(16, "dlv - user_data.first_name", "user_data.first_name"),
    gtmDataLayerVariable(17, "dlv - user_data.last_name", "user_data.last_name"),
    gtmDataLayerVariable(18, "dlv - user_data.external_id", "user_data.external_id"),
    gtmDataLayerVariable(19, "dlv - user_data.city", "user_data.city"),
    gtmDataLayerVariable(20, "dlv - user_data.country", "user_data.country"),
    gtmDataLayerVariable(21, "dlv - user_data.postal_code", "user_data.postal_code"),
    gtmDataLayerVariable(22, "dlv - user_data.region", "user_data.region"),
    {
      accountId: "0", containerId: "0", variableId: "30",
      name: "Tagioo - ga4 event settings", type: "gtes",
      parameter: [gtmListParam("eventSettingsTable", [
        { parameter: "server_container_url", parameterValue: "{{Tagioo - server_container_url}}" }
      ])],
      fingerprint: String(Date.now()), parentFolderId: "3"
    },
    // Explicit page context so every event (incl. AJAX add_to_cart) carries the
    // real URL + title. Without these, sGTM's GA4 client defaults page_location
    // to the request origin (homepage), corrupting GA4 page reports and the Meta
    // event_source_url forwarded downstream.
    {
      accountId: "0", containerId: "0", variableId: "31",
      name: "Tagioo - page_title", type: "jsm",
      parameter: [gtmTemplateParam("javascript", "function(){return document.title;}")],
      fingerprint: String(Date.now()), parentFolderId: "2"
    },
    // Single dedup key for every destination. Resolves, in order: the event_id
    // the storefront pushed with THIS dataLayer message, the transaction_id, then
    // GTM's Unique Event ID for a custom ecommerce event. That last value is
    // stable across every tag fired by one dataLayer push but changes for the
    // next real add-to-cart/view/checkout action. Plain page lifecycle events use
    // a generated per-URL id so the Pixel Base and DOM Ready GA4 PageView still
    // share one key even though GTM fires them during different lifecycle events.
    //
    // The result is inlined (quoted) into custom HTML tags, so it is restricted
    // to characters that cannot terminate the string literal or inject script.
    // Both the pixel tags and the GA4 tag read this same variable, so sanitising
    // here keeps the browser and server keys identical.
    {
      accountId: "0", containerId: "0", variableId: "32",
      name: "Tagioo - event_id", type: "jsm",
      parameter: [gtmTemplateParam("javascript", "function(){function s(v){return String(v).replace(/[^A-Za-z0-9_.:@-]/g,'').substring(0,120);}var e={{dlv - event_id}};if(e)return s(e);var t={{dlv - ecommerce.transaction_id}};if(t)return s(t);var n='{{Event}}';if(n&&n.indexOf('gtm.')!==0){var u={{dlv - gtm.uniqueEventId}};if(u)return s('tagioo-event-'+u);}var k=location.href;var c=window.__tagiooPageEventId;if(!c||c.k!==k){c={k:k,v:'tagioo-pv-'+(new Date()).getTime()+'-'+Math.random().toString(36).substring(2,10)};window.__tagiooPageEventId=c;}return c.v;}")],
      fingerprint: String(Date.now()), parentFolderId: "2"
    }
  ];
  const triggers = [
    { accountId: "0", containerId: "0", triggerId: "1", name: "Tagioo - DOM Ready PageView", type: "DOM_READY", fingerprint: String(Date.now()) },
    gtmTrigger(2, "Tagioo - view_item", "view_item"),
    gtmTrigger(3, "Tagioo - add_to_cart", "add_to_cart"),
    gtmTrigger(4, "Tagioo - begin_checkout", "begin_checkout"),
    gtmTrigger(5, "Tagioo - purchase", "purchase"),
    gtmTrigger(6, "Tagioo - add_payment_info", "add_payment_info"),
    gtmTrigger(7, "Tagioo - add_shipping_info", "add_shipping_info"),
    gtmTrigger(8, "Tagioo - view_item_list", "view_item_list")
  ];
  const tags = [];
  if (payload.businessType === "ecommerce" && payload.platform === "laravel") {
    tags.push(gtmTag(900, "Tagioo - Laravel Auto Tracker", "html", [
      gtmTemplateParam("html", laravelAutoTrackerScript(input))
    ], ["2147479553"], "2"));
  }
  if (destinations.includes("ga4")) {
    tags.push(gtmTag(1, "Tagioo GA4 - Config", "googtag", [
      gtmTemplateParam("tagId", "{{Tagioo - ga4_measurement_id}}"),
      gtmListParam("configSettingsTable", [
        { parameter: "server_container_url", parameterValue: "{{Tagioo - server_container_url}}" },
        { parameter: "send_page_view", parameterValue: "false" }
      ])
    ], ["2147479573"], "3"));
    const eventMap = [
      ["page_view", "1"], ["view_item", "2"], ["add_to_cart", "3"],
      ["begin_checkout", "4"], ["purchase", "5"],
      ["add_payment_info", "6"], ["add_shipping_info", "7"], ["view_item_list", "8"]
    ];
    for (const [eventName, triggerId] of eventMap) {
      const eventSettingsRows = [
        { parameter: "page_location", parameterValue: "{{Page URL}}" },
        { parameter: "page_title", parameterValue: "{{Tagioo - page_title}}" },
        { parameter: "event_id", parameterValue: "{{Tagioo - event_id}}" },
        { parameter: "user_data.email_address", parameterValue: "{{dlv - user_data.email_address}}" },
        { parameter: "user_data.phone_number", parameterValue: "{{dlv - user_data.phone_number}}" },
        { parameter: "user_data.first_name", parameterValue: "{{dlv - user_data.first_name}}" },
        { parameter: "user_data.last_name", parameterValue: "{{dlv - user_data.last_name}}" },
        { parameter: "user_data.external_id", parameterValue: "{{dlv - user_data.external_id}}" },
        { parameter: "user_data.city", parameterValue: "{{dlv - user_data.city}}" },
        { parameter: "user_data.country", parameterValue: "{{dlv - user_data.country}}" },
        { parameter: "user_data.postal_code", parameterValue: "{{dlv - user_data.postal_code}}" },
        { parameter: "user_data.region", parameterValue: "{{dlv - user_data.region}}" }
      ];
      if (["view_item", "add_to_cart", "begin_checkout", "add_payment_info", "add_shipping_info"].includes(eventName)) {
        eventSettingsRows.push(
          { parameter: "currency", parameterValue: "{{dlv - ecommerce.currency}}" },
          { parameter: "value", parameterValue: "{{dlv - ecommerce.value}}" },
          { parameter: "items", parameterValue: "{{dlv - ecommerce.items}}" }
        );
      }
      if (eventName === "view_item_list") {
        eventSettingsRows.push(
          { parameter: "items", parameterValue: "{{dlv - ecommerce.items}}" }
        );
      }
      if (eventName === "purchase") {
        eventSettingsRows.push(
          { parameter: "currency", parameterValue: "{{dlv - ecommerce.currency}}" },
          { parameter: "value", parameterValue: "{{dlv - ecommerce.value}}" },
          { parameter: "transaction_id", parameterValue: "{{dlv - ecommerce.transaction_id}}" },
          { parameter: "items", parameterValue: "{{dlv - ecommerce.items}}" },
          { parameter: "coupon", parameterValue: "{{dlv - ecommerce.coupon}}" },
          { parameter: "shipping", parameterValue: "{{dlv - ecommerce.shipping}}" },
          { parameter: "tax", parameterValue: "{{dlv - ecommerce.tax}}" }
        );
      }
      const tagObj = gtmTag(tags.length + 1, `Tagioo GA4 - ${eventName}`, "gaawe", [
        gtmBooleanParam("sendEcommerceData", false),
        gtmBooleanParam("enhancedUserId", false),
        gtmTemplateParam("eventName", eventName),
        gtmTemplateParam("measurementIdOverride", "{{Tagioo - ga4_measurement_id}}"),
        gtmTemplateParam("eventSettingsVariable", "{{Tagioo - ga4 event settings}}"),
        gtmListParam("eventSettingsTable", eventSettingsRows)
      ], [triggerId], "3");
      // A Livewire/Inertia storefront can legitimately push the same event type
      // several times without a page load. Keep legacy templates unchanged, but
      // let Laravel tags fire once for each dataLayer event.
      if (payload.platform !== "laravel") tagObj.tagFiringOption = "ONCE_PER_LOAD";
      tags.push(tagObj);
    }
  }
  if (destinations.includes("meta")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo Meta - Pixel Base", "html", [
      gtmTemplateParam("html", "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');(function(){var pixel='{{Tagioo - meta_pixel_id}}',init=window.__tagiooMetaInit=window.__tagiooMetaInit||{};if(!init[pixel]){fbq('init',pixel);init[pixel]=1;}var eid='{{Tagioo - event_id}}';if(eid==='undefined')eid='';var sent=window.__tagiooMetaSent=window.__tagiooMetaSent||{},key=pixel+'|PageView|'+(eid||location.href);if(sent[key])return;sent[key]=1;fbq('track','PageView',{},eid?{eventID:String(eid)}:{});})();</script>")
    ], ["2147479553"], "4"));
    // Browser pixel events, deduped with server CAPI via event_id.
    const metaEventMap = [
      ["view_item", "ViewContent", "2"],
      ["add_to_cart", "AddToCart", "3"],
      ["begin_checkout", "InitiateCheckout", "4"],
      ["add_payment_info", "AddPaymentInfo", "6"],
      ["purchase", "Purchase", "5"]
    ];
    for (const [eventName, metaEventName, triggerId] of metaEventMap) {
      const metaTag = gtmTag(tags.length + 1, `Tagioo Meta - ${metaEventName}`, "html", [
        gtmTemplateParam("html", metaPixelEventScript(metaEventName))
      ], [triggerId], "4");
      if (payload.platform !== "laravel") metaTag.tagFiringOption = "ONCE_PER_LOAD";
      tags.push(metaTag);
    }
  }
  if (destinations.includes("tiktok")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo TikTok - Pixel Base", "html", [
      gtmTemplateParam("html", "<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];var n=d.createElement('script');n.type='text/javascript';n.async=!0;n.src=i;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(n,a)};ttq.load('{{Tagioo - tiktok_pixel_id}}');ttq.page();}(window,document,'ttq');</script>")
    ], ["2147479553"], "6"));
    // Browser pixel events, deduped with server Events API via event_id.
    const tiktokEventMap = [
      ["view_item", "ViewContent", "2"],
      ["add_to_cart", "AddToCart", "3"],
      ["begin_checkout", "InitiateCheckout", "4"],
      ["add_payment_info", "AddPaymentInfo", "6"],
      ["purchase", "CompletePayment", "5"]
    ];
    for (const [eventName, tiktokEventName, triggerId] of tiktokEventMap) {
      const tiktokTag = gtmTag(tags.length + 1, `Tagioo TikTok - ${tiktokEventName}`, "html", [
        gtmTemplateParam("html", tiktokPixelEventScript(tiktokEventName))
      ], [triggerId], "6");
      if (payload.platform !== "laravel") tiktokTag.tagFiringOption = "ONCE_PER_LOAD";
      tags.push(tiktokTag);
    }
  }
  return gtmExport("web", "Tagioo Web GTM Template", payload, {
    tag: tags,
    trigger: triggers,
    variable: variables,
    folder: folders,
    builtInVariable: [
      { accountId: "0", containerId: "0", type: "EVENT", name: "Event" },
      { accountId: "0", containerId: "0", type: "PAGE_URL", name: "Page URL" }
    ]
  });
}

function buildServerGtmTemplate(input) {
  const destinations = selectedDestinations(input);
  const ga4ApiSecret = String(input.ga4ApiSecret || "").trim();
  const metaTestEventCode = String(input.metaTestEventCode || "").trim();
  // Cookie life extension: drive the GA4 server client's FPID max-age. When the
  // power-up is off we keep the long-lived 730d default; when on, use the chosen days.
  const cookieMaxAgeInSec = String((input.cookieExtensionEnabled ? clampCookieDays(input.cookieExtensionDays) : COOKIE_DAYS_DEFAULT) * 86400);
  const payload = {
    businessType: cleanTemplateValue(input.businessType, "ecommerce"),
    platform: cleanTemplateValue(input.platform, "custom"),
    destinations,
    trackingDomain: cleanTemplateValue(input.trackingDomain, "https://track.yourdomain.com"),
    galleryTemplates: tagiooGalleryTemplateGuide(destinations.filter((destination) => destination !== "meta")),
    fieldMappings: {
      ga4: ga4ApiSecret ? "Native server-side GA4 forwarding tag is included with the provided API secret." : "Native server-side GA4 forwarding tag is included. No placeholder API secret is sent.",
      googleAds: "Native Google Ads Conversion Linker, Purchase, and Remarketing tags are included.",
      meta: destinations.includes("meta") ? "Tagioo Meta CAPI custom template and all-events server tag are included. Import server.json into Server GTM, preview, then publish." : "Not selected.",
      tiktok: destinations.includes("tiktok") ? "Install the TikTok Events API template from the Server GTM Community Template Gallery, then map the fields listed in tagiooSetup.galleryTemplates." : "Not selected."
    }
  };
  const folders = [gtmFolder(1, "Tagioo - Config"), gtmFolder(2, "Tagioo - Event Data"), gtmFolder(3, "Tagioo - GA4"), gtmFolder(4, "Tagioo - Meta"), gtmFolder(5, "Tagioo - Google Ads"), gtmFolder(6, "Tagioo - TikTok")];
  const variables = [
    gtmConstVariable(1, "Tagioo - ga4_api_secret", ga4ApiSecret, "1"),
    gtmConstVariable(2, "Tagioo - meta_pixel_id", cleanTemplateValue(input.metaPixelId), "1"),
    gtmConstVariable(3, "Tagioo - meta_capi_token", cleanTemplateValue(input.metaAccessToken), "1"),
    gtmConstVariable(4, "Tagioo - meta_test_event_code", metaTestEventCode, "1"),
    gtmConstVariable(5, "Tagioo - google_ads_conversion_id", cleanTemplateValue(input.googleAdsConversionId), "1"),
    gtmConstVariable(6, "Tagioo - google_ads_purchase_label", cleanTemplateValue(input.googleAdsPurchaseLabel), "1"),
    gtmConstVariable(9, "Tagioo - google_ads_atc_label", cleanTemplateValue(input.googleAdsAddToCartLabel), "1"),
    gtmConstVariable(10, "Tagioo - google_ads_begin_checkout_label", cleanTemplateValue(input.googleAdsBeginCheckoutLabel), "1"),
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
    gtmEventDataVariable(33, "ed - first_name", "user_data.first_name"),
    gtmEventDataVariable(34, "ed - last_name", "user_data.last_name"),
    gtmEventDataVariable(35, "ed - external_id", "user_data.external_id"),
    gtmEventDataVariable(36, "ed - city", "user_data.city"),
    gtmEventDataVariable(37, "ed - country", "user_data.country"),
    gtmEventDataVariable(38, "ed - postal_code", "user_data.postal_code"),
    gtmEventDataVariable(39, "ed - region", "user_data.region")
  ];
  const triggers = [
    { accountId: "0", containerId: "0", triggerId: "1", name: "Tagioo - GA4 Client", type: "ALWAYS", filter: [{ type: "CONTAINS", parameter: [gtmTemplateParam("arg0", "{{Client Name}}"), gtmTemplateParam("arg1", "GA4")] }], fingerprint: String(Date.now()) },
    gtmTrigger(2, "Tagioo - GA4 purchase", "purchase", "GA4"),
    gtmTrigger(3, "Tagioo - GA4 add_to_cart", "add_to_cart", "GA4"),
    gtmTrigger(4, "Tagioo - GA4 begin_checkout", "begin_checkout", "GA4"),
    gtmTrigger(5, "Tagioo - GA4 add_payment_info", "add_payment_info", "GA4"),
    gtmTrigger(6, "Tagioo - GA4 view_item_list", "view_item_list", "GA4")
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
      parameter: [
        gtmTemplateParam("cookieDomain", "auto"),
        gtmBooleanParam("activateDefaultPaths", true),
        gtmTemplateParam("cookieMaxAgeInSec", cookieMaxAgeInSec),
        gtmTemplateParam("cookiePath", "/"),
        gtmBooleanParam("migrateFromJsClientId", false),
        gtmTemplateParam("cookieManagement", "server"),
        gtmTemplateParam("cookieName", "FPID")
      ],
      fingerprint: String(Date.now())
    });
    const ga4Params = [
      gtmBooleanParam("redactVisitorIp", false),
      gtmTemplateParam("epToIncludeDropdown", "all"),
      gtmTemplateParam("upToIncludeDropdown", "all")
    ];
    if (ga4ApiSecret) {
      ga4Params.push(gtmTemplateParam("apiSecret", "{{Tagioo - ga4_api_secret}}"));
    }
    tags.push(gtmTag(1, "Tagioo GA4 - Forward Events", "sgtmgaaw", ga4Params, ["1"], "3"));
  }
  if (destinations.includes("meta")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo Meta CAPI - All Events", "cvt_0_101", [
      gtmTemplateParam("pixelId", "{{Tagioo - meta_pixel_id}}"),
      gtmTemplateParam("accessToken", "{{Tagioo - meta_capi_token}}"),
      gtmTemplateParam("testEventCode", metaTestEventCode ? "{{Tagioo - meta_test_event_code}}" : ""),
      gtmTemplateParam("actionSource", "website"),
      gtmBooleanParam("enableDebugLog", true)
    ], ["1"], "4"));
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
    // Optional micro-conversions — only emitted when a label is supplied (wires the
    // previously-unused add_to_cart / begin_checkout server triggers).
    if (String(input.googleAdsAddToCartLabel || "").trim()) {
      tags.push(gtmTag(tags.length + 1, "Tagioo Google Ads - Add to Cart", "sgtmadsct", [
        gtmTemplateParam("productReportingDataSource", "EVENT"),
        gtmBooleanParam("enableConversionLinker", true),
        gtmBooleanParam("enableProductReporting", true),
        gtmTemplateParam("conversionId", "{{Tagioo - google_ads_conversion_id}}"),
        gtmTemplateParam("conversionLabel", "{{Tagioo - google_ads_atc_label}}"),
        gtmBooleanParam("rdp", false)
      ], ["3"], "5"));
    }
    if (String(input.googleAdsBeginCheckoutLabel || "").trim()) {
      tags.push(gtmTag(tags.length + 1, "Tagioo Google Ads - Begin Checkout", "sgtmadsct", [
        gtmTemplateParam("productReportingDataSource", "EVENT"),
        gtmBooleanParam("enableConversionLinker", true),
        gtmBooleanParam("enableProductReporting", true),
        gtmTemplateParam("conversionId", "{{Tagioo - google_ads_conversion_id}}"),
        gtmTemplateParam("conversionLabel", "{{Tagioo - google_ads_begin_checkout_label}}"),
        gtmBooleanParam("rdp", false)
      ], ["4"], "5"));
    }
  }
  const content = {
    tag: tags,
    trigger: triggers,
    variable: variables,
    folder: folders,
    builtInVariable: [
      { accountId: "0", containerId: "0", type: "EVENT_NAME", name: "Event Name" },
      { accountId: "0", containerId: "0", type: "CLIENT_NAME", name: "Client Name" }
    ],
    client: clients
  };
  if (destinations.includes("meta")) {
    content.customTemplate = [gtmCustomTemplate(101, "Tagioo Meta CAPI", tagiooMetaCapiTemplateData())];
  }
  return gtmExport("server", "Tagioo Server GTM Template", payload, content);
}

function buildSetupAssistantTemplates(input) {
  const destinations = selectedDestinations(input);
  const web = buildWebGtmTemplate({ ...input, destinations });
  const server = buildServerGtmTemplate({ ...input, destinations });
  const warnings = [];
  if (destinations.includes("tiktok")) {
    warnings.push("TikTok still requires the TikTok Events API template from the Server GTM Community Template Gallery before import.");
  }
  if (destinations.includes("meta")) {
    warnings.push("Meta CAPI is now included in server.json. Import, preview Server GTM, confirm the Meta tag returns 2xx, then publish.");
  }
  if (String(input.platform || "") === "laravel") {
    warnings.push("Laravel browser funnel tracking is included in web.json. Request Complete Managed Setup in Tagioo for reliable backend Purchase tracking, then verify one test order before publishing.");
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
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Sign in — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
    ${gtmHead()}
  </head>
  <body class="login-body">
    ${gtmNoscript()}
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
            <span class="lb-stat-num">15,000</span>
            <small>free events / month</small>
          </div>
          <div class="lb-stat">
            <span class="lb-stat-num">Dedicated</span>
            <small>container per client</small>
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
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Reset password — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
          <div class="lb-stat"><span class="lb-stat-num">15,000</span><small>free events / month</small></div>
          <div class="lb-stat"><span class="lb-stat-num">Dedicated</span><small>container per client</small></div>
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

// Web GTM container for tagioo.com's own funnel pages. Every page a paid visitor can
// land on needs it: a page without the container is invisible to tagioo's own GA4/Meta,
// so its visitors can't be measured or retargeted. Kept in one place because the funnel
// pages are rendered from three separate template functions here plus public/*.html.
const TAGIOO_GTM_ID = "GTM-MCR3FD4W";

// `seed` is pushed to the dataLayer BEFORE gtm.js loads so a tag can read it on the very
// first container load — used by the signup page to hand the browser the same event_id
// the server already sent to Meta CAPI (see the Lead forward in GET /signup).
function gtmHead(seed = "") {
  // Escape "<" so no value interpolated into the seed can close this inline <script>.
  // Callers already JSON-stringify their values; this is the belt-and-braces layer.
  const safeSeed = String(seed).replace(/</g, "\\u003c");
  return `${seed ? `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${safeSeed});</script>
    ` : ""}<!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${TAGIOO_GTM_ID}');</script>
    <!-- End Google Tag Manager -->`;
}

function gtmNoscript() {
  return `<!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${TAGIOO_GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->`;
}

function verifyPage({ email = "", error = "", info = "" } = {}) {
  const masked = email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 1)) + c);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Verify your email — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
    ${gtmHead()}
  </head>
  <body class="login-body">
    ${gtmNoscript()}
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
          <h2>Check your inbox.<br>Confirm it's you.</h2>
          <p>We sent a 6-digit code to your email. Enter it to activate your account and go live.</p>
        </div>
        <div class="su-steps">
          <div class="su-step su-step--done"><span class="su-step-num">1</span>Create your account</div>
          <div class="su-step su-step--active"><span class="su-step-num">2</span>Verify your email</div>
          <div class="su-step"><span class="su-step-num">3</span>Go live &amp; track</div>
        </div>
        <p class="lb-footer">© 2025 Tagioo · Made in Bangladesh 🇧🇩</p>
      </aside>

      <main class="login-form-panel su-form-panel">
        <div class="login-form-wrap su-form-wrap">
          <div class="lf-header su-anim" style="--d:0ms">
            <h1>Verify your email</h1>
            <p class="lf-subtitle">Enter the 6-digit code we sent to <strong>${escapeHtml(masked)}</strong>.</p>
          </div>
          ${error ? `<div class="lf-error su-anim" style="--d:40ms">${escapeHtml(error)}</div>` : ""}
          ${info ? `<div class="lf-plan-note su-anim" style="--d:40ms;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px 14px;margin-bottom:14px;color:#166534;font-size:14px">${escapeHtml(info)}</div>` : ""}

          <form method="post" action="/verify" class="lf-form" id="verifyForm">
            <div class="lf-field su-anim" style="--d:80ms">
              <label for="vCode">Verification code</label>
              <input id="vCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" style="letter-spacing:8px;font-size:20px;text-align:center" required autofocus />
            </div>
            <button type="submit" class="button button-primary full-width su-anim" style="--d:130ms">Verify &amp; continue</button>
          </form>

          <form method="post" action="/verify/resend" class="su-anim" style="--d:180ms;margin-top:14px;text-align:center">
            <p class="lf-subtitle" style="margin:0">Didn't get it? <button type="submit" class="lf-forgot-link" style="background:none;border:none;padding:0;cursor:pointer;color:inherit;text-decoration:underline">Resend code</button> · <a href="/signup" class="su-signin-link">Change email</a></p>
          </form>
        </div>
      </main>
    </div>
  </body>
</html>`;
}

// Standalone payment step shown after email verification for paid-plan signups.
// The customer sends money via bKash/Nagad, then submits the transaction ID here.
// A transaction ID is REQUIRED to reach the dashboard (POST /checkout gates entry);
// owner confirmation later flips the plan to active and emails the customer.
function checkoutPage({ instructions, error = "", values = {}, paddle = {} } = {}) {
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const cycle = billingCycleConfig[instructions.billingCycle] || billingCycleConfig.monthly;
  const cycleLabel = cycle.months === 1 ? "per month" : `every ${cycle.months} months`;
  const numberRow = (label, num) => num
    ? `<div class="co-number"><div class="co-number-info"><span>${label}</span><strong>${escapeHtml(num)}</strong></div><button type="button" class="co-copy" data-copy="${escapeHtml(num)}">Copy</button></div>`
    : "";
  const numbers = [numberRow("bKash", instructions.bkashNumber), numberRow("Nagad", instructions.nagadNumber)].join("");
  const methodChecked = (m) => values.method === m ? " checked" : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Complete payment — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
    <style>
      .co-summary{background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;padding:16px 18px;margin-bottom:18px}
      .co-summary .co-plan{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
      .co-summary .co-plan strong{font-size:22px;color:#3B0764}
      .co-summary .co-amount{font-size:22px;font-weight:800;color:#0F0A1E;white-space:nowrap}
      .co-summary .co-amount small{font-size:12px;font-weight:500;color:#7C6BA8;margin-left:4px}
      .co-summary .co-invoice{margin:6px 0 0;font-size:13px;color:#7C6BA8}
      .co-numbers{margin:0 0 18px}
      .co-number{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin-bottom:8px}
      .co-number-info span{display:block;font-size:12px;color:#5B6B8A}
      .co-number-info strong{font-size:16px;letter-spacing:.5px}
      .co-copy{background:#0F0A1E;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}
      .co-steps{margin:0 0 18px;padding-left:18px;color:#5B6B8A;font-size:14px;line-height:1.7}
      .co-methods{display:flex;gap:10px;margin-bottom:14px}
      .co-methods label{flex:1;border:1.5px solid #E5E7EB;border-radius:10px;padding:11px;text-align:center;cursor:pointer;font-weight:600;font-size:14px}
      .co-methods input{position:absolute;opacity:0}
      .co-methods input:checked + span{color:#3B0764}
      .co-methods label:has(input:checked){border-color:#7C3AED;background:#F5F3FF}
      .co-skip{margin:14px 0 0;text-align:center}
      .co-skip button{background:none;border:none;padding:0;color:#7C6BA8;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline}
      .co-skip button:hover{color:#3B0764}
      .co-skip small{display:block;margin-top:4px;font-size:12px;color:#8B93A7}
      .co-divider{display:flex;align-items:center;gap:10px;margin:18px 0;color:#8B93A7;font-size:12px;font-weight:600;text-transform:uppercase}
      .co-divider::before,.co-divider::after{content:"";flex:1;height:1px;background:#E5E7EB}
      .co-card-btn{width:100%;background:#0F0A1E;color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer}
      .co-card-btn:hover{background:#221845}
      .co-card-note{margin:8px 0 0;text-align:center;font-size:12px;color:#8B93A7}
    </style>
    ${gtmHead()}
  </head>
  <body class="login-body">
    ${gtmNoscript()}
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
          <h2>One last step.<br>Activate your plan.</h2>
          <p>${paddle.enabled ? "Pay by card — Visa, Mastercard, and more. Your plan activates instantly." : "Send the amount via bKash or Nagad, then enter your transaction ID. We verify it and activate your plan — usually within a few hours."}</p>
        </div>
        <div class="su-steps">
          <div class="su-step su-step--done"><span class="su-step-num">1</span>Create your account</div>
          <div class="su-step su-step--done"><span class="su-step-num">2</span>Verify your email</div>
          <div class="su-step su-step--active"><span class="su-step-num">3</span>Complete payment</div>
        </div>
        <p class="lb-footer">© 2025 Tagioo · Made in Bangladesh 🇧🇩</p>
      </aside>

      <main class="login-form-panel su-form-panel">
        <div class="login-form-wrap su-form-wrap">
          <div class="lf-header su-anim" style="--d:0ms">
            <h1>Complete your payment</h1>
            <p class="lf-subtitle">Pay to activate your <strong>${escapeHtml(instructions.plan)}</strong> plan.</p>
          </div>
          ${error ? `<div class="lf-error su-anim" style="--d:40ms">${escapeHtml(error)}</div>` : ""}

          <div class="co-summary su-anim" style="--d:60ms">
            <div class="co-plan">
              <strong>${escapeHtml(instructions.plan)}</strong>
              <span class="co-amount">${paddle.enabled ? `$${paddle.usdAmount}` : money(instructions.amount)}<small>${paddle.enabled ? "per month" : cycleLabel}</small></span>
            </div>
            <p class="co-invoice">Invoice ${escapeHtml(instructions.invoiceNo)}</p>
          </div>

          ${paddle.enabled ? `
          <button type="button" id="coPayCard" class="co-card-btn su-anim" style="--d:70ms">Pay with card — $${paddle.usdAmount}/mo</button>
          <p class="co-card-note su-anim" style="--d:75ms">Instant activation. Visa, Mastercard, and more — billed in USD via Paddle.</p>
          ` : `

          ${numbers ? `<div class="co-numbers su-anim" style="--d:80ms">${numbers}</div>` : ""}

          <ol class="co-steps su-anim" style="--d:100ms">
            <li>Open bKash or Nagad and choose <strong>Send Money</strong>.</li>
            <li>Send <strong>${money(instructions.amount)}</strong> to the number above.</li>
            <li>Enter the <strong>Transaction ID</strong> and your sending number below.</li>
          </ol>

          <form method="post" action="/checkout" class="lf-form" id="checkoutForm">
            <div class="co-methods su-anim" style="--d:120ms">
              <label><input type="radio" name="method" value="bkash"${methodChecked("bkash") || (!values.method ? " checked" : "")} /><span>bKash</span></label>
              <label><input type="radio" name="method" value="nagad"${methodChecked("nagad")} /><span>Nagad</span></label>
            </div>
            <div class="lf-field su-anim" style="--d:140ms">
              <label for="coTxn">Transaction ID</label>
              <input id="coTxn" name="txnId" type="text" placeholder="e.g. 9GH4K2LM7" value="${escapeHtml(values.txnId || "")}" required autofocus />
            </div>
            <div class="lf-field su-anim" style="--d:160ms">
              <label for="coSender">Your bKash / Nagad number</label>
              <input id="coSender" name="senderNumber" type="text" inputmode="numeric" placeholder="01XXXXXXXXX" value="${escapeHtml(values.senderNumber || "")}" required />
            </div>
            <button type="submit" class="button button-primary full-width su-anim" style="--d:190ms">Submit payment &amp; continue</button>
          </form>
          <p class="lf-subtitle su-anim" style="--d:220ms;margin-top:14px;text-align:center">${instructions.ownerWhatsApp ? `Trouble paying? <a class="su-signin-link" href="https://wa.me/${escapeHtml(instructions.ownerWhatsApp.replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener">Message us on WhatsApp →</a>` : ""}</p>
          `}
          <form method="post" action="/checkout/skip" class="co-skip su-anim" style="--d:240ms">
            <button type="submit">Not now — continue on the Free plan</button>
            <small>15,000 events every 30 days. Upgrade any time from Account &amp; Billing.</small>
          </form>
        </div>
      </main>
    </div>
    <script>
      document.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.addEventListener("click", () => {
          navigator.clipboard?.writeText(btn.dataset.copy).then(() => {
            const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = t; }, 1500);
          }).catch(() => {});
        });
      });
    </script>
    ${paddle.enabled ? `
    <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
    <script>
      (function () {
        if (${JSON.stringify(paddle.env)} === "sandbox" && Paddle.Environment) Paddle.Environment.set("sandbox");
        Paddle.Initialize({
          token: ${JSON.stringify(paddle.clientToken)},
          eventCallback: function (event) {
            // Activation happens async via the Paddle webhook, not this callback —
            // this just moves the customer off the checkout wall once Paddle
            // confirms the transaction. checkoutRequired() re-checks on load;
            // if the webhook hasn't landed yet the customer is safely back here.
            if (event.name === "checkout.completed") window.location.href = "/";
          }
        });
        var btn = document.getElementById("coPayCard");
        if (btn) {
          btn.addEventListener("click", function () {
            Paddle.Checkout.open({
              items: [{ priceId: ${JSON.stringify(paddle.priceId)}, quantity: 1 }],
              customData: { tenantId: ${JSON.stringify(paddle.tenantId)}, planName: ${JSON.stringify(paddle.planName)} }
            });
          });
        }
      })();
    </script>
    ` : ""}
  </body>
</html>`;
}

// `leadEventId` is set only on the request that actually forwarded a Lead to Meta CAPI
// (GET /signup, first visit of the day — see the tg_lead_sent guard). Passing it through
// lets GTM fire the browser-side Meta Pixel Lead with the SAME event_id, so Meta dedupes
// the pair into one event and stops classifying Lead as Conversions-API-only — which is
// what made it unselectable as an ad set's conversion event.
function signupPage(error = "", values = {}, { leadEventId = "" } = {}) {
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
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Create account — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
    ${gtmHead(leadEventId ? `{event:'tagioo_lead',tagioo_event_id:${JSON.stringify(leadEventId)}}` : "")}
  </head>
  <body class="login-body">
    ${gtmNoscript()}
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
            <input type="hidden" name="plan" value="${escapeHtml(values.plan || "")}" />
            <input type="hidden" name="billingCycle" value="${escapeHtml(values.billingCycle || "")}" />
            ${values.plan && values.plan !== "Free" ? `<div class="lf-plan-note su-anim" style="--d:60ms;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:12px 14px;margin-bottom:14px;color:#5B21B6;font-size:14px">You're signing up for the <strong>${escapeHtml(values.plan)}</strong> plan. After creating your account, you'll pay via bKash or Nagad to activate it.</div>` : ""}

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

// Only containers matching this pattern can be controlled from the panel, so a
// crafted request can never act on a non-sGTM container (e.g. the host's own db).
const SGTM_CONTAINER_RE = /^sgtm-[a-z0-9][a-z0-9-]*$/;

async function dockerContainerExists(containerName) {
  const exists = await systemCommand("docker", ["inspect", "--format", "{{.Name}}", containerName], { timeout: 8000, maxBuffer: 200000 });
  return exists.ok;
}

// Restart / stop / start an sGTM container. Owner-gated at the route; this layer
// re-validates the name and existence so it is safe regardless of caller.
async function controlContainerLifecycle(containerName, action) {
  if (!SGTM_CONTAINER_RE.test(containerName)) {
    return { ok: false, status: 400, error: "Only sgtm-* containers can be controlled." };
  }
  if (!["restart", "stop", "start"].includes(action)) {
    return { ok: false, status: 400, error: "Unsupported action." };
  }
  if (!(await dockerContainerExists(containerName))) {
    return { ok: false, status: 404, error: `Container ${containerName} not found.` };
  }
  const result = await systemCommand("docker", [action, containerName], { timeout: 30000, maxBuffer: 1024 * 1024 });
  if (!result.ok) {
    return { ok: false, status: 500, error: result.stderr || result.error || `docker ${action} failed.` };
  }
  return { ok: true, action, container: containerName };
}

async function findProvisioningRecordByContainer(containerName) {
  const db = await readDatabase();
  if (!db.available) return { db: null, request: null };
  const request = (db.data.provisioning?.requests || []).find((item) => item.containerName === containerName);
  return { db, request };
}

// Resize an sGTM container's memory/CPU caps. Applies live via `docker update`
// (no downtime) and persists into the compose file + provisioning record so a
// later recreate keeps the new limits.
async function resizeContainer(containerName, { memoryMb, cpuLimit } = {}) {
  if (!SGTM_CONTAINER_RE.test(containerName)) {
    return { ok: false, status: 400, error: "Only sgtm-* containers can be resized." };
  }
  const mb = Math.round(Number(memoryMb));
  const cpu = Number(cpuLimit);
  if (!Number.isFinite(mb) || mb < 256 || mb > 8192) {
    return { ok: false, status: 400, error: "memoryMb must be between 256 and 8192." };
  }
  if (!Number.isFinite(cpu) || cpu < 0.25 || cpu > 8) {
    return { ok: false, status: 400, error: "cpuLimit must be between 0.25 and 8." };
  }
  if (!(await dockerContainerExists(containerName))) {
    return { ok: false, status: 404, error: `Container ${containerName} not found.` };
  }

  // 1. Live update — immediate, no restart.
  const update = await systemCommand("docker", [
    "update",
    "--memory", `${mb}m`,
    "--memory-swap", `${mb}m`,
    "--cpus", cpu.toFixed(2),
    containerName
  ], { timeout: 20000, maxBuffer: 1024 * 1024 });
  if (!update.ok) {
    return { ok: false, status: 500, error: update.stderr || update.error || "docker update failed." };
  }

  // 2. Persist into compose + record (best effort; live cap already applied).
  let persisted = false;
  const { db, request } = await findProvisioningRecordByContainer(containerName);
  if (db && request?.plan?.composePath) {
    try {
      let yml = await readFile(request.plan.composePath, "utf8");
      yml = yml
        .replace(/mem_limit:\s*\S+/g, `mem_limit: ${mb}m`)
        .replace(/cpus:\s*"[^"]*"/g, `cpus: "${cpu.toFixed(2)}"`);
      await writeFile(request.plan.composePath, yml, "utf8");
      request.plan.dockerCompose = yml;
      request.resourceLimits = { ...(request.resourceLimits || {}), memoryMb: mb, cpuLimit: cpu.toFixed(2) };
      await writeDatabase(db.data);
      persisted = true;
    } catch {
      // compose file missing/unwritable — live update stands, persistence skipped
    }
  }
  return { ok: true, container: containerName, memoryMb: mb, cpuLimit: cpu.toFixed(2), persisted };
}

// Owner changes a customer's plan: updates billing limits on the stored tenant
// and auto-resizes that tenant's container to the new plan's mem/cpu profile.
async function changeTenantPlan(tenantId, planName) {
  if (!tenantId) return { ok: false, status: 400, error: "tenantId is required." };
  if (!planResourceProfiles[planName] || planName === "Customer") {
    return { ok: false, status: 400, error: "Unknown plan." };
  }
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 503, error: "Database unavailable." };
  const data = loaded.data;
  data.tenants ||= [];
  const index = data.tenants.findIndex((tenant) => tenant.id === tenantId);
  if (index === -1) {
    return { ok: false, status: 404, error: "Customer not found (the Default account cannot be changed here)." };
  }

  const previousPlan = data.tenants[index].plan;
  const profile = resourceProfileForPlan(planName);
  data.tenants[index] = {
    ...data.tenants[index],
    plan: planName,
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit + Number(data.tenants[index].extraContainers || 0),
    domainLimit: profile.domainLimit,
    monthlyAmount: monthlyAmountForPlan(planName) + Number(data.tenants[index].extraContainers || 0) * EXTRA_CONTAINER_PRICE,
    resourceLimits: { ...(data.tenants[index].resourceLimits || {}), memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit },
    planUpdatedAt: new Date().toISOString()
  };
  await writeDatabase(data);

  // Notify the customer their plan was changed by the Tagioo team (only on a real
  // change). Best-effort — never blocks the plan update.
  if (previousPlan !== planName) {
    const account = (data.customerAccounts || []).find((a) => a.tenantId === tenantId);
    const toEmail = account?.email || account?.username;
    if (toEmail) emailPlanUpgradedByAdmin(toEmail, account?.fullName || data.tenants[index].fullName, planName).catch(() => {});
  }

  // Auto-resize the tenant's container to match the new plan, if one exists.
  let resize = null;
  const request = (data.provisioning?.requests || []).find((item) => item.tenantId === tenantId && item.containerName);
  if (request?.containerName) {
    resize = await resizeContainer(request.containerName, { memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit });
  }
  return { ok: true, tenantId, plan: planName, requestLimit: profile.monthlyRequestLimit, resize };
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
        # Rewrite the googletagmanager.com host *inside* the proxied gtm.js so the
        # browser also fetches gtag/js (and other Google scripts) first-party.
        # gtm.js stores the host ("www.googletagmanager.com") and the path ("/gtag/js")
        # as separate literals and concatenates them at runtime, so matching the full
        # URL fails — we rewrite the bare host instead. Result: https + the rewritten
        # host + "/gtag/js" = https://<domain>/tagioo-loader/gtag/js, which this same
        # location proxies back to Google. Without this, the proxied script keeps
        # googletagmanager.com → Brave/uBlock block gtag/js → GA4 never inits → no
        # /g/collect, no CAPI. GA4 event data is unaffected: it transports to the
        # GA4 server_container_url (this domain), not googletagmanager.com.
        sub_filter_once off;
        sub_filter_types application/javascript text/javascript;
        sub_filter 'www.googletagmanager.com' '${domain}/tagioo-loader';
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

// Owner-facing error log: server exceptions and reported client-side JS errors
// land in the SQLite error_logs table (visible in Admin → Error Logs) and, at
// most once per distinct message per hour, trigger an email so a silent bug
// (like a crash that doesn't take the process down) doesn't go unnoticed.
const ERROR_EMAIL_INTERVAL_MS = 60 * 60 * 1000;

async function recordErrorLog(source, error, context = {}) {
  const message = error instanceof Error ? error.message : String(error?.message || error || "Unknown error");
  const stack = String(error?.stack || "");
  console.error(`[error-log:${source}] ${message}`);

  if (eventStore) {
    try {
      eventStore.insertErrorLog({ source, message, stack, context: JSON.stringify(context) });
    } catch (e) {
      console.error(`[error-log] failed to persist: ${e.message}`);
    }
  }

  const key = `error:${source}:${message}`.slice(0, 200);
  const now = Date.now();
  const last = alertMemory.get(key) || 0;
  if (now - last < ERROR_EMAIL_INTERVAL_MS) return;
  alertMemory.set(key, now);

  const to = config.customerSupportEmail;
  if (!to) return;
  sendEmail({
    to,
    subject: `⚠️ Tagioo error: ${message.slice(0, 80)}`,
    bodyHtml: [
      `<p style="font-size:18px;font-weight:900;margin:0 0 8px;color:#0F0A1E">New error logged</p>`,
      `<p style="color:#5B6B8A;margin:0 0 16px;line-height:1.6">Source: <strong>${escapeHtml(source)}</strong></p>`,
      `<pre style="white-space:pre-wrap;background:#F5F3FF;padding:12px;border-radius:8px;font-size:12px;color:#0F0A1E">${escapeHtml(message)}</pre>`,
      context.url ? `<p style="color:#5B6B8A;font-size:13px;margin:12px 0 0">${escapeHtml(context.method || "")} ${escapeHtml(context.url)}</p>` : "",
      `<p style="color:#9BA8C0;font-size:12px;margin:16px 0 0">Full details in Admin → Error Logs. Further "${escapeHtml(message.slice(0, 40))}" errors are muted for 1 hour.</p>`
    ].join("")
  }).catch(() => {});
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

  const inspectedContainers = await addDockerStats(await addDockerInspectState(containers));

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

// Live per-container CPU/memory from `docker stats`. Read-only snapshot
// (--no-stream). Merged onto containers by name; missing stats (e.g. stopped
// container) leave the fields null so the UI can show "—".
async function addDockerStats(containers) {
  if (!containers.length) return containers;

  const stats = await command("docker", [
    "stats",
    "--no-stream",
    "--format",
    "{{json .}}"
  ], { timeout: DOCKER_INSPECT_TIMEOUT_MS });

  if (!stats.ok) return containers;

  const byName = new Map();
  for (const line of stats.stdout.split("\n").filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      if (row.Name) byName.set(row.Name, row);
    } catch {
      // ignore malformed stats line
    }
  }

  const parsePercent = (value) => {
    const num = parseFloat(String(value || "").replace("%", ""));
    return Number.isFinite(num) ? num : null;
  };

  return containers.map((container) => {
    const row = byName.get(container.name);
    if (!row) {
      return { ...container, cpuPercent: null, memUsage: null, memLimit: null, memPercent: null };
    }
    // MemUsage looks like "123.4MiB / 512MiB"; split into usage / limit text.
    const [memUsage, memLimit] = String(row.MemUsage || "").split("/").map((part) => part.trim());
    return {
      ...container,
      cpuPercent: parsePercent(row.CPUPerc),
      memUsage: memUsage || null,
      memLimit: memLimit || null,
      memPercent: parsePercent(row.MemPerc)
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

// Tagioo serves Bangladesh ecommerce, so every "day" boundary — order counts,
// daily history snapshots, the today log window — is pinned to Asia/Dhaka
// (UTC+6, no DST) by offset math. This is independent of the server OS / nginx
// timezone: absolute instants are derived from each log line's own offset, then
// shifted into Dhaka, so day buckets are correct even on a UTC host.
const DHAKA_OFFSET_MS = 6 * 3600000;

function dhakaShifted(date = new Date()) {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return new Date(ms + DHAKA_OFFSET_MS);
}

function nginxDateToken(date = new Date()) {
  // Dhaka calendar date as an nginx-style "DD/Mon/YYYY" token (cache key only).
  const d = dhakaShifted(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")}/${months[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

function localDateKey(date = new Date()) {
  // YYYY-MM-DD in Asia/Dhaka regardless of process timezone.
  return dhakaShifted(date).toISOString().slice(0, 10);
}

// Dhaka calendar day (YYYY-MM-DD) for a raw nginx access-log line, using the
// line's own timezone offset. Returns null if the timestamp can't be parsed.
function nginxLineDhakaKey(line) {
  const m = String(line || "").match(/\[(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\]/);
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, zone] = m;
  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  if (!months[mon]) return null;
  const date = new Date(`${year}-${months[mon]}-${day}T${hh}:${mm}:${ss}${zone.slice(0, 3)}:${zone.slice(3)}`);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
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
  // Only the endpoint path may feed substring heuristics. The query string of a
  // GA4 /g/collect hit carries dl/dr (the visited *website* page URLs), so e.g.
  // dl=/shop/?orderby=price would match the "order" needle and be mislabeled a
  // Purchase. Event truth lives in the en= param, parsed separately below.
  let raw = String(pathname || "").split("?")[0].toLowerCase();
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
      queryValueFromParams(params, ["event_id", "eventId", "eid", "x-fb-event-id", "ep.event_id", "ep.eventId"]),
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
    payments: [],
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
        payments: parsed.payments || [],
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

// Short-TTL, in-flight-deduped read cache. The owner dashboard build fires ~7
// readDatabase() calls concurrently (6 collectors + catalog), each re-parsing
// the whole history.json — the dominant cost (~3.5s). This shares ONE parse
// across the burst. READ-ONLY callers only; mutating paths use readDatabase()
// directly (fresh copy) and writeDatabase() invalidates this cache.
const DB_READ_CACHE_TTL_MS = Number(process.env.DB_READ_CACHE_TTL_MS || 5000);
let dbReadCacheEntry = null;   // { at, loaded }
let dbReadInFlight = null;     // Promise<loaded>

async function readDatabaseCached() {
  const now = Date.now();
  if (dbReadCacheEntry && now - dbReadCacheEntry.at < DB_READ_CACHE_TTL_MS) {
    return dbReadCacheEntry.loaded;
  }
  if (dbReadInFlight) return dbReadInFlight;
  dbReadInFlight = readDatabase()
    .then((loaded) => {
      if (loaded.available) dbReadCacheEntry = { at: Date.now(), loaded };
      dbReadInFlight = null;
      return loaded;
    })
    .catch((error) => { dbReadInFlight = null; throw error; });
  return dbReadInFlight;
}

async function writeDatabase(data) {
  await mkdir(config.dataDir, { recursive: true });
  // Random suffix, not just the timestamp: two writes landing in the same
  // millisecond would otherwise share one temp file, interleave their bytes and
  // rename a corrupted history.json into place.
  const tempPath = `${databasePath}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, databasePath);
  dbReadCacheEntry = null;   // written data changed → drop the read cache
}

// ── Backups (history.json snapshots) ───────────────────────────────────────
// Local-VPS-only snapshots of the JSON database (tenants, payments, customer
// logins, settings). Kept as plain files under data/backups/, pruned to the
// newest BACKUPS_TO_KEEP. Not a substitute for offsite backup, but protects
// against a bad write, accidental delete, or owner mistake on this box.

function backupIdFor(date, random) {
  const stamp = date.toISOString().replace(/[-:.]/g, "").replace("Z", "").slice(0, 15);
  return `backup-${stamp}-${random}.json`;
}

async function pruneBackups() {
  const entries = await readdir(backupsDir).catch(() => []);
  const files = entries.filter((name) => BACKUP_ID_PATTERN.test(name)).sort().reverse();
  for (const name of files.slice(BACKUPS_TO_KEEP)) {
    await unlink(join(backupsDir, name)).catch(() => {});
  }
}

async function createBackup(source = "manual") {
  const loaded = await readDatabase();
  if (!loaded.available) throw new Error(loaded.detail || loaded.message || "Database unavailable.");
  await mkdir(backupsDir, { recursive: true });
  const now = new Date();
  const id = backupIdFor(now, randomBytes(3).toString("hex"));
  const payload = { id, createdAt: now.toISOString(), source, data: loaded.data };
  await writeFile(join(backupsDir, id), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await pruneBackups();
  return id;
}

async function listBackups() {
  const entries = await readdir(backupsDir).catch(() => []);
  const files = entries.filter((name) => BACKUP_ID_PATTERN.test(name)).sort().reverse();
  const backups = [];
  for (const name of files) {
    const path = join(backupsDir, name);
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    let meta = { createdAt: null, source: "manual" };
    try {
      const raw = JSON.parse(await readFile(path, "utf8"));
      meta = { createdAt: raw.createdAt || info.mtime.toISOString(), source: raw.source || "manual" };
    } catch { /* corrupt file: still list it so the owner can delete it */ }
    backups.push({ id: name, createdAt: meta.createdAt, source: meta.source, sizeBytes: info.size });
  }
  return backups;
}

function isValidBackupData(data) {
  return Boolean(data) && typeof data === "object" && Array.isArray(data.tenants) && Array.isArray(data.payments);
}

async function restoreBackupLocked(id) {
  if (!BACKUP_ID_PATTERN.test(id)) return { ok: false, status: 400, errors: ["Invalid backup id."] };
  const path = join(backupsDir, id);
  let payload;
  try {
    payload = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { ok: false, status: 404, errors: ["Backup not found or unreadable."] };
  }
  if (!isValidBackupData(payload.data)) return { ok: false, status: 400, errors: ["Backup file is not a valid database snapshot."] };
  await writeDatabase(payload.data);
  return { ok: true, id };
}

function restoreBackup(id) {
  return withDbLock(() => restoreBackupLocked(id));
}

async function deleteBackup(id) {
  if (!BACKUP_ID_PATTERN.test(id)) return { ok: false, status: 400, errors: ["Invalid backup id."] };
  await unlink(join(backupsDir, id)).catch(() => {});
  return { ok: true };
}

async function importBackupLocked(rawData) {
  if (!isValidBackupData(rawData)) return { ok: false, status: 400, errors: ["File is not a valid database snapshot (expected tenants/payments arrays)."] };
  await mkdir(backupsDir, { recursive: true });
  const now = new Date();
  const id = backupIdFor(now, randomBytes(3).toString("hex"));
  const payload = { id, createdAt: now.toISOString(), source: "import", data: rawData };
  await writeFile(join(backupsDir, id), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await pruneBackups();
  return { ok: true, id };
}

function importBackup(rawData) {
  return withDbLock(() => importBackupLocked(rawData));
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
    recentEvents: (summary.recentEvents || []).slice(0, config.eventLogLimit),
    // Keep purchases independently from the general event-log cap. On a busy day
    // the latest 500 events may contain only a handful of the day's orders even
    // though the aggregate purchase count correctly covers every stored line.
    purchaseEvents: (summary.purchaseEvents || (summary.recentEvents || []).filter((event) => event.eventName === "Purchase")).slice(0, 2000)
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
  // Dedicated multi-day Purchase feed for the Purchase Inspector. The generic
  // recentEvents cap is dominated by a busy day's traffic, which starves the
  // Week/Month views; pull Purchase rows across all retained days separately.
  const purchaseEvents = rows
    .flatMap((snapshot) => snapshot.purchaseEvents || (snapshot.recentEvents || []).filter((event) => event.eventName === "Purchase"))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 2000);
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
    purchaseEvents,
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
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100).map((item) => ({
    item_id: String(firstValue(item, ["item_id", "product_id", "id", "sku"]) || "").trim().slice(0, 200),
    item_name: String(firstValue(item, ["item_name", "product_name", "name", "title"]) || "").trim().slice(0, 500),
    price: parseMoney(firstValue(item, ["price", "unit_price", "amount"])),
    quantity: Math.max(1, Number(firstValue(item, ["quantity", "qty"]) || 1))
  })).filter((item) => item.item_id || item.item_name);

  return {
    id,
    amount,
    currency,
    createdAt: createdAt.toISOString(),
    tenantId,
    orderType,
    source: String(body.source || "webhook"),
    // Customer identifiers for purchase-recovery match quality. Captured so the
    // server-side forward can pass the real customer IP (and, later, hashed
    // email/phone) to Meta instead of the panel server's own IP.
    email: String(firstValue(body, ["email", "customer_email", "billing_email"]) || "").trim(),
    phone: String(firstValue(body, ["phone", "customer_phone", "billing_phone"]) || "").trim(),
    firstName: String(firstValue(body, ["first_name", "firstName", "billing_first_name"]) || "").trim(),
    lastName: String(firstValue(body, ["last_name", "lastName", "billing_last_name"]) || "").trim(),
    city: String(firstValue(body, ["city", "billing_city"]) || "").trim(),
    region: String(firstValue(body, ["region", "state", "billing_state"]) || "").trim(),
    postalCode: String(firstValue(body, ["postal_code", "postcode", "billing_postcode"]) || "").trim(),
    country: String(firstValue(body, ["country", "billing_country"]) || "").trim(),
    customerIp: String(firstValue(body, ["customer_ip", "customer_ip_address", "ip"]) || "").trim(),
    customerUserAgent: String(firstValue(body, ["customer_user_agent", "user_agent"]) || "").trim(),
    fbp: String(firstValue(body, ["fbp", "_fbp"]) || "").trim(),
    fbc: String(firstValue(body, ["fbc", "_fbc"]) || "").trim(),
    pageLocation: String(firstValue(body, ["page_location", "order_url", "url"]) || "").trim(),
    items,
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

// Laravel Bridge requests are signed over the exact raw body and a short-lived
// timestamp. This prevents payload tampering and rejects captured-request replay.
function isLaravelBridgeAuthorized(req, rawBody, secret) {
  if (!secret) return false;
  const timestamp = String(req.headers["x-tagioo-timestamp"] || "");
  const signature = String(req.headers["x-tagioo-signature"] || "");
  const seconds = Number(timestamp);
  if (!/^\d{10}$/.test(timestamp) || !Number.isFinite(seconds)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  return safeEqual(signature, expected);
}

// Paddle signs "ts:body" (colon-joined) with the webhook secret, sent as
// "Paddle-Signature: ts=<unix>;h1=<hex>". https://developer.paddle.com/webhooks/signature-verification
function isPaddleWebhookAuthorized(req, rawBody) {
  if (!config.paddleWebhookSecret) return false;
  const header = String(req.headers["paddle-signature"] || "");
  const parts = Object.fromEntries(header.split(";").map((kv) => kv.split("=")));
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const signedPayload = `${ts}:${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", config.paddleWebhookSecret).update(signedPayload).digest("hex");
  return safeEqual(h1, expected);
}

// WooCommerce sends date_created_gmt as "2026-06-12T08:00:00" with no timezone
// marker, so it must be pinned to UTC before Date parses it as local time.
function wooGmtDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`;
}

function normalizeWooOrderPayload(body, tenantId) {
  const billing = body.billing || {};
  return {
    order_id: String(body.id ?? body.order_id ?? "").trim(),
    total: body.total,
    currency: body.currency,
    created_at: wooGmtDate(body.date_created_gmt || body.date_created),
    tenant_id: tenantId || config.tenantId,
    order_type: sanitizeId(body.created_via || "") || "store",
    status: body.status,
    source: "woocommerce",
    // Flatten billing + client IP so normalizeOrderPayload picks them up for
    // purchase-recovery match quality.
    email: billing.email || "",
    phone: billing.phone || "",
    first_name: billing.first_name || "",
    last_name: billing.last_name || "",
    city: billing.city || "",
    state: billing.state || "",
    postcode: billing.postcode || "",
    country: billing.country || "",
    customer_ip: body.customer_ip_address || ""
  };
}

async function addOrderWebhook(body) {
  return withDbLock(() => addOrderWebhookLocked(body));
}

async function addOrderWebhookLocked(body) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const acceptedAt = new Date().toISOString();
  const order = { ...normalizeOrderPayload(body), receivedAt: acceptedAt };
  if (!order.id) return { ok: false, errors: ["Order id is required."] };

  const data = loaded.data;
  data.orders = data.orders || [];
  // Order numbers are only unique inside a store. Two Laravel/Woo tenants can
  // both have order "1", so panel-level idempotency must include the tenant.
  const index = data.orders.findIndex((item) => item.id === order.id && item.tenantId === order.tenantId);
  if (index === -1) data.orders.push(order);
  else data.orders[index] = { ...data.orders[index], ...order, updatedAt: acceptedAt };

  // Server-side purchase recovery: a real order arrived, so forward it to the
  // tenant's own sGTM as a GA4 Measurement Protocol purchase. GA4 dedupes by
  // transaction_id and Meta CAPI dedupes by event_id (both = order id), so this
  // recovers purchases the browser missed (ad blockers, iOS, payment redirects)
  // without double-counting the ones it caught. Fire-and-forget; never blocks
  // or fails the webhook response.
  const tenant = (data.tenants || []).find((item) => item.id === order.tenantId);
  const tracking = tenant?.tracking || null;
  if (tenant && order.source === "tagioo-cpanel-bridge" && tracking?.laravelSelfService?.active) {
    tenant.tracking = {
      ...tracking,
      laravelSelfService: {
        ...tracking.laravelSelfService,
        status: tracking.laravelSelfService.status === "live" ? "live" : "test_received",
        lastOrder: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receivedAt: acceptedAt
        },
        updatedAt: acceptedAt
      }
    };
  }
  const alreadyForwarded = index !== -1 && data.orders[index].forwardedToSgtmAt;
  // Recovery forwards via the gtag /g/collect path, which needs no api_secret —
  // only the measurement id + sGTM domain. (apiSecret was required here when the
  // forward used Measurement Protocol; keeping it gated on apiSecret silently
  // disabled recovery for any tenant that never set one.)
  const shouldForward =
    index === -1 &&
    !alreadyForwarded &&
    order.amount > 0 &&
    isPaidOrderStatus(order) &&
    tracking &&
    tracking.measurementId &&
    tracking.domain;
  if (shouldForward) {
    const stored = data.orders.find((item) => item.id === order.id && item.tenantId === order.tenantId);
    if (stored) stored.forwardedToSgtmAt = new Date().toISOString();
  }

  await writeDatabase(data);

  if (shouldForward) {
    // gtag /g/collect → GA4 purchase + the in-container Meta tag (IP/UA match only).
    forwardOrderToSgtm(order, tracking).catch(() => {});
    // Direct Meta CAPI with hashed email/phone/name/geo for high match quality.
    // Same event_id (order id) as the gtag path and the browser pixel, so Meta
    // dedupes to a single Purchase and merges the richer user data.
    sendOrderToMetaCapi(tenant, order).catch(() => {});
  }
  return { ok: true, order, created: index === -1 };
}

// Woo / generic statuses that represent a paid conversion. Unpaid carts
// (pending, failed, cancelled, refunded, draft) must not be forwarded.
const UNPAID_ORDER_STATUSES = new Set([
  "pending", "failed", "cancelled", "canceled", "refunded", "trash", "checkout-draft", "draft", "on-hold"
]);
function isPaidOrderStatus(order) {
  const status = String(order.raw?.status || "").trim().toLowerCase();
  if (!status) return true; // generic webhooks without a status are assumed paid orders
  return !UNPAID_ORDER_STATUSES.has(status);
}

// Deterministic GA4 client_id (format "uint32.uint32") derived from the order id,
// so webhook retries reuse the same pseudo-user instead of inflating user counts.
function mpClientId(seed) {
  const digest = createHash("sha256").update(String(seed)).digest();
  return `${digest.readUInt32BE(0)}.${digest.readUInt32BE(4)}`;
}

async function forwardOrderToSgtm(order, tracking) {
  // sGTM's GA4 client only claims the gtag collection paths (/g/collect); it has
  // no client that claims Measurement Protocol (/mp/collect), so MP posts return
  // 400 "unclaimed". Mirror a browser gtag purchase hit instead — the GA4 client
  // parses it and fires both the GA4 tag and the Meta CAPI tag. Both dedupe on
  // transaction_id (Meta event_id falls back to transaction_id), so this never
  // double-counts purchases the browser already caught.
  const params = new URLSearchParams({
    v: "2",
    tid: tracking.measurementId,
    cid: mpClientId(order.id),
    en: "purchase",
    _et: "1",
    cu: order.currency || "BDT",
    "ep.transaction_id": String(order.id),
    "epn.value": String(order.amount)
  });
  // event_source_url for Meta attribution, if the order carried one.
  if (order.pageLocation) params.set("dl", order.pageLocation);
  order.items.slice(0, 20).forEach((item, index) => {
    const fields = [];
    if (item.item_id) fields.push(`id${String(item.item_id).replace(/~/g, "")}`);
    if (item.item_name) fields.push(`nm${String(item.item_name).replace(/~/g, "")}`);
    if (item.price > 0) fields.push(`pr${item.price}`);
    if (item.quantity > 0) fields.push(`qt${item.quantity}`);
    if (fields.length) params.set(`pr${index + 1}`, fields.join("~"));
  });
  const endpoint = `${tracking.domain}/g/collect?${params.toString()}`;
  // Match quality: this fetch originates from the panel server, so without this
  // header Meta CAPI would record the panel's IP as the buyer's. Forward the real
  // customer IP via X-Forwarded-For — the Meta CAPI template reads it for
  // client_ip_address. Best-effort: if the tenant's nginx overwrites it, no harm.
  const headers = { "content-type": "text/plain;charset=UTF-8" };
  if (order.customerIp) headers["X-Forwarded-For"] = order.customerIp;
  if (order.customerUserAgent) headers["User-Agent"] = order.customerUserAgent;
  const forwardedCookies = [];
  if (order.fbp) forwardedCookies.push(`_fbp=${order.fbp}`);
  if (order.fbc) forwardedCookies.push(`_fbc=${order.fbc}`);
  if (forwardedCookies.length) headers.Cookie = forwardedCookies.join("; ");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers
    });
    if (!response.ok) {
      console.warn(`[orders] sGTM purchase forward for ${order.id} returned ${response.status}`);
    }
  } catch (error) {
    console.warn(`[orders] sGTM purchase forward for ${order.id} failed: ${error.message}`);
  }
}

// tagioo.com's own marketing/funnel tracking — distinct from any customer
// tenant's tracking config above. Same gtag /g/collect mechanism (GA4 client
// fires GA4 + the in-container Meta CAPI tag from one hit), pointed at
// tagioo's own container so signup/upgrade conversions land on tagioo's own
// GA4 property + Meta pixel, not the customer's.
const TAGIOO_OWN_TRACKING = {
  measurementId: process.env.TAGIOO_GA4_MEASUREMENT_ID || "G-BS35TPGHR8",
  domain: process.env.TAGIOO_SGTM_DOMAIN || "https://server.tagioo.com",
  // Pixel id isn't secret (already shipped client-side in the pixel base tag),
  // safe to default. The CAPI access token IS a secret — env var only, never
  // a hardcoded fallback, since this file is committed to git.
  metaPixelId: process.env.TAGIOO_META_PIXEL_ID || "1039411801891124",
  metaCapiToken: process.env.TAGIOO_META_CAPI_TOKEN || ""
};

// Snapshot the real visitor's match signals off an inbound request. Everything
// below sends to Meta server-to-server, which by default carries NONE of this —
// Meta then sees this VPS's own IP/UA on every event and match quality collapses
// (Lead sat at 3.0/10 for exactly this reason). Tagioo's own funnel only; never
// touches a customer tenant's tracking.
function tagiooVisitorContext(req) {
  if (!req || !req.headers) return null;
  const cookies = parseCookies(req.headers.cookie);
  const ip = getClientIp(req);
  // event_source_url is stripped of its query string on purpose: /signup can
  // carry ?email= prefill and that must never leave the box in a URL.
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "tagioo.com").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const path = String(req.url || "/").split("?")[0];
  // fbevents.js normally writes _fbc itself, but only once the pixel has loaded.
  // Rebuild it from the raw ?fbclid= when the ad click is still mid-landing.
  let fbc = cookies._fbc || "";
  if (!fbc) {
    const fbclid = new URL(req.url || "/", `${proto}://${host}`).searchParams.get("fbclid");
    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  return {
    ip: ip && ip !== "unknown" ? ip : "",
    ua: String(req.headers["user-agent"] || ""),
    fbp: cookies._fbp || "",
    fbc,
    vid: cookies.tg_vid || "",
    url: `${proto}://${host}${path}`
  };
}

// Merge a visitor snapshot into a Meta CAPI event. Mutates and returns `event`.
function applyTagiooVisitorContext(event, visitor) {
  if (!visitor) return event;
  const ud = (event.user_data ||= {});
  if (visitor.ip) ud.client_ip_address = visitor.ip;
  if (visitor.ua) ud.client_user_agent = visitor.ua;
  if (visitor.fbp) ud.fbp = visitor.fbp;
  if (visitor.fbc) ud.fbc = visitor.fbc;
  // tg_vid is tagioo's own stable per-visitor cookie (90d, set on first /signup
  // view). Hashed it's a valid external_id, so every event gets one for free.
  if (visitor.vid && !ud.external_id) {
    const ext = sha256Hex(visitor.vid);
    if (ext) ud.external_id = [ext];
  }
  if (visitor.url) event.event_source_url = visitor.url;
  return event;
}

// Meta rejects events older than 7 days and any event dated in the future. Backdate to
// `when` where that's inside the window, else fall back to now — a slightly-off event
// still lands, whereas a rejected one is lost entirely.
function capiEventTime(when) {
  const now = Date.now();
  const at = Date.parse(when || "");
  if (!Number.isFinite(at) || at > now || now - at > 7 * 86400000) return Math.floor(now / 1000);
  return Math.floor(at / 1000);
}

// Fire one tagioo-own Meta CAPI event. Centralises the pixel/token guard and the
// throwaway tenant shape sendMetaOfflineConversions expects.
// Warned at most once per process: a missing token silently drops every self-tracking
// event while GA4 (no token gate) keeps looking healthy, which reads from the outside as
// "Meta won't spend our budget" with nothing in the logs to explain it.
let warnedMissingTagiooCapiToken = false;

async function sendTagiooOwnMetaEvent(event, label) {
  if (!TAGIOO_OWN_TRACKING.metaPixelId || !TAGIOO_OWN_TRACKING.metaCapiToken) {
    if (!warnedMissingTagiooCapiToken) {
      warnedMissingTagiooCapiToken = true;
      const missing = [
        TAGIOO_OWN_TRACKING.metaPixelId ? "" : "TAGIOO_META_PIXEL_ID",
        TAGIOO_OWN_TRACKING.metaCapiToken ? "" : "TAGIOO_META_CAPI_TOKEN"
      ].filter(Boolean).join(" + ");
      console.warn(`[tagioo-self-track] ${missing} not set — dropping ALL tagioo-own Meta CAPI events (first drop: ${label}). Ad optimization is blind until this is fixed; run "pm2 restart tagioo --update-env" after setting it.`);
    }
    return;
  }
  const tagiooOwnTenant = { tracking: { meta: { pixelId: TAGIOO_OWN_TRACKING.metaPixelId, capiToken: TAGIOO_OWN_TRACKING.metaCapiToken } } };
  try {
    const result = await sendMetaOfflineConversions(tagiooOwnTenant, [event], { useTestCode: false });
    if (!result.ok) {
      console.warn(`[tagioo-self-track] Meta CAPI ${label} send: ${(result.fbErrors || [result.reason]).join("; ")}`);
    }
  } catch (error) {
    console.warn(`[tagioo-self-track] Meta CAPI ${label} send failed: ${error.message}`);
  }
}

async function forwardTagiooOwnEvent(eventName, { seed, eventParams = {}, pageLocation, visitor } = {}) {
  const params = new URLSearchParams({
    v: "2",
    tid: TAGIOO_OWN_TRACKING.measurementId,
    cid: mpClientId(seed),
    en: eventName,
    _et: "1",
    ...eventParams
  });
  if (pageLocation) params.set("dl", pageLocation);
  else if (visitor?.url) params.set("dl", visitor.url);
  const endpoint = `${TAGIOO_OWN_TRACKING.domain}/g/collect?${params.toString()}`;
  // Without these headers the hit looks like it came from the VPS itself: GA4
  // geolocates every signup to the datacentre and the in-container Meta tag has
  // no usable IP/UA/cookies. Nginx in front of sGTM appends its own hop to
  // x-forwarded-for, so the visitor stays first in the list.
  const headers = { "content-type": "text/plain;charset=UTF-8" };
  if (visitor?.ip) headers["x-forwarded-for"] = visitor.ip;
  if (visitor?.ua) headers["user-agent"] = visitor.ua;
  const forwardedCookies = [];
  if (visitor?.fbp) forwardedCookies.push(`_fbp=${visitor.fbp}`);
  if (visitor?.fbc) forwardedCookies.push(`_fbc=${visitor.fbc}`);
  if (forwardedCookies.length) headers.cookie = forwardedCookies.join("; ");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers
    });
    if (!response.ok) {
      console.warn(`[tagioo-self-track] ${eventName} forward returned ${response.status}`);
    }
  } catch (error) {
    console.warn(`[tagioo-self-track] ${eventName} forward failed: ${error.message}`);
  }
}

// Hashed name parts from a "Firstname Lastname" string.
function tagiooNameParts(fullNameRaw) {
  const fullName = String(fullNameRaw || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

// Direct Meta CAPI send for the Lead fired when a visitor opens /signup. Used to
// be gtag-forward-only, which meant Meta received the VPS's IP/UA and nothing
// else on all of them — the visitor context here is the whole point. Shares
// eventId with the gtag hit so Meta dedupes to a single Lead.
async function sendTagiooLeadToMetaCapi(visitor, eventId) {
  const event = applyTagiooVisitorContext({
    event_name: "Lead",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_id: eventId,
    user_data: {}
  }, visitor);
  if (!Object.keys(event.user_data).length) return;
  await sendTagiooOwnMetaEvent(event, "generate_lead");
}

// Direct Meta CAPI send for tagioo's own CompleteRegistration, mirroring
// sendOrderToMetaCapi below: the gtag forward above only reaches Meta through
// the in-container tag, so this carries the hashed email/phone/name plus the
// visitor's own IP/UA/fbp/fbc/external_id. Shares eventId with the gtag hit's
// ep.event_id so Meta dedupes to one CompleteRegistration instead of counting
// both. No-ops silently if TAGIOO_META_CAPI_TOKEN isn't set.
async function sendTagiooSignupToMetaCapi(values, eventId, visitor) {
  const { firstName, lastName } = tagiooNameParts(values.fullName);

  const userData = {};
  const em = sha256Hex(values.email); if (em) userData.em = [em];
  const ph = sha256Hex(values.phone, { digitsOnly: true }); if (ph) userData.ph = [ph];
  const fn = sha256Hex(firstName); if (fn) userData.fn = [fn];
  const ln = sha256Hex(lastName); if (ln) userData.ln = [ln];
  const country = sha256Hex(values.country); if (country) userData.country = [country];

  const event = applyTagiooVisitorContext({
    event_name: "CompleteRegistration",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_id: eventId,
    user_data: userData
  }, visitor);
  if (!Object.keys(event.user_data).length) return;
  await sendTagiooOwnMetaEvent(event, "sign_up");
}

// Same idea as sendTagiooSignupToMetaCapi, for the paid-conversion side: hashed
// email/phone/name from the tenant record (set at signup). Payment confirmation
// runs in an OWNER session, so there is no visitor request to read — the buyer's
// own IP/UA/fbp/fbc snapshot is replayed from tenant.tracking.tagiooVisitor,
// stored when they signed up. Shares eventId with the gtag hit so Meta dedupes
// to one Purchase.
async function sendTagiooPurchaseToMetaCapi(tenant, payment, eventId) {
  const { firstName, lastName } = tagiooNameParts(tenant?.fullName);

  const userData = {};
  const em = sha256Hex(tenant?.email); if (em) userData.em = [em];
  const ph = sha256Hex(tenant?.phone, { digitsOnly: true }); if (ph) userData.ph = [ph];
  const fn = sha256Hex(firstName); if (fn) userData.fn = [fn];
  const ln = sha256Hex(lastName); if (ln) userData.ln = [ln];
  const country = sha256Hex(tenant?.country); if (country) userData.country = [country];

  const value = Number(payment.amount);
  const event = applyTagiooVisitorContext({
    event_name: "Purchase",
    // The buyer paid at claim time; this runs whenever the owner gets round to
    // confirming, which can be a day later. Meta attributes on event_time, so
    // stamping "now" can push a conversion outside the click window and the ad
    // that produced it loses credit.
    event_time: capiEventTime(payment.claimedAt),
    action_source: "website",
    event_id: eventId,
    user_data: userData,
    custom_data: {
      currency: "BDT",
      order_id: String(payment.id),
      ...(Number.isFinite(value) ? { value } : {})
    }
  }, storedTagiooVisitor(tenant));
  if (!Object.keys(event.user_data).length) return;
  await sendTagiooOwnMetaEvent(event, "purchase");
}

// Mid-funnel pair between CompleteRegistration and the manually-confirmed Purchase.
// Without these, Meta sees free signup and then nothing until the owner confirms a bKash
// payment hours or days later — too sparse and too delayed to optimize on. Both carry the
// tenant's hashed identifiers plus the signup-time visitor snapshot, and share an event_id
// with a matching gtag forward so Meta dedupes each to a single event.
//
// InitiateCheckout: a paid plan was staged and the payment page shown.
// AddPaymentInfo:   the buyer submitted a bKash/Nagad transaction ID — the real moment of
//                   purchase intent, since owner confirmation after it is bookkeeping.
function tagiooBuyerUserData(tenant) {
  const { firstName, lastName } = tagiooNameParts(tenant?.fullName);
  const userData = {};
  const em = sha256Hex(tenant?.email); if (em) userData.em = [em];
  const ph = sha256Hex(tenant?.phone, { digitsOnly: true }); if (ph) userData.ph = [ph];
  const fn = sha256Hex(firstName); if (fn) userData.fn = [fn];
  const ln = sha256Hex(lastName); if (ln) userData.ln = [ln];
  const country = sha256Hex(tenant?.country); if (country) userData.country = [country];
  return userData;
}

async function sendTagiooFunnelEventToMetaCapi(eventName, tenant, { eventId, plan, amount, orderId, when, visitor } = {}) {
  const value = Number(amount);
  const event = applyTagiooVisitorContext({
    event_name: eventName,
    event_time: capiEventTime(when),
    action_source: "website",
    event_id: eventId,
    user_data: tagiooBuyerUserData(tenant),
    custom_data: {
      currency: "BDT",
      ...(plan ? { content_name: String(plan) } : {}),
      ...(orderId ? { order_id: String(orderId) } : {}),
      ...(Number.isFinite(value) ? { value } : {})
    }
  }, visitor || storedTagiooVisitor(tenant));
  if (!Object.keys(event.user_data).length) return;
  await sendTagiooOwnMetaEvent(event, eventName);
}

// Fire one mid-funnel step to BOTH tagioo's own GA4 (via the gtag forward) and Meta CAPI,
// sharing an event_id so Meta dedupes the pair. Resolves the tenant itself so callers stay
// one line. Never throws — attribution must not fail a plan change or a payment claim.
async function trackTagiooCheckoutStep(step, { tenantId, plan, amount, orderId, when, visitor } = {}) {
  const spec = {
    initiate_checkout: { ga: "begin_checkout", meta: "InitiateCheckout" },
    add_payment_info: { ga: "add_payment_info", meta: "AddPaymentInfo" }
  }[step];
  if (!spec || !tenantId) return;
  try {
    const loaded = await readDatabase();
    if (!loaded.available) return;
    const tenant = (loaded.data.tenants || []).find((item) => item.id === tenantId);
    if (!tenant) return;
    const eventId = `${step}_${orderId || tenantId}`;
    const value = Number(amount);
    await forwardTagiooOwnEvent(spec.ga, {
      seed: tenantId,
      visitor: visitor || storedTagiooVisitor(tenant),
      eventParams: {
        cu: "BDT",
        "ep.plan": String(plan || ""),
        "ep.tenant_id": tenantId,
        "ep.event_id": eventId,
        ...(Number.isFinite(value) ? { "epn.value": String(value) } : {}),
        ...(orderId ? { "ep.transaction_id": String(orderId) } : {})
      }
    });
    await sendTagiooFunnelEventToMetaCapi(spec.meta, tenant, { eventId, plan, amount, orderId, when, visitor });
  } catch {
    // Ignored on purpose — see above.
  }
}

// Replay a stored signup-time visitor snapshot. IP and user agent are dropped
// once they're older than a week: Meta treats a stale IP/UA pair as a wrong
// signal rather than a missing one, while fbp/fbc/tg_vid stay valid for months.
function storedTagiooVisitor(tenant) {
  const saved = tenant?.tracking?.tagiooVisitor;
  if (!saved) return null;
  const savedAt = Date.parse(saved.at || "");
  const fresh = Number.isFinite(savedAt) && Date.now() - savedAt < 7 * 24 * 60 * 60 * 1000;
  return {
    ip: fresh ? saved.ip || "" : "",
    ua: fresh ? saved.ua || "" : "",
    fbp: saved.fbp || "",
    fbc: saved.fbc || "",
    vid: saved.vid || "",
    url: saved.url || ""
  };
}

// Persist the signup-time visitor snapshot on the tenant so a later owner-side
// payment confirmation can still attribute the Purchase to the real buyer.
// Additive key under `tracking` — nothing on the customer tracking read path
// looks at it.
async function saveTagiooVisitorContext(tenantId, visitor) {
  if (!tenantId || !visitor) return;
  try {
    // Read-modify-write of the whole tenant list — take the same lock the billing
    // writes use so this can't clobber a concurrent plan/payment change.
    await withDbLock(async () => {
      const loaded = await readDatabase();
      if (!loaded.available) return;
      const data = loaded.data;
      const index = (data.tenants || []).findIndex((tenant) => tenant.id === tenantId);
      if (index === -1) return;
      const tracking = { ...(data.tenants[index].tracking || {}) };
      tracking.tagiooVisitor = { at: new Date().toISOString(), ...visitor };
      data.tenants[index] = { ...data.tenants[index], tracking };
      await writeDatabase(data);
    });
  } catch {
    // Attribution bookkeeping must never fail a signup or a payment claim.
  }
}

// Direct Meta Conversions API send for a recovered order, reusing the offline
// hashing (sha256Hex) and sender (sendMetaOfflineConversions). Runs alongside the
// gtag forward: the gtag path covers GA4 and triggers the in-container Meta tag
// (IP/UA match only), while this adds hashed email/phone/name/geo for high match
// quality. Both carry event_id = order.id, so Meta dedupes to a single Purchase
// and merges the richer user data — no double counting. Fire-and-forget.
async function sendOrderToMetaCapi(tenant, order) {
  const meta = (tenant && tenant.tracking && tenant.tracking.meta) || {};
  if (!meta.pixelId || !meta.capiToken) return;

  const userData = {};
  const em = sha256Hex(order.email); if (em) userData.em = [em];
  const ph = sha256Hex(order.phone, { digitsOnly: true }); if (ph) userData.ph = [ph];
  const fn = sha256Hex(order.firstName); if (fn) userData.fn = [fn];
  const ln = sha256Hex(order.lastName); if (ln) userData.ln = [ln];
  const ct = sha256Hex(order.city); if (ct) userData.ct = [ct];
  const st = sha256Hex(order.region); if (st) userData.st = [st];
  const zp = sha256Hex(order.postalCode); if (zp) userData.zp = [zp];
  const country = sha256Hex(order.country); if (country) userData.country = [country];
  if (order.customerIp) userData.client_ip_address = order.customerIp;
  if (order.customerUserAgent) userData.client_user_agent = order.customerUserAgent;
  if (order.fbp) userData.fbp = order.fbp;
  if (order.fbc) userData.fbc = order.fbc;
  // Meta needs at least one user-data key to match the event to a person.
  if (!Object.keys(userData).length) return;

  const customData = { currency: order.currency || "BDT", order_id: String(order.id) };
  const value = Number(order.amount);
  if (Number.isFinite(value)) customData.value = value;
  if (order.items.length) {
    customData.content_type = "product";
    customData.content_ids = order.items.map((item) => String(item.item_id || "")).filter(Boolean);
    customData.contents = order.items.map((item) => ({
      id: String(item.item_id || ""),
      quantity: item.quantity || 1,
      item_price: item.price || 0
    })).filter((item) => item.id);
    customData.num_items = order.items.reduce((total, item) => total + Number(item.quantity || 1), 0);
  }

  const event = {
    event_name: "Purchase",
    event_time: offlineEventTime(order.createdAt),
    action_source: "website",
    event_id: String(order.id),
    user_data: userData,
    custom_data: customData
  };
  if (order.pageLocation) event.event_source_url = order.pageLocation;

  try {
    const result = await sendMetaOfflineConversions(tenant, [event], { useTestCode: false });
    if (!result.ok) {
      console.warn(`[orders] Meta CAPI recovery for ${order.id}: ${(result.fbErrors || [result.reason]).join("; ")}`);
    }
  } catch (error) {
    console.warn(`[orders] Meta CAPI recovery for ${order.id} failed: ${error.message}`);
  }
}

// Live tracking self-test for the Setup Assistant. Confirms the two things a
// customer can silently get wrong: (1) the sGTM container is published and its
// GA4 client claims the gtag path, (2) the Meta pixel id + CAPI token are valid.
// A green wizard otherwise proves neither — traffic can exist while Meta is dead.
async function verifyTenantTracking(tenant) {
  const tracking = (tenant && tenant.tracking) || {};
  const checks = {};

  // 1. Container + GA4 client. A non-commerce event name keeps purchase metrics
  // clean; an unpublished container has no client to claim it and returns 4xx.
  if (tracking.domain && tracking.measurementId) {
    const params = new URLSearchParams({
      v: "2",
      tid: tracking.measurementId,
      cid: mpClientId(`verify-${tenant.id}`),
      en: "tagioo_verify",
      _et: "1"
    });
    try {
      const r = await fetch(`${tracking.domain}/g/collect?${params.toString()}`, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" }
      });
      checks.container = r.ok
        ? { ok: true, detail: "sGTM reachable and the GA4 client is live (container published)." }
        : { ok: false, detail: `sGTM returned ${r.status}. Import server.json into Server GTM and click Publish.` };
    } catch (error) {
      checks.container = { ok: false, detail: `Could not reach ${tracking.domain}: ${error.message}. Check DNS/SSL.` };
    }
  } else {
    checks.container = { ok: false, detail: "Set your GA4 Measurement ID and tracking domain first." };
  }

  // 2. GA4 forward creds. The container check proves sGTM claims the hit, but the
  // server-side GA4 tag forwards to Google with measurementId + apiSecret — an
  // invalid/blank secret breaks GA4 silently while the container check stays green.
  // The MP debug endpoint validates the pair without recording data.
  if (tracking.measurementId && tracking.apiSecret) {
    try {
      const r = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(tracking.measurementId)}&api_secret=${encodeURIComponent(tracking.apiSecret)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: mpClientId(`verify-${tenant.id}`),
            events: [{ name: "tagioo_verify", params: { engagement_time_msec: 1 } }]
          })
        }
      );
      const body = await r.json().catch(() => ({}));
      const messages = Array.isArray(body.validationMessages) ? body.validationMessages : [];
      checks.ga4 = r.ok && messages.length === 0
        ? { ok: true, detail: "GA4 Measurement ID + API secret valid. sGTM can forward events to GA4." }
        : { ok: false, detail: `GA4 rejected the pair: ${messages.map((m) => m.description || m.code).join("; ") || `HTTP ${r.status}`}. Check Measurement ID + API secret.` };
    } catch (error) {
      checks.ga4 = { ok: false, detail: `Could not validate GA4 creds: ${error.message}.` };
    }
  } else {
    checks.ga4 = { ok: false, detail: "Add your GA4 Measurement ID and API secret to verify forwarding to GA4." };
  }

  // 3. Meta CAPI creds. test_event_code keeps this out of production reporting;
  // events_received > 0 with no error means the pixel id + token are valid.
  const meta = tracking.meta || {};
  if (meta.pixelId && meta.capiToken) {
    const verifyTenant = {
      ...tenant,
      tracking: { ...tracking, meta: { ...meta, testEventCode: meta.testEventCode || "TAGIOO_VERIFY" } }
    };
    const event = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_id: `tagioo-verify-${Date.now()}`,
      user_data: { external_id: [sha256Hex(`tagioo-verify-${tenant.id}`)] },
      custom_data: { currency: "BDT", value: 0 }
    };
    const result = await sendMetaOfflineConversions(verifyTenant, [event], { useTestCode: true });
    checks.meta = result.ok && result.sent > 0
      ? { ok: true, detail: "Meta pixel + CAPI token valid. Test event delivered — see Events Manager → Test Events." }
      : { ok: false, detail: `Meta rejected the test: ${(result.fbErrors || [result.reason || "unknown error"]).join("; ")}. Check pixel id + CAPI token.` };
  } else {
    checks.meta = { ok: false, detail: "Add your Meta Pixel ID and Conversions API token first." };
  }

  return { ok: Boolean(checks.container?.ok && checks.ga4?.ok && checks.meta?.ok), checks, at: new Date().toISOString() };
}

// Persist the latest verification result so the Setup Assistant can show it on load.
async function recordTenantVerify(tenantId, result) {
  if (!tenantId) return;
  try {
    const loaded = await readDatabase();
    if (!loaded.available) return;
    const data = loaded.data;
    data.tenants ||= [];
    const index = data.tenants.findIndex((tenant) => tenant.id === tenantId);
    if (index === -1) return;
    const tracking = { ...(data.tenants[index].tracking || {}) };
    tracking.lastVerify = result;
    data.tenants[index] = { ...data.tenants[index], tracking };
    await writeDatabase(data);
  } catch {
    // Recording the result must never fail the verification response.
  }
}

async function saveTenantTrackingConfig(tenantId, input) {
  if (!tenantId) return;
  try {
    const loaded = await readDatabase();
    if (!loaded.available) return;
    const data = loaded.data;
    data.tenants ||= [];
    const index = data.tenants.findIndex((tenant) => tenant.id === tenantId);
    if (index === -1) return;
    const measurementId = String(input.ga4MeasurementId || "").trim();
    const apiSecret = String(input.ga4ApiSecret || "").trim();
    const domain = trackingOrigin(input.trackingDomain);
    const metaPixelId = String(input.metaPixelId || "").trim();
    const metaCapiToken = String(input.metaAccessToken || input.metaCapiToken || "").trim();
    const metaTestEventCode = String(input.metaTestEventCode || "").trim();
    const tracking = { ...(data.tenants[index].tracking || {}) };
    if (measurementId) tracking.measurementId = measurementId;
    if (apiSecret) tracking.apiSecret = apiSecret;
    if (domain) tracking.domain = domain;
    // Persist Meta CAPI creds so server-side offline conversion uploads can reuse them.
    if (metaPixelId || metaCapiToken || metaTestEventCode) {
      const meta = { ...(tracking.meta || {}) };
      if (metaPixelId) meta.pixelId = metaPixelId;
      if (metaCapiToken) meta.capiToken = metaCapiToken;
      if (metaTestEventCode) meta.testEventCode = metaTestEventCode;
      tracking.meta = meta;
    }
    // Cookie life extension: drives the GA4 server client's FPID cookie max-age.
    if (input.cookieExtensionEnabled !== undefined || input.cookieExtensionDays !== undefined) {
      const prev = tracking.cookieExtension || {};
      tracking.cookieExtension = {
        enabled: input.cookieExtensionEnabled !== undefined ? Boolean(input.cookieExtensionEnabled) : Boolean(prev.enabled),
        days: clampCookieDays(input.cookieExtensionDays !== undefined ? input.cookieExtensionDays : prev.days)
      };
    }
    tracking.updatedAt = new Date().toISOString();
    data.tenants[index] = { ...data.tenants[index], tracking };
    await writeDatabase(data);
  } catch {
    // Persisting tracking config must never block template generation.
  }
}

// Cookie life extension days → clamped int. Baseline 730 (matches the GA4 server
// client default of 63072000s); Meta/Google cap first-party cookie life at ~730d.
const COOKIE_DAYS_DEFAULT = 730;
const COOKIE_DAYS_MAX = 730;
function clampCookieDays(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return COOKIE_DAYS_DEFAULT;
  return Math.min(Math.max(n, 1), COOKIE_DAYS_MAX);
}

// Client-safe view of a tenant's tracking config — never leaks the CAPI token.
function publicTenantTracking(tenant) {
  const tracking = (tenant && tenant.tracking) || {};
  const meta = tracking.meta || {};
  const cookieExtension = tracking.cookieExtension || {};
  const laravelManagedSetup = tracking.laravelManagedSetup || {};
  const laravelSelfService = tracking.laravelSelfService || {};
  return {
    domain: tracking.domain || "",
    measurementId: tracking.measurementId || "",
    meta: {
      pixelId: meta.pixelId || "",
      hasToken: Boolean(meta.capiToken),
      testEventCode: meta.testEventCode || ""
    },
    cookieExtension: {
      enabled: Boolean(cookieExtension.enabled),
      days: clampCookieDays(cookieExtension.days)
    },
    laravelManagedSetup: laravelManagedSetup.status ? {
      status: String(laravelManagedSetup.status),
      storeUrl: String(laravelManagedSetup.storeUrl || ""),
      currency: String(laravelManagedSetup.currency || "BDT"),
      requestedAt: laravelManagedSetup.requestedAt || "",
      updatedAt: laravelManagedSetup.updatedAt || ""
    } : null,
    laravelSelfService: publicLaravelSelfService(laravelSelfService),
    offlineUploads: Array.isArray(tracking.offlineUploads) ? tracking.offlineUploads.slice(0, 20) : [],
    lastVerify: tracking.lastVerify || null,
    updatedAt: tracking.updatedAt || ""
  };
}

function bridgeIdentifier(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_]+$/.test(text) ? text : "";
}

function bridgeStringList(value, limit = 120) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => bridgeIdentifier(item))
    .filter(Boolean))].slice(0, limit);
}

function sanitizeLaravelBridgeMapping(input = {}) {
  const columnsInput = input.columns && typeof input.columns === "object" ? input.columns : {};
  const itemColumnsInput = input.item_columns && typeof input.item_columns === "object" ? input.item_columns : {};
  const allowedColumns = ["id", "primary", "total", "created", "updated", "currency", "status", "email", "phone", "first_name", "last_name", "city", "state", "postcode", "country", "ip", "user_agent"];
  const allowedItemColumns = ["order_id", "item_id", "name", "price", "quantity"];
  const columns = Object.fromEntries(allowedColumns
    .map((key) => [key, bridgeIdentifier(columnsInput[key])])
    .filter(([, value]) => value));
  const itemColumns = Object.fromEntries(allowedItemColumns
    .map((key) => [key, bridgeIdentifier(itemColumnsInput[key])])
    .filter(([, value]) => value));
  const paidStatuses = [...new Set((Array.isArray(input.paid_statuses) ? input.paid_statuses : [])
    .map((item) => String(item || "").trim().toLowerCase().slice(0, 40))
    .filter((item) => /^[a-z0-9 _-]+$/.test(item)))].slice(0, 20);
  return {
    orders_table: bridgeIdentifier(input.orders_table),
    items_table: bridgeIdentifier(input.items_table),
    columns,
    item_columns: itemColumns,
    paid_statuses: paidStatuses
  };
}

function sanitizeLaravelBridgeReport(input = {}) {
  const ordersInput = input.orders && typeof input.orders === "object" ? input.orders : {};
  const itemsInput = input.items && typeof input.items === "object" ? input.items : {};
  const detectedInput = ordersInput.detected && typeof ordersInput.detected === "object" ? ordersInput.detected : {};
  const itemDetectedInput = itemsInput.detected && typeof itemsInput.detected === "object" ? itemsInput.detected : {};
  const detected = Object.fromEntries(Object.entries(detectedInput)
    .slice(0, 30)
    .map(([key, value]) => [bridgeIdentifier(key), bridgeIdentifier(value)])
    .filter(([key, value]) => key && value));
  const itemDetected = Object.fromEntries(Object.entries(itemDetectedInput)
    .slice(0, 15)
    .map(([key, value]) => [bridgeIdentifier(key), bridgeIdentifier(value)])
    .filter(([key, value]) => key && value));
  return {
    phpVersion: String(input.php_version || "").slice(0, 30),
    laravelVersion: String(input.laravel_version || "").slice(0, 30),
    databaseDriver: String(input.database_driver || "").slice(0, 30),
    tables: bridgeStringList(input.tables, 200),
    orders: {
      table: bridgeIdentifier(ordersInput.table),
      columns: bridgeStringList(ordersInput.columns, 160),
      detected,
      statusValues: (Array.isArray(ordersInput.status_values) ? ordersInput.status_values : [])
        .map((item) => String(item || "").trim().toLowerCase().slice(0, 40))
        .filter((item) => /^[a-z0-9 _-]+$/.test(item))
        .slice(0, 30),
      ready: Boolean(ordersInput.ready),
      confidence: Math.max(0, Math.min(100, Number(ordersInput.confidence || 0)))
    },
    items: {
      table: bridgeIdentifier(itemsInput.table),
      columns: bridgeStringList(itemsInput.columns, 160),
      detected: itemDetected,
      ready: Boolean(itemsInput.ready)
    },
    warnings: (Array.isArray(input.warnings) ? input.warnings : [])
      .map((item) => String(item || "").slice(0, 180))
      .filter(Boolean)
      .slice(0, 12)
  };
}

function publicLaravelSelfService(state = {}) {
  if (!state.status) return null;
  return {
    status: String(state.status),
    active: Boolean(state.active),
    storeUrl: String(state.storeUrl || ""),
    currency: String(state.currency || "BDT"),
    startedAt: state.startedAt || "",
    lastSeenAt: state.lastSeenAt || "",
    activatedAt: state.activatedAt || "",
    liveAt: state.liveAt || "",
    bridgeVersion: String(state.bridgeVersion || ""),
    report: state.report || null,
    mapping: sanitizeLaravelBridgeMapping(state.mapping || {}),
    lastOrder: state.lastOrder ? {
      id: String(state.lastOrder.id || ""),
      amount: Number(state.lastOrder.amount || 0),
      currency: String(state.lastOrder.currency || ""),
      receivedAt: state.lastOrder.receivedAt || ""
    } : null,
    verification: state.verification || null,
    updatedAt: state.updatedAt || ""
  };
}

function publicTenantForCustomer(tenant) {
  if (!tenant) return null;
  // Secrets are exposed only through their purpose-built authenticated setup
  // endpoints. A raw tenant object must never carry them into /api/dashboard.
  const {
    webhookSecret: _webhookSecret,
    laravelBridgeSecret: _laravelBridgeSecret,
    webhookSecretUpdatedAt: _webhookSecretUpdatedAt,
    laravelBridgeSecretUpdatedAt: _laravelBridgeSecretUpdatedAt,
    tracking: _tracking,
    ...safeTenant
  } = tenant;
  return { ...safeTenant, tracking: publicTenantTracking(tenant) };
}

// Reduce a tracking-domain input to a clean origin ("https://host"), no path.
function trackingOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return "";
  }
}

// ===========================================================================
// Offline conversion upload (Meta CAPI offline events from a CSV)
// ===========================================================================

const OFFLINE_CSV_COLUMNS = [
  "event_name", "event_time", "value", "currency", "order_id",
  "email", "phone", "first_name", "last_name", "city", "state", "zip", "country"
];

// Minimal RFC4180-ish CSV parser (handles quoted fields, commas, CRLF). Returns
// { rows: [{...}], errors: [string] } keyed by lowercased header names.
function parseOfflineCsv(text) {
  const errors = [];
  const records = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  const src = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) records.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((cell) => cell.trim() !== "")) records.push(row); }
  if (!records.length) return { rows: [], errors: ["CSV is empty."] };

  const header = records[0].map((h) => h.trim().toLowerCase());
  if (!header.includes("event_name")) errors.push("Missing required column: event_name.");
  if (!header.includes("event_time")) errors.push("Missing required column: event_time.");
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (cells[idx] ?? "").trim(); });
    rows.push(obj);
  }
  return { rows, errors };
}

// Normalize + SHA-256 hash a PII value the way Meta expects (lowercase, trimmed).
function sha256Hex(value, { digitsOnly = false } = {}) {
  let normalized = String(value || "").trim().toLowerCase();
  if (digitsOnly) normalized = normalized.replace(/[^0-9]/g, "");
  else normalized = normalized.replace(/\s+/g, " ");
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

// Coerce a CSV event_time cell (unix seconds, unix ms, or ISO date) to unix seconds.
function offlineEventTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return Math.floor(Date.now() / 1000);
  if (/^\d{13}$/.test(raw)) return Math.floor(Number(raw) / 1000);
  if (/^\d{10}$/.test(raw)) return Number(raw);
  const ms = Date.parse(raw);
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  return Math.floor(Date.now() / 1000);
}

// Build Meta CAPI events from parsed CSV rows. Mirrors the field/hashing map used
// by the in-container Meta template (server.js Meta CAPI block).
function buildOfflineMetaEvents(rows) {
  const events = [];
  const rowErrors = [];
  rows.forEach((row, idx) => {
    const eventName = row.event_name || "";
    if (!eventName) { rowErrors.push(`Row ${idx + 2}: missing event_name.`); return; }
    const userData = {};
    const em = sha256Hex(row.email); if (em) userData.em = [em];
    const ph = sha256Hex(row.phone, { digitsOnly: true }); if (ph) userData.ph = [ph];
    const fn = sha256Hex(row.first_name); if (fn) userData.fn = [fn];
    const ln = sha256Hex(row.last_name); if (ln) userData.ln = [ln];
    const ct = sha256Hex(row.city); if (ct) userData.ct = [ct];
    const st = sha256Hex(row.state); if (st) userData.st = [st];
    const zp = sha256Hex(row.zip); if (zp) userData.zp = [zp];
    const country = sha256Hex(row.country); if (country) userData.country = [country];
    if (!Object.keys(userData).length) { rowErrors.push(`Row ${idx + 2}: no usable customer match key (email/phone/etc).`); return; }
    const customData = {};
    if (row.currency) customData.currency = String(row.currency).trim().toUpperCase();
    if (row.value !== "" && row.value !== undefined) {
      const v = Number(row.value);
      if (Number.isFinite(v)) customData.value = v;
    }
    if (row.order_id) customData.order_id = row.order_id;
    events.push({
      event_name: eventName,
      event_time: offlineEventTime(row.event_time),
      action_source: "physical_store",
      event_id: row.order_id || undefined,
      user_data: userData,
      custom_data: customData
    });
  });
  return { events, rowErrors };
}

// Send offline events to Meta's Conversions API, batched ≤1000 per request.
async function sendMetaOfflineConversions(tenant, events, { useTestCode = true } = {}) {
  const meta = (tenant && tenant.tracking && tenant.tracking.meta) || {};
  const pixelId = meta.pixelId;
  const token = meta.capiToken;
  if (!pixelId || !token) return { ok: false, reason: "no_meta_creds" };
  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
  let sent = 0;
  const fbErrors = [];
  for (let i = 0; i < events.length; i += 1000) {
    const batch = events.slice(i, i + 1000);
    const body = { data: batch, partner_agent: "tagioo-sgtm-1.0" };
    // Live purchase recovery passes useTestCode:false so real orders are never
    // diverted to Test Events when a tenant leaves a stale test_event_code set.
    if (useTestCode && meta.testEventCode) body.test_event_code = meta.testEventCode;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        sent += typeof json.events_received === "number" ? json.events_received : batch.length;
      } else {
        fbErrors.push(json.error ? `${json.error.message || json.error.type || "Meta error"}` : `HTTP ${response.status}`);
      }
    } catch (error) {
      fbErrors.push(error.message || "Network error reaching Meta.");
    }
  }
  return { ok: fbErrors.length === 0, sent, fbErrors };
}

// Append an offline-upload summary to the tenant's tracking log (cap last 20).
async function recordOfflineUpload(tenantId, summary) {
  if (!tenantId) return;
  try {
    const loaded = await readDatabase();
    if (!loaded.available) return;
    const data = loaded.data;
    data.tenants ||= [];
    const index = data.tenants.findIndex((tenant) => tenant.id === tenantId);
    if (index === -1) return;
    const tracking = { ...(data.tenants[index].tracking || {}) };
    const log = Array.isArray(tracking.offlineUploads) ? tracking.offlineUploads.slice(0, 19) : [];
    tracking.offlineUploads = [{ at: new Date().toISOString(), ...summary }, ...log];
    data.tenants[index] = { ...data.tenants[index], tracking };
    await writeDatabase(data);
  } catch {
    // Logging the upload must never fail the upload itself.
  }
}

// Resolve the tenant record for a customer session.
async function tenantForSession(session) {
  const loaded = await readDatabase();
  if (!loaded.available) return null;
  return (loaded.data.tenants || []).find((t) => t.id === session.tenantId) || null;
}

// Handle an offline-conversion upload. validateOnly=true parses + reports without sending.
async function handleOfflineConversionUpload(session, csvText, { validateOnly = false } = {}) {
  const { rows, errors } = parseOfflineCsv(csvText);
  if (errors.length) return { ok: false, status: 400, errors };
  if (!rows.length) return { ok: false, status: 400, errors: ["No data rows found in CSV."] };
  const { events, rowErrors } = buildOfflineMetaEvents(rows);
  if (!events.length) return { ok: false, status: 400, errors: rowErrors.length ? rowErrors : ["No valid rows to send."] };

  const tenant = await tenantForSession(session);
  const meta = (tenant && tenant.tracking && tenant.tracking.meta) || {};
  if (!meta.pixelId || !meta.capiToken) {
    return { ok: false, status: 409, errors: ["Connect your Meta pixel + CAPI token in the Setup Assistant before uploading offline conversions."] };
  }

  if (validateOnly) {
    return { ok: true, received: rows.length, valid: events.length, rowErrors, willSend: events.length };
  }

  const result = await sendMetaOfflineConversions(tenant, events);
  const summary = {
    received: rows.length,
    sent: result.sent || 0,
    failed: rows.length - (result.sent || 0),
    status: result.ok ? "sent" : "error",
    errors: [...rowErrors, ...(result.fbErrors || [])].slice(0, 10)
  };
  await recordOfflineUpload(session.tenantId, summary);
  return { ok: result.ok, status: result.ok ? 200 : 502, ...summary };
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
  const loaded = await readDatabaseCached();
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
  // A caller may supply an already-computed scrypt hash instead of a plaintext
  // password (self-signup hashes at POST /signup so the pending record on disk
  // never holds a credential). Only accept the format hashPassword produces.
  const passwordHash = /^scrypt:[0-9a-f]+:[0-9a-f]+$/.test(String(input.passwordHash || "")) ? String(input.passwordHash) : "";
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
  if (!passwordHash && password.length < 8) errors.push("Password must be at least 8 characters.");
  if (domain && !validDomain(domain)) errors.push("Domain must be a valid hostname.");
  if ((input.websiteUrl || input.website_url) && !websiteUrl) errors.push("Website must be a valid URL.");

  return {
    errors,
    value: {
      tenantId,
      tenantName,
      username,
      password,
      passwordHash,
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
  const freeCycleEnd = new Date(Date.now() + 30 * 86400000).toISOString();
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
    passwordHash: validated.value.passwordHash || hashPassword(validated.value.password),
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
    domainLimit: tenantProfile.domainLimit,
    extraContainers: 0,
    monthlyAmount: monthlyAmountForPlan(validated.value.plan),
    ...(validated.value.plan === "Free" ? { cycleStart: now, cycleEnd: freeCycleEnd, nudgedAt: "", cappedAt: "", cycleNudge: 0 } : {}),
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

// Validate signup fields WITHOUT creating an account — used to gate the
// email-verification step so we only send a code for well-formed, non-duplicate
// signups. addCustomerSignup re-validates on final create (defense in depth).
async function validateSignupInput(input) {
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

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  if ((loaded.data.customerAccounts || []).some((a) => a.username === email)) {
    return { ok: false, errors: ["An account already exists with this email or username."] };
  }
  return { ok: true, email };
}

// 6-digit numeric verification code as a zero-padded string. Uses the CSPRNG —
// Math.random is predictable enough to matter for an auth code.
function makeVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function emailVerificationCode(toEmail, fullName, code) {
  const name = String(fullName || "").trim().split(" ")[0] || "there";
  // Dev fallback: with no email provider configured, print the code so local
  // signup can be completed. Never reached in production (RESEND_API_KEY set).
  if (!config.brevoApiKey && !config.resendApiKey) console.warn(`[verify] code for ${toEmail}: ${code}`);
  return sendEmail({
    to: toEmail,
    subject: `${code} is your Tagioo verification code`,
    bodyHtml: [
      `<p style="font-size:22px;font-weight:900;margin:0 0 8px;color:#0F0A1E">Verify your email</p>`,
      `<p style="color:#5B6B8A;margin:0 0 18px;line-height:1.6">Hi ${escapeHtml(name)}, enter this code to finish creating your Tagioo account:</p>`,
      `<p style="font-size:34px;font-weight:900;letter-spacing:8px;margin:0 0 18px;color:#0F0A1E;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;padding:18px 0;text-align:center">${escapeHtml(code)}</p>`,
      `<p style="color:#9BA8C0;font-size:13px;margin:0">This code expires in ${Math.round(SIGNUP_VERIFY_TTL_MS / 60000)} minutes. If you didn't request it, ignore this email.</p>`
    ].join("")
  });
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
  // Self-signup arrives here after email verification carrying passwordHash instead of
  // a password: the plaintext was hashed at POST /signup so it never had to be stored
  // while the code was pending. Owner-created accounts still pass a plaintext password.
  const passwordHash = String(input.passwordHash || "");
  const errors = [];

  if (!fullName) errors.push("Full name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
  if (!phone) errors.push("Phone number is required.");
  if (!passwordHash) {
    if (password.length < 8) errors.push("Password must be at least 8 characters.");
    if (password !== confirmPassword) errors.push("Passwords do not match.");
  }
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
    passwordHash,
    phone,
    country: input.country || "BD",
    referral: input.referral || "",
    plan: "Free",
    source: "self_signup",
    subscriptionStatus: "free",
    paymentStatus: "free",
    status: "active"
  }, { allowUpdate: false });

  if (result.ok) emailWelcome(email, fullName).catch(() => {});
  return result;
}

// Read the owner's manual-payment settings (bKash/Nagad numbers, notify email),
// with safe fallbacks. Never throws.
function paymentSettings(data) {
  const p = (data?.settings?.payment) || {};
  return {
    bkashNumber: String(p.bkashNumber || "").trim(),
    nagadNumber: String(p.nagadNumber || "").trim(),
    ownerNotifyEmail: String(p.ownerNotifyEmail || config.customerSupportEmail || "").trim(),
    ownerWhatsApp: String(p.ownerWhatsApp || "").trim(),
    instructions: String(p.instructions || "Use “Send Money” to the number above, then enter the Transaction ID below.").trim()
  };
}

// Sequential invoice number per tenant, e.g. "test-user-INV001".
function nextInvoiceNo(data, tenantId) {
  const count = (data.payments || []).filter((p) => p.tenantId === tenantId).length;
  return `${tenantId}-INV${String(count + 1).padStart(3, "0")}`;
}

// Customer instructions returned to the billing UI for a pending upgrade.
function paymentInstructionsFor(tenant, data) {
  const settings = paymentSettings(data);
  return {
    invoiceNo: tenant.pendingInvoiceNo || "",
    plan: tenant.pendingPlan || "",
    amount: Number(tenant.pendingAmount || 0),
    billingCycle: tenant.pendingBillingCycle || "monthly",
    bkashNumber: settings.bkashNumber,
    nagadNumber: settings.nagadNumber,
    ownerWhatsApp: settings.ownerWhatsApp,
    instructions: settings.instructions
  };
}

// USD monthly price per plan, sold via Paddle (international card checkout).
// Independent of the BDT bKash/Nagad pricing table — different market, different rail.
const paddleUsdMonthly = { Starter: 30, Pro: 50, Enterprise: 100 };

// X-Tagioo-Country is Cloudflare's CF-IPCountry header, passed through by
// tagioo.com's own Nginx vhost (same pattern already used for customer sGTM
// domains). Missing/unrecognized → "" so currencyForCountry defaults safely.
function detectCountryCode(req) {
  return String(req.headers["x-tagioo-country"] || "").trim().toUpperCase().slice(0, 2);
}

// BD sees BDT/bKash-Nagad; everywhere else (including an undetected visitor,
// e.g. local dev or Cloudflare not yet wired) defaults to USD/Paddle.
function currencyForCountry(countryCode) {
  return countryCode === "BD" ? "BDT" : "USD";
}

// Card-checkout config for the pending plan, shown only to a non-BD tenant
// (currencyForCountry) with a mapped Paddle price and PADDLE_CLIENT_TOKEN set.
// A BD tenant never sees this — bKash/Nagad is the only rail for BDT.
function paddleCheckoutConfigFor(tenant) {
  if (currencyForCountry(tenant.country) !== "USD") return { enabled: false };
  const planName = tenant.pendingPlan || "";
  const priceId = config.paddlePriceIds[planName] || "";
  if (!config.paddleClientToken || !priceId) return { enabled: false };
  return {
    enabled: true,
    clientToken: config.paddleClientToken,
    env: config.paddleEnv,
    priceId,
    planName,
    tenantId: tenant.id,
    usdAmount: paddleUsdMonthly[planName] || 0
  };
}

// A paid-plan signup must submit a transaction ID before reaching the dashboard.
// True while the tenant has a staged pending paid plan and no payment record yet
// (pending or confirmed). Once they submit a claim, the gate lifts.
function checkoutRequired(tenant, data) {
  if (!tenant || !tenant.pendingPlan) return false;
  // Only gate tenants whose service is actually blocked on this payment (new
  // paid signups / Free upgrades put into pending_payment by selectCustomerPlan).
  // A tenant with a live plan staging an upgrade keeps subscriptionStatus
  // "active"/"overdue" — locking them to /checkout would cut off a paid (or
  // admin-granted) account's dashboard over an optional upgrade invoice.
  if (tenant.subscriptionStatus !== "pending_payment") return false;
  if (!["Starter", "Pro", "Enterprise", "Growth", "Agency"].includes(tenant.pendingPlan)) return false;
  const hasClaim = (data.payments || []).some(
    (p) => p.tenantId === tenant.id && (p.status === "pending" || p.status === "confirmed")
  );
  return !hasClaim;
}

function shouldGateAppShellToCheckout(pathname, method = "GET") {
  return method === "GET" && (pathname === "/" || pathname === "/index.html");
}

// The checkout wall is a ONE-TIME prompt for the signup session, not a lock on the
// account. Someone who picked a paid plan at signup and never paid is released onto
// the Free plan (15k requests / 30-day cycle) the next time they log in — or when
// they press "continue on the Free plan" on the checkout page. The staged invoice is
// dropped, subscriptionStatus goes back to "free" (so the container paywall at
// /api/customer/setup lifts too), and upgrading later is a normal plan pick in
// Account & Billing, which stages a fresh invoice.
//
// No-op unless checkoutRequired() is still true: a submitted claim awaiting owner
// confirmation, an active/overdue paid plan, or a plain Free tenant is left alone.
async function releaseUnpaidSignupToFree(tenantId) {
  if (!tenantId) return { released: false };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { released: false };
    const data = loaded.data;
    const index = (data.tenants || []).findIndex((tenant) => tenant.id === tenantId);
    if (index === -1) return { released: false };
    const tenant = data.tenants[index];
    if (!checkoutRequired(tenant, data)) return { released: false };
    // Defensive: a live paid plan mislabeled pending_payment is repaired by
    // enforcePaidRenewals — never downgrade it here.
    if (tenant.plan !== "Free" && tenant.paymentStatus === "paid") return { released: false };

    const now = new Date();
    const profile = resourceProfileForPlan("Free");
    // Keep any existing free cycle window: releasing must never hand out a fresh
    // 15k allowance to a tenant that already burned part of one.
    const cycleStart = tenant.cycleStart || now.toISOString();
    const cycleEnd = tenant.cycleEnd || new Date(now.getTime() + FREE_CYCLE_DAYS * 86400000).toISOString();
    data.tenants[index] = {
      ...tenant,
      plan: "Free",
      requestLimit: profile.monthlyRequestLimit,
      containerLimit: profile.containerLimit,
      domainLimit: profile.domainLimit,
      extraContainers: 0,
      monthlyAmount: 0,
      subscriptionStatus: "free",
      paymentStatus: "free",
      pendingPlan: "",
      pendingAmount: 0,
      pendingBillingCycle: "",
      pendingInvoiceNo: "",
      scheduledPlan: "",
      scheduledPlanCycle: "",
      cycleStart,
      cycleEnd,
      updatedAt: now.toISOString()
    };
    await writeDatabase(data);
    return { released: true, tenant: data.tenants[index] };
  });
}

// Serializes read-modify-write cycles against the JSON database so two concurrent
// payment requests (e.g. owner double-clicking confirm) can't both read stale
// "pending" state and race past the status checks below.
let dbLockChain = Promise.resolve();
function withDbLock(fn) {
  const run = dbLockChain.then(fn, fn);
  dbLockChain = run.then(() => {}, () => {});
  return run;
}

// Customer chooses a plan. Free applies immediately; a PAID plan does NOT activate
// service — it moves the tenant to `pending_payment` and issues an invoice. Only an
// owner-confirmed payment (confirmPayment) flips the tenant to `active` with paid
// limits. This is the gate that closes the "active before payment" revenue leak.
const billingCycleConfig = {
  monthly:    { months: 1,  discount: 0,    label: "Monthly" },
  quarterly:  { months: 3,  discount: 0.10, label: "3-Month" },
  semiannual: { months: 6,  discount: 0.20, label: "6-Month" },
  yearly:     { months: 12, discount: 0.25, label: "Yearly" }
};

function computeCycleAmount(planName, cycleId) {
  const monthly = monthlyAmountForPlan(planName);
  const cycle = billingCycleConfig[cycleId] || billingCycleConfig.monthly;
  return Math.round(monthly * cycle.months * (1 - cycle.discount));
}

async function selectCustomerPlan(input, session) {
  return withDbLock(() => selectCustomerPlanLocked(input, session));
}

async function selectCustomerPlanLocked(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const planName = String(input.plan || input.planName || "").trim();
  const cycleId = billingCycleConfig[String(input.billingCycle || "").trim()] ? String(input.billingCycle).trim() : "monthly";
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

  const now = new Date();
  const current = data.tenants[tenantIndex];
  // A tenant "holds a paid plan" whenever they have paid for a non-Free plan —
  // true through the active window AND the overdue grace period (enforcePaidRenewals
  // flips subscriptionStatus to "overdue" but leaves paymentStatus "paid" until the
  // plan expires). Upgrade/downgrade must be decided against the plan they actually
  // hold, NOT gated on subscriptionStatus === "active" — otherwise an overdue Pro
  // customer selecting Starter reads as currentRank 0 and gets mislabeled an
  // "upgrade" that demands payment for a cheaper plan.
  const holdsPaidPlan = current.plan !== "Free" && current.paymentStatus === "paid"
    && ["active", "overdue"].includes(current.subscriptionStatus);
  const currentRank = holdsPaidPlan ? planRankFor(current.plan) : 0;
  const newRank = planRankFor(planName);

  // Re-selecting the current plan while a downgrade is scheduled = cancel the
  // scheduled downgrade (customer decided to stay).
  if (holdsPaidPlan && planName === current.plan && current.scheduledPlan) {
    data.tenants[tenantIndex] = { ...current, scheduledPlan: "", scheduledPlanCycle: "", updatedAt: now.toISOString() };
    await writeDatabase(data);
    return { ok: true, scheduledCancelled: true, tenant: data.tenants[tenantIndex] };
  }

  // Downgrade from a held paid plan (incl. to Free): do NOT charge now and do NOT
  // pause the current plan. Schedule the change for the end of the paid cycle; the
  // customer keeps their current plan + benefits until then, and pays the lower
  // plan's price on renewal. Applied by enforcePaidRenewals when the cycle ends.
  if (holdsPaidPlan && newRank < currentRank) {
    data.tenants[tenantIndex] = {
      ...current,
      scheduledPlan: planName,
      scheduledPlanCycle: cycleId,
      updatedAt: now.toISOString()
    };
    await writeDatabase(data);
    return {
      ok: true,
      scheduled: true,
      scheduledPlan: planName,
      effectiveDate: current.renewalDate || "",
      tenant: data.tenants[tenantIndex]
    };
  }

  // Free plan chosen while not on a paid plan: apply right away, no payment needed.
  if (planName === "Free") {
    const profile = resourceProfileForPlan("Free");
    const cycleStart = now.toISOString();
    const cycleEnd = new Date(now.getTime() + FREE_CYCLE_DAYS * 86400000).toISOString();
    data.tenants[tenantIndex] = {
      ...current,
      plan: "Free",
      requestLimit: profile.monthlyRequestLimit,
      containerLimit: profile.containerLimit,
      domainLimit: profile.domainLimit,
      extraContainers: 0,
      monthlyAmount: 0,
      subscriptionStatus: "free",
      paymentStatus: "free",
      pendingPlan: "",
      pendingAmount: 0,
      pendingInvoiceNo: "",
      scheduledPlan: "",
      scheduledPlanCycle: "",
      cycleStart,
      cycleEnd,
      nudgedAt: "",
      cappedAt: "",
      cycleNudge: 0,
      updatedAt: now.toISOString()
    };
    await writeDatabase(data);
    return { ok: true, tenant: data.tenants[tenantIndex] };
  }

  // Paid plan upgrade / renewal: stage awaiting manual payment. Keep effective limits
  // where they are until the owner confirms payment.
  const amount = computeCycleAmount(planName, cycleId);
  const cycle = billingCycleConfig[cycleId] || billingCycleConfig.monthly;
  const invoiceNo = current.pendingInvoiceNo || nextInvoiceNo(data, current.id);
  const staged = {
    ...current,
    pendingPlan: planName,
    pendingAmount: amount,
    pendingBillingCycle: cycleId,
    pendingInvoiceNo: invoiceNo,
    updatedAt: now.toISOString()
  };
  // Only a tenant with NO live paid plan (Free / new signup) is moved into
  // pending_payment — that gates their dashboard + container until they pay. A tenant
  // who already holds a paid plan (active or overdue) is UPGRADING/renewing: keep
  // their current subscriptionStatus/paymentStatus intact so the paid plan stays live
  // and tracking keeps running until the owner confirms the new payment. Demoting a
  // paid plan to "pending" before the upgrade is paid is the bug that made a paid Pro
  // account read "pending" across both dashboards.
  if (!holdsPaidPlan) {
    staged.subscriptionStatus = "pending_payment";
    staged.paymentStatus = "pending";
  }
  data.tenants[tenantIndex] = staged;

  await writeDatabase(data);
  return {
    ok: true,
    tenant: data.tenants[tenantIndex],
    payment: paymentInstructionsFor(data.tenants[tenantIndex], data)
  };
}

// Customer reports they paid: records a pending payment claim with the transaction
// ID and emails the owner to verify. Does NOT activate anything on its own.
async function submitPaymentClaim(input, session) {
  return withDbLock(() => submitPaymentClaimLocked(input, session));
}

async function submitPaymentClaimLocked(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const method = String(input.method || "").trim().toLowerCase();
  const txnId = String(input.txnId || input.transactionId || "").trim().slice(0, 64);
  const senderNumber = String(input.senderNumber || input.sender || "").trim().slice(0, 32);
  const errors = [];
  if (!["bkash", "nagad"].includes(method)) errors.push("Choose bKash or Nagad.");
  if (!txnId) errors.push("Transaction ID is required.");
  if (!senderNumber) errors.push("Sender number is required.");
  if (errors.length) return { ok: false, status: 400, errors };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.payments ||= [];
  const tenant = (data.tenants || []).find((t) => t.id === session.tenantId);
  if (!tenant) return { ok: false, status: 404, errors: ["Customer account was not found."] };
  if (!tenant.pendingPlan) return { ok: false, status: 400, errors: ["Choose a plan to upgrade before submitting a payment."] };

  // Block duplicate transaction IDs across all payments.
  if (data.payments.some((p) => p.txnId && p.txnId.toLowerCase() === txnId.toLowerCase())) {
    return { ok: false, status: 409, errors: ["This transaction ID was already submitted."] };
  }

  const now = new Date().toISOString();
  const payment = {
    id: `pay_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    invoiceNo: tenant.pendingInvoiceNo || nextInvoiceNo(data, tenant.id),
    tenantId: tenant.id,
    plan: tenant.pendingPlan,
    amount: Number(tenant.pendingAmount || monthlyAmountForPlan(tenant.pendingPlan)),
    method,
    txnId,
    senderNumber,
    status: "pending",
    claimedAt: now,
    confirmedBy: "",
    confirmedAt: "",
    note: ""
  };
  data.payments.push(payment);
  await writeDatabase(data);

  // Best-effort notifications (do not block the response).
  notifyOwnerPaymentClaim(payment, paymentSettings(data).ownerNotifyEmail).catch(() => {});
  const account = (data.customerAccounts || []).find((a) => a.tenantId === tenant.id);
  emailCustomerClaimReceived(account?.email || account?.username, payment).catch(() => {});
  return { ok: true, payment };
}

// Customer buys one extra sGTM container (recurring +৳1200/mo). Records a payment
// claim of type "addon_container"; owner confirmation bumps the tenant's container
// limit and monthly amount. Only paid/active tenants can add extras.
async function submitExtraContainerClaim(input, session) {
  return withDbLock(() => submitExtraContainerClaimLocked(input, session));
}

async function submitExtraContainerClaimLocked(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const method = String(input.method || "").trim().toLowerCase();
  const txnId = String(input.txnId || input.transactionId || "").trim().slice(0, 64);
  const senderNumber = String(input.senderNumber || input.sender || "").trim().slice(0, 32);
  const errors = [];
  if (!["bkash", "nagad"].includes(method)) errors.push("Choose bKash or Nagad.");
  if (!txnId) errors.push("Transaction ID is required.");
  if (!senderNumber) errors.push("Sender number is required.");
  if (errors.length) return { ok: false, status: 400, errors };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.payments ||= [];
  const tenant = (data.tenants || []).find((t) => t.id === session.tenantId);
  if (!tenant) return { ok: false, status: 404, errors: ["Customer account was not found."] };
  if (!(tenant.subscriptionStatus === "active" && tenant.paymentStatus === "paid")) {
    return { ok: false, status: 400, errors: ["Activate a paid plan before buying extra containers."] };
  }
  if (data.payments.some((p) => p.txnId && p.txnId.toLowerCase() === txnId.toLowerCase())) {
    return { ok: false, status: 409, errors: ["This transaction ID was already submitted."] };
  }

  const now = new Date().toISOString();
  const payment = {
    id: `pay_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    type: "addon_container",
    invoiceNo: nextInvoiceNo(data, tenant.id),
    tenantId: tenant.id,
    plan: tenant.plan,
    amount: EXTRA_CONTAINER_PRICE,
    method,
    txnId,
    senderNumber,
    status: "pending",
    claimedAt: now,
    confirmedBy: "",
    confirmedAt: "",
    note: "Extra container add-on"
  };
  data.payments.push(payment);
  await writeDatabase(data);

  notifyOwnerPaymentClaim(payment, paymentSettings(data).ownerNotifyEmail).catch(() => {});
  const account = (data.customerAccounts || []).find((a) => a.tenantId === tenant.id);
  emailCustomerClaimReceived(account?.email || account?.username, payment).catch(() => {});
  return { ok: true, payment };
}

// Owner confirms a pending payment: applies the paid plan, sets a 30-day window,
// starts the tenant's container if one exists, and emails the customer.
async function confirmPayment(paymentId, session) {
  return withDbLock(() => confirmPaymentLocked(paymentId, session));
}

async function confirmPaymentLocked(paymentId, session) {
  if (session?.role !== "owner") return { ok: false, status: 403, errors: ["Owner access required."] };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.payments ||= [];
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, status: 404, errors: ["Payment not found."] };
  if (payment.status === "confirmed") return { ok: false, status: 409, errors: ["Payment already confirmed."] };

  const tenantIndex = (data.tenants || []).findIndex((t) => t.id === payment.tenantId);
  if (tenantIndex === -1) return { ok: false, status: 404, errors: ["Customer account was not found."] };

  // Extra-container add-on: bump the tenant's container limit + monthly amount by
  // one unit, don't touch the plan/subscription window. Then start/resize handled
  // below via the shared tail of this function.
  if (payment.type === "addon_container") {
    const addTenant = data.tenants[tenantIndex];
    const nowIso = new Date().toISOString();
    const nextExtra = Number(addTenant.extraContainers || 0) + 1;
    const baseProfile = resourceProfileForPlan(addTenant.plan || "Free");
    data.tenants[tenantIndex] = {
      ...addTenant,
      extraContainers: nextExtra,
      containerLimit: baseProfile.containerLimit + nextExtra,
      monthlyAmount: monthlyAmountForPlan(addTenant.plan) + nextExtra * EXTRA_CONTAINER_PRICE,
      updatedAt: nowIso
    };
    payment.status = "confirmed";
    payment.confirmedBy = session.username || "owner";
    payment.confirmedAt = nowIso;
    await writeDatabase(data);
    const acct = (data.customerAccounts || []).find((a) => a.tenantId === payment.tenantId);
    emailExtraContainerConfirmed(acct?.email || acct?.username, acct?.fullName, data.tenants[tenantIndex].containerLimit).catch(() => {});
    return { ok: true, payment, tenant: data.tenants[tenantIndex] };
  }

  const now = new Date();
  const tenant = data.tenants[tenantIndex];
  const cycleId = tenant.pendingBillingCycle || "monthly";
  const cycleDays = (billingCycleConfig[cycleId] || billingCycleConfig.monthly).months * 30;
  const renewalDate = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
  const profile = resourceProfileForPlan(payment.plan);
  data.tenants[tenantIndex] = {
    ...tenant,
    plan: payment.plan,
    billingCycle: cycleId,
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit + Number(tenant.extraContainers || 0),
    domainLimit: profile.domainLimit,
    monthlyAmount: monthlyAmountForPlan(payment.plan) + Number(tenant.extraContainers || 0) * EXTRA_CONTAINER_PRICE,
    resourceLimits: { ...(tenant.resourceLimits || {}), memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit },
    subscriptionStatus: "active",
    paymentStatus: "paid",
    paidAt: now.toISOString(),
    renewalDate,
    renewalReminder: 99,
    overdueAt: "",
    expiredAt: "",
    pendingPlan: "",
    pendingAmount: 0,
    pendingBillingCycle: "",
    pendingInvoiceNo: "",
    // Paying for a plan clears any scheduled downgrade UNLESS this payment IS the
    // scheduled downgrade being applied at renewal (then it's already the new plan).
    scheduledPlan: tenant.scheduledPlan === payment.plan ? "" : (tenant.scheduledPlan || ""),
    scheduledPlanCycle: tenant.scheduledPlan === payment.plan ? "" : (tenant.scheduledPlanCycle || ""),
    updatedAt: now.toISOString()
  };

  payment.status = "confirmed";
  payment.confirmedBy = session.username || "owner";
  payment.confirmedAt = now.toISOString();
  await writeDatabase(data);

  // Every confirmed payment is a real paid conversion for tagioo's own
  // acquisition funnel (regardless of which customer) — forwarded to tagioo's
  // own GA4/Meta (TAGIOO_OWN_TRACKING) for ad optimization/attribution, same
  // gtag /g/collect mechanism as the per-tenant purchase forward above.
  const purchaseEventId = `purchase_${payment.id}`;
  // This runs in the OWNER's session, so req here belongs to the owner, not the
  // buyer — never snapshot it. Replay the buyer's signup-time context instead,
  // so GA4 geo and Meta match land on the customer.
  const purchaseVisitor = storedTagiooVisitor(tenant);
  forwardTagiooOwnEvent("purchase", {
    seed: payment.id,
    visitor: purchaseVisitor,
    eventParams: {
      cu: "BDT",
      "ep.transaction_id": String(payment.id),
      "epn.value": String(payment.amount),
      "ep.plan": payment.plan,
      "ep.tenant_id": payment.tenantId,
      "ep.event_id": purchaseEventId
    }
  }).catch(() => {});
  // Same event_id as above so Meta dedupes into one Purchase and merges in the
  // hashed email/phone/name for real match quality.
  sendTagiooPurchaseToMetaCapi(tenant, payment, purchaseEventId).catch(() => {});

  // Start/resume the tenant's container if one is provisioned, and resize to plan.
  let container = null;
  const request = (data.provisioning?.requests || []).find((item) => item.tenantId === payment.tenantId && item.containerName);
  if (request?.containerName) {
    await controlContainerLifecycle(request.containerName, "start").catch(() => {});
    container = await resizeContainer(request.containerName, { memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit }).catch(() => null);
  }

  const account = (data.customerAccounts || []).find((a) => a.tenantId === payment.tenantId);
  emailCustomerActivated(account?.email || account?.username, payment, renewalDate).catch(() => {});
  return { ok: true, payment, tenant: data.tenants[tenantIndex], container };
}

// Paddle webhook activation. Mirrors confirmPaymentLocked's tail, but the
// webhook itself is the authority — no owner click, no pending-claim record.
// Idempotent on paddleTransactionId: Paddle retries webhook delivery on any
// non-2xx response, and this must not double-activate or double-fire tracking.
async function activatePaddleTenant(paddleEvent) {
  return withDbLock(() => activatePaddleTenantLocked(paddleEvent));
}

async function activatePaddleTenantLocked({ tenantId, planName, amount, currency, paddleTransactionId, paddleSubscriptionId, paddleCustomerId }) {
  if (!tenantId) return { ok: false, status: 400, errors: ["Missing tenant id in Paddle custom_data."] };
  if (!planResourceProfiles[planName] || planName === "Customer" || planName === "Free") {
    return { ok: false, status: 400, errors: [`Unknown plan "${planName}" in Paddle price mapping.`] };
  }
  if (!paddleTransactionId) return { ok: false, status: 400, errors: ["Missing Paddle transaction id."] };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.payments ||= [];

  // Already processed this exact transaction (webhook retry) — no-op, not an error.
  const existing = data.payments.find((p) => p.paddleTransactionId === paddleTransactionId);
  if (existing) return { ok: true, payment: existing, duplicate: true };

  const tenantIndex = (data.tenants || []).findIndex((t) => t.id === tenantId);
  if (tenantIndex === -1) return { ok: false, status: 404, errors: ["Customer account was not found."] };

  const now = new Date();
  const tenant = data.tenants[tenantIndex];
  const cycleDays = billingCycleConfig.monthly.months * 30;
  const renewalDate = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
  const profile = resourceProfileForPlan(planName);

  const payment = {
    id: `pay_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    invoiceNo: tenant.pendingInvoiceNo || nextInvoiceNo(data, tenant.id),
    tenantId: tenant.id,
    plan: planName,
    amount: Number(amount || monthlyAmountForPlan(planName)),
    currency: currency || "USD",
    provider: "paddle",
    method: "paddle",
    paddleTransactionId,
    paddleSubscriptionId: paddleSubscriptionId || "",
    status: "confirmed",
    claimedAt: now.toISOString(),
    confirmedBy: "paddle-webhook",
    confirmedAt: now.toISOString(),
    note: ""
  };
  data.payments.push(payment);

  data.tenants[tenantIndex] = {
    ...tenant,
    plan: planName,
    billingCycle: "monthly",
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit + Number(tenant.extraContainers || 0),
    domainLimit: profile.domainLimit,
    monthlyAmount: monthlyAmountForPlan(planName) + Number(tenant.extraContainers || 0) * EXTRA_CONTAINER_PRICE,
    resourceLimits: { ...(tenant.resourceLimits || {}), memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit },
    subscriptionStatus: "active",
    paymentStatus: "paid",
    paymentProvider: "paddle",
    paddleSubscriptionId: paddleSubscriptionId || tenant.paddleSubscriptionId || "",
    paddleCustomerId: paddleCustomerId || tenant.paddleCustomerId || "",
    paidAt: now.toISOString(),
    renewalDate,
    renewalReminder: 99,
    overdueAt: "",
    expiredAt: "",
    pendingPlan: "",
    pendingAmount: 0,
    pendingBillingCycle: "",
    pendingInvoiceNo: "",
    scheduledPlan: tenant.scheduledPlan === planName ? "" : (tenant.scheduledPlan || ""),
    scheduledPlanCycle: tenant.scheduledPlan === planName ? "" : (tenant.scheduledPlanCycle || ""),
    updatedAt: now.toISOString()
  };

  await writeDatabase(data);

  const purchaseEventId = `purchase_${payment.id}`;
  const purchaseVisitor = storedTagiooVisitor(tenant);
  forwardTagiooOwnEvent("purchase", {
    seed: payment.id,
    visitor: purchaseVisitor,
    eventParams: {
      cu: payment.currency,
      "ep.transaction_id": String(payment.id),
      "epn.value": String(payment.amount),
      "ep.plan": payment.plan,
      "ep.tenant_id": payment.tenantId,
      "ep.event_id": purchaseEventId
    }
  }).catch(() => {});
  sendTagiooPurchaseToMetaCapi(tenant, payment, purchaseEventId).catch(() => {});

  let container = null;
  const request = (data.provisioning?.requests || []).find((item) => item.tenantId === tenant.id && item.containerName);
  if (request?.containerName) {
    await controlContainerLifecycle(request.containerName, "start").catch(() => {});
    container = await resizeContainer(request.containerName, { memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit }).catch(() => null);
  }

  const account = (data.customerAccounts || []).find((a) => a.tenantId === tenant.id);
  emailCustomerActivated(account?.email || account?.username, payment, renewalDate).catch(() => {});
  return { ok: true, payment, tenant: data.tenants[tenantIndex], container };
}

// Paddle subscription canceled or a renewal payment failed: release the tenant
// the same way an unpaid manual signup is released — back to Free, keeping
// whatever's left of their current cycle window. Paddle owns dunning/retries
// on its side; by the time this fires, Paddle has given up on collecting.
async function deactivatePaddleTenant(paddleSubscriptionId) {
  return withDbLock(() => deactivatePaddleTenantLocked(paddleSubscriptionId));
}

async function deactivatePaddleTenantLocked(paddleSubscriptionId) {
  if (!paddleSubscriptionId) return { ok: false, status: 400, errors: ["Missing Paddle subscription id."] };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  const tenantIndex = (data.tenants || []).findIndex((t) => t.paddleSubscriptionId === paddleSubscriptionId);
  if (tenantIndex === -1) return { ok: true, skipped: true };

  const tenant = data.tenants[tenantIndex];
  const now = new Date();
  const profile = resourceProfileForPlan("Free");
  data.tenants[tenantIndex] = {
    ...tenant,
    plan: "Free",
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit,
    domainLimit: profile.domainLimit,
    monthlyAmount: 0,
    subscriptionStatus: "free",
    paymentStatus: "free",
    paymentProvider: "",
    cycleStart: tenant.cycleStart || now.toISOString(),
    cycleEnd: tenant.cycleEnd || new Date(now.getTime() + FREE_CYCLE_DAYS * 86400000).toISOString(),
    updatedAt: now.toISOString()
  };
  await writeDatabase(data);
  return { ok: true, tenant: data.tenants[tenantIndex] };
}

// Reverse of config.paddlePriceIds — maps a Paddle price id back to our plan
// name. Used to interpret subscription.updated webhook payloads.
function planNameForPaddlePriceId(priceId) {
  return Object.entries(config.paddlePriceIds).find(([, id]) => id && id === priceId)?.[0] || "";
}

// Bearer-authed call to Paddle's REST API (subscription updates/cancels —
// distinct from the client-side Checkout used at signup). Never throws;
// callers check `ok`.
async function callPaddleApi(path, method, body) {
  if (!config.paddleApiKey) return { ok: false, status: 500, errors: ["PADDLE_SANDBOX_API_KEY/PADDLE_LIVE_API_KEY is not configured."] };
  try {
    const res = await fetch(`${config.paddleApiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.paddleApiKey}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, errors: [json?.error?.detail || `Paddle API ${res.status}`] };
    return { ok: true, data: json.data };
  } catch (error) {
    return { ok: false, status: 502, errors: [error.message] };
  }
}

// Customer-initiated plan change for a Paddle (USD) tenant. Mirrors the BDT
// flow's policy: upgrade charges the prorated difference immediately and
// applies now; downgrade applies at the next renewal, no charge today. The
// tenant's plan/limits in our DB are NOT updated here — the subscription.updated
// webhook is the source of truth, same pattern as activatePaddleTenant.
async function updatePaddleSubscriptionPlan(tenant, newPlanName) {
  const priceId = config.paddlePriceIds[newPlanName];
  if (!priceId) return { ok: false, status: 400, errors: [`No Paddle price configured for "${newPlanName}".`] };
  if (!tenant.paddleSubscriptionId) return { ok: false, status: 400, errors: ["No active Paddle subscription on this account."] };

  const isUpgrade = planRankFor(newPlanName) > planRankFor(tenant.plan);
  return callPaddleApi(`/subscriptions/${tenant.paddleSubscriptionId}`, "PATCH", {
    items: [{ price_id: priceId, quantity: 1 }],
    proration_billing_mode: isUpgrade ? "prorated_immediately" : "do_not_bill",
    effective_from: isUpgrade ? "immediately" : "next_billing_period"
  });
}

// Downgrade-to-Free for a Paddle tenant is a cancellation, not a price swap.
// Scheduled at next renewal to match the BDT rail's downgrade policy — no
// immediate loss of service, no partial-period refund to reason about.
async function cancelPaddleSubscription(tenant) {
  if (!tenant.paddleSubscriptionId) return { ok: false, status: 400, errors: ["No active Paddle subscription on this account."] };
  return callPaddleApi(`/subscriptions/${tenant.paddleSubscriptionId}/cancel`, "POST", {
    effective_from: "next_billing_period"
  });
}

// subscription.updated webhook: sync our plan/limits to whatever Paddle
// reports as the CURRENT active price on the subscription. Deliberately
// naive about scheduled-vs-applied — Paddle fires this again when a
// next_billing_period change actually takes effect, and re-reading "current
// items" each time is simpler and more robust than trying to interpret
// Paddle's scheduled_change payload shape.
async function syncPaddleSubscriptionPlan(paddleSubscriptionId, items) {
  return withDbLock(() => syncPaddleSubscriptionPlanLocked(paddleSubscriptionId, items));
}

async function syncPaddleSubscriptionPlanLocked(paddleSubscriptionId, items) {
  if (!paddleSubscriptionId) return { ok: false, status: 400, errors: ["Missing Paddle subscription id."] };
  const activePriceId = (items || []).find((item) => item.status !== "inactive")?.price?.id || items?.[0]?.price?.id;
  const planName = planNameForPaddlePriceId(activePriceId);
  if (!planName) return { ok: true, skipped: true };

  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  const tenantIndex = (data.tenants || []).findIndex((t) => t.paddleSubscriptionId === paddleSubscriptionId);
  if (tenantIndex === -1) return { ok: true, skipped: true };

  const tenant = data.tenants[tenantIndex];
  if (tenant.plan === planName) return { ok: true, unchanged: true };

  const now = new Date();
  const profile = resourceProfileForPlan(planName);
  data.tenants[tenantIndex] = {
    ...tenant,
    plan: planName,
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit + Number(tenant.extraContainers || 0),
    domainLimit: profile.domainLimit,
    monthlyAmount: paddleUsdMonthly[planName] || 0,
    resourceLimits: { ...(tenant.resourceLimits || {}), memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit },
    updatedAt: now.toISOString()
  };
  await writeDatabase(data);

  const request = (data.provisioning?.requests || []).find((item) => item.tenantId === tenant.id && item.containerName);
  if (request?.containerName) {
    await resizeContainer(request.containerName, { memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit }).catch(() => null);
  }

  return { ok: true, tenant: data.tenants[tenantIndex] };
}

// Owner rejects a pending payment (wrong / duplicate / unverifiable transaction).
async function rejectPayment(paymentId, reason, session) {
  return withDbLock(() => rejectPaymentLocked(paymentId, reason, session));
}

async function rejectPaymentLocked(paymentId, reason, session) {
  if (session?.role !== "owner") return { ok: false, status: 403, errors: ["Owner access required."] };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.payments ||= [];
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, status: 404, errors: ["Payment not found."] };
  if (payment.status === "confirmed") return { ok: false, status: 409, errors: ["Cannot reject a confirmed payment."] };

  payment.status = "rejected";
  payment.note = String(reason || "").slice(0, 240);
  payment.confirmedBy = session.username || "owner";
  payment.confirmedAt = new Date().toISOString();
  await writeDatabase(data);

  const account = (data.customerAccounts || []).find((a) => a.tenantId === payment.tenantId);
  emailCustomerPaymentRejected(account?.email || account?.username, payment, payment.note).catch(() => {});
  return { ok: true, payment };
}

// Customer-facing billing snapshot for the dashboard billing view.
async function getCustomerBilling(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  const tenant = (data.tenants || []).find((t) => t.id === session.tenantId);
  if (!tenant) return { ok: false, status: 404, errors: ["Customer account was not found."] };
  const claims = (data.payments || [])
    .filter((p) => p.tenantId === tenant.id)
    .sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt)));
  const latestPending = claims.find((p) => p.status === "pending") || null;
  return {
    ok: true,
    billing: {
      accountName: tenant.fullName || tenant.name || tenant.id,
      plan: tenant.plan || "Free",
      subscriptionStatus: tenant.subscriptionStatus || "free",
      paymentStatus: tenant.paymentStatus || "free",
      monthlyAmount: Number(tenant.monthlyAmount || 0),
      renewalDate: tenant.renewalDate || "",
      requestLimit: Number(tenant.requestLimit || 0),
      containerLimit: Number(tenant.containerLimit || resourceProfileForPlan(tenant.plan || "Free").containerLimit),
      containersUsed: getTenantContainers(tenant.id, tenant, data.customerSetupRequests || [], data.provisioning?.requests || []).length,
      domainLimit: Number(tenant.domainLimit || resourceProfileForPlan(tenant.plan || "Free").domainLimit),
      extraContainers: Number(tenant.extraContainers || 0),
      extraContainerPrice: EXTRA_CONTAINER_PRICE,
      pendingPlan: tenant.pendingPlan || "",
      pendingAmount: Number(tenant.pendingAmount || 0),
      pendingInvoiceNo: tenant.pendingInvoiceNo || "",
      scheduledPlan: tenant.scheduledPlan || "",
      scheduledPlanCycle: tenant.scheduledPlanCycle || "",
      scheduledEffectiveDate: tenant.scheduledPlan ? (tenant.renewalDate || "") : "",
      payment: tenant.pendingPlan ? paymentInstructionsFor(tenant, data) : null,
      paymentNumbers: (() => { const s = paymentSettings(data); return { bkashNumber: s.bkashNumber, nagadNumber: s.nagadNumber, ownerWhatsApp: s.ownerWhatsApp, instructions: s.instructions }; })(),
      latestPending,
      claims: claims.slice(0, 10)
    }
  };
}

// Owner: list payment claims (newest first), optionally filtered by status.
async function listPayments(statusFilter) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  let payments = (loaded.data.payments || []).slice();
  if (statusFilter) payments = payments.filter((p) => p.status === statusFilter);
  payments.sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt)));
  return { ok: true, payments };
}

// Owner: read manual-payment settings.
async function getPaymentSettings() {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  return { ok: true, settings: paymentSettings(loaded.data) };
}

// Owner: update manual-payment settings (bKash/Nagad numbers, notify email, etc.).
async function updatePaymentSettings(input) {
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;
  data.settings ||= {};
  const current = paymentSettings(data);
  data.settings.payment = {
    bkashNumber: String(input.bkashNumber ?? current.bkashNumber).trim().slice(0, 32),
    nagadNumber: String(input.nagadNumber ?? current.nagadNumber).trim().slice(0, 32),
    ownerNotifyEmail: String(input.ownerNotifyEmail ?? current.ownerNotifyEmail).trim().slice(0, 160),
    ownerWhatsApp: String(input.ownerWhatsApp ?? current.ownerWhatsApp).trim().slice(0, 32),
    instructions: String(input.instructions ?? current.instructions).trim().slice(0, 500)
  };
  await writeDatabase(data);
  return { ok: true, settings: paymentSettings(data) };
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

async function requestLaravelManagedSetup(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  const storeUrl = normalizeWebsiteUrl(input.storeUrl);
  if (!storeUrl) return { ok: false, status: 400, errors: ["Enter a valid Laravel store website URL."] };
  const currency = String(input.currency || "BDT").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, status: 400, errors: ["Currency must be a 3-letter code such as BDT or USD."] };

  let savedSetup = null;
  let savedTenant = null;
  try {
    await withDbLock(async () => {
      const loaded = await readDatabase();
      if (!loaded.available) throw new Error(loaded.detail || loaded.message || "Database unavailable.");
      const data = loaded.data;
      const index = (data.tenants || []).findIndex((tenant) => tenant.id === session.tenantId);
      if (index === -1) throw new Error("Customer account was not found.");
      const tenant = data.tenants[index];
      const tracking = { ...(tenant.tracking || {}) };
      const previous = tracking.laravelManagedSetup || {};
      const now = new Date().toISOString();
      savedSetup = {
        status: previous.status === "live" ? "live" : "requested",
        storeUrl,
        currency,
        requestedAt: previous.requestedAt || now,
        updatedAt: now
      };
      tracking.laravelManagedSetup = savedSetup;
      data.tenants[index] = {
        ...tenant,
        tracking,
        // Created silently for the tenant-scoped bridge package. It is never
        // returned by the managed-setup API or exposed in dashboard payloads.
        laravelBridgeSecret: tenant.laravelBridgeSecret || randomBytes(24).toString("hex"),
        laravelBridgeSecretUpdatedAt: tenant.laravelBridgeSecretUpdatedAt || now
      };
      savedTenant = data.tenants[index];
      await writeDatabase(data);
    });
  } catch (error) {
    return { ok: false, status: 500, errors: [error.message || "Could not save the setup request."] };
  }

  notifyOwnerLaravelManagedSetup(savedTenant, savedSetup).catch(() => {});
  return { ok: true, setup: savedSetup };
}

async function startLaravelSelfService(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  if (!cpanelBridgeAvailableFor(session.tenantId)) return { ok: false, status: 404, errors: ["Laravel self-service is not enabled for this account."] };
  const storeUrl = normalizeWebsiteUrl(input.storeUrl);
  const currency = String(input.currency || "BDT").trim().toUpperCase();
  if (!storeUrl) return { ok: false, status: 400, errors: ["Enter a valid Laravel store website URL."] };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, status: 400, errors: ["Currency must be a 3-letter code such as BDT or USD."] };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
    const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
    if (!tenant) return { ok: false, status: 404, errors: ["Customer account was not found."] };
    const now = new Date().toISOString();
    const tracking = { ...(tenant.tracking || {}) };
    const previous = tracking.laravelSelfService || {};
    const sameStore = previous.storeUrl === storeUrl && previous.currency === currency;
    tracking.laravelSelfService = {
      ...(sameStore ? previous : {}),
      status: sameStore && previous.status === "live" ? "live" : "package_ready",
      active: sameStore ? Boolean(previous.active) : false,
      storeUrl,
      currency,
      startedAt: sameStore ? previous.startedAt || now : now,
      updatedAt: now
    };
    tenant.tracking = tracking;
    if (!tenant.laravelBridgeSecret) {
      tenant.laravelBridgeSecret = randomBytes(24).toString("hex");
      tenant.laravelBridgeSecretUpdatedAt = now;
    }
    await writeDatabase(loaded.data);
    return { ok: true, setup: publicLaravelSelfService(tracking.laravelSelfService) };
  });
}

async function recordLaravelBridgeHeartbeat(input, tenantId, snapshotTenant) {
  const previous = snapshotTenant?.tracking?.laravelSelfService || {};
  if (!previous.status) return { ok: false, status: 409, errors: ["Start Laravel self-service from the Tagioo dashboard first."] };
  const report = sanitizeLaravelBridgeReport(input.report || {});
  const version = String(input.bridge_version || "").slice(0, 20);
  const ready = Boolean(report.orders.ready);
  const status = previous.status === "live"
    ? "live"
    : previous.status === "paused" && !previous.active
      ? "paused"
    : previous.active
      ? (previous.lastOrder ? "test_received" : "waiting_test")
      : ready ? "detected" : "needs_mapping";
  const lastSeenMs = Date.parse(previous.lastSeenAt || "");
  const unchanged = status === previous.status && version === String(previous.bridgeVersion || "") &&
    JSON.stringify(report) === JSON.stringify(previous.report || null);
  const shouldPersist = !unchanged || !Number.isFinite(lastSeenMs) || Date.now() - lastSeenMs >= 5 * 60 * 1000;
  let current = previous;
  if (shouldPersist) {
    const persisted = await withDbLock(async () => {
      const loaded = await readDatabase();
      if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
      const tenant = (loaded.data.tenants || []).find((item) => item.id === tenantId);
      if (!tenant?.tracking?.laravelSelfService) return { ok: false, status: 409, errors: ["Start Laravel self-service first."] };
      const now = new Date().toISOString();
      const freshState = tenant.tracking.laravelSelfService;
      const freshStatus = freshState.status === "live"
        ? "live"
        : freshState.status === "paused" && !freshState.active
          ? "paused"
        : freshState.active
          ? (freshState.lastOrder ? "test_received" : "waiting_test")
          : ready ? "detected" : "needs_mapping";
      tenant.tracking.laravelSelfService = {
        ...freshState,
        status: freshStatus,
        report,
        bridgeVersion: version,
        lastSeenAt: now,
        updatedAt: now
      };
      await writeDatabase(loaded.data);
      return { ok: true, state: tenant.tracking.laravelSelfService };
    });
    if (!persisted.ok) return persisted;
    current = persisted.state;
  }
  return {
    ok: true,
    active: Boolean(current.active),
    status: current.status || status,
    mapping: sanitizeLaravelBridgeMapping(current.mapping || {}),
    heartbeatInterval: 300
  };
}

async function saveLaravelSelfServiceMapping(input, session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  if (!cpanelBridgeAvailableFor(session.tenantId)) return { ok: false, status: 404, errors: ["Laravel self-service is not enabled for this account."] };
  const mapping = sanitizeLaravelBridgeMapping(input || {});
  if (!mapping.orders_table) return { ok: false, status: 400, errors: ["Choose the Laravel orders table."] };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
    const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
    const setup = tenant?.tracking?.laravelSelfService;
    if (!tenant || !setup) return { ok: false, status: 409, errors: ["Start Laravel self-service first."] };
    if (setup.active || setup.status === "live") return { ok: false, status: 409, errors: ["Mapping cannot be changed while Laravel tracking is active."] };
    const report = setup.report || {};
    if (!(report.tables || []).includes(mapping.orders_table)) {
      return { ok: false, status: 400, errors: ["Choose an orders table reported by your connected Laravel Bridge."] };
    }
    if (mapping.items_table && !(report.tables || []).includes(mapping.items_table)) {
      return { ok: false, status: 400, errors: ["Choose an items table reported by your connected Laravel Bridge."] };
    }
    const validateReportedColumns = (values, selectedTable, reportedSection, label) => {
      const selected = Object.values(values || {});
      if (!selected.length) return "";
      if (reportedSection?.table !== selectedTable) return `Save the ${label} table first, wait for the next Cron check, then select its fields.`;
      const allowed = new Set(reportedSection.columns || []);
      return selected.find((value) => !allowed.has(value)) ? `Choose ${label} fields reported by your connected Laravel Bridge.` : "";
    };
    const columnError = validateReportedColumns(mapping.columns, mapping.orders_table, report.orders, "order");
    const itemColumnError = mapping.items_table
      ? validateReportedColumns(mapping.item_columns, mapping.items_table, report.items, "item")
      : "";
    if (columnError || itemColumnError) return { ok: false, status: 400, errors: [columnError || itemColumnError] };
    const now = new Date().toISOString();
    tenant.tracking = {
      ...(tenant.tracking || {}),
      laravelSelfService: {
        ...setup,
        mapping,
        active: false,
        status: "mapping_pending",
        updatedAt: now
      }
    };
    await writeDatabase(loaded.data);
    return { ok: true, setup: publicLaravelSelfService(tenant.tracking.laravelSelfService) };
  });
}

async function activateLaravelSelfService(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  if (!cpanelBridgeAvailableFor(session.tenantId)) return { ok: false, status: 404, errors: ["Laravel self-service is not enabled for this account."] };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
    const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
    const setup = tenant?.tracking?.laravelSelfService;
    if (!tenant || !setup) return { ok: false, status: 409, errors: ["Start Laravel self-service first."] };
    const lastSeen = Date.parse(setup.lastSeenAt || "");
    if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > 10 * 60 * 1000) {
      return { ok: false, status: 409, errors: ["The cPanel Bridge is not connected. Check the Cron Job and try again."] };
    }
    if (!setup.report?.orders?.ready) {
      return { ok: false, status: 409, errors: ["Required order fields have not been detected yet. Complete the advanced mapping first."] };
    }
    const now = new Date().toISOString();
    tenant.tracking = {
      ...(tenant.tracking || {}),
      laravelSelfService: {
        ...setup,
        active: true,
        status: "waiting_test",
        activatedAt: now,
        lastOrder: null,
        verification: null,
        updatedAt: now
      }
    };
    await writeDatabase(loaded.data);
    return { ok: true, setup: publicLaravelSelfService(tenant.tracking.laravelSelfService) };
  });
}

async function deactivateLaravelSelfService(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
    const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
    const setup = tenant?.tracking?.laravelSelfService;
    if (!tenant || !setup) return { ok: false, status: 409, errors: ["Laravel self-service has not been started."] };
    const now = new Date().toISOString();
    tenant.tracking.laravelSelfService = { ...setup, active: false, status: "paused", updatedAt: now };
    await writeDatabase(loaded.data);
    return { ok: true, setup: publicLaravelSelfService(tenant.tracking.laravelSelfService) };
  });
}

async function verifyLaravelSelfService(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  if (!cpanelBridgeAvailableFor(session.tenantId)) return { ok: false, status: 404, errors: ["Laravel self-service is not enabled for this account."] };
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
  const setup = tenant?.tracking?.laravelSelfService;
  if (!tenant || !setup?.active) return { ok: false, status: 409, errors: ["Activate the cPanel Bridge before testing an order."] };
  // Older Bridge purchases could be accepted into data.orders while a
  // simultaneous heartbeat overwrote only the tenant verification marker.
  // Recover from that state using the newest accepted cPanel order. New writes
  // are serialized under withDbLock, so this is also a safe migration path for
  // customers already piloting the bridge.
  const fallbackOrder = (loaded.data.orders || []).slice().reverse().find((order) =>
    order.tenantId === session.tenantId && order.source === "tagioo-cpanel-bridge"
  );
  const lastOrder = setup.lastOrder || (fallbackOrder ? {
    id: fallbackOrder.id,
    amount: fallbackOrder.amount,
    currency: fallbackOrder.currency,
    receivedAt: fallbackOrder.receivedAt || fallbackOrder.updatedAt || fallbackOrder.createdAt
  } : null);
  const activatedAt = Date.parse(setup.activatedAt || "");
  const receivedAt = Date.parse(lastOrder?.receivedAt || "");
  if (!lastOrder || !Number.isFinite(receivedAt) || receivedAt < activatedAt) {
    return { ok: false, status: 409, errors: ["No new paid test order has reached Tagioo yet. Place one order after activation and try again."] };
  }
  const trackingResult = await verifyTenantTracking(tenant);
  const bridgeOk = true;
  const containerOk = Boolean(trackingResult.checks?.container?.ok);
  const now = new Date().toISOString();
  const verification = {
    ok: bridgeOk && containerOk,
    at: now,
    checks: {
      bridge: { ok: true, detail: `Order ${lastOrder.id} reached Tagioo with value ${lastOrder.amount} ${lastOrder.currency}.` },
      ...trackingResult.checks
    }
  };
  await withDbLock(async () => {
    const fresh = await readDatabase();
    if (!fresh.available) return;
    const freshTenant = (fresh.data.tenants || []).find((item) => item.id === session.tenantId);
    if (!freshTenant?.tracking?.laravelSelfService) return;
    freshTenant.tracking.laravelSelfService = {
      ...freshTenant.tracking.laravelSelfService,
      status: verification.ok ? "live" : "verification_failed",
      lastOrder,
      liveAt: verification.ok ? now : freshTenant.tracking.laravelSelfService.liveAt || "",
      verification,
      updatedAt: now
    };
    freshTenant.tracking.lastVerify = trackingResult;
    await writeDatabase(fresh.data);
  });
  return { ok: true, verified: verification.ok, verification };
}

function tenantWebhookSecret(data, tenantId) {
  if (!tenantId) return "";
  return (data.tenants || []).find((tenant) => tenant.id === tenantId)?.webhookSecret || "";
}

function tenantLaravelBridgeSecret(data, tenantId) {
  if (!tenantId) return "";
  return (data.tenants || []).find((tenant) => tenant.id === tenantId)?.laravelBridgeSecret || "";
}

async function ensureCustomerLaravelBridgeSecret(session) {
  if (!session?.tenantId) return { ok: false, status: 401, errors: ["Customer session required."] };
  return withDbLock(async () => {
    const loaded = await readDatabase();
    if (!loaded.available) return { ok: false, status: 500, errors: [loaded.detail || loaded.message || "Database unavailable."] };
    const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
    if (!tenant) return { ok: false, status: 404, errors: ["Customer account was not found."] };
    if (!tenant.laravelBridgeSecret) {
      tenant.laravelBridgeSecret = randomBytes(24).toString("hex");
      tenant.laravelBridgeSecretUpdatedAt = new Date().toISOString();
      await writeDatabase(loaded.data);
    }
    return { ok: true, secret: tenant.laravelBridgeSecret };
  });
}

function phpSingleQuoted(value) {
  return `'${String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function buildCpanelBridgeConfig({ endpoint, heartbeatEndpoint, tenantId, webhookSecret, storeUrl, currency }) {
  return `<?php

return [
    'enabled' => true,
    'endpoint' => ${phpSingleQuoted(endpoint)},
    'heartbeat_endpoint' => ${phpSingleQuoted(heartbeatEndpoint)},
    'tenant' => ${phpSingleQuoted(tenantId)},
    'secret' => ${phpSingleQuoted(webhookSecret)},
    'store_url' => ${phpSingleQuoted(storeUrl)},
    'laravel_root' => '',
    'orders_table' => 'orders',
    'items_table' => '',
    'currency' => ${phpSingleQuoted(currency || "BDT")},
    'paid_statuses' => ['processing', 'completed', 'paid', 'success', 'confirmed', 'delivered'],
    'assume_new_orders_paid' => false,
    'batch_size' => 25,
    'timeout' => 5,
    'columns' => [],
    'item_columns' => [],
];
`;
}

function cpanelBridgeAvailableFor(tenantId) {
  if (!config.cpanelBridgeEnabled || !tenantId) return false;
  return config.cpanelBridgeTenants.includes("*") || config.cpanelBridgeTenants.includes(String(tenantId));
}

async function markCustomerAccountLogin(id) {
  try {
    // Under the DB lock: this fires and forgets during login, so it would
    // otherwise race the login handler's own read-modify-write (releasing an
    // unpaid signup to Free) and one of the two writes would be lost.
    await withDbLock(async () => {
      const loaded = await readDatabase();
      if (!loaded.available) return;
      const account = (loaded.data.customerAccounts || []).find((item) => item.id === id);
      if (!account) return;
      account.lastLoginAt = new Date().toISOString();
      await writeDatabase(loaded.data);
    });
  } catch {
    // Login telemetry should never block authentication.
  }
}

async function getCustomerAccountsSummary() {
  const loaded = await readDatabaseCached();
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
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };
  const data = loaded.data;

  // Paywall (checked before input validation so an unpaid customer always gets
  // the payment prompt, not a form error): a customer who picked a PAID plan but
  // hasn't paid (pending_payment) cannot provision a container until the owner
  // confirms payment. Free tier includes a container, so "free"/"active" pass.
  const gateTenant = (data.tenants || []).find((tenant) => tenant.id === session?.tenantId);
  if (gateTenant && gateTenant.subscriptionStatus === "pending_payment") {
    return {
      ok: false,
      status: 402,
      errors: ["Complete your plan payment before creating a container. Open Account & Billing to pay — we activate within hours of confirming your transaction."]
    };
  }

  // Hard container-limit gate: block creating more containers than the plan (plus
  // any paid extra-container add-ons) allows. containerLimit on the tenant already
  // includes confirmed add-ons; fall back to the plan profile if unset.
  if (gateTenant) {
    const effectiveLimit = Number(gateTenant.containerLimit) > 0
      ? Number(gateTenant.containerLimit)
      : resourceProfileForPlan(gateTenant.plan || "Free").containerLimit;
    const currentCount = getTenantContainers(
      session.tenantId, gateTenant, data.customerSetupRequests || [], data.provisioning?.requests || []
    ).length;
    if (currentCount >= effectiveLimit) {
      return {
        ok: false,
        status: 402,
        errors: [`You've reached your plan's container limit (${effectiveLimit}). Buy an extra container for ৳${EXTRA_CONTAINER_PRICE.toLocaleString()}/month from Account & Billing, or upgrade your plan.`]
      };
    }
  }

  const validated = validateCustomerSetupInput(input, session);
  if (validated.errors.length) return { ok: false, errors: validated.errors };

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
  const loaded = await readDatabaseCached();
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
  const loaded = await readDatabaseCached();
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
  Starter: 1200,
  Growth: 2500,
  Pro: 2900,
  Enterprise: 5900,
  Agency: 7500
};

// Canonical plan limits (single source of truth for containers + domains). Keep
// the subscription cards (app.js), customer dashboard, and homepage in sync with
// these numbers: Free/Starter 1 container · 1 domain, Pro 3 · 2, Enterprise 5 · 3.
const planResourceProfiles = {
  // Free is sized for its 15K events/30d cap (~500/day, near-zero concurrency).
  // 320MB keeps headroom for GTM Preview/Debug sessions (the memory-heavy thing
  // trial users actually do); 256 risks OOM-kill mid-setup. Applies to NEW
  // provisions and plan-change resizes only — running containers keep their limits.
  Free:       { memoryMb: 320,  cpuLimit: "0.25", monthlyRequestLimit: 15000,    containerLimit: 1,  domainLimit: 1 },
  Starter:    { memoryMb: 768,  cpuLimit: "0.50", monthlyRequestLimit: 500000,   containerLimit: 1,  domainLimit: 1 },
  Growth:     { memoryMb: 1024, cpuLimit: "0.75", monthlyRequestLimit: 1500000,  containerLimit: 2,  domainLimit: 1 },
  Pro:        { memoryMb: 1024, cpuLimit: "0.75", monthlyRequestLimit: 2000000,  containerLimit: 3,  domainLimit: 2 },
  Agency:     { memoryMb: 1536, cpuLimit: "1.50", monthlyRequestLimit: 8000000,  containerLimit: 10, domainLimit: 5 },
  Enterprise: { memoryMb: 2048, cpuLimit: "2.00", monthlyRequestLimit: 5000000,  containerLimit: 5,  domainLimit: 3 },
  Customer:   { memoryMb: 768,  cpuLimit: "0.50", monthlyRequestLimit: 500000,   containerLimit: 1,  domainLimit: 1 }
};

// Recurring add-on: each extra sGTM container beyond the plan's included count.
const EXTRA_CONTAINER_PRICE = 1200;

// Plan ordering for upgrade vs downgrade decisions.
const planRankOrder = { Free: 0, Starter: 1, Growth: 2, Pro: 3, Agency: 4, Enterprise: 4 };
const planRankFor = (name) => Number(planRankOrder[String(name || "").trim()] ?? 0);

function monthlyAmountForPlan(planName) {
  return planMonthlyAmounts[String(planName || "").trim()] || 0;
}

function resourceProfileForPlan(planName, overrides = {}) {
  const profile = planResourceProfiles[String(planName || "").trim()] || planResourceProfiles.Customer;
  const memoryMb = Number(overrides.memoryMb || overrides.memory_mb || profile.memoryMb || config.defaultContainerMemoryMb);
  const monthlyRequestLimit = Number(overrides.requestLimit || overrides.request_limit || overrides.monthlyRequestLimit || profile.monthlyRequestLimit || config.monthlyRequestLimit);
  const containerLimit = Number(overrides.containerLimit || overrides.container_limit || profile.containerLimit || config.monthlyContainerLimit);
  const domainLimit = Number(overrides.domainLimit || overrides.domain_limit || profile.domainLimit || 1);
  return {
    memoryMb: Number.isFinite(memoryMb) && memoryMb > 0 ? memoryMb : config.defaultContainerMemoryMb,
    cpuLimit: String(overrides.cpuLimit || overrides.cpu_limit || profile.cpuLimit || config.defaultContainerCpuLimit),
    monthlyRequestLimit: Number.isFinite(monthlyRequestLimit) && monthlyRequestLimit > 0 ? monthlyRequestLimit : config.monthlyRequestLimit,
    containerLimit: Number.isFinite(containerLimit) && containerLimit > 0 ? containerLimit : config.monthlyContainerLimit,
    domainLimit: Number.isFinite(domainLimit) && domainLimit > 0 ? domainLimit : 1
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

// Join each Docker container to its owning customer so the admin panel can show
// per-container plan + request usage next to the live CPU/mem stats. Uses the
// same name-matching as customerContainerHealth. Mutates the container objects.
function attachContainerOwnership(docker, ownerCustomers = []) {
  if (!docker?.available || !Array.isArray(docker.containers)) return docker;

  const customerTerms = ownerCustomers.map((customer) => ({
    customer,
    terms: [customer.id, customer.name, customer.domain, normalizeHost(customer.domain).split(".")[0]]
      .map((item) => sanitizeId(item))
      .filter(Boolean)
  }));
  const envCustomer = ownerCustomers.find((customer) => customer.source === "environment") || null;

  for (const container of docker.containers) {
    const haystack = sanitizeId(`${container.name || ""}-${container.image || ""}`);
    const match = customerTerms.find(({ terms }) => terms.some((term) => term && haystack.includes(term)));
    const owner = match?.customer || envCustomer;
    container.owner = owner
      ? {
          customerId: owner.id,
          customerName: owner.name,
          plan: owner.plan,
          requestsMonth: Number(owner.requestsMonth || 0),
          requestsToday: Number(owner.requestsToday || 0),
          requestLimit: Number(owner.requestLimit || 0),
          usagePercent: Number(owner.usagePercent || 0)
        }
      : null;
  }
  return docker;
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
  const cycleStart = validDate(tenant?.cycleStart);
  const cycleEnd = validDate(tenant?.cycleEnd);
  const isFreeCycle = tenant?.plan === "Free" || ["free", "free_capped", "pending_payment"].includes(String(tenant?.subscriptionStatus || ""));
  if (isFreeCycle && cycleStart && cycleEnd) {
    return {
      start: cycleStart,
      end: cycleEnd > now ? now : cycleEnd,
      renewal: cycleEnd,
      label: `${localDateKey(cycleStart)} to ${localDateKey(cycleEnd)}`
    };
  }

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

function buildOwnerDashboard({ customers, docker, ssl, orders, requestSummary, usage, reconciliation, customerSetup, provisioning, workers, tenantUsage = {}, customerAccounts }) {
  const soleCustomer = (customers.tenants || []).length === 1;
  // Join account contact details (email/phone) onto each tenant for the owner's
  // Customers view — these live on customerAccounts, not the tenant record.
  const accountByTenant = new Map(
    ((customerAccounts && customerAccounts.accounts) || []).map((a) => [a.tenantId, a])
  );
  const enrichedCustomers = (customers.tenants || []).map((customer) => {
    const account = accountByTenant.get(customer.id) || null;
    const customerContainers = getTenantContainers(customer.id, customer, customerSetup?.requests || [], provisioning?.requests || []);
    const plan = customer.plan || config.billingPlan;
    // Derive the limit from the current plan profile so existing customers
    // reflect pricing changes instead of a stale value stored at provision time.
    const requestLimit = Number(
      resourceProfileForPlan(plan).monthlyRequestLimit || customer.requestLimit || config.monthlyRequestLimit || 0
    );
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

    // Offline-conversion + cookie-extension summary for the admin panel.
    const safeTracking = publicTenantTracking(customer);
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentUploads = (safeTracking.offlineUploads || []).filter((u) => u.at && Date.parse(u.at) >= thirtyDaysAgo);
    const offlineUploads30d = recentUploads.length;
    const offlineEventsSent30d = recentUploads.reduce((sum, u) => sum + Number(u.sent || 0), 0);
    const offlineLastStatus = safeTracking.offlineUploads[0]?.status || "";

    return {
      ...customer,
      accountId: account?.id || "",
      username: account?.username || "",
      email: account?.email || "",
      phone: account?.phone || "",
      fullName: account?.fullName || customer.name || "",
      tracking: safeTracking,
      offlineUploads30d,
      offlineEventsSent30d,
      offlineLastStatus,
      cookieExtensionEnabled: safeTracking.cookieExtension.enabled,
      cookieExtensionDays: safeTracking.cookieExtension.days,
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
  // Count active + trial subscriptions toward MRR, but exclude the environment
  // (Default) account — that's the owner's own tenant, not a paying customer.
  const payingCustomers = enrichedCustomers.filter((customer) =>
    customer.source !== "environment" &&
    ["active", "trial"].includes(customer.subscriptionStatus) &&
    !customer.unpaid
  );
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
  const loaded = await readDatabaseCached();
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

// Owner-only: fully remove a customer — tear down their containers (best-effort),
// then purge account, tenant, setup requests, and provisioning records. Payment
// records are kept for financial history. Destructive; the UI confirms first.
async function deleteCustomerCompletely(tenantId, session) {
  if (session?.role !== "owner") return { ok: false, status: 403, errors: ["Owner access required."] };
  const id = String(tenantId || "").trim();
  if (!id) return { ok: false, status: 400, errors: ["Missing customer id."] };

  const pre = await readDatabase();
  if (!pre.available) return { ok: false, status: 500, errors: [pre.detail || pre.message || "Database unavailable."] };
  const exists = (pre.data.tenants || []).some((t) => t.id === id) ||
    (pre.data.customerAccounts || []).some((a) => a.tenantId === id);
  if (!exists) return { ok: false, status: 404, errors: ["Customer was not found."] };
  if (id === "default" || (pre.data.tenants || []).find((t) => t.id === id)?.source === "environment") {
    return { ok: false, status: 400, errors: ["The environment/default customer cannot be deleted."] };
  }

  // Best-effort container teardown so a Docker/Nginx hiccup never blocks the
  // record purge. Each call re-reads the DB, so run sequentially.
  const containerIds = (pre.data.customerSetupRequests || [])
    .filter((r) => r.tenantId === id && !["deleted"].includes(String(r.status || "").toLowerCase()))
    .map((r) => r.id);
  const teardownErrors = [];
  for (const cid of containerIds) {
    try {
      const r = await deleteCustomerContainer(cid, session);
      if (!r.ok) teardownErrors.push(...(r.errors || []));
    } catch (e) {
      teardownErrors.push(e.message || String(e));
    }
  }

  // Reload after teardown writes, then purge all records for this tenant.
  const loaded = await readDatabase();
  const data = loaded.data;
  data.customerAccounts = (data.customerAccounts || []).filter((a) => a.tenantId !== id);
  data.tenants = (data.tenants || []).filter((t) => t.id !== id);
  data.customerSetupRequests = (data.customerSetupRequests || []).filter((r) => r.tenantId !== id);
  if (data.provisioning?.requests) {
    data.provisioning.requests = data.provisioning.requests.filter((r) => r.tenantId !== id);
  }
  await writeDatabase(data);
  return { ok: true, tenantId: id, teardownErrors };
}

async function getProvisioningSummary() {
  const loaded = await readDatabaseCached();
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

// ── Phase 2: Free-tier rolling-cycle usage enforcement ─────────────────────
const FREE_NUDGE_THRESHOLD = 12000;
const FREE_HARD_CAP = 15000;
const FREE_CYCLE_DAYS = 30;

// Sum a tenant's stored daily request counts inside the active rolling cycle.
// Counts are persisted by Dhaka calendar day, so compare with Dhaka date keys.
function tenantUsageInCycle(data, tenantId, cycleStart, cycleEnd) {
  const days = data.tenantDailyRequests?.[tenantId] || {};
  const start = validDate(cycleStart);
  const end = validDate(cycleEnd);
  if (!start || !end) return 0;
  const startKey = localDateKey(start);
  const endKey = localDateKey(end);
  let total = 0;
  for (const [dateKey, count] of Object.entries(days)) {
    if (dateKey >= startKey && dateKey <= endKey) total += Number(count || 0);
  }
  return total;
}

// Sum a tenant's tracked purchases + revenue within the current cycle window.
function cyclePurchaseStats(data, tenantId, startKey, endKey) {
  const hist = data.tenantEventHistory?.[tenantId] || {};
  let purchases = 0, revenue = 0, currency = "";
  for (const [dateKey, snap] of Object.entries(hist)) {
    if (dateKey < startKey || dateKey > endKey) continue;
    const ps = snap.purchaseSummary || {};
    purchases += Number(ps.uniqueCount || 0);
    revenue += Number(ps.uniqueRevenue || 0);
    if (!currency && ps.currency) currency = ps.currency;
  }
  return { purchases, revenue, currency };
}

// Resolve a tenant's running sGTM container name from provisioning records.
function tenantContainerName(data, tenantId) {
  const req = (data.provisioning?.requests || []).find((item) => item.tenantId === tenantId && item.containerName);
  return req?.containerName || "";
}

// Evaluate every Free-tier tenant against its rolling 30-day cycle: roll the
// window when it expires (resuming a capped container), send one upgrade nudge
// at 12K per cycle, and hard-cap (stop the container) at 15K. Mutates `data`;
// the caller persists it. Side-effects (emails, docker start/stop) are
// best-effort and never throw.
async function enforceFreeTierUsage(data) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const cycleMs = FREE_CYCLE_DAYS * 24 * 60 * 60 * 1000;

  for (const tenant of (data.tenants || [])) {
    if (!tenant?.id) continue;
    const status = tenant.subscriptionStatus;
    const isFreeTier = tenant.plan === "Free" || status === "free" || status === "free_capped";
    if (!isFreeTier) continue;

    // Initialise the cycle window for tenants that don't have one yet.
    if (!tenant.cycleStart || !tenant.cycleEnd) {
      tenant.cycleStart = now.toISOString();
      tenant.cycleEnd = new Date(now.getTime() + cycleMs).toISOString();
      tenant.nudgedAt = "";
      tenant.cycleNudge = 0;
    }

    // Cycle rollover: reset usage baseline + nudge state, resume if capped.
    if (now >= new Date(tenant.cycleEnd)) {
      tenant.cycleStart = now.toISOString();
      tenant.cycleEnd = new Date(now.getTime() + cycleMs).toISOString();
      tenant.nudgedAt = "";
      tenant.cycleNudge = 0;
      if (status === "free_capped") {
        tenant.subscriptionStatus = "free";
        tenant.cappedAt = "";
        const name = tenantContainerName(data, tenant.id);
        if (name) await controlContainerLifecycle(name, "start").catch(() => {});
      }
      continue;
    }

    const startKey = localDateKey(new Date(tenant.cycleStart));
    const used = tenantUsageInCycle(data, tenant.id, tenant.cycleStart, tenant.cycleEnd);
    const account = (data.customerAccounts || []).find((a) => a.tenantId === tenant.id);
    const toEmail = account?.email || account?.username || "";

    // Hard cap: stop the container once, on the transition to capped.
    if (used >= FREE_HARD_CAP) {
      if (status !== "free_capped") {
        tenant.subscriptionStatus = "free_capped";
        tenant.cappedAt = now.toISOString();
        const name = tenantContainerName(data, tenant.id);
        if (name) await controlContainerLifecycle(name, "stop").catch(() => {});
        emailFreeTierCapped(toEmail, tenant, cyclePurchaseStats(data, tenant.id, startKey, todayKey)).catch(() => {});
      }
      continue;
    }

    // 12K nudge: fire once per cycle. Respect the legacy cycleNudge marker so
    // customers who already received the 12K+ nudge are not emailed again.
    if (used >= FREE_NUDGE_THRESHOLD && !tenant.nudgedAt && Number(tenant.cycleNudge || 0) < FREE_NUDGE_THRESHOLD) {
      tenant.nudgedAt = now.toISOString();
      tenant.cycleNudge = FREE_NUDGE_THRESHOLD;
      emailFreeTierNudge(toEmail, tenant, FREE_NUDGE_THRESHOLD, used, FREE_HARD_CAP, cyclePurchaseStats(data, tenant.id, startKey, todayKey)).catch(() => {});
    }
  }
}

const RENEWAL_REMINDER_DAYS = [7, 3, 1];
const RENEWAL_GRACE_DAYS = 7;

// Evaluate paid plans against their 30-day window: send T-7/T-3/T-1 renewal
// reminders (once each), flip to `overdue` once the renewal date passes (grace
// period — container keeps running), then to `expired` + stop the container once
// the grace period ends. Mutates `data`; side-effects are best-effort.
async function enforcePaidRenewals(data) {
  const now = new Date();
  for (const tenant of (data.tenants || [])) {
    if (!tenant?.id) continue;
    // Paddle owns renewal billing, dunning, and cancellation on its side —
    // this sweep is the manual bKash/Nagad flow's overdue/expire enforcement
    // and must not touch a Paddle subscription's status.
    if (tenant.paymentProvider === "paddle") continue;

    // Self-heal legacy corruption from the old plan-change flow, which demoted a
    // paid plan to "pending_payment" and could stage a downgrade as a pending
    // "upgrade" (see selectCustomerPlan). A tenant that has paid for a non-Free plan
    // but sits in pending_payment is a live paid subscription mislabeled unpaid:
    // restore it to active/overdue by its renewal date so both dashboards show the
    // real state, and reclassify any pending plan that is actually a downgrade into
    // a scheduled change instead of a payment demand.
    if (tenant.plan !== "Free" && tenant.paymentStatus === "paid" && tenant.subscriptionStatus === "pending_payment") {
      const stillValid = tenant.renewalDate && !Number.isNaN(new Date(tenant.renewalDate).getTime()) && new Date(tenant.renewalDate) > now;
      tenant.subscriptionStatus = stillValid ? "active" : "overdue";
      if (tenant.pendingPlan && planResourceProfiles[tenant.pendingPlan] && planRankFor(tenant.pendingPlan) < planRankFor(tenant.plan)) {
        tenant.scheduledPlan = tenant.pendingPlan;
        tenant.scheduledPlanCycle = tenant.pendingBillingCycle || "monthly";
        tenant.pendingPlan = "";
        tenant.pendingAmount = 0;
        tenant.pendingBillingCycle = "";
        tenant.pendingInvoiceNo = "";
      }
      tenant.updatedAt = now.toISOString();
    }

    const status = tenant.subscriptionStatus;
    if (!["active", "overdue"].includes(status)) continue;
    if (tenant.plan === "Free" || !tenant.renewalDate) continue;

    const renewal = new Date(tenant.renewalDate);
    if (Number.isNaN(renewal.getTime())) continue;
    const account = (data.customerAccounts || []).find((a) => a.tenantId === tenant.id);
    const toEmail = account?.email || account?.username || "";

    // Pre-expiry reminders.
    if (now < renewal) {
      const daysLeft = Math.ceil((renewal.getTime() - now.getTime()) / 86400000);
      let toSend = null;
      for (const mark of RENEWAL_REMINDER_DAYS) {
        if (daysLeft <= mark && mark < Number(tenant.renewalReminder ?? 99)) toSend = mark;
      }
      if (toSend != null) {
        tenant.renewalReminder = toSend;
        emailRenewalReminder(toEmail, tenant, daysLeft, data).catch(() => {});
      }
      continue;
    }

    // Past the renewal date.
    const daysOver = Math.floor((now.getTime() - renewal.getTime()) / 86400000);
    if (status !== "overdue") {
      // A scheduled downgrade takes effect now: the renewal the customer pays is for
      // the lower plan, not the current one. Stage it as the pending plan so the
      // "Renew" flow charges the downgraded price and confirmPayment applies it.
      if (tenant.scheduledPlan && planResourceProfiles[tenant.scheduledPlan]) {
        const cyc = billingCycleConfig[tenant.scheduledPlanCycle] ? tenant.scheduledPlanCycle : "monthly";
        tenant.pendingPlan = tenant.scheduledPlan;
        tenant.pendingBillingCycle = cyc;
        tenant.pendingAmount = computeCycleAmount(tenant.scheduledPlan, cyc);
        tenant.pendingInvoiceNo = tenant.pendingInvoiceNo || nextInvoiceNo(data, tenant.id);
        tenant.scheduledPlan = "";
        tenant.scheduledPlanCycle = "";
      }
      tenant.subscriptionStatus = "overdue";
      tenant.overdueAt = now.toISOString();
      emailOverdue(toEmail, tenant, data, RENEWAL_GRACE_DAYS).catch(() => {});
    }
    if (daysOver >= RENEWAL_GRACE_DAYS) {
      tenant.subscriptionStatus = "expired";
      tenant.expiredAt = now.toISOString();
      const name = tenantContainerName(data, tenant.id);
      if (name) await controlContainerLifecycle(name, "stop").catch(() => {});
      emailExpiredSuspended(toEmail, tenant, data).catch(() => {});
    }
  }
}

// The whole tick is one read→mutate→write cycle holding data across slow awaits
// (docker lifecycle, emails via enforceFreeTierUsage/enforcePaidRenewals). Without
// the lock, a payment confirmed mid-tick gets clobbered by the tick's stale write.
async function persistDailySummary(summary) {
  return withDbLock(() => persistDailySummaryLocked(summary));
}

async function persistDailySummaryLocked(summary) {
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

  // Phase 2: evaluate Free-tier usage cycles (nudges + hard cap) before persisting.
  await enforceFreeTierUsage(data).catch((e) => console.error("[free-tier] enforcement error:", e.message));
  await enforcePaidRenewals(data).catch((e) => console.error("[renewal] enforcement error:", e.message));

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

// Read-only history for the dashboard hot path: returns stored daily snapshots
// and per-tenant counts WITHOUT the expensive persistence work (per-tenant log
// scans, free-tier/renewal enforcement, and the full DB write). Persistence is
// done on a background timer instead (runPersistenceCycle), so dashboard loads
// only read.
async function getHistorySummary() {
  const loaded = await readDatabaseCached();
  const data = loaded.data;
  return {
    available: loaded.available,
    path: databasePath,
    retentionDays: config.historyRetentionDays,
    tenantDailyRequests: data.tenantDailyRequests || {},
    tenantEventHistory: data.tenantEventHistory || {},
    daily: Object.values(data.daily || {}).sort((a, b) => b.date.localeCompare(a.date))
  };
}

// Background persistence: compute today's shared-log summary and fold it into
// stored history (daily snapshots + per-tenant counts), then run usage/renewal
// enforcement and write once. Runs on a timer, decoupled from dashboard reads.
let persistenceCycleRunning = false;
async function runPersistenceCycle() {
  if (persistenceCycleRunning) return;
  persistenceCycleRunning = true;
  try {
    const summary = await summarizeRequestsToday(config.accessLog);
    await persistDailySummary(summary);
  } catch (error) {
    console.error("[persistence] cycle error:", error.message);
  } finally {
    persistenceCycleRunning = false;
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
      purchaseEvents: [],
      purchases: emptyPurchases,
      eventLogLimit: config.eventLogLimit,
      summaryTailLines: lineLimit
    };
  }

  return aggregateTrackingLines(splitLines(tail.stdout), { token, dayKey: localDateKey(), path: pathname, lineLimit });
}

// Shared aggregation over raw access-log lines. Used by both the live tail path and
// the SQLite event store, so dashboard numbers are identical regardless of source.
// `dayKey` (Asia/Dhaka "YYYY-MM-DD") filters lines to a single Dhaka calendar day
// using each line's own offset; pass an empty dayKey when the lines are already
// scoped to one day. `token` is retained only for the response/cache metadata.
function aggregateTrackingLines(lines, { token = "", dayKey = "", path: pathname = "", lineLimit = config.summaryTailLines } = {}) {
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
  const purchaseEvents = [];

  for (const line of lines) {
    if (dayKey) {
      // Keep only lines whose Dhaka calendar day matches today. Unparseable
      // timestamps fall through (kept) rather than being silently dropped.
      const lineKey = nginxLineDhakaKey(line);
      if (lineKey && lineKey !== dayKey) continue;
    }
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
      const bucket = hourly[dhakaShifted(parsed.date).getUTCHours()];
      bucket.total += 1;
      if (Number(parsed.status) >= 400) bucket.errors += 1;
      if (parsed.eventName === "Purchase") bucket.purchases += 1;
      else if (parsed.eventName === "PageView") bucket.pageView += 1;
      else if (parsed.eventName === "ViewItem") bucket.viewItem += 1;
      else if (parsed.eventName === "AddToCart") bucket.addToCart += 1;
      else if (parsed.eventName === "BeginCheckout") bucket.beginCheckout += 1;
    }

    if (parsed.eventName === "Purchase") {
      purchaseEvents.push(serializeEventRow(parsed));
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
    purchaseEvents: purchaseEvents.reverse(),
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
  const purchaseEvents = readable
    .flatMap((summary) => summary.purchaseEvents || (summary.recentEvents || []).filter((event) => event.eventName === "Purchase"))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 2000);
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
    purchaseEvents,
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
    cpanelBridgeEnabled: config.cpanelBridgeEnabled,
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
  const __t0 = Date.now();
  const __stage = {};
  let __mark = __t0;
  const __lap = (name) => { __stage[name] = Date.now() - __mark; __mark = Date.now(); };
  const [docker, requestSummary, accessLog, errorLog, ssl, system] = await Promise.all([
    getDockerSummary(),
    summarizeRequestsToday(config.accessLog),
    tailFile(config.accessLog, config.logTailLines),
    tailFile(config.errorLog, config.logTailLines),
    getSslSummary(),
    getSystemMetrics()
  ]);
  __lap("io");

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
    getHistorySummary(),
    getProvisioningSummary(),
    getWorkerSummary(),
    getOrderSummary(),
    getCustomerAccountsSummary(),
    getCustomerSetupSummary()
  ]);
  __lap("db");
  const customers = await getCustomerCatalog({ docker, ssl, orders });
  const usage = getUsageSummary({ requestSummary, history });
  const tenantUsage = tenantBillingUsageMap({ customerSetup, provisioning, tenantDailyRequests: history.tenantDailyRequests || {} }, customers.tenants || []);
  __lap("catalog");
  const reconciliation = getReconciliationSummary({ requestSummary, orders });
  const integrations = getIntegrationSummary({ orders, requestSummary });
  const setupWizard = getSetupWizard({ customers, provisioning, integrations, ssl, requestSummary });
  const owner = buildOwnerDashboard({ customers, docker, ssl, orders, requestSummary, usage, reconciliation, customerSetup, provisioning, workers, tenantUsage, customerAccounts });
  attachContainerOwnership(docker, owner.customers || []);
  const alerts = buildServerAlerts({ docker, requestCount: requestSummary, accessLog, errorLog, ssl });
  const deploymentChecks = buildDeploymentChecks({ docker, requestSummary, accessLog, errorLog, ssl, database: history });
  const retainedEvents = retainedSummaryFromSnapshots((history.daily || []).slice(0, 30), requestSummary);
  __lap("assemble");
  const __total = Date.now() - __t0;
  if (__total > 2000) {
    console.warn(`[dashboard] owner build ${__total}ms — stages(ms): io=${__stage.io} db=${__stage.db} catalog=${__stage.catalog} assemble=${__stage.assemble}`);
  }
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
    cpanelBridgeEnabled: data.config.cpanelBridgeEnabled,
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

// Stale-while-revalidate cache for the customer dashboard payload, keyed by tenant.
// Data is tenant-scoped (no per-user secrets), so two sessions of the same tenant can
// safely share it. A fresh hit (< FRESH_MS) returns instantly; a stale hit returns the
// last payload immediately and refreshes in the background, so a hard refresh or a
// logout→login round-trip paints real numbers right away instead of waiting on log parsing.
const CUSTOMER_DASHBOARD_FRESH_MS = Number(process.env.CUSTOMER_DASHBOARD_FRESH_MS || 8000);
const CUSTOMER_DASHBOARD_STALE_MS = Number(process.env.CUSTOMER_DASHBOARD_STALE_MS || 120000);
const customerDashboardCache = new Map();

async function getCustomerDashboardDataCached(session) {
  const key = session.tenantId;
  const now = Date.now();
  const entry = customerDashboardCache.get(key);

  if (entry && now - entry.at < CUSTOMER_DASHBOARD_FRESH_MS) {
    return { ...entry.payload, timing: { ...entry.payload.timing, cache: "fresh" } };
  }

  if (entry && now - entry.at < CUSTOMER_DASHBOARD_STALE_MS) {
    if (!entry.refreshing) {
      entry.refreshing = true;
      getCustomerDashboardData(session)
        .then((payload) => { customerDashboardCache.set(key, { payload, at: Date.now(), refreshing: false }); })
        .catch(() => { entry.refreshing = false; });
    }
    return { ...entry.payload, timing: { ...entry.payload.timing, cache: "stale" } };
  }

  const startedAt = Date.now();
  const payload = await getCustomerDashboardData(session);
  payload.timing = { dashboardMs: Date.now() - startedAt, role: "customer", cache: "miss" };
  customerDashboardCache.set(key, { payload, at: Date.now(), refreshing: false });
  return payload;
}

// ── Owner dashboard cache (stale-while-revalidate) ──────────────────────────
// The owner payload is expensive to build (Docker stats, Nginx log scans,
// per-tenant usage). Serve a cached copy instantly and refresh in the
// background so the admin panel loads immediately instead of blocking on the
// full rebuild every time.
const OWNER_DASHBOARD_FRESH_MS = Number(process.env.OWNER_DASHBOARD_FRESH_MS || 8000);
// Serve a stale-but-instant copy for up to an hour so an owner logging in after
// idle never blocks on a cold rebuild — they get the last payload immediately
// and it refreshes in the background.
const OWNER_DASHBOARD_STALE_MS = Number(process.env.OWNER_DASHBOARD_STALE_MS || 3600000);
let ownerDashboardCache = null;       // { payload, at, refreshing }
let ownerDashboardLastAccess = 0;

// Mark the cache dirty WITHOUT dropping it: keep serving the last payload
// instantly and rebuild in the background. Nulling it would force the next
// load to block on a full cold build right after an owner action.
function invalidateOwnerDashboardCache() {
  if (!ownerDashboardCache) return;
  ownerDashboardLastAccess = Date.now();
  if (!ownerDashboardCache.refreshing) refreshOwnerDashboardCache();
}

function refreshOwnerDashboardCache() {
  if (ownerDashboardCache) ownerDashboardCache.refreshing = true;
  return getDashboardData()
    .then((payload) => { ownerDashboardCache = { payload, at: Date.now(), refreshing: false }; })
    .catch(() => { if (ownerDashboardCache) ownerDashboardCache.refreshing = false; });
}

async function getDashboardDataCached() {
  const now = Date.now();
  ownerDashboardLastAccess = now;
  const entry = ownerDashboardCache;
  if (entry && now - entry.at < OWNER_DASHBOARD_FRESH_MS) {
    return { ...entry.payload, timing: { ...(entry.payload.timing || {}), cache: "fresh" } };
  }
  if (entry && now - entry.at < OWNER_DASHBOARD_STALE_MS) {
    if (!entry.refreshing) refreshOwnerDashboardCache();
    return { ...entry.payload, timing: { ...(entry.payload.timing || {}), cache: "stale" } };
  }
  const startedAt = Date.now();
  const payload = await getDashboardData();
  payload.timing = { dashboardMs: Date.now() - startedAt, cache: "miss" };
  ownerDashboardCache = { payload, at: Date.now(), refreshing: false };
  return payload;
}

// Keep the payload hot while an owner is actively using the panel; idle after
// 15 minutes of no access so an unattended server isn't running Docker/Nginx
// collectors forever.
const OWNER_DASHBOARD_WARM_MS = Number(process.env.OWNER_DASHBOARD_WARM_MS || 30000);
const ownerDashboardWarmer = setInterval(() => {
  if (Date.now() - ownerDashboardLastAccess > 15 * 60 * 1000) return;
  if (ownerDashboardCache?.refreshing) return;
  refreshOwnerDashboardCache();
}, OWNER_DASHBOARD_WARM_MS);
ownerDashboardWarmer.unref?.();

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

function tenantBillingUsageMap(data, tenants = []) {
  // Owner hot path: derive each tenant's billing-period usage from the stored
  // daily counts (rotation-safe, maintained by persistDailySummary) — NOT from a
  // live per-tenant Nginx log scan. The old version ran `tail -n 50000` + a 50k
  // line regex parse PER TENANT on the JS main thread, blocking the event loop
  // for tens of seconds once there were many tenants. Stored daily data is the
  // billing source of truth; the customer's own dashboard still does the precise
  // live scan for its single tenant.
  const todayKey = localDateKey();
  const entries = (tenants || []).map((tenant) => {
    const tenantSetupRequests = (data.customerSetup?.requests || []).filter((request) => request.tenantId === tenant.id && !isDeletedStatus(request.status));
    const period = billingPeriodForTenant(tenant, tenantSetupRequests);
    const tenantDailyReqs = (data.tenantDailyRequests || {})[tenant.id] || {};
    const startKey = localDateKey(period.start);
    // Merge the SQLite event-store daily snapshots (same source the customer
    // dashboard reads) so the owner's per-tenant count matches the customer's. These
    // are cached daily summaries, precomputed by persistSnapshotTick and rebuilt only
    // for uncached days — an in-process SQLite read, NOT a live nginx log scan, so the
    // owner hot path stays cheap and this never touches live tracking. Empty {} for
    // tenants with no event source, leaving their JSON-only count unchanged.
    const sqliteSnaps = sqliteSnapshotsForTenant(tenant.id, tenant);
    // Per day in the billing period take the larger of the JSON-stored count and the
    // SQLite snapshot total, so a day missed/undercounted by one source is covered by
    // the other (rotation loss, un-persisted days). Matches customerDashboardData.
    const dayKeys = new Set([
      ...Object.keys(tenantDailyReqs),
      ...Object.keys(sqliteSnaps)
    ]);
    let accumulatedCount = 0;
    for (const d of dayKeys) {
      if (d < startKey || d > todayKey) continue;
      accumulatedCount += Math.max(Number(tenantDailyReqs[d] || 0), Number(sqliteSnaps[d]?.total || 0));
    }
    return [tenant.id, {
      requestsMonth: Math.max(accumulatedCount, Number(tenant.requestsMonth || 0)),
      period: period.label,
      available: accumulatedCount > 0
    }];
  });
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
  // Otherwise fall back to the shared nginx access log ONLY for the single-VPS
  // "environment" default customer — on that setup all traffic is theirs. A freshly
  // signed-up customer with no container has no event source of its own, so it must
  // NOT read the shared log (that would leak global scan noise / other tenants'
  // traffic into a brand-new account). Such accounts show empty until a container
  // is provisioned and their dedicated log appears.
  const useDedicatedLogs = tenantLogPaths.length > 0;
  const allowSharedFallback = !useDedicatedLogs && tenant?.source === "environment";
  const hasEventSource = useDedicatedLogs || allowSharedFallback;
  const fallbackPaths = useDedicatedLogs ? tenantLogPaths
    : allowSharedFallback ? [config.accessLog].filter(Boolean)
    : [];
  const emptyPeriodSummary = { available: false, count: 0, period: billingPeriod };
  const [tenantAccessLog, rawTodaySummary, rawPeriodSummary] = await Promise.all([
    useDedicatedLogs
      ? customerAccessLogForTenant(data, session.tenantId)
      : allowSharedFallback
        ? tailFile(config.accessLog, config.logTailLines)
        : Promise.resolve(unavailable("No container access log is available yet.", "Create a live container first.")),
    fallbackPaths.length
      ? summarizeRequestsTodayForPaths(fallbackPaths, customerSummaryOptions)
      : Promise.resolve({ available: false, count: 0, recentEvents: [] }),
    fallbackPaths.length
      ? summarizeRequestsForPeriodForPaths(fallbackPaths, billingPeriod, customerSummaryOptions)
      : Promise.resolve(emptyPeriodSummary)
  ]);
  const tenantRequestSummary = filterRequestSummaryForTenant(rawTodaySummary, tenant);
  const tenantPeriodSummary = rawPeriodSummary;
  const requestLimit = tenant?.requestLimit || data.usage.requestLimit;
  const todayKey = localDateKey();
  // No event source → no retained history / SQLite snapshots either, so the daily
  // charts and Event-Log-by-Day table stay empty for containerless accounts.
  const tenantEventHistory = hasEventSource
    ? (data.history?.tenantEventHistory || data.tenantEventHistory || {})[session.tenantId] || {}
    : {};
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
  const sqliteSnapshotsByDate = hasEventSource ? sqliteSnapshotsForTenant(session.tenantId, tenant) : {};
  for (const [dateKey, snapshot] of Object.entries(sqliteSnapshotsByDate)) {
    const existing = retainedSnapshotsByDate[dateKey];
    if (!existing || Number(snapshot.total || 0) > Number(existing.total || 0)) {
      retainedSnapshotsByDate[dateKey] = snapshot;
    }
  }

  // The SQLite event store is the source of truth the Event Logs read from; the live
  // nginx tail is lossy (rotation, partial dedup) and can report fewer purchases /
  // revenue for the same day. Prefer today's FULL SQLite summary (cached by
  // sqliteSnapshotsForTenant) whenever it has seen at least as many events, so the
  // dashboard's today KPIs / top events / distribution / graph match the Event Logs.
  // Only fall back to the tail when SQLite is momentarily lagging (fewer events).
  const sqliteTodayCache = hasEventSource ? todaySnapshotCache.get(session.tenantId) : null;
  const sqliteTodaySummary = (sqliteTodayCache && sqliteTodayCache.dateKey === todayKey && sqliteTodayCache.summary?.available)
    ? sqliteTodayCache.summary
    : null;
  let todayEventsSummary = (sqliteTodaySummary && Number(sqliteTodaySummary.count || 0) >= Number(tenantRequestSummary.count || 0))
    ? sqliteTodaySummary
    : tenantRequestSummary;
  // Aggregate counts (events/purchases/hourly) are already computed over all lines,
  // so trimming the raw recentEvents list keeps totals accurate while bounding the
  // dashboard payload to the same size the live tail produced.
  if (todayEventsSummary === sqliteTodaySummary && Array.isArray(todayEventsSummary.recentEvents) && todayEventsSummary.recentEvents.length > config.customerSummaryTailLines) {
    todayEventsSummary = { ...todayEventsSummary, recentEvents: todayEventsSummary.recentEvents.slice(-config.customerSummaryTailLines) };
  }
  if (todayEventsSummary.available) {
    retainedSnapshotsByDate[todayKey] = historySnapshotFromSummary(todayEventsSummary, todayKey);
  }
  const retainedEventsSummary = retainedSummaryFromSnapshots(Object.values(retainedSnapshotsByDate), todayEventsSummary);

  // Compute billing-period event count that survives nightly log rotation.
  // Strategy: sum stored per-tenant daily counts for past days (from persistDailySummary)
  // plus today's live count from the current nginx log. If the live period summary
  // (tail-based) returns a higher value—meaning the log hasn't rotated yet and covers
  // the full billing period—we use that instead so we never under-report.
  const tenantDailyReqs = (data.history?.tenantDailyRequests || data.tenantDailyRequests || {})[session.tenantId] || {};
  // Build per-day rows enriched with per-event-type counts + purchase totals so the
  // browser can drive the 24h/7d/30d KPI slider and multi-series daily chart without
  // another request. `total` is kept for back-compat with the existing chart.
  const dailyDateKeys = [...new Set([...Object.keys(tenantDailyReqs), ...Object.keys(retainedSnapshotsByDate)])]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30);
  const tenantDailyHistory = dailyDateKeys.map((date) => {
    const snap = retainedSnapshotsByDate[date];
    const events = snap?.events || [];
    const byType = (name) => Number((events.find((e) => e.name === name) || {}).count || 0);
    const ps = snap?.purchaseSummary || {};
    const purchaseCount = Number(ps.uniqueCount || 0) || byType("Purchase");
    return {
      date,
      total: Math.max(Number(tenantDailyReqs[date] || 0), Number(snap?.total || 0)),
      errors: Number(snap?.errors || 0),
      pageView: byType("PageView"),
      viewItem: byType("ViewItem"),
      addToCart: byType("AddToCart"),
      beginCheckout: byType("BeginCheckout"),
      purchases: purchaseCount,
      purchaseCount,
      purchaseRevenue: Number(ps.uniqueRevenue || ps.rawRevenue || 0),
      currency: ps.currency || ""
    };
  });
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
    // Drives which currency "My Subscription" displays — a Paddle tenant sees
    // USD pricing, everyone else sees the BDT bKash/Nagad catalog.
    paymentProvider: tenant?.paymentProvider || "",
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
  const tenantReconciliation = getReconciliationSummary({ requestSummary: todayEventsSummary, orders: tenantOrders });

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
        tenants: [publicTenantForCustomer(tenant)]
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
      todayEvents: todayEventsSummary,
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
    integrations: getIntegrationSummary({ orders: tenantOrders, requestSummary: todayEventsSummary }),
    config: { ...publicCustomerConfig(data), cpanelBridgeEnabled: cpanelBridgeAvailableFor(session.tenantId) }
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
  const hasHostInfo = [...(summary.recentEvents || []), ...(summary.purchaseEvents || [])].some((event) => {
    const host = normalizeHost(event.host);
    return host && host !== "unknown host";
  });
  if (!hasHostInfo) return summary;

  const recentEvents = (summary.recentEvents || []).filter((event) => hostMatchesTenant(event.host, tenant));
  const purchaseEvents = (summary.purchaseEvents || (summary.recentEvents || []).filter((event) => event.eventName === "Purchase"))
    .filter((event) => hostMatchesTenant(event.host, tenant));
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
  const purchaseOrders = new Map();
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
      const bucket = hourly[dhakaShifted(date).getUTCHours()];
      bucket.total += 1;
      if (Number(event.status) >= 400) bucket.errors += 1;
      if (event.eventName === "Purchase") bucket.purchases += 1;
      else if (event.eventName === "PageView") bucket.pageView += 1;
      else if (event.eventName === "ViewItem") bucket.viewItem += 1;
      else if (event.eventName === "AddToCart") bucket.addToCart += 1;
      else if (event.eventName === "BeginCheckout") bucket.beginCheckout += 1;
    }
  }

  // Purchase cards have their own uncapped feed. Derive the tenant's purchase
  // totals from it as well, otherwise host filtering would still reduce a busy
  // day's accurate aggregate to however many purchases happened to be in the
  // latest general-event slice.
  for (const event of purchaseEvents) {
    if (event.eventName === "Purchase") {
      purchases.rawCount += 1;
      const amount = parseMoney(event.value);
      if (amount !== null) purchases.rawRevenue += amount;
      // Dedupe by transaction_id (or event_id) so the browser hit and the
      // server-side recovery hit for the same order — both logged to /g/collect —
      // count as one purchase. Keyless rows fall back to a per-row token so they
      // still count individually. uniqueRevenue is summed once per unique order.
      const key = event.transactionId || event.eventId;
      if (key) {
        if (!purchaseOrders.has(key)) {
          purchaseOrders.set(key, true);
          purchases.uniqueCount += 1;
          if (amount !== null) purchases.uniqueRevenue += amount;
        }
        purchaseKeys.add(key);
      } else {
        purchases.uniqueCount += 1;
        if (amount !== null) purchases.uniqueRevenue += amount;
      }
      if (event.currency) purchaseCurrencies.add(String(event.currency).toUpperCase());
    }
  }

  purchases.keyedCount = purchaseKeys.size;
  purchases.duplicateCount = Math.max(0, purchases.rawCount - purchases.uniqueCount);
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
    purchaseEvents,
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

// In-memory static-asset cache: avoids re-reading + re-gzipping large files
// (app.js ~208KB, styles.css ~80KB) on every cold request. Keyed by path; the
// stored entry is invalidated when the file's mtime/size changes on disk.
const staticAssetCache = new Map();

async function loadStaticAsset(absolutePath) {
  const fileStat = await stat(absolutePath);
  const sig = `${fileStat.mtimeMs}-${fileStat.size}`;
  const cached = staticAssetCache.get(absolutePath);
  if (cached && cached.sig === sig) return cached;

  const content = await readFile(absolutePath);
  const mime = mimeTypes[extname(absolutePath)] || "application/octet-stream";
  const compressible = /javascript|css|html|json|text\//.test(mime);
  const gzipped = compressible && content.length > 1024 ? await gzipAsync(content) : null;
  const entry = {
    sig,
    content,
    gzipped,
    mime,
    etag: `"${fileStat.mtime.getTime().toString(16)}-${fileStat.size.toString(16)}"`,
    lastModified: fileStat.mtime.toUTCString()
  };
  staticAssetCache.set(absolutePath, entry);
  return entry;
}

async function serveStatic(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = reqUrl.pathname;
  const filePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(publicDir, normalizedPath);

  if (!absolutePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const asset = await loadStaticAsset(absolutePath);

    // Ctrl+R sends If-None-Match; 304 means browser uses cached copy → zero download
    if (req.headers["if-none-match"] === asset.etag) {
      res.writeHead(304);
      res.end();
      return;
    }

    // Versioned assets (?v=…) are content-addressed by the caller (e.g. app.js?v=3):
    // serve them immutable for a year so normal navigation (login → dashboard) reuses
    // the cached copy with zero revalidation round-trips. Unversioned files keep
    // must-revalidate so edits show up immediately.
    const versioned = reqUrl.searchParams.has("v");
    const cacheControl = versioned
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";

    const headers = {
      "content-type": asset.mime,
      "cache-control": cacheControl,
      "etag": asset.etag,
      "last-modified": asset.lastModified
    };

    const acceptsGzip = /gzip/.test(req.headers["accept-encoding"] || "");
    if (acceptsGzip && asset.gzipped) {
      headers["content-encoding"] = "gzip";
      headers["vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(asset.gzipped);
    } else {
      res.writeHead(200, headers);
      res.end(asset.content);
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

    // Paid-plan customer hasn't submitted their transaction ID yet → hold them on
    // the /checkout page instead of the dashboard until they do.
    if (shouldGateAppShellToCheckout(pathname, req.method)) {
      const session = getSession(req);
      if (session?.role === "customer") {
        const loaded = await readDatabaseCached();
        const tenant = loaded.available ? (loaded.data.tenants || []).find((t) => t.id === session.tenantId) : null;
        if (tenant && checkoutRequired(tenant, loaded.data)) {
          redirect(res, "/checkout");
          return;
        }
      }
    }

    if (pathname === "/landing.css" || pathname === "/terms.css" || pathname.startsWith("/assets/")) {
      await serveStatic(req, res);
      return;
    }

    if (pathname === "/features") {
      await servePublicPage(res, "features.html");
      return;
    }

    if (pathname === "/pricing") {
      await servePublicPage(res, "pricing.html");
      return;
    }

    if (pathname === "/compare") {
      await servePublicPage(res, "compare.html");
      return;
    }

    if (pathname === "/how-it-works") {
      await servePublicPage(res, "how-it-works.html");
      return;
    }

    if (pathname === "/docs") {
      await servePublicPage(res, "docs.html");
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
      if (!checkRateLimit(req, "forgot-password", 5, 60 * 60 * 1000)) { tooManyRequests(res); return; }
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
      const prefillEmail = reqUrl.searchParams.get("email") || "";
      // Carry a chosen paid plan from the pricing page through signup so a
      // paid-plan visitor is routed to payment after registering, not dropped
      // onto the Free/trial dashboard. Only accept known paid plans; anything
      // else (incl. "Free") falls through to the normal free signup.
      const rawPlan = String(reqUrl.searchParams.get("plan") || "").trim();
      const selectedPlan = ["Starter", "Pro", "Enterprise"].includes(rawPlan) ? rawPlan : "";
      const rawCycle = String(reqUrl.searchParams.get("cycle") || "").trim();
      const selectedCycle = billingCycleConfig[rawCycle] ? rawCycle : "monthly";
      const cookies = parseCookies(req.headers.cookie);
      // Reached the signup form = real purchase intent for a self-serve trial
      // (SaaS equivalent of InitiateCheckout) — worth a Meta "Lead" so unfinished
      // signups can be retargeted. tg_vid is a stable per-visitor seed reused by
      // the sign_up forward on actual completion, so GA4/Meta tie Lead ->
      // CompleteRegistration to the same visitor. tg_lead_sent just dedupes
      // reloads/repeat visits within a day so Lead volume stays a real-intent signal.
      const setCookies = [];
      // tg_vid is client-supplied, and it now reaches an inline <script> on this page as
      // well as Meta's hashed external_id and the GA4 client seed. Only accept the shape
      // this server issues (32 hex chars); anything else is treated as absent and a fresh
      // id is minted, so a forged cookie can neither inject markup nor poison match keys.
      let visitorId = /^[0-9a-f]{32}$/.test(String(cookies.tg_vid || "")) ? cookies.tg_vid : "";
      if (!visitorId) {
        visitorId = randomBytes(16).toString("hex");
        setCookies.push(`tg_vid=${visitorId}; Path=/; Max-Age=7776000; SameSite=Lax`);
      }
      // Declared out here so the rendered page can carry the same id to the browser
      // pixel. Stays "" on reloads that don't send a Lead, so the browser copy fires
      // on exactly the requests the server copy does — no unmatched browser Leads.
      let leadEventId = "";
      if (!cookies.tg_lead_sent) {
        // Snapshot this visitor's IP/UA/_fbp/_fbc before responding — both sends
        // below run server-to-server and would otherwise carry the VPS's own
        // identity. On a first visit tg_vid isn't in the cookie header yet, so
        // seed the snapshot with the id we just minted.
        const leadVisitor = { ...(tagiooVisitorContext(req) || {}), vid: visitorId };
        leadEventId = `lead_${visitorId}_${Math.floor(Date.now() / 1000)}`;
        forwardTagiooOwnEvent("generate_lead", {
          seed: visitorId,
          visitor: leadVisitor,
          eventParams: { "ep.event_id": leadEventId }
        }).catch(() => {});
        // Same event_id so Meta dedupes to one Lead and merges the richer copy.
        sendTagiooLeadToMetaCapi(leadVisitor, leadEventId).catch(() => {});
        setCookies.push(`tg_lead_sent=1; Path=/; Max-Age=86400; SameSite=Lax`);
      }
      const headers = setCookies.length ? { "set-cookie": setCookies } : {};
      htmlResponse(res, 200, signupPage("", { email: prefillEmail, plan: selectedPlan, billingCycle: selectedCycle }, { leadEventId }), headers);
      return;
    }

    if (pathname === "/signup" && req.method === "POST") {
      if (!checkRateLimit(req, "signup", 5, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const form = await readForm(req);
      const values = Object.fromEntries(form.entries());
      // Don't create the account yet — validate, then email a code. The account
      // is only created once the code is confirmed at POST /verify, so an
      // unverified email never becomes a usable login.
      const check = await validateSignupInput(values);
      if (!check.ok) {
        htmlResponse(res, 400, signupPage((check.errors || ["Signup failed."]).join(" "), values));
        return;
      }
      pendingSignupStore.sweep();
      const token = randomBytes(32).toString("hex");
      const code = makeVerificationCode();
      // Hash the password NOW. validateSignupInput has already confirmed the two
      // fields match, so the plaintext has no further use — and this record is
      // persisted to disk, where a plaintext credential must never land.
      const { password, confirmPassword, confirm_password: confirmPasswordAlt, ...safeValues } = values;
      pendingSignupStore.put(token, {
        values: { ...safeValues, passwordHash: hashPassword(password) },
        email: check.email,
        code,
        expires: Date.now() + SIGNUP_VERIFY_TTL_MS,
        attempts: 0,
        resendAt: Date.now() + 30 * 1000
      });
      emailVerificationCode(check.email, values.fullName, code).catch(() => {});
      res.writeHead(302, {
        location: "/verify",
        "set-cookie": `tg_signup=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SIGNUP_VERIFY_TTL_MS / 1000}`,
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    if (pathname === "/verify" && req.method === "GET") {
      if (isAuthenticated(req)) { redirect(res, "/"); return; }
      const token = parseCookies(req.headers.cookie).tg_signup || "";
      const pending = pendingSignupStore.get(token);
      if (!token || !pending) {
        redirect(res, "/signup");
        return;
      }
      htmlResponse(res, 200, verifyPage({ email: pending.email }));
      return;
    }

    if (pathname === "/verify/resend" && req.method === "POST") {
      const token = parseCookies(req.headers.cookie).tg_signup || "";
      const pending = pendingSignupStore.get(token);
      if (!token || !pending) {
        redirect(res, "/signup");
        return;
      }
      if (Date.now() < pending.resendAt) {
        htmlResponse(res, 429, verifyPage({ email: pending.email, error: "Please wait a moment before requesting another code." }));
        return;
      }
      pending.code = makeVerificationCode();
      pending.expires = Date.now() + SIGNUP_VERIFY_TTL_MS;
      pending.attempts = 0;
      pending.resendAt = Date.now() + 30 * 1000;
      // The record is a detached copy once it lives in SQLite, so mutations only
      // take effect when written back.
      pendingSignupStore.put(token, pending);
      emailVerificationCode(pending.email, pending.values.fullName, pending.code).catch(() => {});
      htmlResponse(res, 200, verifyPage({ email: pending.email, info: "A new code is on its way to your inbox." }));
      return;
    }

    if (pathname === "/verify" && req.method === "POST") {
      if (!checkRateLimit(req, "verify", 10, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const token = parseCookies(req.headers.cookie).tg_signup || "";
      const pending = pendingSignupStore.get(token);
      if (!token || !pending) {
        if (token) pendingSignupStore.delete(token);
        htmlResponse(res, 400, signupPage("Your verification session expired. Please sign up again."));
        return;
      }
      const form = await readForm(req);
      const submitted = String(form.get("code") || "").trim();
      pending.attempts += 1;
      if (pending.attempts > 6) {
        pendingSignupStore.delete(token);
        htmlResponse(res, 400, signupPage("Too many incorrect attempts. Please sign up again."));
        return;
      }
      // Persist the attempt count before answering, so the brute-force ceiling
      // survives a restart instead of silently resetting to zero.
      pendingSignupStore.put(token, pending);
      if (submitted !== pending.code) {
        htmlResponse(res, 400, verifyPage({ email: pending.email, error: "Incorrect code. Check your email and try again." }));
        return;
      }

      // Code confirmed — now create the account.
      const values = pending.values;
      const result = await addCustomerSignup(values);
      if (!result.ok) {
        htmlResponse(res, 400, signupPage((result.errors || ["Signup failed."]).join(" "), values));
        return;
      }
      pendingSignupStore.delete(token);
      invalidateOwnerDashboardCache();

      // Self-signup is always plan "Free" (addCustomerSignup hardcodes it) — this
      // is tagioo's own acquisition-funnel conversion, forwarded to tagioo's own
      // GA4/Meta (TAGIOO_OWN_TRACKING), never the new tenant's own tracking. Seed
      // with tg_vid (set on the GET /signup Lead hit) when present so GA4/Meta
      // tie this CompleteRegistration to the same visitor as the earlier Lead.
      const signupEventId = `signup_${result.account.id}`;
      const signupVisitor = tagiooVisitorContext(req);
      forwardTagiooOwnEvent("sign_up", {
        seed: parseCookies(req.headers.cookie).tg_vid || result.account.tenantId,
        visitor: signupVisitor,
        eventParams: {
          "ep.plan": "Free",
          "ep.tenant_id": result.account.tenantId,
          "ep.event_id": signupEventId
        }
      }).catch(() => {});
      // Same event_id as above so Meta dedupes into one CompleteRegistration and
      // merges in the hashed email/phone/name plus the visitor's IP/UA/fbp/fbc.
      sendTagiooSignupToMetaCapi(values, signupEventId, signupVisitor).catch(() => {});
      // Keep the snapshot: a paid upgrade is confirmed later in an owner session,
      // where the buyer's own request context is no longer available.
      saveTagiooVisitorContext(result.account.tenantId, signupVisitor).catch(() => {});

      // If the visitor picked a paid plan on the pricing page, don't drop them
      // on the Free/trial dashboard — stage the upgrade as pending_payment
      // (issues an invoice, keeps limits at Free until owner confirms) and send
      // them to the billing view to pay via bKash/Nagad. Payment is manual:
      // owner verifies the transaction, then confirmPayment flips to active.
      // Paid plan → stage the upgrade and route to the standalone /checkout page
      // where they must submit a bKash/Nagad transaction ID before the dashboard
      // opens. Free signups go straight in.
      const chosenPlan = String(values.plan || "").trim();
      let landing = "/#customerContainers";
      if (["Starter", "Pro", "Enterprise"].includes(chosenPlan)) {
        const staged = await selectCustomerPlan(
          { plan: chosenPlan, billingCycle: values.billingCycle || "monthly" },
          { tenantId: result.account.tenantId }
        );
        if (staged.ok) {
          landing = "/checkout";
          // Paid plan staged at signup — the SaaS InitiateCheckout. Reuse this
          // request's own visitor context rather than the stored snapshot; it was
          // written moments ago and this is the same visit.
          trackTagiooCheckoutStep("initiate_checkout", {
            tenantId: result.account.tenantId,
            plan: chosenPlan,
            amount: staged.payment?.amount,
            orderId: staged.payment?.invoiceNo,
            visitor: signupVisitor
          }).catch(() => {});
        }
      }

      const account = {
        username: result.account.username,
        role: "customer",
        tenantId: result.account.tenantId,
        accountId: result.account.id
      };
      res.writeHead(302, {
        location: landing,
        "set-cookie": [
          `sgtm_session=${makeSessionCookie(account)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
          `tg_signup=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
        ],
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    if (pathname === "/checkout" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") { redirect(res, "/login"); return; }
      const loaded = await readDatabase();
      const tenant = loaded.available ? (loaded.data.tenants || []).find((t) => t.id === session.tenantId) : null;
      // Nothing to pay for (free, already claimed, or already active) → dashboard.
      if (!tenant || !checkoutRequired(tenant, loaded.data)) { redirect(res, "/"); return; }
      htmlResponse(res, 200, checkoutPage({ instructions: paymentInstructionsFor(tenant, loaded.data), paddle: paddleCheckoutConfigFor(tenant) }));
      return;
    }

    // "Not now — continue on the Free plan": drops the unpaid invoice and opens
    // the dashboard on Free. Same release the next login would perform, so the
    // customer isn't stuck behind the wall for the rest of this session.
    if (pathname === "/checkout/skip" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") { redirect(res, "/login"); return; }
      const released = await releaseUnpaidSignupToFree(session.tenantId).catch(() => ({ released: false }));
      if (released.released) invalidateOwnerDashboardCache();
      redirect(res, "/");
      return;
    }

    if (pathname === "/checkout" && req.method === "POST") {
      if (!checkRateLimit(req, "payment-claim", 10, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const session = getSession(req);
      if (!session || session.role !== "customer") { redirect(res, "/login"); return; }
      const form = await readForm(req);
      const values = Object.fromEntries(form.entries());
      const result = await submitPaymentClaim(values, session);
      if (result.ok) {
        invalidateOwnerDashboardCache();
        // Same as /api/customer/payment-claim: capture the buyer's own match
        // signals now, since the Purchase fires later in an owner session.
        saveTagiooVisitorContext(session.tenantId, tagiooVisitorContext(req)).catch(() => {});
        redirect(res, "/#billing");
        return;
      }
      // Re-render with errors; reload the tenant for fresh payment instructions.
      const loaded = await readDatabase();
      const tenant = loaded.available ? (loaded.data.tenants || []).find((t) => t.id === session.tenantId) : null;
      if (!tenant || !checkoutRequired(tenant, loaded.data)) { redirect(res, "/"); return; }
      htmlResponse(res, 400, checkoutPage({
        instructions: paymentInstructionsFor(tenant, loaded.data),
        paddle: paddleCheckoutConfigFor(tenant),
        error: (result.errors || ["Payment submission failed."]).join(" "),
        values
      }));
      return;
    }

    if (pathname === "/login" && req.method === "POST") {
      if (!checkRateLimit(req, "login", 10, 60 * 1000)) { tooManyRequests(res); return; }
      const form = await readForm(req);
      const username = form.get("username") || "";
      const password = form.get("password") || "";
      const account = await authenticateLogin(username, password);

      if (!account) {
        htmlResponse(res, 401, loginPage("Invalid username or password."));
        return;
      }

      // Paid-plan signup that never paid: don't send them back to the checkout
      // wall on every login. Drop the unpaid invoice and let them in on Free —
      // they can re-pick a paid plan from Account & Billing whenever they want.
      if (account.role === "customer" && account.tenantId) {
        const released = await releaseUnpaidSignupToFree(account.tenantId).catch(() => ({ released: false }));
        if (released.released) invalidateOwnerDashboardCache();
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
      const rawText = rawBody.toString("utf8");
      // WooCommerce verifies a new webhook with a form-encoded ping (webhook_id=N).
      // deliver_ping() skips the normal delivery path and sends NO signature
      // header, so the ping must be accepted before the signature check.
      if (/^webhook_id=\d+$/.test(rawText.trim())) {
        jsonResponse(res, 200, { ping: true });
        return;
      }
      if (!isWooOrderWebhookAuthorized(req, rawBody, webhookSecret)) {
        jsonResponse(res, 401, { error: "Invalid WooCommerce webhook signature." });
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

    // Laravel Bridge purchase endpoint. The Bridge writes to a local outbox and
    // sends after the checkout response; this endpoint verifies its per-tenant
    // HMAC and then reuses the same deduplicated recovery path as WooCommerce.
    if (pathname === "/api/orders/laravel" && req.method === "POST") {
      let rawBody;
      try {
        rawBody = await readRawBody(req, 250000);
      } catch (error) {
        jsonResponse(res, 413, { error: error.message });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON payload." });
        return;
      }
      const tenantId = sanitizeId(payload.tenant_id || payload.tenantId || "");
      const loadedForSecret = await readDatabaseCached();
      const snapshotTenant = loadedForSecret.available ? (loadedForSecret.data.tenants || []).find((item) => item.id === tenantId) : null;
      const secret = snapshotTenant?.laravelBridgeSecret || "";
      if (!tenantId || !secret || !isLaravelBridgeAuthorized(req, rawBody, secret)) {
        jsonResponse(res, 401, { error: "Invalid Laravel Bridge signature." });
        return;
      }
      if (String(payload.event_name || "purchase") !== "purchase") {
        jsonResponse(res, 400, { error: "This Bridge version accepts purchase events only." });
        return;
      }
      if (payload.source === "tagioo-cpanel-bridge" && !snapshotTenant?.tracking?.laravelSelfService?.active) {
        jsonResponse(res, 409, { error: "Activate Laravel tracking from the Tagioo dashboard before sending orders." });
        return;
      }
      const result = await addOrderWebhook({
        ...payload,
        tenant_id: tenantId,
        order_id: payload.order_id || payload.event_id,
        source: payload.source === "tagioo-cpanel-bridge" ? "tagioo-cpanel-bridge" : "tagioo-laravel-bridge"
      });
      jsonResponse(res, result.ok ? (result.created ? 202 : 200) : 400, result.ok
        ? { accepted: true, created: result.created, order_id: result.order.id }
        : { errors: result.errors });
      return;
    }

    // Self-service bridge control channel. It carries schema names and runtime
    // health only—never order rows—and uses the same isolated Laravel HMAC key.
    if (pathname === "/api/laravel/bridge/heartbeat" && req.method === "POST") {
      let rawBody;
      try {
        rawBody = await readRawBody(req, 100000);
      } catch (error) {
        jsonResponse(res, 413, { error: error.message });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON payload." });
        return;
      }
      const tenantId = sanitizeId(payload.tenant_id || payload.tenantId || "");
      if (!cpanelBridgeAvailableFor(tenantId)) {
        jsonResponse(res, 404, { error: "Laravel self-service is not enabled for this tenant." });
        return;
      }
      const loadedForSecret = await readDatabaseCached();
      const snapshotTenant = loadedForSecret.available ? (loadedForSecret.data.tenants || []).find((item) => item.id === tenantId) : null;
      const secret = snapshotTenant?.laravelBridgeSecret || "";
      if (!tenantId || !secret || !isLaravelBridgeAuthorized(req, rawBody, secret)) {
        jsonResponse(res, 401, { error: "Invalid Laravel Bridge signature." });
        return;
      }
      const result = await recordLaravelBridgeHeartbeat(payload, tenantId, snapshotTenant);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok
        ? { accepted: true, active: result.active, status: result.status, mapping: result.mapping, heartbeat_interval: result.heartbeatInterval }
        : { errors: result.errors });
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

    // Public, unauthenticated — the marketing/pricing pages call this client-side
    // (before any session exists) to decide which currency to display. A manual
    // /bd or /global visit (see below) sets tg_currency, which wins over the
    // Cloudflare-derived guess — handles VPNs and lets a visitor self-correct.
    if (pathname === "/api/geo" && req.method === "GET") {
      const forced = parseCookies(req.headers.cookie).tg_currency;
      if (forced === "BDT" || forced === "USD") {
        jsonResponse(res, 200, { country: forced === "BDT" ? "BD" : "", currency: forced, forced: true });
        return;
      }
      const country = detectCountryCode(req);
      jsonResponse(res, 200, { country, currency: currencyForCountry(country) });
      return;
    }

    // Manual currency override: /bd forces BDT, /global forces USD, both sticky
    // for a year via cookie. next must be a same-site relative path — reject
    // anything that could redirect off tagioo.com (open-redirect guard).
    if ((pathname === "/bd" || pathname === "/global") && req.method === "GET") {
      const nextParam = String(reqUrl.searchParams.get("next") || "/");
      const next = nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.includes("://") ? nextParam : "/";
      const currency = pathname === "/bd" ? "BDT" : "USD";
      res.writeHead(302, {
        location: next,
        "set-cookie": `tg_currency=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`,
        "cache-control": "no-store"
      });
      res.end();
      return;
    }

    // Paddle webhook: card checkout activation for US/international customers,
    // parallel to the manual bKash/Nagad claim flow. Signed over the raw body
    // (Paddle-Signature header), so this must stay above the session auth gate.
    if (pathname === "/api/paddle/webhook" && req.method === "POST") {
      let rawBody;
      try {
        rawBody = await readRawBody(req);
      } catch (error) {
        jsonResponse(res, 413, { error: error.message });
        return;
      }
      if (!isPaddleWebhookAuthorized(req, rawBody)) {
        jsonResponse(res, 401, { error: "Invalid Paddle webhook signature." });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON payload." });
        return;
      }

      const eventType = String(payload.event_type || "");
      const eventData = payload.data || {};

      if (eventType === "transaction.completed" || eventType === "transaction.paid") {
        const customData = eventData.custom_data || {};
        const tenantId = String(customData.tenantId || "").trim();
        const planName = String(customData.planName || "").trim();
        const totalMinor = Number(eventData.details?.totals?.total || 0);
        const result = await activatePaddleTenant({
          tenantId,
          planName,
          amount: totalMinor / 100,
          currency: eventData.currency_code || "USD",
          paddleTransactionId: eventData.id,
          paddleSubscriptionId: eventData.subscription_id || "",
          paddleCustomerId: eventData.customer_id || ""
        });
        if (result.ok) invalidateOwnerDashboardCache();
        jsonResponse(res, result.ok ? 202 : (result.status || 400), result.ok ? { activated: true, duplicate: Boolean(result.duplicate) } : { errors: result.errors });
        return;
      }

      if (eventType === "subscription.canceled" || eventType === "subscription.paused") {
        const result = await deactivatePaddleTenant(eventData.id);
        if (result.ok) invalidateOwnerDashboardCache();
        jsonResponse(res, result.ok ? 202 : (result.status || 400), result.ok ? { deactivated: true } : { errors: result.errors });
        return;
      }

      // Fires on any subscription change — the customer-initiated plan-change
      // path (POST /api/customer/subscription/paddle below) only calls
      // Paddle's API; this webhook is what actually applies the new plan/limits.
      if (eventType === "subscription.updated") {
        const result = await syncPaddleSubscriptionPlan(eventData.id, eventData.items);
        if (result.ok && !result.skipped && !result.unchanged) invalidateOwnerDashboardCache();
        jsonResponse(res, result.ok ? 202 : (result.status || 400), result.ok ? { synced: true } : { errors: result.errors });
        return;
      }

      // Unhandled event types: acknowledge so Paddle doesn't treat it as a
      // failed delivery and keep retrying.
      jsonResponse(res, 200, { ignored: eventType });
      return;
    }

    if (pathname !== "/login" && pathname !== "/signup" && pathname !== "/tokens.css" && pathname !== "/login.css" && pathname !== "/favicon.svg" && pathname !== "/favicon.ico" && !isAuthenticated(req)) {
      if (pathname.startsWith("/api/")) {
        jsonResponse(res, 401, { error: "Authentication required." });
        return;
      }
      redirect(res, "/login");
      return;
    }

    // The dashboard shell is normally requested as "/", but browsers/bookmarks can
    // hit /index.html directly. Keep the checkout wall on both app-shell URLs so
    // paid-plan signups cannot bypass the standalone payment step.
    if (shouldGateAppShellToCheckout(pathname, req.method)) {
      const session = getSession(req);
      if (session?.role === "customer") {
        const loaded = await readDatabaseCached();
        const tenant = loaded.available ? (loaded.data.tenants || []).find((t) => t.id === session.tenantId) : null;
        if (tenant && checkoutRequired(tenant, loaded.data)) {
          redirect(res, "/checkout");
          return;
        }
      }
    }

    if (req.url?.startsWith("/api/dashboard")) {
      const session = getSession(req);
      const startedAt = Date.now();
      if (session?.role === "customer") {
        const payload = await getCustomerDashboardDataCached(session);
        if (payload.timing?.dashboardMs > 2000) {
          console.warn(`[dashboard] customer dashboard took ${payload.timing.dashboardMs}ms for tenant ${session.tenantId}`);
        }
        await jsonResponseGzip(req, res, 200, payload);
        return;
      }
      const dashboardData = await getDashboardDataCached();
      const payload = { ...dashboardData, session, timing: { ...(dashboardData.timing || {}), role: session?.role || "unknown", requestMs: Date.now() - startedAt } };
      if (payload.timing.cache === "miss" && payload.timing.dashboardMs > 2000) {
        console.warn(`[dashboard] owner dashboard cold build took ${payload.timing.dashboardMs}ms`);
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
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 201 : (result.status || 400), result.ok ? { request: result.request } : { errors: result.errors });
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

    if (pathname === "/api/customer/laravel-managed-setup" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await requestLaravelManagedSetup(body, session);
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 201 : result.status || 400, result.ok
        ? { setup: result.setup }
        : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const tenant = await tenantForSession(session);
      jsonResponse(res, 200, {
        available: cpanelBridgeAvailableFor(session.tenantId),
        setup: publicLaravelSelfService(tenant?.tracking?.laravelSelfService || {})
      });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service/start" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await startLaravelSelfService(await readJson(req), session);
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 201 : result.status || 400, result.ok ? { setup: result.setup } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service/mapping" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await saveLaravelSelfServiceMapping(await readJson(req), session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { setup: result.setup } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service/activate" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await activateLaravelSelfService(session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { setup: result.setup } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service/deactivate" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await deactivateLaravelSelfService(session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { setup: result.setup } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/laravel-self-service/verify" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await verifyLaravelSelfService(session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok
        ? { verified: result.verified, verification: result.verification }
        : { errors: result.errors });
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
      // Persist GA4 creds + tracking origin so the order webhook can forward
      // server-side purchase recovery events to this tenant's sGTM.
      await saveTenantTrackingConfig(session.tenantId, body);
      jsonResponse(res, 200, templates);
      return;
    }

    if (pathname === "/api/customer/setup-assistant/plugin" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      try {
        const phpContent = await readFile(join(rootDir, "tagioo-woocommerce.php"));
        const zip = buildSingleFileZip("tagioo-woocommerce/tagioo-woocommerce.php", phpContent);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=\"tagioo-woocommerce.zip\"",
          "Content-Length": String(zip.length),
          "Cache-Control": "no-store",
        });
        res.end(zip);
      } catch {
        jsonResponse(res, 500, { error: "Plugin file not found on server." });
      }
      return;
    }

    if (pathname === "/api/customer/setup-assistant/laravel-bridge" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const ensured = await ensureCustomerLaravelBridgeSecret(session);
      if (!ensured.ok) {
        jsonResponse(res, ensured.status || 500, { errors: ensured.errors });
        return;
      }
      const webhookSecret = ensured.secret;
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
      const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
      const panelBaseUrl = String(config.publicBaseUrl || config.appUrl || `${forwardedProto}://${forwardedHost}`).replace(/\/$/, "");
      const endpoint = `${panelBaseUrl}/api/orders/laravel`;
      jsonResponse(res, 200, {
        endpoint,
        tenantId: session.tenantId,
        webhookSecret,
        composerCommand: "composer require tagioo/laravel",
        migrateCommand: "php artisan migrate",
        doctorCommand: "php artisan tagioo:doctor",
        env: [
          "TAGIOO_ENABLED=true",
          `TAGIOO_ENDPOINT=${endpoint}`,
          `TAGIOO_TENANT=${session.tenantId}`,
          `TAGIOO_SECRET=${webhookSecret}`
        ].join("\n")
      });
      return;
    }

    if (pathname === "/api/customer/setup-assistant/laravel-bridge.zip" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      try {
        const packageDir = join(rootDir, "packages", "tagioo-laravel");
        const entries = (await filesForZip(packageDir)).map((entry) => ({
          ...entry,
          name: `tagioo-laravel/${entry.name}`
        }));
        const zip = buildZip(entries);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=\"tagioo-laravel-bridge.zip\"",
          "Content-Length": String(zip.length),
          "Cache-Control": "no-store"
        });
        res.end(zip);
      } catch (error) {
        jsonResponse(res, 500, { error: `Laravel Bridge package could not be prepared: ${error.message}` });
      }
      return;
    }

    if (pathname === "/api/customer/setup-assistant/cpanel-bridge.zip" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      // Deliberately invisible until enabled for a controlled staging/pilot
      // tenant. Existing production customers and tracking paths are unchanged.
      if (!cpanelBridgeAvailableFor(session.tenantId)) {
          jsonResponse(res, 404, { error: "The cPanel Bridge is not enabled for this account." });
        return;
      }
      try {
        const loaded = await readDatabase();
        if (!loaded.available) throw new Error(loaded.detail || loaded.message || "Database unavailable.");
        const tenant = (loaded.data.tenants || []).find((item) => item.id === session.tenantId);
        const setup = tenant?.tracking?.laravelSelfService || tenant?.tracking?.laravelManagedSetup;
        const webhookSecret = tenant?.laravelBridgeSecret || "";
        if (!tenant || !setup?.storeUrl || !webhookSecret) {
          jsonResponse(res, 409, { error: "Create your Laravel installation package before downloading the bridge." });
          return;
        }
        const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
        const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
        const panelBaseUrl = String(config.publicBaseUrl || config.appUrl || `${forwardedProto}://${forwardedHost}`).replace(/\/$/, "");
        if (!panelBaseUrl.startsWith("https://")) {
          jsonResponse(res, 503, { error: "The cPanel Bridge requires an HTTPS PUBLIC_BASE_URL on the Tagioo panel." });
          return;
        }
        const sourceDir = join(rootDir, "packages", "tagioo-cpanel-bridge");
        const sourceEntries = (await filesForZip(sourceDir))
          .filter((entry) => entry.name !== "config.example.php")
          .map((entry) => ({ ...entry, name: `tagioo-bridge/${entry.name}` }));
        sourceEntries.push({
          name: "tagioo-bridge/config.php",
          content: buildCpanelBridgeConfig({
            endpoint: `${panelBaseUrl}/api/orders/laravel`,
            heartbeatEndpoint: `${panelBaseUrl}/api/laravel/bridge/heartbeat`,
            tenantId: tenant.id,
            webhookSecret,
            storeUrl: setup.storeUrl,
            currency: setup.currency || "BDT"
          })
        });
        const zip = buildZip(sourceEntries);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=\"tagioo-cpanel-bridge.zip\"",
          "Content-Length": String(zip.length),
          "Cache-Control": "no-store, private",
          "X-Content-Type-Options": "nosniff"
        });
        res.end(zip);
      } catch (error) {
        jsonResponse(res, 500, { error: `cPanel Bridge package could not be prepared: ${error.message}` });
      }
      return;
    }

    if ((pathname === "/api/customer/offline-conversions" || pathname === "/api/customer/offline-conversions/validate") && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const csvText = typeof body === "string" ? body : String(body.csv || "");
      const validateOnly = pathname.endsWith("/validate");
      const result = await handleOfflineConversionUpload(session, csvText, { validateOnly });
      const { ok, status, ...rest } = result;
      jsonResponse(res, status || (ok ? 200 : 400), rest);
      return;
    }

    if (pathname === "/api/customer/verify-tracking" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const tenant = await tenantForSession(session);
      if (!tenant) {
        jsonResponse(res, 404, { error: "Tenant not found." });
        return;
      }
      const result = await verifyTenantTracking(tenant);
      await recordTenantVerify(tenant.id, result);
      jsonResponse(res, 200, result);
      return;
    }

    if (pathname === "/api/customer/cookie-extension" && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      await saveTenantTrackingConfig(session.tenantId, {
        cookieExtensionEnabled: Boolean(body.enabled),
        cookieExtensionDays: body.days
      });
      const tenant = await tenantForSession(session);
      jsonResponse(res, 200, { tracking: publicTenantTracking(tenant) });
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
      if (result.ok) {
        invalidateOwnerDashboardCache();
        // An upgrade picked from the billing UI reaches the same payment step as a
        // paid signup, so it's the same InitiateCheckout. Scheduled downgrades carry
        // no invoice and aren't a checkout — result.payment gates that.
        if (result.payment) {
          trackTagiooCheckoutStep("initiate_checkout", {
            tenantId: session.tenantId,
            plan: result.payment.plan,
            amount: result.payment.amount,
            orderId: result.payment.invoiceNo,
            visitor: tagiooVisitorContext(req)
          }).catch(() => {});
        }
      }
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok
        ? { tenant: result.tenant, payment: result.payment || null, scheduled: Boolean(result.scheduled), scheduledCancelled: Boolean(result.scheduledCancelled), scheduledPlan: result.scheduledPlan || "", effectiveDate: result.effectiveDate || "" }
        : { errors: result.errors });
      return;
    }

    // Plan change for a Paddle (USD) tenant — calls Paddle's Subscription API;
    // does NOT update the tenant's plan/limits itself. The subscription.updated
    // webhook is what actually applies the change once Paddle confirms it, so
    // the response here just reports whether the request was accepted.
    if (pathname === "/api/customer/subscription/paddle" && req.method === "POST") {
      if (!checkRateLimit(req, "paddle-plan-change", 10, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const loaded = await readDatabase();
      const tenant = loaded.available ? (loaded.data.tenants || []).find((t) => t.id === session.tenantId) : null;
      if (!tenant) { jsonResponse(res, 404, { error: "Customer account was not found." }); return; }
      if (tenant.paymentProvider !== "paddle") { jsonResponse(res, 400, { error: "This account is not on a card subscription." }); return; }

      const body = await readJson(req);
      const planName = String(body.planName || "").trim();
      const result = planName === "Free"
        ? await cancelPaddleSubscription(tenant)
        : await updatePaddleSubscriptionPlan(tenant, planName);
      jsonResponse(res, result.ok ? 202 : (result.status || 400), result.ok ? { accepted: true } : { errors: result.errors });
      return;
    }

    // Cheap session probe so the UI can resolve owner/customer role + apply nav
    // access without waiting on (or depending on) the heavy /api/dashboard build.
    if (pathname === "/api/session" && req.method === "GET") {
      const session = getSession(req);
      if (!session) { jsonResponse(res, 401, { error: "Authentication required." }); return; }
      jsonResponse(res, 200, { session: { role: session.role, username: session.username, tenantId: session.tenantId } });
      return;
    }

    if (pathname === "/api/customer/billing" && req.method === "GET") {
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const result = await getCustomerBilling(session);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { billing: result.billing } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/payment-claim" && req.method === "POST") {
      if (!checkRateLimit(req, "payment-claim", 10, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await submitPaymentClaim(body, session);
      if (result.ok) {
        invalidateOwnerDashboardCache();
        // Owner confirmation happens later without the buyer's request, so
        // refresh their match snapshot now — this is the closest real visit to
        // the eventual Purchase event.
        const claimVisitor = tagiooVisitorContext(req);
        saveTagiooVisitorContext(session.tenantId, claimVisitor).catch(() => {});
        // Transaction ID submitted = the buyer's real moment of purchase intent.
        // Everything after this is owner bookkeeping, so this is the last funnel
        // signal Meta gets with the buyer actually present.
        trackTagiooCheckoutStep("add_payment_info", {
          tenantId: session.tenantId,
          plan: result.payment?.plan,
          amount: result.payment?.amount,
          orderId: result.payment?.invoiceNo || result.payment?.id,
          when: result.payment?.claimedAt,
          visitor: claimVisitor
        }).catch(() => {});
      }
      jsonResponse(res, result.ok ? 201 : result.status || 400, result.ok ? { payment: result.payment } : { errors: result.errors });
      return;
    }

    if (pathname === "/api/customer/extra-container-claim" && req.method === "POST") {
      if (!checkRateLimit(req, "payment-claim", 10, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const session = getSession(req);
      if (!session || session.role !== "customer") {
        jsonResponse(res, 401, { error: "Customer session required." });
        return;
      }
      const body = await readJson(req);
      const result = await submitExtraContainerClaim(body, session);
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 201 : result.status || 400, result.ok ? { payment: result.payment } : { errors: result.errors });
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
      const tenant = (loaded.data.tenants || []).find((t) => t.id === account.tenantId) || null;
      jsonResponse(res, 200, { account: publicCustomerAccount(account), tracking: publicTenantTracking(tenant) });
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

    // Owner: manual-payment settings (bKash/Nagad numbers, notify email).
    if (pathname === "/api/admin/settings/payment" && (req.method === "GET" || req.method === "PUT")) {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = req.method === "GET"
        ? await getPaymentSettings()
        : await updatePaymentSettings(await readJson(req));
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { settings: result.settings } : { errors: result.errors });
      return;
    }

    // Owner: list manual-payment claims (?status=pending|confirmed|rejected).
    if (pathname === "/api/admin/payments" && req.method === "GET") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = await listPayments(String(reqUrl.searchParams.get("status") || "").trim() || null);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { payments: result.payments } : { errors: result.errors });
      return;
    }

    // Owner: confirm / reject a payment claim.
    const paymentActionMatch = pathname.match(/^\/api\/admin\/payments\/([^/]+)\/(confirm|reject)$/);
    if (paymentActionMatch && req.method === "POST") {
      const session = getSession(req);
      if (!session || session.role !== "owner") {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const paymentId = decodeURIComponent(paymentActionMatch[1]);
      const result = paymentActionMatch[2] === "confirm"
        ? await confirmPayment(paymentId, session)
        : await rejectPayment(paymentId, (await readJson(req)).reason, session);
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? result : { errors: result.errors });
      return;
    }

    // Owner: local database backups (create/list/restore/import/delete).
    if (pathname === "/api/admin/backups" && req.method === "GET") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      const backups = await listBackups();
      jsonResponse(res, 200, { backups });
      return;
    }

    if (pathname === "/api/admin/backups" && req.method === "POST") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      try {
        const id = await createBackup("manual");
        jsonResponse(res, 201, { id, backups: await listBackups() });
      } catch (error) {
        jsonResponse(res, 500, { errors: [error.message || "Backup failed."] });
      }
      return;
    }

    if (pathname === "/api/admin/backups/import" && req.method === "POST") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      let body;
      try {
        body = await readJson(req, 25 * 1024 * 1024);
      } catch (error) {
        jsonResponse(res, 400, { errors: [error.message || "Invalid JSON body."] });
        return;
      }
      const result = await importBackup(body?.data ?? body);
      jsonResponse(res, result.ok ? 201 : result.status || 400, result.ok ? { id: result.id, backups: await listBackups() } : { errors: result.errors });
      return;
    }

    const backupActionMatch = pathname.match(/^\/api\/admin\/backups\/([^/]+)\/restore$/);
    if (backupActionMatch && req.method === "POST") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      const id = decodeURIComponent(backupActionMatch[1]);
      const result = await restoreBackup(id);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { id: result.id } : { errors: result.errors });
      return;
    }

    const backupDeleteMatch = pathname.match(/^\/api\/admin\/backups\/([^/]+)$/);
    if (backupDeleteMatch && req.method === "DELETE") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      const id = decodeURIComponent(backupDeleteMatch[1]);
      const result = await deleteBackup(id);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { backups: await listBackups() } : { errors: result.errors });
      return;
    }

    // Owner: error log (server exceptions + reported client-side JS errors).
    if (pathname === "/api/admin/error-logs" && req.method === "GET") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      if (!eventStore) { jsonResponse(res, 200, { errors: [], total: 0 }); return; }
      jsonResponse(res, 200, { errors: eventStore.listErrorLogs(200), total: eventStore.countErrorLogs() });
      return;
    }

    if (pathname === "/api/admin/error-logs" && req.method === "DELETE") {
      if (!isOwner(req)) { jsonResponse(res, 403, { error: "Owner access required." }); return; }
      if (eventStore) eventStore.clearErrorLogs();
      jsonResponse(res, 200, { ok: true });
      return;
    }

    // Public: browser reports a client-side JS error. Rate-limited (no auth — errors
    // can happen on the login/landing pages too), payload size capped in insertErrorLog.
    if (pathname === "/api/client-error" && req.method === "POST") {
      if (!checkRateLimit(req, "client-error", 20, 60 * 1000)) { tooManyRequests(res); return; }
      let body;
      try {
        body = await readJson(req, 20000);
      } catch {
        jsonResponse(res, 400, { errors: ["Invalid JSON body."] });
        return;
      }
      recordErrorLog("client", { message: body.message, stack: body.stack }, { url: body.url }).catch(() => {});
      jsonResponse(res, 202, { ok: true });
      return;
    }

    // Owner container controls: restart / stop / start / resize an sgtm-* container.
    const containerActionMatch = pathname.match(/^\/api\/admin\/containers\/([^/]+)\/(restart|stop|start|resize)$/);
    if (containerActionMatch && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const containerName = decodeURIComponent(containerActionMatch[1]);
      const action = containerActionMatch[2];
      const result = action === "resize"
        ? await resizeContainer(containerName, await readJson(req))
        : await controlContainerLifecycle(containerName, action);
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? result : { error: result.error });
      return;
    }

    // Owner changes a customer's plan → updates billing limits + auto-resizes container.
    const planChangeMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)\/plan$/);
    if (planChangeMatch && req.method === "POST") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const body = await readJson(req);
      const result = await changeTenantPlan(decodeURIComponent(planChangeMatch[1]), String(body.plan || "").trim());
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? result : { error: result.error });
      return;
    }

    // Owner deletes a customer entirely (containers torn down + records purged).
    const customerAdminDeleteMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)$/);
    if (customerAdminDeleteMatch && req.method === "DELETE") {
      if (!isOwner(req)) {
        jsonResponse(res, 403, { error: "Owner access required." });
        return;
      }
      const result = await deleteCustomerCompletely(decodeURIComponent(customerAdminDeleteMatch[1]), getSession(req));
      if (result.ok) invalidateOwnerDashboardCache();
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? result : { errors: result.errors });
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
    recordErrorLog("server", error, { url: req.url, method: req.method }).catch(() => {});
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
  // Store each line under its Asia/Dhaka calendar day (using the line's own
  // offset) so event_lines keys match the Dhaka date keys queried by the
  // dashboard. Falls back to the raw date if the offset can't be parsed.
  const dhaka = nginxLineDhakaKey(line);
  if (dhaka) return dhaka;
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
      // Cache today's FULL summary (untruncated, unlike the ~500-line live tail) so
      // the dashboard's today KPIs / top events / distribution / graph read accurate
      // counts that match the Event Logs, not the truncated tail summary.
      if (dateKey !== todayKey) eventStore.setDailySummary(tenantId, dateKey, snapshot);
      else todaySnapshotCache.set(tenantId, { dateKey, lineCount: lines.length, snapshot, summary });
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

// Auto-create a daily database backup. Checks every 6h whether the newest
// backup is over 20h old rather than relying on a fixed clock time, so it
// still fires correctly after a restart or missed tick.
async function autoBackupTick() {
  try {
    const backups = await listBackups();
    const newest = backups[0];
    const ageMs = newest ? Date.now() - new Date(newest.createdAt).getTime() : Infinity;
    if (ageMs > 20 * 60 * 60 * 1000) await createBackup("auto");
  } catch (error) {
    console.error(`[backups] auto backup failed: ${error.message}`);
  }
}
setInterval(autoBackupTick, 6 * 60 * 60 * 1000).unref();
setTimeout(autoBackupTick, 60 * 1000).unref();

// Catch crashes that happen outside a request (background timers, unawaited
// promises) so they land in the same error log/email path instead of only
// showing up as a silent pm2 restart in the watchdog.
process.on("uncaughtException", (error) => {
  recordErrorLog("server", error, { context: "uncaughtException" }).catch(() => {});
});
process.on("unhandledRejection", (reason) => {
  recordErrorLog("server", reason instanceof Error ? reason : new Error(String(reason)), { context: "unhandledRejection" }).catch(() => {});
});

// Persist daily/tenant history + run usage/renewal enforcement on a timer,
// off the dashboard read path. Was previously done inside every owner dashboard
// build (big DB write + per-tenant log scans + enforcement each load).
const PERSISTENCE_INTERVAL_MS = Number(process.env.PERSISTENCE_INTERVAL_MS || 60000);
const persistenceTimer = setInterval(() => { runPersistenceCycle(); }, PERSISTENCE_INTERVAL_MS);
persistenceTimer.unref?.();

server.listen(config.port, config.host, () => {
  console.log(`SGTM control panel running at http://${config.host}:${config.port}`);
  // Populate stored history once at boot (today's snapshot) so a fresh restart
  // isn't missing today's counts until the first timer tick.
  runPersistenceCycle()
    // Pre-warm the owner dashboard cache after history is current, so the first
    // login after a restart hits a ready payload instead of a cold build.
    .then(() => { ownerDashboardLastAccess = Date.now(); return refreshOwnerDashboardCache(); })
    .catch(() => {});
});
