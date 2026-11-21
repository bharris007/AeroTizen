// AeroTizen calendar relay: phone-to-TV pairing, Google sign-in and an events endpoint,
// plus the original ICS proxy. Calendar addresses and tokens are never logged.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import {
  authorizationUrl,
  exchangeCode,
  GoogleError,
  googleEndpoints,
  listCalendars,
  listEvents,
  refreshAccessToken,
  revokeToken,
} from "./google.js";
import { createKeys, decryptJson, encryptJson, randomId, signState, verifyState } from "./tokenCrypto.js";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;
const SESSION_TTL_MS = 15 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_CALENDARS_PER_SESSION = 12;
const MAX_GOOGLE_CALENDARS = 20;
const MAX_ICS_BYTES = 5 * 1024 * 1024;
const ICS_TIMEOUT_MS = 12 * 1000;
const MAX_NAME_LENGTH = 40;
const MAX_URL_LENGTH = 2048;
const MAX_EVENT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const SECRET_PATTERN = /^[a-f0-9]{32,64}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const PAIRINGS = "pairings/";
const ACCOUNTS = "accounts/";
const STATE_COOKIE = "aet_oauth";
export const DEFAULT_PUBLIC_URL = "https://aerotizen-cal.vercel.app";

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

const redirect = (location, headers = {}) =>
  new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", ...headers } });

const hashHex = (value) => createHash("sha256").update(value).digest("hex");

const newCode = () => {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
};

export const normalizeCode = (value) =>
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

const cleanName = (value, fallback) =>
  String(value || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH) || fallback;

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

const cookieValue = (request, name) => {
  const header = request.headers.get("cookie") || "";
  const match = header.split(/;\s*/).find((part) => part.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

export const createRelay = ({ env, fetchImpl, now = () => Date.now(), store }) => {
  const endpoints = googleEndpoints(env);
  const publicUrl = (env.PUBLIC_URL || DEFAULT_PUBLIC_URL).replace(/\/$/, "");
  const redirectUri = publicUrl + "/api/google/callback";
  let keys;
  const cryptoKeys = () => {
    keys = keys || createKeys(env.CALENDAR_TOKEN_KEY);
    return keys;
  };
  const googleReady = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.CALENDAR_TOKEN_KEY);
  const google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, endpoints, fetchImpl };

  const loadSession = async (code) => {
    if (!validCode(code)) {
      return null;
    }
    const session = await store.read(PAIRINGS + code + "/session.json");
    if (!session || typeof session.expiresAt !== "number" || session.expiresAt < now()) {
      return null;
    }
    return session;
  };

  const ownsHash = (secretHash, secret) => {
    if (typeof secret !== "string" || !SECRET_PATTERN.test(secret) || typeof secretHash !== "string") {
      return false;
    }
    const expected = Buffer.from(secretHash, "hex");
    const actual = Buffer.from(hashHex(secret), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  };

  const inbox = (code) => store.list(PAIRINGS + code + "/cal-");
  const queue = (code, item) =>
    store.write(PAIRINGS + code + "/cal-" + now() + "-" + newCode() + ".json", item, { expires: true });

  const fetchCalendar = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
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

  // --- Pairing ---------------------------------------------------------------------
  const createSession = async (request) => {
    const { secret } = await readBody(request);
    if (typeof secret !== "string" || !SECRET_PATTERN.test(secret)) {
      return json(400, { error: "bad-secret" });
    }
    const expiresAt = now() + SESSION_TTL_MS;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = newCode();
      try {
        await store.write(PAIRINGS + code + "/session.json", { expiresAt, secretHash: hashHex(secret) }, { expires: true });
        return json(200, { code, expiresAt });
      } catch {
        // Code collision: try another.
      }
    }
    return json(503, { error: "busy" });
  };

  const sessionStatus = async (code) => {
    const session = await loadSession(code);
    return session
      ? json(200, { expiresAt: session.expiresAt, google: googleReady(), ok: true })
      : json(404, { error: "expired" });
  };

  const addCalendar = async (code, request) => {
    if (!(await loadSession(code))) {
      return json(404, { error: "expired" });
    }
    const body = await readBody(request);
    const url = safeCalendarUrl(body.url);
    if (!url) {
      return json(400, { error: "bad-url" });
    }
    if ((await inbox(code)).length >= MAX_CALENDARS_PER_SESSION) {
      return json(429, { error: "too-many" });
    }
    const check = await fetchCalendar(url);
    if (!check.ok) {
      return json(422, { error: "unreachable", status: check.status });
    }
    const events = (check.text.match(/BEGIN:VEVENT/g) || []).length;
    const calendarName = (check.text.match(/^X-WR-CALNAME:(.*)$/m) || [])[1];
    const name = cleanName(body.name, cleanName(calendarName, "Calendar"));
    const color = COLOR_PATTERN.test(String(body.color)) ? String(body.color).toLowerCase() : "#4285f4";
    await queue(code, { color, name, url });
    return json(200, { events, name, ok: true });
  };

  const claimCalendars = async (code, request) => {
    const session = await loadSession(code);
    if (!session) {
      return json(404, { error: "expired" });
    }
    const { secret } = await readBody(request);
    if (!ownsHash(session.secretHash, secret)) {
      return json(403, { error: "forbidden" });
    }
    const paths = await inbox(code);
    const calendars = [];
    for (const pathname of paths) {
      const item = await store.read(pathname);
      if (item && typeof item === "object") {
        calendars.push(item);
      }
    }
    await store.remove(paths);
    return json(200, { calendars, expiresAt: session.expiresAt });
  };

  // --- Google sign-in ----------------------------------------------------------------
  const pairingPage = (code, params) => publicUrl + "/c/" + code + "?" + new URLSearchParams(params).toString();

  const startGoogle = async (url) => {
    const code = normalizeCode(url.searchParams.get("code"));
    if (!googleReady()) {
      return redirect(pairingPage(code, { error: "unavailable" }));
    }
    if (!(await loadSession(code))) {
      return redirect(pairingPage(code, { error: "expired" }));
    }
    const nonce = randomId();
    const state = signState(cryptoKeys(), { code, exp: now() + OAUTH_STATE_TTL_MS, nonce });
    return redirect(authorizationUrl({ clientId: env.GOOGLE_CLIENT_ID, endpoints, redirectUri, state }), {
      "Set-Cookie":
        STATE_COOKIE + "=" + nonce + "; Path=/api/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax",
    });
  };

  const googleCallback = async (request, url) => {
    if (!googleReady()) {
      return redirect(publicUrl + "/?error=unavailable");
    }
    const state = verifyState(cryptoKeys(), url.searchParams.get("state"));
    const clearCookie = { "Set-Cookie": STATE_COOKIE + "=; Path=/api/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax" };
    if (!state || typeof state.code !== "string" || typeof state.exp !== "number" || state.exp < now()) {
      return redirect(publicUrl + "/?error=signin", clearCookie);
    }
    const code = state.code;
    if (!state.nonce || cookieValue(request, STATE_COOKIE) !== state.nonce) {
      return redirect(pairingPage(code, { error: "signin" }), clearCookie);
    }
    if (url.searchParams.get("error")) {
      return redirect(pairingPage(code, { error: "denied" }), clearCookie);
    }
    const session = await loadSession(code);
    if (!session) {
      return redirect(pairingPage(code, { error: "expired" }), clearCookie);
    }
    try {
      const grant = await exchangeCode({ ...google, code: url.searchParams.get("code") || "", redirectUri });
      const calendars = await listCalendars({ ...google, accessToken: grant.accessToken });
      const link = randomId();
      await store.write(
        PAIRINGS + code + "/google-" + link + ".json",
        {
          sealed: encryptJson(cryptoKeys(), {
            calendars,
            email: grant.email,
            refreshToken: grant.refreshToken,
            subject: grant.subject,
          }),
        },
        { expires: true },
      );
      return redirect(pairingPage(code, { link }), clearCookie);
    } catch (error) {
      console.error("google callback failed", error instanceof GoogleError ? error.kind : error && error.name);
      return redirect(pairingPage(code, { error: "signin" }), clearCookie);
    }
  };

  const loadLink = async (code, link) => {
    if (!ID_PATTERN.test(link) || !(await loadSession(code))) {
      return null;
    }
    const stored = await store.read(PAIRINGS + code + "/google-" + link + ".json");
    return stored ? decryptJson(cryptoKeys(), stored.sealed) : null;
  };

  const showLink = async (code, link) => {
    const data = await loadLink(code, link);
    return data
      ? json(200, { calendars: data.calendars, email: data.email })
      : json(404, { error: "expired" });
  };

  const addGoogleCalendars = async (code, link, request) => {
    const session = await loadSession(code);
    const data = session ? await loadLink(code, link) : null;
    if (!data) {
      return json(404, { error: "expired" });
    }
    const { calendarIds } = await readBody(request);
    const wanted = new Set(Array.isArray(calendarIds) ? calendarIds.filter((id) => typeof id === "string") : []);
    const calendars = data.calendars
      .filter((calendar) => wanted.has(calendar.id))
      .slice(0, MAX_GOOGLE_CALENDARS)
      .map(({ color, id, name }) => ({ color, id, name }));
    if (!calendars.length) {
      return json(400, { error: "none-selected" });
    }
    // One record per TV and Google account; signing in again replaces it.
    const accountId = createHash("sha256")
      .update(session.secretHash + ":" + data.subject)
      .digest("base64url")
      .slice(0, 24)
      .replace(/[-_]/g, "x");
    await store.write(
      ACCOUNTS + accountId + ".json",
      {
        sealed: encryptJson(cryptoKeys(), { calendars, refreshToken: data.refreshToken }),
        secretHash: session.secretHash,
      },
      { overwrite: true },
    );
    await queue(code, { accountId, calendars, email: data.email, type: "google" });
    await store.remove([PAIRINGS + code + "/google-" + link + ".json"]);
    return json(200, { added: calendars.length, email: data.email, ok: true });
  };

  const loadAccount = async (accountId, secret) => {
    if (typeof accountId !== "string" || !ID_PATTERN.test(accountId)) {
      return null;
    }
    const record = await store.read(ACCOUNTS + accountId + ".json");
    if (!record || !ownsHash(record.secretHash, secret)) {
      return null;
    }
    const data = decryptJson(cryptoKeys(), record.sealed);
    return data && typeof data.refreshToken === "string" ? data : null;
  };

  const googleEvents = async (request) => {
    if (!googleReady()) {
      return json(503, { error: "unavailable" });
    }
    const body = await readBody(request);
    const account = await loadAccount(body.accountId, body.secret);
    if (!account) {
      return json(404, { error: "unknown-account" });
    }
    const from = Number(body.from);
    const to = Number(body.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_EVENT_WINDOW_MS) {
      return json(400, { error: "bad-window" });
    }
    const wanted = new Set(Array.isArray(body.calendarIds) ? body.calendarIds : []);
    const selected = account.calendars.filter((calendar) => wanted.has(calendar.id));
    let accessToken;
    try {
      accessToken = await refreshAccessToken({ ...google, refreshToken: account.refreshToken });
    } catch (error) {
      if (error instanceof GoogleError && error.kind === "revoked") {
        return json(401, { error: "reconnect" });
      }
      return json(502, { error: "google" });
    }
    const calendars = {};
    await Promise.all(
      selected.map(async (calendar) => {
        try {
          calendars[calendar.id] = { events: await listEvents({ ...google, accessToken, calendarId: calendar.id, from, to }) };
        } catch (error) {
          calendars[calendar.id] = { error: error instanceof GoogleError ? error.kind : "api" };
        }
      }),
    );
    if (selected.length && Object.values(calendars).every((item) => item.error === "revoked")) {
      return json(401, { error: "reconnect" });
    }
    return json(200, { calendars });
  };

  const removeAccount = async (request) => {
    const body = await readBody(request);
    const account = await loadAccount(body.accountId, body.secret);
    if (!account) {
      return json(200, { ok: true, removed: false });
    }
    await store.remove([ACCOUNTS + body.accountId + ".json"]);
    await revokeToken({ endpoints, fetchImpl, token: account.refreshToken });
    return json(200, { ok: true, removed: true });
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
    const parts = (url.searchParams.get("route") || url.pathname.replace(/^\/api\/?/, ""))
      .split("/")
      .filter(Boolean);
    const method = request.method;
    const path = parts.join("/");
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (path === "health" && method === "GET") {
      return json(200, { google: googleReady(), ok: true });
    }
    if (path === "ics" && method === "POST") {
      return proxyCalendar(request);
    }
    if (path === "events" && method === "POST") {
      return googleEvents(request);
    }
    if (path === "accounts/remove" && method === "POST") {
      return removeAccount(request);
    }
    if (path === "google/start" && method === "GET") {
      return startGoogle(url);
    }
    if (path === "google/callback" && method === "GET") {
      return googleCallback(request, url);
    }
    if (parts[0] === "google" && parts[1] === "link" && parts.length >= 4) {
      const code = normalizeCode(parts[2]);
      if (parts.length === 4 && method === "GET") {
        return showLink(code, parts[3]);
      }
      if (parts.length === 5 && parts[4] === "add" && method === "POST") {
        return addGoogleCalendars(code, parts[3], request);
      }
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

  return async (request) => {
    try {
      return await route(request);
    } catch (error) {
      // Log the error type only; requests can contain calendar addresses and tokens.
      console.error("relay error", error && error.name);
      return json(500, { error: "server" });
    }
  };
};
