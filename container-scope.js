function normalizedHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

export function customerContainerRequests(requests, tenantId) {
  return (requests || []).filter((request) =>
    request?.tenantId === tenantId && !["deleted", "delete_requested"].includes(String(request.status || "").toLowerCase())
  );
}

export function primaryContainerId(tenant, requests = []) {
  const owned = customerContainerRequests(requests, tenant?.id);
  const existingDomain = normalizedHost(tenant?.tracking?.domain);
  const matching = existingDomain && owned.find((request) => normalizedHost(request.trackingDomain) === existingDomain);
  // Existing accounts used their oldest container as their single tracking
  // destination. Keep that destination untouched if its domain was not saved yet.
  return matching?.id || owned.at(-1)?.id || "";
}

export function selectedContainer(tenant, requests = [], requestedId = "") {
  const owned = customerContainerRequests(requests, tenant?.id);
  return owned.find((request) => request.id === requestedId)
    || owned.find((request) => request.id === primaryContainerId(tenant, owned))
    || owned[0]
    || null;
}

export function trackingForContainer(tenant, requests = [], containerId = "") {
  const root = tenant?.tracking || {};
  if (!containerId || containerId === primaryContainerId(tenant, requests)) return root;
  const request = customerContainerRequests(requests, tenant?.id).find((item) => item.id === containerId);
  if (!request) return root;
  const scoped = root.containerConfigs?.[containerId];
  if (scoped && typeof scoped === "object") return scoped;
  return request.trackingDomain ? { domain: `https://${normalizedHost(request.trackingDomain)}` } : {};
}

export function setTrackingForContainer(tenant, requests = [], containerId = "", next = {}) {
  const root = { ...(tenant?.tracking || {}) };
  if (!containerId || containerId === primaryContainerId(tenant, requests)) {
    const existingConfigs = root.containerConfigs;
    const updated = { ...next };
    if (existingConfigs) updated.containerConfigs = existingConfigs;
    tenant.tracking = updated;
    return updated;
  }
  const owned = customerContainerRequests(requests, tenant?.id);
  if (!owned.some((request) => request.id === containerId)) return null;
  root.containerConfigs = { ...(root.containerConfigs || {}), [containerId]: { ...next } };
  tenant.tracking = root;
  return root.containerConfigs[containerId];
}

export function scopedTrackingEntries(tenant, requests = []) {
  const root = tenant?.tracking || {};
  const entries = [{ containerId: primaryContainerId(tenant, requests), tracking: root }];
  const ownedIds = new Set(customerContainerRequests(requests, tenant?.id).map((request) => request.id));
  for (const [containerId, tracking] of Object.entries(root.containerConfigs || {})) {
    if (ownedIds.has(containerId) && tracking && typeof tracking === "object") entries.push({ containerId, tracking });
  }
  return entries;
}
