const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DECEMBER = 11;
const CHRISTMAS_DAY = 25;

export type ChristmasCountdown =
  | { readonly kind: "countdown"; readonly days: number; readonly hours: number; readonly minutes: number }
  | { readonly kind: "christmas" };

// Christmas Day through New Year's Eve celebrates; from January 1 the clock
// counts down to this year's December 25 at local midnight. The remaining time
// rounds up to a whole minute so the countdown agrees with the wall clock: at
// 18:30 on Christmas Eve it reads 5 h 30 min and turns over as the clock does.
export const getChristmasCountdown = (now: Date): ChristmasCountdown => {
  const year = now.getFullYear();
  if (now.getMonth() === DECEMBER && now.getDate() >= CHRISTMAS_DAY) {
    return { kind: "christmas" };
  }
  const target = new Date(year, DECEMBER, CHRISTMAS_DAY);
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const wholeMinutes = Math.ceil(remaining / MINUTE_MS) * MINUTE_MS;
  return {
    kind: "countdown",
    days: Math.floor(wholeMinutes / DAY_MS),
    hours: Math.floor((wholeMinutes % DAY_MS) / HOUR_MS),
    minutes: Math.floor((wholeMinutes % HOUR_MS) / MINUTE_MS),
  };
};

// The shown countdown can only change on a local minute boundary.
export const msUntilNextMinute = (now: Date) => MINUTE_MS - (now.getSeconds() * SECOND_MS + now.getMilliseconds());

export const padCountdownUnit = (value: number) => (value < 10 ? "0" + value : String(value));
