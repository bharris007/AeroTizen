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

const DENSITIES = {
  heavy: { far: 26, mid: 20, near: 6 },
  light: { far: 18, mid: 12, near: 4 },
  window: { far: 14, mid: 10, near: 0 },
} as const satisfies Record<string, Record<Depth, number>>;

type Density = keyof typeof DENSITIES;

const within = (range: readonly [number, number], amount: number) => range[0] + (range[1] - range[0]) * amount;

const createFlakes = (density: Density, seed: number) => {
  const random = createSceneRandom(seed);
  return flatMap(Object.keys(DEPTHS) as Depth[], (depth) => {
    const { className, sizePx, durationS, opacity } = DEPTHS[depth];
    return Array.from({ length: DENSITIES[density][depth] }, (_, index) => {
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

const FLAKES: Record<Density, ReturnType<typeof createFlakes>> = {
  heavy: createFlakes("heavy", 11),
  light: createFlakes("light", 7),
  window: createFlakes("window", 5),
};

export const Snowfall = ({ density = "heavy" }: { density?: Density }) => (
  <div class={styles.snowfall} aria-hidden="true">
    {FLAKES[density].map((flake) => (
      <span key={flake.key} class={flake.className} style={flake.style} />
    ))}
  </div>
);
