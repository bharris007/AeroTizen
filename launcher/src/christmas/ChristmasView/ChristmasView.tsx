import { Sparkles, Undo2 } from "lucide-preact";

import { useStore } from "../../shared/hooks/useStore";
import type { Translate } from "../../shared/i18n/createTranslations";
import { Icon } from "../../shared/icons/Icon/Icon";
import type { Store } from "../../shared/state/createStore";
import { getChristmasCountdown } from "../christmasCountdown";
import { CountdownScene } from "../CountdownScene/CountdownScene";

import styles from "./ChristmasView.module.css";

export interface ChristmasState {
  readonly now: number;
  readonly open: boolean;
}

export const ChristmasView = ({ state, translate }: { state: Store<ChristmasState>; translate: Translate }) => {
  const { open, now } = useStore(state);
  if (!open) {
    return null;
  }
  return (
    <div id="christmas-mode" class={styles.christmas} role="dialog" aria-label={translate("christmas.mode")}>
      <div class={styles.stage}>
        <CountdownScene countdown={getChristmasCountdown(new Date(now))} translate={translate} />
      </div>
      <div class={styles.chrome}>
        <div class={styles.brand}>
          <Icon icon={Sparkles} />
          <span>{translate("christmas.mode")}</span>
        </div>
        <div class={styles.hint}>
          <Icon icon={Undo2} />
          <span>{translate("christmas.exit")}</span>
        </div>
      </div>
    </div>
  );
};
