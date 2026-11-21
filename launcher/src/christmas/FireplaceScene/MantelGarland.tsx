import { createSceneRandom } from "../sceneRandom";

import styles from "./FireplaceScene.module.css";

// The garland's drawing space, placed at (560, 440) on the stage.
const WIDTH = 800;
const HEIGHT = 130;
const SWAGS = 3;
const START_X = 14;
const END_X = 786;
const HANG_Y = 34;
const DROP_PX = 52;
const NEEDLE_STEP_PX = 5;
const NEEDLE_COLOURS = ["#0f2e1c", "#163d26", "#1f5233", "#2c6b42"];
const LIGHT_COUNT = 17;

const swagY = (x: number) =>
  HANG_Y + DROP_PX * Math.abs(Math.sin((Math.PI * SWAGS * (x - START_X)) / (END_X - START_X)));

// Needles are short strokes scattered along the swags, grouped by colour so the
// whole garland is four paths.
const createNeedles = () => {
  const random = createSceneRandom(83);
  const paths = NEEDLE_COLOURS.map(() => [] as string[]);
  for (let x = START_X; x <= END_X; x += NEEDLE_STEP_PX) {
    const y = swagY(x);
    for (let needle = 0; needle < 4; needle++) {
      const angle = random() * Math.PI * 2;
      const length = 12 + random() * 16;
      const fromX = x + (random() - 0.5) * 10;
      const fromY = y + (random() - 0.5) * 12;
      paths[Math.floor(random() * NEEDLE_COLOURS.length)].push(
        `M${fromX.toFixed(1)} ${fromY.toFixed(1)} l${(Math.cos(angle) * length).toFixed(1)} ${(Math.sin(angle) * length * 0.7).toFixed(1)}`,
      );
    }
  }
  return paths.map((segments, index) => ({
    key: NEEDLE_COLOURS[index],
    colour: NEEDLE_COLOURS[index],
    d: segments.join(" "),
  }));
};

const NEEDLES = createNeedles();

const BERRIES = [80, 210, 345, 470, 600, 725].map((x, index) => ({
  key: x,
  x,
  y: swagY(x) + 6,
  gold: index % 2 === 1,
}));

const TWINKLES = [styles.twinkleA, styles.twinkleB, styles.twinkleC];

const LIGHTS = Array.from({ length: LIGHT_COUNT }, (_, index) => {
  const x = START_X + 20 + ((END_X - START_X - 40) * index) / (LIGHT_COUNT - 1);
  return {
    key: index,
    className: styles.garlandLight + " " + TWINKLES[index % TWINKLES.length],
    style: { left: x.toFixed(0) + "px", top: (swagY(x) + 4).toFixed(0) + "px" },
  };
});

export const MantelGarland = () => (
  <div class={styles.garland} aria-hidden="true">
    <svg class={styles.garlandArt} viewBox={"0 0 " + WIDTH + " " + HEIGHT}>
      {NEEDLES.map((needles) => (
        <path
          key={needles.key}
          d={needles.d}
          stroke={needles.colour}
          stroke-width="3"
          stroke-linecap="round"
          fill="none"
        />
      ))}
      {BERRIES.map((berry) =>
        berry.gold ? (
          <g key={berry.key}>
            <circle cx={berry.x} cy={berry.y} r="11" fill="#c9973f" />
            <circle cx={berry.x - 3} cy={berry.y - 4} r="3.5" fill="#fff3cf" opacity="0.7" />
          </g>
        ) : (
          <g key={berry.key} fill="#a3172b">
            <circle cx={berry.x - 7} cy={berry.y} r="6" />
            <circle cx={berry.x + 6} cy={berry.y - 2} r="6" />
            <circle cx={berry.x} cy={berry.y + 7} r="6" />
          </g>
        ),
      )}
    </svg>
    {LIGHTS.map((light) => (
      <span key={light.key} class={light.className} style={light.style} />
    ))}
  </div>
);
