// Shared queue so every radar view on screen loads only a few images at a time.
// Tizen TVs stall the UI thread when dozens of tiles decode together.
export const MAX_CONCURRENT_RADAR_TILES = 4;

type Pending = {
  cancelled: { value: boolean };
  start(): void;
};

const waiting: Pending[] = [];
let active = 0;

const pump = () => {
  while (active < MAX_CONCURRENT_RADAR_TILES && waiting.length > 0) {
    const job = waiting.shift();
    if (!job || job.cancelled.value) {
      continue;
    }
    active += 1;
    job.start();
  }
};

const releaseSlot = () => {
  active = Math.max(0, active - 1);
  pump();
};

// Assign src only when a slot is free. The returned function releases the slot and clears the image.
export const loadRadarTile = (image: HTMLImageElement, src: string) => {
  const state = { value: false };
  let onDone = () => undefined;
  const job: Pending = {
    cancelled: state,
    start() {
      if (state.value) {
        releaseSlot();
        return;
      }
      onDone = () => {
        image.removeEventListener("load", onDone);
        image.removeEventListener("error", onDone);
        if (state.value) {
          return;
        }
        state.value = true;
        releaseSlot();
      };
      image.addEventListener("load", onDone);
      image.addEventListener("error", onDone);
      image.setAttribute("src", src);
    },
  };
  waiting.push(job);
  pump();
  return () => {
    if (state.value) {
      return;
    }
    const index = waiting.indexOf(job);
    if (index >= 0) {
      waiting.splice(index, 1);
      state.value = true;
      image.removeAttribute("src");
      return;
    }
    image.removeEventListener("load", onDone);
    image.removeEventListener("error", onDone);
    image.removeAttribute("src");
    state.value = true;
    releaseSlot();
  };
};

export const resetRadarTileQueue = () => {
  waiting.splice(0, waiting.length);
  active = 0;
};
