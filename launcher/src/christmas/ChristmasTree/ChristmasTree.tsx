import { flatMap } from "../flatMap";
import motion from "../sceneMotion.module.css";

import styles from "./ChristmasTree.module.css";
import { Gifts } from "./Gifts";

const CENTER_X = 280;
const CONE_TOP_Y = 70;
const CONE_BOTTOM_Y = 740;
const CONE_HALF_WIDTH = 272;
const STAR_Y = 54;
const LIGHT_SPACING_PX = 28;

// Bough tiers from the top; each is drawn with a scalloped hem of pointed tips.
const TIERS = [
  { top: 70, bottom: 215, halfWidth: 80, tips: 4 },
  { top: 140, bottom: 315, halfWidth: 122, tips: 5 },
  { top: 225, bottom: 420, halfWidth: 162, tips: 6 },
  { top: 320, bottom: 530, halfWidth: 202, tips: 7 },
  { top: 420, bottom: 640, halfWidth: 240, tips: 8 },
  { top: 520, bottom: 742, halfWidth: 274, tips: 9 },
] as const;

type Tier = (typeof TIERS)[number];

// Light strands wrap the cone diagonally, rising to the left.
const STRANDS = [205, 292, 388, 484, 582, 680];
const SCALLOP_DEPTH = 24;

const point = (x: number, y: number) => x.toFixed(1) + "," + y.toFixed(1);

const tipXs = (tier: Tier) =>
  Array.from(
    { length: tier.tips + 1 },
    (_, index) => CENTER_X + tier.halfWidth - (2 * tier.halfWidth * index) / tier.tips,
  );

const tipY = (tier: Tier, index: number) => tier.bottom + (index % 2 === 0 ? 0 : 7);

const hemPath = (tier: Tier, lift: number) => {
  const xs = tipXs(tier);
  return xs
    .slice(1)
    .map((x, index) => {
      const middle = (xs[index] + x) / 2;
      return "Q" + point(middle, tier.bottom - SCALLOP_DEPTH - lift) + " " + point(x, tipY(tier, index + 1) - lift);
    })
    .join(" ");
};

const tierPath = (tier: Tier) => {
  const height = tier.bottom - tier.top;
  const right = CENTER_X + tier.halfWidth;
  const left = CENTER_X - tier.halfWidth;
  return (
    "M" +
    point(CENTER_X, tier.top) +
    " C" +
    point(CENTER_X + tier.halfWidth * 0.3, tier.top + height * 0.4) +
    " " +
    point(right - tier.halfWidth * 0.15, tier.bottom - height * 0.2) +
    " " +
    point(right, tier.bottom) +
    " " +
    hemPath(tier, 0) +
    " C" +
    point(left + tier.halfWidth * 0.15, tier.bottom - height * 0.2) +
    " " +
    point(CENTER_X - tier.halfWidth * 0.3, tier.top + height * 0.4) +
    " " +
    point(CENTER_X, tier.top) +
    " Z"
  );
};

// Snow rests on the bough tips as a band that follows the hem.
const snowPath = (tier: Tier) => {
  const xs = tipXs(tier);
  const back = xs
    .slice(0, -1)
    .reverse()
    .map((x, index) => {
      const from = xs[xs.length - 1 - index];
      return "Q" + point((from + x) / 2, tier.bottom - SCALLOP_DEPTH - 10) + " " + point(x, tipY(tier, 0) - 8);
    })
    .join(" ");
  return (
    "M" +
    point(xs[0], tipY(tier, 0)) +
    " " +
    hemPath(tier, 0) +
    " L" +
    point(xs[xs.length - 1], tier.bottom - 8) +
    " " +
    back +
    " Z"
  );
};

const boughLines = (tier: Tier) =>
  tipXs(tier)
    .map((x, index) => "M" + point(CENTER_X, tier.top + 18) + " L" + point(x, tipY(tier, index) - 6))
    .join(" ");

const halfWidthAt = (y: number) => ((y - CONE_TOP_Y) / (CONE_BOTTOM_Y - CONE_TOP_Y)) * CONE_HALF_WIDTH * 0.86;

const strandCurve = (y: number) => {
  const halfWidth = halfWidthAt(y);
  return {
    start: { x: CENTER_X - halfWidth, y: y - 20 },
    control: { x: CENTER_X, y: y + 34 },
    end: { x: CENTER_X + halfWidth, y: y + 18 },
    halfWidth,
  };
};

const onCurve = (curve: ReturnType<typeof strandCurve>, t: number) => ({
  x: (1 - t) * (1 - t) * curve.start.x + 2 * (1 - t) * t * curve.control.x + t * t * curve.end.x,
  y: (1 - t) * (1 - t) * curve.start.y + 2 * (1 - t) * t * curve.control.y + t * t * curve.end.y,
});

const TWINKLES = [styles.twinkleA, styles.twinkleB, styles.twinkleC, styles.twinkleD];
const LIGHT_COLOURS = [styles.warm, styles.warm, styles.warm, styles.amber];

const LIGHTS = flatMap(STRANDS, (y, strand) => {
  const curve = strandCurve(y);
  const count = Math.max(2, Math.round((curve.halfWidth * 2) / LIGHT_SPACING_PX));
  return Array.from({ length: count }, (_, index) => {
    const spot = onCurve(curve, (index + 0.5) / count);
    return {
      key: strand + "-" + index,
      className:
        styles.light +
        " " +
        TWINKLES[(index + strand) % TWINKLES.length] +
        " " +
        LIGHT_COLOURS[(index * 3 + strand) % LIGHT_COLOURS.length],
      style: { left: spot.x.toFixed(0) + "px", top: spot.y.toFixed(0) + "px" },
    };
  });
});

const BAUBLE_COLOURS = [
  "url(#christmas-bauble-cranberry)",
  "url(#christmas-bauble-gold)",
  "url(#christmas-bauble-champagne)",
];

const BAUBLES = flatMap(STRANDS, (y, strand) => {
  const curve = strandCurve(y);
  const count = Math.max(1, Math.round(curve.halfWidth / 70));
  return Array.from({ length: count }, (_, index) => {
    const spot = onCurve(curve, (index + 0.25 + (strand % 2) * 0.35) / (count + 0.2));
    return {
      key: strand + "-" + index,
      cx: spot.x.toFixed(1),
      cy: (spot.y + 26).toFixed(1),
      r: 9 + ((index + strand) % 3) * 2,
      fill: BAUBLE_COLOURS[(index + strand) % BAUBLE_COLOURS.length],
    };
  });
});

const STAR_POINTS = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 36 : 15;
  const angle = (index * Math.PI) / 5 - Math.PI / 2;
  return point(CENTER_X + radius * Math.cos(angle), STAR_Y + radius * Math.sin(angle));
}).join(" ");

const RENDERED_TIERS = TIERS.map((tier) => ({
  key: tier.top,
  body: tierPath(tier),
  snow: snowPath(tier),
  boughs: boughLines(tier),
}));

const STRAND_PATHS = STRANDS.map((y) => {
  const curve = strandCurve(y);
  return (
    "M" +
    point(curve.start.x, curve.start.y) +
    " Q" +
    point(curve.control.x, curve.control.y) +
    " " +
    point(curve.end.x, curve.end.y)
  );
});

// A decorated fir lit by warm fairy lights. The boughs, ribbon and baubles are one
// static SVG; the lights and star glow are separate elements that only change opacity.
export const ChristmasTree = ({ class: className, snowy = false }: { class: string; snowy?: boolean }) => (
  <div class={styles.tree + " " + className} aria-hidden="true">
    <svg class={styles.art} viewBox="0 0 560 820">
      <defs>
        <linearGradient id="christmas-tree-boughs" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#1f5a3c" />
          <stop offset="0.45" stop-color="#143f2b" />
          <stop offset="1" stop-color="#0a2418" />
        </linearGradient>
        <radialGradient id="christmas-bauble-cranberry" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#f08a8a" />
          <stop offset="0.35" stop-color="#b3263a" />
          <stop offset="1" stop-color="#4e0b17" />
        </radialGradient>
        <radialGradient id="christmas-bauble-gold" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#fff1c2" />
          <stop offset="0.35" stop-color="#d9a84e" />
          <stop offset="1" stop-color="#6b4614" />
        </radialGradient>
        <radialGradient id="christmas-bauble-champagne" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.4" stop-color="#e9dcc0" />
          <stop offset="1" stop-color="#7c6a4b" />
        </radialGradient>
        <linearGradient id="christmas-tree-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff6d6" />
          <stop offset="0.55" stop-color="#f3c969" />
          <stop offset="1" stop-color="#b9822c" />
        </linearGradient>
      </defs>
      <rect x="268" y="700" width="24" height="70" fill="#3b2414" />
      {RENDERED_TIERS.slice()
        .reverse()
        .map((tier) => (
          <g key={tier.key}>
            <path d={tier.body} fill="#000" opacity="0.35" transform="translate(0 14)" />
            <path d={tier.body} fill="url(#christmas-tree-boughs)" />
            <path d={tier.boughs} stroke="#7fd19a" stroke-opacity="0.12" stroke-width="2" fill="none" />
            {snowy && <path d={tier.snow} fill="#eef4ff" opacity="0.82" />}
          </g>
        ))}
      {STRAND_PATHS.map((d) => (
        <path key={d} d={d} stroke="#e8c983" stroke-opacity="0.55" stroke-width="3" fill="none" />
      ))}
      {BAUBLES.map((bauble) => (
        <g key={bauble.key}>
          <circle cx={bauble.cx} cy={bauble.cy} r={bauble.r} fill={bauble.fill} />
          <circle
            cx={Number(bauble.cx) - bauble.r * 0.35}
            cy={Number(bauble.cy) - bauble.r * 0.35}
            r={bauble.r * 0.28}
            fill="#fff"
            opacity="0.55"
          />
        </g>
      ))}
      <polygon
        points={STAR_POINTS}
        fill="url(#christmas-tree-star)"
        stroke="#fff4cc"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <Gifts />
    </svg>
    {LIGHTS.map((light) => (
      <span key={light.key} class={light.className} style={light.style} />
    ))}
    <span class={styles.halo} />
    <span class={styles.flare + " " + motion.ambient} />
  </div>
);
