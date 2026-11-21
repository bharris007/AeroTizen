import motion from "../sceneMotion.module.css";

import styles from "./Bokeh.module.css";

export interface BokehLight {
  /** Translucent rgba() colour; the disc's softness and brightness come from its alpha. */
  readonly color: string;
  readonly delayS: number;
  readonly durationS: number;
  readonly key: string;
  readonly sizePx: number;
  /** Centre of the light on the 1920 x 1080 stage. */
  readonly x: number;
  readonly y: number;
}

// Out-of-focus lights in front of a scene. Each disc is a flat translucent
// gradient that only drifts and breathes, so the TV rasters it once.
export const Bokeh = ({ lights }: { lights: readonly BokehLight[] }) => (
  <div class={styles.bokeh} aria-hidden="true">
    {lights.map((light) => (
      <span
        key={light.key}
        class={styles.light + " " + motion.ambient}
        style={{
          left: light.x - light.sizePx / 2 + "px",
          top: light.y - light.sizePx / 2 + "px",
          width: light.sizePx + "px",
          height: light.sizePx + "px",
          background:
            "radial-gradient(circle closest-side, " +
            light.color +
            " 0%, " +
            light.color +
            " 62%, rgba(255, 255, 255, 0) 100%)",
          animationDuration: light.durationS + "s",
          animationDelay: -light.delayS + "s",
        }}
      />
    ))}
  </div>
);
