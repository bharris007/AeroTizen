import type { LucideIcon } from "lucide-preact";
import { ChevronLeft, ChevronRight, Flame, Hourglass, Sparkles, TreePine, Undo2 } from "lucide-preact";

import { useStore } from "../../shared/hooks/useStore";
import type { Translate } from "../../shared/i18n/createTranslations";
import { Icon } from "../../shared/icons/Icon/Icon";
import type { Store } from "../../shared/state/createStore";
import { getChristmasCountdown } from "../christmasCountdown";
import type { ChristmasScene } from "../christmasScenes";
import { christmasScenes } from "../christmasScenes";
import { CountdownScene } from "../CountdownScene/CountdownScene";
import { FireplaceScene } from "../FireplaceScene/FireplaceScene";
import { NorthPoleScene } from "../NorthPoleScene/NorthPoleScene";

import styles from "./ChristmasView.module.css";

export interface ChristmasState {
  readonly now: number;
  readonly open: boolean;
  readonly scene: ChristmasScene;
}

const SCENE_ICONS: Record<ChristmasScene, LucideIcon> = {
  countdown: Hourglass,
  fireplace: Flame,
  northPole: TreePine,
};

export const ChristmasView = ({ state, translate }: { state: Store<ChristmasState>; translate: Translate }) => {
  const { open, scene, now } = useStore(state);
  if (!open) {
    return null;
  }
  const active = christmasScenes.find((item) => item.id === scene) ?? christmasScenes[0];
  return (
    <div id="christmas-mode" class={styles.christmas} data-christmas-scene={scene}>
      <div class={styles.stage} role="tabpanel" aria-label={translate(active.label)}>
        {scene === "countdown" && (
          <CountdownScene countdown={getChristmasCountdown(new Date(now))} translate={translate} />
        )}
        {scene === "fireplace" && <FireplaceScene />}
        {scene === "northPole" && <NorthPoleScene translate={translate} />}
      </div>
      <header class={styles.bar}>
        <div class={styles.brand}>
          <Icon icon={Sparkles} />
          <span>{translate("christmas.mode")}</span>
        </div>
        <div class={styles.tabs} role="tablist" aria-label={translate("christmas.scenes")}>
          <Icon icon={ChevronLeft} class={styles.arrow} mirrorInRtl />
          {christmasScenes.map((item) => {
            const selected = item.id === scene;
            return (
              <div
                key={item.id}
                class={styles.tab}
                role="tab"
                aria-selected={selected ? "true" : "false"}
                data-focused={selected ? "true" : undefined}
                data-christmas-tab={item.id}
              >
                <Icon icon={SCENE_ICONS[item.id]} />
                <span>{translate(item.label)}</span>
              </div>
            );
          })}
          <Icon icon={ChevronRight} class={styles.arrow} mirrorInRtl />
        </div>
      </header>
      <footer class={styles.hint}>
        <Icon icon={Undo2} />
        <span>{translate("christmas.exit")}</span>
      </footer>
    </div>
  );
};
