import styles from "./FireplaceScene.module.css";

// Pillar candles on the mantel shelf, positioned from the stage's left edge.
const CANDLES = [
  { key: "l1", x: 610, height: 118, delay: "0s" },
  { key: "l2", x: 664, height: 84, delay: "-0.7s" },
  { key: "l3", x: 712, height: 62, delay: "-1.3s" },
  { key: "r1", x: 1172, height: 70, delay: "-0.4s" },
  { key: "r2", x: 1222, height: 104, delay: "-1.1s" },
  { key: "r3", x: 1276, height: 80, delay: "-1.8s" },
] as const;

export const Candles = () => (
  <div aria-hidden="true">
    {CANDLES.map((candle) => (
      <div key={candle.key} class={styles.candle} style={{ left: candle.x + "px", height: candle.height + "px" }}>
        <span class={styles.candleGlow} style={{ animationDelay: candle.delay }} />
        <span class={styles.flame} style={{ animationDelay: candle.delay }} />
      </div>
    ))}
  </div>
);
