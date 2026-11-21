import { createSceneRandom } from "../sceneRandom";

import styles from "./StarField.module.css";

const SKY_WIDTH = 1920;
const SKY_HEIGHT = 680;
const STILL_STAR_COUNT = 140;
const TWINKLE_STAR_COUNT = 22;
const TWINKLES = [styles.twinkleA, styles.twinkleB, styles.twinkleC];

// Most stars are painted once into a single SVG; only a few twinkle, because each
// animated star becomes its own compositor layer on the TV.
const createStillStars = () => {
  const random = createSceneRandom(23);
  return Array.from({ length: STILL_STAR_COUNT }, (_, index) => {
    // Stars thin out towards the horizon.
    const depth = random();
    return {
      key: index,
      cx: (random() * SKY_WIDTH).toFixed(1),
      cy: (depth * depth * SKY_HEIGHT).toFixed(1),
      r: (0.5 + random() * 1.1).toFixed(2),
      opacity: (0.25 + random() * 0.65).toFixed(2),
    };
  });
};

const createTwinklingStars = () => {
  const random = createSceneRandom(41);
  return Array.from({ length: TWINKLE_STAR_COUNT }, (_, index) => {
    const size = 3 + Math.round(random() * 3);
    const glint = index % 6 === 0;
    return {
      key: index,
      className: styles.star + " " + TWINKLES[index % TWINKLES.length] + (glint ? " " + styles.glint : ""),
      style: {
        left: (random() * 100).toFixed(2) + "%",
        top: (random() * random() * 52).toFixed(2) + "%",
        width: (glint ? size + 2 : size) + "px",
        height: (glint ? size + 2 : size) + "px",
        animationDelay: (-random() * 5).toFixed(1) + "s",
      },
    };
  });
};

const STILL_STARS = createStillStars();
const TWINKLING_STARS = createTwinklingStars();

export const StarField = () => (
  <div class={styles.stars} aria-hidden="true">
    <svg class={styles.still} viewBox={"0 0 " + SKY_WIDTH + " " + SKY_HEIGHT}>
      {STILL_STARS.map((star) => (
        <circle key={star.key} cx={star.cx} cy={star.cy} r={star.r} fill="#f4f1ff" opacity={star.opacity} />
      ))}
    </svg>
    {TWINKLING_STARS.map((star) => (
      <span key={star.key} class={star.className} style={star.style} />
    ))}
  </div>
);
