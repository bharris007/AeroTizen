import styles from "./FireplaceScene.module.css";

const BULB_COLOURS = ["#ff4d4d", "#ffd43b", "#51cf66", "#4dabf7", "#f783ac"];
const TWINKLES = [styles.twinkleA, styles.twinkleB, styles.twinkleC];

const BULBS = Array.from({ length: 26 }, (_, index) => {
  const t = index / 25;
  const swag = Math.abs(Math.sin(t * Math.PI * 5));
  return {
    key: index,
    className: styles.bulb + " " + TWINKLES[index % TWINKLES.length],
    style: {
      left: (t * 1300 - 9).toFixed(0) + "px",
      top: (6 + swag * 34).toFixed(0) + "px",
      background: BULB_COLOURS[index % BULB_COLOURS.length],
      color: BULB_COLOURS[index % BULB_COLOURS.length],
    },
  };
});

export const Garland = () => (
  <div class={styles.garland} aria-hidden="true">
    <svg viewBox="0 0 1300 70" class={styles.garlandArt}>
      <path
        d="M0 8 Q130 72 260 8 Q390 72 520 8 Q650 72 780 8 Q910 72 1040 8 Q1170 72 1300 8"
        stroke="#1f6f3a"
        stroke-width="26"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M0 8 Q130 72 260 8 Q390 72 520 8 Q650 72 780 8 Q910 72 1040 8 Q1170 72 1300 8"
        stroke="#2f9e44"
        stroke-width="12"
        stroke-dasharray="6 10"
        fill="none"
      />
    </svg>
    {BULBS.map((bulb) => (
      <span key={bulb.key} class={bulb.className} style={bulb.style} />
    ))}
  </div>
);
