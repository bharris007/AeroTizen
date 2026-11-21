import { useMemo } from "preact/hooks";

import type { CalendarEvent } from "../../../contracts/familyCalendar";
import type { TimeFormat } from "../../../contracts/preferences";
import type { Translate } from "../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import { CALENDAR_HOURS, calendarNowTop, formatCalendarDay } from "../../family/calendarDay";
import { agendaForDay, eventTint, formatEventTime, todayNumber } from "../../family/calendarEvents";
import { formatFamilyHour } from "../../family/formatFamilyHour";
import type { HomeEnvironment } from "../../types";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyCalendar.module.css";

const EVENT_TINT_ALPHA = 0.3;

// "Today", "Tomorrow", "Yesterday", or the weekday's name.
export const relativeDay = (offset: number, day: number, language: string, t: Translate) => {
  if (offset === 0) {
    return t("family.today");
  }
  if (offset === 1) {
    return t("family.tomorrow");
  }
  return offset === -1 ? t("family.yesterday") : formatCalendarDay(day, language, "weekday");
};
// Blocks shorter than this show the title and time on one line.
const COMPACT_BLOCK_FRACTION = 0.06;

export const FamilyCalendar = ({
  cardClass,
  dayOffset,
  env,
  events,
  now,
  registered,
  timeFormat,
  timeZone,
}: {
  cardClass: string;
  // Days from today shown on the card.
  dayOffset: number;
  env: HomeEnvironment;
  events: readonly CalendarEvent[];
  now: number;
  registered: boolean;
  timeFormat: TimeFormat;
  timeZone: string;
}) => {
  const { language, t } = useTranslation();
  const day = todayNumber(now, timeZone) + dayOffset;
  const isToday = dayOffset === 0;
  const date = formatCalendarDay(day, language, "long");
  const nowTop = isToday ? calendarNowTop(now, timeZone) : null;
  const agenda = useMemo(() => agendaForDay(events, day, timeZone), [events, day, timeZone]);
  const summary = (() => {
    if (agenda.count === 0) {
      return t("family.noEvents");
    }
    if (agenda.count === 1) {
      return t(isToday ? "family.oneEvent" : "family.oneEventOnDay");
    }
    return t(isToday ? "family.eventsToday" : "family.eventsOnDay", { count: agenda.count });
  })();
  const relative = relativeDay(dayOffset, day, language, t);
  const title = relative + ", " + date + ", " + summary + ". " + t("family.openFullScreen");
  const time = (instant: number) => formatEventTime(instant, timeZone, timeFormat, t);
  return (
    <HomeControl env={env} controlKey="family-calendar" className={cardClass} registered={registered} title={title}>
      <div class={styles.kicker} data-family-relative={isToday ? "today" : dayOffset}>
        {isToday ? <span class={styles.todayBadge}>{relative}</span> : relative}
      </div>
      <div class={styles.date + " " + text.truncate} data-family-date>
        {date}
      </div>
      {agenda.allDay.length > 0 && (
        <ul class={styles.allDay} data-family-all-day aria-label={t("family.allDay")}>
          {agenda.allDay.map((event) => (
            <li
              key={event.id}
              class={styles.chip + " " + text.truncate}
              style={{ background: eventTint(event.color, EVENT_TINT_ALPHA), borderColor: event.color }}
              data-family-event="all-day"
            >
              {event.title || t("family.untitled")}
            </li>
          ))}
        </ul>
      )}
      <div class={styles.grid} data-family-calendar>
        {CALENDAR_HOURS.map((hour) => (
          <div class={styles.hour} key={hour}>
            <div class={styles.label}>{formatFamilyHour(hour, timeFormat, t)}</div>
            <div class={styles.line} />
          </div>
        ))}
        {agenda.count === 0 && <div class={styles.empty}>{t("family.noEvents")}</div>}
        {agenda.timed.length > 0 && (
          <ul class={styles.events}>
            {agenda.timed.map(({ column, columns, event, height, top }) => (
              <li
                key={event.id}
                class={styles.event + (height < COMPACT_BLOCK_FRACTION ? " " + styles.compact : "")}
                style={{
                  background: eventTint(event.color, EVENT_TINT_ALPHA),
                  borderColor: event.color,
                  height: height * 100 + "%",
                  left: (column / columns) * 100 + "%",
                  top: top * 100 + "%",
                  width: 100 / columns + "%",
                }}
                data-family-event="timed"
              >
                <span class={styles.eventTitle + " " + text.truncate}>{event.title || t("family.untitled")}</span>
                <span class={styles.eventTime + " " + text.truncate}>
                  {event.end > event.start ? time(event.start) + " – " + time(event.end) : time(event.start)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {nowTop === null ? null : <div class={styles.now} data-family-now style={{ top: nowTop * 100 + "%" }} />}
      </div>
    </HomeControl>
  );
};
