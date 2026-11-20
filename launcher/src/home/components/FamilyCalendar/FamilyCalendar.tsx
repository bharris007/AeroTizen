import type { TimeFormat } from "../../../contracts/preferences";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import { CALENDAR_HOURS, calendarNowTop, formatFamilyDate } from "../../family/calendarDay";
import { formatFamilyHour } from "../../family/formatFamilyHour";
import type { HomeEnvironment } from "../../types";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyCalendar.module.css";

export const FamilyCalendar = ({
  cardClass,
  env,
  now,
  registered,
  timeFormat,
  timeZone,
}: {
  cardClass: string;
  env: HomeEnvironment;
  now: number;
  registered: boolean;
  timeFormat: TimeFormat;
  timeZone: string;
}) => {
  const { language, t } = useTranslation();
  const date = formatFamilyDate(now, timeZone, language);
  const nowTop = calendarNowTop(now, timeZone);
  const title = t("family.today") + ", " + date + ", " + t("family.noEvents");
  return (
    <HomeControl env={env} controlKey="family-calendar" className={cardClass} registered={registered} title={title}>
      <div class={styles.kicker}>{t("family.today")}</div>
      <div class={styles.date + " " + text.truncate} data-family-date>
        {date}
      </div>
      <div class={styles.grid} data-family-calendar>
        {CALENDAR_HOURS.map((hour) => (
          <div class={styles.hour} key={hour}>
            <div class={styles.label}>{formatFamilyHour(hour, timeFormat, t)}</div>
            <div class={styles.line} />
          </div>
        ))}
        <div class={styles.empty}>{t("family.noEvents")}</div>
        {nowTop === null ? null : <div class={styles.now} data-family-now style={{ top: nowTop * 100 + "%" }} />}
      </div>
    </HomeControl>
  );
};
