const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DECEMBER = 11;
const CHRISTMAS_DAY = 25;

export type ChristmasCountdown =
  | { readonly kind: "countdown"; days: number; hours: number; minutes: number; seconds: number }
  | { readonly kind: "christmas" };

// Christmas Day through New Year's Eve celebrates; from January 1 the clock
// counts down to this year's December 25 at local midnight.
export const getChristmasCountdown = (now: Date): ChristmasCountdown => {
  const year = now.getFullYear();
  if (now.getMonth() === DECEMBER && now.getDate() >= CHRISTMAS_DAY) {
    return { kind: "christmas" };
  }
  const target = new Date(year, DECEMBER, CHRISTMAS_DAY);
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const wholeSeconds = Math.ceil(remaining / SECOND_MS) * SECOND_MS;
  return {
    kind: "countdown",
    days: Math.floor(wholeSeconds / DAY_MS),
    hours: Math.floor((wholeSeconds % DAY_MS) / HOUR_MS),
    minutes: Math.floor((wholeSeconds % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((wholeSeconds % MINUTE_MS) / SECOND_MS),
  };
};

export const padCountdownUnit = (value: number) => (value < 10 ? "0" + value : String(value));
