import styles from "./CountdownScene.module.css";
import { Reindeer, SILHOUETTE } from "./Reindeer";

const REINDEER = [
  { key: "wheel", x: 168, y: 2 },
  { key: "swing", x: 246, y: -6 },
  { key: "point", x: 324, y: 0 },
  { key: "lead", x: 402, y: -8 },
] as const;

const SPARKS = Array.from({ length: 9 }, (_, index) => ({
  key: index,
  style: {
    left: -40 - index * 52 + "px",
    top: 74 + ((index * 7) % 3) * 6 - 6 + "px",
    animationDelay: -index * 0.27 + "s",
  },
}));

// A sleigh and team in silhouette, crossing the moon now and then with a trail of
// gold dust. The flight, bob and sparks animate only transforms and opacity.
export const SleighFlight = () => (
  <div class={styles.flight} aria-hidden="true">
    <div class={styles.bob}>
      <span class={styles.trail} />
      {SPARKS.map((spark) => (
        <span key={spark.key} class={styles.spark} style={spark.style} />
      ))}
      <svg class={styles.sleighArt} viewBox="0 -4 500 104">
        <g fill={SILHOUETTE}>
          <path
            d="M126 64 Q200 70 250 62 Q300 56 330 64 Q370 58 410 62 Q440 56 470 60"
            stroke={SILHOUETTE}
            stroke-width="1.5"
            fill="none"
          />
          {REINDEER.map((deer) => (
            <Reindeer key={deer.key} x={deer.x} y={deer.y} />
          ))}
          <ellipse cx="40" cy="38" rx="20" ry="15" />
          <ellipse cx="74" cy="46" rx="18" ry="16" />
          <circle cx="82" cy="26" r="9" />
          <path d="M74 22 Q82 6 98 14 L92 24 Z" />
          <circle cx="99" cy="14" r="3" />
          <path d="M10 62 Q8 40 28 38 L58 38 Q68 58 98 58 L126 58 Q138 58 140 46 L148 46 Q148 76 118 78 L30 78 Q12 78 10 62 Z" />
          <path
            d="M6 94 L124 94 Q148 94 154 78 M40 78 V94 M100 78 V94"
            stroke={SILHOUETTE}
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  </div>
);
