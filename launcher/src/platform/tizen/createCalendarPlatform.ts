import type { CalendarPlatform } from "../../contracts/familyCalendar";

const REQUEST_TIMEOUT_MS = 15 * 1000;

// XMLHttpRequest works on every supported TV engine. POST bodies are sent as text/plain
// so the relay needs no CORS preflight.
export const createCalendarPlatform = (host: { XMLHttpRequest: typeof XMLHttpRequest }): CalendarPlatform => ({
  request({ body, method, url }, done) {
    const request = new host.XMLHttpRequest();
    let finished = false;
    const finish = (status: number, text: string) => {
      if (!finished) {
        finished = true;
        done(status, text);
      }
    };
    request.onload = () => finish(request.status, request.responseText || "");
    request.onerror = request.ontimeout = request.onabort = () => finish(0, "");
    try {
      request.open(method, url);
      request.timeout = REQUEST_TIMEOUT_MS;
      if (body !== undefined) {
        request.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
      }
      request.send(body ?? null);
    } catch {
      finish(0, "");
    }
    return () => {
      if (finished) {
        return;
      }
      finished = true;
      try {
        request.abort();
      } catch {
        // A closed request stays cancelled.
      }
    };
  },
});
