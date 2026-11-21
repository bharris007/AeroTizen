import { createSceneRandom } from "./sceneRandom";

export interface RidgeWave {
  readonly amplitude: number;
  readonly period: number;
  readonly phase: number;
}

export interface ForestLook {
  readonly fill: string;
  readonly height: number;
  /** Resting height of the ground line, from the top of the band. */
  readonly ridgeY: number;
  readonly seed: number;
  /** Moonlit snow on the boughs; omit for plain silhouettes. */
  readonly snow?: string;
  readonly treeCount: number;
  readonly treeHeight: readonly [number, number];
  readonly waves: readonly RidgeWave[];
  readonly width: number;
}

const RIDGE_STEP_PX = 24;
const TIERS = 5;

const ridgeAt = (look: ForestLook, x: number) =>
  look.waves.reduce(
    (y, wave) => y + wave.amplitude * Math.sin((x / wave.period) * Math.PI * 2 + wave.phase),
    look.ridgeY,
  );

const ridgePath = (look: ForestLook) => {
  const points = Array.from(
    { length: Math.ceil(look.width / RIDGE_STEP_PX) + 1 },
    (_, index) => index * RIDGE_STEP_PX + "," + ridgeAt(look, index * RIDGE_STEP_PX).toFixed(1),
  );
  return "M0," + look.height + " L" + points.join(" L") + " L" + look.width + "," + look.height + " Z";
};

const tierBox = (base: number, height: number, tier: number) => {
  const top = base - height + tier * height * 0.17;
  const bottom = top + height * 0.3;
  const halfWidth = height * 0.18 * (0.35 + (0.65 * (tier + 1)) / TIERS);
  return { top, bottom, halfWidth };
};

const pinePath = (x: number, base: number, height: number) => {
  const tiers = Array.from({ length: TIERS }, (_, tier) => {
    const { top, bottom, halfWidth } = tierBox(base, height, tier);
    const dip = height * 0.04;
    return (
      `M${x.toFixed(1)},${top.toFixed(1)} L${(x + halfWidth).toFixed(1)},${bottom.toFixed(1)} ` +
      `Q${(x + halfWidth * 0.3).toFixed(1)},${(bottom - dip).toFixed(1)} ${x.toFixed(1)},${(bottom - dip * 0.4).toFixed(1)} ` +
      `Q${(x - halfWidth * 0.3).toFixed(1)},${(bottom - dip).toFixed(1)} ${(x - halfWidth).toFixed(1)},${bottom.toFixed(1)} Z`
    );
  });
  const trunk = height * 0.025;
  return (
    tiers.join(" ") +
    ` M${(x - trunk).toFixed(1)},${(base - height * 0.1).toFixed(1)} h${(trunk * 2).toFixed(1)} v${(height * 0.14).toFixed(1)} h${(-trunk * 2).toFixed(1)} Z`
  );
};

const snowPath = (x: number, base: number, height: number) =>
  Array.from({ length: TIERS }, (_, tier) => {
    const { top, bottom, halfWidth } = tierBox(base, height, tier);
    return (
      `M${x.toFixed(1)},${top.toFixed(1)} L${(x - halfWidth * 0.82).toFixed(1)},${(bottom - height * 0.02).toFixed(1)} ` +
      `L${(x - halfWidth * 0.25).toFixed(1)},${(bottom - height * 0.065).toFixed(1)} Z`
    );
  }).join(" ");

export const createForest = (look: ForestLook) => {
  const random = createSceneRandom(look.seed);
  const trees = Array.from({ length: look.treeCount }, () => {
    const x = random() * look.width;
    const height = look.treeHeight[0] + (look.treeHeight[1] - look.treeHeight[0]) * random();
    return { x, height, base: ridgeAt(look, x) + height * 0.12 * random() + 6 };
  }).sort((a, b) => a.base - b.base);
  return {
    look,
    ground: ridgePath(look) + " " + trees.map((tree) => pinePath(tree.x, tree.base, tree.height)).join(" "),
    snow: look.snow ? trees.map((tree) => snowPath(tree.x, tree.base, tree.height)).join(" ") : "",
  };
};

export type Forest = ReturnType<typeof createForest>;

// A band of hill and pines drawn as one or two paths, so a whole parallax layer
// costs a single paint. Scenes create their forests once at module load.
export const PineForest = ({ forest, class: className }: { forest: Forest; class: string }) => (
  <svg class={className} viewBox={"0 0 " + forest.look.width + " " + forest.look.height} aria-hidden="true">
    <path d={forest.ground} fill={forest.look.fill} />
    {forest.look.snow && <path d={forest.snow} fill={forest.look.snow} />}
  </svg>
);
