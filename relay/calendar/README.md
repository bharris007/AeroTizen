# Calendar relay

A small Vercel project that lets a phone add calendars to the launcher without typing on
the TV. Production: <https://aerotizen-cal.vercel.app>.

- `POST /api/session` `{secret}`: the TV opens a 15-minute pairing session and gets an
  8-character code. Only a hash of the TV's secret is stored.
- `/c/<code>`: the phone page (`index.html`). It explains how to copy a Google Calendar
  "Secret address in iCal format" and posts each calendar to the session.
- `POST /api/session/<code>/calendars` `{name, url, color}`: checks that the address is
  a reachable HTTPS calendar feed, then queues it for the TV.
- `POST /api/session/<code>/claim` `{secret}`: the TV collects queued calendars. They are
  deleted from the relay as soon as they are collected; anything unclaimed expires with
  the blob store's one-day TTL.
- `POST /api/ics` `{url}`: CORS proxy for feeds the TV cannot fetch directly. Addresses
  travel in request bodies so they never appear in request logs, and nothing is stored.

Storage is a private Vercel Blob store (`BLOB_READ_WRITE_TOKEN`, set by Vercel). Deploy
with `vercel deploy --prod` from this directory after `vercel link`.
