import { ChevronLeft, ChevronRight } from "lucide-preact";
import { useMemo } from "preact/hooks";

import type { CalendarEvent } from "../../../contracts/familyCalendar";
import type { TimeFormat } from "../../../contracts/preferences";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import text from "../../../shared/styles/text.module.css";
import { CALENDAR_HOURS, calendarNowTop, formatCalendarDay, formatCalendarRange } from "../../family/calendarDay";
import { agendaForDay, eventTint, formatEventTime, todayNumber } from "../../family/calendarEvents";
import { formatFamilyHour } from "../../family/formatFamilyHour";
import type { CalendarFocus, CalendarSpan, HomeEnvironment } from "../../types";

import styles from "./FamilyCalendarFull.module.css";

const EVENT_TINT_ALPHA = 0.32;
const COMPACT_BLOCK_FRACTION = 0.06;
const MAX_ALL_DAY_CHIPS = 3;
const SPANS: readonly CalendarSpan[] = [1, 3, 5];
const SPAN_LABELS = { 1: "family.days1", 3: "family.days3", 5: "family.days5" } as const;

// Full-screen calendar: 1, 3 or 5 day columns with an all-day strip and a now line.
// Remote: Left/Right page by the span, Up picks the span, OK returns to today, Back closes.
export const FamilyCalendarFull = ({
  env,
  events,
  focus,
  now,
  span,
  start,
  timeFormat,
  timeZone,
}: {
  env: HomeEnvironment;
  events: readonly CalendarEvent[];
  focus: CalendarFocus;
  now: number;
  span: CalendarSpan;
  // First shown day, in days from today.
  start: number;
  timeFormat: TimeFormat;
  timeZone: string;
}) => {
  const { language, t } = useTranslation();
  const today = todayNumber(now, timeZone);
  const first = today + start;
  const days = useMemo(
    () =>
      Array.from({ length: span }, (_, index) => {
        const day = first + index;
        return { agenda: agendaForDay(events, day, timeZone), day };
      }),
    [events, first, span, timeZone],
  );
  const nowTop = calendarNowTop(now, timeZone);
  const time = (instant: number) => formatEventTime(instant, timeZone, timeFormat, t);
  const range = formatCalendarRange(first, first + span - 1, language);
  return (
    <section
      class={styles.screen + (span === 1 ? " " + styles.single : "")}
      data-family-expanded="calendar"
      data-calendar-span={span}
      data-calendar-start={start}
      aria-label={t("family.calendar") + ", " + range}
    >
      <header class={styles.header}>
        <div class={styles.heading}>
          <div class={styles.kicker}>{t("family.calendar")}</div>
          <div class={styles.rangeRow}>
            <button
              type="button"
              class={styles.page}
              tabIndex={-1}
              aria-label={t("family.earlier")}
              onClick={() => env.pageCalendar(-1)}
              data-calendar-page="-1"
            >
              <Icon icon={ChevronLeft} size={36} mirrorInRtl />
            </button>
            <h2 class={styles.range + " " + text.truncate} data-calendar-range>
              {range}
            </h2>
            <button
              type="button"
              class={styles.page}
              tabIndex={-1}
              aria-label={t("family.later")}
              onClick={() => env.pageCalendar(1)}
              data-calendar-page="1"
            >
              <Icon icon={ChevronRight} size={36} mirrorInRtl />
            </button>
            {start === 0 ? null : (
              <button type="button" class={styles.today} tabIndex={-1} onClick={env.calendarToday} data-calendar-today>
                {t("family.backToToday")}
              </button>
            )}
          </div>
        </div>
        <div
          class={styles.spans}
          role="radiogroup"
          aria-label={t("family.span")}
          data-focused={focus === "span" ? "true" : undefined}
          data-calendar-spans
        >
          {SPANS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              tabIndex={-1}
              aria-checked={value === span}
              class={styles.span}
              onClick={() => env.setCalendarSpan(value)}
              data-calendar-span-option={value}
            >
              {t(SPAN_LABELS[value])}
            </button>
          ))}
        </div>
      </header>
      <div class={styles.body} data-focused={focus === "grid" ? "true" : undefined} data-calendar-grid>
        <div class={styles.columnsHead}>
          <div class={styles.gutter} />
          {days.map(({ day, agenda }) => (
            <div class={styles.dayHead} key={day} data-calendar-day={day - today}>
              <div class={styles.dayName + (day === today ? " " + styles.isToday : "")}>
                {formatCalendarDay(day, language, span === 1 ? "long" : "column")}
              </div>
              <ul class={styles.allDay}>
                {agenda.allDay.slice(0, MAX_ALL_DAY_CHIPS).map((event) => (
                  <li
                    key={event.id}
                    class={styles.chip + " " + text.truncate}
                    style={{ background: eventTint(event.color, EVENT_TINT_ALPHA), borderColor: event.color }}
                    data-family-event="all-day"
                  >
                    {event.title || t("family.untitled")}
                  </li>
                ))}
                {agenda.allDay.length > MAX_ALL_DAY_CHIPS ? (
                  <li class={styles.more}>
                    {t("family.moreEvents", { count: agenda.allDay.length - MAX_ALL_DAY_CHIPS })}
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
        <div class={styles.grid}>
          {CALENDAR_HOURS.map((hour) => (
            <div class={styles.hour} key={hour}>
              <div class={styles.label}>{formatFamilyHour(hour, timeFormat, t)}</div>
              <div class={styles.line} />
            </div>
          ))}
          <div class={styles.columns}>
            {days.map(({ day, agenda }) => (
              <ul class={styles.column} key={day} data-calendar-column={day - today}>
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
                {day === today && nowTop !== null ? (
                  <li class={styles.now} style={{ top: nowTop * 100 + "%" }} data-family-now />
                ) : null}
              </ul>
            ))}
          </div>
        </div>
      </div>
      <p class={styles.hint}>{t("family.calendarHint")}</p>
    </section>
  );
};
