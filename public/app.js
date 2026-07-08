const els = {
  generatedAt: document.querySelector("#generatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  breadcrumb: document.querySelector("#breadcrumb"),
  pageTitle: document.querySelector("#pageTitle"),
  navItems: document.querySelectorAll("[data-view-target]"),
  views: document.querySelectorAll("[data-view]"),
  offlineConversionsBody: document.querySelector("#offlineConversionsBody"),
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
  customerSetupBadge: document.querySelector("#customerSetupBadge"),
  customerHeroTitle: document.querySelector("#customerHeroTitle"),
  customerHeroDomain: document.querySelector("#customerHeroDomain"),
  customerUsageRing: document.querySelector("#customerUsageRing"),
  customerUsagePercent: document.querySelector("#customerUsagePercent"),
  customerPlanName: document.querySelector("#customerPlanName"),
  customerMonthEvents: document.querySelector("#customerMonthEvents"),
  customerNextStepBadge: document.querySelector("#customerNextStepBadge"),
  customerNextStepList: document.querySelector("#customerNextStepList"),
  customerPerformanceGrid: document.querySelector("#customerPerformanceGrid"),
  customerEventChart: document.querySelector("#customerEventChart"),
  customerChartLegend: document.querySelector("#customerChartLegend"),
  customerEventLogChart: document.querySelector("#customerEventLogChart"),
  customerTopEvents: document.querySelector("#customerTopEvents"),
  customerEventDistribution: document.querySelector("#customerEventDistribution"),
  customerSetupForm: document.querySelector("#customerSetupForm"),
  customerSetupFormMessage: document.querySelector("#customerSetupFormMessage"),
  customerSetupList: document.querySelector("#customerSetupList"),
  customerContainersBadge: document.querySelector("#customerContainersBadge"),
  customerContainersTable: document.querySelector("#customerContainersTable"),
  customerContainerSearch: document.querySelector("#customerContainerSearch"),
  customerContainerDetail: document.querySelector("#customerContainerDetail"),
  customerDnsTarget: document.querySelector("#customerDnsTarget"),
  customerDnsTargetInline: document.querySelector("#customerDnsTargetInline"),
  powerUpsBadge: document.querySelector("#powerUpsBadge"),
  powerUpsFilters: document.querySelector("#powerUpsFilters"),
  powerUpsGrid: document.querySelector("#powerUpsGrid"),
  powerUpsMessage: document.querySelector("#powerUpsMessage"),
  setupAssistantBadge: document.querySelector("#setupAssistantBadge"),
  setupAssistantForm: document.querySelector("#setupAssistantForm"),
  setupAssistantResult: document.querySelector("#setupAssistantResult"),
  assistantBack: document.querySelector("#assistantBack"),
  assistantNext: document.querySelector("#assistantNext"),
  downloadWebTemplate: document.querySelector("#downloadWebTemplate"),
  downloadServerTemplate: document.querySelector("#downloadServerTemplate"),
  downloadPlugin: document.querySelector("#downloadPlugin"),
  verifyTrackingBtn: document.querySelector("#verifyTrackingBtn"),
  verifyTrackingResult: document.querySelector("#verifyTrackingResult"),
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
  eventLimitFilter: document.querySelector("#eventLimitFilter"),
  requestUrlFilter: document.querySelector("#requestUrlFilter"),
  eventLogStats: document.querySelector("#eventLogStats"),
  dailyEventLogBody: document.querySelector("#dailyEventLogBody"),
  lastEventFreshness: document.querySelector("#lastEventFreshness"),
  purchaseGapAlert: document.querySelector("#purchaseGapAlert"),
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
  ownerHomeMetrics: document.querySelector("#ownerHomeMetrics"),
  ownerHomeBadge: document.querySelector("#ownerHomeBadge"),
  ownerHomeCustomerTable: document.querySelector("#ownerHomeCustomerTable"),
  vpsHealthBadge: document.querySelector("#vpsHealthBadge"),
  vpsHealthGrid: document.querySelector("#vpsHealthGrid"),
  infraStatusBadge: document.querySelector("#infraStatusBadge"),
  infraStatusList: document.querySelector("#infraStatusList"),
  alertBadgeCustomer: document.querySelector("#alertBadgeCustomer"),
  alertListCustomer: document.querySelector("#alertListCustomer"),
  adminBadge: document.querySelector("#adminBadge"),
  ownerMetricGrid: document.querySelector("#ownerMetricGrid"),
  ownerWatchBadge: document.querySelector("#ownerWatchBadge"),
  ownerIssueList: document.querySelector("#ownerIssueList"),
  ownerInfraBadge: document.querySelector("#ownerInfraBadge"),
  ownerInfraList: document.querySelector("#ownerInfraList"),
  ownerCustomerBadge: document.querySelector("#ownerCustomerBadge"),
  ownerCustomerTable: document.querySelector("#ownerCustomerTable"),
  workerNodesBadge: document.querySelector("#workerNodesBadge"),
  workerNodesList: document.querySelector("#workerNodesList"),
  workerNodeForm: document.querySelector("#workerNodeForm"),
  workerNodeFormMessage: document.querySelector("#workerNodeFormMessage"),
  customersBadge: document.querySelector("#customersBadge"),
  customersList: document.querySelector("#customersList"),
  adminActions: document.querySelector("#adminActions"),
  customerAccountForm: document.querySelector("#customerAccountForm"),
  customerAccountFormMessage: document.querySelector("#customerAccountFormMessage"),
  customerAccountsBadge: document.querySelector("#customerAccountsBadge"),
  customerAccountsList: document.querySelector("#customerAccountsList"),
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
  subscriptionPlans: document.querySelector("#subscriptionPlans"),
  docsList: document.querySelector("#docsList"),
  allCustomersBadge: document.querySelector("#allCustomersBadge"),
  allCustomersMetrics: document.querySelector("#allCustomersMetrics"),
  allCustomersTable: document.querySelector("#allCustomersTable"),
  accountSettingsTabs: document.querySelector("#accountSettingsTabs"),
  customerProfileForm: document.querySelector("#customerProfileForm"),
  customerProfileName: document.querySelector("#customerProfileName"),
  customerProfileEmail: document.querySelector("#customerProfileEmail"),
  customerProfilePhone: document.querySelector("#customerProfilePhone"),
  customerProfileFormMessage: document.querySelector("#customerProfileFormMessage"),
  customerPasswordForm: document.querySelector("#customerPasswordForm"),
  customerPasswordFormMessage: document.querySelector("#customerPasswordFormMessage"),
  accountProfilePanel: document.querySelector("#accountProfilePanel"),
  accountPasswordPanel: document.querySelector("#accountPasswordPanel"),
  accountOverviewGrid: document.querySelector("#accountOverviewGrid"),
  accountIdentityName: document.querySelector("#accountIdentityName"),
  accountIdentityEmail: document.querySelector("#accountIdentityEmail"),
  accountIdentitySince: document.querySelector("#accountIdentitySince"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountPlanBadge: document.querySelector("#accountPlanBadge")
};

// Splash (pulsing Tagioo mark) stays until the first dashboard render completes —
// see loadDashboard. Safety net: never trap the user behind the splash if the
// heavy /api/dashboard call hangs.
setTimeout(() => document.body.classList.remove("app-loading"), 8000);

const viewTitles = {
  dashboard: ["Dashboard", "Server Overview"],
  logs: ["Containers / Event Logs", "Event Logs"],
  analytics: ["Tracking / Analytics", "Analytics"],
  customerContainers: ["Containers / List", "Containers"],
  powerUps: ["Containers / Power-Ups", "Power-Ups"],
  offlineConversions: ["Tracking / Offline Conversions", "Offline Conversions"],
  setupAssistant: ["Setup Assistant / GTM Templates", "Setup Assistant"],
  customerAccountSettings: ["Account / Settings", "Account Settings"],
  settings: ["Account & Others / Settings", "Settings"],
  deployment: ["Operations / Deployment", "Deployment Health"],
  provisioning: ["Operations / Provisioning", "Container Provisioning"],
  admin: ["Service / Admin", "Admin"],
  customers: ["Service / Customers", "Customers"],
  errorLogs: ["Service / Error Logs", "Error Logs"],
  integrations: ["Service / Integrations", "Integrations"],
  billing: ["Account & Billing", "My Subscription"],
  docs: ["Public / Docs", "Landing & Docs"]
};

let latestData = null;
let customerChartRange = "24h";
let customerKpiRange = "24h";
let purchaseRange = "day";
let selectedCustomerContainerId = "";
let selectedManageCustomerId = "";
const MANAGE_PLANS = ["Free", "Starter", "Pro", "Enterprise"];
let setupAssistantStep = 1;
let generatedAssistantTemplates = null;
let currentSession = { role: "pending" };
let currentViewName = "dashboard";
const ownerOnlyViews = new Set(["analytics", "settings", "deployment", "provisioning", "admin", "customers", "errorLogs", "integrations", "docs"]);
const customerOnlyViews = new Set(["customerContainers", "setupAssistant", "customerAccountSettings", "offlineConversions"]);
const customerNavViews = new Set(["dashboard", "logs", "customerContainers", "powerUps", "setupAssistant", "customerAccountSettings", "billing"]);
const ownerNavViews = new Set(["dashboard", "admin", "customers", "errorLogs", "provisioning", "logs", "billing", "settings", "deployment", "analytics", "integrations", "docs", "powerUps"]);
try {
  const cachedRole = window.localStorage.getItem("tagioo_session_role");
  if (cachedRole === "customer" || cachedRole === "owner") {
    currentSession = { role: cachedRole };
    document.body.classList.toggle("customer-session", cachedRole === "customer");
    els.navItems.forEach((item) => {
      const target = item.dataset.viewTarget;
      item.hidden = cachedRole === "customer" ? !customerNavViews.has(target) : !ownerNavViews.has(target);
    });
  }
} catch {
  // Local storage can be disabled in hardened browsers; the app still loads normally.
}

const subscriptionPlans = [
  {
    name: "Free",
    price: "Free",
    requests: 15000,
    containers: 1,
    domains: 1,
    receivers: 5,
    retention: "3 days log retention",
    features: ["Email Support", "Consent Mode V2 (GDPR)", "Bot Detection & Filtering", "Custom Loader", "Custom Domain", "First-Party Domain", "Event Logs"]
  },
  {
    name: "Starter",
    price: "৳1,200",
    requests: 500000,
    containers: 1,
    domains: 1,
    receivers: 5,
    retention: "7 days log retention",
    features: ["Live Chat", "Free Migration", "Consent Mode V2 (GDPR)", "Custom Loader", "Custom Domain", "First-Party Domain", "Cookie Life Extension", "Advanced Reports", "Event Logs"]
  },
  {
    name: "Pro",
    price: "৳2,900",
    requests: 2000000,
    containers: 3,
    domains: 2,
    receivers: 5,
    retention: "15 days log retention",
    popular: true,
    features: ["Live Chat, Call & Google Meet", "Video & Files Provided", "Consent Mode V2 (GDPR)", "Custom Loader", "Traffic Filtering", "300+ CDN Locations", "Click ID Restorer", "Delay Purchase System", "WordPress Plugin"]
  },
  {
    name: "Enterprise",
    price: "৳5,900",
    requests: 5000000,
    containers: 5,
    domains: 3,
    receivers: 5,
    retention: "30 days log retention",
    features: ["Priority Migration", "Dedicated Support", "Multi-Domain Support", "Advanced Reports", "Traffic Filtering, IP, Country Block", "Bot Detection & Filtering", "Event Logs", "WordPress Plugin"]
  }
];

const planRank = { Free: 0, Starter: 1, Growth: 2, Pro: 3, Enterprise: 4, Agency: 4 };

const billingCycles = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0 },
  { id: "quarterly", label: "3-Month", months: 3, discount: 0.10 },
  { id: "semiannual", label: "6-Month", months: 6, discount: 0.20 },
  { id: "yearly", label: "Yearly", months: 12, discount: 0.25 }
];
let selectedCycle = billingCycles[0];

const powerUps = [
  {
    id: "cookie-keeper",
    name: "Cookie Keeper",
    category: "Popular",
    icon: "●",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Safari and iOS cut analytics cookies to 7 days. Cookie Keeper renews them to 400 days via first-party HTTP headers — so ad platforms see your full conversion window and bid accurately."
  },
  {
    id: "custom-loader",
    name: "Custom Loader",
    category: "Web GTM load",
    icon: "</>",
    minimumPlan: "Starter",
    defaultState: "configure",
    recommended: true,
    description: "Loads GTM and GA scripts from your own tracking subdomain. Bypasses ad blockers and Safari restrictions that kill 15–25% of tracking — recovering lost conversion signals for Google and Meta."
  },
  {
    id: "click-id-restorer",
    name: "Click ID Restorer",
    category: "Data enrich",
    icon: "↗",
    minimumPlan: "Starter",
    defaultState: "configure",
    description: "Captures gclid, fbclid, ttclid, and msclkid into 90-day first-party cookies at nginx level. Ad platforms get their click IDs back on every conversion — fixing attribution gaps from page reloads and SPA navigation."
  },
  {
    id: "bot-detection",
    name: "Bot Detection",
    category: "Utilities",
    icon: "◇",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Flags crawlers and bots at nginx level via X-Tagioo-Bot header. Use it in sGTM to block ad conversion tags for non-human traffic — keeping your ROAS data clean and your ad budgets optimized."
  },
  {
    id: "geo-headers",
    name: "GEO Headers",
    category: "Data enrich",
    icon: "◎",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Injects visitor country (X-Tagioo-Country) and real IP (X-Tagioo-Client-IP) into every sGTM request. Use for geo-targeted GA4 dimensions, country-specific conversion events, and regional ad attribution."
  },
  {
    id: "user-agent-info",
    name: "User Agent Info",
    category: "Data enrich",
    icon: "▥",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Sends device type (mobile/tablet/desktop) and raw UA string to sGTM via X-Tagioo-Device and X-Tagioo-UA headers. Build device segments in GA4 and optimize ad bidding by device performance."
  },
  {
    id: "multi-domains",
    name: "Multi-Domains",
    category: "Utilities",
    icon: "⌘",
    minimumPlan: "Pro",
    defaultState: "upgrade",
    description: "Use one container with multiple first-party tagging domains."
  },
  {
    id: "block-ip",
    name: "Block Request by IP",
    category: "Utilities",
    icon: "■",
    minimumPlan: "Pro",
    defaultState: "upgrade",
    description: "Block known bad IPs before they reach your server-side GTM container."
  },
  {
    id: "dedicated-ip",
    name: "Dedicated IP",
    category: "CDN",
    icon: "⬢",
    minimumPlan: "Enterprise",
    defaultState: "upgrade",
    description: "Reserve a static outbound IP for enterprise security and partner allowlists."
  },
  {
    id: "bigquery-export",
    name: "BigQuery Export",
    category: "Data enrich",
    icon: "▣",
    minimumPlan: "Enterprise",
    defaultState: "upgrade",
    description: "Send selected server-side events into BigQuery for reporting and retention."
  },
  {
    id: "file-proxy",
    name: "File Proxy",
    category: "CDN",
    icon: "✦",
    minimumPlan: "Enterprise",
    defaultState: "coming",
    description: "Proxy selected static files through the server-side tracking domain."
  },
  {
    id: "tagioo-care",
    name: "Tagioo Care",
    category: "Popular",
    icon: "☺",
    minimumPlan: "Pro",
    defaultState: "configure",
    description: "Request guided setup, tracking review, and migration help from the Tagioo team."
  }
];

let activePowerUpCategory = "All";
let powerUpsServerEnabled = false;
let powerUpsStatusFetched = false;

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

function hostLabel(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname || value;
  } catch {
    return String(value).replace(/^https?:\/\//i, "").split("/")[0];
  }
}

function setView(name, options = {}) {
  const requested = viewTitles[name] ? name : "dashboard";
  const roleKnown = currentSession.role === "customer" || currentSession.role === "owner";
  const next =
    (roleKnown && currentSession.role === "customer" && ownerOnlyViews.has(requested)) ||
    (roleKnown && currentSession.role !== "customer" && customerOnlyViews.has(requested))
      ? "dashboard"
      : requested;
  currentViewName = next;
  els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === next));
  els.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.viewTarget === next));
  els.breadcrumb.textContent = currentSession.role === "customer" && next === "dashboard" ? "Dashboard" : viewTitles[next][0];
  els.pageTitle.textContent = currentSession.role === "customer" && next === "dashboard" ? "Tracking Overview" : viewTitles[next][1];
  window.location.hash = next;
  if (!options.skipRender && latestData) renderCurrentView(latestData);
  // Payment panels load independently of the (sometimes-failing) dashboard fetch.
  if (next === "admin") { loadOwnerPayments(); loadPaymentSettings(); loadBackups(); }
  if (next === "errorLogs") loadErrorLogs();
  if (next === "billing") loadBillingPayment();
  // Hash routing is invisible to PostHog's pageview autodetection — record view
  // changes as explicit events so funnels/paths work per panel section.
  try { window.posthog?.capture?.("panel_view_opened", { view: next, role: currentSession.role }); } catch { /* noop */ }
}

function applySessionAccess(data) {
  applySession(data.session);
}

// Resolve role from the cheap /api/session endpoint so owner/customer access works
// even when the heavy /api/dashboard build fails. Runs at boot before loadDashboard.
async function initSession() {
  try {
    const r = await fetch("/api/session", { cache: "no-store" });
    if (!r.ok) return;
    const { session } = await r.json();
    if (session) applySession(session);
  } catch {
    // Fall back to whatever loadDashboard resolves.
  }
}

// Tie PostHog events/replays to the logged-in account. tenantId (stable, non-PII)
// is the distinct id for customers; email lives in person properties only.
function identifyPostHog() {
  try {
    if (!window.posthog || typeof window.posthog.identify !== "function") return;
    if (currentSession.role === "customer" && (currentSession.tenantId || currentSession.username)) {
      window.posthog.identify(currentSession.tenantId || currentSession.username, {
        role: "customer",
        email: currentSession.username || ""
      });
    } else if (currentSession.role === "owner") {
      window.posthog.identify("tagioo-owner", { role: "owner" });
    }
  } catch { /* analytics must never break the panel */ }
}

// Logout must unlink the device from the account so the next login (possibly a
// different customer on a shared machine) doesn't inherit the previous identity.
document.querySelector('a[href="/logout"]')?.addEventListener("click", () => {
  try { window.posthog?.reset?.(); } catch { /* noop */ }
});

function applySession(session) {
  currentSession = session || { role: "owner" };
  const customerMode = currentSession.role === "customer";
  identifyPostHog();
  try {
    window.localStorage.setItem("tagioo_session_role", customerMode ? "customer" : "owner");
  } catch {
    // Ignore local storage failures; this only improves the next page refresh.
  }
  document.body.classList.toggle("customer-session", customerMode);
  document.querySelectorAll("[data-owner-only]").forEach((element) => {
    element.hidden = customerMode;
  });
  document.querySelectorAll("[data-customer-only]").forEach((element) => {
    element.hidden = !customerMode;
  });
  els.navItems.forEach((item) => {
    const target = item.dataset.viewTarget;
    item.hidden = customerMode ? !customerNavViews.has(target) : !ownerNavViews.has(target);
  });
  if ((customerMode && ownerOnlyViews.has(window.location.hash.replace("#", ""))) ||
    (!customerMode && customerOnlyViews.has(window.location.hash.replace("#", "")))) {
    setView("dashboard", { skipRender: true });
  } else {
    setView(window.location.hash.replace("#", "") || "dashboard", { skipRender: true });
  }
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
  const normalized = compact.endsWith("stape") ? compact.slice(0, -"stape".length) : compact;
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
  return names[normalized] || "";
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

function queryValue(path, keys) {
  try {
    const parsed = new URL(path, "https://sgtm.local");
    for (const key of keys) {
      const value = parsed.searchParams.get(key);
      if (value !== null && value !== "") return value;
    }
  } catch {
    return "";
  }
  return "";
}

function firstValue(...values) {
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
    const decoded = atob(padded);
    return JSON.parse(decoded);
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

function dataTagPayload(path) {
  return decodeBase64Json(queryValue(path, ["dtdc", "data", "payload"])) || {};
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

  if (method === "GET" && !blocked && trackingPath && raw.includes("page_view")) {
    return {
      name: "PageView",
      outcome: "Tracked",
      description: "A visitor or browser loaded a page or tracking endpoint."
    };
  }

  return {
    name: blocked ? "Rejected Request" : trackingPath ? "Tracking Request" : "Other",
    outcome: blocked ? "Not accepted" : "Processed",
    description: blocked
      ? "The server rejected this request before it became a clean tracking event."
      : trackingPath
        ? "This is an SGTM collection hit, but it did not declare a recognizable ecommerce event."
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
  const payload = dataTagPayload(path);
  const value = firstValue(
    queryValue(path, ["value", "ep.value", "epn.value", "epn.ecomm_totalvalue", "price", "revenue"]),
    payloadValue(payload, ["value", "revenue", "total", "amount", "ecomm_totalvalue"])
  );
  const currency = firstValue(
    queryValue(path, ["currency", "ep.currency", "cu"]),
    payloadValue(payload, ["currency", "currencyCode"])
  );
  const eventId = firstValue(
    queryValue(path, ["event_id", "eventId", "eid", "x-fb-event-id"]),
    payloadValue(payload, ["event_id", "eventId", "fb_event_id"])
  );
  const transactionId = firstValue(
    queryValue(path, ["transaction_id", "transactionId", "ep.transaction_id", "ep.order_id", "tr", "order_id", "orderId"]),
    payloadValue(payload, ["transaction_id", "transactionId", "order_id", "orderId", "order_number"])
  );
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
    value,
    currency,
    eventId,
    transactionId,
    primary: event.name,
    meta: `${event.outcome} - ${status} - ${time}`,
    detail: `${event.description} Path: ${path}. Visitor IP: ${ip}. ${protocol} - ${bytes} bytes${value ? ` - value ${formatMoney(value, currency)}` : ""}${transactionId ? ` - transaction ${transactionId}` : ""}${referer !== "-" ? ` - from ${referer}` : ""}${agent !== "-" ? ` - ${agent}` : ""}`
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
    item.host ? `Host: ${item.host}` : "",
    item.value ? `Value: ${formatMoney(item.value, item.currency)}` : "",
    item.eventId ? `Event ID: ${item.eventId}` : "",
    item.transactionId ? `Transaction ID: ${item.transactionId}` : "",
    item.bytes !== undefined && item.bytes !== null ? `${item.bytes} bytes` : "",
    item.referer ? `From: ${item.referer}` : "",
    item.agent || ""
  ].filter(Boolean).join(" - ");
}

function mapServerEventRow(item) {
  return {
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
  };
}

function serverEventRows(data) {
  const rows = (data.nginx?.retainedEvents?.recentEvents?.length ? data.nginx.retainedEvents : data.nginx?.todayEvents)?.recentEvents;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map(mapServerEventRow);
}

// Purchase rows for the inspector. Prefer the dedicated multi-day purchaseEvents
// feed (covers Week/Month) and fall back to the generic today/retained rows.
// Always supplement with today's live recentEvents so SQLite-lag can't cause
// the inspector to show fewer purchases than the dashboard's uniqueCount.
function inspectorPurchaseRows(data) {
  const purchaseEvents = data.nginx?.retainedEvents?.purchaseEvents;
  const todayLive = (data.nginx?.todayEvents?.recentEvents || []).filter((e) => e.eventName === "Purchase");
  if (Array.isArray(purchaseEvents) && purchaseEvents.length) {
    return [...purchaseEvents, ...todayLive].map(mapServerEventRow);
  }
  return purchaseRows(data);
}

function renderEventLogStats(allItems, visibleItems, summary) {
  if (!els.eventLogStats) return;
  const total = allItems.length;
  const visible = visibleItems.length;
  const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
  const serverUniquePurchases = Number(summary?.purchases?.uniqueCount);
  const purchases = Number.isFinite(serverUniquePurchases)
    ? serverUniquePurchases
    : new Set(
        visibleItems
          .filter((item) => item.eventName === "Purchase")
          .map((item) => item.transactionId || item.eventId)
          .filter(Boolean)
      ).size;
  const clients = new Set(visibleItems.map((item) => item.client).filter(Boolean)).size;
  renderBusinessGrid(els.eventLogStats, [
    { label: "Filtered", value: visible.toLocaleString(), detail: `${total.toLocaleString()} latest loaded` },
    { label: "Success", value: Math.max(0, visible - errors).toLocaleString(), detail: "2xx / 3xx requests" },
    { label: "Errors", value: errors.toLocaleString(), detail: "4xx / 5xx requests" },
    { label: "Purchases", value: purchases.toLocaleString(), detail: summary?.retentionDays ? `unique · last ${summary.retentionDays} days` : `${clients.toLocaleString()} client${clients === 1 ? "" : "s"} · today` }
  ]);
}

function renderEventTable(data) {
  const summary = data.nginx?.retainedEvents?.available ? data.nginx.retainedEvents : data.nginx?.todayEvents;
  const serverItems = serverEventRows(data);
  const log = data.nginx?.accessLog;

  if (summary?.available && serverItems.length) {
    updateEventFilters(serverItems);
    const visibleItems = serverItems.filter(visibleEvent);
    renderEventLogStats(serverItems, visibleItems, summary);
    const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
    const limit = Number(els.eventLimitFilter?.value || 50);
    const rangeLabel = summary?.retentionDays ? `last ${summary.retentionDays} days` : "today";
    els.eventLogSummary.textContent = `Showing ${Math.min(visibleItems.length, limit).toLocaleString()} of ${visibleItems.length.toLocaleString()} matching events from the latest ${serverItems.length.toLocaleString()} retained records (${rangeLabel}, ${errors.toLocaleString()} errors).`;
    renderEventRows(visibleItems, "No matching tracking events found for the selected filters.");
    return;
  }

  if (!log?.available) {
    renderEventLogStats([], []);
    els.eventLogSummary.textContent = log?.detail || log?.message || "Access log unavailable.";
    els.accessLog.innerHTML = `<tr><td colspan="6">${escapeHtml(`${log?.message || "Unavailable"} ${log?.detail || ""}`.trim())}</td></tr>`;
    return;
  }

  const items = parseLogLines(log, "access").filter((item) => item.tracking);
  updateEventFilters(items);
  const visibleItems = items.filter(visibleEvent);
  renderEventLogStats(items, visibleItems);
  const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
  const limit = Number(els.eventLimitFilter?.value || 50);
  els.eventLogSummary.textContent = `Showing ${Math.min(visibleItems.length, limit).toLocaleString()} of ${visibleItems.length.toLocaleString()} matching records (${errors.toLocaleString()} errors) from the recent access log sample.`;

  renderEventRows(visibleItems, "No SGTM event collection requests found in the recent sample. The full-day summary may still have older events.");
}

function renderEventRows(visibleItems, emptyMessage) {
  if (!visibleItems.length) {
    els.accessLog.innerHTML = `<tr><td colspan="6">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }

  const limit = Number(els.eventLimitFilter?.value || 50);
  const rows = visibleItems.slice(0, limit);
  const fragment = document.createDocumentFragment();
  rows.forEach((item, index) => {
    const detailId = `event-detail-${index}`;
    const eventRow = document.createElement("tr");
    eventRow.className = "event-main-row";
    eventRow.innerHTML = `
      <td>${escapeHtml(item.displayDate)}</td>
      <td><span class="status-code ${Number(item.status) >= 400 ? "bad" : "good"}">${escapeHtml(item.status)}</span></td>
      <td><div class="event-type-cell"><strong>${escapeHtml(item.eventName || "Other")}</strong>${item.value ? `<small>${escapeHtml(formatMoney(item.value, item.currency))}</small>` : ""}</div></td>
      <td>${escapeHtml(item.client || "Other")}</td>
      <td><span class="request-url">${escapeHtml(item.requestUrl)}</span></td>
      <td><button class="more-button" type="button" aria-expanded="false" aria-controls="${detailId}" aria-label="Toggle request details">Details</button></td>
    `;
    const detailRow = document.createElement("tr");
    detailRow.id = detailId;
    detailRow.className = "event-detail-row";
    detailRow.hidden = true;
    detailRow.innerHTML = `<td colspan="6"><div class="event-detail-box">${escapeHtml(item.detail || item.requestUrl || "No details available.")}</div></td>`;
    eventRow.querySelector(".more-button").addEventListener("click", (event) => {
      const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
      event.currentTarget.setAttribute("aria-expanded", String(!expanded));
      detailRow.hidden = expanded;
    });
    fragment.append(eventRow, detailRow);
  });

  els.accessLog.replaceChildren(
    fragment
  );
}

function customerFallbackHost(data) {
  const request = (data.customerSetup?.requests || []).find((item) => item.trackingDomain || item.websiteUrl);
  const value = request?.trackingDomain || request?.websiteUrl || data.config?.tenantDomain || data.config?.sslDomain || "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
  } catch {
    return String(value || "").replace(/^https?:\/\//, "").split("/")[0];
  }
}

function purchaseCompleteness(item) {
  return [
    item.value,
    item.currency,
    item.eventId,
    item.transactionId
  ].filter(Boolean).length;
}

function cleanPurchaseRows(data) {
  const fallbackHost = customerFallbackHost(data);
  const rows = inspectorPurchaseRows(data)
    .map((item) => ({
      ...item,
      displayHost: item.host && item.host !== "Unknown host" ? item.host : fallbackHost || "Tracking domain",
      completeness: purchaseCompleteness(item)
    }))
    .sort((a, b) => {
      const dateDiff = Number(b.date || 0) - Number(a.date || 0);
      if (Math.abs(dateDiff) > 30000) return dateDiff;
      return b.completeness - a.completeness;
    });

  const grouped = new Map();
  for (const item of rows) {
    // Group by transaction first so the same order sent to sGTM on multiple days
    // collapses into one card instead of inflating the count.
    const key = item.transactionId
      ? `tx:${item.transactionId}`
      : item.eventId
        ? `event:${item.eventId}`
        : item.value && item.currency && item.date
          ? `value:${item.value}:${item.currency}:${Math.floor(item.date.getTime() / 60000)}`
          : `raw:${item.path}:${item.date?.getTime() || ""}`;
    const current = grouped.get(key);
    const ts = item.date instanceof Date ? item.date.getTime() : 0;
    if (!current) {
      grouped.set(key, { ...item, sentCount: 1, firstDate: item.date, lastDate: item.date });
      continue;
    }
    // Keep the richest record's fields, but track how many times this transaction
    // hit sGTM and the true first/last times it was seen.
    const winner = item.completeness > current.completeness ? { ...item } : { ...current };
    winner.sentCount = current.sentCount + 1;
    const firstTs = current.firstDate instanceof Date ? current.firstDate.getTime() : Infinity;
    const lastTs = current.lastDate instanceof Date ? current.lastDate.getTime() : -Infinity;
    winner.firstDate = ts && ts < firstTs ? item.date : current.firstDate;
    winner.lastDate = ts && ts > lastTs ? item.date : current.lastDate;
    grouped.set(key, winner);
  }

  const deduped = [...grouped.values()];
  const hasUsefulPurchase = deduped.some((item) => item.value || item.eventId || item.transactionId);
  return hasUsefulPurchase
    ? deduped.filter((item) => item.value || item.eventId || item.transactionId)
    : deduped;
}

// Day boundaries pinned to Asia/Dhaka (UTC+6, no DST) so "today" starts at
// 12:00 AM Bangladesh time regardless of server or viewer timezone.
const DHAKA_OFFSET_MS = 6 * 3600000;
function dhakaDayStartMs(ts = Date.now()) {
  // Midnight Dhaka for the calendar day containing ts, as a UTC epoch ms value.
  return Math.floor((ts + DHAKA_OFFSET_MS) / 86400000) * 86400000 - DHAKA_OFFSET_MS;
}
function dhakaDateKey(ts = Date.now()) {
  return new Date(ts + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

function renderPurchaseInspector(data) {
  const query = els.purchaseSearch.value.trim().toLowerCase();
  // Calendar-day ranges anchored to Dhaka midnight, not rolling milliseconds,
  // so Day / Week / Month each select a distinct, predictable set of days.
  const todayStart = dhakaDayStartMs();
  const cutoff = {
    day: todayStart,
    week: todayStart - 6 * 86400000,
    month: todayStart - 29 * 86400000,
    all: 0
  }[purchaseRange] || 0;
  const rows = cleanPurchaseRows(data).filter((item) => {
    if (cutoff) {
      // Day range: show any purchase with a hit today (lastDate), so an order
      // first sent server-side yesterday but also browser-fired today appears.
      // Week/Month ranges: use firstDate to count each order only once in the
      // period it was originally placed, not every day it was re-sent.
      const dayRange = purchaseRange === "day";
      const anchor = dayRange
        ? (item.lastDate instanceof Date ? item.lastDate : item.date)
        : (item.firstDate instanceof Date ? item.firstDate : item.date);
      const ts = anchor instanceof Date ? anchor.getTime() : Number(anchor) || 0;
      if (ts && ts < cutoff) return false;
    }
    const haystack = [
      item.eventId,
      item.transactionId,
      item.value,
      item.currency,
      item.displayHost,
      item.path,
      item.client
    ].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  const rangeWord = { day: "today", week: "last 7 days", month: "last 30 days", all: "all retained" }[purchaseRange] || "";
  // On the Day view, show real store orders alongside tracked requests so any
  // tracking gap (orders that never fired a Purchase request) is visible. Only
  // shown when the order feed (Woo webhook) actually reports orders — otherwise
  // a "0 orders" reads as a bug when really no order webhook is wired up.
  const realOrders = Number(data.orders?.today?.count);
  const showOrders = purchaseRange === "day" && Number.isFinite(realOrders) && realOrders > 0;
  const realPart = showOrders ? ` · ${realOrders} order${realOrders === 1 ? "" : "s"}` : "";
  els.purchaseInspectorBadge.className = "badge";
  els.purchaseInspectorBadge.classList.add(
    rows.length && (!showOrders || rows.length >= realOrders) ? "ok" : "warn"
  );
  els.purchaseInspectorBadge.textContent = `${rows.length} tracked · ${rangeWord}${realPart}`;

  if (!rows.length) {
    els.purchaseInspector.innerHTML = '<div class="empty-log">No purchase requests matched.</div>';
    return;
  }

  els.purchaseInspector.replaceChildren(
    ...rows.slice(0, 12).map((item) => {
      const card = document.createElement("article");
      card.className = "inspector-card";
      const hasValue = item.value && item.currency;
      // Show the order's first-seen time as the purchase time. If it hit sGTM more
      // than once, flag it so duplicate/re-sent transactions are obvious.
      const firstSeen = item.firstDate instanceof Date ? formatDate(item.firstDate) : item.displayDate;
      const sentCount = Number(item.sentCount || 1);
      const resentBadge = sentCount > 1
        ? `<span class="badge warn" title="This transaction reached sGTM ${sentCount} times — likely a re-send or duplicate fire.">re-sent ×${sentCount}</span>`
        : "";
      card.innerHTML = `
        <div class="inspector-card-top">
          <div>
            <strong>${escapeHtml(hasValue ? formatMoney(item.value, item.currency) : "Purchase")}</strong>
            <small>${escapeHtml(firstSeen)}</small>
          </div>
          <div class="inspector-card-flags">${resentBadge}
            <span class="status-code ${Number(item.status) >= 400 ? "bad" : "good"}">${escapeHtml(item.status)}</span>
          </div>
        </div>
        <div class="inspector-grid">
          <span>Client</span><strong>${escapeHtml(item.client || "Other")}</strong>
          <span>Domain</span><strong>${escapeHtml(item.displayHost)}</strong>
          <span>Transaction ID</span><strong>${escapeHtml(item.transactionId || "Not provided")}</strong>
          <span>Event ID</span><strong>${item.eventId ? escapeHtml(item.eventId) : item.transactionId ? `<span style="color:var(--color-muted)">${escapeHtml(item.transactionId)} <small>(via transaction ID)</small></span>` : "Not provided"}</strong>
        </div>
        <details class="inspector-details">
          <summary>Request details</summary>
          <code>${escapeHtml(item.path || "No request URL available.")}</code>
        </details>
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
      const owner = container.owner || null;
      const cpu = container.cpuPercent === null || container.cpuPercent === undefined
        ? "—"
        : `${container.cpuPercent.toFixed(1)}%`;
      const mem = container.memUsage
        ? `${escapeHtml(container.memUsage)}${container.memLimit ? ` / ${escapeHtml(container.memLimit)}` : ""}${container.memPercent !== null && container.memPercent !== undefined ? ` (${container.memPercent.toFixed(0)}%)` : ""}`
        : "—";
      const ownerLine = owner
        ? `<p class="container-meta">${escapeHtml(text(owner.customerName, "—"))} · <strong>${escapeHtml(text(owner.plan, "—"))}</strong> · ${Number(owner.requestsMonth || 0).toLocaleString()} req/mo · ${Number(owner.requestsToday || 0).toLocaleString()} today${owner.requestLimit ? ` · ${Number(owner.usagePercent || 0)}% of ${Number(owner.requestLimit || 0).toLocaleString()}` : ""}</p>`
        : "";
      // Owner-only lifecycle controls — only for managed sgtm-* containers.
      const controllable = currentSession.role === "owner" && /^sgtm-[a-z0-9-]+$/.test(container.name || "");
      const running = container.state === "running";
      const actions = controllable
        ? `<div class="container-actions">
            <button class="btn-mini" data-container-action="restart" data-container="${escapeHtml(container.name)}">Restart</button>
            <button class="btn-mini" data-container-action="${running ? "stop" : "start"}" data-container="${escapeHtml(container.name)}">${running ? "Stop" : "Start"}</button>
            <button class="btn-mini" data-container-action="resize" data-container="${escapeHtml(container.name)}">Resize</button>
          </div>`
        : "";
      card.innerHTML = `
        <div>
          <div class="container-title">
            <strong>${escapeHtml(container.name)}</strong>
            <span class="state ${stateClass(container.state)}">${escapeHtml(container.state)}</span>
            <span class="state ${stateClass(container.health)}">${escapeHtml(container.health)}</span>
          </div>
          <p class="container-meta">${escapeHtml(container.image)}</p>
          <p class="container-meta">${escapeHtml(text(container.ports, "No exposed ports"))}</p>
          ${ownerLine}
        </div>
        <div class="container-stats">
          <span class="state">CPU ${escapeHtml(cpu)}</span>
          <span class="state">MEM ${mem}</span>
          <span class="state">exit ${escapeHtml(text(container.exitCode, "n/a"))}</span>
          <span class="state">restarts ${escapeHtml(text(container.restartCount, "0"))}</span>
          ${actions}
        </div>
      `;
      return card;
    })
  );

  // Delegate lifecycle button clicks once; cards are re-rendered each refresh.
  if (!els.containerCards.dataset.actionsWired) {
    els.containerCards.dataset.actionsWired = "1";
    els.containerCards.addEventListener("click", handleContainerAction);
  }
}

async function handleContainerAction(event) {
  const button = event.target.closest("[data-container-action]");
  if (!button) return;
  const name = button.getAttribute("data-container");
  const action = button.getAttribute("data-container-action");
  if (!name || !action) return;

  let body = null;
  if (action === "resize") {
    const memInput = window.prompt(`New memory cap for ${name} (MB):`, "1024");
    if (memInput === null) return;
    const cpuInput = window.prompt(`New CPU cap for ${name} (cores, e.g. 1.0):`, "1.0");
    if (cpuInput === null) return;
    body = { memoryMb: Number(memInput), cpuLimit: Number(cpuInput) };
  } else if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} container ${name}?`)) {
    return;
  }

  const original = button.textContent;
  button.disabled = true;
  button.textContent = "…";
  try {
    const res = await fetch(`/api/admin/containers/${encodeURIComponent(name)}/${action}`, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(`Failed: ${data.error || res.status}`);
      button.disabled = false;
      button.textContent = original;
      return;
    }
    if (action === "resize" && data.persisted === false) {
      window.alert("Resized live, but compose file not found — change will revert if the container is recreated.");
    }
    await loadDashboard();
  } catch (error) {
    window.alert(`Request failed: ${error.message}`);
    button.disabled = false;
    button.textContent = original;
  }
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
  // Show today's TRACKED purchases (deduped by transaction_id) so the dashboard
  // matches the Event Logs count. The store-order webhook is still used for the
  // separate reconciliation view; it no longer overrides this headline number,
  // which previously made "Purchases" disagree with Event Logs when the webhook
  // delivered fewer orders than tracking saw.
  const summary = data.nginx?.todayEvents?.purchases || {};
  const stat = reliableEventStats(data).get("Purchase");
  // Use `||` (not `??`) so a deduped count of 0 falls through to the raw event count.
  // Otherwise a server-sent uniqueCount:0 would hide the real Purchase events (e.g. 55
  // tracked purchases would render as "0" purchases / "0" revenue on the dashboard).
  const rawCount = Number(summary.rawCount) || Number(eventRawCount(stat)) || 0;
  const uniqueCount = Number(summary.uniqueCount) || Number(eventDisplayCount("Purchase", stat)) || rawCount;
  const uniqueRevenue = Number(summary.uniqueRevenue) || Number(stat?.uniqueRevenue) || Number(summary.rawRevenue) || Number(stat?.rawRevenue) || 0;
  return {
    rawCount,
    uniqueCount,
    duplicateCount: Number(summary.duplicateCount ?? stat?.duplicateCount) || 0,
    keyedCount: Number(summary.keyedCount ?? stat?.keyedCount) || 0,
    estimatedKeyCount: Number(summary.estimatedKeyCount ?? stat?.estimatedKeyCount) || 0,
    uniqueRevenue,
    rawRevenue: Number(summary.rawRevenue) || Number(stat?.rawRevenue) || uniqueRevenue,
    averageOrderValue: uniqueCount ? uniqueRevenue / uniqueCount : 0,
    currency: summary.currency || stat?.currency || "",
    source: "tracking"
  };
}

// Aggregate purchases + events across a 24h / 7d / 30d window. 24h prefers reconciled
// orders (then falls back to today's purchase events); 7d/30d sum the enriched daily
// history snapshots so revenue/conversion stay consistent with the selected range.
function rangeDays(range) {
  return range === "7d" ? 7 : range === "30d" ? 30 : 1;
}

function metricsForRange(data, range = "24h") {
  const todayPurchases = purchaseSummary(data);
  const todayEvents = Number(data.usage?.requestsToday || data.nginx?.todayEvents?.count || 0);
  if (range === "24h") {
    // Woo order feed is the most accurate when wired up — use it directly.
    if (todayPurchases.source === "orders") {
      return {
        events: todayEvents,
        purchaseCount: Number(todayPurchases.uniqueCount || 0),
        revenue: Number(todayPurchases.uniqueRevenue || 0),
        currency: todayPurchases.currency || ""
      };
    }
    // Server-computed todayEvents.purchases.uniqueCount is deduped by transaction_id
    // on the server and matches what Event Logs and Top Events show. Trust it when
    // available rather than recomputing from cleanPurchaseRows (which uses firstDate
    // date-filter and can miss purchases where date parsing yielded ts=0).
    if (data.nginx?.todayEvents?.available) {
      return {
        events: todayEvents,
        purchaseCount: Number(todayPurchases.uniqueCount || 0),
        revenue: Number(todayPurchases.uniqueRevenue || 0),
        currency: todayPurchases.currency || ""
      };
    }
    // No server summary: count the exact same deduped purchase rows the Purchase
    // Inspector lists for today, so the two views never disagree.
    const start = dhakaDayStartMs();
    const todayPurchaseRows = cleanPurchaseRows(data).filter((row) => {
      const anchor = row.firstDate instanceof Date ? row.firstDate : row.date;
      const ts = anchor instanceof Date ? anchor.getTime() : 0;
      return ts >= start;
    });
    const rowRevenue = todayPurchaseRows.reduce((total, row) => total + (Number(row.value) || 0), 0);
    return {
      events: todayEvents,
      purchaseCount: todayPurchaseRows.length,
      revenue: rowRevenue || Number(todayPurchases.uniqueRevenue || 0),
      currency: todayPurchases.currency || todayPurchaseRows.find((row) => row.currency)?.currency || ""
    };
  }
  const days = rangeDays(range);
  const rows = (Array.isArray(data.history?.daily) ? data.history.daily : []).slice(0, days);
  const todayKey = rows[0]?.date;
  let events = 0;
  let purchaseCount = 0;
  let revenue = 0;
  let currency = "";
  for (const row of rows) {
    events += Number(row.total || 0);
    let dayPurchases = Number(row.purchaseCount || row.purchases || 0);
    let dayRevenue = Number(row.purchaseRevenue || 0);
    // Prefer reconciled orders for today when available (more accurate than events).
    if (row.date === todayKey && Number(todayPurchases.uniqueCount || 0) > dayPurchases) {
      dayPurchases = Number(todayPurchases.uniqueCount || 0);
      dayRevenue = Number(todayPurchases.uniqueRevenue || 0) || dayRevenue;
    }
    purchaseCount += dayPurchases;
    revenue += dayRevenue;
    if (!currency && row.currency) currency = row.currency;
  }
  if (!currency) currency = todayPurchases.currency || "";
  return { events, purchaseCount, revenue, currency };
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
      const detail = raw !== count
        ? `${raw.toLocaleString()} raw hit${raw === 1 ? "" : "s"} · ${eventStatusText(name, stat)}`
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

// In-app upgrade nudge shown to Free-tier customers approaching or hitting their
// monthly event cap. Soft nudge (>=80%) is dismissible for the session; the hard
// cap (>=100%, tracking paused) is not dismissible — it's a service-down state.
function renderUpgradeNudge(usage) {
  const el = document.getElementById("customerUpgradeNudge");
  if (!el) return;
  const plan = String(usage.plan || "");
  const pct = Math.max(0, Number(usage.usagePercent || 0));
  if (plan !== "Free" || pct < 80) { el.hidden = true; el.innerHTML = ""; return; }

  const capped = pct >= 100;
  if (!capped && window.sessionStorage.getItem("tagioo_nudge_dismissed") === "1") {
    el.hidden = true; el.innerHTML = ""; return;
  }
  const limit = Number(usage.requestLimit || 15000).toLocaleString();
  el.hidden = false;
  el.className = `upgrade-nudge ${capped ? "is-capped" : "is-warning"}`;
  el.innerHTML = capped
    ? `<div class="un-main"><span class="un-icon">🛑</span><div><strong>Tracking paused — you hit your ${limit} free events</strong>
         <p>New conversions are not reaching Meta, GA4, or Google Ads. Upgrade to a paid plan to resume tracking instantly.</p></div></div>
       <button class="button button-primary" type="button" data-nudge-upgrade>Upgrade now</button>`
    : `<div class="un-main"><span class="un-icon">⚡</span><div><strong>You've used ${Math.round(pct)}% of your ${limit} free events</strong>
         <p>Upgrade before you hit the cap to keep conversions flowing without interruption.</p></div></div>
       <div class="un-actions"><button class="button button-primary" type="button" data-nudge-upgrade>Upgrade</button>
       <button class="button" type="button" data-nudge-dismiss>Later</button></div>`;

  el.querySelector("[data-nudge-upgrade]")?.addEventListener("click", () => setView("billing"));
  el.querySelector("[data-nudge-dismiss]")?.addEventListener("click", () => {
    window.sessionStorage.setItem("tagioo_nudge_dismissed", "1");
    el.hidden = true; el.innerHTML = "";
  });
}

function renderCustomerSetup(data) {
  const requests = (data.customerSetup?.requests || []).filter((request) => !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase()));
  const latest = requests[0];
  const usage = data.usage || {};
  const dnsTarget = data.config?.provisionDnsTarget || data.config?.publicBaseUrl || window.location.host || "bd.tagioo.com";
  const usagePercent = Math.min(100, Math.max(0, Number(usage.usagePercent || 0)));
  const latestStatus = String(latest?.status || "").replaceAll("_", " ");

  els.customerSetupBadge.className = `badge ${latest ? "ok" : "warn"}`;
  els.customerSetupBadge.textContent = latest ? `${requests.length} container${requests.length === 1 ? "" : "s"}` : "No container yet";

  if (els.customerHeroTitle) {
    els.customerHeroTitle.textContent = latest
      ? latest.containerName || latest.websiteUrl || "Pixel Containers"
      : "Create your first sGTM container";
  }
  if (els.customerHeroDomain) {
    els.customerHeroDomain.textContent = latest
      ? `${latest.websiteUrl || "Website"} · ${latest.trackingDomain || "tracking domain"} · ${latestStatus || "requested"}`
      : `Create a container, then point CNAME to ${dnsTarget}. Tagioo handles Docker, Nginx, SSL, and launch status automatically.`;
  }
  if (els.customerUsagePercent) els.customerUsagePercent.textContent = `${usagePercent}%`;
  if (els.customerUsageRing) els.customerUsageRing.style.setProperty("--usage-percent", usagePercent);
  customerSubscriptionStatus = String(usage.subscriptionStatus || "");
  renderUpgradeNudge(usage);
  if (els.customerPlanName) els.customerPlanName.textContent = usage.plan || "Starter";
  if (els.customerMonthEvents) {
    els.customerMonthEvents.textContent = `${Number(usage.requestsMonth || 0).toLocaleString()} of ${Number(usage.requestLimit || 0).toLocaleString()} requests`;
  }

  if (els.customerPerformanceGrid) renderCustomerPerformance(data);

  if (els.customerSetupList) {
    els.customerSetupList.innerHTML = requests.length
      ? requests.slice(0, 3).map((request) => customerContainerCard(request, { compact: true })).join("")
      : `<article class="customer-container-card empty-customer-card">
          <div>
            <strong>No containers yet</strong>
            <p>Create your first hosted server-side GTM container.</p>
          </div>
          <button class="button button-primary" type="button" data-view-shortcut="customerContainers">Create Container</button>
        </article>`;
  }

  if (els.customerNextStepBadge && els.customerNextStepList) {
    const step = customerNextStep(latest, dnsTarget);
    els.customerNextStepBadge.className = `badge ${step.status === "healthy" ? "ok" : "warn"}`;
    els.customerNextStepBadge.textContent = step.badge;
    renderSummaryList(els.customerNextStepList, [
      { label: step.label, value: step.value, status: step.status },
      { label: "Customer DNS value", value: dnsTarget, status: "healthy" },
      { label: "Need help?", value: "Send the DNS value to your domain manager or developer.", status: "healthy" }
    ]);
  }
}

function renderCustomerPerformance(data, range = customerKpiRange) {
  const summary = data.nginx?.todayEvents || {};
  const m = metricsForRange(data, range);
  const periodEvents = Number(data.usage?.requestsMonth ?? Number(summary.count || 0));
  // Conversion is now window-aligned: purchases and events both come from `range`.
  const conversion = m.events ? Math.round((m.purchaseCount / m.events) * 1000) / 10 : 0;
  // 24h is really the Dhaka calendar day (today's log), not a rolling 24h window —
  // label it honestly so the number matches "today" everywhere else in the panel.
  const rangeLabel = { "24h": "today", "7d": "last 7 days", "30d": "last 30 days" }[range] || "today";
  renderBusinessGrid(els.customerPerformanceGrid, [
    { label: "Events", value: periodEvents.toLocaleString(), detail: `${Number(data.usage?.usagePercent || 0)}% used this billing period` },
    { label: range === "24h" ? "Today" : "Window", value: m.events.toLocaleString(), detail: `Clean requests · ${rangeLabel}` },
    { label: "Revenue", value: m.revenue ? formatMoney(m.revenue, m.currency) : "0", detail: `Tracked purchase value · ${rangeLabel}` },
    { label: "Conversion", value: `${conversion}%`, detail: `${m.purchaseCount.toLocaleString()} / ${m.events.toLocaleString()}` },
    { label: "Purchases", value: m.purchaseCount.toLocaleString(), detail: rangeLabel }
  ]);
  // Top Events + Event Distribution read today's deduped events (4th arg), not the
  // 30-day retained window — so they match "today" everywhere else in the panel.
  renderCustomerAnalytics(summary, data.history?.daily || [], customerChartRange, summary);
}

function renderCustomerAnalytics(summary, dailyHistory = [], range = "24h", eventSummary = summary) {
  if (els.customerEventChart) {
    const SERIES = [
      { key: "total",         label: "Total Events",     color: "#7c3aed", width: 2,    fill: true,  opacity: 1    },
      { key: "pageView",      label: "PageView",         color: "#6366f1", width: 1.25, fill: false, opacity: 0.55 },
      { key: "viewItem",      label: "ViewContent",      color: "#8b5cf6", width: 1.25, fill: false, opacity: 0.55 },
      { key: "addToCart",     label: "AddToCart",        color: "#10b981", width: 1.25, fill: false, opacity: 0.55 },
      { key: "beginCheckout", label: "InitiateCheckout", color: "#d97706", width: 1.25, fill: false, opacity: 0.55 },
      { key: "purchases",     label: "Purchase",         color: "#22c55e", width: 1.25, fill: false, opacity: 0.55 }
    ];
    // Round the axis top up to a clean value with modest headroom (~10-25%),
    // so the curve fills the plot instead of being squashed by a 2x axis.
    const niceCeil = (v) => {
      const n = Math.max(1, Number(v) || 0);
      const pow = Math.pow(10, Math.floor(Math.log10(n)));
      const lead = n / pow;
      const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s >= lead - 1e-9) ?? 10;
      return step * pow;
    };

    if (range !== "24h") {
      // 7d / 30d daily chart
      const days = range === "7d" ? 7 : 30;
      const rows = Array.isArray(dailyHistory) ? dailyHistory.slice(0, days).reverse() : [];
      const W = 880; const H = 150;
      const pad = { left: 36, right: 18, top: 16, bottom: 26 };
      const plotW = W - pad.left - pad.right;
      const plotH = H - pad.top - pad.bottom;
      const maxVal = niceCeil(Math.max(1, ...rows.map((r) => Number(r.total || 0))));
      const toX = (i) => rows.length < 2 ? pad.left + plotW / 2 : pad.left + (i / (rows.length - 1)) * plotW;
      const toY = (v) => Math.max(pad.top, pad.top + plotH - Math.min(Number(v) / maxVal, 1) * plotH);
      const baseY = (pad.top + plotH).toFixed(1);

      function catmullRomDaily(points) {
        if (!points.length) return "";
        let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[Math.max(0, i - 1)];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[Math.min(points.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = Math.max(pad.top, Math.min(pad.top + plotH, p1.y + (p2.y - p0.y) / 6));
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = Math.max(pad.top, Math.min(pad.top + plotH, p2.y - (p3.y - p1.y) / 6));
          d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        }
        return d;
      }

      const yTicks = [0, 0.5, 1].map((pct) => {
        const y = (pad.top + plotH * (1 - pct)).toFixed(1);
        const val = Math.round(maxVal * pct);
        return `<line class="${pct === 0 ? "chart-axis-line" : "chart-grid-line-dashed"}" x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" />
                <text class="chart-axis-label" x="${pad.left - 8}" y="${(Number(y) + 3.5).toFixed(1)}" text-anchor="end">${val}</text>`;
      }).join("");

      const labelStep = rows.length <= 7 ? 1 : rows.length <= 14 ? 2 : 5;
      const xLabels = rows.map((r, i) => {
        if (i % labelStep !== 0 && i !== rows.length - 1) return "";
        const label = r.date ? r.date.slice(5) : "";
        return `<text class="chart-axis-label" x="${toX(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeHtml(label)}</text>`;
      }).join("");

      if (!rows.length) {
        els.customerEventChart.innerHTML = '<div class="empty-log" style="padding:2rem 1rem;text-align:center;color:var(--color-muted);font-size:.85rem">No history data yet for this period.</div>';
        if (els.customerChartLegend) els.customerChartLegend.innerHTML = "";
        return;
      }

      const pts = rows.map((r, i) => ({ x: toX(i), y: toY(Number(r.total || 0)) }));
      const linePath = catmullRomDaily(pts);
      const areaPath = `${linePath} L ${toX(rows.length - 1).toFixed(1)},${baseY} L ${toX(0).toFixed(1)},${baseY} Z`;

      const slotW = rows.length > 1 ? plotW / (rows.length - 1) : plotW;
      const hoverRects = rows.map((r, i) =>
        `<rect class="chart-hover-rect" x="${(toX(i) - slotW / 2).toFixed(1)}" y="${pad.top}" width="${slotW.toFixed(1)}" height="${plotH}" data-idx="${i}" data-date="${escapeHtml(r.date || "")}" data-total="${Number(r.total || 0)}" />`
      ).join("");

      els.customerEventChart.innerHTML = `
        <div class="chart-tooltip" id="customerChartTooltip" style="display:none;pointer-events:none"></div>
        <svg class="customer-analytics-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily event analytics">
          <defs>
            <linearGradient id="chartTotalFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.26" />
              <stop offset="55%" stop-color="#7c3aed" stop-opacity="0.10" />
              <stop offset="100%" stop-color="#7c3aed" stop-opacity="0" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x="${pad.left}" y="${pad.top - 4}" width="${plotW}" height="${plotH + 4}" />
            </clipPath>
          </defs>
          <g>${yTicks}</g>
          <g clip-path="url(#chartClip)">
            <path d="${areaPath}" fill="url(#chartTotalFill)" />
            <path d="${linePath}" stroke="#7c3aed" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <line class="chart-crosshair-line" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + plotH}" style="display:none" />
          <g class="chart-dots"></g>
          <g>${hoverRects}</g>
          ${xLabels}
        </svg>
      `;

      if (els.customerChartLegend) {
        els.customerChartLegend.innerHTML = `<span class="chart-legend-item" style="--dot-color:#7c3aed"><span class="chart-legend-dot"></span>Total Events</span>`;
      }

      const tooltip = document.getElementById("customerChartTooltip");
      const crosshairLine = els.customerEventChart.querySelector(".chart-crosshair-line");
      const dotsGroup = els.customerEventChart.querySelector(".chart-dots");

      els.customerEventChart.querySelectorAll(".chart-hover-rect").forEach((rect) => {
        rect.addEventListener("mouseenter", () => {
          const ix = Number(rect.dataset.idx);
          const x = toX(ix).toFixed(1);
          const total = Number(rect.dataset.total);
          crosshairLine.setAttribute("x1", x); crosshairLine.setAttribute("x2", x);
          crosshairLine.style.display = "";
          dotsGroup.innerHTML = `<circle cx="${x}" cy="${toY(total).toFixed(1)}" r="4" fill="#7c3aed" stroke="white" stroke-width="2" />`;
          tooltip.innerHTML = `<div class="tooltip-hour">${escapeHtml(rect.dataset.date || "")}</div><div class="tooltip-row"><span class="tooltip-dot" style="background:#7c3aed"></span><span>Total Events</span><strong>${total.toLocaleString()}</strong></div>`;
          tooltip.style.display = "block";
        });
        rect.addEventListener("mousemove", (e) => {
          const cr = els.customerEventChart.getBoundingClientRect();
          const tw = tooltip.offsetWidth || 170; const th = tooltip.offsetHeight || 60;
          let left = e.clientX - cr.left + 16; let top = e.clientY - cr.top - th - 12;
          if (left + tw > cr.width - 8) left = e.clientX - cr.left - tw - 16;
          if (top < 0) top = e.clientY - cr.top + 12;
          tooltip.style.left = `${left}px`; tooltip.style.top = `${top}px`;
        });
        rect.addEventListener("mouseleave", () => {
          tooltip.style.display = "none"; crosshairLine.style.display = "none"; dotsGroup.innerHTML = "";
        });
      });
      return;
    }

    // 24h hourly chart
    const rawHourly = Array.isArray(summary.hourly) ? summary.hourly : [];
    const sorted = Array.from({ length: 24 }, (_, i) => {
      const found = rawHourly.find((h) => h.hour === i);
      return found || { hour: i, total: 0, errors: 0, purchases: 0, pageView: 0, viewItem: 0, addToCart: 0, beginCheckout: 0 };
    });

    const maxVal = niceCeil(Math.max(1, ...sorted.map((h) => h.total)));
    const W = 640; const H = 220;
    const pad = { left: 46, right: 20, top: 20, bottom: 38 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const toX = (i) => pad.left + (i / 23) * plotW;
    const toY = (v) => Math.max(pad.top, pad.top + plotH - Math.min(Number(v) / maxVal, 1) * plotH);

    function catmullRom(points) {
      if (!points.length) return "";
      let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = Math.max(pad.top, Math.min(pad.top + plotH, p1.y + (p2.y - p0.y) / 6));
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = Math.max(pad.top, Math.min(pad.top + plotH, p2.y - (p3.y - p1.y) / 6));
        d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    }

    const getPts = (key) => sorted.map((h, i) => ({ x: toX(i), y: toY(h[key] || 0) }));
    const baseY = (pad.top + plotH).toFixed(1);

    const yTicks = [0, 0.5, 1].map((pct) => {
      const y = (pad.top + plotH * (1 - pct)).toFixed(1);
      const val = Math.round(maxVal * pct);
      const isBase = pct === 0;
      return `<line class="${isBase ? "chart-axis-line" : "chart-grid-line-dashed"}" x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" />
              <text class="chart-axis-label" x="${pad.left - 8}" y="${(Number(y) + 3.5).toFixed(1)}" text-anchor="end">${val}</text>`;
    }).join("");

    const xLabels = [0, 6, 12, 18, 23].map((i) =>
      `<text class="chart-axis-label" x="${toX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${String(i).padStart(2, "0")}:00</text>`
    ).join("");

    const visibleSeries = SERIES.filter((s) => s.key === "total" || sorted.some((h) => Number(h[s.key] || 0) > 0));

    // Draw secondary series first (dimmed, thin) so the Total hero line + area sit on top.
    const orderedSeries = [...visibleSeries].sort((a, b) => (a.key === "total" ? 1 : 0) - (b.key === "total" ? 1 : 0));
    const seriesSVG = orderedSeries.map((s) => {
      const line = catmullRom(getPts(s.key));
      const areaEl = s.fill ? `<path d="${line} L ${toX(23).toFixed(1)},${baseY} L ${toX(0).toFixed(1)},${baseY} Z" fill="url(#chartTotalFill)" />` : "";
      return `${areaEl}<path d="${line}" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" fill="none" stroke-linejoin="round" stroke-linecap="round" />`;
    }).join("");

    const slotW = plotW / 23;
    const hoverRects = sorted.map((_, i) =>
      `<rect class="chart-hover-rect" x="${(toX(i) - slotW / 2).toFixed(1)}" y="${pad.top}" width="${slotW.toFixed(1)}" height="${plotH}" data-hour="${i}" />`
    ).join("");

    els.customerEventChart.innerHTML = `
      <div class="chart-tooltip" id="customerChartTooltip" style="display:none;pointer-events:none"></div>
      <svg class="customer-analytics-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hourly event analytics">
        <defs>
          <linearGradient id="chartTotalFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.26" />
              <stop offset="55%" stop-color="#7c3aed" stop-opacity="0.10" />
              <stop offset="100%" stop-color="#7c3aed" stop-opacity="0" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x="${pad.left}" y="${pad.top - 4}" width="${plotW}" height="${plotH + 4}" />
          </clipPath>
        </defs>
        <g>${yTicks}</g>
        <g clip-path="url(#chartClip)">${seriesSVG}</g>
        <line class="chart-crosshair-line" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + plotH}" style="display:none" />
        <g class="chart-dots"></g>
        <g>${hoverRects}</g>
        ${xLabels}
      </svg>
    `;

    if (els.customerChartLegend) {
      els.customerChartLegend.innerHTML = visibleSeries.map((s) =>
        `<button class="chart-legend-item" type="button" data-series="${s.key}" style="--dot-color:${s.color}">
          <span class="chart-legend-dot"></span>${escapeHtml(s.label)}
        </button>`
      ).join("");
    }

    const tooltip = document.getElementById("customerChartTooltip");
    const crosshairLine = els.customerEventChart.querySelector(".chart-crosshair-line");
    const dotsGroup = els.customerEventChart.querySelector(".chart-dots");

    els.customerEventChart.querySelectorAll(".chart-hover-rect").forEach((rect) => {
      rect.addEventListener("mouseenter", () => {
        const ix = Number(rect.dataset.hour);
        const h = sorted[ix] || {};
        const x = toX(ix).toFixed(1);

        crosshairLine.setAttribute("x1", x);
        crosshairLine.setAttribute("x2", x);
        crosshairLine.style.display = "";

        dotsGroup.innerHTML = visibleSeries.map((s) => {
          const val = Number(h[s.key] || 0);
          if (val === 0 && s.key !== "total") return "";
          return `<circle cx="${x}" cy="${toY(val).toFixed(1)}" r="4" fill="${s.color}" stroke="white" stroke-width="2" />`;
        }).filter(Boolean).join("");

        const rows = visibleSeries.map((s) => {
          const val = Number(h[s.key] || 0);
          if (val === 0 && s.key !== "total") return "";
          return `<div class="tooltip-row"><span class="tooltip-dot" style="background:${s.color}"></span><span>${s.label}</span><strong>${val.toLocaleString()}</strong></div>`;
        }).filter(Boolean).join("");
        tooltip.innerHTML = `<div class="tooltip-hour">${ix}:00</div>${rows}`;
        tooltip.style.display = "block";
      });

      rect.addEventListener("mousemove", (e) => {
        const cr = els.customerEventChart.getBoundingClientRect();
        const tw = tooltip.offsetWidth || 170;
        const th = tooltip.offsetHeight || 90;
        let left = e.clientX - cr.left + 16;
        let top = e.clientY - cr.top - th - 12;
        if (left + tw > cr.width - 8) left = e.clientX - cr.left - tw - 16;
        if (top < 0) top = e.clientY - cr.top + 12;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });

      rect.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
        crosshairLine.style.display = "none";
        dotsGroup.innerHTML = "";
      });
    });
  }

  const events = (eventSummary.events || []).filter((row) => Number(row.count || 0) > 0);
  if (els.customerTopEvents) {
    const purchaseEvent = events.find((event) => event.name === "Purchase");
    const topEvents = events.slice(0, 5);
    if (purchaseEvent && !topEvents.some((event) => event.name === "Purchase")) {
      topEvents.push(purchaseEvent);
    }
    els.customerTopEvents.innerHTML = events.length
      ? topEvents.map((event) => `
          <div class="top-event-row">
            <span>${escapeHtml(event.name || "Other")}</span>
            <strong>${Number(event.count || 0).toLocaleString()}</strong>
          </div>
        `).join("")
      : `<div class="empty-log">No server events yet.</div>`;
  }

  if (els.customerEventDistribution) {
    const total = events.reduce((sum, event) => sum + Number(event.count || 0), 0);
    els.customerEventDistribution.innerHTML = events.length
      ? events.slice(0, 5).map((event) => {
        const percent = total ? Math.round((Number(event.count || 0) / total) * 100) : 0;
        return `<div class="distribution-row">
          <div><span>${escapeHtml(event.name || "Other")}</span><strong>${percent}%</strong></div>
          <div class="usage-progress"><span style="width:${percent}%"></span></div>
        </div>`;
      }).join("")
      : `<div class="empty-log">Event distribution appears after the first tracking request.</div>`;
  }
}

function renderCustomerContainers(data) {
  const requests = (data.customerSetup?.requests || []).filter((request) => !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase()));
  const dnsTarget = data.config?.provisionDnsTarget || data.config?.publicBaseUrl || window.location.host || "the SGTM server";
  if (els.customerDnsTarget) els.customerDnsTarget.textContent = dnsTarget;
  if (els.customerDnsTargetInline) els.customerDnsTargetInline.textContent = dnsTarget;
  const createSection = document.getElementById("customerContainerCreate");
  if (createSection) createSection.hidden = requests.length > 0;
  const listPanel = document.getElementById("customerContainerListPanel");
  if (listPanel) listPanel.hidden = !requests.length;
  els.customerContainersBadge.className = `badge ${requests.length ? "ok" : "warn"}`;
  els.customerContainersBadge.textContent = `${requests.length} container${requests.length === 1 ? "" : "s"}`;
  if (!requests.length) {
    selectedCustomerContainerId = "";
    els.customerContainersTable.innerHTML = "";
    if (els.customerContainerDetail) els.customerContainerDetail.innerHTML = "";
    return;
  }

  if (!requests.some((request) => request.id === selectedCustomerContainerId)) {
    selectedCustomerContainerId = requests[0]?.id || "";
  }

  const searchTerm = String(els.customerContainerSearch?.value || "").trim().toLowerCase();
  const filteredRequests = searchTerm
    ? requests.filter((request) => [request.containerName, request.websiteUrl, request.trackingDomain, request.serverLocation, request.status]
      .some((value) => String(value || "").toLowerCase().includes(searchTerm)))
    : requests;

  els.customerContainersTable.innerHTML = customerContainersList(filteredRequests, requests.length, data);
  if (els.customerContainerDetail) {
    const selected = requests.find((request) => request.id === selectedCustomerContainerId) || requests[0];
    els.customerContainerDetail.innerHTML = customerContainerDetail(selected, data, dnsTarget);
  }

  els.customerContainersTable.querySelectorAll("[data-container-select]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCustomerContainerId = button.dataset.containerSelect || selectedCustomerContainerId;
      renderCustomerContainers(latestData || data);
      document.querySelector("#customerContainerDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  els.customerContainersTable.querySelectorAll("[data-container-logs]").forEach((button) => {
    button.addEventListener("click", () => setView("logs"));
  });
  els.customerContainersTable.querySelectorAll("[data-container-powerups]").forEach((button) => {
    button.addEventListener("click", () => setView("powerUps"));
  });
  els.customerContainersTable.querySelectorAll("[data-container-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomerContainer(button.dataset.containerDelete));
  });
  els.customerContainerDetail?.querySelectorAll("[data-container-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomerContainer(button.dataset.containerDelete));
  });
}

function customerContainersList(requests, totalCount, data) {
  if (!requests.length) {
    return `<article class="empty-container-list">
      <strong>No matching containers</strong>
      <p>Try searching by website, container name, tracking subdomain, or status.</p>
    </article>`;
  }
  return `<div class="customer-container-table-wrap">
    <table class="customer-container-list-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Domain</th>
          <th>Status</th>
          <th>Requests</th>
          <th>Last Sync</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map((request) => customerContainerRow(request, data)).join("")}
      </tbody>
    </table>
    <div class="container-list-footer">
      <span>Showing ${requests.length.toLocaleString()} of ${totalCount.toLocaleString()} container${totalCount === 1 ? "" : "s"}</span>
      <span>Per page 10</span>
    </div>
  </div>`;
}

function customerContainerRow(request, data) {
  const meta = customerStatusMeta(request.status);
  const isSelected = request.id === selectedCustomerContainerId;
  const requestCount = customerContainerRequestCount(request, data);
  const canDelete = !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase());
  return `<tr class="${isSelected ? "is-selected" : ""}">
    <td>
      <button class="container-name-button" type="button" data-container-select="${escapeHtml(request.id)}">
        <strong>${escapeHtml(containerDisplayName(request))}</strong>
        <span>${escapeHtml(request.trackingDomain || "Tracking domain pending")}</span>
      </button>
    </td>
    <td><span class="container-type-pill">${escapeHtml(request.containerType || "sGTM")}</span></td>
    <td>${escapeHtml(request.websiteUrl || "--")}</td>
    <td><span class="state ${meta.className}">${escapeHtml(meta.label)}</span></td>
    <td>${Number(requestCount || 0).toLocaleString()}</td>
    <td>${escapeHtml(formatShortDate(request.updatedAt || request.createdAt) || "--")}</td>
    <td>
      <div class="container-row-actions">
        <button type="button" data-container-select="${escapeHtml(request.id)}">View</button>
        <button type="button" data-container-logs="${escapeHtml(request.id)}">Logs</button>
        <button type="button" data-container-powerups="${escapeHtml(request.id)}">Power-Ups</button>
        ${canDelete ? `<button class="danger-link" type="button" data-container-delete="${escapeHtml(request.id)}">Delete</button>` : ""}
      </div>
    </td>
  </tr>`;
}

function customerContainerDetail(request, data, dnsTarget) {
  const meta = customerStatusMeta(request.status);
  const usage = data.usage || {};
  const planName = usage.plan || "Starter";
  const requestLimit = Number(usage.requestLimit || 100000);
  const monthRequests = Number(usage.requestsMonth || 0);
  const requestCount = customerContainerRequestCount(request, data);
  const usagePercent = requestLimit ? Math.min(100, Math.round((monthRequests / requestLimit) * 1000) / 10) : 0;
  const serverUrl = request.trackingDomain ? `https://${request.trackingDomain}` : null;
  const platformUrl = request.platformDomain || serverUrl;
  const canDelete = !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase());
  const isLive = meta.className === "healthy";
  return `<section class="container-detail-view">
    <article class="panel container-detail-hero">
      <div>
        <div class="detail-pill-row">
          <span class="state ${meta.className}">${escapeHtml(meta.label)}</span>
          <span class="container-type-pill">${escapeHtml(request.containerType || "sGTM")}</span>
        </div>
        <h2>${escapeHtml(containerDisplayName(request))}</h2>
        <p>${escapeHtml(request.websiteUrl || "Website not set")}</p>
        <div class="container-detail-progress">
          <strong>${Number(monthRequests).toLocaleString()}</strong>
          <span>of ${Number(requestLimit).toLocaleString()} requests this billing period</span>
          <em>${usagePercent}% used</em>
        </div>
        <div class="usage-bar" role="progressbar" aria-valuenow="${usagePercent}" aria-valuemin="0" aria-valuemax="100">
          <span style="width:${Math.max(2, Math.min(100, usagePercent))}%"></span>
        </div>
      </div>
      <div class="container-plan-chip">
        <strong>${escapeHtml(planName)}</strong>
        <span>Current plan</span>
        <small>${escapeHtml(subscriptionPlans.find((plan) => plan.name === planName)?.renewal || "Renews monthly")}</small>
      </div>
    </article>

    <nav class="container-detail-tabs" aria-label="Container shortcuts">
      <button class="is-active" type="button">Settings</button>
      <button type="button" data-view-shortcut="powerUps">Power-Ups</button>
      <button type="button" data-view-shortcut="logs">Logs</button>
    </nav>

    <div class="container-detail-grid">
      <article class="panel container-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Container Settings</h2>
            <p>GTM configuration and tracking URLs for this container.</p>
          </div>
          <span class="badge ${isLive ? "ok" : "warn"}">${escapeHtml(meta.badge)}</span>
        </div>
        <div class="detail-setting-list">
          ${detailSetting("Name", containerDisplayName(request))}
          ${detailSetting("Type", request.containerType || "sGTM")}
          ${detailSetting("sGTM Container ID", request.sgtmContainerId || "Unavailable")}
          ${detailSetting("Container Config", request.containerConfig ? "Configured" : "Missing")}
          ${detailSetting("Recent Requests", Number(requestCount || 0).toLocaleString())}
          ${detailSetting("Location", request.serverLocation || "Bangladesh BDIX")}
        </div>
        ${platformUrl ? `<div class="container-url-block">
          <span>Server Container URL</span>
          <a href="${escapeHtml(platformUrl)}" target="_blank" rel="noopener">${escapeHtml(platformUrl)}</a>
          <small>Use in Google Tag Manager → Admin → Server Container URL</small>
        </div>` : ""}
        ${serverUrl && serverUrl !== platformUrl ? `<div class="container-url-block">
          <span>First-Party Domain</span>
          <a href="${escapeHtml(serverUrl)}" target="_blank" rel="noopener">${escapeHtml(serverUrl)}</a>
          <small>Use as Server Container URL in your GTM Web Container tags</small>
        </div>` : ""}
        ${!serverUrl ? `<div class="container-url-block container-url-pending">
          <span>Tracking URL</span>
          <strong>Pending — DNS not yet configured</strong>
        </div>` : ""}
      </article>

      <article class="panel container-detail-panel domain-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Domain & DNS</h2>
            <p>Point your tracking subdomain here to enable first-party tracking.</p>
          </div>
          <span class="badge ${isLive ? "ok" : "warn"}">${isLive ? "Active" : "Waiting"}</span>
        </div>
        ${serverUrl ? `<div class="domain-live-card">
          <strong>${escapeHtml(serverUrl)}</strong>
          <span>Domain: ${isLive ? "Active" : "Waiting"} · SSL: ${isLive ? "Active" : "Provisioning"}</span>
        </div>` : ""}
        <div class="dns-instruction-card">
          <div>
            <span>Type</span>
            <strong>CNAME</strong>
          </div>
          <div>
            <span>Host</span>
            <strong>${escapeHtml(request.trackingDomain || "server.yourdomain.com")}</strong>
          </div>
          <div>
            <span>Value</span>
            <strong>${escapeHtml(dnsTarget)}</strong>
          </div>
        </div>
        ${canDelete ? `<div class="domain-panel-footer">
          <button class="danger-link" type="button" data-container-delete="${escapeHtml(request.id)}">Delete Container</button>
        </div>` : ""}
      </article>
    </div>
  </section>`;
}

function containerDisplayName(request) {
  return request.containerName || request.tenantName || hostLabel(request.websiteUrl) || "sGTM Container";
}

function customerContainerRequestCount(request, data) {
  const trackingDomain = String(request.trackingDomain || "").toLowerCase();
  const rows = todayRows(data);
  const matchingRows = trackingDomain
    ? rows.filter((row) => `${row.host || ""} ${row.requestUrl || ""}`.toLowerCase().includes(trackingDomain))
    : [];
  if (matchingRows.length) return matchingRows.length;
  const activeContainers = (data.customerSetup?.requests || [])
    .filter((item) => !["deleted", "delete_requested"].includes(String(item.status || "").toLowerCase())).length;
  return activeContainers <= 1 ? Number(data.usage?.requestsToday || data.nginx?.todayEvents?.count || 0) : 0;
}

function detailSetting(label, value) {
  return `<div class="detail-setting-row">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value || "--")}</strong>
  </div>`;
}

function cloudUrlRow(label, value, help) {
  return `<div class="cloud-url-row">
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "--")}</strong>
      <small>${escapeHtml(help || "")}</small>
    </div>
  </div>`;
}

function powerUpAvailable(item, planName) {
  return Number(planRank[planName] ?? 1) >= Number(planRank[item.minimumPlan] ?? 1);
}

function powerUpState(item, planName) {
  if (item.defaultState === "coming") return "coming";
  if (!powerUpAvailable(item, planName)) return "upgrade";
  // For infrastructure-level power-ups, reflect server init state
  const infraIds = new Set(["cookie-keeper", "click-id-restorer", "custom-loader", "bot-detection", "user-agent-info"]);
  if (infraIds.has(item.id)) {
    if (!powerUpsServerEnabled) return "needs-init";
    return item.id === "custom-loader" ? "configure" : "active";
  }
  return item.defaultState === "configure" ? "configure" : "enabled";
}

function powerUpActionLabel(state, isOwner) {
  if (state === "active") return "✓ Active";
  if (state === "enabled") return "Enabled";
  if (state === "configure") return "Configure";
  if (state === "needs-init") return isOwner ? "Setup Required" : "Pending";
  if (state === "upgrade") return "Upgrade to use";
  return "Coming soon";
}

async function fetchPowerUpsStatus() {
  if (powerUpsStatusFetched) return;
  try {
    const res = await fetch("/api/powerups/status");
    if (res.ok) {
      const json = await res.json();
      powerUpsServerEnabled = Boolean(json.powerUpsEnabled);
      powerUpsStatusFetched = true;
    }
  } catch (_) { /* non-fatal */ }
}

async function triggerPowerUpsInit(data) {
  if (els.powerUpsMessage) {
    els.powerUpsMessage.textContent = "Initializing Power-Ups… this may take a few seconds.";
    els.powerUpsMessage.className = "powerups-message info";
  }
  try {
    const res = await fetch("/api/powerups/init", { method: "POST" });
    const json = await res.json();
    if (json.ok) {
      powerUpsServerEnabled = true;
      powerUpsStatusFetched = true;
      if (els.powerUpsMessage) {
        els.powerUpsMessage.textContent = "✓ Power-Ups initialized! Cookie Keeper, Click ID Restorer, and Custom Loader are now active for all new containers. Click “Regen nginx” to update existing containers.";
        els.powerUpsMessage.className = "powerups-message ok";
      }
      renderPowerUps(data);
    } else {
      const failedStep = json.steps?.find((s) => !s.ok);
      if (els.powerUpsMessage) {
        els.powerUpsMessage.textContent = `Init failed: ${failedStep?.error || failedStep?.label || "Unknown error"}`;
        els.powerUpsMessage.className = "powerups-message error";
      }
    }
  } catch (err) {
    if (els.powerUpsMessage) {
      els.powerUpsMessage.textContent = `Init error: ${err.message}`;
      els.powerUpsMessage.className = "powerups-message error";
    }
  }
}

async function triggerRegenNginx(data) {
  if (els.powerUpsMessage) {
    els.powerUpsMessage.textContent = "Regenerating nginx configs for all active containers…";
    els.powerUpsMessage.className = "powerups-message info";
  }
  try {
    const res = await fetch("/api/powerups/regen-nginx", { method: "POST" });
    const json = await res.json();
    const count = json.containers?.length || 0;
    const failCount = json.containers?.filter((c) => !c.ok).length || 0;
    if (els.powerUpsMessage) {
      if (json.ok || failCount === 0) {
        els.powerUpsMessage.textContent = `✓ Regenerated nginx for ${count} container(s). All Power-Ups now active.`;
        els.powerUpsMessage.className = "powerups-message ok";
      } else {
        const errors = json.containers?.filter((c) => !c.ok).map((c) => `${c.domain}: ${c.error}`).join("; ");
        els.powerUpsMessage.textContent = `Partial regen: ${count - failCount}/${count} succeeded. ${errors}`;
        els.powerUpsMessage.className = "powerups-message error";
      }
    }
  } catch (err) {
    if (els.powerUpsMessage) {
      els.powerUpsMessage.textContent = `Regen error: ${err.message}`;
      els.powerUpsMessage.className = "powerups-message error";
    }
  }
}

function showCustomLoaderModal(domain) {
  const snippet = domain
    ? `<!-- Custom Loader: load GTM through your first-party domain -->
<!-- Replace the standard GTM snippet's script URL with this path -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://${escapeHtml(domain)}/tagioo-loader/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');
</script>
<!-- Also update gtag.js references to: https://${escapeHtml(domain)}/tagioo-loader/gtag/js -->`
    : "Deploy a container first to get your Custom Loader snippet.";

  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>Custom Loader — GTM Snippet</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">Replace your standard Web GTM script URL with your first-party tracking domain path. Ad blockers targeting <code>googletagmanager.com</code> will no longer block your tag.</p>
      <pre class="powerup-modal-code"><code>${escapeHtml(snippet)}</code></pre>
      <div class="powerup-modal-hint">Replace <code>GTM-XXXXXXX</code> with your actual Web GTM container ID.</div>
      <button class="button button-primary powerup-modal-copy" type="button">Copy Snippet</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  modal.querySelector(".powerup-modal-copy").addEventListener("click", () => {
    navigator.clipboard?.writeText(snippet).then(() => {
      modal.querySelector(".powerup-modal-copy").textContent = "Copied!";
      setTimeout(() => { if (modal.isConnected) modal.querySelector(".powerup-modal-copy").textContent = "Copy Snippet"; }, 2000);
    });
  });
}

function showClickIdInfoModal() {
  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>Click ID Restorer — How It Works</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">When a visitor lands on your site with a click ID in the URL (e.g. <code>?fbclid=...</code>), your nginx container automatically captures and stores it in a <strong>90-day first-party cookie</strong>.</p>
      <ul class="powerup-modal-list">
        <li>✓ <code>fbclid</code> → stored as <code>tagioo_fbclid</code> cookie</li>
        <li>✓ <code>gclid</code> → stored as <code>tagioo_gclid</code> cookie</li>
        <li>✓ <code>ttclid</code> → stored as <code>tagioo_ttclid</code> cookie</li>
        <li>✓ <code>msclkid</code> → stored as <code>tagioo_msclkid</code> cookie</li>
      </ul>
      <p class="powerup-modal-desc">On every subsequent tracking request, nginx passes these stored IDs to your sGTM container as <code>X-FB-Click-ID</code>, <code>X-GCL-Click-ID</code>, and <code>X-TT-Click-ID</code> request headers. Your GTM server variable can read them for conversion attribution.</p>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function showCookieKeeperInfoModal() {
  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>Cookie Keeper — How It Works</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">Safari and iOS browsers limit JavaScript-set cookies to <strong>7 days</strong>. Cookie Keeper renews analytics cookies via <strong>HTTP Set-Cookie headers</strong> on every tracking response — extending them to <strong>400 days</strong>.</p>
      <ul class="powerup-modal-list">
        <li>✓ <code>_ga</code> → renewed (400 days, SameSite=Lax)</li>
        <li>✓ <code>_fbp</code> → renewed (400 days, SameSite=None)</li>
        <li>✓ <code>_gcl_aw</code> → renewed (400 days)</li>
        <li>✓ <code>_ttp</code> → renewed (400 days)</li>
        <li>✓ <code>_gcl_gb</code> → renewed (400 days)</li>
      </ul>
      <p class="powerup-modal-desc">Cookies are only renewed if they already exist — no new cookies are created. Renewal happens at nginx level before the response reaches the browser.</p>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function showBotDetectionInfoModal() {
  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>Bot Detection — How It Works</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">nginx matches every request's User-Agent against known bot and crawler patterns, then forwards <code>X-Tagioo-Bot: 1</code> to your sGTM container for non-human traffic.</p>
      <ul class="powerup-modal-list">
        <li>✓ Detects crawlers: Googlebot, bingbot, AhrefsBot, SemrushBot, and more</li>
        <li>✓ Detects automation: curl, wget, Python requests, headless browsers</li>
        <li>✓ Human traffic gets <code>X-Tagioo-Bot: 0</code> — safe to use as a condition</li>
      </ul>
      <p class="powerup-modal-desc"><strong>How to use in sGTM:</strong> Create a "Request Header" variable for <code>X-Tagioo-Bot</code>. Add a trigger exception to your Google Ads and Meta conversion tags that fires only when this variable equals <code>0</code>. Bot clicks will stop inflating your conversion counts — your ROAS improves because ad platforms bid on real buyers.</p>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function showGeoHeadersInfoModal() {
  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>GEO Headers — How It Works</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">On every tracking request, nginx injects the visitor's country and IP into request headers forwarded to your sGTM container — no extra API calls needed.</p>
      <ul class="powerup-modal-list">
        <li>✓ <code>X-Tagioo-Country</code> → ISO country code (e.g. <code>BD</code>, <code>US</code>, <code>GB</code>) via Cloudflare</li>
        <li>✓ <code>X-Tagioo-Client-IP</code> → real visitor IP for geo lookup in sGTM when no CDN</li>
      </ul>
      <p class="powerup-modal-desc"><strong>How to use in sGTM:</strong> Create "Request Header" variables for <code>X-Tagioo-Country</code> and <code>X-Tagioo-Client-IP</code>. Use the country as a custom GA4 dimension, a trigger condition for country-specific conversion events, or to send region data to Meta CAPI for better audience matching and geo-targeted ROAS reporting.</p>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function showUserAgentInfoModal() {
  const modal = document.createElement("div");
  modal.className = "powerup-modal-overlay";
  modal.innerHTML = `
    <div class="powerup-modal">
      <div class="powerup-modal-header">
        <h3>User Agent Info — How It Works</h3>
        <button class="powerup-modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="powerup-modal-desc">nginx classifies every visitor's device and forwards both the device type and raw User-Agent string to sGTM as request headers — available instantly without client-side JavaScript.</p>
      <ul class="powerup-modal-list">
        <li>✓ <code>X-Tagioo-Device</code> → <code>mobile</code>, <code>tablet</code>, or <code>desktop</code></li>
        <li>✓ <code>X-Tagioo-UA</code> → full User-Agent string for browser/OS parsing in sGTM</li>
      </ul>
      <p class="powerup-modal-desc"><strong>How to use in sGTM:</strong> Create "Request Header" variables for <code>X-Tagioo-Device</code> and <code>X-Tagioo-UA</code>. Send device type as a GA4 custom dimension to segment conversion reports by device. Use it as a trigger condition to fire mobile-specific tags, or pass it to Meta CAPI as device context to improve audience targeting and lower CPA on mobile campaigns.</p>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".powerup-modal-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

async function renderPowerUps(data) {
  if (!els.powerUpsGrid) return;

  // Fetch server power-up status once per session (all roles)
  if (!powerUpsStatusFetched) {
    await fetchPowerUpsStatus();
  }

  const planName = data.usage?.plan || "Starter";
  const categories = ["All", ...new Set(powerUps.map((item) => item.category))];
  const visiblePowerUps = activePowerUpCategory === "All"
    ? powerUps
    : powerUps.filter((item) => item.category === activePowerUpCategory);
  const activeCount = powerUps.filter((item) => {
    const s = powerUpState(item, planName);
    return s === "enabled" || s === "active";
  }).length;

  if (els.powerUpsBadge) {
    els.powerUpsBadge.className = `badge ${powerUpsServerEnabled ? "ok" : "warn"}`;
    els.powerUpsBadge.textContent = powerUpsServerEnabled ? `${activeCount} active` : "Init required";
  }

  // Owner init banner
  const isOwner = currentSession.role === "owner";
  const initBanner = isOwner && !powerUpsServerEnabled
    ? `<div class="powerups-init-banner">
        <div>
          <strong>Power-Ups need one-time setup.</strong>
          <span>Writes a shared nginx maps file (<code>/etc/nginx/conf.d/tagioo-powerups-maps.conf</code>) then reloads nginx. Run once, affects all containers.</span>
        </div>
        <div class="powerups-init-actions">
          <button class="button button-primary" type="button" id="powerUpsInitBtn">Initialize Power-Ups</button>
        </div>
      </div>`
    : isOwner && powerUpsServerEnabled
      ? `<div class="powerups-init-banner ok">
          <span>✓ Power-Ups active. New containers get all features automatically.</span>
          <button class="button" type="button" id="powerUpsRegenBtn">Regen nginx for existing containers</button>
        </div>`
      : "";

  if (els.powerUpsFilters) {
    els.powerUpsFilters.innerHTML = categories.map((category) => {
      const count = category === "All" ? powerUps.length : powerUps.filter((item) => item.category === category).length;
      return `<button class="powerups-filter ${category === activePowerUpCategory ? "is-active" : ""}" type="button" data-powerup-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
        <strong>${count}</strong>
      </button>`;
    }).join("");
    els.powerUpsFilters.querySelectorAll("[data-powerup-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activePowerUpCategory = button.dataset.powerupCategory || "All";
        renderPowerUps(latestData || data);
      });
    });
  }

  els.powerUpsGrid.innerHTML = initBanner + visiblePowerUps.map((item) => {
    const state = powerUpState(item, planName);
    const recommended = item.recommended ? `<span class="powerup-recommended">Recommended</span>` : "";
    const btnClass = state === "upgrade" ? "button-primary"
      : state === "needs-init" ? "button-warn"
      : state === "active" ? "button-active"
      : "";
    return `<article class="powerup-card ${state}">
      <div class="powerup-icon" aria-hidden="true">${escapeHtml(item.icon)}</div>
      <div class="powerup-copy">
        <div class="powerup-title-row">
          <h3>${escapeHtml(item.name)}</h3>
          ${recommended}
        </div>
        <p>${escapeHtml(item.description)}</p>
        <span>${escapeHtml(item.category)} · ${escapeHtml(item.minimumPlan)}+</span>
      </div>
      <button class="button ${btnClass}" type="button" data-powerup-action="${escapeHtml(item.id)}" data-powerup-state="${state}">
        ${powerUpActionLabel(state, isOwner)}
      </button>
    </article>`;
  }).join("");

  // Init / Regen banner buttons
  const initBtn = document.getElementById("powerUpsInitBtn");
  if (initBtn) initBtn.addEventListener("click", () => triggerPowerUpsInit(data));
  const regenBtn = document.getElementById("powerUpsRegenBtn");
  if (regenBtn) regenBtn.addEventListener("click", () => triggerRegenNginx(data));

  // Power-up card action buttons
  const trackingDomain = (data.containerSetup?.trackingDomain || data.customerSetup?.requests?.[0]?.trackingDomain || "");
  els.powerUpsGrid.querySelectorAll("[data-powerup-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = powerUps.find((entry) => entry.id === button.dataset.powerupAction);
      const state = button.dataset.powerupState;
      if (!item) return;
      if (state === "upgrade") { setView("billing"); return; }
      if (state === "needs-init") {
        if (els.powerUpsMessage) {
          els.powerUpsMessage.textContent = isOwner
            ? "Click “Initialize Power-Ups” above to activate this feature."
            : "Contact your Tagioo admin to enable Power-Ups.";
          els.powerUpsMessage.className = "powerups-message warn";
        }
        return;
      }
      if (state === "coming") {
        if (els.powerUpsMessage) {
          els.powerUpsMessage.textContent = `${item.name} is coming soon.`;
          els.powerUpsMessage.className = "powerups-message info";
        }
        return;
      }
      if (item.id === "custom-loader") { showCustomLoaderModal(trackingDomain); return; }
      if (item.id === "click-id-restorer") { showClickIdInfoModal(); return; }
      if (item.id === "cookie-keeper") { showCookieKeeperInfoModal(); return; }
      if (item.id === "bot-detection") { showBotDetectionInfoModal(); return; }
      if (item.id === "geo-headers") { showGeoHeadersInfoModal(); return; }
      if (item.id === "user-agent-info") { showUserAgentInfoModal(); return; }
      if (els.powerUpsMessage) {
        els.powerUpsMessage.textContent = `${item.name} is ${state === "active" || state === "enabled" ? "active on your container" : "configurable in settings"}.`;
        els.powerUpsMessage.className = "powerups-message info";
      }
    });
  });
}

function renderSetupAssistant(data) {
  if (!els.setupAssistantForm) return;
  const latest = (data.customerSetup?.requests || [])
    .filter((request) => !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase()))
    .at(0);
  const trackingDomainInput = els.setupAssistantForm.elements.trackingDomain;
  if (trackingDomainInput && !trackingDomainInput.value && latest?.trackingDomain) {
    trackingDomainInput.value = `https://${latest.trackingDomain}`;
  }
  const wooUrlEl = document.querySelector("[data-woo-webhook-url]");
  if (wooUrlEl) {
    const base = (data.config?.publicBaseUrl || window.location.origin).replace(/\/$/, "");
    const tenantId = data.session?.tenantId || currentSession.tenantId || "";
    wooUrlEl.textContent = `${base}/api/orders/woocommerce${tenantId ? `?tenant=${tenantId}` : ""}`;
  }
  const wooDomainEl = document.querySelector("[data-woo-tracking-domain]");
  if (wooDomainEl) {
    const domain = latest?.trackingDomain || data.config?.tenantDomain || data.config?.sslDomain || "your tracking domain";
    wooDomainEl.textContent = domain;
  }
  setWooWebhookSecret(data.webhookSecret || "");
  if (data.tracking?.lastVerify) renderVerifyResult(data.tracking.lastVerify);
  updateSetupAssistantStep();
}

function setWooWebhookSecret(secret) {
  const secretEl = document.querySelector("[data-woo-webhook-secret]");
  const copyButton = document.querySelector("#copyWooSecret");
  const generateButton = document.querySelector("#generateWooSecret");
  if (!secretEl) return;
  secretEl.dataset.secret = secret || "";
  secretEl.textContent = secret || "click “Generate secret” below";
  if (copyButton) copyButton.hidden = !secret;
  if (generateButton) generateButton.textContent = secret ? "Regenerate secret" : "Generate secret";
}

let prevAssistantStep = 1;
function updateSetupAssistantStep() {
  const direction = setupAssistantStep > prevAssistantStep ? "forward" : "back";
  document.querySelectorAll("[data-assistant-step-label]").forEach((item) => {
    const step = Number(item.dataset.assistantStepLabel);
    item.classList.toggle("is-active", step === setupAssistantStep);
    item.classList.toggle("is-complete", step < setupAssistantStep);
  });
  document.querySelectorAll("[data-assistant-step]").forEach((panel) => {
    const isActive = Number(panel.dataset.assistantStep) === setupAssistantStep;
    panel.classList.remove("is-active", "slide-forward", "slide-back");
    if (isActive) {
      panel.classList.add("is-active", direction === "forward" ? "slide-forward" : "slide-back");
    }
  });
  if (els.assistantBack) els.assistantBack.disabled = setupAssistantStep === 1;
  if (els.assistantNext) els.assistantNext.textContent = setupAssistantStep === 4 ? "Generate templates" : "Next";
  if (els.setupAssistantBadge) {
    els.setupAssistantBadge.textContent = `Step ${setupAssistantStep} of 4`;
  }
  prevAssistantStep = setupAssistantStep;
}

function setupAssistantPayload() {
  const form = els.setupAssistantForm;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.destinations = [...form.querySelectorAll("input[name='destinations']:checked")].map((input) => input.value);
  return payload;
}

async function generateSetupAssistantTemplates() {
  if (!els.setupAssistantForm) return;
  if (els.setupAssistantResult) els.setupAssistantResult.textContent = "Generating Tagioo GTM templates...";
  try {
    const response = await fetch("/api/customer/setup-assistant/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(setupAssistantPayload())
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Template generation failed."]).join(" "));
    generatedAssistantTemplates = result;
    if (els.downloadWebTemplate) els.downloadWebTemplate.disabled = false;
    if (els.downloadServerTemplate) els.downloadServerTemplate.disabled = false;
    if (els.setupAssistantResult) {
      const warnings = (result.warnings || []).join(" ");
      els.setupAssistantResult.textContent = `Templates are ready. ${warnings}`;
    }
  } catch (error) {
    if (els.setupAssistantResult) els.setupAssistantResult.textContent = error.message;
  }
}

function renderVerifyResult(result) {
  const box = els.verifyTrackingResult;
  if (!box) return;
  if (!result || !result.checks) { box.hidden = true; box.innerHTML = ""; return; }
  const row = (label, check) => {
    const ok = check && check.ok;
    return `<div class="verify-row ${ok ? "is-ok" : "is-fail"}">
      <span class="verify-icon">${ok ? "✓" : "✗"}</span>
      <span class="verify-label">${label}</span>
      <span class="verify-detail">${escapeHtml(check ? check.detail : "Not checked.")}</span>
    </div>`;
  };
  const when = result.at ? new Date(result.at).toLocaleString() : "";
  box.hidden = false;
  box.innerHTML = `
    ${row("sGTM container (live)", result.checks.container)}
    ${row("GA4 forwarding (ID + secret)", result.checks.ga4)}
    ${row("Meta Conversions API", result.checks.meta)}
    <p class="verify-stamp">${result.ok ? "All checks passed." : "Some checks failed — fix the items above and re-run."}${when ? ` · ${when}` : ""}</p>`;
}

async function verifyTracking() {
  const btn = els.verifyTrackingBtn;
  if (btn) { btn.disabled = true; btn.textContent = "Testing…"; }
  if (els.verifyTrackingResult) {
    els.verifyTrackingResult.hidden = false;
    els.verifyTrackingResult.innerHTML = `<p class="verify-stamp">Sending test events to GA4 and Meta…</p>`;
  }
  try {
    const response = await fetch("/api/customer/verify-tracking", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Verification failed.");
    renderVerifyResult(result);
  } catch (error) {
    if (els.verifyTrackingResult) {
      els.verifyTrackingResult.hidden = false;
      els.verifyTrackingResult.innerHTML = `<p class="verify-stamp is-fail">${escapeHtml(error.message)}</p>`;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Run tracking test"; }
  }
}

function downloadGeneratedTemplate(type) {
  const template = generatedAssistantTemplates?.[type];
  if (!template) return;
  const filename = generatedAssistantTemplates.fileNames?.[type] || `tagioo-${type}.json`;
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function customerStatusMeta(status) {
  const normalized = String(status || "requested").toLowerCase();
  if (["complete", "live", "http_live", "ssl_ready"].includes(normalized)) {
    return { label: "Live", className: "healthy", badge: "Live" };
  }
  if (normalized.includes("dns")) return { label: "DNS pending", className: "warning", badge: "DNS" };
  if (normalized.includes("docker")) return { label: "Launch issue", className: "error", badge: "Docker" };
  if (normalized.includes("nginx")) return { label: "Routing issue", className: "error", badge: "Nginx" };
  if (normalized.includes("certbot") || normalized.includes("ssl")) return { label: "SSL issue", className: "error", badge: "SSL" };
  if (normalized.includes("failed") || normalized.includes("error")) return { label: "Needs attention", className: "error", badge: "Issue" };
  if (normalized.includes("delete")) return { label: "Deleting", className: "warning", badge: "Deleting" };
  if (normalized.includes("launch")) {
    return { label: "Launching", className: "warning", badge: "Launching" };
  }
  return { label: "Requested", className: "warning", badge: "Setup" };
}

function customerNextStep(request, dnsTarget) {
  if (!request) {
    return {
      badge: "Create",
      label: "Create a container",
      value: "Add your website URL, tracking subdomain, and GTM server container config.",
      status: "warning"
    };
  }
  const meta = customerStatusMeta(request.status);
  if (meta.className === "healthy") {
    return {
      badge: "Live",
      label: "Container is live",
      value: "Check Events and Billing to monitor usage.",
      status: "healthy"
    };
  }
  if (meta.label === "DNS pending") {
    return {
      badge: "DNS",
      label: "Point DNS",
      value: `Create CNAME ${request.trackingDomain || "server.yourdomain.com"} -> ${dnsTarget}.`,
      status: "warning"
    };
  }
  if (meta.className === "error") {
    if (meta.badge === "Docker") {
      return {
        badge: "Issue",
        label: "Tagioo launch check",
        value: "The tracking domain is set, but the VPS could not start the Docker container. No customer action is needed right now.",
        status: "warning"
      };
    }
    return {
      badge: "Issue",
      label: "Contact support",
      value: "The automatic launch hit an infrastructure error. We need to review the container request.",
      status: "warning"
    };
  }
  return {
    badge: "Launching",
    label: "Wait for launch",
    value: "Tagioo is creating Docker, Nginx, and SSL for your container.",
    status: "warning"
  };
}

function customerContainerCard(request, options = {}) {
  const status = String(request.status || "requested");
  const meta = customerStatusMeta(status);
  const canDelete = !["deleted", "delete_requested"].includes(status);
  const compact = Boolean(options.compact);
  const limits = request.resourceLimits || {};
  const configStatus = request.containerConfig ? "Configured" : "Missing";
  const serverContainerId = request.sgtmContainerId || "GTM server ID unavailable";
  const previewEnvironment = request.previewEnvironment || "Production";
  return `
    <article class="customer-container-card ${compact ? "compact" : ""}">
      <div class="customer-container-top">
        <div>
          <span class="state ${meta.className}">${escapeHtml(meta.label)}</span>
          <h3>${escapeHtml(request.containerName || request.tenantName || "sGTM Container")}</h3>
          <p>${escapeHtml(request.websiteUrl || "Website not set")}</p>
        </div>
        <span class="container-type-pill">${escapeHtml(request.containerType || "sGTM")}</span>
      </div>
      <div class="customer-container-meta">
        <div>
          <span>Tracking domain</span>
          <strong>${escapeHtml(request.trackingDomain || "--")}</strong>
        </div>
        <div>
          <span>Server</span>
          <strong>${escapeHtml(request.serverLocation || "Bangladesh BDIX")}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>${escapeHtml(formatShortDate(request.createdAt) || "--")}</strong>
        </div>
      </div>
      ${compact ? "" : `<div class="container-settings-grid">
        <div>
          <span>Container Config</span>
          <strong>${escapeHtml(configStatus)}</strong>
        </div>
        <div>
          <span>sGTM Container ID</span>
          <strong>${escapeHtml(serverContainerId)}</strong>
        </div>
        <div>
          <span>Preview Environment</span>
          <strong>${escapeHtml(previewEnvironment)}</strong>
        </div>
        <div>
          <span>Worker</span>
          <strong>${escapeHtml(request.workerName || request.workerId || "Auto-assigned")}</strong>
        </div>
        <div>
          <span>Request Limit</span>
          <strong>${escapeHtml(limits.monthlyRequestLimit ? Number(limits.monthlyRequestLimit).toLocaleString() : "Plan default")}</strong>
        </div>
        <div>
          <span>Resource Limit</span>
          <strong>${escapeHtml(limits.memoryMb ? `${limits.memoryMb} MB · ${limits.cpuLimit || "CPU default"}` : "Plan default")}</strong>
        </div>
      </div>`}
      ${compact ? "" : `<div class="customer-container-actions">
        <span>${escapeHtml(request.notes || "Managed server-side tracking")}</span>
        ${canDelete ? `<button class="button button-danger" type="button" data-container-delete="${escapeHtml(request.id)}">Delete</button>` : ""}
      </div>`}
    </article>
  `;
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
  els.reconciliationBadge.textContent = rec.status === "healthy"
    ? "Matched"
    : rec.status === "overtracked"
      ? "Overtracked"
      : rec.status === "undertracked"
        ? "Missing tracking"
        : rec.status === "waiting" ? "Waiting" : "Needs review";
  const coverageDetail = Number(rec.missing || 0)
    ? `${Number(rec.missing || 0).toLocaleString()} order(s) not seen in SGTM purchases`
    : Number(rec.extraTracked || 0)
      ? `${Number(rec.extraTracked || 0).toLocaleString()} extra tracked purchase(s) beyond store orders`
      : "Store and SGTM purchases match";
  renderBusinessGrid(els.reconciliationGrid, [
    {
      label: "Actual store orders",
      value: Number(rec.storeOrders || 0).toLocaleString(),
      detail: "From ecommerce order webhook"
    },
    {
      label: "Deduped tracked purchases",
      value: Number(rec.trackedUnique || 0).toLocaleString(),
      detail: "Unique/estimated purchases from SGTM logs"
    },
    {
      label: "Tracked purchase hits",
      value: Number(rec.trackedHits || 0).toLocaleString(),
      detail: `${Number(rec.duplicateHits || 0).toLocaleString()} extra platform/tag copies`
    },
    {
      label: "Tracking coverage",
      value: `${Number(rec.coverage || 0).toLocaleString()}%`,
      detail: coverageDetail
    }
  ]);
}

function renderDashboard(data) {
  renderCustomerSetup(data);
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
  const isOwner = currentSession.role === "owner" || currentSession.role !== "customer";
  if (isOwner) {
    renderOwnerHome(data);
  } else {
    renderEventHealth(data);
    renderCustomerAlerts(data);
  }
  // Always render these for JS refs (elements may be hidden)
  renderAlerts(data);
  renderHostBreakdown(data);
  renderQualityChecks(data);
  renderNoiseSummary(data);
  renderLatestPurchase(data);
  renderBusinessSnapshot(data);
  renderReconciliation(data);
}

function renderCustomerAlerts(data) {
  if (!els.alertBadgeCustomer || !els.alertListCustomer) return;
  const alerts = collectAlerts(data);
  const hasError = alerts.some((a) => a.status === "error");
  els.alertBadgeCustomer.className = "badge";
  els.alertBadgeCustomer.classList.add(hasError ? "danger" : alerts.length ? "warn" : "ok");
  els.alertBadgeCustomer.textContent = alerts.length ? `${alerts.length} issue${alerts.length === 1 ? "" : "s"}` : "Clear";
  renderSummaryList(
    els.alertListCustomer,
    alerts.length ? alerts : [{ label: "Tracking health", value: "No immediate issues", status: "healthy" }]
  );
}

function renderVpsHealth(data) {
  const sys = data.system || {};
  const docker = data.docker || {};
  const ssl = data.ssl || {};
  const totals = docker.totals || {};

  if (els.vpsHealthGrid) {
    const memLabel = sys.memTotalMb
      ? `${sys.memUsedMb || 0} / ${sys.memTotalMb} MB (${sys.memPercent || 0}%)`
      : "Unavailable";
    const diskLabel = sys.diskTotalMb
      ? `${sys.diskUsedMb || 0} / ${sys.diskTotalMb} MB (${sys.diskPercent || 0}%)`
      : "Unavailable";
    const loadLabel = sys.load1 !== null && sys.load1 !== undefined
      ? `${sys.load1} (1m) / ${sys.load5} (5m)`
      : "Unavailable";
    const memStatus = sys.memPercent > 90 ? "error" : sys.memPercent > 75 ? "warning" : "healthy";
    const diskStatus = sys.diskPercent > 90 ? "error" : sys.diskPercent > 80 ? "warning" : "healthy";
    const loadStatus = sys.load1 > 4 ? "warning" : "healthy";
    renderSummaryList(els.vpsHealthGrid, [
      { label: "Memory", value: memLabel, status: sys.available ? memStatus : "warning" },
      { label: "Disk", value: diskLabel, status: sys.available ? diskStatus : "warning" },
      { label: "CPU load", value: loadLabel, status: sys.available ? loadStatus : "warning" },
      { label: "Uptime", value: sys.uptimeLabel || "Unavailable", status: "healthy" }
    ]);
    if (els.vpsHealthBadge) {
      const bad = (sys.memPercent > 90) || (sys.diskPercent > 90);
      els.vpsHealthBadge.className = `badge ${!sys.available ? "warn" : bad ? "danger" : "ok"}`;
      els.vpsHealthBadge.textContent = !sys.available ? "No data" : bad ? "Attention" : "Healthy";
    }
  }

  if (els.infraStatusList) {
    const unhealthy = Number(totals.unhealthy || 0);
    const sslDays = Number(ssl.daysRemaining || 0);
    renderSummaryList(els.infraStatusList, [
      { label: "Docker", value: docker.available ? "Connected" : "Unavailable", status: docker.available ? "healthy" : "error" },
      { label: "Containers running", value: `${Number(totals.running || 0)} / ${Number(totals.total || 0)} total`, status: unhealthy ? "warning" : "healthy" },
      { label: "Unhealthy containers", value: unhealthy.toLocaleString(), status: unhealthy ? "error" : "healthy" },
      { label: "SSL", value: ssl.available ? `${sslDays} days remaining` : "Not configured", status: ssl.available && sslDays > 14 ? "healthy" : "warning" },
      { label: "Nginx access log", value: data.nginx?.accessLog?.available ? "Readable" : "Unavailable", status: data.nginx?.accessLog?.available ? "healthy" : "warning" }
    ]);
    if (els.infraStatusBadge) {
      els.infraStatusBadge.className = `badge ${unhealthy ? "danger" : "ok"}`;
      els.infraStatusBadge.textContent = unhealthy ? `${unhealthy} unhealthy` : "All healthy";
    }
  }
}

function renderOwnerHome(data) {
  const owner = data.owner || {};
  const metrics = owner.metrics || {};
  const customers = owner.customers || [];
  const currency = owner.currency || "BDT";

  if (els.ownerHomeMetrics) {
    renderMetricCards(els.ownerHomeMetrics, [
      { label: "Total customers", value: Number(metrics.totalCustomers || 0).toLocaleString(), detail: `${Number(metrics.activeCustomers || 0)} active · ${Number(metrics.trialCustomers || 0)} trial` },
      { label: "Total containers", value: Number(metrics.totalCustomerContainers || 0).toLocaleString(), detail: `${Number(metrics.pendingCustomerContainers || 0)} pending launch` },
      { label: "Requests this month", value: Number(metrics.requestsMonth || 0).toLocaleString(), detail: `${Number(metrics.requestsToday || 0).toLocaleString()} today across all customers` },
      { label: "MRR", value: formatMoney(metrics.mrr || 0, currency), detail: `${Number(metrics.healthySubscriptions || 0)} paid subscriptions` },
      { label: "Payment issues", value: Number(metrics.overdueCustomers || 0).toLocaleString(), detail: `${Number(metrics.cancelledCustomers || 0)} cancelled` },
      { label: "Launch failures", value: Number(metrics.failedLaunches || 0).toLocaleString(), detail: `${Number(metrics.dnsPendingContainers || 0)} DNS pending` }
    ]);
  }

  if (els.ownerHomeBadge) {
    els.ownerHomeBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
    els.ownerHomeBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;
  }

  if (els.ownerHomeCustomerTable) {
    if (!customers.length) {
      els.ownerHomeCustomerTable.innerHTML = '<tr><td colspan="6">No customers yet. Use Provisioning to add one.</td></tr>';
    } else {
      els.ownerHomeCustomerTable.innerHTML = customers.map((customer) => {
        const containers = customer.customerContainers || [];
        const usagePercent = Number(customer.usagePercent || 0);
        const subStatus = String(customer.subscriptionStatus || "unknown");
        const subClass = lifecycleStatusClass(subStatus);
        const containerNames = containers.length
          ? containers.map((c) => escapeHtml(c.name || c.domain || "container")).join(", ")
          : "None";
        return `<tr>
          <td>
            <strong>${escapeHtml(customer.name || customer.id)}</strong>
            <span class="owner-subtext">${escapeHtml(customer.id || "")}</span>
          </td>
          <td>
            <strong>${escapeHtml(customer.plan || "No plan")}</strong>
            <span class="owner-subtext">${statusPill(subStatus.replaceAll("_", " "), subClass)}</span>
          </td>
          <td>
            <strong>${containers.length}</strong>
            <span class="owner-subtext">${containerNames}</span>
          </td>
          <td>
            <strong>${Number(customer.requestsMonth || 0).toLocaleString()}</strong>
            <span class="owner-subtext">${usagePercent}% of ${Number(customer.requestLimit || 0).toLocaleString()}</span>
          </td>
          <td><strong>${Number(customer.requestsToday || 0).toLocaleString()}</strong></td>
          <td>${statusPill(subStatus.replaceAll("_", " "), subClass)}</td>
        </tr>`;
      }).join("");
    }
  }

  renderVpsHealth(data);

  const alerts = collectAlerts(data);
  const hasError = alerts.some((a) => a.status === "error");
  if (els.alertBadge) {
    els.alertBadge.className = "badge";
    els.alertBadge.classList.add(hasError ? "danger" : alerts.length ? "warn" : "ok");
    els.alertBadge.textContent = alerts.length ? `${alerts.length} issue${alerts.length === 1 ? "" : "s"}` : "Clear";
  }
  if (els.alertList) {
    renderSummaryList(
      els.alertList,
      alerts.length ? alerts : [{ label: "System health", value: "No immediate issues", status: "healthy" }]
    );
  }
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

function renderAllCustomersAnalytics(data) {
  const owner = data.owner || {};
  const metrics = owner.metrics || {};
  const customers = owner.customers || [];
  const currency = owner.currency || "BDT";
  const totalToday = Number(metrics.requestsToday || 0);
  const totalMonth = Number(metrics.requestsMonth || 0);

  if (els.allCustomersBadge) {
    els.allCustomersBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
    els.allCustomersBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;
  }
  if (els.allCustomersMetrics) {
    renderMetricCards(els.allCustomersMetrics, [
      { label: "Total requests today", value: totalToday.toLocaleString(), detail: "Across all customer containers" },
      { label: "Total requests this month", value: totalMonth.toLocaleString(), detail: "All customers combined" },
      { label: "Total customers", value: Number(metrics.totalCustomers || 0).toLocaleString(), detail: `${Number(metrics.activeCustomers || 0)} active` },
      { label: "MRR", value: formatMoney(metrics.mrr || 0, currency), detail: `${Number(metrics.healthySubscriptions || 0)} paying` }
    ]);
  }
  if (els.allCustomersTable) {
    if (!customers.length) {
      els.allCustomersTable.innerHTML = '<tr><td colspan="6">No customers yet.</td></tr>';
    } else {
      els.allCustomersTable.innerHTML = customers.map((customer) => {
        const containers = customer.customerContainers || [];
        const usagePercent = Number(customer.usagePercent || 0);
        const barWidth = Math.min(100, usagePercent);
        const barColor = usagePercent > 90 ? "#ef4444" : usagePercent > 70 ? "#f59e0b" : "#10b981";
        return `<tr>
          <td>
            <strong>${escapeHtml(customer.name || customer.id)}</strong>
            <span class="owner-subtext">${escapeHtml(customer.id || "")}</span>
          </td>
          <td>${escapeHtml(customer.plan || "No plan")}</td>
          <td><strong>${Number(customer.requestsMonth || 0).toLocaleString()}</strong></td>
          <td><strong>${Number(customer.requestsToday || 0).toLocaleString()}</strong></td>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <div style="flex:1;height:6px;background:var(--color-border);border-radius:3px;overflow:hidden">
                <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:3px"></div>
              </div>
              <span style="font-size:0.8rem;white-space:nowrap">${usagePercent}%</span>
            </div>
          </td>
          <td>${containers.length}</td>
        </tr>`;
      }).join("");
    }
  }
}

function renderAnalytics(data) {
  renderAllCustomersAnalytics(data);
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
  els.analyticsModeBadge.textContent = "Live event logs";
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
    ["LOCAL_WORKER_ID", text(data.config?.localWorkerId, "bdix-worker-1")],
    ["LOCAL_WORKER_NAME", text(data.config?.localWorkerName, "BDIX Worker 1")],
    ["LOCAL_WORKER_REGION", text(data.config?.localWorkerRegion, "Bangladesh BDIX")],
    ["LOCAL_WORKER_MAX_CONTAINERS", text(data.config?.localWorkerMaxContainers, "200")],
    ["DEFAULT_CONTAINER_MEMORY_MB", text(data.config?.defaultContainerMemoryMb, "512")],
    ["DEFAULT_CONTAINER_CPU_LIMIT", text(data.config?.defaultContainerCpuLimit, "0.50")],
    ["AUTO_LAUNCH_ENABLED", text(data.config?.autoLaunchEnabled, "false")],
    ["AUTO_LAUNCH_REQUIRE_DNS", text(data.config?.autoLaunchRequireDns, "true")],
    ["AUTO_LAUNCH_CERTBOT", text(data.config?.autoLaunchCertbot, "false")],
    ["AUTO_LAUNCH_CERTBOT_EMAIL", text(data.config?.autoLaunchCertbotEmail, "optional")],
    ["AUTO_LAUNCH_USE_SUDO", text(data.config?.autoLaunchUseSudo, "false")],
    ["NGINX_LOG_FORMAT", text(data.config?.nginxLogFormat, "default")],
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

function commandLogBlock(label, entries = []) {
  if (!entries.length) return "";
  return `
    <details class="plan-block command-log" open>
      <summary>${escapeHtml(label)}</summary>
      <div class="command-log-list">
        ${entries.slice(-6).map((entry) => {
          const output = [entry.error, entry.stderr, entry.stdout].filter(Boolean).join("\n").trim();
          return `
            <article class="command-log-item">
              <div>
                <strong>${escapeHtml(entry.label || "Command")}</strong>
                <span class="state ${entry.ok ? "healthy" : "error"}">${entry.ok ? "ok" : "failed"}</span>
              </div>
              ${entry.at ? `<small>${escapeHtml(formatShortDate(entry.at))}</small>` : ""}
              ${output ? `<pre><code>${escapeHtml(output)}</code></pre>` : ""}
            </article>
          `;
        }).join("")}
      </div>
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
            <span>${escapeHtml(request.domain)} · ${escapeHtml(request.workerName || "local worker")} · auto port ${escapeHtml(request.port)}</span>
          </div>
          <span class="state warning">${escapeHtml(request.status.replaceAll("_", " "))}</span>
        </div>
        <div class="summary-list compact-list">
          <article class="summary-item"><strong>Worker</strong><span class="state prepared">${escapeHtml(request.workerName || request.workerId || "Local worker")}</span></article>
          <article class="summary-item"><strong>Resource limit</strong><span class="state prepared">${escapeHtml(`${request.resourceLimits?.memoryMb || "--"}MB / ${request.resourceLimits?.cpuLimit || "--"} CPU / ${Number(request.requestLimit || 0).toLocaleString()} requests`)}</span></article>
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
        ${commandLogBlock("Launch log", request.launchLog || [])}
        ${commandLogBlock("Delete log", request.deleteLog || [])}
        ${codeBlock("Admin commands", (plan.commands || []).join("\n"))}
        <div class="button-row">
          <button class="button" type="button" data-provision-launch="${escapeHtml(request.id)}">Launch Now</button>
          <button class="button" type="button" data-provision-prepare="${escapeHtml(request.id)}">Prepare Docker + Nginx Files</button>
        </div>
      `;
      return card;
    })
  );

  els.provisioningRequests.querySelectorAll("[data-provision-launch]").forEach((button) => {
    button.addEventListener("click", () => launchProvisioningRequest(button.dataset.provisionLaunch));
  });

  els.provisioningRequests.querySelectorAll("[data-provision-prepare]").forEach((button) => {
    button.addEventListener("click", () => prepareProvisioningFiles(button.dataset.provisionPrepare));
  });
}

function lifecycleStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (["active", "trial", "healthy", "paid"].includes(value)) return "healthy";
  if (["cancelled", "canceled", "expired", "overdue", "unpaid", "over_limit", "purchase_attention"].includes(value)) return "error";
  return "warning";
}

function renderMetricCards(el, items) {
  el.replaceChildren(
    ...items.map((item) => {
      const card = document.createElement("article");
      card.className = "metric-card";
      card.innerHTML = `
        <span class="metric-label">${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      `;
      return card;
    })
  );
}

function statusPill(label, status) {
  return `<span class="state ${stateClass(status)}">${escapeHtml(label)}</span>`;
}

function trackingStatusLabel(customer) {
  if (customer.brokenPurchaseTracking) return ["Purchase attention", "error"];
  if (customer.noTrackingToday) return ["No tracking today", "warning"];
  return ["Healthy", "healthy"];
}

function renderOwnerDashboard(data) {
  const owner = data.owner || {};
  const metrics = owner.metrics || {};
  const customers = owner.customers || [];
  const infra = owner.infrastructure || {};
  const currency = owner.currency || "BDT";
  const issueCount = (owner.issues || []).filter((issue) => issue.status !== "healthy").length;

  renderMetricCards(els.ownerMetricGrid, [
    { label: "Customers", value: Number(metrics.totalCustomers || 0).toLocaleString(), detail: `${Number(metrics.activeCustomers || 0)} active · ${Number(metrics.trialCustomers || 0)} trial` },
    { label: "MRR", value: formatMoney(metrics.mrr || 0, currency), detail: `${Number(metrics.healthySubscriptions || 0)} paid or good subscriptions` },
    { label: "Containers", value: Number(metrics.totalCustomerContainers || 0).toLocaleString(), detail: `${Number(metrics.pendingCustomerContainers || 0)} waiting for provisioning` },
    { label: "Launch failures", value: Number(metrics.failedLaunches || 0).toLocaleString(), detail: `${Number(metrics.dnsPendingContainers || 0)} DNS pending` },
    { label: "Requests month", value: Number(metrics.requestsMonth || 0).toLocaleString(), detail: `${Number(metrics.requestsToday || 0).toLocaleString()} requests today` },
    { label: "Payment issues", value: Number(metrics.overdueCustomers || 0).toLocaleString(), detail: `${Number(metrics.cancelledCustomers || 0)} cancelled` }
  ]);

  els.ownerWatchBadge.className = `badge ${issueCount ? "warn" : "ok"}`;
  els.ownerWatchBadge.textContent = issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"}` : "Clear";
  renderSummaryList(els.ownerIssueList, owner.issues?.length ? owner.issues : [
    { label: "Owner watchlist", value: "No owner dashboard data yet", status: "warning" }
  ]);

  const unhealthyContainers = Number(infra.unhealthyContainers || 0);
  els.ownerInfraBadge.className = `badge ${unhealthyContainers ? "danger" : "ok"}`;
  els.ownerInfraBadge.textContent = unhealthyContainers ? `${unhealthyContainers} unhealthy` : "Healthy";
  renderSummaryList(els.ownerInfraList, [
    { label: "Docker", value: infra.dockerAvailable ? "Available" : "Unavailable", status: infra.dockerAvailable ? "healthy" : "error" },
    { label: "Containers", value: `${Number(infra.runningContainers || 0).toLocaleString()} running / ${Number(infra.totalContainers || 0).toLocaleString()} total`, status: unhealthyContainers ? "warning" : "healthy" },
    { label: "Worker pool", value: `${Number(infra.workerMetrics?.currentContainers || 0).toLocaleString()} assigned / ${Number(infra.workerMetrics?.totalCapacity || 0).toLocaleString()} capacity`, status: Number(infra.workerMetrics?.failedContainers || 0) ? "warning" : "healthy" },
    { label: "Unhealthy containers", value: unhealthyContainers.toLocaleString(), status: unhealthyContainers ? "error" : "healthy" },
    { label: "SSL", value: infra.sslAvailable ? `${infra.sslDaysRemaining} days remaining` : "Not configured", status: infra.sslAvailable && Number(infra.sslDaysRemaining) > 14 ? "healthy" : "warning" }
  ]);

  els.ownerCustomerBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
  els.ownerCustomerBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;
  if (!customers.length) {
    els.ownerCustomerTable.innerHTML = '<tr><td colspan="7">No customers yet.</td></tr>';
    return;
  }

  els.ownerCustomerTable.innerHTML = customers.map((customer) => {
    const [trackingLabel, trackingStatus] = trackingStatusLabel(customer);
    const usagePercent = Number(customer.usagePercent || 0);
    const containers = customer.customerContainers || [];
    const containerSummary = containers.length
      ? containers.map((container) => `${container.name} (${container.domain || "no domain"} · ${String(container.status || "requested").replaceAll("_", " ")})`).join(" | ")
      : "No containers";
    return `
      <tr>
        <td>
          <strong>${escapeHtml(customer.name || customer.id)}</strong>
          <span class="owner-subtext">${escapeHtml(customer.id || "No tenant id")}</span>
        </td>
        <td>
          ${statusPill(customer.subscriptionStatus || "unknown", lifecycleStatusClass(customer.subscriptionStatus))}
          <span class="owner-subtext">${escapeHtml(customer.plan || "No plan")}${customer.renewalDate ? ` · renews ${escapeHtml(formatShortDate(customer.renewalDate))}` : ""}</span>
        </td>
        <td>
          <strong>${containers.length.toLocaleString()}</strong>
          <span class="owner-subtext">${escapeHtml(containerSummary)}</span>
        </td>
        <td>
          <strong>${Number(customer.requestsMonth || 0).toLocaleString()}</strong>
          <span class="owner-subtext">${usagePercent}% of ${Number(customer.requestLimit || 0).toLocaleString()} · ${Number(customer.requestsToday || 0).toLocaleString()} today</span>
        </td>
        <td>
          ${statusPill(customer.paymentStatus || "unknown", lifecycleStatusClass(customer.paymentStatus))}
          <span class="owner-subtext">${customer.unpaid ? "Needs billing follow-up" : "Payment okay"}</span>
        </td>
        <td>${escapeHtml(formatMoney(customer.monthlyAmount || 0, currency))}</td>
        <td>
          ${statusPill(trackingLabel, trackingStatus)}
          <span class="owner-subtext">${Number(customer.requestsToday || 0).toLocaleString()} requests today${customer.purchaseCoverage !== null ? ` · ${customer.purchaseCoverage}% purchase coverage` : ""}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// ── Owner: Customers management view ────────────────────────────────────────
function renderCustomersView(data) {
  const customers = (data?.owner && data.owner.customers) || [];
  const listEl = document.getElementById("manageCustomersList");
  const searchEl = document.getElementById("manageCustomersSearch");
  if (!listEl) return;

  const q = (searchEl?.value || "").trim().toLowerCase();
  const matched = q
    ? customers.filter((c) => [c.fullName, c.name, c.email, c.phone, c.id, c.plan]
        .some((v) => String(v || "").toLowerCase().includes(q)))
    : customers.slice();

  // Paying customers first, then pending, then trial, then free/other. Within a
  // rank, higher monthly amount first, then name.
  const isPaid = (c) => c.subscriptionStatus === "active" && c.paymentStatus === "paid";
  const rankOf = (c) => isPaid(c) ? 0
    : c.subscriptionStatus === "pending_payment" ? 1
    : c.subscriptionStatus === "trial" ? 2 : 3;
  const filtered = matched.sort((a, b) =>
    rankOf(a) - rankOf(b)
    || Number(b.monthlyAmount || 0) - Number(a.monthlyAmount || 0)
    || String(a.fullName || a.name || a.id).localeCompare(String(b.fullName || b.name || b.id)));

  // Summary: how many are actually paying and the combined monthly revenue.
  const statsEl = document.getElementById("customerStats");
  if (statsEl) {
    const paid = customers.filter(isPaid);
    const mrr = paid.reduce((sum, c) => sum + Number(c.monthlyAmount || 0), 0);
    const free = customers.length - paid.length;
    const stat = (label, value) => `<div class="cstat"><span>${label}</span><strong>${value}</strong></div>`;
    statsEl.innerHTML =
      stat("Paying customers", paid.length.toLocaleString())
      + stat("Monthly revenue", `৳${mrr.toLocaleString()}`)
      + stat("Free / non-paying", free.toLocaleString())
      + stat("Total customers", customers.length.toLocaleString());
  }

  listEl.innerHTML = filtered.length
    ? filtered.map((c) => `
        <button type="button" class="customer-row${c.id === selectedManageCustomerId ? " is-selected" : ""}" data-manage-customer="${escapeHtml(c.id)}">
          <div class="cr-main">
            <strong>${escapeHtml(c.fullName || c.name || c.id)}</strong>
            <span>${escapeHtml(c.email || "no email")}</span>
          </div>
          <div class="cr-meta">
            ${statusPill(c.subscriptionStatus || "unknown", lifecycleStatusClass(c.subscriptionStatus))}
            <span>${escapeHtml(c.plan || "—")}</span>
          </div>
        </button>`).join("")
    : `<div class="customer-detail-empty">No customers match.</div>`;

  listEl.querySelectorAll("[data-manage-customer]").forEach((b) => {
    b.onclick = () => { selectedManageCustomerId = b.dataset.manageCustomer; renderCustomersView(latestData); };
  });

  if (searchEl && !searchEl.dataset.wired) {
    searchEl.dataset.wired = "1";
    searchEl.addEventListener("input", () => renderCustomersView(latestData));
  }

  const detail = customers.find((c) => c.id === selectedManageCustomerId) || null;
  renderCustomerDetail(detail);
}

function renderCustomerDetail(customer) {
  const pane = document.getElementById("manageCustomerDetail");
  if (!pane) return;
  if (!customer) {
    pane.innerHTML = `<div class="customer-detail-empty">Select a customer to view details.</div>`;
    return;
  }
  const c = customer;
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const containers = c.customerContainers || [];
  const info = [
    ["Name", c.fullName || c.name || c.id],
    ["Email", c.email || "—"],
    ["Phone", c.phone || "—"],
    ["Tenant ID", c.id],
    ["Plan", c.plan || "—"],
    ["Status", String(c.subscriptionStatus || "—").replaceAll("_", " ")],
    ["Payment", c.paymentStatus || "—"],
    ["Renews", c.renewalDate ? formatShortDate(c.renewalDate) : "—"],
    ["Monthly", money(c.monthlyAmount)],
    ["Requests (month)", `${Number(c.requestsMonth || 0).toLocaleString()} / ${Number(c.requestLimit || 0).toLocaleString()} (${Number(c.usagePercent || 0)}%)`],
    ["Requests (today)", Number(c.requestsToday || 0).toLocaleString()],
    ["Containers", String(containers.length)]
  ];
  const planOpts = MANAGE_PLANS.map((p) => `<option value="${p}"${p === c.plan ? " selected" : ""}>${p}</option>`).join("");
  const containerRows = containers.length
    ? containers.map((ct) => `
        <div class="cd-container">
          <div><strong>${escapeHtml(ct.name || "container")}</strong>
            <span>${escapeHtml(ct.domain || ct.websiteUrl || "no domain")} · ${escapeHtml(String(ct.status || "requested").replaceAll("_", " "))}</span></div>
          <span class="cd-loc">${escapeHtml(ct.serverLocation || ct.workerName || "")}</span>
        </div>`).join("")
    : `<div class="customer-detail-empty">No containers yet.</div>`;

  pane.innerHTML = `
    <div class="cd-head">
      <div><h3>${escapeHtml(c.fullName || c.name || c.id)}</h3><span>${escapeHtml(c.email || "")}</span></div>
      ${statusPill(c.subscriptionStatus || "unknown", lifecycleStatusClass(c.subscriptionStatus))}
    </div>
    <div class="cd-grid">${info.map(([k, v]) => `<div class="cd-cell"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join("")}</div>
    <div class="cd-actions">
      <label class="cd-plan-label">Change plan
        <select id="cdPlanSelect">${planOpts}</select>
      </label>
      <button class="button button-primary" type="button" id="cdPlanSave">Save plan</button>
      <button class="button button-danger" type="button" id="cdDeleteCustomer">Delete customer</button>
    </div>
    <div id="cdActionMsg" class="cd-msg"></div>
    <h4 class="cd-subhead">Docker containers</h4>
    <div class="cd-containers">${containerRows}</div>`;

  const msg = pane.querySelector("#cdActionMsg");
  pane.querySelector("#cdPlanSave").onclick = async () => {
    const plan = pane.querySelector("#cdPlanSelect").value;
    msg.textContent = "Updating plan…";
    try {
      const r = await fetch(`/api/admin/customers/${encodeURIComponent(c.id)}/plan`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Plan change failed.");
      msg.textContent = `Plan changed to ${plan}. Resizing container if applicable…`;
      await loadDashboard();
      renderCustomersView(latestData);
    } catch (e) { msg.textContent = e.message; }
  };
  pane.querySelector("#cdDeleteCustomer").onclick = async () => {
    if (!window.confirm(`Delete customer "${c.fullName || c.id}" permanently?\n\nThis tears down their containers and removes all their records. This cannot be undone.`)) return;
    msg.textContent = "Deleting customer…";
    try {
      const r = await fetch(`/api/admin/customers/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error((j.errors || [j.error || "Delete failed."]).join(" "));
      selectedManageCustomerId = "";
      await loadDashboard();
      renderCustomersView(latestData);
    } catch (e) { msg.textContent = e.message; }
  };
}

function renderCustomerAccounts(data) {
  const accounts = data.customerAccounts?.accounts || [];
  els.customerAccountsBadge.className = `badge ${accounts.length ? "ok" : "warn"}`;
  els.customerAccountsBadge.textContent = `${accounts.length} login${accounts.length === 1 ? "" : "s"}`;
  if (!accounts.length) {
    renderSummaryList(
      els.customerAccountsList,
      [{ label: "Customer logins", value: "Create the first customer login from the form", status: "warning" }]
    );
    return;
  }

  els.customerAccountsList.innerHTML = accounts.map((account) => `
    <article class="summary-item account-row">
      <div>
        <strong>${escapeHtml(account.fullName || account.tenantName || account.tenantId)}</strong>
        <span>${escapeHtml(account.email || account.username)} · ${escapeHtml(account.phone || "No phone")} · ${escapeHtml(account.country || "No country")}</span>
        <small>${escapeHtml(account.referral || "No source")} · ${escapeHtml(account.status)}${account.lastLoginAt ? ` · last login ${escapeHtml(formatShortDate(account.lastLoginAt))}` : ""}</small>
      </div>
      <button class="button" type="button" data-reset-customer-password="${escapeHtml(account.id)}">Reset Password</button>
    </article>
  `).join("");

  els.customerAccountsList.querySelectorAll("[data-reset-customer-password]").forEach((button) => {
    button.addEventListener("click", () => resetCustomerPassword(button.dataset.resetCustomerPassword));
  });
}

async function resetCustomerPassword(accountId) {
  const password = window.prompt("Enter a new customer password. Minimum 8 characters.");
  if (password === null) return;
  if (password.length < 8) {
    window.alert("Password must be at least 8 characters.");
    return;
  }

  if (els.customerAccountFormMessage) els.customerAccountFormMessage.textContent = "Resetting customer password...";
  try {
    const response = await fetch(`/api/customer-accounts/${encodeURIComponent(accountId)}/password`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Password reset failed"]).join(" "));
    if (els.customerAccountFormMessage) {
      els.customerAccountFormMessage.textContent = `Password reset for ${result.account.username}.`;
    }
    await loadDashboard();
    setView("admin");
  } catch (error) {
    if (els.customerAccountFormMessage) els.customerAccountFormMessage.textContent = error.message;
  }
}

function renderWorkerNodes(data) {
  const workers = data.workers?.nodes || data.owner?.infrastructure?.workers || [];
  const metrics = data.workers?.metrics || data.owner?.infrastructure?.workerMetrics || {};
  els.workerNodesBadge.className = `badge ${workers.length ? "ok" : "warn"}`;
  els.workerNodesBadge.textContent = `${Number(metrics.activeWorkers || 0).toLocaleString()} active / ${workers.length.toLocaleString()} workers`;
  renderSummaryList(
    els.workerNodesList,
    workers.length
      ? workers.map((worker) => ({
        label: worker.name || worker.id,
        value: `${worker.region} · ${worker.role} · ${worker.currentContainers}/${worker.maxContainers} containers · ${worker.capacityPercent}% used · ${worker.memoryReservedMb}MB reserved${worker.failedContainers ? ` · ${worker.failedContainers} failed` : ""}`,
        status: worker.health === "healthy" ? "healthy" : worker.health === "full" ? "warning" : "error"
      }))
      : [{ label: "Worker pool", value: "No workers configured", status: "warning" }]
  );
}

function renderAdmin(data) {
  renderOwnerDashboard(data);
  renderCustomerAccounts(data);
  renderWorkerNodes(data);
  loadOwnerPayments();
  loadPaymentSettings();
  loadBackups();
  const customers = data.owner?.customers || data.customers?.tenants || [];
  els.adminBadge.textContent = customers.length ? `${customers.length} tenant${customers.length === 1 ? "" : "s"}` : "No tenants";
  els.customersBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
  els.customersBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;

  renderSummaryList(
    els.customersList,
    customers.length
      ? customers.map((customer) => {
        const offline = customer.offlineUploads30d
          ? `Offline ${customer.offlineEventsSent30d || 0} sent/30d${customer.offlineLastStatus === "error" ? " ⚠" : ""}`
          : "Offline none";
        const cookie = customer.cookieExtensionEnabled ? `Cookie ${customer.cookieExtensionDays}d` : "Cookie default";
        return {
          label: customer.name || customer.id,
          value: `${customer.domain || "No domain"} · ${customer.plan || "No plan"} · ${String(customer.subscriptionStatus || customer.status || "unknown").replaceAll("_", " ")} · ${offline} · ${cookie}`,
          status: customer.subscriptionStatus === "active" && !customer.unpaid ? "healthy" : "warning"
        };
      })
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
      title: "WooCommerce / WordPress (no plugin)",
      body: `WooCommerce → Settings → Advanced → Webhooks → Add webhook\nTopic: Order created\nDelivery URL: https://<panel-domain>/api/orders/woocommerce\nSecret: <ORDER_WEBHOOK_SECRET>\n\nThe panel verifies x-wc-webhook-signature and maps id, total, currency, date_created_gmt automatically.`
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

function planFeatureList(features) {
  return `<ul class="subscription-feature-list">${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>`;
}

function formatPlanPrice(plan) {
  return plan.price === "Free" ? "Free" : plan.price;
}

function cyclePrice(plan, cycle) {
  if (plan.price === "Free") return { total: 0, monthly: 0, original: 0, saved: 0 };
  const monthly = Number(String(plan.price).replace(/[^\d]/g, ""));
  const original = monthly * cycle.months;
  const total = Math.round(original * (1 - cycle.discount));
  return { total, monthly: Math.round(total / cycle.months), original, saved: original - total };
}

function formatCyclePrice(plan, cycle) {
  if (plan.price === "Free") return "Free";
  const { total, monthly } = cyclePrice(plan, cycle);
  if (cycle.months === 1) return `৳${monthly.toLocaleString()}`;
  return `৳${total.toLocaleString()}`;
}

function renewalText(value) {
  if (!value) return "Renews monthly";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `Renews ${value}`;
  const daysLeft = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
  return `Valid until ${new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric" }).format(date)} (${daysLeft} days left)`;
}

function renderBilling(data) {
  const usage = data.usage || {};
  const activePlanName = usage.plan || "Starter";
  const activePlan = subscriptionPlans.find((plan) => plan.name === activePlanName) || subscriptionPlans[1];
  const requestsMonth = Number(usage.requestsMonth || 0);
  const requestLimit = Number(usage.requestLimit || activePlan.requests || 0);
  const usagePercent = requestLimit ? Math.min(100, Math.round((requestsMonth / requestLimit) * 1000) / 10) : 0;
  const containersUsed = (data.customerSetup?.requests || []).filter((request) => !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase())).length;
  const statusClass = usage.status === "healthy" ? "ok" : usage.status === "unmetered" ? "ok" : "warn";
  if (els.billingBadge) els.billingBadge.textContent = usage.status === "over_limit" ? "Over limit" : usage.status === "warning" ? "Watch usage" : "Healthy";
  if (els.planBadge) { els.planBadge.className = `badge ${statusClass}`; els.planBadge.textContent = activePlanName; }

  const heroCard = document.getElementById("billingHeroCard");
  if (heroCard) {
    const planGradient = { Free: "hero-free", Starter: "hero-starter", Pro: "hero-pro", Enterprise: "hero-enterprise" };
    heroCard.className = `billing-hero-card ${planGradient[activePlanName] || "hero-starter"}`;
    heroCard.innerHTML = `
      <div class="bhc-left">
        <span class="bhc-badge">${escapeHtml(activePlanName)}</span>
        <strong class="bhc-price">${formatPlanPrice(activePlan)}<small>/month</small></strong>
        <span class="bhc-metric">${activePlan.requests.toLocaleString()} events/month</span>
      </div>
      <div class="bhc-right">
        <span class="bhc-status">${escapeHtml(String(usage.subscriptionStatus || "active").replaceAll("_", " "))}</span>
        <span class="bhc-renewal">${escapeHtml(renewalText(usage.renewalDate))}</span>
      </div>
    `;
  }

  els.packageGrid.innerHTML = `
    <div class="usage-progress-row">
      <div>
        <span>Events</span>
        <strong>${requestsMonth.toLocaleString()} / ${requestLimit.toLocaleString()}</strong>
      </div>
      <div class="usage-progress"><span style="width:${usagePercent}%"></span></div>
      <small>${usagePercent}% used</small>
    </div>
    <div class="subscription-usage-list">
      <div><span>Containers</span><strong>${containersUsed} / ${Number(usage.containerLimit || activePlan.containers).toLocaleString()}</strong></div>
      <div><span>Domains</span><strong>${activePlan.domains} / ${activePlan.domains}</strong></div>
      <div><span>Receivers per Container</span><strong>${activePlan.receivers}</strong></div>
      <div><span>Requests today</span><strong>${Number(usage.requestsToday || 0).toLocaleString()}</strong></div>
      <div><span>Billing period</span><strong>${escapeHtml(String(usage.period || "Current 30 days"))}</strong></div>
    </div>
  `;

  if (els.subscriptionPlans) {
    renderPlanCards(activePlanName);
  }
  const sectionTitle = document.getElementById("planSectionTitle");
  if (sectionTitle) sectionTitle.textContent = activePlanName === "Free" ? "Choose a Plan" : "Change Plan";
  document.querySelectorAll("[data-plan-action]").forEach((button) => {
    button.onclick = () => selectSubscriptionPlan(button.dataset.planAction);
  });
  loadBillingPayment();
}

function renderPlanCards(activePlanName) {
  const container = els.subscriptionPlans;
  if (!container) return;
  const activeRank = planRank[activePlanName] ?? 0;
  const cycle = selectedCycle;
  const planGradientClass = { Starter: "card-starter", Pro: "card-pro", Enterprise: "card-enterprise" };
  const cycleLabel = cycle.months === 1 ? "/ month" : `/ ${cycle.months} months`;

  const toggle = `<div class="billing-cycle-toggle">${billingCycles.map((c) => `<button class="bct-btn ${c.id === cycle.id ? "is-active" : ""}" type="button" data-cycle="${c.id}">${escapeHtml(c.label)}${c.discount ? ` <span class="bct-save">-${Math.round(c.discount * 100)}%</span>` : ""}</button>`).join("")}</div>`;

  const cards = subscriptionPlans
    .filter((plan) => plan.name !== "Free")
    .map((plan, i) => {
      const isCurrent = plan.name === activePlanName;
      const cardRank = planRank[plan.name] ?? 0;
      const btnLabel = isCurrent ? "Active" : cardRank > activeRank ? "Upgrade" : "Downgrade";
      const cp = cyclePrice(plan, cycle);
      const priceDisplay = cycle.months === 1
        ? `৳${cp.monthly.toLocaleString()}`
        : `৳${cp.total.toLocaleString()}`;
      const perMonthNote = cycle.months > 1
        ? `<span class="spc-per-month">৳${cp.monthly.toLocaleString()}/mo</span>` : "";
      const savedNote = cp.saved > 0
        ? `<span class="spc-saved">Save ৳${cp.saved.toLocaleString()}</span>` : "";
      return `
      <article class="subscription-plan-card ${planGradientClass[plan.name] || ""} ${isCurrent ? "is-active-plan" : ""}" style="animation-delay:${i * 60}ms">
        <div class="spc-header">
          <span class="spc-name">${escapeHtml(plan.name)}</span>
          ${isCurrent ? `<span class="spc-active-badge">ACTIVE</span>` : ""}
          <strong class="spc-price">${priceDisplay}<small> ${cycleLabel}</small></strong>
          ${perMonthNote}${savedNote}
          <span class="spc-metric">${plan.requests.toLocaleString()} events/month</span>
        </div>
        <div class="spc-body">
          ${planFeatureList([`${plan.containers} container${plan.containers === 1 ? "" : "s"}`, `${plan.domains} domain${plan.domains === 1 ? "" : "s"}`, `${plan.receivers} receivers/container`, plan.retention, ...plan.features])}
          <button class="spc-btn ${isCurrent ? "spc-btn-current" : ""}" type="button" data-plan-select="${escapeHtml(plan.name)}" ${isCurrent ? "disabled" : ""}>
            ${btnLabel}
          </button>
        </div>
      </article>`;
    }).join("");

  container.innerHTML = toggle + `<div class="spc-grid">${cards}</div>`;
  container.querySelectorAll("[data-plan-select]").forEach((button) => {
    button.addEventListener("click", () => selectSubscriptionPlan(button.dataset.planSelect));
  });
  container.querySelectorAll("[data-cycle]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCycle = billingCycles.find((c) => c.id === button.dataset.cycle) || billingCycles[0];
      renderPlanCards(activePlanName);
    });
  });
}

// Cache of the latest billing snapshot so the modal can render without refetching.
let latestBilling = null;
// Tenant subscription status from the last dashboard render. Drives the client
// paywall: a pending_payment customer is steered to billing before they can
// reach the container-create form (server also enforces this with a 402).
let customerSubscriptionStatus = "";
// Auto-refresh: while a payment claim is under review, poll billing so the
// customer's page flips to "active" the moment the owner confirms — no reload.
let billingPollTimer = null;
let lastClaimPending = false;

// Customer picks a plan. Upgrades/renewals return a payment to pay now (open the
// modal only once real payment data is back — never flash an empty form).
// Downgrades are scheduled server-side for the end of the cycle: no payment now.
async function selectSubscriptionPlan(planName) {
  const buttons = document.querySelectorAll(`[data-plan-select], [data-renew-plan]`);
  buttons.forEach((b) => (b.disabled = true));
  try {
    const response = await fetch("/api/customer/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planName, billingCycle: selectedCycle.id })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Plan update failed."]).join(" "));
    setView("billing");
    await loadBillingPayment();
    if (result.scheduled) {
      // Downgrade scheduled — no payment. The status card already shows the notice.
      return;
    }
    if (result.scheduledCancelled) return;
    if (result.payment) openPaymentModal(result.payment);
  } catch (error) {
    window.alert(error.message);
  } finally {
    document.querySelectorAll(`[data-plan-select], [data-renew-plan]`).forEach((b) => (b.disabled = false));
  }
}

// Fetch billing state and render the top status card.
async function loadBillingPayment() {
  const panel = document.getElementById("paymentPanel");
  if (!panel) return;
  try {
    const response = await fetch("/api/customer/billing");
    if (!response.ok) { panel.hidden = true; return; }
    const { billing } = await response.json();
    latestBilling = billing || {};
    renderPaymentStatusCard(latestBilling);
    renderInvoices(latestBilling);
  } catch {
    panel.hidden = true;
  }
}

// Billing history. Confirmed payments are paid invoices; pending claims show as
// awaiting verification. Each row opens a clean printable invoice.
function renderInvoices(billing) {
  const list = document.getElementById("invoicesList");
  if (!list) return;
  const claims = Array.isArray(billing.claims) ? billing.claims : [];
  if (!claims.length) {
    list.innerHTML = `<div class="invoices-empty">No invoices yet. They appear here after your first payment.</div>`;
    return;
  }
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const statusTag = (s) => s === "confirmed"
    ? `<span class="inv-tag is-paid">Paid</span>`
    : s === "rejected" ? `<span class="inv-tag is-rejected">Rejected</span>`
    : `<span class="inv-tag is-pending">Pending</span>`;
  list.innerHTML = claims.map((c, i) => `
    <button type="button" class="invoice-row" data-invoice-index="${i}">
      <div class="inv-main">
        <strong>${escapeHtml(c.invoiceNo || "—")}</strong>
        <span>${c.confirmedAt || c.claimedAt ? formatShortDate(c.confirmedAt || c.claimedAt) : ""} · ${escapeHtml(c.plan || "")}${c.type === "addon_container" ? " · Extra container" : ""}</span>
      </div>
      <div class="inv-meta">
        ${statusTag(c.status)}
        <span class="inv-amount">${money(c.amount)}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </button>`).join("");
  list.querySelectorAll("[data-invoice-index]").forEach((b) => {
    b.onclick = () => openInvoice(claims[Number(b.dataset.invoiceIndex)], billing);
  });
}

function openInvoice(payment, billing) {
  const overlay = document.getElementById("invoiceOverlay");
  const doc = document.getElementById("invoiceDoc");
  if (!overlay || !doc || !payment) return;
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const issued = payment.confirmedAt || payment.claimedAt;
  const paidStatus = payment.status === "confirmed" ? "PAID" : payment.status === "rejected" ? "REJECTED" : "PENDING";
  const lineLabel = payment.type === "addon_container"
    ? "Extra sGTM container — add-on"
    : `${payment.plan || ""} plan — subscription`;
  const acct = currentSession || {};
  doc.innerHTML = `
    <div class="inv-head">
      <div class="inv-brand">
        <div class="inv-logo">◆</div>
        <div><strong>Tagioo</strong><span>Server-side GTM hosting</span></div>
      </div>
      <div class="inv-title">
        <h2>Invoice</h2>
        <span class="inv-no">${escapeHtml(payment.invoiceNo || "")}</span>
        <span class="inv-status inv-status-${escapeHtml(payment.status || "pending")}">${paidStatus}</span>
      </div>
    </div>
    <div class="inv-parties">
      <div><span>Billed to</span><strong>${escapeHtml(billing.accountName || acct.tenantId || "Customer")}</strong></div>
      <div><span>Invoice date</span><strong>${issued ? formatShortDate(issued) : "—"}</strong></div>
      <div><span>Payment method</span><strong>${escapeHtml((payment.method || "—").toUpperCase())}</strong></div>
      ${payment.txnId ? `<div><span>Transaction ID</span><strong>${escapeHtml(payment.txnId)}</strong></div>` : ""}
    </div>
    <table class="inv-table">
      <thead><tr><th>Description</th><th>Qty</th><th class="inv-r">Amount</th></tr></thead>
      <tbody>
        <tr><td>${escapeHtml(lineLabel)}</td><td>1</td><td class="inv-r">${money(payment.amount)}</td></tr>
      </tbody>
      <tfoot>
        <tr><td colspan="2">Total</td><td class="inv-r inv-total">${money(payment.amount)}</td></tr>
      </tfoot>
    </table>
    <p class="inv-foot">Paid via bKash / Nagad manual transfer. This invoice is generated by Tagioo. For questions, contact support at tagioo.com.</p>`;
  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

// Status-aware banner at the top of the subscription page.
function renderPaymentStatusCard(billing) {
  const panel = document.getElementById("paymentPanel");
  if (!panel) return;
  const status = billing.subscriptionStatus;
  const claims = Array.isArray(billing.claims) ? billing.claims : [];
  const openClaim = claims.find((c) => c.status === "pending");
  const lastConfirmed = claims.find((c) => c.status === "confirmed");
  const renew = billing.renewalDate ? new Date(billing.renewalDate).toLocaleDateString() : "";
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  // Just flipped from "claim under review" to active+paid this render → celebrate.
  const justActivated = lastClaimPending && !openClaim && status === "active" && billing.paymentStatus === "paid";

  let tone = "", icon = "", title = "", sub = "", action = "", invoiceRow = "";

  if (openClaim) {
    tone = "is-verifying"; icon = "⏳";
    title = "We're verifying your payment";
    sub = `Transaction <strong>${escapeHtml(openClaim.txnId)}</strong> for ${escapeHtml(openClaim.plan)} (${money(openClaim.amount)}) is under review. Your plan activates as soon as we confirm it — usually within a few hours.`;
  } else if (status === "pending_payment" && billing.payment) {
    tone = "is-pending"; icon = "💳";
    title = `${escapeHtml(billing.plan || "Starter")} plan — payment pending`;
    sub = renew ? `Expires <strong>${escapeHtml(renew)}</strong>. Complete payment for <strong>${escapeHtml(billing.payment.plan)}</strong> (${money(billing.payment.amount)}) to upgrade.` : `Complete payment for <strong>${escapeHtml(billing.payment.plan)}</strong> (${money(billing.payment.amount)}) to upgrade.`;
    invoiceRow = `<span class="psc-invoice">Invoice ${escapeHtml(billing.payment.invoiceNo)}</span>`;
    action = `<button class="button button-primary" type="button" data-open-payment>Complete payment</button>`;
  } else if (status === "expired") {
    tone = "is-danger"; icon = "🛑";
    title = "Your plan has expired";
    sub = "Tracking is paused. Renew now to resume sending conversions to Meta and Google.";
    action = `<button class="button button-primary" type="button" data-renew-plan="${escapeHtml(billing.plan)}">Renew now</button>`;
  } else if (status === "overdue") {
    tone = "is-warning"; icon = "⚠️";
    title = "Payment overdue";
    sub = `Your ${escapeHtml(billing.plan)} plan renewal is due${renew ? ` (was ${escapeHtml(renew)})` : ""}. Renew now to avoid your tracking being paused.`;
    action = `<button class="button button-primary" type="button" data-renew-plan="${escapeHtml(billing.plan)}">Renew now</button>`;
  } else if (status === "active" && lastConfirmed && billing.paymentStatus === "paid") {
    tone = "is-active"; icon = justActivated ? "🎉" : "✅";
    title = justActivated ? "Payment confirmed — your plan is now active!" : `${escapeHtml(billing.plan)} plan is active`;
    const limit = Number(billing.containerLimit || 0);
    const extra = Number(billing.extraContainers || 0);
    const used = Number(billing.containersUsed || 0);
    const freeSlots = Math.max(0, limit - used);
    sub = (renew ? `Verified and running. Renews on <strong>${escapeHtml(renew)}</strong>. ` : "Payment verified — your plan is active. ")
      + `Containers: <strong>${used}</strong> of <strong>${limit}</strong> used${extra ? ` (incl. ${extra} paid extra)` : ""}.`;
    if (billing.scheduledPlan) {
      const when = billing.scheduledEffectiveDate ? new Date(billing.scheduledEffectiveDate).toLocaleDateString() : "the end of your billing cycle";
      sub += `<br><span class="psc-scheduled">↓ Downgrade to <strong>${escapeHtml(billing.scheduledPlan)}</strong> scheduled for <strong>${escapeHtml(when)}</strong>. You keep ${escapeHtml(billing.plan)} until then.</span>`;
      action = `<button class="button button-ghost" type="button" data-cancel-downgrade="${escapeHtml(billing.plan)}">Keep ${escapeHtml(billing.plan)}</button>`;
    } else if (freeSlots > 0) {
      // Plan still has included container slots — creating one is free, no upsell.
      sub += ` <span class="psc-slots">${freeSlots} more included in your plan.</span>`;
      action = `<button class="button" type="button" data-view-shortcut="customerContainers">Create container</button>`;
    } else {
      // All included containers used — extra containers are the paid add-on.
      action = `<button class="button" type="button" data-add-container>+ Add container · ৳${Number(billing.extraContainerPrice || 1200).toLocaleString()}/mo</button>`;
    }
  } else {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panel.className = `payment-status-card ${tone}${justActivated ? " psc-just-activated" : ""}`;
  panel.innerHTML = `
    <div class="psc-main">
      <span class="psc-icon">${icon}</span>
      <div class="psc-text">
        <strong>${title}</strong>
        <p>${sub}</p>
        ${invoiceRow}
      </div>
    </div>
    ${action ? `<div class="psc-action">${action}</div>` : ""}`;

  const open = panel.querySelector("[data-open-payment]");
  if (open) open.onclick = () => openPaymentModal(billing.payment);
  const renewBtn = panel.querySelector("[data-renew-plan]");
  if (renewBtn) renewBtn.onclick = () => selectSubscriptionPlan(renewBtn.dataset.renewPlan);
  const addBtn = panel.querySelector("[data-add-container]");
  if (addBtn) addBtn.onclick = () => openExtraContainerModal(billing);
  const cancelBtn = panel.querySelector("[data-cancel-downgrade]");
  if (cancelBtn) cancelBtn.onclick = () => selectSubscriptionPlan(cancelBtn.dataset.cancelDowngrade);

  manageBillingPolling(Boolean(openClaim), status, billing.paymentStatus);
}

// Start/stop billing polling based on whether a claim is awaiting owner review.
// When a pending claim clears into active+paid, celebrate once and refresh the
// dashboard so the paywall lifts and container creation unlocks immediately.
function manageBillingPolling(claimPending, status, paymentStatus) {
  if (claimPending) {
    if (!billingPollTimer) {
      billingPollTimer = setInterval(() => { loadBillingPayment().catch(() => {}); }, 20000);
    }
  } else if (billingPollTimer) {
    clearInterval(billingPollTimer);
    billingPollTimer = null;
  }
  // Transition: was waiting on a claim, now activated → refresh dashboard so the
  // paywall lifts and container creation unlocks. The celebratory card state is
  // rendered by renderPaymentStatusCard (reads lastClaimPending, still true here).
  if (lastClaimPending && !claimPending && status === "active" && paymentStatus === "paid") {
    loadDashboard().catch(() => {});
  }
  lastClaimPending = claimPending;
}

// ── Payment modal ──────────────────────────────────────────────────────────
function openPaymentModal(payment) {
  const overlay = document.getElementById("paymentModalOverlay");
  const body = document.getElementById("paymentModalBody");
  if (!overlay || !body || !payment) return;
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const numberRow = (label, num) => num
    ? `<div class="pm-number"><div><span>${label}</span><strong>${escapeHtml(num)}</strong></div><button class="pm-copy" type="button" data-copy="${escapeHtml(num)}">Copy</button></div>`
    : "";
  const numbers = [numberRow("bKash", payment.bkashNumber), numberRow("Nagad", payment.nagadNumber)].join("");

  const cycleObj = billingCycles.find((c) => c.id === (payment.billingCycle || selectedCycle.id)) || billingCycles[0];
  const cycleLabel = cycleObj.months === 1 ? "/month" : `/${cycleObj.months} months`;
  body.innerHTML = `
    <div class="pm-header">
      <span class="pm-eyebrow">Upgrade to ${escapeHtml(payment.plan)} — ${escapeHtml(cycleObj.label)}</span>
      <span class="pm-amount">${money(payment.amount)}<small>${cycleLabel}</small></span>
    </div>
    <ol class="pm-steps">
      <li><strong>Open bKash or Nagad</strong> and choose <strong>Send Money</strong>.</li>
      <li>Send <strong>${money(payment.amount)}</strong> to the number below.</li>
      <li>Enter the <strong>Transaction ID</strong> you receive, then submit.</li>
    </ol>
    <div class="pm-numbers">${numbers || `<p class="pm-warn">⚠️ Payment numbers aren't configured yet. Please contact support before paying.</p>`}</div>
    <p class="pm-ref">Reference / Invoice: <strong>${escapeHtml(payment.invoiceNo)}</strong></p>
    <form id="paymentClaimForm" class="pm-form">
      <label>Paid with
        <select name="method" required>
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
        </select>
      </label>
      <label>Transaction ID
        <input name="txnId" type="text" placeholder="e.g. 8N7A1B2C3D" required />
      </label>
      <label>Your sending number
        <input name="senderNumber" type="text" inputmode="numeric" placeholder="01XXXXXXXXX" required />
      </label>
      <button class="button button-primary pm-submit" type="submit">I've paid — submit Transaction ID</button>
      <span id="paymentClaimMessage" class="pm-message"></span>
    </form>`;

  body.querySelectorAll(".pm-copy").forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied ✓"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { /* ignore */ }
    };
  });
  const form = body.querySelector("#paymentClaimForm");
  if (form) form.onsubmit = submitPaymentClaimForm;

  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

function closePaymentModal() {
  const overlay = document.getElementById("paymentModalOverlay");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("modal-open");
  loadBillingPayment();
}

async function submitPaymentClaimForm(event) {
  event.preventDefault();
  const form = event.target;
  const msg = document.getElementById("paymentClaimMessage");
  const btn = form.querySelector(".pm-submit");
  const body = {
    method: form.method.value,
    txnId: form.txnId.value.trim(),
    senderNumber: form.senderNumber.value.trim()
  };
  if (msg) { msg.textContent = "Submitting…"; msg.className = "pm-message"; }
  if (btn) btn.disabled = true;
  try {
    const response = await fetch("/api/customer/payment-claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Submit failed."]).join(" "));
    // Success state inside the modal.
    const modalBody = document.getElementById("paymentModalBody");
    if (modalBody) modalBody.innerHTML = `
      <div class="pm-success">
        <span class="pm-success-icon">⏳</span>
        <h3>Payment submitted!</h3>
        <p>We've received Transaction ID <strong>${escapeHtml(body.txnId)}</strong> and emailed you a confirmation. We'll verify it and activate your plan shortly — you'll get another email the moment it's live.</p>
        <button class="button button-primary" type="button" data-payment-modal-close>Done</button>
      </div>`;
  } catch (error) {
    if (msg) { msg.textContent = error.message; msg.className = "pm-message is-error"; }
    if (btn) btn.disabled = false;
  }
}

// ── Extra-container add-on modal (recurring ৳1,200/mo) ─────────────────────
function openExtraContainerModal(billing) {
  const overlay = document.getElementById("paymentModalOverlay");
  const body = document.getElementById("paymentModalBody");
  if (!overlay || !body) return;
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const nums = billing.paymentNumbers || {};
  const price = Number(billing.extraContainerPrice || 1200);
  const numberRow = (label, num) => num
    ? `<div class="pm-number"><div><span>${label}</span><strong>${escapeHtml(num)}</strong></div><button class="pm-copy" type="button" data-copy="${escapeHtml(num)}">Copy</button></div>`
    : "";
  const numbers = [numberRow("bKash", nums.bkashNumber), numberRow("Nagad", nums.nagadNumber)].join("");
  body.innerHTML = `
    <div class="pm-header">
      <span class="pm-eyebrow">Add one extra sGTM container</span>
      <span class="pm-amount">${money(price)}<small>/month</small></span>
    </div>
    <ol class="pm-steps">
      <li><strong>Open bKash or Nagad</strong> and choose <strong>Send Money</strong>.</li>
      <li>Send <strong>${money(price)}</strong> to the number below.</li>
      <li>Enter the <strong>Transaction ID</strong> you receive, then submit.</li>
    </ol>
    <div class="pm-numbers">${numbers || `<p class="pm-warn">⚠️ Payment numbers aren't configured yet. Please contact support before paying.</p>`}</div>
    <form id="extraContainerForm" class="pm-form">
      <label>Paid with
        <select name="method" required>
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
        </select>
      </label>
      <label>Transaction ID
        <input name="txnId" type="text" placeholder="e.g. 8N7A1B2C3D" required />
      </label>
      <label>Your sending number
        <input name="senderNumber" type="text" inputmode="numeric" placeholder="01XXXXXXXXX" required />
      </label>
      <button class="button button-primary pm-submit" type="submit">I've paid — submit Transaction ID</button>
      <span id="extraContainerMessage" class="pm-message"></span>
    </form>`;
  body.querySelectorAll(".pm-copy").forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied ✓"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { /* ignore */ }
    };
  });
  const form = body.querySelector("#extraContainerForm");
  if (form) form.onsubmit = submitExtraContainerForm;
  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

async function submitExtraContainerForm(event) {
  event.preventDefault();
  const form = event.target;
  const msg = document.getElementById("extraContainerMessage");
  const btn = form.querySelector(".pm-submit");
  const body = { method: form.method.value, txnId: form.txnId.value.trim(), senderNumber: form.senderNumber.value.trim() };
  if (msg) { msg.textContent = "Submitting…"; msg.className = "pm-message"; }
  if (btn) btn.disabled = true;
  try {
    const response = await fetch("/api/customer/extra-container-claim", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Submit failed."]).join(" "));
    const modalBody = document.getElementById("paymentModalBody");
    if (modalBody) modalBody.innerHTML = `
      <div class="pm-success">
        <span class="pm-success-icon">⏳</span>
        <h3>Payment submitted!</h3>
        <p>We've received Transaction ID <strong>${escapeHtml(body.txnId)}</strong>. Once we verify it, your extra container unlocks and you'll get a confirmation email.</p>
        <button class="button button-primary" type="button" data-payment-modal-close>Done</button>
      </div>`;
  } catch (error) {
    if (msg) { msg.textContent = error.message; msg.className = "pm-message is-error"; }
    if (btn) btn.disabled = false;
  }
}

// ── Owner: payment claims queue ────────────────────────────────────────────
async function loadOwnerPayments() {
  const list = document.getElementById("ownerPaymentsList");
  const badge = document.getElementById("ownerPaymentsBadge");
  const navBadge = document.getElementById("ownerPaymentsNavBadge");
  try {
    const response = await fetch("/api/admin/payments");
    if (!response.ok) return;
    const { payments } = await response.json();
    const all = Array.isArray(payments) ? payments : [];
    const pending = all.filter((p) => p.status === "pending");
    if (badge) badge.textContent = `${pending.length} pending`;
    // Global nav badge so the owner sees new claims to confirm from any view.
    if (navBadge) {
      navBadge.hidden = pending.length === 0;
      navBadge.textContent = pending.length > 99 ? "99+" : String(pending.length);
    }
    if (!list) return;
    const show = pending.length ? pending : all.slice(0, 8);
    list.innerHTML = show.length
      ? show.map((p) => `
          <div class="summary-item claim-${escapeHtml(p.status)}">
            <div class="summary-item-main">
              <strong>${escapeHtml(p.tenantId)} · ${escapeHtml(p.plan)} · ৳${Number(p.amount).toLocaleString()}</strong>
              <span>${escapeHtml(p.method)} · TxnID <code>${escapeHtml(p.txnId)}</code> · from ${escapeHtml(p.senderNumber)}</span>
              <span>Invoice ${escapeHtml(p.invoiceNo)} · ${escapeHtml(p.status)}</span>
            </div>
            ${p.status === "pending" ? `<div class="summary-item-actions">
              <button class="button button-primary" type="button" data-pay-confirm="${escapeHtml(p.id)}">Confirm</button>
              <button class="button" type="button" data-pay-reject="${escapeHtml(p.id)}">Reject</button>
            </div>` : ""}
          </div>`).join("")
      : `<div class="summary-item"><div class="summary-item-main"><strong>No payments yet</strong><span>Manual bKash/Nagad claims will appear here.</span></div></div>`;
    list.querySelectorAll("[data-pay-confirm]").forEach((b) => { b.onclick = () => actOnPayment(b.dataset.payConfirm, "confirm"); });
    list.querySelectorAll("[data-pay-reject]").forEach((b) => { b.onclick = () => actOnPayment(b.dataset.payReject, "reject"); });
  } catch { /* leave list as-is */ }
}

async function actOnPayment(id, action) {
  let reason = "";
  if (action === "reject") {
    reason = window.prompt("Reason for rejecting this payment (optional):") || "";
  } else if (!window.confirm("Confirm this payment? This activates the customer's plan for 30 days.")) {
    return;
  }
  try {
    const response = await fetch(`/api/admin/payments/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Action failed."]).join(" "));
    await loadOwnerPayments();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadPaymentSettings() {
  const form = document.getElementById("paymentSettingsForm");
  if (!form) return;
  form.onsubmit = savePaymentSettings;
  try {
    const response = await fetch("/api/admin/settings/payment");
    if (!response.ok) return;
    const { settings } = await response.json();
    for (const key of ["bkashNumber", "nagadNumber", "ownerNotifyEmail", "ownerWhatsApp", "instructions"]) {
      if (form[key]) form[key].value = settings[key] || "";
    }
  } catch { /* ignore */ }
}

async function savePaymentSettings(event) {
  event.preventDefault();
  const form = event.target;
  const msg = document.getElementById("paymentSettingsMessage");
  const body = {};
  for (const key of ["bkashNumber", "nagadNumber", "ownerNotifyEmail", "ownerWhatsApp", "instructions"]) {
    body[key] = form[key] ? form[key].value.trim() : "";
  }
  if (msg) msg.textContent = "Saving…";
  try {
    const response = await fetch("/api/admin/settings/payment", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Save failed."]).join(" "));
    if (msg) msg.textContent = "Saved.";
  } catch (error) {
    if (msg) msg.textContent = error.message;
  }
}

// ── Owner: local database backups ──────────────────────────────────────────
function formatBackupBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadBackups() {
  const list = document.getElementById("backupsList");
  const badge = document.getElementById("backupsBadge");
  if (!list) return;
  try {
    const response = await fetch("/api/admin/backups");
    if (!response.ok) return;
    const { backups } = await response.json();
    const all = Array.isArray(backups) ? backups : [];
    if (badge) badge.textContent = `${all.length} backup${all.length === 1 ? "" : "s"}`;
    list.innerHTML = all.length
      ? all.map((b) => `
          <div class="summary-item">
            <div class="summary-item-main">
              <strong>${escapeHtml(new Date(b.createdAt).toLocaleString())}</strong>
              <span>${escapeHtml(b.source)} · ${escapeHtml(formatBackupBytes(b.sizeBytes))}</span>
            </div>
            <div class="summary-item-actions">
              <button class="button button-primary" type="button" data-backup-restore="${escapeHtml(b.id)}">Restore</button>
              <button class="button" type="button" data-backup-delete="${escapeHtml(b.id)}">Delete</button>
            </div>
          </div>`).join("")
      : `<div class="summary-item"><div class="summary-item-main"><strong>No backups yet</strong><span>The first automatic backup runs shortly after startup; daily after that.</span></div></div>`;
    list.querySelectorAll("[data-backup-restore]").forEach((b) => { b.onclick = () => restoreBackupAction(b.dataset.backupRestore); });
    list.querySelectorAll("[data-backup-delete]").forEach((b) => { b.onclick = () => deleteBackupAction(b.dataset.backupDelete); });
  } catch { /* leave list as-is */ }

  const createBtn = document.getElementById("createBackupBtn");
  if (createBtn && !createBtn.dataset.wired) {
    createBtn.dataset.wired = "1";
    createBtn.onclick = createBackupNow;
  }
  const importInput = document.getElementById("importBackupInput");
  if (importInput && !importInput.dataset.wired) {
    importInput.dataset.wired = "1";
    importInput.onchange = importBackupFile;
  }
}

async function createBackupNow() {
  const msg = document.getElementById("backupsMessage");
  if (msg) msg.textContent = "Creating backup…";
  try {
    const response = await fetch("/api/admin/backups", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Backup failed."]).join(" "));
    if (msg) msg.textContent = "Backup created.";
    await loadBackups();
  } catch (error) {
    if (msg) msg.textContent = error.message;
  }
}

async function restoreBackupAction(id) {
  if (!window.confirm("Restore this backup? This overwrites current tenants, payments, and customer logins with the snapshot's data. This cannot be undone.")) return;
  const msg = document.getElementById("backupsMessage");
  try {
    const response = await fetch(`/api/admin/backups/${encodeURIComponent(id)}/restore`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Restore failed."]).join(" "));
    window.alert("Backup restored. The page will reload.");
    window.location.reload();
  } catch (error) {
    if (msg) msg.textContent = error.message;
  }
}

async function deleteBackupAction(id) {
  if (!window.confirm("Delete this backup? This cannot be undone.")) return;
  const msg = document.getElementById("backupsMessage");
  try {
    const response = await fetch(`/api/admin/backups/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Delete failed."]).join(" "));
    await loadBackups();
  } catch (error) {
    if (msg) msg.textContent = error.message;
  }
}

async function importBackupFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const msg = document.getElementById("backupsMessage");
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (msg) msg.textContent = "Importing…";
    const response = await fetch("/api/admin/backups/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: parsed.data ?? parsed })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Import failed."]).join(" "));
    if (msg) msg.textContent = "Imported. Use Restore to activate it.";
    await loadBackups();
  } catch (error) {
    if (msg) msg.textContent = error.message.includes("JSON") ? "That file isn't valid JSON." : error.message;
  }
}

// ── Owner: error logs ───────────────────────────────────────────────────────
async function loadErrorLogs() {
  const list = document.getElementById("errorLogsList");
  const dot = document.getElementById("errorLogsBadge");
  const navBadge = document.getElementById("errorLogsNavBadge");
  if (!list) return;
  try {
    const response = await fetch("/api/admin/error-logs");
    if (!response.ok) return;
    const { errors, total } = await response.json();
    const all = Array.isArray(errors) ? errors : [];
    if (dot) { dot.textContent = total ? `${total} logged` : "Clear"; dot.className = `status-dot ${total ? "warn" : ""}`; }
    if (navBadge) {
      navBadge.hidden = !total;
      navBadge.textContent = total > 99 ? "99+" : String(total);
    }
    list.innerHTML = all.length
      ? all.map((e) => `
          <div class="summary-item">
            <div class="summary-item-main">
              <strong>${escapeHtml(e.source)} · ${escapeHtml(new Date(e.created_at).toLocaleString())}</strong>
              <span>${escapeHtml(e.message)}</span>
              ${e.context && e.context !== "{}" ? `<span>${escapeHtml(e.context)}</span>` : ""}
              ${e.stack ? `<pre style="white-space:pre-wrap;font-size:11px;color:var(--color-dim);margin:6px 0 0">${escapeHtml(e.stack.slice(0, 800))}</pre>` : ""}
            </div>
          </div>`).join("")
      : `<div class="summary-item"><div class="summary-item-main"><strong>No errors logged</strong><span>Server exceptions and reported browser errors will show up here.</span></div></div>`;
  } catch { /* leave list as-is */ }

  const clearBtn = document.getElementById("clearErrorLogsBtn");
  if (clearBtn && !clearBtn.dataset.wired) {
    clearBtn.dataset.wired = "1";
    clearBtn.onclick = async () => {
      if (!window.confirm("Clear all error logs? This cannot be undone.")) return;
      await fetch("/api/admin/error-logs", { method: "DELETE" });
      await loadErrorLogs();
    };
  }
}

// Global client-side error reporter — runs on every page (login, landing,
// dashboard) so a broken admin render or a customer-facing JS crash both
// surface in Admin → Error Logs instead of going unnoticed.
(function setupClientErrorReporter() {
  let reported = 0;
  const MAX_REPORTS_PER_LOAD = 20;
  function report(message, stack) {
    if (reported >= MAX_REPORTS_PER_LOAD) return;
    reported += 1;
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: String(message || "Unknown error").slice(0, 2000), stack: String(stack || "").slice(0, 8000), url: window.location.href })
    }).catch(() => {});
  }
  window.addEventListener("error", (event) => {
    report(event.message, event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    report(event.reason?.message || String(event.reason), event.reason?.stack);
  });
})();

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

async function launchProvisioningRequest(id) {
  try {
    const response = await fetch(`/api/provisioning/requests/${encodeURIComponent(id)}/launch`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Launch failed"]).join(" "));
    els.provisioningFormMessage.textContent = `Launch status: ${String(result.request?.status || "updated").replaceAll("_", " ")}`;
    await loadDashboard();
    setView("provisioning");
  } catch (error) {
    els.provisioningFormMessage.textContent = error.message;
  }
}

async function deleteCustomerContainer(id) {
  const confirmed = window.confirm("Delete this container? This will stop and remove its generated server resources when auto-launch is enabled.");
  if (!confirmed) return;
  if (els.customerSetupFormMessage) els.customerSetupFormMessage.textContent = "Deleting container and generated server resources...";
  try {
    const response = await fetch(`/api/customer/containers/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Delete failed"]).join(" "));
    if (els.customerSetupFormMessage) els.customerSetupFormMessage.textContent = "Container deleted.";
    await loadDashboard();
    setView("customerContainers");
  } catch (error) {
    els.customerSetupFormMessage.textContent = error.message;
  }
}

function renderEventLogDailyChart(dailyHistory) {
  if (!els.customerEventLogChart) return;
  // Build a contiguous 30-day axis ending on the newest snapshot. Days without a
  // snapshot render as zero bars instead of stretching a few bars across the width.
  const list = (Array.isArray(dailyHistory) ? dailyHistory : []).slice(0, 30);
  const byDate = new Map(list.map((r) => [r.date, r]));
  const anchor = list[0]?.date || dhakaDateKey();
  const anchorMs = Date.parse(`${anchor}T12:00:00Z`);
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(anchorMs - i * 86400000).toISOString().slice(0, 10);
    rows.push(byDate.get(key) || { date: key, total: 0, purchases: 0, purchaseRevenue: 0 });
  }
  if (!list.length) {
    els.customerEventLogChart.innerHTML = '<div class="empty-log" style="padding:2rem 1rem;text-align:center;color:var(--color-muted);font-size:.85rem">No daily history yet.</div>';
    return;
  }
  const W = 700; const H = 220;
  const pad = { left: 44, right: 60, top: 18, bottom: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const maxRaw = Math.max(1, ...rows.map((r) => Number(r.total || 0)));
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(maxRaw)));
    const n = maxRaw / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  })();
  const maxRevenue = Math.max(1, ...rows.map((r) => Number(r.purchaseRevenue || 0)));
  const hasRevenue = rows.some((r) => Number(r.purchaseRevenue || 0) > 0);
  const revCurrency = list.find((r) => r.currency)?.currency || "";

  const baseY = pad.top + plotH;
  const slot = plotW / rows.length;
  const barW = Math.max(3, Math.min(26, slot * 0.55));
  const barX = (i) => pad.left + slot * i + (slot - barW) / 2;
  const barCx = (i) => pad.left + slot * i + slot / 2;
  const toY = (v) => baseY - Math.min(Number(v) / niceMax, 1) * plotH;
  const toRevY = (v) => baseY - Math.min(Number(v) / maxRevenue, 1) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const y = (baseY - plotH * pct).toFixed(1);
    const val = Math.round(niceMax * pct);
    return `<line class="${pct === 0 ? "chart-axis-line" : "chart-grid-line-dashed"}" x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" />
            <text class="chart-axis-label" x="${pad.left - 8}" y="${(Number(y) + 4).toFixed(1)}" text-anchor="end">${val.toLocaleString()}</text>`;
  }).join("");

  // Right-axis revenue labels (only when revenue data exists)
  const revTicks = hasRevenue ? [0, 0.5, 1].map((pct) => {
    const y = (baseY - plotH * pct).toFixed(1);
    const val = Math.round(maxRevenue * pct);
    const label = val >= 1000 ? `${Math.round(val / 1000)}k` : val.toString();
    return `<text class="chart-axis-label" x="${pad.left + plotW + 8}" y="${(Number(y) + 4).toFixed(1)}" text-anchor="start" fill="#f59e0b">${label}</text>`;
  }).join("") : "";

  const labelStep = rows.length <= 10 ? 1 : rows.length <= 16 ? 2 : 3;
  const xLabels = rows.map((r, i) => {
    if (i % labelStep !== 0 && i !== rows.length - 1) return "";
    const cx = barX(i) + barW / 2;
    return `<text class="chart-axis-label" x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeHtml((r.date || "").slice(5))}</text>`;
  }).join("");

  const bars = rows.map((r, i) => {
    const total = Number(r.total || 0);
    const y = toY(total);
    const h = Math.max(total > 0 ? 2 : 0, baseY - y);
    const x = barX(i);
    const rx = Math.min(barW / 2, 4);
    return `<rect class="log-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="url(#logBarFill)" data-idx="${i}" data-date="${escapeHtml(r.date || "")}" data-total="${total}" data-purchases="${Number(r.purchases || 0)}" data-revenue="${Number(r.purchaseRevenue || 0)}" data-currency="${escapeHtml(r.currency || revCurrency)}" />`;
  }).join("");

  // Revenue line + dots overlay
  const revPoints = rows.map((r, i) => {
    const rev = Number(r.purchaseRevenue || 0);
    return [barCx(i).toFixed(1), toRevY(rev).toFixed(1), rev];
  });
  const revPath = hasRevenue
    ? `<polyline class="rev-line" points="${revPoints.map(([x, y]) => `${x},${y}`).join(" ")}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" />`
    + revPoints.map(([x, y, rev]) => rev > 0 ? `<circle class="rev-dot" cx="${x}" cy="${y}" r="3" fill="#f59e0b" opacity="0.9" />` : "").join("")
    : "";

  els.customerEventLogChart.innerHTML = `
    <div class="chart-tooltip" id="logChartTooltip" style="display:none;pointer-events:none"></div>
    <svg class="customer-analytics-svg log-bar-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily event volume and revenue">
      <defs>
        <linearGradient id="logBarFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#5b21b6" />
        </linearGradient>
      </defs>
      <g>${yTicks}</g>
      ${revTicks}
      <g class="log-bars">${bars}</g>
      ${revPath}
      ${xLabels}
    </svg>
  `;

  const tooltip = document.getElementById("logChartTooltip");
  els.customerEventLogChart.querySelectorAll(".log-bar").forEach((bar) => {
    bar.addEventListener("mouseenter", () => {
      const total = Number(bar.dataset.total);
      const purchases = Number(bar.dataset.purchases);
      const revenue = Number(bar.dataset.revenue);
      const currency = bar.dataset.currency || "";
      bar.classList.add("is-active");
      tooltip.innerHTML = `<div class="tooltip-hour">${escapeHtml(bar.dataset.date || "")}</div>`
        + `<div class="tooltip-row"><span class="tooltip-dot" style="background:var(--color-accent)"></span><span>Events</span><strong>${total.toLocaleString()}</strong></div>`
        + (purchases ? `<div class="tooltip-row"><span class="tooltip-dot" style="background:var(--c-purchase)"></span><span>Purchases</span><strong>${purchases.toLocaleString()}</strong></div>` : "")
        + (revenue ? `<div class="tooltip-row"><span class="tooltip-dot" style="background:#f59e0b"></span><span>Revenue</span><strong>${escapeHtml(formatMoney(revenue, currency))}</strong></div>` : "");
      tooltip.style.display = "block";
    });
    bar.addEventListener("mousemove", (e) => {
      const cr = els.customerEventLogChart.getBoundingClientRect();
      const tw = tooltip.offsetWidth || 150; const th = tooltip.offsetHeight || 60;
      let left = e.clientX - cr.left + 16; let top = e.clientY - cr.top - th - 12;
      if (left + tw > cr.width - 8) left = e.clientX - cr.left - tw - 16;
      if (top < 0) top = e.clientY - cr.top + 12;
      tooltip.style.left = `${left}px`; tooltip.style.top = `${top}px`;
    });
    bar.addEventListener("mouseleave", () => {
      tooltip.style.display = "none"; bar.classList.remove("is-active");
    });
  });
}

function renderDailyEventLog(dailyHistory) {
  if (!els.dailyEventLogBody) return;
  const rows = (Array.isArray(dailyHistory) ? dailyHistory : []).slice(0, 30);
  if (!rows.length) {
    els.dailyEventLogBody.innerHTML = '<tr><td colspan="9" style="color:var(--color-muted);text-align:center;padding:2rem">No daily history yet.</td></tr>';
    return;
  }
  const today = dhakaDateKey();
  els.dailyEventLogBody.innerHTML = rows.map((r) => {
    const isToday = r.date === today;
    const purchases = Number(r.purchases || r.purchaseCount || 0);
    const revenue = Number(r.purchaseRevenue || 0);
    const pageView = Number(r.pageView || 0);
    const addToCart = Number(r.addToCart || 0);
    const beginCheckout = Number(r.beginCheckout || 0);
    const total = Number(r.total || 0);
    const errors = Number(r.errors || 0);
    const convRate = beginCheckout > 0 ? Math.round((purchases / beginCheckout) * 100) : null;
    const convColor = convRate === null ? "" : convRate >= 50 ? "color:var(--c-ok,#22c55e)" : convRate >= 25 ? "color:var(--c-warn,#f59e0b)" : "color:var(--c-error,#ef4444)";
    const dash = `<span style="color:var(--color-muted)">—</span>`;
    return `<tr${isToday ? ' class="daily-log-today"' : ''}>
      <td><strong>${escapeHtml(r.date || "")}</strong>${isToday ? ' <span class="badge badge-live" style="font-size:.65rem;padding:2px 6px;margin-left:6px">Today</span>' : ""}</td>
      <td>${purchases ? `<strong>${purchases.toLocaleString()}</strong>` : dash}</td>
      <td>${revenue > 0 ? escapeHtml(formatMoney(revenue, r.currency || "")) : dash}</td>
      <td>${convRate !== null ? `<strong style="${convColor}">${convRate}%</strong>` : dash}</td>
      <td>${pageView ? pageView.toLocaleString() : dash}</td>
      <td>${addToCart ? addToCart.toLocaleString() : dash}</td>
      <td>${beginCheckout ? beginCheckout.toLocaleString() : dash}</td>
      <td>${total.toLocaleString()}</td>
      <td>${errors > 0 ? `<button class="error-drill-btn status-code bad" title="Filter to errors" data-drill="errors">${errors.toLocaleString()}</button>` : dash}</td>
    </tr>`;
  }).join("");

}

function renderPurchaseGapAlert(dailyHistory) {
  const el = els.purchaseGapAlert;
  if (!el) return;
  const rows = (Array.isArray(dailyHistory) ? dailyHistory : []).slice(0, 8);
  if (rows.length < 2) { el.hidden = true; return; }

  const today = rows[0];
  const past7 = rows.slice(1, 8);
  const todayPurchases = Number(today.purchases || today.purchaseCount || 0);
  const avg7 = past7.reduce((s, r) => s + Number(r.purchases || r.purchaseCount || 0), 0) / past7.length;

  if (avg7 < 1) { el.hidden = true; return; }

  // Scale today's count by Dhaka day progress (UTC+6) to project full-day pace
  const nowDhaka = new Date(Date.now() + 6 * 3600_000);
  const minuteOfDay = nowDhaka.getUTCHours() * 60 + nowDhaka.getUTCMinutes();
  const dayFraction = minuteOfDay / 1440;

  // Too early in Dhaka day (before ~2:24am) — not enough signal yet
  if (dayFraction < 0.1) { el.hidden = true; return; }

  const projected = todayPurchases / dayFraction;

  if (projected >= avg7 * 0.5) { el.hidden = true; return; }

  const pct = Math.round((projected / avg7) * 100);
  const projRounded = Math.round(projected);
  el.hidden = false;
  el.innerHTML =
    `<span class="gap-alert-icon">⚠</span>` +
    `<div><strong>Purchase tracking may be down.</strong> ` +
    `Today: <strong>${todayPurchases}</strong> so far (projected ~${projRounded}/day at current pace) — ` +
    `${pct}% of 7-day avg (${Math.round(avg7)}). ` +
    `Check sGTM container and incoming requests for errors.</div>`;
}

function renderLastEventFreshness(data) {
  if (!els.lastEventFreshness) return;
  const rows = serverEventRows(data);
  const latest = rows.find((r) => r.date instanceof Date && !isNaN(r.date));
  if (!latest) {
    els.lastEventFreshness.innerHTML = "";
    return;
  }
  const ageMs = Date.now() - latest.date.getTime();
  const ageSec = Math.round(ageMs / 1000);
  const label = relativeTime(latest.date);
  const tone = ageSec < 300 ? "ok" : ageSec < 900 ? "warn" : "bad";
  const dot = tone === "ok" ? "●" : tone === "warn" ? "◉" : "○";
  els.lastEventFreshness.innerHTML =
    `<span class="freshness-dot freshness-${tone}">${dot}</span>` +
    `<span class="freshness-label">Last event <strong>${escapeHtml(label)}</strong></span>`;
}

function renderLogs(data) {
  renderEventTable(data);
  renderPurchaseInspector(data);
  renderEventLogDailyChart(data.history?.daily || []);
  renderDailyEventLog(data.history?.daily || []);
  renderPurchaseGapAlert(data.history?.daily || []);
  renderLastEventFreshness(data);
  setLog(els.errorLog, data.nginx.errorLog, "error");
  setLog(els.dockerLog, data.dockerLogs, "docker");
  els.dockerLogSource.textContent = data.dockerLogs.container || "tail";
  els.dockerLogHelp.textContent = data.dockerLogs.container
    ? `Preview from ${data.dockerLogs.container}.`
    : "Preview from the first running container.";
}

const OFFLINE_CSV_HEADER = "event_name,event_time,value,currency,order_id,email,phone,first_name,last_name,city,state,zip,country";
const OFFLINE_CSV_SAMPLE = `${OFFLINE_CSV_HEADER}\nPurchase,2026-06-14,1499,BDT,A-1001,customer@example.com,8801712345678,Karim,Rahman,Dhaka,Dhaka,1207,BD`;
let offlineTracking = null;

function offlineUploadHistoryHtml(uploads) {
  if (!uploads || !uploads.length) return `<p class="muted-note">No uploads yet.</p>`;
  return `<ul class="offline-history">${uploads.map((u) => {
    const tone = u.status === "sent" ? "ok" : "warn";
    const when = u.at ? formatShortDate(u.at) : "";
    const errs = (u.errors && u.errors.length) ? `<small class="offline-history-err">${escapeHtml(u.errors.slice(0, 3).join(" · "))}</small>` : "";
    return `<li><span class="badge ${tone}">${escapeHtml(u.status || "—")}</span> <span>${u.sent || 0}/${u.received || 0} sent</span> <small>${escapeHtml(when)}</small>${errs}</li>`;
  }).join("")}</ul>`;
}

function renderOfflineConversions() {
  const mount = els.offlineConversionsBody;
  if (!mount) return;
  mount.innerHTML = `<p class="muted-note">Loading…</p>`;
  fetch("/api/customer/me")
    .then((r) => r.json())
    .then((result) => {
      offlineTracking = result.tracking || null;
      paintOfflineConversions();
    })
    .catch(() => { mount.innerHTML = `<div class="empty-log">Could not load your tracking settings.</div>`; });
}

function paintOfflineConversions() {
  const mount = els.offlineConversionsBody;
  if (!mount) return;
  const tracking = offlineTracking || {};
  const meta = tracking.meta || {};
  const cookie = tracking.cookieExtension || { enabled: false, days: 730 };
  const hasToken = Boolean(meta.hasToken);

  const uploadCard = hasToken
    ? `<div class="offline-upload">
        <p>Upload phone, COD, or in-store orders as CSV to push them to Meta as offline conversions. Customer match keys are hashed in your browser's request and sent server-side.</p>
        <div class="offline-actions-row">
          <button class="button" type="button" id="offlineTemplateBtn">Download CSV template</button>
          <span class="muted-note">Columns: ${escapeHtml(OFFLINE_CSV_HEADER)}</span>
        </div>
        <label class="field-label" for="offlineCsvInput">Paste CSV rows or choose a file</label>
        <input type="file" id="offlineCsvFile" accept=".csv,text/csv" />
        <textarea id="offlineCsvInput" rows="7" placeholder="${escapeHtml(OFFLINE_CSV_HEADER)}\n..."></textarea>
        <div class="offline-actions-row">
          <button class="button" type="button" id="offlineValidateBtn">Validate</button>
          <button class="button button-primary" type="button" id="offlineSendBtn">Upload to Meta</button>
        </div>
        <div id="offlineResult" class="offline-result"></div>
      </div>`
    : `<div class="empty-log offline-empty">
        <strong>Connect Meta first.</strong>
        <p>Add your Meta Pixel ID and Conversions API token in the Setup Assistant, then come back to upload offline conversions.</p>
        <button class="button button-primary" type="button" id="offlineGoSetupBtn">Open Setup Assistant</button>
      </div>`;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div><h2>Offline conversion upload</h2><p class="panel-sub">Send offline orders to Meta CAPI${meta.pixelId ? ` · Pixel ${escapeHtml(meta.pixelId)}` : ""}${meta.testEventCode ? ` · test ${escapeHtml(meta.testEventCode)}` : ""}</p></div>
      </div>
      ${uploadCard}
      <div class="offline-history-wrap">
        <h3>Recent uploads</h3>
        ${offlineUploadHistoryHtml(tracking.offlineUploads)}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Cookie life extension</h2><p class="panel-sub">Resist Safari ITP's 7-day cap by writing the first-party FPID cookie server-side with a long lifetime.</p></div>
      </div>
      <div class="cookie-ext">
        <label class="toggle-row"><input type="checkbox" id="cookieExtEnabled" ${cookie.enabled ? "checked" : ""}/> <span>Enable extended cookie lifetime</span></label>
        <label class="field-label" for="cookieExtDays">Cookie lifetime (days, max 730)</label>
        <input type="number" id="cookieExtDays" min="1" max="730" value="${escapeHtml(String(cookie.days || 730))}" />
        <div class="offline-actions-row">
          <button class="button button-primary" type="button" id="cookieExtSaveBtn">Save</button>
          <span id="cookieExtMsg" class="muted-note"></span>
        </div>
        <p class="muted-note">After changing this, regenerate your Server GTM template in the Setup Assistant and re-import it to apply.</p>
      </div>
    </section>`;

  wireOfflineConversions();
}

function downloadOfflineTemplate() {
  const blob = new Blob([OFFLINE_CSV_SAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tagioo-offline-conversions-template.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function postOffline(path, csv) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv })
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function wireOfflineConversions() {
  const templateBtn = document.querySelector("#offlineTemplateBtn");
  if (templateBtn) templateBtn.addEventListener("click", downloadOfflineTemplate);

  const goSetup = document.querySelector("#offlineGoSetupBtn");
  if (goSetup) goSetup.addEventListener("click", () => setView("setupAssistant"));

  const fileInput = document.querySelector("#offlineCsvFile");
  const textarea = document.querySelector("#offlineCsvInput");
  if (fileInput && textarea) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { textarea.value = String(reader.result || ""); };
      reader.readAsText(file);
    });
  }

  const resultEl = document.querySelector("#offlineResult");
  const showResult = (status, body, validateOnly) => {
    if (!resultEl) return;
    if (status >= 200 && status < 300) {
      if (validateOnly) {
        const errs = (body.rowErrors && body.rowErrors.length) ? `<ul class="offline-result-errs">${body.rowErrors.slice(0, 8).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "";
        resultEl.innerHTML = `<div class="badge ok">Valid</div> ${body.willSend} of ${body.received} rows ready to send.${errs}`;
      } else {
        resultEl.innerHTML = `<div class="badge ok">Uploaded</div> ${body.sent || 0} of ${body.received || 0} events sent to Meta.`;
        offlineTracking = null;
        renderOfflineConversions();
      }
    } else {
      const errs = (body.errors && body.errors.length) ? body.errors.join(" · ") : (body.error || "Upload failed.");
      resultEl.innerHTML = `<div class="badge warn">Error</div> ${escapeHtml(errs)}`;
    }
  };

  const validateBtn = document.querySelector("#offlineValidateBtn");
  if (validateBtn) validateBtn.addEventListener("click", async () => {
    const csv = (textarea.value || "").trim();
    if (!csv) { showResult(400, { error: "Paste CSV rows or choose a file first." }); return; }
    validateBtn.disabled = true;
    try { const { status, body } = await postOffline("/api/customer/offline-conversions/validate", csv); showResult(status, body, true); }
    finally { validateBtn.disabled = false; }
  });

  const sendBtn = document.querySelector("#offlineSendBtn");
  if (sendBtn) sendBtn.addEventListener("click", async () => {
    const csv = (textarea.value || "").trim();
    if (!csv) { showResult(400, { error: "Paste CSV rows or choose a file first." }); return; }
    if (!window.confirm("Upload these offline conversions to Meta?")) return;
    sendBtn.disabled = true;
    try { const { status, body } = await postOffline("/api/customer/offline-conversions", csv); showResult(status, body, false); }
    finally { sendBtn.disabled = false; }
  });

  const saveCookie = document.querySelector("#cookieExtSaveBtn");
  if (saveCookie) saveCookie.addEventListener("click", async () => {
    const enabled = document.querySelector("#cookieExtEnabled").checked;
    const days = Number(document.querySelector("#cookieExtDays").value) || 730;
    const msg = document.querySelector("#cookieExtMsg");
    saveCookie.disabled = true;
    try {
      const res = await fetch("/api/customer/cookie-extension", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, days })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { offlineTracking = body.tracking || offlineTracking; if (msg) { msg.textContent = "Saved."; msg.className = "muted-note ok-text"; } }
      else if (msg) { msg.textContent = body.error || "Save failed."; msg.className = "muted-note warn-text"; }
    } finally { saveCookie.disabled = false; }
  });
}

function renderCurrentView(data) {
  switch (currentViewName) {
    case "logs":
      renderLogs(data);
      break;
    case "analytics":
      renderAnalytics(data);
      break;
    case "settings":
      renderSettings(data);
      break;
    case "deployment":
      renderDeployment(data);
      break;
    case "provisioning":
      renderProvisioning(data);
      break;
    case "admin":
      renderAdmin(data);
      break;
    case "customers":
      renderCustomersView(data);
      break;
    case "customerAccountSettings":
      renderCustomerAccountSettings();
      break;
    case "customerContainers":
      renderCustomerContainers(data);
      break;
    case "powerUps":
      renderPowerUps(data);
      break;
    case "offlineConversions":
      renderOfflineConversions(data);
      break;
    case "setupAssistant":
      renderSetupAssistant(data);
      break;
    case "integrations":
      renderIntegrations(data);
      break;
    case "billing":
      renderBilling(data);
      break;
    case "docs":
      renderDocs(data);
      break;
    case "dashboard":
    default:
      renderDashboard(data);
      renderContainers(data.docker);
      break;
  }
}

function renderAll(data) {
  applySessionAccess(data);
  els.generatedAt.textContent = `Updated ${formatDate(data.generatedAt)}`;
  renderCurrentView(data);
}

async function loadDashboard() {
  els.refreshButton.disabled = true;
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
    latestData = data;
    renderAll(data);
    document.body.classList.remove("app-loading");
  } catch (error) {
    els.generatedAt.textContent = "Update failed";
    els.containerCards.innerHTML = `<div class="empty-log">${escapeHtml(error.message)}</div>`;
    document.body.classList.remove("app-loading");
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.viewTarget));
});

document.addEventListener("click", (event) => {
  const shortcut = event.target.closest("[data-view-shortcut]");
  if (shortcut) setView(shortcut.dataset.viewShortcut);
  const scrollTarget = event.target.closest("[data-scroll-target]");
  if (scrollTarget) {
    const targetEl = document.querySelector(`#${CSS.escape(scrollTarget.dataset.scrollTarget)}`);
    if (targetEl) {
      targetEl.hidden = false;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

// Invoice overlay: print + close.
document.addEventListener("click", (e) => {
  if (e.target.closest("#invoicePrintBtn")) { window.print(); return; }
  const closeInv = e.target.closest("#invoiceCloseBtn");
  const overlayBg = e.target.id === "invoiceOverlay";
  if (closeInv || overlayBg) {
    const ov = document.getElementById("invoiceOverlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("modal-open");
  }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chart-range]");
  if (!btn) return;
  customerChartRange = btn.dataset.chartRange;
  document.querySelectorAll("[data-chart-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
  if (latestData) {
    const summary = latestData.nginx?.todayEvents || {};
    renderCustomerAnalytics(summary, latestData.history?.daily || [], customerChartRange, summary);
  }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-kpi-range]");
  if (!btn) return;
  customerKpiRange = btn.dataset.kpiRange;
  document.querySelectorAll("[data-kpi-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
  if (latestData) renderCustomerPerformance(latestData, customerKpiRange);
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-purchase-range]");
  if (!btn) return;
  purchaseRange = btn.dataset.purchaseRange;
  document.querySelectorAll("[data-purchase-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
  if (latestData) renderPurchaseInspector(latestData);
});

els.refreshButton.addEventListener("click", loadDashboard);

// Payment modal: close on backdrop click, ✕, or "Done"; Esc key closes too.
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-payment-modal-close]")) { closePaymentModal(); return; }
  const overlay = document.getElementById("paymentModalOverlay");
  if (overlay && !overlay.hidden && event.target === overlay) closePaymentModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const overlay = document.getElementById("paymentModalOverlay");
    if (overlay && !overlay.hidden) closePaymentModal();
  }
});
els.dailyEventLogBody?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-drill='errors']");
  if (!btn || !els.eventStatusFilter) return;
  els.eventStatusFilter.value = "400";
  els.eventStatusFilter.dispatchEvent(new Event("change"));
  document.getElementById("nginx")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
els.eventStatusFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.eventTypeFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.clientFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.eventLimitFilter.addEventListener("change", () => latestData && renderLogs(latestData));
els.requestUrlFilter.addEventListener("input", () => latestData && renderLogs(latestData));
els.purchaseSearch.addEventListener("input", () => latestData && renderPurchaseInspector(latestData));
els.customerContainerSearch?.addEventListener("input", () => latestData && renderCustomerContainers(latestData));
els.assistantBack?.addEventListener("click", () => {
  setupAssistantStep = Math.max(1, setupAssistantStep - 1);
  updateSetupAssistantStep();
});
els.assistantNext?.addEventListener("click", async () => {
  if (setupAssistantStep < 4) {
    setupAssistantStep += 1;
    updateSetupAssistantStep();
    return;
  }
  await generateSetupAssistantTemplates();
});
els.downloadWebTemplate?.addEventListener("click", () => downloadGeneratedTemplate("web"));
els.downloadServerTemplate?.addEventListener("click", () => downloadGeneratedTemplate("server"));
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".download-plugin-btn");
  if (!btn) return;
  const errEl = document.querySelector("#pluginDownloadError");
  if (errEl) errEl.hidden = true;
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Downloading…";
  try {
    const res = await fetch("/api/customer/setup-assistant/plugin");
    if (!res.ok) {
      let msg;
      try { const j = await res.json(); msg = j.error || JSON.stringify(j); } catch { msg = await res.text(); }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tagioo-woocommerce.zip";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    if (errEl) { errEl.textContent = "Download failed: " + e.message; errEl.hidden = false; }
    else alert("Plugin download failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});
els.verifyTrackingBtn?.addEventListener("click", verifyTracking);

document.querySelector("#generateWooSecret")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const message = document.querySelector("#wooSecretMessage");
  const hasSecret = Boolean(document.querySelector("[data-woo-webhook-secret]")?.dataset.secret);
  if (hasSecret && !window.confirm("Generating a new secret invalidates the current one. WooCommerce webhooks using the old secret will stop working until updated. Continue?")) return;
  button.disabled = true;
  if (message) message.textContent = "Generating...";
  try {
    const response = await fetch("/api/customer/webhook-secret", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Could not generate secret."]).join(" "));
    setWooWebhookSecret(result.webhookSecret);
    if (message) message.textContent = "Secret generated. Paste it into the WooCommerce webhook form.";
  } catch (error) {
    if (message) message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#copyWooSecret")?.addEventListener("click", async () => {
  const secret = document.querySelector("[data-woo-webhook-secret]")?.dataset.secret;
  const message = document.querySelector("#wooSecretMessage");
  if (!secret) return;
  try {
    await navigator.clipboard.writeText(secret);
    if (message) message.textContent = "Secret copied to clipboard.";
  } catch {
    if (message) message.textContent = "Copy failed — select the secret text manually.";
  }
});

document.addEventListener("click", (e) => {
  const tab = e.target.closest(".instructions-tab");
  if (!tab) return;
  const key = tab.dataset.tab;
  const section = tab.closest(".instructions-code-section");
  if (!section) return;
  section.querySelectorAll(".instructions-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === key));
  section.querySelectorAll(".instructions-tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.tabPanel === key));
});
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
els.customerAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.customerAccountFormMessage.textContent = "Creating customer login...";
  const payload = Object.fromEntries(new FormData(els.customerAccountForm).entries());
  try {
    const response = await fetch("/api/customer-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Customer login failed"]).join(" "));
    els.customerAccountForm.reset();
    els.customerAccountFormMessage.textContent = `Login created for ${result.account.username}.`;
    await loadDashboard();
    setView("admin");
  } catch (error) {
    els.customerAccountFormMessage.textContent = error.message;
  }
});
els.workerNodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.workerNodeFormMessage.textContent = "Saving worker node...";
  const payload = Object.fromEntries(new FormData(els.workerNodeForm).entries());
  try {
    const response = await fetch("/api/worker-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Worker save failed"]).join(" "));
    els.workerNodeForm.reset();
    els.workerNodeFormMessage.textContent = `Worker saved: ${result.worker.name}.`;
    await loadDashboard();
    setView("admin");
  } catch (error) {
    els.workerNodeFormMessage.textContent = error.message;
  }
});
function renderCustomerAccountSettings() {
  if (latestData) renderAccountOverview(latestData, null);
  fetch("/api/customer/me")
    .then((r) => r.json())
    .then((result) => {
      if (!result.account) return;
      const { fullName, email, phone } = result.account;
      if (els.customerProfileName) els.customerProfileName.value = fullName || "";
      if (els.customerProfileEmail) els.customerProfileEmail.value = email || "";
      if (els.customerProfilePhone) els.customerProfilePhone.value = phone || "";
      renderAccountOverview(latestData, result.account);
    })
    .catch(() => {});
}

function renderAccountOverview(data, account) {
  if (!els.accountOverviewGrid) return;
  const usage = data?.usage || {};
  const tenant = data?.customers?.tenants?.[0] || {};
  const name = account?.fullName || tenant.fullName || tenant.name || "Your account";
  const email = account?.email || tenant.email || "—";
  const created = account?.createdAt || tenant.createdAt;
  const domain = data?.config?.tenantDomain || tenant.trackingDomain || "Not set up yet";
  const plan = usage.plan || tenant.plan || "Starter";
  const subStatus = (usage.subscriptionStatus || tenant.subscriptionStatus || "trial");
  const payStatus = (usage.paymentStatus || tenant.paymentStatus || "");
  const requestsMonth = Number(usage.requestsMonth || 0);
  const requestLimit = Number(usage.requestLimit || 0);
  const usagePercent = Number(usage.usagePercent || 0);
  const renewal = usage.renewalDate || usage.periodEnd;
  const webhookConfigured = Boolean(data?.webhookSecret) || Boolean(data?.orders?.configured);

  if (els.accountIdentityName) els.accountIdentityName.textContent = name;
  if (els.accountIdentityEmail) els.accountIdentityEmail.textContent = email;
  if (els.accountAvatar) els.accountAvatar.textContent = (name.trim()[0] || "T").toUpperCase();
  if (els.accountIdentitySince) {
    els.accountIdentitySince.textContent = created ? `Member since ${formatDate(created).split(",")[0]}` : "";
  }
  if (els.accountPlanBadge) {
    const ok = subStatus === "active";
    els.accountPlanBadge.innerHTML = `<span class="badge ${ok ? "ok" : "warn"}">${escapeHtml(plan)} · ${escapeHtml(subStatus)}</span>`;
  }

  const statusTone = subStatus === "active" ? "healthy" : subStatus === "trial" ? "warn" : "bad";
  const cards = [
    { label: "Plan", value: plan, detail: payStatus ? `Payment: ${payStatus}` : "Subscription plan", tone: "accent" },
    { label: "Subscription", value: subStatus.charAt(0).toUpperCase() + subStatus.slice(1), detail: renewal ? `Renews ${formatDate(renewal).split(",")[0]}` : "—", tone: statusTone },
    { label: "Usage this period", value: requestLimit ? `${usagePercent}%` : requestsMonth.toLocaleString(), detail: requestLimit ? `${requestsMonth.toLocaleString()} / ${requestLimit.toLocaleString()} requests` : "Requests this period", tone: usagePercent >= 90 ? "bad" : usagePercent >= 75 ? "warn" : "healthy" },
    { label: "Tracking domain", value: domain, detail: "Your first-party endpoint", tone: domain.includes(".") ? "healthy" : "warn", mono: true },
    { label: "Order webhook", value: webhookConfigured ? "Connected" : "Not connected", detail: webhookConfigured ? "Server-side purchase recovery active" : "Set up in Setup Assistant", tone: webhookConfigured ? "healthy" : "warn" },
    { label: "Support", value: "tagioo.com", detail: "We reply within a few hours", tone: "accent" }
  ];

  els.accountOverviewGrid.innerHTML = cards.map((c) => `
    <article class="account-card account-card-${c.tone || "healthy"}">
      <span class="account-card-label">${escapeHtml(c.label)}</span>
      <strong class="account-card-value${c.mono ? " mono" : ""}">${escapeHtml(String(c.value))}</strong>
      <span class="account-card-detail">${escapeHtml(c.detail)}</span>
    </article>
  `).join("");
}

els.accountSettingsTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (!tab) return;
  const target = tab.dataset.tab;
  els.accountSettingsTabs.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === target));
  const profileActive = target === "profile";
  els.accountProfilePanel.hidden = !profileActive;
  els.accountPasswordPanel.hidden = profileActive;
});

els.customerProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.customerProfileFormMessage.textContent = "Saving...";
  const payload = Object.fromEntries(new FormData(els.customerProfileForm).entries());
  try {
    const response = await fetch("/api/customer/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Save failed"]).join(" "));
    els.customerProfileFormMessage.textContent = "Profile updated.";
  } catch (error) {
    els.customerProfileFormMessage.textContent = error.message;
  }
});

els.customerPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.customerPasswordForm).entries());
  if (data.newPassword !== data.confirmPassword) {
    els.customerPasswordFormMessage.textContent = "New passwords do not match.";
    return;
  }
  els.customerPasswordFormMessage.textContent = "Changing password...";
  try {
    const response = await fetch("/api/customer/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Password change failed"]).join(" "));
    els.customerPasswordForm.reset();
    els.customerPasswordFormMessage.textContent = "Password changed successfully.";
  } catch (error) {
    els.customerPasswordFormMessage.textContent = error.message;
  }
});

els.customerSetupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Paywall: don't let a customer with an unpaid paid-plan invoice provision a
  // container. Steer them to billing. (Server also blocks this with a 402.)
  if (customerSubscriptionStatus === "pending_payment") {
    els.customerSetupFormMessage.textContent = "Complete your plan payment first — opening Account & Billing…";
    setView("billing");
    return;
  }
  els.customerSetupFormMessage.textContent = "Submitting setup request...";
  const payload = Object.fromEntries(new FormData(els.customerSetupForm).entries());
  try {
    const response = await fetch("/api/customer/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Setup request failed"]).join(" "));
    els.customerSetupFormMessage.textContent = `Container created for ${result.request.trackingDomain}.`;
    await loadDashboard();
    // Prefill the Setup Assistant tracking domain from the new container, then
    // send the user straight there to finish wiring GA4 / Meta / etc.
    if (els.setupAssistantForm) {
      const td = els.setupAssistantForm.elements.trackingDomain;
      if (td && !td.value) td.value = result.request.trackingDomain || "";
    }
    setView("setupAssistant");
    document.querySelector("#setupAssistantView")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    els.customerSetupFormMessage.textContent = error.message;
  }
});
window.addEventListener("hashchange", () => setView(window.location.hash.replace("#", "") || "dashboard"));

(async () => {
  await initSession();                                   // resolve role first (cheap)
  setView(window.location.hash.replace("#", "") || "dashboard");
  loadDashboard();                                       // heavy data; may fail without breaking access
  // Owner: keep the pending-payments nav badge fresh so new claims surface fast
  // from any view (the activation bottleneck is owner awareness, not clicks).
  if (currentSession.role === "owner") {
    loadOwnerPayments();
    setInterval(() => { loadOwnerPayments().catch(() => {}); }, 30000);
  }
})();
