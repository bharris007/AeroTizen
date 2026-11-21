// Encryption for refresh tokens at rest (AES-256-GCM) and signed OAuth state, both keyed
// from CALENDAR_TOKEN_KEY (32 random bytes, base64).
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const toBase64Url = (buffer) => Buffer.from(buffer).toString("base64url");
const fromBase64Url = (text) => Buffer.from(text, "base64url");

export const createKeys = (secret) => {
  const master = Buffer.from(String(secret || ""), "base64");
  if (master.length !== KEY_BYTES) {
    throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes of base64");
  }
  const derive = (label) => Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), label, KEY_BYTES));
  return { encryption: derive("aerotizen-token-encryption"), signing: derive("aerotizen-oauth-state") };
};

export const encryptJson = (keys, value) => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys.encryption, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return VERSION + "." + toBase64Url(Buffer.concat([iv, cipher.getAuthTag(), body]));
};

// Returns null for tampered, truncated or foreign data.
export const decryptJson = (keys, sealed) => {
  if (typeof sealed !== "string" || !sealed.startsWith(VERSION + ".")) {
    return null;
  }
  try {
    const raw = fromBase64Url(sealed.slice(VERSION.length + 1));
    const decipher = createDecipheriv("aes-256-gcm", keys.encryption, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const mac = (keys, payload) => toBase64Url(createHmac("sha256", keys.signing).update(payload).digest());

export const signState = (keys, value) => {
  const payload = toBase64Url(JSON.stringify(value));
  return payload + "." + mac(keys, payload);
};

export const verifyState = (keys, state) => {
  if (typeof state !== "string") {
    return null;
  }
  const [payload, signature] = state.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = Buffer.from(mac(keys, payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    return JSON.parse(fromBase64Url(payload).toString("utf8"));
  } catch {
    return null;
  }
};

export const randomId = (bytes = 16) => toBase64Url(randomBytes(bytes)).replace(/[-_]/g, "x");
