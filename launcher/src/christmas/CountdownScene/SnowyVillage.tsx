import styles from "./CountdownScene.module.css";

const PINES = [
  { key: "p1", x: 90, scale: 1.1 },
  { key: "p2", x: 240, scale: 0.8 },
  { key: "p3", x: 1500, scale: 0.9 },
  { key: "p4", x: 1660, scale: 1.2 },
  { key: "p5", x: 1820, scale: 0.85 },
] as const;

const HOUSES = [
  { key: "h1", x: 360, roof: "#c92a2a" },
  { key: "h2", x: 1290, roof: "#2b8a3e" },
] as const;

export const SnowyVillage = () => (
  <svg class={styles.village} viewBox="0 0 1920 300" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 150 Q300 70 640 140 T1280 120 T1920 110 V300 H0 Z" fill="#c5d8ff" opacity="0.55" />
    {PINES.map((pine) => (
      <g key={pine.key} transform={"translate(" + pine.x + " 70) scale(" + pine.scale + ")"}>
        <path d="M0 0 L-46 80 H46 Z M0 40 L-58 130 H58 Z" fill="#1b4332" />
        <path d="M0 0 L-16 28 H16 Z M0 40 L-20 72 H20 Z" fill="#f8f9fa" />
        <rect x="-8" y="130" width="16" height="20" fill="#5c3d1e" />
      </g>
    ))}
    {HOUSES.map((house) => (
      <g key={house.key} transform={"translate(" + house.x + " 110)"}>
        <rect x="0" y="40" width="150" height="90" fill="#6b3f1f" />
        <path d="M-15 46 L75 -10 L165 46 Z" fill={house.roof} />
        <path d="M-15 46 L75 -10 L165 46 L150 46 L75 4 L0 46 Z" fill="#f8f9fa" />
        <rect x="22" y="62" width="34" height="30" fill="#ffd43b" />
        <rect x="94" y="62" width="34" height="30" fill="#ffd43b" />
      </g>
    ))}
    <path d="M0 210 Q480 150 960 200 T1920 190 V300 H0 Z" fill="#f1f6ff" />
    <path d="M0 250 Q520 210 1040 250 T1920 240 V300 H0 Z" fill="#dbe7ff" />
  </svg>
);
