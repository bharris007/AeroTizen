import { DAY_MS, parseIcsDate } from "./icsTime";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface WeekdayRule {
  // 0 means every matching weekday in the period; negative counts from the end.
  readonly ordinal: number;
  // 0 = Sunday ... 6 = Saturday.
  readonly weekday: number;
}

export interface RecurrenceRule {
  readonly byDay: readonly WeekdayRule[];
  readonly byMonth: readonly number[];
  readonly byMonthDay: readonly number[];
  readonly bySetPos: readonly number[];
  readonly count: number | null;
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  // Raw UNTIL value; the caller resolves it in the event's zone.
  readonly until: string | null;
  readonly weekStart: number;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const FREQUENCIES: readonly RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
// Guards against malformed rules that never reach the window.
const MAX_PERIODS = 20000;
const MAX_INTERVAL = 1000;

const numbers = (value: string | undefined, min: number, max: number) =>
  (value || "")
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item !== 0 && Math.abs(item) >= min && Math.abs(item) <= max);

export const parseRecurrenceRule = (raw: string): RecurrenceRule | null => {
  const parts: Record<string, string> = {};
  raw.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index > 0) {
      parts[part.slice(0, index).trim().toUpperCase()] = part
        .slice(index + 1)
        .trim()
        .toUpperCase();
    }
  });
  const frequency = FREQUENCIES.find((item) => item === parts.FREQ);
  if (!frequency) {
    return null;
  }
  const interval = Number(parts.INTERVAL || 1);
  const count = parts.COUNT === undefined ? null : Number(parts.COUNT);
  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > MAX_INTERVAL ||
    (count !== null && (!Number.isInteger(count) || count < 1))
  ) {
    return null;
  }
  const byDay: WeekdayRule[] = [];
  (parts.BYDAY || "").split(",").forEach((item) => {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(item.trim());
    if (match) {
      byDay.push({ ordinal: Number(match[1] || 0), weekday: WEEKDAYS.indexOf(match[2]) });
    }
  });
  const weekStart = WEEKDAYS.indexOf(parts.WKST || "MO");
  return {
    byDay,
    byMonth: numbers(parts.BYMONTH, 1, 12).filter((month) => month > 0),
    byMonthDay: numbers(parts.BYMONTHDAY, 1, 31),
    bySetPos: numbers(parts.BYSETPOS, 1, 366),
    count,
    frequency,
    interval,
    until: parts.UNTIL && parseIcsDate(parts.UNTIL) ? parts.UNTIL : null,
    weekStart: weekStart < 0 ? 1 : weekStart,
  };
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const weekdayOf = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).getUTCDay();

// Days of the month matching weekday rules; ordinals count within the month.
const monthDaysByWeekday = (year: number, month: number, rules: readonly WeekdayRule[]) => {
  const length = daysInMonth(year, month);
  const days: number[] = [];
  rules.forEach(({ ordinal, weekday }) => {
    const matches: number[] = [];
    for (let day = 1; day <= length; day += 1) {
      if (weekdayOf(year, month, day) === weekday) {
        matches.push(day);
      }
    }
    if (ordinal === 0) {
      days.push(...matches);
      return;
    }
    const match = ordinal > 0 ? matches[ordinal - 1] : matches[matches.length + ordinal];
    if (match !== undefined) {
      days.push(match);
    }
  });
  return days;
};

const monthDays = (year: number, month: number, rule: RecurrenceRule, startDay: number) => {
  const length = daysInMonth(year, month);
  const byMonthDay = rule.byMonthDay
    .map((day) => (day > 0 ? day : length + day + 1))
    .filter((day) => day >= 1 && day <= length);
  if (rule.byDay.length) {
    const weekdays = monthDaysByWeekday(year, month, rule.byDay);
    return rule.byMonthDay.length ? byMonthDay.filter((day) => weekdays.includes(day)) : weekdays;
  }
  if (rule.byMonthDay.length) {
    return byMonthDay;
  }
  return startDay <= length ? [startDay] : [];
};

const uniqueSorted = (values: readonly number[]) =>
  values.filter((value, index) => values.indexOf(value) === index).sort((a, b) => a - b);

const applySetPosition = (candidates: readonly number[], positions: readonly number[]) => {
  if (!positions.length) {
    return candidates;
  }
  return uniqueSorted(
    positions
      .map((position) => (position > 0 ? candidates[position - 1] : candidates[candidates.length + position]))
      .filter((value): value is number => value !== undefined),
  );
};

const monthOfWall = (wall: number) => {
  const date = new Date(wall);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

// First period worth generating when there is no COUNT to honour.
const firstPeriod = (rule: RecurrenceRule, startWall: number, fromWall: number) => {
  if (rule.count !== null || fromWall <= startWall) {
    return 0;
  }
  const span = fromWall - startWall;
  const periods = (() => {
    if (rule.frequency === "DAILY") {
      return Math.floor(span / DAY_MS);
    }
    if (rule.frequency === "WEEKLY") {
      return Math.floor(span / (7 * DAY_MS));
    }
    const months = monthOfWall(fromWall) - monthOfWall(startWall);
    return rule.frequency === "MONTHLY" ? months : Math.floor(months / 12);
  })();
  return Math.max(0, Math.floor(periods / rule.interval) - 1);
};

// Day starts (wall milliseconds at 00:00) of candidate dates for one period, ascending.
const periodDays = (rule: RecurrenceRule, start: Date, period: number): number[] => {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  const step = period * rule.interval;
  if (rule.frequency === "DAILY") {
    const date = Date.UTC(year, month, day + step);
    const value = new Date(date);
    const matches =
      (!rule.byDay.length || rule.byDay.some((item) => item.weekday === value.getUTCDay())) &&
      (!rule.byMonth.length || rule.byMonth.includes(value.getUTCMonth() + 1)) &&
      (!rule.byMonthDay.length ||
        rule.byMonthDay.some(
          (item) =>
            (item > 0 ? item : daysInMonth(value.getUTCFullYear(), value.getUTCMonth()) + item + 1) ===
            value.getUTCDate(),
        ));
    return matches ? [date] : [];
  }
  if (rule.frequency === "WEEKLY") {
    const offset = (start.getUTCDay() - rule.weekStart + 7) % 7;
    const weekStart = Date.UTC(year, month, day - offset + step * 7);
    const weekdays = rule.byDay.length ? rule.byDay.map((item) => item.weekday) : [start.getUTCDay()];
    const days = uniqueSorted(weekdays.map((weekday) => weekStart + ((weekday - rule.weekStart + 7) % 7) * DAY_MS));
    return days.filter((value) => !rule.byMonth.length || rule.byMonth.includes(new Date(value).getUTCMonth() + 1));
  }
  if (rule.frequency === "MONTHLY") {
    const first = new Date(Date.UTC(year, month + step, 1));
    const targetYear = first.getUTCFullYear();
    const targetMonth = first.getUTCMonth();
    if (rule.byMonth.length && !rule.byMonth.includes(targetMonth + 1)) {
      return [];
    }
    return uniqueSorted(monthDays(targetYear, targetMonth, rule, day)).map((item) =>
      Date.UTC(targetYear, targetMonth, item),
    );
  }
  const targetYear = year + step;
  const months = rule.byMonth.length ? rule.byMonth.map((item) => item - 1) : [month];
  const days: number[] = [];
  months.forEach((targetMonth) => {
    monthDays(targetYear, targetMonth, rule, day).forEach((item) => days.push(Date.UTC(targetYear, targetMonth, item)));
  });
  return uniqueSorted(days);
};

// Visits occurrence start times (wall milliseconds) in order, from the series start until
// COUNT, UNTIL (inclusive, wall time) or `stopWall`. Occurrences before `fromWall` may be
// skipped when no COUNT needs them.
export const expandRecurrence = (
  rule: RecurrenceRule,
  startWall: number,
  untilWall: number | null,
  fromWall: number,
  stopWall: number,
  visit: (wall: number) => void,
) => {
  const start = new Date(startWall);
  const timeOfDay = startWall - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const limit = untilWall === null ? stopWall : Math.min(untilWall, stopWall);
  let emitted = 0;
  for (let period = firstPeriod(rule, startWall, fromWall), checked = 0; checked < MAX_PERIODS; period += 1) {
    checked += 1;
    const candidates = applySetPosition(periodDays(rule, start, period), rule.bySetPos);
    for (const dayStart of candidates) {
      const wall = dayStart + timeOfDay;
      if (wall < startWall) {
        continue;
      }
      if (wall > limit || (rule.count !== null && emitted >= rule.count)) {
        return;
      }
      emitted += 1;
      visit(wall);
    }
    // A whole period past the limit means nothing later can match.
    const periodStart = periodDays({ ...rule, byDay: [], byMonth: [], byMonthDay: [], bySetPos: [] }, start, period)[0];
    if (periodStart !== undefined && periodStart > limit) {
      return;
    }
  }
};
