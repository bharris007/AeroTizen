import { flatMap } from "../flatMap";
import motion from "../sceneMotion.module.css";

import styles from "./CountdownScene.module.css";

const WALL = "#0f1730";

interface House {
  readonly base: number;
  readonly chimney?: number;
  readonly height: number;
  readonly key: string;
  readonly roof: number;
  readonly width: number;
  readonly windows: readonly (readonly [number, number])[];
  readonly x: number;
}

// Cottages on the hillside, in the village's 1920 x 320 drawing space.
const HOUSES: readonly House[] = [
  {
    key: "mill",
    x: 300,
    base: 168,
    width: 118,
    height: 66,
    roof: 46,
    windows: [
      [20, 22],
      [78, 22],
    ],
    chimney: 82,
  },
  { key: "lane", x: 452, base: 160, width: 86, height: 56, roof: 40, windows: [[34, 20]] },
  {
    key: "inn",
    x: 580,
    base: 152,
    width: 150,
    height: 82,
    roof: 58,
    windows: [
      [18, 26],
      [66, 26],
      [114, 26],
    ],
    chimney: 24,
  },
  {
    key: "school",
    x: 1010,
    base: 146,
    width: 104,
    height: 64,
    roof: 44,
    windows: [
      [18, 22],
      [66, 22],
    ],
  },
  {
    key: "bakery",
    x: 1150,
    base: 146,
    width: 132,
    height: 78,
    roof: 54,
    windows: [
      [22, 26],
      [92, 26],
    ],
    chimney: 96,
  },
  { key: "cottage", x: 1318, base: 150, width: 94, height: 58, roof: 42, windows: [[38, 20]] },
  {
    key: "farm",
    x: 790,
    base: 150,
    width: 124,
    height: 70,
    roof: 48,
    windows: [
      [20, 24],
      [84, 24],
    ],
    chimney: 18,
  },
  { key: "hut", x: 1630, base: 170, width: 80, height: 50, roof: 36, windows: [[30, 18]] },
];

const CHURCH = { x: 1480, base: 156, width: 110, height: 88, roof: 58, tower: 38, spire: 116 } as const;

const WINDOW = { width: 16, height: 20 } as const;

const windowSpots = flatMap(HOUSES, (house) =>
  house.windows.map(([dx, dy]) => ({
    key: house.key + dx,
    x: house.x + dx,
    y: house.base - house.height + dy,
  })),
);

// A few windows flicker as if lit by a fire inside; the rest glow steadily.
const FLICKERING = [windowSpots[2], windowSpots[7], windowSpots[11]].map((spot, index) => ({
  key: spot.key,
  style: {
    left: spot.x + WINDOW.width / 2 - 40 + "px",
    top: spot.y + WINDOW.height / 2 - 40 + "px",
    animationDelay: -index * 1.3 + "s",
  },
}));

const SMOKE = flatMap(
  HOUSES.filter((house) => house.chimney !== undefined),
  (house, chimney) =>
    [0, 1, 2].map((puff) => ({
      key: house.key + puff,
      style: {
        left: house.x + (house.chimney ?? 0) - 6 + "px",
        top: house.base - house.height - house.roof - 6 + "px",
        animationDelay: -(puff * 3 + chimney * 1.7) + "s",
      },
    })),
);

const roofPoints = (x: number, top: number, width: number, roof: number) =>
  `${x - 12},${top + 4} ${x + width / 2},${top - roof} ${x + width + 12},${top + 4}`;

export const MidnightVillage = () => (
  <div class={styles.village + " " + motion.parallaxMid} aria-hidden="true">
    <svg class={styles.villageArt} viewBox="0 0 1920 320">
      <defs>
        <linearGradient id="christmas-village-hill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#4a5c8c" />
          <stop offset="0.25" stop-color="#2b3a66" />
          <stop offset="1" stop-color="#141d3c" />
        </linearGradient>
        <linearGradient id="christmas-village-roof" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#7d8fb8" />
          <stop offset="0.5" stop-color="#b4c3e2" />
          <stop offset="1" stop-color="#dfe7f7" />
        </linearGradient>
        <radialGradient id="christmas-village-window" r="0.5">
          <stop offset="0" stop-color="#ffc06a" stop-opacity="0.55" />
          <stop offset="1" stop-color="#ffc06a" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d="M-60 180 Q300 128 640 156 T1300 146 T1980 168 V320 H-60 Z" fill="url(#christmas-village-hill)" />
      {HOUSES.map((house) => {
        const top = house.base - house.height;
        return (
          <g key={house.key}>
            <rect x={house.x} y={top} width={house.width} height={house.height} fill={WALL} />
            {house.chimney !== undefined && (
              <g>
                <rect
                  x={house.x + house.chimney - 8}
                  y={top - house.roof + 2}
                  width="16"
                  height={house.roof * 0.7}
                  fill={WALL}
                />
                <rect
                  x={house.x + house.chimney - 10}
                  y={top - house.roof - 2}
                  width="20"
                  height="6"
                  rx="3"
                  fill="#dfe7f7"
                />
              </g>
            )}
            <polygon points={roofPoints(house.x, top, house.width, house.roof)} fill="url(#christmas-village-roof)" />
            <rect x={house.x - 10} y={top + 4} width={house.width + 20} height="4" fill="#0a1022" opacity="0.6" />
          </g>
        );
      })}
      <g>
        <rect x={CHURCH.x} y={CHURCH.base - CHURCH.height} width={CHURCH.width} height={CHURCH.height} fill={WALL} />
        <polygon
          points={roofPoints(CHURCH.x, CHURCH.base - CHURCH.height, CHURCH.width, CHURCH.roof)}
          fill="url(#christmas-village-roof)"
        />
        <rect
          x={CHURCH.x + CHURCH.width / 2 - CHURCH.tower / 2}
          y={CHURCH.base - CHURCH.height - CHURCH.roof - 40}
          width={CHURCH.tower}
          height="80"
          fill={WALL}
        />
        <polygon
          points={`${CHURCH.x + CHURCH.width / 2 - 26},${CHURCH.base - CHURCH.height - CHURCH.roof - 38} ${CHURCH.x + CHURCH.width / 2},${CHURCH.base - CHURCH.height - CHURCH.spire - 60} ${CHURCH.x + CHURCH.width / 2 + 26},${CHURCH.base - CHURCH.height - CHURCH.roof - 38}`}
          fill="url(#christmas-village-roof)"
        />
        <circle
          cx={CHURCH.x + CHURCH.width / 2}
          cy={CHURCH.base - CHURCH.height - CHURCH.roof - 14}
          r="9"
          fill="#ffd590"
        />
        <path
          d={`M${CHURCH.x + 22} ${CHURCH.base - 8} v-34 q12 -16 24 0 v34 Z M${CHURCH.x + CHURCH.width - 46} ${CHURCH.base - 8} v-34 q12 -16 24 0 v34 Z`}
          fill="#ffcf7e"
        />
      </g>
      {windowSpots.map((spot) => (
        <g key={spot.key}>
          <rect x={spot.x} y={spot.y} width={WINDOW.width} height={WINDOW.height} fill="#ffcf7e" />
          <path
            d={`M${spot.x + WINDOW.width / 2} ${spot.y} v${WINDOW.height} M${spot.x} ${spot.y + WINDOW.height / 2} h${WINDOW.width}`}
            stroke={WALL}
            stroke-width="2"
          />
        </g>
      ))}
      {windowSpots.map((spot) => (
        <circle
          key={spot.key}
          cx={spot.x + WINDOW.width / 2}
          cy={spot.y + WINDOW.height / 2}
          r="38"
          fill="url(#christmas-village-window)"
        />
      ))}
      <circle cx={CHURCH.x + CHURCH.width / 2} cy={CHURCH.base - 30} r="90" fill="url(#christmas-village-window)" />
      <path d="M-60 216 Q260 180 560 200 Q900 222 1240 196 Q1600 172 1980 206 V320 H-60 Z" fill="#1b2650" />
    </svg>
    {FLICKERING.map((spot) => (
      <span key={spot.key} class={styles.windowFlicker} style={spot.style} />
    ))}
    {SMOKE.map((puff) => (
      <span key={puff.key} class={styles.smoke} style={puff.style} />
    ))}
  </div>
);
