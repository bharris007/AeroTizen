import type { Translate } from "../../shared/i18n/createTranslations";
import { Flourish } from "../Flourish";

import styles from "./CountdownScene.module.css";
import { SantaHat } from "./SantaHat";

const SPARKLES = [
  { key: "s1", left: "14%", top: "30%", delay: "0s" },
  { key: "s2", left: "84%", top: "24%", delay: "-0.9s" },
  { key: "s3", left: "24%", top: "64%", delay: "-1.6s" },
  { key: "s4", left: "76%", top: "62%", delay: "-2.3s" },
  { key: "s5", left: "50%", top: "16%", delay: "-0.5s" },
  { key: "s6", left: "8%", top: "52%", delay: "-2.8s" },
  { key: "s7", left: "92%", top: "46%", delay: "-1.2s" },
] as const;

export const Celebration = ({ translate }: { translate: Translate }) => (
  <div class={styles.celebrate}>
    <span class={styles.celebrateGlow} />
    {SPARKLES.map((sparkle) => (
      <span
        key={sparkle.key}
        class={styles.sparkle}
        style={{ left: sparkle.left, top: sparkle.top, animationDelay: sparkle.delay }}
      />
    ))}
    <div class={styles.merryLine}>
      <h1 class={styles.merry}>{translate("christmas.merry")}</h1>
      <SantaHat class={styles.hatOnTitle} />
    </div>
    <Flourish class={styles.flourish} />
    <p class={styles.subtitle}>{translate("christmas.merryDetail")}</p>
  </div>
);
