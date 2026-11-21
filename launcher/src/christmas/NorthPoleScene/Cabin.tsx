import styles from "./NorthPoleScene.module.css";

const SMOKE = [0, 1, 2, 3].map((puff) => ({ key: puff, style: { animationDelay: -puff * 2.6 + "s" } }));

// A log cabin with snow on the roof, lamplit windows and a smoking chimney.
export const Cabin = () => (
  <div class={styles.cabin} aria-hidden="true">
    <svg class={styles.cabinArt} viewBox="0 0 420 320">
      <defs>
        <linearGradient id="christmas-cabin-logs" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#3a2416" />
          <stop offset="1" stop-color="#1e120a" />
        </linearGradient>
        <radialGradient id="christmas-cabin-window" r="0.5">
          <stop offset="0" stop-color="#ffc874" stop-opacity="0.6" />
          <stop offset="1" stop-color="#ffc874" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="282" y="34" width="34" height="90" fill="#2a1a12" />
      <rect x="276" y="26" width="46" height="14" rx="6" fill="#eef4ff" />
      <rect x="40" y="130" width="340" height="170" fill="url(#christmas-cabin-logs)" />
      <path
        d="M40 156 H380 M40 182 H380 M40 208 H380 M40 234 H380 M40 260 H380 M40 286 H380"
        stroke="#0f0905"
        stroke-opacity="0.6"
        stroke-width="3"
      />
      <path d="M10 140 L210 26 L410 140 L392 152 L210 50 L28 152 Z" fill="#2a1a12" />
      <path d="M0 140 L210 18 L420 140 L404 148 Q300 96 210 60 Q120 96 16 148 Z" fill="#eef4ff" />
      <path d="M210 18 L420 140 L404 148 Q300 96 210 60 Z" fill="#c9d6ee" opacity="0.6" />
      <rect x="84" y="176" width="74" height="64" rx="4" fill="#ffcf7e" />
      <rect x="262" y="176" width="74" height="64" rx="4" fill="#ffcf7e" />
      <path d="M121 176 V240 M84 208 H158 M299 176 V240 M262 208 H336" stroke="#2a1a12" stroke-width="5" />
      <rect x="182" y="198" width="56" height="102" rx="4" fill="#4a2a18" />
      <circle cx="226" cy="252" r="4" fill="#d9b46a" />
      <path d="M78 240 H164 M256 240 H342" stroke="#eef4ff" stroke-width="7" stroke-linecap="round" />
      <circle cx="121" cy="208" r="80" fill="url(#christmas-cabin-window)" />
      <circle cx="299" cy="208" r="80" fill="url(#christmas-cabin-window)" />
      <path d="M0 300 Q120 284 210 296 Q320 308 420 290 V320 H0 Z" fill="#dfe8f8" />
    </svg>
    <span class={styles.cabinFlicker} />
    {SMOKE.map((puff) => (
      <span key={puff.key} class={styles.smoke} style={puff.style} />
    ))}
  </div>
);
