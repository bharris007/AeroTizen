import type { FamilyDay, FamilyForecastSnapshot, FamilyHour } from "../../contracts/familyForecast";
import { zonedDate } from "../../shared/time/zonedDate";
import { finiteNumber, record, text } from "../weather/readings";

const HOURLY_STRIP_LENGTH = 8;
const DAILY_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAILY_TIME = /T(\d{2}):(\d{2})/;
const HOURLY_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

interface WallClock {
  readonly day: number;
  readonly hour: number;
  readonly month: number;
  readonly year: number;
}

export interface FamilyForecastReading {
  readonly code: number | null;
  readonly days: readonly FamilyDay[];
  readonly high: number | null;
  readonly hours: readonly FamilyHour[];
  readonly low: number | null;
  readonly sunriseMinute: number | null;
  readonly sunsetMinute: number | null;
  readonly temperature: number | null;
  readonly timeZone: string;
}

const wallFromTimestamp = (timestamp: number, timeZone: string): WallClock => {
  const zoned = zonedDate(timestamp, timeZone);
  return {
    day: zoned.getDate(),
    hour: zoned.getHours(),
    month: zoned.getMonth() + 1,
    year: zoned.getFullYear(),
  };
};

const wallFromStamp = (value: string): WallClock | null => {
  const match = HOURLY_TIME.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23) {
    return null;
  }
  return { day, hour, month, year };
};

const isAtOrAfterHour = (sample: WallClock, now: WallClock) => {
  if (sample.year !== now.year) {
    return sample.year > now.year;
  }
  if (sample.month !== now.month) {
    return sample.month > now.month;
  }
  if (sample.day !== now.day) {
    return sample.day > now.day;
  }
  return sample.hour >= now.hour;
};

const list = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const item: unknown = value[index];
    items.push(item);
  }
  return items;
};

const firstNumber = (value: unknown) => {
  const items = list(value);
  return finiteNumber(items[0]) ? items[0] : null;
};

const minuteOfDay = (value: unknown) => {
  const match = typeof value === "string" ? DAILY_TIME.exec(value) : null;
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
};

const parseDays = (daily: Record<string, unknown> | null): readonly FamilyDay[] => {
  const dates = list(daily?.time);
  const codes = list(daily?.weather_code);
  const highs = list(daily?.temperature_2m_max);
  const lows = list(daily?.temperature_2m_min);
  const count = Math.min(dates.length, codes.length, highs.length, lows.length);
  const days: FamilyDay[] = [];
  for (let index = 0; index < count; index++) {
    const stamp = dates[index];
    const match = typeof stamp === "string" ? DAILY_DATE.exec(stamp) : null;
    const code = codes[index];
    const high = highs[index];
    const low = lows[index];
    if (!match || !finiteNumber(code) || !finiteNumber(high) || !finiteNumber(low)) {
      continue;
    }
    const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
    days.push(Object.freeze({ code, high, low, weekday }));
  }
  return Object.freeze(days);
};

// Open-Meteo hourly stamps are local wall times in the requested zone, not UTC.
export const parseFamilyForecast = (
  data: unknown,
  timestamp: number,
  requestedZone: string,
): FamilyForecastReading | null => {
  const body = record(data);
  if (!body || body.error) {
    return null;
  }
  const current = record(body.current);
  const temperature = current && finiteNumber(current.temperature_2m) ? current.temperature_2m : null;
  const code = current && finiteNumber(current.weather_code) ? current.weather_code : null;
  const daily = record(body.daily);
  const high = firstNumber(daily?.temperature_2m_max);
  const low = firstNumber(daily?.temperature_2m_min);
  if (temperature === null && high === null && low === null) {
    return null;
  }
  const reported = text(body.timezone);
  const timeZone = reported && !/\s/.test(reported) ? reported : requestedZone;
  const hourly = record(body.hourly);
  const times = list(hourly?.time);
  const temperatures = list(hourly?.temperature_2m);
  const codes = list(hourly?.weather_code);
  const count = Math.min(times.length, temperatures.length, codes.length);
  const samples: { clock: WallClock; code: number; temperature: number }[] = [];
  for (let index = 0; index < count; index++) {
    const stamp = times[index];
    const sampleTemperature = temperatures[index];
    const sampleCode = codes[index];
    const clock = typeof stamp === "string" ? wallFromStamp(stamp) : null;
    if (!clock || !finiteNumber(sampleTemperature) || !finiteNumber(sampleCode)) {
      continue;
    }
    samples.push({ clock, code: sampleCode, temperature: sampleTemperature });
  }
  const now = wallFromTimestamp(timestamp, timeZone);
  const start = samples.findIndex((sample) => isAtOrAfterHour(sample.clock, now));
  const selected = start < 0 ? [] : samples.slice(start, start + HOURLY_STRIP_LENGTH);
  const hours = Object.freeze(
    selected.map((sample) =>
      Object.freeze({
        code: sample.code,
        hour: sample.clock.hour,
        temperature: sample.temperature,
      }),
    ),
  );
  return Object.freeze({
    code,
    days: parseDays(daily),
    high,
    hours,
    low,
    sunriseMinute: minuteOfDay(list(daily?.sunrise)[0]),
    sunsetMinute: minuteOfDay(list(daily?.sunset)[0]),
    temperature,
    timeZone,
  });
};

export const familyForecastSignature = (
  status: FamilyForecastSnapshot["status"],
  locationLabel: string,
  reading: FamilyForecastReading,
) =>
  JSON.stringify([
    status,
    locationLabel,
    reading.timeZone,
    status === "ready" ? reading.temperature : null,
    status === "ready" ? reading.code : null,
    status === "ready" ? reading.high : null,
    status === "ready" ? reading.low : null,
    status === "ready" ? reading.hours.map((hour) => [hour.hour, hour.temperature, hour.code]) : [],
    status === "ready" ? reading.days.map((day) => [day.weekday, day.high, day.low, day.code]) : [],
    status === "ready" ? [reading.sunriseMinute, reading.sunsetMinute] : [],
  ]);
