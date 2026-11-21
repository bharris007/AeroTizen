import { useEffect, useState } from "preact/hooks";

import { getChristmasCountdown } from "../../../christmas/christmasCountdown";
import { CountdownScene } from "../../../christmas/CountdownScene/CountdownScene";
import { useTranslation } from "../../../shared/i18n/useTranslation";

import styles from "./XmasBoard.module.css";

const TICK_MS = 1000;

interface XmasTimers {
  clearInterval(id: number): void;
  setInterval(callback: () => void, ms: number): number;
}

// The Xmas tab's page: the Christmas Mode countdown behind the normal launcher header.
// Home only mounts it while the tab is shown; `paused` freezes the ticker and CSS motion
// while Settings or another surface covers the launcher.
export const XmasBoard = ({
  paused,
  now = () => Date.now(),
  timers = window,
}: {
  paused: boolean;
  now?: () => number;
  timers?: XmasTimers;
}) => {
  const { t } = useTranslation();
  const [time, setTime] = useState(now);
  useEffect(() => {
    if (paused) {
      return;
    }
    setTime(now());
    const ticker = timers.setInterval(() => setTime(now()), TICK_MS);
    return () => timers.clearInterval(ticker);
  }, [paused, now, timers]);
  return (
    <div class={styles.board} data-xmas-board data-paused={paused ? "true" : "false"} aria-hidden={paused}>
      <CountdownScene countdown={getChristmasCountdown(new Date(time))} translate={t} />
    </div>
  );
};
