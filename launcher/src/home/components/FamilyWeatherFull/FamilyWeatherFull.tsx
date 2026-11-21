import { Droplets, Sunrise, Sunset, Thermometer, Umbrella, Wind } from "lucide-preact";

import { weatherPhotoUrl } from "../../../backgrounds/createWeatherPhoto";
import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { TemperatureUnit, TimeFormat } from "../../../contracts/preferences";
import type { Translate } from "../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import text from "../../../shared/styles/text.module.css";
import { getWeatherPresentation } from "../../../shared/weather/conditions";
import { WeatherIcon } from "../../../status/WeatherIcon";
import { familyPhase, familyScene } from "../../family/familyScene";
import { formatFamilyHour } from "../../family/formatFamilyHour";
import { temperatureText, WEEKDAY_KEYS } from "../FamilyWeather/FamilyWeather";

import styles from "./FamilyWeatherFull.module.css";

// Small chances are noise on the hourly and daily rows.
const MIN_SHOWN_CHANCE = 10;
const chanceText = (value: number | undefined, t: Translate) =>
  value !== undefined && value >= MIN_SHOWN_CHANCE ? t("family.percent", { value }) : "";

const padded = (value: number) => (value < 10 ? "0" + value : String(value));

const minuteText = (minute: number, format: TimeFormat, t: Translate) => {
  const hour = Math.floor(minute / 60);
  const value = padded(minute % 60);
  if (format === "24") {
    return t("family.time24", { hour: padded(hour), minute: value });
  }
  return t(hour < 12 ? "family.timeAm" : "family.timePm", { hour: hour % 12 || 12, minute: value });
};

// Full-screen weather: current conditions, details, the hourly strip and the week ahead.
export const FamilyWeatherFull = ({
  forecast,
  now,
  timeFormat,
  unit,
}: {
  forecast: FamilyForecastSnapshot;
  now: number;
  timeFormat: TimeFormat;
  unit: TemperatureUnit;
}) => {
  const { t } = useTranslation();
  const scene = familyScene(
    forecast.code,
    familyPhase(now, forecast.timeZone, forecast.sunriseMinute, forecast.sunsetMinute),
  );
  const ready = forecast.status === "ready";
  const condition =
    forecast.status === "unavailable" ? t("weather.unavailable") : t(getWeatherPresentation(forecast.code).condition);
  const { feelsLike, humidity, windSpeed } = forecast.conditions;
  const todayChance = forecast.days[0]?.precipitation;
  const details: { icon: typeof Wind; key: string; label: string }[] = [];
  if (feelsLike !== null) {
    details.push({
      icon: Thermometer,
      key: "feels",
      label: t("family.feelsLike", { temperature: Math.round(feelsLike) }),
    });
  }
  if (windSpeed !== null) {
    details.push({
      icon: Wind,
      key: "wind",
      label: t(unit === "F" ? "family.windMph" : "family.windKmh", { speed: Math.round(windSpeed) }),
    });
  }
  if (humidity !== null) {
    details.push({ icon: Droplets, key: "humidity", label: t("family.humidity", { value: humidity }) });
  }
  if (todayChance !== undefined) {
    details.push({ icon: Umbrella, key: "rain", label: t("family.rainChance", { value: todayChance }) });
  }
  if (forecast.sunriseMinute !== null) {
    details.push({
      icon: Sunrise,
      key: "sunrise",
      label: t("family.sunrise", { time: minuteText(forecast.sunriseMinute, timeFormat, t) }),
    });
  }
  if (forecast.sunsetMinute !== null) {
    details.push({
      icon: Sunset,
      key: "sunset",
      label: t("family.sunset", { time: minuteText(forecast.sunsetMinute, timeFormat, t) }),
    });
  }
  const lows = forecast.days.map((day) => day.low);
  const highs = forecast.days.map((day) => day.high);
  const weekLow = Math.min(...lows);
  const weekSpan = Math.max(1, Math.max(...highs) - weekLow);
  return (
    <section class={styles.screen} data-family-expanded="weather" aria-label={t("family.weather")}>
      <div
        class={styles.photo}
        data-family-photo={scene}
        style={{ backgroundImage: `url("${weatherPhotoUrl(scene)}")` }}
      />
      <div class={styles.layout}>
        <div class={styles.main}>
          <div class={styles.hero}>
            <div class={styles.location + " " + text.truncate}>{forecast.locationLabel}</div>
            <div class={styles.temperature} data-family-temperature>
              {temperatureText(forecast.temperature, t)}
            </div>
            {ready || forecast.status === "unavailable" ? (
              <div class={styles.summary}>
                {ready ? (
                  <span class={styles.summaryIcon}>
                    <WeatherIcon code={forecast.code} />
                  </span>
                ) : null}
                <span>{condition}</span>
              </div>
            ) : null}
            {forecast.high !== null && forecast.low !== null ? (
              <div class={styles.range}>
                <span>{t("family.high", { temperature: Math.round(forecast.high) })}</span>
                <span>{t("family.low", { temperature: Math.round(forecast.low) })}</span>
              </div>
            ) : null}
          </div>
          {details.length ? (
            <ul class={styles.details} data-family-details>
              {details.map((detail) => (
                <li class={styles.detail} key={detail.key} data-family-detail={detail.key}>
                  <Icon icon={detail.icon} size={30} />
                  <span class={text.truncate}>{detail.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {forecast.hours.length ? (
            <div class={styles.panel}>
              <div class={styles.panelTitle}>{t("family.hourlyForecast")}</div>
              <div class={styles.hours} data-family-hourly>
                {forecast.hours.map((hour, index) => (
                  <div class={styles.hour} key={hour.hour + "-" + index}>
                    <div class={styles.hourTime}>
                      {index === 0 ? t("family.now") : formatFamilyHour(hour.hour, timeFormat, t)}
                    </div>
                    <div class={styles.icon}>
                      <WeatherIcon code={hour.code} />
                    </div>
                    <div class={styles.chance}>{chanceText(hour.precipitation, t)}</div>
                    <div class={styles.hourTemperature}>{temperatureText(hour.temperature, t)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {forecast.days.length ? (
          <div class={styles.panel + " " + styles.week}>
            <div class={styles.panelTitle}>{t("family.dailyForecast", { count: forecast.days.length })}</div>
            <ul class={styles.days} data-family-days>
              {forecast.days.map((day, index) => (
                <li class={styles.day} key={index} data-family-day={day.weekday}>
                  <span class={styles.dayName}>
                    {index === 0 ? t("family.today") : t(WEEKDAY_KEYS[day.weekday] ?? "family.day0")}
                  </span>
                  <span class={styles.icon}>
                    <WeatherIcon code={day.code} />
                  </span>
                  <span class={styles.dayChance}>{chanceText(day.precipitation, t)}</span>
                  <span class={styles.dayLow}>{temperatureText(day.low, t)}</span>
                  <span class={styles.bar}>
                    <span
                      class={styles.barFill}
                      style={{
                        left: ((day.low - weekLow) / weekSpan) * 100 + "%",
                        width: ((day.high - day.low) / weekSpan) * 100 + "%",
                      }}
                    />
                  </span>
                  <span class={styles.dayHigh}>{temperatureText(day.high, t)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p class={styles.hint}>{t("family.closeHint")}</p>
    </section>
  );
};
