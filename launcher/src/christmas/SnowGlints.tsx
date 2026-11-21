import { createSceneRandom } from "./sceneRandom";

export interface GlintArea {
  readonly bottom: number;
  readonly count: number;
  readonly seed: number;
  readonly top: number;
  readonly width: number;
}

export const createGlints = (area: GlintArea) => {
  const random = createSceneRandom(area.seed);
  return Array.from({ length: area.count }, (_, index) => ({
    key: index,
    cx: (random() * area.width).toFixed(1),
    cy: (area.top + random() * (area.bottom - area.top)).toFixed(1),
    r: (0.8 + random() * 1.6).toFixed(2),
    opacity: (0.35 + random() * 0.55).toFixed(2),
  }));
};

// Static moonlit sparkles on a snow surface, drawn inside the surface's SVG.
export const SnowGlints = ({ glints }: { glints: ReturnType<typeof createGlints> }) => (
  <g fill="#f4f8ff">
    {glints.map((glint) => (
      <circle key={glint.key} cx={glint.cx} cy={glint.cy} r={glint.r} opacity={glint.opacity} />
    ))}
  </g>
);
