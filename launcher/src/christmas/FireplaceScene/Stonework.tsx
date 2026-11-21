import { flatMap } from "../flatMap";
import { createSceneRandom } from "../sceneRandom";

import styles from "./FireplaceScene.module.css";

// The surround's drawing space, placed at (600, 490) on the stage.
const WIDTH = 720;
const HEIGHT = 470;
const ROW_PX = 52;
const STONE_COLOURS = ["#5a4034", "#4d362b", "#634638", "#43302a", "#6e5040", "#55392d"];

const createStones = () => {
  const random = createSceneRandom(61);
  const rows = Array.from({ length: Math.ceil(HEIGHT / ROW_PX) }, (_, row) => row);
  return flatMap(rows, (row) => {
    const stones = [];
    let x = -((row * 37) % 60);
    while (x < WIDTH) {
      const width = 70 + Math.round(random() * 70);
      stones.push({
        key: row + "-" + x,
        x: x + 3,
        y: row * ROW_PX + 3,
        width: width - 6,
        height: ROW_PX - 6,
        fill: STONE_COLOURS[Math.floor(random() * STONE_COLOURS.length)],
      });
      x += width;
    }
    return stones;
  });
};

const STONES = createStones();

// Firebox opening in the same drawing space: a shallow arch over straight jambs.
export const OPENING = { x: 130, y: 110, width: 460, height: 360, rise: 60 } as const;

const OPENING_PATH =
  `M${OPENING.x} ${OPENING.y + OPENING.height} V${OPENING.y + OPENING.rise} ` +
  `Q${OPENING.x + OPENING.width / 2} ${OPENING.y - OPENING.rise} ${OPENING.x + OPENING.width} ${OPENING.y + OPENING.rise} ` +
  `V${OPENING.y + OPENING.height} Z`;

export const Stonework = () => (
  <svg class={styles.stonework} viewBox={"0 0 " + WIDTH + " " + HEIGHT} aria-hidden="true">
    <defs>
      <radialGradient id="christmas-hearth-light" cx="0.5" cy="0.78" r="0.62">
        <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.42" />
        <stop offset="1" stop-color="#ff9a3c" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="christmas-firebox" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#050202" />
        <stop offset="0.7" stop-color="#120705" />
        <stop offset="1" stop-color="#2a1008" />
      </linearGradient>
    </defs>
    <rect width={WIDTH} height={HEIGHT} fill="#1b120d" />
    {STONES.map((stone) => (
      <rect
        key={stone.key}
        x={stone.x}
        y={stone.y}
        width={stone.width}
        height={stone.height}
        rx="12"
        fill={stone.fill}
      />
    ))}
    <rect width={WIDTH} height={HEIGHT} fill="url(#christmas-hearth-light)" />
    <path d={OPENING_PATH} fill="none" stroke="#2a1a12" stroke-width="22" />
    <path d={OPENING_PATH} fill="url(#christmas-firebox)" />
    <path
      d={`M${OPENING.x + 30} ${OPENING.y + OPENING.height - 20} H${OPENING.x + OPENING.width - 30} M${OPENING.x + 30} ${OPENING.y + OPENING.height - 90} H${OPENING.x + OPENING.width - 30} M${OPENING.x + 30} ${OPENING.y + OPENING.height - 160} H${OPENING.x + OPENING.width - 30}`}
      stroke="#ff8a3a"
      stroke-opacity="0.08"
      stroke-width="2"
    />
  </svg>
);
