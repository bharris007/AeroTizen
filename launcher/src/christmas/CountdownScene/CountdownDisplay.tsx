import type { Translate } from "../../shared/i18n/createTranslations";
import type { ChristmasCountdown } from "../christmasCountdown";
import { padCountdownUnit } from "../christmasCountdown";
import { Flourish } from "../Flourish";

import styles from "./CountdownScene.module.css";
import { SantaHat } from "./SantaHat";

const UNITS = [
  { unit: "days", label: "christmas.days" },
  { unit: "hours", label: "christmas.hours" },
  { unit: "minutes", label: "christmas.minutes" },
] as const;

export const CountdownDisplay = ({
  countdown,
  translate,
}: {
  countdown: Extract<ChristmasCountdown, { kind: "countdown" }>;
  translate: Translate;
}) => (
  <div class={styles.countdown}>
    <p class={styles.kicker}>{translate("christmas.coming")}</p>
    <Flourish class={styles.flourish} />
    <div class={styles.units}>
      {UNITS.map(({ unit, label }) => {
        const value = countdown[unit];
        return (
          <div key={unit} class={styles.unit} data-christmas-unit={unit}>
            <span class={styles.numeral}>
              <span key={value} class={styles.value}>
                {unit === "days" ? String(value) : padCountdownUnit(value)}
              </span>
              {unit === "days" && <SantaHat class={styles.hatOnDays} />}
            </span>
            <span class={styles.label}>{translate(label)}</span>
          </div>
        );
      })}
    </div>
    <p class={styles.subtitle}>{translate("christmas.untilChristmas")}</p>
  </div>
);
