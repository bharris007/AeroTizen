// Google OAuth and Calendar API calls. Base URLs can be overridden for local testing.
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"];
const MAX_CALENDARS = 50;
const MAX_EVENTS_PER_CALENDAR = 250;
const MAX_TITLE_LENGTH = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

export const googleEndpoints = (env) => ({
  api: env.GOOGLE_API_URL || "https://www.googleapis.com",
  auth: env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
  revoke: env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke",
  token: env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
});

export const authorizationUrl = ({ clientId, endpoints, redirectUri, state }) => {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    include_granted_scopes: "true",
    prompt: "consent select_account",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return endpoints.auth + "?" + params.toString();
};

export class GoogleError extends Error {
  constructor(kind, status) {
    super("google " + kind);
    this.kind = kind;
    this.status = status;
  }
}

const postForm = async (fetchImpl, url, form) => {
  const response = await fetchImpl(url, {
    body: new URLSearchParams(form).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { body, response };
};

// Decodes the ID token that came straight from Google's token endpoint over TLS.
const idTokenClaims = (idToken) => {
  try {
    return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
};

export const exchangeCode = async ({ clientId, clientSecret, code, endpoints, fetchImpl, redirectUri }) => {
  const { body, response } = await postForm(fetchImpl, endpoints.token, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (!response.ok || typeof body.access_token !== "string") {
    throw new GoogleError("exchange", response.status);
  }
  if (typeof body.refresh_token !== "string") {
    throw new GoogleError("no-refresh-token", response.status);
  }
  const claims = idTokenClaims(body.id_token);
  if (typeof claims.sub !== "string") {
    throw new GoogleError("no-identity", response.status);
  }
  return {
    accessToken: body.access_token,
    email: typeof claims.email === "string" ? claims.email : "",
    refreshToken: body.refresh_token,
    subject: claims.sub,
  };
};

// Throws GoogleError("revoked") when the user removed access or the token expired.
export const refreshAccessToken = async ({ clientId, clientSecret, endpoints, fetchImpl, refreshToken }) => {
  const { body, response } = await postForm(fetchImpl, endpoints.token, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (response.ok && typeof body.access_token === "string") {
    return body.access_token;
  }
  throw new GoogleError(body.error === "invalid_grant" ? "revoked" : "refresh", response.status);
};

export const revokeToken = async ({ endpoints, fetchImpl, token }) => {
  try {
    await postForm(fetchImpl, endpoints.revoke, { token });
  } catch {
    // The stored token is deleted either way.
  }
};

const getJson = async (fetchImpl, url, accessToken) => {
  const response = await fetchImpl(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (response.status === 401) {
    throw new GoogleError("revoked", 401);
  }
  if (!response.ok) {
    throw new GoogleError(response.status === 404 ? "not-found" : "api", response.status);
  }
  return response.json();
};

const COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
const cleanText = (value, length) =>
  String(value || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, length);

// The account's calendars, primary first, with Google's own colours.
export const listCalendars = async ({ accessToken, endpoints, fetchImpl }) => {
  const data = await getJson(
    fetchImpl,
    endpoints.api + "/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250",
    accessToken,
  );
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((item) => item && typeof item.id === "string" && !item.deleted && !item.hidden)
    .map((item) => ({
      color: COLOUR_PATTERN.test(item.backgroundColor) ? item.backgroundColor.toLowerCase() : "#4285f4",
      id: item.id,
      name: cleanText(item.summaryOverride || item.summary || item.id, 60),
      primary: item.primary === true,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name))
    .slice(0, MAX_CALENDARS);
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayNumber = (date) => {
  const match = DATE_PATTERN.exec(String(date || ""));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS : null;
};

// Google events (singleEvents=true, so recurrences are already expanded) in the launcher's
// event model. Cancelled and malformed events are dropped.
export const normalizeEvent = (item) => {
  if (!item || item.status === "cancelled" || typeof item.id !== "string") {
    return null;
  }
  const title = cleanText(item.summary, MAX_TITLE_LENGTH);
  const start = item.start || {};
  const end = item.end || {};
  if (start.date) {
    const startDay = dayNumber(start.date);
    const endDay = dayNumber(end.date);
    if (startDay === null) {
      return null;
    }
    return { allDay: true, endDay: endDay !== null && endDay > startDay ? endDay : startDay + 1, id: item.id, startDay, title };
  }
  const startTime = Date.parse(start.dateTime);
  const endTime = Date.parse(end.dateTime);
  if (!Number.isFinite(startTime)) {
    return null;
  }
  return {
    allDay: false,
    end: Number.isFinite(endTime) && endTime >= startTime ? endTime : startTime,
    id: item.id,
    start: startTime,
    title,
  };
};

export const listEvents = async ({ accessToken, calendarId, endpoints, fetchImpl, from, to }) => {
  const params = new URLSearchParams({
    maxResults: String(MAX_EVENTS_PER_CALENDAR),
    orderBy: "startTime",
    showDeleted: "false",
    singleEvents: "true",
    timeMax: new Date(to).toISOString(),
    timeMin: new Date(from).toISOString(),
  });
  const data = await getJson(
    fetchImpl,
    endpoints.api + "/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events?" + params.toString(),
    accessToken,
  );
  return (Array.isArray(data.items) ? data.items : []).map(normalizeEvent).filter(Boolean);
};
