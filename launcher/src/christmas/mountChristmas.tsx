import { render } from "preact";

import type { Translate } from "../shared/i18n/createTranslations";
import { createStore } from "../shared/state/createStore";

import { stepChristmasScene } from "./christmasScenes";
import type { ChristmasState } from "./ChristmasView/ChristmasView";
import { ChristmasView } from "./ChristmasView/ChristmasView";

const TICK_MS = 1000;

interface ChristmasTimers {
  clearInterval(id: number): void;
  setInterval(callback: () => void, ms: number): number;
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

  const close = () => {
    const current = state.getSnapshot();
    if (!current.open) {
      return;
    }
    if (ticker !== undefined) {
      timers.clearInterval(ticker);
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
        // The owner ticks the countdown; scenes only render the snapshot.
        ticker = timers.setInterval(() => state.set({ ...state.getSnapshot(), now: now() }), TICK_MS);
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
