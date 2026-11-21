import { render } from "preact";

import type { Translate } from "../shared/i18n/createTranslations";
import { createStore } from "../shared/state/createStore";

import { getChristmasCountdown, msUntilNextMinute } from "./christmasCountdown";
import { stepChristmasScene } from "./christmasScenes";
import type { ChristmasState } from "./ChristmasView/ChristmasView";
import { ChristmasView } from "./ChristmasView/ChristmasView";

// The countdown shows days, hours and minutes, so only a change in those needs a render.
const shownCountdown = (time: number) => {
  const countdown = getChristmasCountdown(new Date(time));
  return countdown.kind === "christmas"
    ? "christmas"
    : countdown.days + ":" + countdown.hours + ":" + countdown.minutes;
};

interface ChristmasTimers {
  clearTimeout(id: number): void;
  setTimeout(callback: () => void, ms: number): number;
}

export const mountChristmas = (
  host: HTMLElement,
  translate: Translate,
  now: () => number = () => Date.now(),
  timers: ChristmasTimers = window,
) => {
  const state = createStore<ChristmasState>({ open: false, scene: "countdown", now: now() });
  let ticker: number | undefined;
  let disposed = false;

  // The owner wakes on each local minute boundary, when the shown minute turns over.
  // A timer that fires early or late simply re-reads the clock and aims for the next boundary.
  const scheduleTick = () => {
    ticker = timers.setTimeout(() => {
      const current = state.getSnapshot();
      const time = now();
      if (shownCountdown(current.now) !== shownCountdown(time)) {
        state.set({ ...current, now: time });
      }
      scheduleTick();
    }, msUntilNextMinute(new Date(now())));
  };
  const close = () => {
    const current = state.getSnapshot();
    if (!current.open) {
      return;
    }
    if (ticker !== undefined) {
      timers.clearTimeout(ticker);
      ticker = undefined;
    }
    state.set({ ...current, open: false });
  };
  const step = (offset: number) => {
    const current = state.getSnapshot();
    if (current.open) {
      state.set({ ...current, scene: stepChristmasScene(current.scene, offset) });
    }
  };
  render(<ChristmasView state={state} translate={translate} />, host);
  return {
    bridge: {
      subscribe: state.subscribe,
      open() {
        const current = state.getSnapshot();
        if (disposed || current.open) {
          return;
        }
        state.set({ open: true, scene: "countdown", now: now() });
        scheduleTick();
      },
      close,
      isOpen: () => state.getSnapshot().open,
      nextScene: () => step(1),
      previousScene: () => step(-1),
    },
    dispose() {
      disposed = true;
      close();
      render(null, host);
    },
  };
};
