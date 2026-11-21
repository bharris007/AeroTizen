const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const lib = (name) => import(pathToFileURL(path.join(__dirname, "..", "relay", "calendar", "lib", name)).href);

const SECRET = "0123456789abcdef0123456789abcdef";
const OTHER_SECRET = "fedcba9876543210fedcba9876543210";
const KEY = Buffer.alloc(32, 7).toString("base64");
const BASE = "https://aerotizen-cal.vercel.app";
const ENV = {
  CALENDAR_TOKEN_KEY: KEY,
  GOOGLE_API_URL: "https://google.test/api",
  GOOGLE_AUTH_URL: "https://google.test/auth",
  GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "shh",
  GOOGLE_REVOKE_URL: "https://google.test/revoke",
  GOOGLE_TOKEN_URL: "https://google.test/token",
};

const idToken = (claims) => ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockGoogle(overrides = {}) {
  const calls = [];
  const state = { revoked: false, ...overrides };
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const form = init.body ? new URLSearchParams(String(init.body)) : new URLSearchParams();
    calls.push({ form, headers: init.headers || {}, url });
    if (url.href === ENV.GOOGLE_TOKEN_URL) {
      if (form.get("grant_type") === "authorization_code") {
        return form.get("code") === "good-code"
          ? jsonResponse(200, {
              access_token: "access-1",
              id_token: idToken({ email: "bryan@example.com", sub: "sub-bryan" }),
              refresh_token: "refresh-1",
            })
          : jsonResponse(400, { error: "invalid_grant" });
      }
      return state.revoked
        ? jsonResponse(400, { error: "invalid_grant" })
        : jsonResponse(200, { access_token: "access-2" });
    }
    if (url.href === ENV.GOOGLE_REVOKE_URL) {
      return jsonResponse(200, {});
    }
    if (url.pathname.endsWith("/calendarList")) {
      return jsonResponse(200, {
        items: [
          { backgroundColor: "#16A765", id: "family@group.calendar.google.com", summary: "Family" },
          { backgroundColor: "#9FC6E7", id: "bryan@example.com", primary: true, summary: "bryan@example.com" },
          { hidden: true, id: "hidden@group", summary: "Hidden" },
          { backgroundColor: "not-a-colour", id: "holidays", summary: "Holidays", summaryOverride: "UK holidays" },
        ],
      });
    }
    if (url.pathname.includes("/events")) {
      return jsonResponse(200, {
        items: [
          {
            end: { dateTime: "2026-11-21T10:00:00-06:00" },
            id: "a",
            start: { dateTime: "2026-11-21T09:00:00-06:00" },
            summary: "Swim",
          },
          { end: { date: "2026-11-23" }, id: "b", start: { date: "2026-11-21" }, summary: "Trip" },
          { id: "c", start: { dateTime: "2026-11-21T12:00:00Z" }, status: "cancelled", summary: "Gone" },
        ],
      });
    }
    return jsonResponse(404, {});
  };
  return { calls, fetchImpl, state };
}

async function setup(env = ENV, google = mockGoogle()) {
  const { createRelay } = await lib("app.js");
  const { createMemoryStore } = await lib("store.js");
  const store = createMemoryStore();
  const handler = createRelay({ env, fetchImpl: google.fetchImpl, store });
  const call = (method, route, body, headers = {}) =>
    handler(
      new Request(BASE + "/api/" + route, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers,
        method,
      }),
    );
  const session = await (await call("POST", "session", { secret: SECRET })).json();
  return { call, code: session.code, google, handler, store };
}

async function signIn(context) {
  const start = await context.call("GET", "google/start?code=" + context.code);
  const location = new URL(start.headers.get("location"));
  const cookie = start.headers.get("set-cookie").split(";")[0];
  const callback = await context.call(
    "GET",
    "google/callback?code=good-code&state=" + encodeURIComponent(location.searchParams.get("state")),
    undefined,
    { cookie },
  );
  return { callback, cookie, location, start };
}

test("token encryption round-trips and rejects tampering or the wrong key", async () => {
  const { createKeys, decryptJson, encryptJson, signState, verifyState } = await lib("tokenCrypto.js");
  const keys = createKeys(KEY);
  const sealed = encryptJson(keys, { refreshToken: "refresh-1" });
  assert.match(sealed, /^v1\./);
  assert.ok(!sealed.includes("refresh-1"));
  assert.deepEqual(decryptJson(keys, sealed), { refreshToken: "refresh-1" });
  assert.notEqual(encryptJson(keys, { refreshToken: "refresh-1" }), sealed);
  const flipped = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.slice(-1);
  assert.equal(decryptJson(keys, flipped), null);
  assert.equal(decryptJson(createKeys(Buffer.alloc(32, 8).toString("base64")), sealed), null);
  assert.equal(decryptJson(keys, "garbage"), null);
  const state = signState(keys, { code: "ABCD2345" });
  assert.deepEqual(verifyState(keys, state), { code: "ABCD2345" });
  assert.equal(verifyState(keys, state + "x"), null);
});

test("Google sign-in redirects with offline read-only consent and a state cookie", async () => {
  const context = await setup();
  const { location, start } = await signIn(context);
  assert.equal(start.status, 302);
  assert.equal(location.origin + location.pathname, ENV.GOOGLE_AUTH_URL);
  assert.equal(location.searchParams.get("client_id"), ENV.GOOGLE_CLIENT_ID);
  assert.equal(location.searchParams.get("redirect_uri"), BASE + "/api/google/callback");
  assert.equal(location.searchParams.get("access_type"), "offline");
  assert.match(location.searchParams.get("prompt"), /consent/);
  assert.equal(location.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/calendar.readonly");
  assert.match(
    start.headers.get("set-cookie"),
    /^aet_oauth=[^;]+; Path=\/api\/google;.*HttpOnly; Secure; SameSite=Lax/,
  );
});

test("the OAuth callback exchanges the code and offers the account's calendars", async () => {
  const context = await setup();
  const { callback } = await signIn(context);
  const target = new URL(callback.headers.get("location"));
  assert.equal(target.pathname, "/c/" + context.code);
  const link = target.searchParams.get("link");
  assert.ok(link);
  const exchange = context.google.calls.find((item) => item.form.get("grant_type") === "authorization_code");
  assert.equal(exchange.form.get("redirect_uri"), BASE + "/api/google/callback");
  assert.equal(exchange.form.get("client_secret"), "shh");
  const stored = JSON.stringify([...context.store.items.values()]);
  assert.ok(!stored.includes("refresh-1"), "refresh token is stored encrypted");
  const offer = await (await context.call("GET", "google/link/" + context.code + "/" + link)).json();
  assert.equal(offer.email, "bryan@example.com");
  assert.deepEqual(offer.calendars, [
    { color: "#9fc6e7", id: "bryan@example.com", name: "bryan@example.com", primary: true },
    { color: "#16a765", id: "family@group.calendar.google.com", name: "Family", primary: false },
    { color: "#4285f4", id: "holidays", name: "UK holidays", primary: false },
  ]);
});

test("the OAuth callback rejects a missing cookie, a forged state and a denied consent", async () => {
  const context = await setup();
  const { location, cookie } = await signIn(context);
  const state = encodeURIComponent(location.searchParams.get("state"));
  const noCookie = await context.call("GET", "google/callback?code=good-code&state=" + state);
  assert.match(noCookie.headers.get("location"), /error=signin/);
  const forged = await context.call("GET", "google/callback?code=good-code&state=v1.forged", undefined, { cookie });
  assert.match(forged.headers.get("location"), /error=signin/);
  const denied = await context.call("GET", "google/callback?error=access_denied&state=" + state, undefined, { cookie });
  assert.match(denied.headers.get("location"), /error=denied/);
  const badCode = await context.call("GET", "google/callback?code=bad&state=" + state, undefined, { cookie });
  assert.match(badCode.headers.get("location"), /error=signin/);
});

test("sign-in is unavailable until the Google client is configured", async () => {
  const context = await setup({ CALENDAR_TOKEN_KEY: KEY });
  const start = await context.call("GET", "google/start?code=" + context.code);
  assert.match(start.headers.get("location"), /\/c\/[A-Z0-9]{8}\?error=unavailable$/);
  const status = await (await context.call("GET", "session/" + context.code)).json();
  assert.equal(status.google, false);
});

async function addAccount(context) {
  const { callback } = await signIn(context);
  const link = new URL(callback.headers.get("location")).searchParams.get("link");
  const added = await context.call("POST", "google/link/" + context.code + "/" + link + "/add", {
    calendarIds: ["bryan@example.com", "family@group.calendar.google.com", "not-offered"],
  });
  const claim = await (await context.call("POST", "session/" + context.code + "/claim", { secret: SECRET })).json();
  return { added: await added.json(), claim, link };
}

test("adding calendars stores one encrypted account and queues it for the TV", async () => {
  const context = await setup();
  const { added, claim, link } = await addAccount(context);
  assert.deepEqual(added, { added: 2, email: "bryan@example.com", ok: true });
  assert.equal(claim.calendars.length, 1);
  const item = claim.calendars[0];
  assert.equal(item.type, "google");
  assert.equal(item.email, "bryan@example.com");
  assert.match(item.accountId, /^[A-Za-z0-9]{24}$/);
  assert.deepEqual(item.calendars, [
    { color: "#9fc6e7", id: "bryan@example.com", name: "bryan@example.com" },
    { color: "#16a765", id: "family@group.calendar.google.com", name: "Family" },
  ]);
  assert.ok(!JSON.stringify(item).includes("refresh"));
  const accounts = [...context.store.items.keys()].filter((key) => key.startsWith("accounts/"));
  assert.deepEqual(accounts, ["accounts/" + item.accountId + ".json"]);
  const reused = await context.call("GET", "google/link/" + context.code + "/" + link);
  assert.equal(reused.status, 404, "the sign-in link is single-use");
});

test("the events endpoint returns normalized Google events for the TV that owns the account", async () => {
  const context = await setup();
  const { claim } = await addAccount(context);
  const { accountId } = claim.calendars[0];
  const from = Date.parse("2026-11-20T00:00:00Z");
  const to = Date.parse("2026-11-24T00:00:00Z");
  const reply = await context.call("POST", "events", {
    accountId,
    calendarIds: ["family@group.calendar.google.com", "holidays"],
    from,
    secret: SECRET,
    to,
  });
  assert.equal(reply.status, 200);
  const body = await reply.json();
  assert.deepEqual(Object.keys(body.calendars), ["family@group.calendar.google.com"]);
  assert.deepEqual(body.calendars["family@group.calendar.google.com"].events, [
    {
      allDay: false,
      end: Date.parse("2026-11-21T16:00:00Z"),
      id: "a",
      start: Date.parse("2026-11-21T15:00:00Z"),
      title: "Swim",
    },
    {
      allDay: true,
      endDay: Date.UTC(2026, 10, 23) / 86400000,
      id: "b",
      startDay: Date.UTC(2026, 10, 21) / 86400000,
      title: "Trip",
    },
  ]);
  const request = context.google.calls.find((item) => item.url.pathname.includes("/events"));
  assert.equal(request.url.searchParams.get("singleEvents"), "true");
  assert.equal(request.url.searchParams.get("timeMin"), "2026-11-20T00:00:00.000Z");
  assert.equal(request.headers.Authorization, "Bearer access-2");

  const stranger = await context.call("POST", "events", { accountId, calendarIds: [], from, secret: OTHER_SECRET, to });
  assert.equal(stranger.status, 404);
  const tooWide = await context.call("POST", "events", {
    accountId,
    calendarIds: [],
    from,
    secret: SECRET,
    to: from + 41 * 86400000,
  });
  assert.equal(tooWide.status, 400);
});

test("a revoked Google token asks the TV to reconnect", async () => {
  const google = mockGoogle();
  const context = await setup(ENV, google);
  const { claim } = await addAccount(context);
  google.state.revoked = true;
  const reply = await context.call("POST", "events", {
    accountId: claim.calendars[0].accountId,
    calendarIds: ["bryan@example.com"],
    from: Date.now(),
    secret: SECRET,
    to: Date.now() + 86400000,
  });
  assert.equal(reply.status, 401);
  assert.deepEqual(await reply.json(), { error: "reconnect" });
});

test("removing an account deletes the stored token and revokes it at Google", async () => {
  const context = await setup();
  const { claim } = await addAccount(context);
  const { accountId } = claim.calendars[0];
  const wrong = await (await context.call("POST", "accounts/remove", { accountId, secret: OTHER_SECRET })).json();
  assert.equal(wrong.removed, false);
  const removed = await (await context.call("POST", "accounts/remove", { accountId, secret: SECRET })).json();
  assert.equal(removed.removed, true);
  assert.equal([...context.store.items.keys()].filter((key) => key.startsWith("accounts/")).length, 0);
  const revoke = context.google.calls.find((item) => item.url.href === ENV.GOOGLE_REVOKE_URL);
  assert.equal(revoke.form.get("token"), "refresh-1");
});

test("Google event normalization drops cancelled and malformed events", async () => {
  const { normalizeEvent } = await lib("google.js");
  assert.equal(normalizeEvent({ id: "x", status: "cancelled", start: { date: "2026-01-01" } }), null);
  assert.equal(normalizeEvent({ id: "x", start: {} }), null);
  assert.equal(normalizeEvent({ start: { date: "2026-01-01" } }), null);
  assert.deepEqual(normalizeEvent({ id: "x", start: { date: "2026-01-01" }, summary: " New\nYear " }), {
    allDay: true,
    endDay: Date.UTC(2026, 0, 1) / 86400000 + 1,
    id: "x",
    startDay: Date.UTC(2026, 0, 1) / 86400000,
    title: "New Year",
  });
});

test("the events endpoint follows Google's pages and allows a five-week window", async () => {
  const google = mockGoogle();
  const pages = [];
  const base = google.fetchImpl;
  google.fetchImpl = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/events")) {
      pages.push(url.searchParams.get("pageToken"));
      const token = url.searchParams.get("pageToken");
      return jsonResponse(200, {
        items: [
          { end: { date: "2026-12-02" }, id: "p" + (token || "0"), start: { date: "2026-12-01" }, summary: "Page" },
        ],
        nextPageToken: token ? undefined : "second",
      });
    }
    return base(input, init);
  };
  const context = await setup(ENV, google);
  const { claim } = await addAccount(context);
  const from = Date.parse("2026-11-14T00:00:00Z");
  const reply = await context.call("POST", "events", {
    accountId: claim.calendars[0].accountId,
    calendarIds: ["bryan@example.com"],
    from,
    secret: SECRET,
    to: from + 37 * 86400000,
  });
  assert.equal(reply.status, 200);
  const body = await reply.json();
  assert.deepEqual(
    body.calendars["bryan@example.com"].events.map((event) => event.id),
    ["p0", "psecond"],
  );
  assert.deepEqual(pages, [null, "second"]);
});
