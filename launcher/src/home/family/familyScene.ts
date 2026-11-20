import { type WeatherPhotoScene, weatherPhotoScene } from "../../backgrounds/createWeatherPhoto";
import type { SolarPhase } from "../../contracts/status";
import { zonedDate } from "../../shared/time/zonedDate";

const SUNSET_WINDOW_MINUTES = 45;
const FALLBACK_DAWN_HOUR = 6;
const FALLBACK_DUSK_HOUR = 20;

// Night outside sunrise to sunset, sunset in the last 45 minutes of daylight, otherwise day.
// Without sun times the hour of day decides: night before 6am and from 8pm.
export const familyPhase = (
  now: number,
  timeZone: string,
  sunriseMinute: number | null,
  sunsetMinute: number | null,
): SolarPhase => {
  const zoned = zonedDate(now, timeZone);
  const minute = zoned.getHours() * 60 + zoned.getMinutes();
  if (sunriseMinute === null || sunsetMinute === null || sunriseMinute >= sunsetMinute) {
    if (zoned.getHours() < FALLBACK_DAWN_HOUR || zoned.getHours() >= FALLBACK_DUSK_HOUR) {
      return "night";
    }
    return "day";
  }
  if (minute < sunriseMinute || minute >= sunsetMinute) {
    return "night";
  }
  return minute >= sunsetMinute - SUNSET_WINDOW_MINUTES ? "sunset" : "day";
};

export const familyScene = (code: number | null, phase: SolarPhase): WeatherPhotoScene => {
  const scene = code === null ? null : weatherPhotoScene({ at: 0, code }, phase || "day");
  return scene || (phase === "night" ? "night" : "cloud");
};
