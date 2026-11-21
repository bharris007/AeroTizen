import { flatMap } from "../flatMap";
import { createSceneRandom } from "../sceneRandom";

import styles from "./Snowfall.module.css";

const DRIFTS = [styles.driftA, styles.driftB, styles.driftC];

// Each depth trades size and speed for count: distant flakes are small, slow and
// sharp, near ones large, quick and soft as if out of focus.
const DEPTHS = {
  far: { className: styles.far, sizePx: [2, 4], durationS: [20, 30], opacity: [0.35, 0.7] },
  mid: { className: styles.mid, sizePx: [5, 9], durationS: [12, 17], opacity: [0.55, 0.9] },
  near: { className: styles.near, sizePx: [18, 30], durationS: [7, 10], opacity: [0.35, 0.6] },
} as const;

type Depth = keyof typeof DEPTHS;

const FLAKES_PER_DEPTH: Record<Depth, number> = { far: 26, mid: 20, near: 6 };
const SNOW_SEED = 11;

const within = (range: readonly [number, number], amount: number) => range[0] + (range[1] - range[0]) * amount;

const createFlakes = () => {
  const random = createSceneRandom(SNOW_SEED);
  return flatMap(Object.keys(DEPTHS) as Depth[], (depth) => {
    const { className, sizePx, durationS, opacity } = DEPTHS[depth];
    return Array.from({ length: FLAKES_PER_DEPTH[depth] }, (_, index) => {
      const size = Math.round(within(sizePx, random()));
      const duration = within(durationS, random());
      return {
        key: depth + index,
        className: styles.flake + " " + className + " " + DRIFTS[index % DRIFTS.length],
        style: {
          left: (random() * 100).toFixed(2) + "%",
          width: size + "px",
          height: size + "px",
          opacity: within(opacity, random()).toFixed(2),
          animationDuration: duration.toFixed(1) + "s",
          animationDelay: (-random() * duration).toFixed(1) + "s",
        },
      };
    });
  });
};

const FLAKES = createFlakes();

export const Snowfall = () => (
  <div class={styles.snowfall} aria-hidden="true">
    {FLAKES.map((flake) => (
      <span key={flake.key} class={flake.className} style={flake.style} />
    ))}
  </div>
);
