import type { Translate } from "../../shared/i18n/createTranslations";
import { ChristmasTree } from "../ChristmasTree/ChristmasTree";
import { createForest, PineForest } from "../PineForest";
import motion from "../sceneMotion.module.css";
import { Snowfall } from "../Snowfall/Snowfall";
import { createGlints, SnowGlints } from "../SnowGlints";
import { StarField } from "../StarField/StarField";

import { AuroraCurtain, createCurtain } from "./AuroraCurtain";
import { Cabin } from "./Cabin";
import styles from "./NorthPoleScene.module.css";
import { Signpost } from "./Signpost";

const CURTAIN_WIDTH = 2100;
const CURTAIN_HEIGHT = 560;
// The high curtain's hem never dips below 424px, so its layer stops short.
const HIGH_CURTAIN_HEIGHT = 440;

const LOW_CURTAIN = createCurtain({
  seed: 5,
  width: CURTAIN_WIDTH,
  height: CURTAIN_HEIGHT,
  hemY: 420,
  waves: [
    { amplitude: 60, period: 1300, phase: 0.5 },
    { amplitude: 24, period: 470, phase: 2 },
  ],
  rayHeight: [260, 420],
  raySpacing: 7,
  gradient: "christmas-aurora-green",
});

const HIGH_CURTAIN = createCurtain({
  seed: 9,
  width: CURTAIN_WIDTH,
  height: HIGH_CURTAIN_HEIGHT,
  hemY: 340,
  waves: [
    { amplitude: 60, period: 1100, phase: 2.2 },
    { amplitude: 24, period: 380, phase: 0.3 },
  ],
  rayHeight: [120, 260],
  raySpacing: 9,
  gradient: "christmas-aurora-teal",
});

const PEAKS = [
  [0, 240],
  [140, 170],
  [260, 220],
  [420, 70],
  [560, 190],
  [700, 120],
  [820, 200],
  [980, 40],
  [1140, 190],
  [1280, 110],
  [1400, 180],
  [1560, 60],
  [1720, 190],
  [1860, 120],
  [2000, 210],
] as const;

const MOUNTAIN_BASE = 360;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const MOUNTAIN_PATH =
  "M0 " + MOUNTAIN_BASE + " L" + PEAKS.map(([x, y]) => x + " " + y).join(" L") + " L2000 " + MOUNTAIN_BASE + " Z";

// Each summit gets a snow cap with a ragged hem and a shaded far face.
const SUMMITS = PEAKS.slice(1, -1)
  .map(([x, y], index) => ({ x, y, left: PEAKS[index], right: PEAKS[index + 2] }))
  .filter((summit) => summit.y < summit.left[1] && summit.y < summit.right[1]);

const CAP_PATH = SUMMITS.map(({ x, y, left, right }) => {
  const depth = 0.55;
  const leftX = lerp(x, left[0], depth);
  const leftY = lerp(y, left[1], depth);
  const rightX = lerp(x, right[0], depth);
  const rightY = lerp(y, right[1], depth);
  return (
    `M${x} ${y} L${rightX.toFixed(0)} ${rightY.toFixed(0)} L${lerp(x, rightX, 0.6).toFixed(0)} ${(rightY - 12).toFixed(0)} ` +
    `L${lerp(x, rightX, 0.3).toFixed(0)} ${(rightY + 6).toFixed(0)} L${x} ${(lerp(y, rightY, 0.7) - 4).toFixed(0)} ` +
    `L${lerp(x, leftX, 0.35).toFixed(0)} ${(leftY + 8).toFixed(0)} L${lerp(x, leftX, 0.7).toFixed(0)} ${(leftY - 10).toFixed(0)} ` +
    `L${leftX.toFixed(0)} ${leftY.toFixed(0)} Z`
  );
}).join(" ");

const SHADE_PATH = SUMMITS.map(
  ({ x, y, right }) => `M${x} ${y} L${right[0]} ${right[1]} L${x} ${MOUNTAIN_BASE} Z`,
).join(" ");

const FOREST = createForest({
  seed: 19,
  width: 1960,
  height: 220,
  ridgeY: 120,
  waves: [
    { amplitude: 18, period: 760, phase: 1.1 },
    { amplitude: 8, period: 260, phase: 0.2 },
  ],
  treeCount: 64,
  treeHeight: [40, 92],
  fill: "#0f1f3b",
  snow: "#8aa2cc",
});

const EDGE_LOOK = {
  width: 420,
  height: 560,
  ridgeY: 540,
  waves: [{ amplitude: 12, period: 380, phase: 0 }],
  treeCount: 3,
  treeHeight: [320, 520],
  fill: "#08142a",
  snow: "#6f86b4",
} as const;

const EDGE_LEFT = createForest({ ...EDGE_LOOK, seed: 37 });
const EDGE_RIGHT = createForest({ ...EDGE_LOOK, seed: 43 });

const FIELD_GLINTS = createGlints({ seed: 31, count: 70, width: 1920, top: 70, bottom: 330 });

// The North Pole under the northern lights: aurora curtains sway over moonlit
// peaks, a lit tree stands in the snow and a cabin glows beside the pole itself.
export const NorthPoleScene = ({ translate }: { translate: Translate }) => (
  <div class={styles.scene}>
    <svg class={styles.defs} aria-hidden="true">
      <defs>
        <linearGradient id="christmas-aurora-green" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#a070ff" stop-opacity="0" />
          <stop offset="0.22" stop-color="#8a78ff" stop-opacity="0.28" />
          <stop offset="0.5" stop-color="#5fc8ff" stop-opacity="0.45" />
          <stop offset="0.74" stop-color="#5dffb0" stop-opacity="0.78" />
          <stop offset="0.92" stop-color="#b4ffd8" stop-opacity="0.95" />
          <stop offset="1" stop-color="#5dffb0" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="christmas-aurora-teal" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#d070ff" stop-opacity="0" />
          <stop offset="0.4" stop-color="#b06cff" stop-opacity="0.32" />
          <stop offset="0.78" stop-color="#46e0ff" stop-opacity="0.6" />
          <stop offset="0.93" stop-color="#a8f4ff" stop-opacity="0.8" />
          <stop offset="1" stop-color="#46e0ff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="christmas-north-snow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#b9cdea" />
          <stop offset="0.35" stop-color="#7f97c6" />
          <stop offset="1" stop-color="#2c3f6e" />
        </linearGradient>
        <linearGradient id="christmas-north-mountains" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#2b4470" />
          <stop offset="1" stop-color="#132341" />
        </linearGradient>
        <linearGradient id="christmas-north-caps" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#e6f2ff" />
          <stop offset="1" stop-color="#9fc4d8" />
        </linearGradient>
      </defs>
    </svg>
    <StarField />
    <AuroraCurtain curtain={HIGH_CURTAIN} class={styles.auroraHigh + " " + motion.ambient} />
    <AuroraCurtain curtain={LOW_CURTAIN} class={styles.auroraLow + " " + motion.ambient} />
    <svg class={styles.mountains} viewBox={"0 0 2000 " + MOUNTAIN_BASE} aria-hidden="true">
      <path d={MOUNTAIN_PATH} fill="url(#christmas-north-mountains)" />
      <path d={CAP_PATH} fill="url(#christmas-north-caps)" opacity="0.88" />
      <path d={SHADE_PATH} fill="#06101f" opacity="0.32" />
    </svg>
    <div class={styles.forest + " " + motion.parallaxFar}>
      <PineForest forest={FOREST} class={styles.forestArt} />
    </div>
    <div class={styles.field + " " + motion.parallaxMid}>
      <svg class={styles.fieldArt} viewBox="0 0 2000 360" aria-hidden="true">
        <path d="M0 60 Q400 20 900 50 Q1400 82 2000 40 V360 H0 Z" fill="url(#christmas-north-snow)" />
        <path
          d="M0 60 Q400 20 900 50 Q1400 82 2000 40 V90 Q1400 120 900 92 Q400 64 0 100 Z"
          fill="#7dffc4"
          opacity="0.08"
        />
        <SnowGlints glints={FIELD_GLINTS} />
      </svg>
      <span class={styles.treeGlow} />
      <Signpost label={translate("christmas.northPole")} />
      <Cabin />
      <ChristmasTree class={styles.tree} snowy />
    </div>
    <div class={styles.foreground + " " + motion.parallaxNear}>
      <svg class={styles.driftArt} viewBox="0 0 2000 160" aria-hidden="true">
        <path d="M0 70 Q300 20 640 58 Q1000 96 1380 50 Q1700 16 2000 60 V160 H0 Z" fill="#dfe9f8" />
        <path d="M0 110 Q500 74 1000 104 T2000 96 V160 H0 Z" fill="#a9bde0" opacity="0.6" />
      </svg>
      <PineForest forest={EDGE_LEFT} class={styles.edgeLeft} />
      <PineForest forest={EDGE_RIGHT} class={styles.edgeRight} />
    </div>
    <Snowfall density="light" />
  </div>
);
