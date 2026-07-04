import { createServer } from "node:http";
import { mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { deflateRawSync, gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

// Minimal ZIP builder (no extra deps). Creates a valid ZIP with one entry.
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function buildSingleFileZip(filename, content) {
  const nameBuf = Buffer.from(filename);
  const data    = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const crc     = crc32(data);
  const deflated = deflateRawSync(data, { level: 9 });
  const now = new Date();
  const dosDate = (((now.getFullYear() - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0xF) << 5) | (now.getDate() & 0x1F);
  const dosTime = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | (Math.floor(now.getSeconds() / 2) & 0x1F);
  // Local file header (30 bytes + name)
  const lh = Buffer.alloc(30 + nameBuf.length);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(8, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(deflated.length, 18); lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28); nameBuf.copy(lh, 30);
  // Central directory (46 bytes + name)
  const cdOffset = lh.length + deflated.length;
  const cd = Buffer.alloc(46 + nameBuf.length);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(8, 10); cd.writeUInt16LE(dosTime, 12); cd.writeUInt16LE(dosDate, 14);
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(deflated.length, 20); cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(0, 42);
  nameBuf.copy(cd, 46);
  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(cdOffset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([lh, deflated, cd, eocd]);
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

// Generic transactional email sender (Resend). Wraps `bodyHtml` in the standard
// Tagioo email shell so every message looks consistent. Returns {ok}.
async function sendEmail({ to, subject, bodyHtml }) {
  if (!config.resendApiKey) {
    console.error(`[email] RESEND_API_KEY not set — cannot send "${subject}" to ${to}`);
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
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Tagioo <${fromAddr}>`, to: [to], subject, html })
    });
    if (!r.ok) console.error(`[email] Resend API error for "${subject}":`, r.status);
    return { ok: r.ok };
  } catch (e) {
    console.error(`[email] send error for "${subject}":`, e.message);
    return { ok: false };
  }
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
      `</table>`
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
// One escalating block per threshold. Tone ramps from informational (10K) to
// urgent (14K). `purchases`/`revenue` show the customer what's at stake.
const FREE_NUDGE_TIERS = {
  10000: { color: "#5B21B6", emoji: "📈", heading: "You're halfway through your free events",
    tone: "You've used 10,000 of your 15,000 free monthly events. Plenty of room left — but if you run ads, it's worth knowing the cap is coming." },
  12000: { color: "#B45309", emoji: "⚠️", heading: "80% of your free events used",
    tone: "You've used 12,000 of 15,000 free events this cycle. At 15,000 your tracking pauses until your cycle resets — Meta and GA4 stop receiving conversions." },
  13000: { color: "#EA580C", emoji: "🔶", heading: "Only ~2,000 free events left",
    tone: "You've used 13,000 of 15,000 free events. You're close to the cap. Upgrade now so your tracking never stops mid-campaign." },
  14000: { color: "#DC2626", emoji: "🚨", heading: "URGENT — your tracking is about to stop",
    tone: "You've used 14,000 of 15,000 free events. At 15,000, tracking pauses and new sales stop reaching Meta and Google Ads — your campaigns lose their optimization signal. Upgrade now to keep selling." }
};

function purchaseStatHtml({ purchases, revenue, currency }) {
  if (!purchases) return "";
  const rev = revenue ? ` worth ${currency ? escapeHtml(currency) + " " : "৳"}${Math.round(revenue).toLocaleString()}` : "";
  return `<p style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;color:#0F0A1E;margin:0 0 20px;line-height:1.6">Tagioo has already tracked <strong>${purchases.toLocaleString()} purchase${purchases === 1 ? "" : "s"}${rev}</strong> for you this cycle. If your tracking pauses, sales like these stop reaching your ad platforms.</p>`;
}

async function emailFreeTierNudge(toEmail, tenant, threshold, used, limit, purchaseData) {
  const tier = FREE_NUDGE_TIERS[threshold] || FREE_NUDGE_TIERS[10000];
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

// Browser-side Meta Pixel event tag. Reads ecommerce + event_id from dataLayer
// at runtime. event_id falls back to ecommerce.transaction_id so it matches the
// server CAPI hit (which uses the same fallback) and dedupes. eventID is omitted
// entirely when no id exists, to avoid sending the literal string "undefined".
function metaPixelEventScript(metaEventName) {
  const orderId = metaEventName === "Purchase" ? "if(ec.transaction_id)p.order_id=ec.transaction_id;" : "";
  return "<script>(function(){var dl=window.dataLayer||[];var ec=null,eid='';for(var i=dl.length-1;i>=0;i--){var e=dl[i];if(!e)continue;if(!eid&&e.event_id)eid=e.event_id;if(!ec&&e.ecommerce)ec=e.ecommerce;}ec=ec||{};if(!eid&&ec.transaction_id)eid=ec.transaction_id;var items=ec.items||[];var ids=items.map(function(it){return String(it.item_id||it.id||'');});var contents=items.map(function(it){return {id:String(it.item_id||it.id||''),quantity:it.quantity||1,item_price:it.price};});var p={content_type:'product',content_ids:ids,contents:contents};if(ec.currency)p.currency=ec.currency;if(ec.value!=null&&ec.value!=='')p.value=ec.value;" + orderId + "if(window.fbq)fbq('track','" + metaEventName + "',p,eid?{eventID:String(eid)}:{});})();</script>";
}

// Browser-side TikTok Pixel event tag. Same runtime-read + event_id fallback.
function tiktokPixelEventScript(tiktokEventName) {
  return "<script>(function(){var dl=window.dataLayer||[];var ec=null,eid='';for(var i=dl.length-1;i>=0;i--){var e=dl[i];if(!e)continue;if(!eid&&e.event_id)eid=e.event_id;if(!ec&&e.ecommerce)ec=e.ecommerce;}ec=ec||{};if(!eid&&ec.transaction_id)eid=ec.transaction_id;var items=ec.items||[];var contents=items.map(function(it){return {content_id:String(it.item_id||it.id||''),content_name:it.item_name,quantity:it.quantity||1,price:it.price};});var p={contents:contents,content_type:'product'};if(ec.currency)p.currency=ec.currency;if(ec.value!=null&&ec.value!=='')p.value=ec.value;if(window.ttq)ttq.track('" + tiktokEventName + "',p,eid?{event_id:String(eid)}:{});})();</script>";
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
        { parameter: "event_id", parameterValue: "{{dlv - event_id}}" },
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
      const isFiringOnce = true;
      const tagObj = gtmTag(tags.length + 1, `Tagioo GA4 - ${eventName}`, "gaawe", [
        gtmBooleanParam("sendEcommerceData", false),
        gtmBooleanParam("enhancedUserId", false),
        gtmTemplateParam("eventName", eventName),
        gtmTemplateParam("measurementIdOverride", "{{Tagioo - ga4_measurement_id}}"),
        gtmTemplateParam("eventSettingsVariable", "{{Tagioo - ga4 event settings}}"),
        gtmListParam("eventSettingsTable", eventSettingsRows)
      ], [triggerId], "3");
      if (isFiringOnce) tagObj.tagFiringOption = "ONCE_PER_LOAD";
      tags.push(tagObj);
    }
  }
  if (destinations.includes("meta")) {
    tags.push(gtmTag(tags.length + 1, "Tagioo Meta - Pixel Base", "html", [
      gtmTemplateParam("html", "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{{Tagioo - meta_pixel_id}}');(function(){var dl=window.dataLayer||[],eid='';for(var i=dl.length-1;i>=0;i--){if(dl[i]&&dl[i].event_id){eid=dl[i].event_id;break;}}fbq('track','PageView',{},eid?{eventID:String(eid)}:{});})();</script>")
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
      metaTag.tagFiringOption = "ONCE_PER_LOAD";
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
      tiktokTag.tagFiringOption = "ONCE_PER_LOAD";
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
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MCR3FD4W');</script>
    <!-- End Google Tag Manager -->
  </head>
  <body class="login-body">
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MCR3FD4W"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
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
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Create account — Tagioo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/login.css" />
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MCR3FD4W');</script>
    <!-- End Google Tag Manager -->
  </head>
  <body class="login-body">
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MCR3FD4W"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
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

  const profile = resourceProfileForPlan(planName);
  data.tenants[index] = {
    ...data.tenants[index],
    plan: planName,
    requestLimit: profile.monthlyRequestLimit,
    containerLimit: profile.containerLimit,
    monthlyAmount: monthlyAmountForPlan(planName),
    resourceLimits: { ...(data.tenants[index].resourceLimits || {}), memoryMb: profile.memoryMb, cpuLimit: profile.cpuLimit },
    planUpdatedAt: new Date().toISOString()
  };
  await writeDatabase(data);

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

async function writeDatabase(data) {
  await mkdir(config.dataDir, { recursive: true });
  const tempPath = `${databasePath}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, databasePath);
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
  // Dedicated multi-day Purchase feed for the Purchase Inspector. The generic
  // recentEvents cap is dominated by a busy day's traffic, which starves the
  // Week/Month views; pull Purchase rows across all retained days separately.
  const purchaseEvents = rows
    .flatMap((snapshot) => (snapshot.recentEvents || []).filter((event) => event.eventName === "Purchase"))
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
    pageLocation: String(firstValue(body, ["page_location", "order_url", "url"]) || "").trim(),
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
  const loaded = await readDatabase();
  if (!loaded.available) return { ok: false, errors: [loaded.detail || loaded.message || "Database unavailable."] };

  const order = normalizeOrderPayload(body);
  if (!order.id) return { ok: false, errors: ["Order id is required."] };

  const data = loaded.data;
  data.orders = data.orders || [];
  const index = data.orders.findIndex((item) => item.id === order.id);
  if (index === -1) data.orders.push(order);
  else data.orders[index] = { ...data.orders[index], ...order, updatedAt: new Date().toISOString() };

  // Server-side purchase recovery: a real order arrived, so forward it to the
  // tenant's own sGTM as a GA4 Measurement Protocol purchase. GA4 dedupes by
  // transaction_id and Meta CAPI dedupes by event_id (both = order id), so this
  // recovers purchases the browser missed (ad blockers, iOS, payment redirects)
  // without double-counting the ones it caught. Fire-and-forget; never blocks
  // or fails the webhook response.
  const tenant = (data.tenants || []).find((item) => item.id === order.tenantId);
  const tracking = tenant?.tracking || null;
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
    const stored = data.orders.find((item) => item.id === order.id);
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
  const endpoint = `${tracking.domain}/g/collect?${params.toString()}`;
  // Match quality: this fetch originates from the panel server, so without this
  // header Meta CAPI would record the panel's IP as the buyer's. Forward the real
  // customer IP via X-Forwarded-For — the Meta CAPI template reads it for
  // client_ip_address. Best-effort: if the tenant's nginx overwrites it, no harm.
  const headers = { "content-type": "text/plain;charset=UTF-8" };
  if (order.customerIp) headers["X-Forwarded-For"] = order.customerIp;
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
  domain: process.env.TAGIOO_SGTM_DOMAIN || "https://server.tagioo.com"
};

async function forwardTagiooOwnEvent(eventName, { seed, eventParams = {}, pageLocation } = {}) {
  const params = new URLSearchParams({
    v: "2",
    tid: TAGIOO_OWN_TRACKING.measurementId,
    cid: mpClientId(seed),
    en: eventName,
    _et: "1",
    ...eventParams
  });
  if (pageLocation) params.set("dl", pageLocation);
  const endpoint = `${TAGIOO_OWN_TRACKING.domain}/g/collect?${params.toString()}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" }
    });
    if (!response.ok) {
      console.warn(`[tagioo-self-track] ${eventName} forward returned ${response.status}`);
    }
  } catch (error) {
    console.warn(`[tagioo-self-track] ${eventName} forward failed: ${error.message}`);
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
  // Meta needs at least one user-data key to match the event to a person.
  if (!Object.keys(userData).length) return;

  const customData = { currency: order.currency || "BDT", order_id: String(order.id) };
  const value = Number(order.amount);
  if (Number.isFinite(value)) customData.value = value;

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
    offlineUploads: Array.isArray(tracking.offlineUploads) ? tracking.offlineUploads.slice(0, 20) : [],
    lastVerify: tracking.lastVerify || null,
    updatedAt: tracking.updatedAt || ""
  };
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
  quarterly:  { months: 3,  discount: 0.05, label: "3-Month" },
  semiannual: { months: 6,  discount: 0.10, label: "6-Month" },
  yearly:     { months: 12, discount: 0.15, label: "Yearly" }
};

function computeCycleAmount(planName, cycleId) {
  const monthly = monthlyAmountForPlan(planName);
  const cycle = billingCycleConfig[cycleId] || billingCycleConfig.monthly;
  return Math.round(monthly * cycle.months * (1 - cycle.discount));
}

async function selectCustomerPlan(input, session) {
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

  // Free plan: apply right away, no payment needed.
  if (planName === "Free") {
    const profile = resourceProfileForPlan("Free");
    data.tenants[tenantIndex] = {
      ...current,
      plan: "Free",
      requestLimit: profile.monthlyRequestLimit,
      containerLimit: profile.containerLimit,
      monthlyAmount: 0,
      subscriptionStatus: "free",
      paymentStatus: "free",
      pendingPlan: "",
      pendingAmount: 0,
      pendingInvoiceNo: "",
      updatedAt: now.toISOString()
    };
    await writeDatabase(data);
    return { ok: true, tenant: data.tenants[tenantIndex] };
  }

  // Paid plan: stage an upgrade awaiting manual payment. Keep effective limits where
  // they are (typically Free) until the owner confirms payment.
  const amount = computeCycleAmount(planName, cycleId);
  const cycle = billingCycleConfig[cycleId] || billingCycleConfig.monthly;
  const invoiceNo = current.pendingInvoiceNo || nextInvoiceNo(data, current.id);
  data.tenants[tenantIndex] = {
    ...current,
    subscriptionStatus: "pending_payment",
    paymentStatus: "pending",
    pendingPlan: planName,
    pendingAmount: amount,
    pendingBillingCycle: cycleId,
    pendingInvoiceNo: invoiceNo,
    updatedAt: now.toISOString()
  };

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
    containerLimit: profile.containerLimit,
    monthlyAmount: monthlyAmountForPlan(payment.plan),
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
  forwardTagiooOwnEvent("purchase", {
    seed: payment.id,
    eventParams: {
      cu: "BDT",
      "ep.transaction_id": String(payment.id),
      "epn.value": String(payment.amount),
      "ep.plan": payment.plan,
      "ep.tenant_id": payment.tenantId
    }
  }).catch(() => {});

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
      plan: tenant.plan || "Free",
      subscriptionStatus: tenant.subscriptionStatus || "free",
      paymentStatus: tenant.paymentStatus || "free",
      monthlyAmount: Number(tenant.monthlyAmount || 0),
      renewalDate: tenant.renewalDate || "",
      requestLimit: Number(tenant.requestLimit || 0),
      pendingPlan: tenant.pendingPlan || "",
      pendingAmount: Number(tenant.pendingAmount || 0),
      pendingInvoiceNo: tenant.pendingInvoiceNo || "",
      payment: tenant.pendingPlan ? paymentInstructionsFor(tenant, data) : null,
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
  Starter: 1200,
  Growth: 2500,
  Pro: 2900,
  Enterprise: 5900,
  Agency: 7500
};

const planResourceProfiles = {
  Free:       { memoryMb: 512,  cpuLimit: "0.50", monthlyRequestLimit: 15000,    containerLimit: 1  },
  Starter:    { memoryMb: 768,  cpuLimit: "0.50", monthlyRequestLimit: 500000,   containerLimit: 1  },
  Growth:     { memoryMb: 1024, cpuLimit: "0.75", monthlyRequestLimit: 1500000,  containerLimit: 2  },
  Pro:        { memoryMb: 1024, cpuLimit: "0.75", monthlyRequestLimit: 2000000,  containerLimit: 3  },
  Agency:     { memoryMb: 1536, cpuLimit: "1.50", monthlyRequestLimit: 8000000,  containerLimit: 10 },
  Enterprise: { memoryMb: 2048, cpuLimit: "2.00", monthlyRequestLimit: 5000000,  containerLimit: 10 },
  Customer:   { memoryMb: 768,  cpuLimit: "0.50", monthlyRequestLimit: 500000,   containerLimit: 1  }
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

// ── Phase 2: Free-tier rolling-cycle usage enforcement ─────────────────────
const FREE_NUDGE_THRESHOLDS = [10000, 12000, 13000, 14000];
const FREE_HARD_CAP = 15000;
const FREE_CYCLE_DAYS = 30;

// Sum of all of a tenant's stored daily request counts. Used with a per-cycle
// baseline (snapshotted at cycle start) so cycle usage = currentSum - baseline.
// This resets cleanly on rollover even when the old and new cycle share a day.
function tenantUsageSum(data, tenantId) {
  const days = data.tenantDailyRequests?.[tenantId] || {};
  let total = 0;
  for (const count of Object.values(days)) total += Number(count || 0);
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
// window when it expires (resuming a capped container), send escalating upgrade
// nudges at 10K/12K/13K/14K (once each per cycle), and hard-cap (stop the
// container) at 15K. Mutates `data`; the caller persists it. Side-effects
// (emails, docker start/stop) are best-effort and never throw.
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
      tenant.cycleNudge = 0;
      tenant.cycleBaseline = tenantUsageSum(data, tenant.id);
    }

    // Cycle rollover: reset usage baseline + nudge state, resume if capped.
    if (now >= new Date(tenant.cycleEnd)) {
      tenant.cycleStart = now.toISOString();
      tenant.cycleEnd = new Date(now.getTime() + cycleMs).toISOString();
      tenant.cycleNudge = 0;
      tenant.cycleBaseline = tenantUsageSum(data, tenant.id);
      if (status === "free_capped") {
        tenant.subscriptionStatus = "free";
        tenant.cappedAt = "";
        const name = tenantContainerName(data, tenant.id);
        if (name) await controlContainerLifecycle(name, "start").catch(() => {});
      }
      continue;
    }

    const startKey = localDateKey(new Date(tenant.cycleStart));
    const used = Math.max(0, tenantUsageSum(data, tenant.id) - Number(tenant.cycleBaseline || 0));
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

    // Escalating nudges: send the highest crossed threshold not yet sent this cycle.
    let toSend = 0;
    for (const threshold of FREE_NUDGE_THRESHOLDS) {
      if (used >= threshold && threshold > Number(tenant.cycleNudge || 0)) toSend = threshold;
    }
    if (toSend) {
      tenant.cycleNudge = toSend;
      emailFreeTierNudge(toEmail, tenant, toSend, used, FREE_HARD_CAP, cyclePurchaseStats(data, tenant.id, startKey, todayKey)).catch(() => {});
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
  attachContainerOwnership(docker, owner.customers || []);
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
        tenants: [{ ...tenant, tracking: publicTenantTracking(tenant) }]
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
      const cookies = parseCookies(req.headers.cookie);
      // Reached the signup form = real purchase intent for a self-serve trial
      // (SaaS equivalent of InitiateCheckout) — worth a Meta "Lead" so unfinished
      // signups can be retargeted. tg_vid is a stable per-visitor seed reused by
      // the sign_up forward on actual completion, so GA4/Meta tie Lead ->
      // CompleteRegistration to the same visitor. tg_lead_sent just dedupes
      // reloads/repeat visits within a day so Lead volume stays a real-intent signal.
      const setCookies = [];
      let visitorId = cookies.tg_vid;
      if (!visitorId) {
        visitorId = randomBytes(16).toString("hex");
        setCookies.push(`tg_vid=${visitorId}; Path=/; Max-Age=7776000; SameSite=Lax`);
      }
      if (!cookies.tg_lead_sent) {
        forwardTagiooOwnEvent("generate_lead", { seed: visitorId }).catch(() => {});
        setCookies.push(`tg_lead_sent=1; Path=/; Max-Age=86400; SameSite=Lax`);
      }
      const headers = setCookies.length ? { "set-cookie": setCookies } : {};
      htmlResponse(res, 200, signupPage("", { email: prefillEmail }), headers);
      return;
    }

    if (pathname === "/signup" && req.method === "POST") {
      if (!checkRateLimit(req, "signup", 5, 60 * 60 * 1000)) { tooManyRequests(res); return; }
      const form = await readForm(req);
      const values = Object.fromEntries(form.entries());
      const result = await addCustomerSignup(values);
      if (!result.ok) {
        htmlResponse(res, 400, signupPage((result.errors || ["Signup failed."]).join(" "), values));
        return;
      }

      // Self-signup is always plan "Free" (addCustomerSignup hardcodes it) — this
      // is tagioo's own acquisition-funnel conversion, forwarded to tagioo's own
      // GA4/Meta (TAGIOO_OWN_TRACKING), never the new tenant's own tracking. Seed
      // with tg_vid (set on the GET /signup Lead hit) when present so GA4/Meta
      // tie this CompleteRegistration to the same visitor as the earlier Lead.
      forwardTagiooOwnEvent("sign_up", {
        seed: parseCookies(req.headers.cookie).tg_vid || result.account.tenantId,
        eventParams: {
          "ep.plan": "Free",
          "ep.tenant_id": result.account.tenantId
        }
      }).catch(() => {});

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
      if (!checkRateLimit(req, "login", 10, 60 * 1000)) { tooManyRequests(res); return; }
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

    if (pathname !== "/login" && pathname !== "/signup" && pathname !== "/tokens.css" && pathname !== "/login.css" && pathname !== "/favicon.svg" && pathname !== "/favicon.ico" && !isAuthenticated(req)) {
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
        const payload = await getCustomerDashboardDataCached(session);
        if (payload.timing?.dashboardMs > 2000) {
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
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? { tenant: result.tenant, payment: result.payment || null } : { errors: result.errors });
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
      jsonResponse(res, result.ok ? 200 : result.status || 400, result.ok ? result : { error: result.error });
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

server.listen(config.port, config.host, () => {
  console.log(`SGTM control panel running at http://${config.host}:${config.port}`);
});
