import styles from "./CountdownScene.module.css";
import { Reindeer } from "./Reindeer";

const REINDEER = [
  { key: "dasher", x: 280, nose: "#4a2a12" },
  { key: "dancer", x: 430, nose: "#4a2a12" },
  { key: "rudolph", x: 580, nose: "#ff2a2a" },
] as const;

export const SleighTeam = () => (
  <svg class={styles.sleighArt} viewBox="0 -14 760 214" aria-hidden="true">
    <path d="M150 82 Q300 128 382 104 Q460 92 532 104 Q610 92 682 104" stroke="#c9a46a" stroke-width="3" fill="none" />
    {REINDEER.map((deer) => (
      <Reindeer key={deer.key} x={deer.x} nose={deer.nose} />
    ))}
    <ellipse cx="62" cy="62" rx="40" ry="34" fill="#8d5524" />
    <rect x="34" y="20" width="26" height="24" rx="3" fill="#2f9e44" />
    <rect x="45" y="20" width="4" height="24" fill="#ffd34d" />
    <rect x="62" y="12" width="24" height="30" rx="3" fill="#3b5bdb" />
    <rect x="62" y="24" width="24" height="4" fill="#f8f9fa" />
    <ellipse cx="112" cy="74" rx="34" ry="36" fill="#e03131" />
    <rect x="80" y="80" width="64" height="9" fill="#212529" />
    <rect x="106" y="79" width="12" height="11" fill="#ffd34d" />
    <path d="M130 64 L152 38" stroke="#e03131" stroke-width="12" stroke-linecap="round" />
    <circle cx="154" cy="35" r="8" fill="#2b8a3e" />
    <circle cx="118" cy="32" r="16" fill="#ffd7b5" />
    <path d="M100 34 Q118 76 137 34 Q118 48 100 34 Z" fill="#f8f9fa" />
    <circle cx="124" cy="29" r="2.2" fill="#212529" />
    <circle cx="130" cy="36" r="3.5" fill="#ff8787" />
    <path d="M100 24 Q112 -10 144 6 L137 22 Z" fill="#e03131" />
    <rect x="98" y="18" width="42" height="9" rx="4.5" fill="#f8f9fa" />
    <circle cx="145" cy="7" r="6" fill="#f8f9fa" />
    <path
      d="M28 132 Q18 72 48 62 H88 Q98 98 140 98 H202 Q232 98 238 72 L250 72 Q252 134 204 136 Z"
      fill="#c92a2a"
      stroke="#7b1d14"
      stroke-width="3"
    />
    <path d="M40 120 Q120 128 214 118" stroke="#ffd34d" stroke-width="5" fill="none" />
    <path
      d="M24 176 H222 Q254 176 256 146 M62 176 V136 M180 176 V136"
      stroke="#ffd34d"
      stroke-width="7"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
);
