import { createSceneRandom } from "../sceneRandom";

import styles from "./Snowfall.module.css";

const DRIFTS = [styles.driftA, styles.driftB, styles.driftC];

const createFlakes = (count: number, seed: number) => {
  const random = createSceneRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const size = 4 + Math.round(random() * 10);
    const duration = 9 + random() * 10;
    return {
      key: index,
      className: styles.flake + " " + DRIFTS[index % DRIFTS.length],
      style: {
        left: (random() * 100).toFixed(2) + "%",
        width: size + "px",
        height: size + "px",
        opacity: (0.45 + random() * 0.55).toFixed(2),
        animationDuration: duration.toFixed(1) + "s",
        animationDelay: (-random() * duration).toFixed(1) + "s",
      },
    };
  });
};

const FLAKES = { light: createFlakes(36, 7), heavy: createFlakes(64, 11) };

export const Snowfall = ({ density = "heavy" }: { density?: keyof typeof FLAKES }) => (
  <div class={styles.snowfall} aria-hidden="true">
    {FLAKES[density].map((flake) => (
      <span key={flake.key} class={flake.className} style={flake.style} />
    ))}
  </div>
);
