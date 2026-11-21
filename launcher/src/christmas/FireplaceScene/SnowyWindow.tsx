import { createForest, PineForest } from "../PineForest";
import { Snowfall } from "../Snowfall/Snowfall";

import styles from "./FireplaceScene.module.css";

const OUTSIDE = createForest({
  seed: 13,
  width: 380,
  height: 200,
  ridgeY: 120,
  waves: [{ amplitude: 14, period: 260, phase: 0.6 }],
  treeCount: 9,
  treeHeight: [50, 110],
  fill: "#0c1530",
  snow: "#4a5d8f",
});

// A frosted window onto a snowy night, framed in wood and velvet curtains.
export const SnowyWindow = () => (
  <div class={styles.windowFrame} aria-hidden="true">
    <div class={styles.pane}>
      <span class={styles.windowMoon} />
      <svg class={styles.outsideHills} viewBox="0 0 380 200">
        <path d="M0 90 Q120 40 230 80 T380 70 V200 H0 Z" fill="#33467a" />
      </svg>
      <PineForest forest={OUTSIDE} class={styles.outsideForest} />
      <Snowfall density="window" />
      <span class={styles.frost} />
    </div>
    <span class={styles.mullionVertical} />
    <span class={styles.mullionHorizontal} />
    <span class={styles.sill} />
    <span class={styles.curtainLeft} />
    <span class={styles.curtainRight} />
    <span class={styles.valance} />
  </div>
);
