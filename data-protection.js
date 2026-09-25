import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const V1_PREFIX = "TAGIOO-PROTECTED-V1:";
export const V2_MAGIC = Buffer.from("TAGIOO-PROTECTED-V2\n");
const ALGORITHM = "aes-256-gcm";

export function dataProtectionEnabled(keyText) {
  return Boolean(String(keyText || "").trim());
}

export function parseDataProtectionKey(keyText) {
  const value = String(keyText || "").trim();
  if (!value) return null;

  let key;
  try {
    key = Buffer.from(value, "base64");
  } catch {
    throw new Error("TAGIOO_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")) {
    throw new Error("TAGIOO_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(String(value));
}

export function isProtectedText(value) {
  const data = asBuffer(value);
  return data.subarray(0, V2_MAGIC.length).equals(V2_MAGIC)
    || data.subarray(0, V1_PREFIX.length).toString() === V1_PREFIX;
}

export function protectText(plaintext, keyText) {
  const key = parseDataProtectionKey(keyText);
  if (!key) return String(plaintext);

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(V2_MAGIC);
  const ciphertext = Buffer.concat([cipher.update(asBuffer(plaintext)), cipher.final()]);
  return Buffer.concat([V2_MAGIC, iv, ciphertext, cipher.getAuthTag()]);
}

export function unprotectText(value, keyText) {
  const data = asBuffer(value);
  if (data.subarray(0, V2_MAGIC.length).equals(V2_MAGIC)) {
    const key = parseDataProtectionKey(keyText);
    if (!key) throw new Error("Encrypted Tagioo data cannot be read without TAGIOO_DATA_ENCRYPTION_KEY.");
    if (data.length < V2_MAGIC.length + 12 + 16) throw new Error("Encrypted Tagioo data is truncated.");
    try {
      const ivStart = V2_MAGIC.length;
      const cipherStart = ivStart + 12;
      const tagStart = data.length - 16;
      const decipher = createDecipheriv(ALGORITHM, key, data.subarray(ivStart, cipherStart));
      decipher.setAAD(V2_MAGIC);
      decipher.setAuthTag(data.subarray(tagStart));
      return Buffer.concat([decipher.update(data.subarray(cipherStart, tagStart)), decipher.final()]);
    } catch (error) {
      throw new Error(`Encrypted Tagioo data could not be authenticated: ${error.message}`);
    }
  }

  const text = data.toString();
  if (!text.startsWith(V1_PREFIX)) return text;
  const key = parseDataProtectionKey(keyText);
  if (!key) throw new Error("Encrypted Tagioo data cannot be read without TAGIOO_DATA_ENCRYPTION_KEY.");
  try {
    const envelope = JSON.parse(Buffer.from(text.slice(V1_PREFIX.length), "base64").toString("utf8"));
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(V1_PREFIX));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]);
  } catch (error) {
    throw new Error(`Encrypted Tagioo data could not be authenticated: ${error.message}`);
  }
}

export function serializeProtectedJson(value, keyText) {
  const plaintext = `${JSON.stringify(value, null, 2)}\n`;
  return protectText(plaintext, keyText);
}

export function parseProtectedJson(value, keyText) {
  const plaintext = unprotectText(value, keyText);
  return JSON.parse(Buffer.isBuffer(plaintext) ? plaintext.toString("utf8") : plaintext);
}
