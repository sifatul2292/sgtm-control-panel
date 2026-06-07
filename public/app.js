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
  docsList: document.querySelector("#docsList")
};

const viewTitles = {
  dashboard: ["Dashboard", "Server Overview"],
  logs: ["Containers / Event Logs", "Event Logs"],
  analytics: ["Tracking / Analytics", "Analytics"],
  customerContainers: ["Containers / List", "Containers"],
  powerUps: ["Containers / Power-Ups", "Power-Ups"],
  setupAssistant: ["Setup Assistant / GTM Templates", "Setup Assistant"],
  settings: ["Account & Others / Settings", "Settings"],
  deployment: ["Operations / Deployment", "Deployment Health"],
  provisioning: ["Operations / Provisioning", "Container Provisioning"],
  admin: ["Service / Admin", "Admin"],
  integrations: ["Service / Integrations", "Integrations"],
  billing: ["Account & Billing", "My Subscription"],
  docs: ["Public / Docs", "Landing & Docs"]
};

let latestData = null;
let selectedCustomerContainerId = "";
let setupAssistantStep = 1;
let generatedAssistantTemplates = null;
let currentSession = { role: "pending" };
const ownerOnlyViews = new Set(["analytics", "settings", "deployment", "provisioning", "admin", "integrations", "docs"]);
const customerOnlyViews = new Set(["customerContainers", "powerUps", "setupAssistant"]);
const customerNavViews = new Set(["dashboard", "logs", "customerContainers", "powerUps", "setupAssistant", "billing"]);
const ownerNavViews = new Set(["dashboard", "admin", "provisioning", "logs", "billing", "settings", "deployment", "analytics", "integrations", "docs"]);

const subscriptionPlans = [
  {
    name: "Free",
    price: "Free",
    requests: 15000,
    containers: 2,
    domains: 1,
    receivers: 5,
    retention: "3 days log retention",
    features: ["Email Support", "Consent Mode V2 (GDPR)", "Bot Detection & Filtering", "Custom Loader", "Custom Domain", "First-Party Domain", "Event Logs"]
  },
  {
    name: "Starter",
    price: "৳1,200",
    requests: 500000,
    containers: 5,
    domains: 1,
    receivers: 5,
    retention: "7 days log retention",
    features: ["Live Chat", "Free Migration", "Consent Mode V2 (GDPR)", "Custom Loader", "Custom Domain", "First-Party Domain", "Cookie Life Extension", "Advanced Reports", "Event Logs"]
  },
  {
    name: "Pro",
    price: "৳2,900",
    requests: 2000000,
    containers: 15,
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
    containers: 100,
    domains: 10,
    receivers: 5,
    retention: "30 days log retention",
    features: ["Priority Migration", "Dedicated Support", "Multi-Domain Support", "Advanced Reports", "Traffic Filtering, IP, Country Block", "Bot Detection & Filtering", "Event Logs", "WordPress Plugin"]
  }
];

const planRank = { Free: 0, Starter: 1, Growth: 2, Pro: 3, Enterprise: 4, Agency: 4 };

const powerUps = [
  {
    id: "cookie-keeper",
    name: "Cookie Keeper",
    category: "Popular",
    icon: "●",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Extends cookie lifetime through your first-party tracking domain for cleaner attribution."
  },
  {
    id: "custom-loader",
    name: "Custom Loader",
    category: "Web GTM load",
    icon: "</>",
    minimumPlan: "Pro",
    defaultState: "configure",
    recommended: true,
    description: "Makes GTM and GA scripts more resilient to basic blockers by loading from your tracking subdomain."
  },
  {
    id: "click-id-restorer",
    name: "Click ID Restorer",
    category: "Data enrich",
    icon: "↗",
    minimumPlan: "Pro",
    defaultState: "configure",
    description: "Preserves gclid, fbclid, ttclid, and other click IDs so ad platforms can match conversions better."
  },
  {
    id: "bot-detection",
    name: "Bot Detection",
    category: "Utilities",
    icon: "◇",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Marks suspicious traffic and keeps noisy requests separate from clean tracking activity."
  },
  {
    id: "geo-headers",
    name: "GEO Headers",
    category: "Data enrich",
    icon: "◎",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Adds country and region hints for debugging server-side tracking quality."
  },
  {
    id: "user-agent-info",
    name: "User Agent Info",
    category: "Data enrich",
    icon: "▥",
    minimumPlan: "Starter",
    defaultState: "enabled",
    description: "Shows device, browser, and platform context in request diagnostics."
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

function setView(name) {
  const requested = viewTitles[name] ? name : "dashboard";
  const roleKnown = currentSession.role === "customer" || currentSession.role === "owner";
  const next =
    (roleKnown && currentSession.role === "customer" && ownerOnlyViews.has(requested)) ||
    (roleKnown && currentSession.role !== "customer" && customerOnlyViews.has(requested))
      ? "dashboard"
      : requested;
  els.views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === next));
  els.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.viewTarget === next));
  els.breadcrumb.textContent = currentSession.role === "customer" && next === "dashboard" ? "Dashboard" : viewTitles[next][0];
  els.pageTitle.textContent = currentSession.role === "customer" && next === "dashboard" ? "Tracking Overview" : viewTitles[next][1];
  window.location.hash = next;
}

function applySessionAccess(data) {
  currentSession = data.session || { role: "owner" };
  const customerMode = currentSession.role === "customer";
  document.body.classList.remove("app-loading");
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
    setView("dashboard");
  } else {
    setView(window.location.hash.replace("#", "") || "dashboard");
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
    host: item.host || "Unknown host",
    requestUrl: item.requestUrl || item.path || "",
    tracking: true,
    eventName: item.eventName || "Other",
    value: item.value,
    currency: item.currency,
    eventId: item.eventId,
    transactionId: item.transactionId,
    detail: eventDetail(item)
  }));
}

function renderEventLogStats(allItems, visibleItems) {
  if (!els.eventLogStats) return;
  const total = allItems.length;
  const visible = visibleItems.length;
  const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
  const purchases = visibleItems.filter((item) => item.eventName === "Purchase").length;
  const clients = new Set(visibleItems.map((item) => item.client).filter(Boolean)).size;
  renderBusinessGrid(els.eventLogStats, [
    { label: "Filtered", value: visible.toLocaleString(), detail: `${total.toLocaleString()} latest loaded` },
    { label: "Success", value: Math.max(0, visible - errors).toLocaleString(), detail: "2xx / 3xx requests" },
    { label: "Errors", value: errors.toLocaleString(), detail: "4xx / 5xx requests" },
    { label: "Purchases", value: purchases.toLocaleString(), detail: `${clients.toLocaleString()} client${clients === 1 ? "" : "s"}` }
  ]);
}

function renderEventTable(data) {
  const summary = data.nginx?.todayEvents;
  const serverItems = serverEventRows(data);
  const log = data.nginx?.accessLog;

  if (summary?.available && serverItems.length) {
    updateEventFilters(serverItems);
    const visibleItems = serverItems.filter(visibleEvent);
    renderEventLogStats(serverItems, visibleItems);
    const errors = visibleItems.filter((item) => Number(item.status) >= 400).length;
    const limit = Number(els.eventLimitFilter?.value || 50);
    els.eventLogSummary.textContent = `Showing ${Math.min(visibleItems.length, limit).toLocaleString()} of ${visibleItems.length.toLocaleString()} matching events from the latest ${serverItems.length.toLocaleString()} today (${errors.toLocaleString()} errors).`;
    renderEventRows(visibleItems, "No matching tracking events found for today's filters.");
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

function renderPurchaseInspector(data) {
  const query = els.purchaseSearch.value.trim().toLowerCase();
  const rows = purchaseRows(data).filter((item) => {
    const haystack = [
      item.eventId,
      item.transactionId,
      item.value,
      item.currency,
      item.host,
      item.path,
      item.client
    ].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  els.purchaseInspectorBadge.className = "badge";
  els.purchaseInspectorBadge.classList.add(rows.length ? "ok" : "warn");
  els.purchaseInspectorBadge.textContent = `${rows.length} match${rows.length === 1 ? "" : "es"}`;

  if (!rows.length) {
    els.purchaseInspector.innerHTML = '<div class="empty-log">No purchase requests matched.</div>';
    return;
  }

  els.purchaseInspector.replaceChildren(
    ...rows.slice(0, 12).map((item) => {
      const card = document.createElement("article");
      card.className = "inspector-card";
      card.innerHTML = `
        <div class="inspector-card-top">
          <strong>${escapeHtml(item.displayDate)}</strong>
          <span class="status-code ${Number(item.status) >= 400 ? "bad" : "good"}">${escapeHtml(item.status)}</span>
        </div>
        <div class="inspector-grid">
          <span>Client</span><strong>${escapeHtml(item.client || "Other")}</strong>
          <span>Host</span><strong>${escapeHtml(item.host || "Unknown host")}</strong>
          <span>Value</span><strong>${escapeHtml(item.value && item.currency ? `${item.value} ${item.currency}` : "Missing")}</strong>
          <span>Event ID</span><strong>${escapeHtml(item.eventId || "Missing")}</strong>
          <span>Transaction ID</span><strong>${escapeHtml(item.transactionId || "Missing")}</strong>
          <span>URL</span><strong>${escapeHtml(item.path || "")}</strong>
        </div>
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
  const orderToday = data.orders?.today;
  if (orderToday?.count) {
    return {
      rawCount: Number(orderToday.count) || 0,
      uniqueCount: Number(orderToday.count) || 0,
      duplicateCount: 0,
      keyedCount: Number(orderToday.count) || 0,
      estimatedKeyCount: 0,
      uniqueRevenue: Number(orderToday.revenue) || 0,
      rawRevenue: Number(orderToday.revenue) || 0,
      averageOrderValue: Number(orderToday.averageOrderValue) || 0,
      currency: orderToday.currency || "",
      source: "orders"
    };
  }

  const summary = data.nginx?.todayEvents?.purchases;
  const stat = reliableEventStats(data).get("Purchase");
  return {
    rawCount: Number(summary?.rawCount ?? eventRawCount(stat)) || 0,
    uniqueCount: Number(summary?.uniqueCount ?? eventDisplayCount("Purchase", stat)) || 0,
    duplicateCount: Number(summary?.duplicateCount ?? stat?.duplicateCount) || 0,
    keyedCount: Number(summary?.keyedCount ?? stat?.keyedCount) || 0,
    estimatedKeyCount: Number(summary?.estimatedKeyCount ?? stat?.estimatedKeyCount) || 0,
    uniqueRevenue: Number(summary?.uniqueRevenue ?? stat?.uniqueRevenue) || 0,
    rawRevenue: Number(summary?.rawRevenue ?? stat?.rawRevenue) || 0,
    averageOrderValue: Number(summary?.averageOrderValue ?? stat?.averageOrderValue) || 0,
    currency: summary?.currency || stat?.currency || "",
    source: "tracking"
  };
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

function renderCustomerPerformance(data) {
  const summary = data.nginx?.todayEvents || {};
  const purchases = purchaseSummary(data);
  const totalEvents = Number(summary.count || 0);
  const purchaseCount = Number(purchases.uniqueCount || 0);
  const conversion = totalEvents ? Math.round((purchaseCount / totalEvents) * 100) : 0;
  renderBusinessGrid(els.customerPerformanceGrid, [
    { label: "Events", value: totalEvents.toLocaleString(), detail: `${Number(data.usage?.usagePercent || 0)}% used` },
    { label: "Today", value: Number(data.usage?.requestsToday || totalEvents || 0).toLocaleString(), detail: "Clean tracking requests" },
    { label: "Revenue", value: purchases.uniqueRevenue ? formatMoney(purchases.uniqueRevenue, purchases.currency) : "0", detail: "Tracked purchase value" },
    { label: "Conversion", value: `${conversion}%`, detail: `${purchaseCount.toLocaleString()} / ${totalEvents.toLocaleString()}` },
    { label: "Purchases", value: purchaseCount.toLocaleString(), detail: "This month" }
  ]);
  renderCustomerAnalytics(summary);
}

function renderCustomerAnalytics(summary) {
  if (els.customerEventChart) {
    const hourly = Array.isArray(summary.hourly) ? summary.hourly : [];
    const points = hourly.length ? hourly.map((row) => Number(row.total || 0)) : Array.from({ length: 12 }, () => 0);
    const max = Math.max(1, ...points);
    const width = 640;
    const height = 220;
    const pad = { left: 54, right: 18, top: 18, bottom: 42 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
    const coords = points.map((value, index) => {
      const x = pad.left + index * step;
      const y = pad.top + plotHeight - (value / max) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const areaPoints = `${pad.left},${pad.top + plotHeight} ${coords} ${pad.left + plotWidth},${pad.top + plotHeight}`;
    const mid = Math.ceil(max / 2);
    els.customerEventChart.innerHTML = `
      <div class="chart-explainer">
        <strong>Server events per hour</strong>
        <span>Y-axis is event count. X-axis runs from 24 hours ago to now.</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Hourly event trend">
        <defs>
          <linearGradient id="customerChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity=".22" />
            <stop offset="1" stop-color="currentColor" stop-opacity=".02" />
          </linearGradient>
        </defs>
        <line class="chart-grid-line" x1="${pad.left}" y1="${pad.top}" x2="${pad.left + plotWidth}" y2="${pad.top}" />
        <line class="chart-grid-line" x1="${pad.left}" y1="${pad.top + plotHeight / 2}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight / 2}" />
        <line class="chart-axis-line" x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}" />
        <text class="chart-axis-text" x="${pad.left - 10}" y="${pad.top + 4}" text-anchor="end">${max}</text>
        <text class="chart-axis-text" x="${pad.left - 10}" y="${pad.top + plotHeight / 2 + 4}" text-anchor="end">${mid}</text>
        <text class="chart-axis-text" x="${pad.left - 10}" y="${pad.top + plotHeight + 4}" text-anchor="end">0</text>
        <text class="chart-axis-text" x="${pad.left}" y="${height - 12}" text-anchor="start">24h ago</text>
        <text class="chart-axis-text" x="${pad.left + plotWidth}" y="${height - 12}" text-anchor="end">Now</text>
        <text class="chart-axis-title" x="16" y="${pad.top + plotHeight / 2}" transform="rotate(-90 16 ${pad.top + plotHeight / 2})" text-anchor="middle">Events</text>
        <polygon class="chart-area" points="${areaPoints}" />
        <polyline class="chart-line" points="${coords}" />
      </svg>
    `;
  }

  const events = (summary.events || []).filter((row) => Number(row.count || 0) > 0);
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
  els.customerContainersBadge.className = `badge ${requests.length ? "ok" : "warn"}`;
  els.customerContainersBadge.textContent = `${requests.length} container${requests.length === 1 ? "" : "s"}`;
  if (!requests.length) {
    selectedCustomerContainerId = "";
    els.customerContainersTable.innerHTML = `<article class="empty-container-list">
      <strong>No containers yet</strong>
      <p>Create your first container below. Tagioo will keep DNS, Docker, Nginx, and SSL status easy to follow.</p>
      <button class="button button-primary" type="button" data-scroll-target="customerContainerCreate">Create Container</button>
    </article>`;
    if (els.customerContainerDetail) {
      els.customerContainerDetail.innerHTML = `<section class="panel container-empty-detail">
        <h2>Create a container to see setup details</h2>
        <p>After launch, this area will show the server container URL, first-party domain, DNS record, logs, and quick links.</p>
      </section>`;
    }
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
  const usagePercent = requestLimit ? Math.min(100, Math.round((monthRequests / requestLimit) * 100)) : 0;
  const limits = request.resourceLimits || {};
  const serverUrl = request.trackingDomain ? `https://${request.trackingDomain}` : "Tracking domain pending";
  const platformUrl = request.platformDomain || serverUrl;
  const canDelete = !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase());
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
          <span>of ${Number(requestLimit).toLocaleString()} requests sent this month</span>
          <em>${usagePercent}% used</em>
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
            <p>Core GTM configuration and isolated runtime identity.</p>
          </div>
          <span class="badge">Settings</span>
        </div>
        <div class="detail-setting-list">
          ${detailSetting("Name", containerDisplayName(request))}
          ${detailSetting("Type", request.containerType || "sGTM (Server-Side GTM)")}
          ${detailSetting("Container Config", request.containerConfig ? "Configured" : "Missing")}
          ${detailSetting("sGTM Container ID", request.sgtmContainerId || "GTM server ID unavailable")}
          ${detailSetting("Preview Environment", request.previewEnvironment || "Production")}
          ${detailSetting("Recent Requests", Number(requestCount || 0).toLocaleString())}
          ${detailSetting("API Key", request.apiKey || "Auto-managed by Tagioo")}
        </div>
      </article>

      <article class="panel container-detail-panel">
        <div class="panel-header">
          <div>
            <h2>sGTM Cloud</h2>
            <p>Use these URLs in Google Tag Manager and your first-party setup.</p>
          </div>
          <span class="badge ${meta.className === "healthy" ? "ok" : "warn"}">${escapeHtml(meta.badge)}</span>
        </div>
        <div class="cloud-url-list">
          ${cloudUrlRow("Server Container URL", platformUrl, "Default Tagioo hosted endpoint for this container.")}
          ${cloudUrlRow("First-Party Domain", serverUrl, "Use this as the Server Container URL in your GTM Web Container tags.")}
          ${cloudUrlRow("Location", request.serverLocation || "Bangladesh BDIX", "Closest available worker region for your traffic.")}
          ${cloudUrlRow("Resource Limit", limits.memoryMb ? `${limits.memoryMb} MB memory, ${limits.cpuLimit || "CPU default"}` : "Plan default", "Keeps each customer container isolated.")}
        </div>
      </article>

      <article class="panel container-detail-panel domain-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Domains</h2>
            <p>Your tagging server URLs and the DNS record needed for first-party tracking.</p>
          </div>
          <span class="badge">1/1</span>
        </div>
        <div class="domain-live-card">
          <strong>${escapeHtml(serverUrl)}</strong>
          <span>Domain: ${escapeHtml(meta.className === "healthy" ? "Active" : "Waiting")} · SSL: ${escapeHtml(meta.className === "healthy" ? "Active" : "Provisioning")}</span>
        </div>
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
      </article>

      <article class="panel container-detail-panel support-detail-panel">
        <div class="panel-header">
          <div>
            <h2>Tagioo Care</h2>
            <p>Get help reviewing tags, DNS, purchase value, and event deduplication.</p>
          </div>
        </div>
        <div class="care-panel-body">
          <strong>Personal setup help</strong>
          <p>We can audit your GTM web tags, server tags, and Meta event match quality before launch.</p>
          <button class="button" type="button">Get a quote</button>
        </div>
      </article>

      <article class="panel container-detail-panel quick-links-panel">
        <div class="panel-header">
          <div>
            <h2>Quick Links</h2>
            <p>Jump to the pages most customers need after launch.</p>
          </div>
        </div>
        <div class="quick-link-list">
          <button type="button" data-view-shortcut="logs">View Logs</button>
          <button type="button" data-view-shortcut="powerUps">Power-Ups</button>
          <button type="button" data-view-shortcut="billing">My Subscription</button>
          ${canDelete ? `<button class="danger-link" type="button" data-container-delete="${escapeHtml(request.id)}">Delete Container</button>` : ""}
        </div>
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
  return item.defaultState === "configure" ? "configure" : "enabled";
}

function powerUpActionLabel(state) {
  if (state === "enabled") return "Enabled";
  if (state === "configure") return "Configure";
  if (state === "upgrade") return "Upgrade to use";
  return "Coming soon";
}

function renderPowerUps(data) {
  if (!els.powerUpsGrid) return;
  const planName = data.usage?.plan || "Starter";
  const categories = ["All", ...new Set(powerUps.map((item) => item.category))];
  const visiblePowerUps = activePowerUpCategory === "All"
    ? powerUps
    : powerUps.filter((item) => item.category === activePowerUpCategory);
  const enabledCount = powerUps.filter((item) => powerUpState(item, planName) === "enabled").length;

  if (els.powerUpsBadge) {
    els.powerUpsBadge.className = "badge ok";
    els.powerUpsBadge.textContent = `${enabledCount} enabled`;
  }

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

  els.powerUpsGrid.innerHTML = visiblePowerUps.map((item) => {
    const state = powerUpState(item, planName);
    const recommended = item.recommended ? `<span class="powerup-recommended">Recommended</span>` : "";
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
      <button class="button ${state === "upgrade" ? "button-primary" : ""}" type="button" data-powerup-action="${escapeHtml(item.id)}" data-powerup-state="${state}">
        ${escapeHtml(powerUpActionLabel(state))}
      </button>
    </article>`;
  }).join("");

  els.powerUpsGrid.querySelectorAll("[data-powerup-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = powerUps.find((entry) => entry.id === button.dataset.powerupAction);
      const state = button.dataset.powerupState;
      if (!item) return;
      if (state === "upgrade") {
        setView("billing");
        return;
      }
      if (els.powerUpsMessage) {
        els.powerUpsMessage.textContent = state === "coming"
          ? `${item.name} is coming soon.`
          : `${item.name} settings will be configurable in the next version.`;
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
  updateSetupAssistantStep();
}

function updateSetupAssistantStep() {
  document.querySelectorAll("[data-assistant-step-label]").forEach((item) => {
    const step = Number(item.dataset.assistantStepLabel);
    item.classList.toggle("is-active", step === setupAssistantStep);
    item.classList.toggle("is-complete", step < setupAssistantStep);
  });
  document.querySelectorAll("[data-assistant-step]").forEach((panel) => {
    panel.classList.toggle("is-active", Number(panel.dataset.assistantStep) === setupAssistantStep);
  });
  if (els.assistantBack) els.assistantBack.disabled = setupAssistantStep === 1;
  if (els.assistantNext) els.assistantNext.textContent = setupAssistantStep === 4 ? "Generate templates" : "Next";
  if (els.setupAssistantBadge) {
    els.setupAssistantBadge.textContent = `Step ${setupAssistantStep} of 4`;
  }
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
  renderEventHealth(data);
  renderAlerts(data);
  renderHostBreakdown(data);
  renderQualityChecks(data);
  renderNoiseSummary(data);
  renderLatestPurchase(data);
  renderBusinessSnapshot(data);
  renderReconciliation(data);
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

function renderAnalytics(data) {
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
  els.analyticsModeBadge.textContent = "Recent sample";
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
  const customers = data.owner?.customers || data.customers?.tenants || [];
  els.adminBadge.textContent = customers.length ? `${customers.length} tenant${customers.length === 1 ? "" : "s"}` : "No tenants";
  els.customersBadge.className = `badge ${customers.length ? "ok" : "warn"}`;
  els.customersBadge.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"}`;

  renderSummaryList(
    els.customersList,
    customers.length
      ? customers.map((customer) => ({
        label: customer.name || customer.id,
        value: `${customer.domain || "No domain"} · ${customer.plan || "No plan"} · ${String(customer.subscriptionStatus || customer.status || "unknown").replaceAll("_", " ")}`,
        status: customer.subscriptionStatus === "active" && !customer.unpaid ? "healthy" : "warning"
      }))
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
      title: "WooCommerce mapping",
      body: `order_id: id or number\ntotal: total\ncurrency: currency\ncreated_at: date_created_gmt\norder_type: woocommerce`
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
  return plan.price === "Free" ? "Free" : `${plan.price}<small>/month</small>`;
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
  els.billingBadge.textContent = usage.status === "over_limit" ? "Over limit" : usage.status === "warning" ? "Watch usage" : "Healthy";
  els.planBadge.className = `badge ${statusClass}`;
  els.planBadge.textContent = activePlanName;

  els.billingGrid.innerHTML = `
    <div class="subscription-plan-name">
      <span>Current Plan</span>
      <strong>${escapeHtml(activePlanName)}</strong>
      <small>${escapeHtml(String(usage.subscriptionStatus || "Monthly billing"))}</small>
      <p>${escapeHtml(renewalText(usage.renewalDate))}</p>
      <div class="subscription-feature-heading">Plan Features</div>
      ${planFeatureList([`${activePlan.requests.toLocaleString()} / month requests`, `${activePlan.containers} containers`, `${activePlan.domains} domain${activePlan.domains === 1 ? "" : "s"}`, `${activePlan.receivers} receivers / container`, activePlan.retention, ...activePlan.features])}
    </div>
    <div class="subscription-price-block">
      <strong>${formatPlanPrice(activePlan)}</strong>
      <span>${activePlan.price === "Free" ? "per month" : "BDT per month"}</span>
    </div>
  `;

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
    </div>
  `;

  if (els.subscriptionPlans) {
    els.subscriptionPlans.innerHTML = subscriptionPlans
      .filter((plan) => plan.name !== "Free")
      .map((plan) => `
        <article class="subscription-plan-card ${plan.popular ? "is-popular" : ""}">
          ${plan.popular ? `<span class="popular-label">Most Popular</span>` : ""}
          <h3>${escapeHtml(plan.name)}</h3>
          <div class="plan-price">${formatPlanPrice(plan)}</div>
          ${planFeatureList([`${plan.requests.toLocaleString()} events/month`, `${plan.containers} containers`, `${plan.domains} domain${plan.domains === 1 ? "" : "s"}`, `${plan.receivers} receivers/container`, plan.retention, ...plan.features])}
          <button class="button ${plan.name === activePlanName ? "" : "button-primary"}" type="button" data-plan-select="${escapeHtml(plan.name)}">
            ${plan.name === activePlanName ? "Current Plan" : "Select Plan"}
          </button>
        </article>
      `).join("");
    els.subscriptionPlans.querySelectorAll("[data-plan-select]").forEach((button) => {
      button.addEventListener("click", () => selectSubscriptionPlan(button.dataset.planSelect));
    });
  }
  document.querySelectorAll("[data-plan-action]").forEach((button) => {
    button.onclick = () => selectSubscriptionPlan(button.dataset.planAction);
  });
}

async function selectSubscriptionPlan(planName) {
  try {
    const response = await fetch("/api/customer/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planName })
    });
    const result = await response.json();
    if (!response.ok) throw new Error((result.errors || [result.error || "Plan update failed."]).join(" "));
    await loadDashboard();
    setView("billing");
  } catch (error) {
    if (els.billingBadge) els.billingBadge.textContent = error.message;
  }
}

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

function renderLogs(data) {
  renderEventTable(data);
  renderPurchaseInspector(data);
  setLog(els.errorLog, data.nginx.errorLog, "error");
  setLog(els.dockerLog, data.dockerLogs, "docker");
  els.dockerLogSource.textContent = data.dockerLogs.container || "tail";
  els.dockerLogHelp.textContent = data.dockerLogs.container
    ? `Preview from ${data.dockerLogs.container}.`
    : "Preview from the first running container.";
}

function renderAll(data) {
  applySessionAccess(data);
  els.generatedAt.textContent = `Updated ${formatDate(data.generatedAt)}`;
  renderDashboard(data);
  renderContainers(data.docker);
  renderLogs(data);
  renderAnalytics(data);
  renderSettings(data);
  renderDeployment(data);
  renderProvisioning(data);
  renderAdmin(data);
  renderCustomerContainers(data);
  renderPowerUps(data);
  renderSetupAssistant(data);
  renderIntegrations(data);
  renderBilling(data);
  renderDocs(data);
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
    document.querySelector(`#${CSS.escape(scrollTarget.dataset.scrollTarget)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

els.refreshButton.addEventListener("click", loadDashboard);
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
els.customerSetupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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
    setView("dashboard");
  } catch (error) {
    els.customerSetupFormMessage.textContent = error.message;
  }
});
window.addEventListener("hashchange", () => setView(window.location.hash.replace("#", "") || "dashboard"));

setView(window.location.hash.replace("#", "") || "dashboard");
loadDashboard();
