import type { Translate } from "../../shared/i18n/createTranslations";
import type { BokehLight } from "../Bokeh/Bokeh";
import { Bokeh } from "../Bokeh/Bokeh";
import type { ChristmasCountdown } from "../christmasCountdown";
import { ChristmasTree } from "../ChristmasTree/ChristmasTree";
import { createForest, PineForest } from "../PineForest";
import motion from "../sceneMotion.module.css";
import { Snowfall } from "../Snowfall/Snowfall";
import { createGlints, SnowGlints } from "../SnowGlints";
import { StarField } from "../StarField/StarField";

import { Celebration } from "./Celebration";
import { CountdownDisplay } from "./CountdownDisplay";
import styles from "./CountdownScene.module.css";
import { LightString } from "./LightString";
import { MidnightVillage } from "./MidnightVillage";
import { SleighFlight } from "./SleighFlight";

const FOREST = createForest({
  seed: 3,
  width: 1940,
  height: 300,
  ridgeY: 130,
  waves: [
    { amplitude: 22, period: 900, phase: 0.4 },
    { amplitude: 10, period: 310, phase: 1.3 },
  ],
  treeCount: 70,
  treeHeight: [34, 74],
  fill: "#0d162e",
  snow: "#3a4c7a",
});

const FRAME = createForest({
  seed: 17,
  width: 460,
  height: 560,
  ridgeY: 520,
  waves: [{ amplitude: 18, period: 400, phase: 0 }],
  treeCount: 5,
  treeHeight: [300, 520],
  fill: "#050a17",
  snow: "#25335a",
});

const GLINTS = createGlints({ seed: 53, count: 60, width: 2000, top: 70, bottom: 200 });

const RIDGE_PEAKS = [
  [0, 210],
  [120, 150],
  [230, 190],
  [380, 96],
  [520, 176],
  [640, 132],
  [760, 186],
  [930, 110],
  [1080, 182],
  [1220, 124],
  [1360, 170],
  [1520, 84],
  [1680, 168],
  [1800, 126],
  [1940, 180],
] as const;

const RIDGE_PATH = "M0 380 L" + RIDGE_PEAKS.map(([x, y]) => x + " " + y).join(" L") + " L1940 380 Z";

// Moonlit snow caps on each summit, lighter on the moon side.
const RIDGE_SNOW = RIDGE_PEAKS.slice(1, -1)
  .filter((_, index) => index % 2 === 0)
  .map(
    ([x, y]) =>
      `M${x} ${y} L${x + 46} ${y + 54} L${x + 22} ${y + 44} L${x + 6} ${y + 60} L${x - 14} ${y + 40} L${x - 40} ${y + 50} Z`,
  )
  .join(" ");

const BOKEH: readonly BokehLight[] = [
  { key: "b1", x: 90, y: 940, sizePx: 190, color: "rgba(255, 190, 110, 0.22)", durationS: 14, delayS: 0 },
  { key: "b2", x: 250, y: 1040, sizePx: 130, color: "rgba(255, 150, 90, 0.2)", durationS: 17, delayS: 4 },
  { key: "b3", x: 40, y: 760, sizePx: 110, color: "rgba(255, 214, 150, 0.16)", durationS: 19, delayS: 9 },
  { key: "b4", x: 1880, y: 520, sizePx: 150, color: "rgba(255, 190, 110, 0.16)", durationS: 16, delayS: 2 },
  { key: "b5", x: 1290, y: 1010, sizePx: 120, color: "rgba(230, 90, 90, 0.16)", durationS: 13, delayS: 6 },
];

// Midnight over a sleeping village: the countdown floats in the sky beside a lit
// tree, with depth from layered hills that drift like a slow pan.
export const CountdownScene = ({ countdown, translate }: { countdown: ChristmasCountdown; translate: Translate }) => (
  <div class={styles.scene} data-christmas-countdown={countdown.kind}>
    <StarField />
    <div class={styles.moon} />
    <svg class={styles.ridge} viewBox="0 0 1940 380" aria-hidden="true">
      <defs>
        <linearGradient id="christmas-countdown-ridge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#26346a" />
          <stop offset="1" stop-color="#151f45" />
        </linearGradient>
      </defs>
      <path d={RIDGE_PATH} fill="url(#christmas-countdown-ridge)" />
      <path d={RIDGE_SNOW} fill="#7d8fc0" opacity="0.55" />
    </svg>
    <SleighFlight />
    <div class={styles.forest + " " + motion.parallaxFar}>
      <PineForest forest={FOREST} class={styles.forestArt} />
    </div>
    <MidnightVillage />
    <div class={styles.foreground + " " + motion.parallaxNear}>
      <svg class={styles.snowbank} viewBox="0 0 2000 220" aria-hidden="true">
        <defs>
          <linearGradient id="christmas-countdown-snow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#6c80b4" />
            <stop offset="0.3" stop-color="#3a4b80" />
            <stop offset="1" stop-color="#121a3c" />
          </linearGradient>
        </defs>
        <path
          d="M0 70 Q340 10 760 52 Q1180 96 1560 40 Q1820 4 2000 50 V220 H0 Z"
          fill="url(#christmas-countdown-snow)"
        />
        <path d="M0 150 Q420 104 980 140 Q1500 176 2000 128 V220 H0 Z" fill="#0b1230" opacity="0.4" />
        <SnowGlints glints={GLINTS} />
      </svg>
      <PineForest forest={FRAME} class={styles.frame} />
    </div>
    <ChristmasTree class={styles.tree} />
    {countdown.kind === "christmas" ? (
      <Celebration translate={translate} />
    ) : (
      <CountdownDisplay countdown={countdown} translate={translate} />
    )}
    <LightString />
    <Snowfall />
    <Bokeh lights={BOKEH} />
  </div>
);
