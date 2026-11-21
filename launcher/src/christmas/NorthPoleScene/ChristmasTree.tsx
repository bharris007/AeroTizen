import styles from "./NorthPoleScene.module.css";

const LIGHT_COLOURS = ["#ff4d4d", "#ffd43b", "#69db7c", "#4dabf7", "#f783ac", "#ff922b"];
const TWINKLES = [styles.lightA, styles.lightB, styles.lightC, styles.lightD];
// Quadratic tinsel curves in tree coordinates: start, control, end.
const STRANDS = [
  { from: [232, 222], control: [320, 262], to: [408, 212], count: 5 },
  { from: [186, 372], control: [320, 432], to: [462, 362], count: 7 },
  { from: [146, 532], control: [320, 600], to: [502, 522], count: 9 },
  { from: [104, 672], control: [320, 742], to: [556, 662], count: 11 },
] as const;

const pointOnStrand = (strand: (typeof STRANDS)[number], t: number) => {
  const inverse = 1 - t;
  return [0, 1].map(
    (axis) => inverse * inverse * strand.from[axis] + 2 * inverse * t * strand.control[axis] + t * t * strand.to[axis],
  );
};

const createLights = () => {
  const lights: { key: string; className: string; style: Record<string, string> }[] = [];
  STRANDS.forEach((strand, row) => {
    for (let index = 0; index < strand.count; index++) {
      const [x, y] = pointOnStrand(strand, (index + 0.5) / strand.count);
      const colour = LIGHT_COLOURS[(index + row * 2) % LIGHT_COLOURS.length];
      lights.push({
        key: row + "-" + index,
        className: styles.light + " " + TWINKLES[(index + row) % TWINKLES.length],
        style: { left: (x - 9).toFixed(0) + "px", top: (y - 9).toFixed(0) + "px", background: colour, color: colour },
      });
    }
  });
  return lights;
};

const LIGHTS = createLights();

const ORNAMENTS = [
  { key: "o1", cx: 280, cy: 300, fill: "#e03131" },
  { key: "o2", cx: 380, cy: 290, fill: "#4dabf7" },
  { key: "o3", cx: 240, cy: 460, fill: "#fcc419" },
  { key: "o4", cx: 410, cy: 470, fill: "#e03131" },
  { key: "o5", cx: 320, cy: 500, fill: "#dee2e6" },
  { key: "o6", cx: 200, cy: 620, fill: "#4dabf7" },
  { key: "o7", cx: 450, cy: 610, fill: "#fcc419" },
  { key: "o8", cx: 330, cy: 640, fill: "#da77f2" },
] as const;

// Scalloped snow along the lower edge of each tier: left x, edge y, right x.
const TIER_SNOW = [
  [50, 700, 590],
  [100, 570, 540],
  [150, 410, 490],
  [200, 250, 440],
].map(([left, y, right]) => {
  const step = (right - left) / 4;
  const scallops = [0, 1, 2, 3].map(
    (index) => "Q" + (left + step * (index + 0.5)) + " " + (y - 18) + " " + (left + step * (index + 1)) + " " + y,
  );
  return { key: y, d: "M" + left + " " + y + " " + scallops.join(" ") };
});

export const ChristmasTree = () => (
  <div class={styles.tree} aria-hidden="true">
    <svg class={styles.treeArt} viewBox="0 0 640 780">
      <rect x="290" y="696" width="60" height="70" fill="#5c3d1e" />
      <path d="M320 430 L50 700 H590 Z" fill="#1b5e34" />
      <path d="M320 300 L100 570 H540 Z" fill="#20703d" />
      <path d="M320 170 L150 410 H490 Z" fill="#25804a" />
      <path d="M320 70 L200 250 H440 Z" fill="#2b9154" />
      {TIER_SNOW.map((snow) => (
        <path key={snow.key} d={snow.d} stroke="#f1f6ff" stroke-width="12" stroke-linecap="round" fill="none" />
      ))}
      {STRANDS.map((strand) => (
        <path
          key={strand.count}
          d={"M" + strand.from.join(" ") + " Q" + strand.control.join(" ") + " " + strand.to.join(" ")}
          stroke="#ffd43b"
          stroke-width="5"
          fill="none"
          opacity="0.85"
        />
      ))}
      {ORNAMENTS.map((ornament) => (
        <g key={ornament.key}>
          <circle cx={ornament.cx} cy={ornament.cy} r="15" fill={ornament.fill} />
          <circle cx={ornament.cx - 5} cy={ornament.cy - 5} r="4" fill="#fff" opacity="0.7" />
        </g>
      ))}
    </svg>
    {LIGHTS.map((light) => (
      <span key={light.key} class={light.className} style={light.style} />
    ))}
    <div class={styles.starHalo} />
    <svg class={styles.star} viewBox="0 0 120 120">
      <polygon
        points="60,4 74,44 116,44 82,68 95,110 60,85 25,110 38,68 4,44 46,44"
        fill="#ffd43b"
        stroke="#fff3bf"
        stroke-width="4"
      />
    </svg>
  </div>
);
