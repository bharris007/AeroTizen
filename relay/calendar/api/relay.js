// AeroTizen calendar relay: short-lived phone-to-TV pairing mailbox and a CORS ICS proxy.
// Calendar addresses are secrets. They are kept only until the TV claims them (or the
// pairing expires) and are never logged.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { del, get, list, put } from "@vercel/blob";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;
const SESSION_TTL_MS = 15 * 60 * 1000;
const BLOB_TTL_DAYS = 1;
const MAX_CALENDARS_PER_SESSION = 12;
const MAX_ICS_BYTES = 5 * 1024 * 1024;
const ICS_TIMEOUT_MS = 12 * 1000;
const MAX_NAME_LENGTH = 40;
const MAX_URL_LENGTH = 2048;
const SECRET_PATTERN = /^[a-f0-9]{32,64}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const PREFIX = "pairings/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const hash = (value) => createHash("sha256").update(value).digest();

const newCode = () => {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
};

const normalizeCode = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1");

const validCode = (code) => code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

const readBody = async (request) => {
  try {
    const text = await request.text();
    return text.length > 16 * 1024 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
};

const readJsonBlob = async (pathname) => {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || !result.stream) {
    return null;
  }
  const text = await new Response(result.stream).text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const writeJsonBlob = (pathname, value) =>
  put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    ttlDays: BLOB_TTL_DAYS,
  });

const loadSession = async (code) => {
  if (!validCode(code)) {
    return null;
  }
  const session = await readJsonBlob(PREFIX + code + "/session.json");
  if (!session || typeof session.expiresAt !== "number" || session.expiresAt < Date.now()) {
    return null;
  }
  return session;
};

const ownsSession = (session, secret) => {
  if (typeof secret !== "string" || !SECRET_PATTERN.test(secret)) {
    return false;
  }
  const expected = Buffer.from(session.secretHash, "hex");
  const actual = hash(secret);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const listInbox = async (code) => {
  const { blobs } = await list({ prefix: PREFIX + code + "/cal-", limit: 100 });
  return blobs;
};

// Only public HTTPS hosts. Rejects IP literals and local names so the proxy cannot reach
// private networks.
export const safeCalendarUrl = (value) => {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) {
    return null;
  }
  let url;
  try {
    url = new URL(value.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "localhost"
  ) {
    return null;
  }
  return url.toString();
};

const fetchCalendar = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "AeroTizen-Calendar/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const text = await response.text();
    if (text.length > MAX_ICS_BYTES) {
      return { ok: false, status: 413 };
    }
    if (!/BEGIN:VCALENDAR/.test(text.slice(0, 2048))) {
      return { ok: false, status: 415 };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, status: 504 };
  } finally {
    clearTimeout(timer);
  }
};

const createSession = async (request) => {
  const { secret } = await readBody(request);
  if (typeof secret !== "string" || !SECRET_PATTERN.test(secret)) {
    return json(400, { error: "bad-secret" });
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newCode();
    try {
      await writeJsonBlob(PREFIX + code + "/session.json", { secretHash: hash(secret).toString("hex"), expiresAt });
      return json(200, { code, expiresAt });
    } catch {
      // Code collision (the blob already exists): try another.
    }
  }
  return json(503, { error: "busy" });
};

const sessionStatus = async (code) => {
  const session = await loadSession(code);
  return session ? json(200, { ok: true, expiresAt: session.expiresAt }) : json(404, { error: "expired" });
};

const addCalendar = async (code, request) => {
  const session = await loadSession(code);
  if (!session) {
    return json(404, { error: "expired" });
  }
  const body = await readBody(request);
  const url = safeCalendarUrl(body.url);
  if (!url) {
    return json(400, { error: "bad-url" });
  }
  const name = String(body.name || "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  const color = COLOR_PATTERN.test(String(body.color)) ? String(body.color).toLowerCase() : "#4285f4";
  const inbox = await listInbox(code);
  if (inbox.length >= MAX_CALENDARS_PER_SESSION) {
    return json(429, { error: "too-many" });
  }
  const check = await fetchCalendar(url);
  if (!check.ok) {
    return json(422, { error: "unreachable", status: check.status });
  }
  const events = (check.text.match(/BEGIN:VEVENT/g) || []).length;
  const calendarName = (check.text.match(/^X-WR-CALNAME:(.*)$/m) || [])[1];
  const finalName = name || (calendarName ? calendarName.trim().slice(0, MAX_NAME_LENGTH) : "Calendar");
  await writeJsonBlob(PREFIX + code + "/cal-" + Date.now() + "-" + newCode() + ".json", {
    color,
    name: finalName,
    url,
  });
  return json(200, { ok: true, events, name: finalName });
};

const claimCalendars = async (code, request) => {
  const session = await loadSession(code);
  if (!session) {
    return json(404, { error: "expired" });
  }
  const { secret } = await readBody(request);
  if (!ownsSession(session, secret)) {
    return json(403, { error: "forbidden" });
  }
  const inbox = await listInbox(code);
  const calendars = [];
  for (const blob of inbox.sort((a, b) => a.pathname.localeCompare(b.pathname))) {
    const item = await readJsonBlob(blob.pathname);
    if (item && typeof item.url === "string") {
      calendars.push({ color: item.color, name: item.name, url: item.url });
    }
  }
  if (inbox.length) {
    await del(inbox.map((blob) => blob.url));
  }
  return json(200, { calendars, expiresAt: session.expiresAt });
};

const proxyCalendar = async (request) => {
  const { url: requested } = await readBody(request);
  const url = safeCalendarUrl(requested);
  if (!url) {
    return json(400, { error: "bad-url" });
  }
  const result = await fetchCalendar(url);
  if (!result.ok) {
    return json(502, { error: "upstream", status: result.status });
  }
  return new Response(result.text, {
    status: 200,
    headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
};

const route = async (request) => {
  const url = new URL(request.url);
  const parts = (url.searchParams.get("route") || "").split("/").filter(Boolean);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (parts[0] === "health" && method === "GET") {
    return json(200, { ok: true });
  }
  if (parts[0] === "ics" && method === "POST") {
    return proxyCalendar(request);
  }
  if (parts[0] !== "session") {
    return json(404, { error: "not-found" });
  }
  if (parts.length === 1 && method === "POST") {
    return createSession(request);
  }
  const code = normalizeCode(parts[1]);
  if (parts.length === 2 && method === "GET") {
    return sessionStatus(code);
  }
  if (parts.length === 3 && parts[2] === "calendars" && method === "POST") {
    return addCalendar(code, request);
  }
  if (parts.length === 3 && parts[2] === "claim" && method === "POST") {
    return claimCalendars(code, request);
  }
  return json(404, { error: "not-found" });
};

const handle = async (request) => {
  try {
    return await route(request);
  } catch (error) {
    // Log the error type only; request bodies can contain calendar addresses.
    console.error("relay error", error && error.name);
    return json(500, { error: "server" });
  }
};

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
