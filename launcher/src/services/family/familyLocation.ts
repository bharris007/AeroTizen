import type { TemperatureUnit, WeatherLocation } from "../../contracts/preferences";

export const FRANKLIN_LATITUDE = 35.9251;
export const FRANKLIN_LONGITUDE = -86.8689;
export const FRANKLIN_TIME_ZONE = "America/Chicago";
const FORECAST_DAYS = 7;
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const FRANKLIN_LABEL = "Franklin, TN";
const FRANKLIN_NAME = "Franklin";

export const FRANKLIN_TENNESSEE: WeatherLocation = Object.freeze({
  country_code: "US",
  label: FRANKLIN_LABEL,
  latitude: FRANKLIN_LATITUDE,
  longitude: FRANKLIN_LONGITUDE,
  name: FRANKLIN_NAME,
  timezone: FRANKLIN_TIME_ZONE,
});

const usableLocation = (location: WeatherLocation | null | undefined): location is WeatherLocation => {
  if (!location || typeof location.name !== "string" || !location.name.trim()) {
    return false;
  }
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90) {
    return false;
  }
  return Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
};

// Saved weather search wins. An empty or invalid place uses Franklin, Tennessee.
export const resolveFamilyLocation = (location: WeatherLocation | null | undefined) =>
  usableLocation(location) ? location : FRANKLIN_TENNESSEE;

export const familyForecastUrl = (location: WeatherLocation, unit: TemperatureUnit) => {
  const zone = location.timezone || "auto";
  const query = [
    "latitude=" + location.latitude,
    "longitude=" + location.longitude,
    "current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m",
    "hourly=temperature_2m,weather_code,precipitation_probability",
    "daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    "timezone=" + encodeURIComponent(zone),
    "forecast_days=" + FORECAST_DAYS,
  ];
  if (unit === "F") {
    query.push("temperature_unit=fahrenheit", "wind_speed_unit=mph");
  }
  return OPEN_METEO_FORECAST_URL + "?" + query.join("&");
};
