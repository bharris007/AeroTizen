import type { RidgeWave } from "../PineForest";
import { createSceneRandom } from "../sceneRandom";

export interface CurtainLook {
  readonly gradient: string;
  readonly height: number;
  /** Lower, brightest edge of the curtain. */
  readonly hemY: number;
  readonly rayHeight: readonly [number, number];
  readonly raySpacing: number;
  readonly seed: number;
  readonly waves: readonly RidgeWave[];
  readonly width: number;
}

// A curtain is a row of thin vertical rays whose lower edge follows slow waves.
// Each ray fades out at both ends, so together they read as soft, streaked light.
export const createCurtain = (look: CurtainLook) => {
  const random = createSceneRandom(look.seed);
  return {
    look,
    rays: Array.from({ length: Math.ceil(look.width / look.raySpacing) }, (_, index) => {
      const x = index * look.raySpacing;
      const hem = look.waves.reduce(
        (y, wave) => y + wave.amplitude * Math.sin((x / wave.period) * Math.PI * 2 + wave.phase),
        look.hemY,
      );
      const height = look.rayHeight[0] + (look.rayHeight[1] - look.rayHeight[0]) * random();
      return {
        key: index,
        x: x.toFixed(1),
        y: (hem - height).toFixed(1),
        height: height.toFixed(1),
        opacity: (0.18 + random() * 0.5).toFixed(2),
      };
    }),
  };
};

export const AuroraCurtain = ({
  curtain,
  class: className,
}: {
  curtain: ReturnType<typeof createCurtain>;
  class: string;
}) => (
  <svg class={className} viewBox={"0 0 " + curtain.look.width + " " + curtain.look.height} aria-hidden="true">
    <g fill={"url(#" + curtain.look.gradient + ")"}>
      {curtain.rays.map((ray) => (
        <rect
          key={ray.key}
          x={ray.x}
          y={ray.y}
          width={curtain.look.raySpacing * 1.8}
          height={ray.height}
          opacity={ray.opacity}
        />
      ))}
    </g>
  </svg>
);
