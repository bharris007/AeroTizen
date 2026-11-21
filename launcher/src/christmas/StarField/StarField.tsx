import { createSceneRandom } from "../sceneRandom";

import styles from "./StarField.module.css";

const createStars = (count: number) => {
  const random = createSceneRandom(23);
  return Array.from({ length: count }, (_, index) => {
    const size = 2 + Math.round(random() * 3);
    return {
      key: index,
      style: {
        left: (random() * 100).toFixed(2) + "%",
        top: (random() * 55).toFixed(2) + "%",
        width: size + "px",
        height: size + "px",
        animationDuration: (2 + random() * 3).toFixed(1) + "s",
        animationDelay: (-random() * 4).toFixed(1) + "s",
      },
    };
  });
};

const STARS = createStars(70);

export const StarField = () => (
  <div class={styles.stars} aria-hidden="true">
    {STARS.map((star) => (
      <span key={star.key} class={styles.star} style={star.style} />
    ))}
  </div>
);
