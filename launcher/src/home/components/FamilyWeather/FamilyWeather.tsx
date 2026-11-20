import { weatherPhotoUrl } from "../../../backgrounds/createWeatherPhoto";
import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { TimeFormat } from "../../../contracts/preferences";
import type { Translate } from "../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import { getWeatherPresentation } from "../../../shared/weather/conditions";
import { WeatherIcon } from "../../../status/WeatherIcon";
import { familyPhase, familyScene } from "../../family/familyScene";
import { formatFamilyHour } from "../../family/formatFamilyHour";
import type { HomeEnvironment } from "../../types";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyWeather.module.css";

const WEEKDAY_KEYS = [
  "family.day0",
  "family.day1",
  "family.day2",
  "family.day3",
  "family.day4",
  "family.day5",
  "family.day6",
] as const;

const temperatureText = (temperature: number | null, t: Translate) => {
  if (temperature === null) {
    return "--°";
  }
  return t("family.temperature", { temperature: Math.round(temperature) });
};

export const FamilyWeather = ({
  cardClass,
  env,
  forecast,
  now,
  registered,
  timeFormat,
}: {
  cardClass: string;
  env: HomeEnvironment;
  forecast: FamilyForecastSnapshot;
  now: number;
  registered: boolean;
  timeFormat: TimeFormat;
}) => {
  const { t } = useTranslation();
  const current = temperatureText(forecast.temperature, t);
  const unavailable = forecast.status === "unavailable";
  const condition = unavailable ? t("weather.unavailable") : t(getWeatherPresentation(forecast.code).condition);
  const showCondition = unavailable || (forecast.status === "ready" && forecast.code !== null);
  const high = forecast.high === null ? "" : t("family.high", { temperature: Math.round(forecast.high) });
  const low = forecast.low === null ? "" : t("family.low", { temperature: Math.round(forecast.low) });
  const title = [t("family.weather"), forecast.locationLabel, current, showCondition ? condition : ""]
    .filter((part) => part)
    .join(", ");
  const scene = familyScene(
    forecast.code,
    familyPhase(now, forecast.timeZone, forecast.sunriseMinute, forecast.sunsetMinute),
  );
  return (
    <HomeControl env={env} controlKey="family-weather" className={cardClass} registered={registered} title={title}>
      <div
        class={styles.photo}
        data-family-photo={scene}
        style={{ backgroundImage: `url("${weatherPhotoUrl(scene)}")` }}
      />
      <div class={styles.hero}>
        <div class={styles.location + " " + text.truncate} data-family-location>
          {forecast.locationLabel}
        </div>
        <div class={styles.current}>
          <div class={styles.temperature} data-family-temperature>
            {current}
          </div>
          {showCondition ? (
            <div class={styles.summary}>
              {forecast.status === "ready" ? (
                <span class={styles.currentIcon}>
                  <WeatherIcon code={forecast.code} />
                </span>
              ) : null}
              <span class={styles.condition}>{condition}</span>
            </div>
          ) : null}
        </div>
        {high || low ? (
          <div class={styles.range}>
            {high ? <span class={styles.rangeItem}>{high}</span> : null}
            {low ? <span class={styles.rangeItem}>{low}</span> : null}
          </div>
        ) : null}
      </div>
      {forecast.days.length > 0 ? (
        <div class={styles.days} data-family-days aria-label={t("family.forecast")}>
          {forecast.days.map((day, index) => (
            <div class={styles.day} key={index} data-family-day={day.weekday}>
              <div class={styles.dayName}>
                {index === 0 ? t("family.today") : t(WEEKDAY_KEYS[day.weekday] ?? "family.day0")}
              </div>
              <div class={styles.dayIcon}>
                <WeatherIcon code={day.code} />
              </div>
              <div class={styles.dayRange}>
                <span>{temperatureText(day.high, t)}</span>
                <span class={styles.dayLow}>{temperatureText(day.low, t)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {forecast.hours.length > 0 ? (
        <div class={styles.hourly} data-family-hourly>
          {forecast.hours.map((hour, index) => (
            <div class={styles.hour} key={hour.hour + "-" + index} data-family-hour={hour.hour}>
              <div class={styles.hourTime}>{formatFamilyHour(hour.hour, timeFormat, t)}</div>
              <div class={styles.hourIcon}>
                <WeatherIcon code={hour.code} />
              </div>
              <div class={styles.hourTemperature}>{temperatureText(hour.temperature, t)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </HomeControl>
  );
};
