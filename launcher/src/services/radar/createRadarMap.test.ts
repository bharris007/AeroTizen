import { expect, test, vi } from "vitest";

import type { WeatherPlatform } from "../../contracts/status";

import { createRadarMap } from "./createRadarMap";
import { RAIN_VIEWER_MAPS_URL } from "./rainViewer";

const maps = (times: readonly number[]) => ({
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: times.map((time) => ({ path: "/v2/radar/" + time.toString(16), time })),
  },
});

const harness = () => {
  const requests: { abort: ReturnType<typeof vi.fn>; done: (data: unknown) => void; url: string }[] = [];
  let interval: (() => void) | undefined;
  const platform: WeatherPlatform = {
    requestJSON(url, done) {
      const abort = vi.fn();
      requests.push({ abort, done, url });
      return abort;
    },
  };
  const service = createRadarMap({
    platform,
    timers: {
      clearInterval: vi.fn(),
      setInterval: vi.fn((callback: () => void) => {
        interval = callback;
        return 1;
      }),
    },
  });
  return { interval: () => interval, requests, service };
};

test("fetches RainViewer only while a view is watching and does not refetch for a second watcher", () => {
  const { requests, service } = harness();
  expect(requests).toHaveLength(0);
  expect(service.getSnapshot()).toMatchObject({ frames: [], status: "loading" });

  const stopFirst = service.watch();
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(RAIN_VIEWER_MAPS_URL);
  const stopSecond = service.watch();
  expect(requests).toHaveLength(1);

  requests[0].done(maps([10, 20, 30]));
  expect(service.getSnapshot()).toMatchObject({
    host: "https://tilecache.rainviewer.com",
    status: "ready",
  });
  expect(service.getSnapshot().frames.map((frame) => frame.time)).toEqual([10, 20, 30]);

  stopSecond();
  expect(requests[0].abort).not.toHaveBeenCalled();
  stopFirst();
  expect(requests[0].abort).toHaveBeenCalled();
});

test("keeps the last frames when a refresh fails and ignores a reply after the last watcher leaves", () => {
  const { interval, requests, service } = harness();
  const stop = service.watch();
  requests[0].done(maps([10]));
  expect(service.getSnapshot().frames).toHaveLength(1);

  interval()?.();
  expect(requests).toHaveLength(2);
  requests[1].done(null);
  expect(service.getSnapshot()).toMatchObject({
    host: "https://tilecache.rainviewer.com",
    status: "ready",
  });
  expect(service.getSnapshot().frames.map((frame) => frame.time)).toEqual([10]);

  stop();
  requests[1].done(maps([99]));
  expect(service.getSnapshot().frames.map((frame) => frame.time)).toEqual([10]);

  const failed = harness();
  failed.service.watch();
  failed.requests[0].done({ host: "https://nope.example", radar: { past: [] } });
  expect(failed.service.getSnapshot()).toMatchObject({ frames: [], status: "unavailable" });
});
