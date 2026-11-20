import type { TimeFormat } from "../../../contracts/preferences";
import { useStore } from "../../../shared/hooks/useStore";
import type { HomeEnvironment } from "../../types";
import { FamilyCalendar } from "../FamilyCalendar/FamilyCalendar";
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
  const now = useStore(env.status.time);
  return (
    <div class={styles.board} hidden={!shown} data-family-board>
      <div class={styles.column}>
        <FamilyWeather
          cardClass={styles.card}
          env={env}
          forecast={forecast}
          registered={shown}
          timeFormat={timeFormat}
        />
      </div>
      <div class={styles.column}>
        <FamilyCalendar
          cardClass={styles.card}
          env={env}
          now={now}
          registered={shown}
          timeFormat={timeFormat}
          timeZone={forecast.timeZone}
        />
      </div>
    </div>
  );
};
