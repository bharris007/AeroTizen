import { flatMap } from "../flatMap";

import styles from "./LightString.module.css";

const STAGE_WIDTH_PX = 1920;
const SWAG_COUNT = 5;
const ANCHOR_Y_PX = 6;
const SAG_PX = 58;
const BULBS_PER_SWAG = 8;
const SWAG_WIDTH_PX = STAGE_WIDTH_PX / SWAG_COUNT;

const COLOURS = [styles.ruby, styles.gold, styles.emerald, styles.ivory];
const PULSES = [styles.pulseA, styles.pulseB, styles.pulseC];

// Each swag is a quadratic curve; its control point sits at twice the sag so the
// midpoint dips by exactly SAG_PX.
const swagPoint = (swag: number, t: number) => {
  const startX = swag * SWAG_WIDTH_PX;
  const controlY = ANCHOR_Y_PX + 2 * SAG_PX;
  return {
    x: startX + SWAG_WIDTH_PX * t,
    y: (1 - t) * (1 - t) * ANCHOR_Y_PX + 2 * (1 - t) * t * controlY + t * t * ANCHOR_Y_PX,
    slopeDeg: (Math.atan2(2 * (1 - 2 * t) * (controlY - ANCHOR_Y_PX), SWAG_WIDTH_PX) * 180) / Math.PI,
  };
};

const WIRE_PATH = Array.from({ length: SWAG_COUNT }, (_, swag) => {
  const startX = swag * SWAG_WIDTH_PX;
  return (
    "M" +
    startX +
    " " +
    ANCHOR_Y_PX +
    " Q" +
    (startX + SWAG_WIDTH_PX / 2) +
    " " +
    (ANCHOR_Y_PX + 2 * SAG_PX) +
    " " +
    (startX + SWAG_WIDTH_PX) +
    " " +
    ANCHOR_Y_PX
  );
}).join(" ");

const BULBS = flatMap(
  Array.from({ length: SWAG_COUNT }, (_, swag) => swag),
  (swag) =>
    Array.from({ length: BULBS_PER_SWAG }, (_, index) => {
      const spot = swagPoint(swag, (index + 0.5) / BULBS_PER_SWAG);
      const order = swag * BULBS_PER_SWAG + index;
      return {
        key: order,
        className: styles.bulb + " " + COLOURS[order % COLOURS.length],
        style: {
          left: spot.x.toFixed(0) + "px",
          top: spot.y.toFixed(0) + "px",
          transform: "rotate(" + (spot.slopeDeg * 0.6).toFixed(1) + "deg)",
        },
        glowClass: styles.glow + " " + PULSES[(order * 2) % PULSES.length],
        glowStyle: { animationDelay: (-(order % 7) * 0.45).toFixed(2) + "s" },
      };
    }),
);

// Old-fashioned glass bulbs strung in swags along the top edge. The wire and bulbs
// are static; only each bulb's glow fades, out of step with its neighbours.
export const LightString = () => (
  <div class={styles.string} aria-hidden="true">
    <svg class={styles.wire} viewBox={"0 0 " + STAGE_WIDTH_PX + " 90"}>
      <path d={WIRE_PATH} stroke="#0b1a12" stroke-width="3" fill="none" />
    </svg>
    {BULBS.map((bulb) => (
      <span key={bulb.key} class={bulb.className} style={bulb.style}>
        <span class={styles.glass} />
        <span class={bulb.glowClass} style={bulb.glowStyle} />
      </span>
    ))}
  </div>
);
