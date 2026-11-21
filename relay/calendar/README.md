# Calendar relay

A small Vercel project that lets a phone add calendars to the launcher without typing on
the TV. Production: <https://aerotizen-cal.vercel.app>. The logic lives in `lib/app.js`
(`createRelay`) so it can run against an in-memory store in tests; `api/relay.js` wires it
to Vercel Blob.

## Pairing

- `POST /api/session` `{secret}`: the TV opens a 15-minute pairing session and gets an
  8-character code. Only a hash of the TV's secret is stored.
- `/c/<code>`: the phone page (`index.html`): "Sign in with Google", tick calendars,
  "Add to TV". Pasting an iCal link is still available under "Advanced".
- `POST /api/session/<code>/claim` `{secret}`: the TV collects queued items. They are
  deleted as soon as they are collected; anything unclaimed expires with the one-day TTL.

## Google sign-in

- `GET /api/google/start?code=<code>`: redirects to Google consent (`calendar.readonly`,
  `openid email`, offline access) with a signed state and a state cookie.
- `GET /api/google/callback`: checks state and cookie, exchanges the code, lists the
  account's calendars and keeps them (encrypted, with the refresh token) under the
  pairing session, then sends the phone back to `/c/<code>?link=<id>`.
- `GET /api/google/link/<code>/<id>` and `POST .../add` `{calendarIds}`: the phone's
  picker. Adding stores one durable record per TV and Google account under `accounts/`
  (AES-256-GCM, bound to the TV secret's hash) and queues `{type:"google", accountId,
  email, calendars}` for the TV. No tokens ever reach the TV.
- `POST /api/events` `{secret, accountId, calendarIds, from, to}`: up to 8 days of events
  per calendar (`singleEvents`, cancelled dropped) in the launcher's event model.
  `401 {error:"reconnect"}` when Google access was revoked or expired.
- `POST /api/accounts/remove` `{secret, accountId}`: deletes the record and revokes the
  token at Google.

## iCal links

- `POST /api/session/<code>/calendars` `{name, url, color}`: checks that the address is
  a reachable HTTPS calendar feed, then queues it for the TV.
- `POST /api/ics` `{url}`: CORS proxy for feeds the TV cannot fetch directly. Addresses
  travel in request bodies so they never appear in request logs, and nothing is stored.

## Configuration

Production environment variables (never commit them):

- `BLOB_READ_WRITE_TOKEN`: private Vercel Blob store, set by Vercel.
- `CALENDAR_TOKEN_KEY`: 32 random bytes, base64, used to encrypt stored sign-ins and
  sign OAuth state. Changing it signs every TV out of Google.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: a Google OAuth "Web application" client
  with the redirect URI `https://aerotizen-cal.vercel.app/api/google/callback`.

`/privacy` and `/terms` are the pages the Google consent screen links to. Deploy with
`vercel deploy --prod` from this directory after `vercel link`.
