import { ChevronLeft, ChevronRight } from "lucide-preact";

import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import { formatCalendarDay } from "../../family/calendarDay";
import type { HomeEnvironment } from "../../types";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyDayControl.module.css";

// "‹ Saturday ›" over the calendar card's top corner. With the remote: Up from the card
// reaches it, Left and Right change the day, OK goes back to today.
export const FamilyDayControl = ({
  day,
  dayOffset,
  env,
  registered,
}: {
  // The shown day's number, and how far it is from today.
  day: number;
  dayOffset: number;
  env: HomeEnvironment;
  registered: boolean;
}) => {
  const { language, t } = useTranslation();
  const name = formatCalendarDay(day, language, "weekday");
  const step = (delta: number) => (event: MouseEvent) => {
    event.stopPropagation();
    env.shiftCalendarDay(delta);
  };
  return (
    <HomeControl
      env={env}
      controlKey="family-day"
      className={styles.control}
      registered={registered}
      title={t("family.showDay", { day: name }) + (dayOffset === 0 ? "" : ". " + t("family.backToToday"))}
      onActivate={() => env.shiftCalendarDay(0)}
      dataAttributes={{ "data-family-day-control": dayOffset }}
    >
      <span class={styles.row}>
        <span class={styles.arrow} onClick={step(-1)} data-family-day-step="-1">
          <Icon icon={ChevronLeft} size={30} mirrorInRtl />
        </span>
        <span class={styles.name} data-family-day-name>
          {name}
        </span>
        <span class={styles.arrow} onClick={step(1)} data-family-day-step="1">
          <Icon icon={ChevronRight} size={30} mirrorInRtl />
        </span>
      </span>
      {dayOffset === 0 ? null : (
        <span class={styles.back} data-family-back-to-today>
          {t("family.backToToday")}
        </span>
      )}
    </HomeControl>
  );
};
