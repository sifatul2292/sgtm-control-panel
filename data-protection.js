import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "TAGIOO-PROTECTED-V1:";
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

export function isProtectedText(value) {
  return String(value || "").startsWith(PREFIX);
}

export function protectText(plaintext, keyText) {
  const key = parseDataProtectionKey(keyText);
  if (!key) return String(plaintext);

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(PREFIX));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const envelope = {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
  return `${PREFIX}${Buffer.from(JSON.stringify(envelope)).toString("base64")}`;
}

export function unprotectText(value, keyText) {
  const text = String(value || "");
  if (!isProtectedText(text)) return text;

  const key = parseDataProtectionKey(keyText);
  if (!key) throw new Error("Encrypted Tagioo data cannot be read without TAGIOO_DATA_ENCRYPTION_KEY.");

  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(text.slice(PREFIX.length), "base64").toString("utf8"));
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(PREFIX));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    throw new Error(`Encrypted Tagioo data could not be authenticated: ${error.message}`);
  }
}

export function serializeProtectedJson(value, keyText) {
  return `${protectText(JSON.stringify(value, null, 2), keyText)}\n`;
}

export function parseProtectedJson(value, keyText) {
  return JSON.parse(unprotectText(String(value).trim(), keyText));
}
