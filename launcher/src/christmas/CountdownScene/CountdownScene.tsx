import type { Translate } from "../../shared/i18n/createTranslations";
import type { ChristmasCountdown } from "../christmasCountdown";
import { padCountdownUnit } from "../christmasCountdown";
import { Snowfall } from "../Snowfall/Snowfall";
import { StarField } from "../StarField/StarField";

import styles from "./CountdownScene.module.css";
import { SleighTeam } from "./SleighTeam";
import { SnowyVillage } from "./SnowyVillage";

const UNITS = [
  { unit: "days", label: "christmas.days", className: styles.days },
  { unit: "hours", label: "christmas.hours", className: styles.hours },
  { unit: "minutes", label: "christmas.minutes", className: styles.minutes },
  { unit: "seconds", label: "christmas.seconds", className: styles.seconds },
] as const;

const SPARKLES = [
  { key: "s1", left: "18%", top: "30%", delay: "0s" },
  { key: "s2", left: "80%", top: "26%", delay: "-0.6s" },
  { key: "s3", left: "28%", top: "62%", delay: "-1.1s" },
  { key: "s4", left: "72%", top: "64%", delay: "-1.7s" },
  { key: "s5", left: "50%", top: "18%", delay: "-0.3s" },
  { key: "s6", left: "10%", top: "50%", delay: "-1.4s" },
  { key: "s7", left: "90%", top: "48%", delay: "-0.9s" },
] as const;

export const CountdownScene = ({ countdown, translate }: { countdown: ChristmasCountdown; translate: Translate }) => (
  <div class={styles.scene} data-christmas-countdown={countdown.kind}>
    <StarField />
    <div class={styles.moon} />
    <div class={styles.flight}>
      <div class={styles.sleigh}>
        <div class={styles.trail} />
        <SleighTeam />
      </div>
    </div>
    <SnowyVillage />
    {countdown.kind === "christmas" ? (
      <div class={styles.celebrate}>
        {SPARKLES.map((sparkle) => (
          <span
            key={sparkle.key}
            class={styles.burst}
            style={{ left: sparkle.left, top: sparkle.top, animationDelay: sparkle.delay }}
          />
        ))}
        <h1 class={styles.merry}>{translate("christmas.merry")}</h1>
        <p class={styles.subtitle}>{translate("christmas.merryDetail")}</p>
      </div>
    ) : (
      <div class={styles.countdown}>
        <p class={styles.kicker}>{translate("christmas.coming")}</p>
        <div class={styles.units}>
          {UNITS.map(({ unit, label, className }) => {
            const value = countdown[unit];
            return (
              <div key={unit} class={styles.unit + " " + className} data-christmas-unit={unit}>
                <span key={value} class={styles.value}>
                  {unit === "days" ? String(value) : padCountdownUnit(value)}
                </span>
                <span class={styles.label}>{translate(label)}</span>
              </div>
            );
          })}
        </div>
        <p class={styles.subtitle}>{translate("christmas.untilChristmas")}</p>
      </div>
    )}
    <Snowfall />
  </div>
);
