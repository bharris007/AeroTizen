import { useLayoutEffect, useRef } from "preact/hooks";

import { FIRE_HEIGHT, FIRE_WIDTH, startFireAnimation } from "../../fireplace/startFireAnimation";
import type { BokehLight } from "../Bokeh/Bokeh";
import { Bokeh } from "../Bokeh/Bokeh";
import { ChristmasTree } from "../ChristmasTree/ChristmasTree";
import { createSceneRandom } from "../sceneRandom";

import { Candles } from "./Candles";
import styles from "./FireplaceScene.module.css";
import { MantelGarland } from "./MantelGarland";
import { SnowyWindow } from "./SnowyWindow";
import { Stocking } from "./Stocking";
import { StockingShades } from "./StockingShades";
import { Stonework } from "./Stonework";
import { Wreath } from "./Wreath";

const STOCKINGS = [
  { key: "cranberry", x: 640, body: "#8a1a2c", trim: "#efe6d4", delay: "0s" },
  { key: "pine", x: 790, body: "#1d4a33", trim: "#d9b46a", delay: "-1.4s" },
  { key: "cream", x: 1000, body: "#e3d5b6", trim: "#8a1a2c", delay: "-0.6s" },
  { key: "velvet", x: 1150, body: "#6e1424", trim: "#d9b46a", delay: "-2.1s" },
] as const;

const SPARK_COUNT = 12;

const createSparks = () => {
  const random = createSceneRandom(71);
  return Array.from({ length: SPARK_COUNT }, (_, index) => {
    const duration = 2.6 + random() * 2.4;
    return {
      key: index,
      className: styles.spark + " " + (index % 2 === 0 ? styles.sparkLeft : styles.sparkRight),
      style: {
        left: (90 + random() * 220).toFixed(0) + "px",
        animationDuration: duration.toFixed(1) + "s",
        animationDelay: (-random() * duration).toFixed(1) + "s",
      },
    };
  });
};

const SPARKS = createSparks();

const BOKEH: readonly BokehLight[] = [
  { key: "b1", x: 70, y: 70, sizePx: 170, color: "rgba(255, 196, 120, 0.2)", durationS: 15, delayS: 0 },
  { key: "b2", x: 250, y: 24, sizePx: 120, color: "rgba(255, 170, 90, 0.18)", durationS: 18, delayS: 5 },
  { key: "b3", x: 1700, y: 40, sizePx: 150, color: "rgba(255, 210, 140, 0.18)", durationS: 16, delayS: 3 },
  { key: "b4", x: 1860, y: 150, sizePx: 190, color: "rgba(255, 180, 100, 0.2)", durationS: 20, delayS: 8 },
  { key: "b5", x: 40, y: 1010, sizePx: 160, color: "rgba(255, 150, 80, 0.16)", durationS: 17, delayS: 10 },
];

// A cosy hearth on a snowy night. The canvas fire is the only per-frame drawing;
// its light reaches the room through two flickering glows that only change opacity.
export const FireplaceScene = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (canvas.current) {
      return startFireAnimation(canvas.current);
    }
  }, []);
  return (
    <div class={styles.scene}>
      <StockingShades />
      <div class={styles.wall} />
      <div class={styles.breast} />
      <div class={styles.wainscot} />
      <div class={styles.floor} />
      <svg class={styles.rug} viewBox="0 0 1100 160" aria-hidden="true">
        <ellipse cx="550" cy="80" rx="540" ry="76" fill="#5e1019" />
        <ellipse
          cx="550"
          cy="80"
          rx="510"
          ry="64"
          fill="none"
          stroke="#d9b46a"
          stroke-width="3"
          stroke-dasharray="14 10"
        />
        <ellipse cx="550" cy="80" rx="440" ry="48" fill="#7a1622" />
        <ellipse cx="550" cy="80" rx="300" ry="30" fill="none" stroke="#e6d8b8" stroke-opacity="0.5" stroke-width="2" />
      </svg>
      <div class={styles.vignette} />
      <SnowyWindow />
      <Wreath />
      <Stonework />
      <canvas class={styles.fire} ref={canvas} width={FIRE_WIDTH} height={FIRE_HEIGHT} />
      <div class={styles.fireEdge} />
      <span class={styles.embers} />
      <div class={styles.sparks} aria-hidden="true">
        {SPARKS.map((spark) => (
          <span key={spark.key} class={spark.className} style={spark.style} />
        ))}
      </div>
      <svg class={styles.logs} viewBox="0 0 400 80" aria-hidden="true">
        <rect x="40" y="30" width="300" height="34" rx="17" fill="#2e1a0e" transform="rotate(-5 200 46)" />
        <rect x="70" y="38" width="290" height="32" rx="16" fill="#4a2c18" transform="rotate(6 200 54)" />
        <circle cx="352" cy="64" r="15" fill="#b9875a" />
        <circle cx="352" cy="64" r="8" fill="#7a5130" />
        <path
          d="M30 76 H370 M60 76 V56 M140 76 V56 M260 76 V56 M340 76 V56"
          stroke="#0e0806"
          stroke-width="7"
          stroke-linecap="round"
        />
      </svg>
      <div class={styles.hearthSlab} />
      <div class={styles.shelf} />
      {STOCKINGS.map((stocking) => (
        <Stocking key={stocking.key} x={stocking.x} body={stocking.body} trim={stocking.trim} delay={stocking.delay} />
      ))}
      <MantelGarland />
      <Candles />
      <ChristmasTree class={styles.tree} />
      <div class={styles.firelight} />
      <Bokeh lights={BOKEH} />
    </div>
  );
};
