import type { TimeFormat } from "../../../contracts/preferences";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { todayNumber } from "../../family/calendarEvents";
import { FAMILY_RADAR_KEY } from "../../state/createHomeController";
import type { HomeEnvironment } from "../../types";
import { FamilyCalendar } from "../FamilyCalendar/FamilyCalendar";
import { FamilyDayControl } from "../FamilyDayControl/FamilyDayControl";
import { FamilyRadarCard } from "../FamilyRadarCard/FamilyRadarCard";
import { FamilyRadarControl } from "../FamilyRadarControl/FamilyRadarControl";
import { FamilyWeather } from "../FamilyWeather/FamilyWeather";

import styles from "./FamilyBoard.module.css";

export const FamilyBoard = ({
  env,
  shown,
  timeFormat,
}: {
  env: HomeEnvironment;
  shown: boolean;
  timeFormat: TimeFormat;
}) => {
  const forecast = useStore(env.runtime.familyForecast);
  const { events } = useStore(env.runtime.familyCalendar);
  const now = useStore(env.status.time);
  const dayOffset = useStoreSelector(env.state, (state) => state.calendarDay);
  const weatherRadar = useStoreSelector(env.state, (state) => state.weatherRadar);
  const expanded = useStoreSelector(env.state, (state) => state.expanded);
  const selected = useStoreSelector(env.state, (state) => state.selected);
  const active = useStoreSelector(env.state, (state) => state.active);
  const radarRevealed = weatherRadar || (active && selected === FAMILY_RADAR_KEY);
  return (
    <div class={styles.board} hidden={!shown} data-family-board>
      <div class={styles.column} data-family-weather-view={weatherRadar ? "radar" : "forecast"}>
        {weatherRadar ? (
          <FamilyRadarCard
            cardClass={styles.card}
            enabled={shown && expanded !== "weather"}
            env={env}
            forecast={forecast}
            registered={shown}
          />
        ) : (
          <FamilyWeather
            cardClass={styles.card}
            env={env}
            forecast={forecast}
            now={now}
            registered={shown}
            timeFormat={timeFormat}
          />
        )}
        <div class={styles.radarSlot} data-family-radar-slot data-revealed={radarRevealed ? "true" : undefined}>
          <FamilyRadarControl env={env} radar={weatherRadar} registered={shown} />
        </div>
      </div>
      <div class={styles.column}>
        <FamilyCalendar
          cardClass={styles.card}
          dayOffset={dayOffset}
          env={env}
          events={events}
          now={now}
          registered={shown}
          timeFormat={timeFormat}
          timeZone={forecast.timeZone}
        />
        <FamilyDayControl
          day={todayNumber(now, forecast.timeZone) + dayOffset}
          dayOffset={dayOffset}
          env={env}
          registered={shown}
        />
      </div>
    </div>
  );
};
