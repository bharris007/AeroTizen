import type { TimeFormat } from "../../../contracts/preferences";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { todayNumber } from "../../family/calendarEvents";
import type { HomeEnvironment } from "../../types";
import { FamilyCalendar } from "../FamilyCalendar/FamilyCalendar";
import { FamilyDayControl } from "../FamilyDayControl/FamilyDayControl";
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
  return (
    <div class={styles.board} hidden={!shown} data-family-board>
      <div class={styles.column}>
        <FamilyWeather
          cardClass={styles.card}
          env={env}
          forecast={forecast}
          now={now}
          registered={shown}
          timeFormat={timeFormat}
        />
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
