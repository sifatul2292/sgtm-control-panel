import { gzip, gunzipSync } from "node:zlib";
import { promisify } from "node:util";

const compress = promisify(gzip);
const states = new WeakMap();

// Keep historical event detail out of auth/billing JSON parsing. This is lossless
// and stays inside the existing encrypted, atomically-written database file.
export function attachEventHistory(data, source) {
  const archive = source.tenantEventHistoryArchive;
  if (archive && (archive.codec !== "gzip-json-v1" || typeof archive.data !== "string")) {
    throw new Error("Unsupported event-history archive.");
  }
  const state = { archive, loaded: !archive, value: source.tenantEventHistory || {} };
  states.set(data, state);
  delete data.tenantEventHistoryArchive;
  Object.defineProperty(data, "tenantEventHistory", {
    enumerable: true, configurable: true,
    get() {
      if (!state.loaded) {
        state.value = JSON.parse(gunzipSync(Buffer.from(state.archive.data, "base64")).toString());
        state.loaded = true;
      }
      return state.value;
    },
    set(value) { state.value = value; state.loaded = true; }
  });
  return data;
}

export async function archiveEventHistory(data) {
  const state = states.get(data);
  if (!state && data.tenantEventHistoryArchive && !Object.hasOwn(data, "tenantEventHistory")) {
    // Imported/restored core snapshot: preserve its archive, never replace it
    // with an empty history just because this object did not pass through read.
    return archiveEventHistory(attachEventHistory({ ...data }, data));
  }
  const core = {};
  for (const key of Object.keys(data)) {
    if (key !== "tenantEventHistory" && key !== "tenantEventHistoryArchive") core[key] = data[key];
  }
  if (state?.archive && !state.loaded) {
    core.tenantEventHistoryArchive = state.archive;
  } else {
    const history = data.tenantEventHistory || {};
    core.tenantEventHistoryArchive = { codec: "gzip-json-v1", data: (await compress(JSON.stringify(history))).toString("base64") };
  }
  return core;
}

export function unpackEventHistory(source) {
  const data = attachEventHistory({ ...source }, source);
  // Explicitly materialize before returning a legacy-reader-compatible object.
  return { ...data, tenantEventHistory: data.tenantEventHistory };
}
