import { createSceneRandom } from "../sceneRandom";

import styles from "./FireplaceScene.module.css";

const CENTER = 140;
const RADIUS = 92;
const NEEDLE_COUNT = 360;
const NEEDLE_COLOURS = ["#0f2e1c", "#163d26", "#1f5233", "#2c6b42", "#3a7d50"];

const createNeedles = () => {
  const random = createSceneRandom(97);
  const paths = NEEDLE_COLOURS.map(() => [] as string[]);
  for (let index = 0; index < NEEDLE_COUNT; index++) {
    const around = (index / NEEDLE_COUNT) * Math.PI * 2;
    const ring = RADIUS + (random() - 0.5) * 44;
    const x = CENTER + Math.cos(around) * ring;
    const y = CENTER + Math.sin(around) * ring;
    const angle = around + Math.PI / 2 + (random() - 0.5) * 1.6;
    const length = 14 + random() * 14;
    paths[Math.floor(random() * NEEDLE_COLOURS.length)].push(
      `M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(angle) * length).toFixed(1)} ${(Math.sin(angle) * length).toFixed(1)}`,
    );
  }
  return paths.map((segments, index) => ({
    key: NEEDLE_COLOURS[index],
    colour: NEEDLE_COLOURS[index],
    d: segments.join(" "),
  }));
};

const NEEDLES = createNeedles();

const BERRIES = [20, 65, 120, 160, 215, 250, 300, 340].map((degrees, index) => {
  const angle = (degrees * Math.PI) / 180;
  const ring = RADIUS + (index % 2 === 0 ? -14 : 16);
  return {
    key: degrees,
    x: CENTER + Math.cos(angle) * ring,
    y: CENTER + Math.sin(angle) * ring,
    gold: index % 3 === 0,
  };
});

// A dense evergreen wreath with berries and a velvet bow, hung over the mantel.
export const Wreath = () => (
  <svg class={styles.wreath} viewBox="0 0 280 330" aria-hidden="true">
    <circle cx={CENTER} cy={CENTER} r={RADIUS} stroke="#0b2216" stroke-width="44" fill="none" />
    {NEEDLES.map((needles) => (
      <path
        key={needles.key}
        d={needles.d}
        stroke={needles.colour}
        stroke-width="3.2"
        stroke-linecap="round"
        fill="none"
      />
    ))}
    {BERRIES.map((berry) => (
      <circle
        key={berry.key}
        cx={berry.x.toFixed(1)}
        cy={berry.y.toFixed(1)}
        r={berry.gold ? 9 : 7}
        fill={berry.gold ? "#c9973f" : "#a3172b"}
      />
    ))}
    <path d="M140 236 L104 318 L124 312 L140 270 L156 312 L176 318 Z" fill="#7d1220" />
    <path d="M140 238 Q98 196 86 230 Q90 262 140 244 Q190 262 194 230 Q182 196 140 238 Z" fill="#a3172b" />
    <path d="M140 238 Q104 212 96 232 Q104 246 140 240 Z" fill="#c22a3c" opacity="0.6" />
    <ellipse cx="140" cy="240" rx="14" ry="12" fill="#7d1220" />
  </svg>
);
