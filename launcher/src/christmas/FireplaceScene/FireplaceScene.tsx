import { useLayoutEffect, useRef } from "preact/hooks";

import { FIRE_HEIGHT, FIRE_WIDTH, startFireAnimation } from "../../fireplace/startFireAnimation";

import styles from "./FireplaceScene.module.css";
import { Garland } from "./Garland";
import { Stocking } from "./Stocking";

const STOCKINGS = [
  { key: "red", x: 20, body: "#c92a2a", accent: "#f8f9fa", delay: "0s" },
  { key: "green", x: 150, body: "#2b8a3e", accent: "#ffd43b", delay: "-1.2s" },
  { key: "blue", x: 1040, body: "#1c7ed6", accent: "#f8f9fa", delay: "-0.5s" },
  { key: "gold", x: 1170, body: "#e8590c", accent: "#fff3bf", delay: "-1.8s" },
] as const;

const CANDLES = [
  { key: "c1", x: 330, height: 90 },
  { key: "c2", x: 390, height: 60 },
  { key: "c3", x: 880, height: 70 },
  { key: "c4", x: 940, height: 100 },
] as const;

export const FireplaceScene = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (canvas.current) {
      return startFireAnimation(canvas.current);
    }
  }, []);
  return (
    <div class={styles.scene}>
      <svg class={styles.wall} viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="christmas-bricks" width="160" height="80" patternUnits="userSpaceOnUse">
            <rect width="160" height="80" fill="#4a1d14" />
            <rect x="3" y="3" width="154" height="34" rx="3" fill="#6e2a1c" />
            <rect x="-77" y="43" width="154" height="34" rx="3" fill="#652619" />
            <rect x="83" y="43" width="154" height="34" rx="3" fill="#73301f" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#christmas-bricks)" />
      </svg>
      <div class={styles.floor} />
      <div class={styles.rug} />
      <div class={styles.wreath} aria-hidden="true">
        <svg viewBox="0 0 240 260" class={styles.wreathArt}>
          <circle cx="120" cy="120" r="88" stroke="#1f6f3a" stroke-width="46" fill="none" />
          <circle cx="120" cy="120" r="88" stroke="#2f9e44" stroke-width="18" stroke-dasharray="8 14" fill="none" />
          <circle cx="62" cy="72" r="9" fill="#e03131" />
          <circle cx="180" cy="78" r="9" fill="#e03131" />
          <circle cx="48" cy="150" r="9" fill="#e03131" />
          <circle cx="192" cy="160" r="9" fill="#e03131" />
          <circle cx="120" cy="40" r="9" fill="#ffd43b" />
          <path d="M120 196 L82 240 L100 244 L120 214 L140 244 L158 240 Z" fill="#c92a2a" />
          <path d="M120 200 Q84 170 78 204 Q86 226 120 206 Q154 226 162 204 Q156 170 120 200 Z" fill="#e03131" />
          <circle cx="120" cy="203" r="10" fill="#a51111" />
        </svg>
      </div>
      <div class={styles.hearth}>
        <div class={styles.surround} />
        <div class={styles.opening}>
          <canvas class={styles.fire} ref={canvas} width={FIRE_WIDTH} height={FIRE_HEIGHT} />
          <svg class={styles.logs} viewBox="0 0 760 120" aria-hidden="true">
            <rect x="150" y="56" width="460" height="44" rx="22" fill="#3d2414" transform="rotate(-6 380 78)" />
            <rect x="170" y="62" width="440" height="42" rx="21" fill="#5a3620" transform="rotate(7 380 82)" />
            <circle cx="610" cy="104" r="20" fill="#c89464" />
            <circle cx="610" cy="104" r="11" fill="#8a5a33" />
          </svg>
          <div class={styles.grate} />
        </div>
      </div>
      <div class={styles.mantel}>
        {CANDLES.map((candle) => (
          <div key={candle.key} class={styles.candle} style={{ left: candle.x + "px", height: candle.height + "px" }}>
            <span class={styles.flame} />
          </div>
        ))}
        <div class={styles.shelf} />
        <Garland />
        {STOCKINGS.map((stocking) => (
          <Stocking
            key={stocking.key}
            x={stocking.x}
            body={stocking.body}
            accent={stocking.accent}
            delay={stocking.delay}
          />
        ))}
      </div>
      <div class={styles.glow} />
    </div>
  );
};
