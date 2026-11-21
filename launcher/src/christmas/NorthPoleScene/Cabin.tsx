import styles from "./NorthPoleScene.module.css";

const PUFFS = [
  { key: "a", delay: "0s" },
  { key: "b", delay: "-1.5s" },
  { key: "c", delay: "-3s" },
  { key: "d", delay: "-4.5s" },
] as const;

export const Cabin = () => (
  <div class={styles.cabin} aria-hidden="true">
    {PUFFS.map((puff) => (
      <span key={puff.key} class={styles.smoke} style={{ animationDelay: puff.delay }} />
    ))}
    <svg class={styles.cabinArt} viewBox="0 0 360 280">
      <rect x="244" y="20" width="34" height="80" fill="#6c4a3a" />
      <rect x="40" y="110" width="280" height="160" fill="#7a4a2a" />
      <path d="M40 140 H320 M40 170 H320 M40 200 H320 M40 230 H320" stroke="#5a3519" stroke-width="4" />
      <path d="M10 118 L180 20 L350 118 Z" fill="#a61e1e" />
      <path d="M4 122 L180 14 L356 122 L336 126 L180 36 L24 126 Z" fill="#f8f9fa" />
      <rect x="72" y="150" width="70" height="60" fill="#ffd43b" />
      <path d="M107 150 V210 M72 180 H142" stroke="#7a4a2a" stroke-width="5" />
      <rect x="200" y="160" width="70" height="110" fill="#4a2a12" />
      <circle cx="258" cy="216" r="5" fill="#ffd43b" />
      <path d="M190 160 Q235 120 280 160" stroke="#2f9e44" stroke-width="10" fill="none" />
      <path d="M30 270 Q180 254 330 270" stroke="#f8f9fa" stroke-width="14" stroke-linecap="round" />
    </svg>
    <div class={styles.windowGlow} />
  </div>
);
