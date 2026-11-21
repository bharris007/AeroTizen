import type { Translate } from "../../shared/i18n/createTranslations";
import { Snowfall } from "../Snowfall/Snowfall";
import { StarField } from "../StarField/StarField";

import { Cabin } from "./Cabin";
import { ChristmasTree } from "./ChristmasTree";
import { Gifts } from "./Gifts";
import styles from "./NorthPoleScene.module.css";
import { Snowman } from "./Snowman";

export const NorthPoleScene = ({ translate }: { translate: Translate }) => (
  <div class={styles.scene}>
    <StarField />
    <div class={styles.aurora + " " + styles.auroraGreen} />
    <div class={styles.aurora + " " + styles.auroraTeal} />
    <div class={styles.aurora + " " + styles.auroraViolet} />
    <div class={styles.moon} />
    <svg class={styles.hills} viewBox="0 0 1920 460" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 170 Q360 40 760 150 T1500 110 T1920 140 V460 H0 Z" fill="#a9c3ec" />
      <path d="M0 260 Q420 160 900 250 T1920 230 V460 H0 Z" fill="#d6e4fb" />
      <path d="M0 340 Q520 280 1080 330 T1920 320 V460 H0 Z" fill="#f4f8ff" />
    </svg>
    <Cabin />
    <div class={styles.signpost} aria-hidden="true">
      <div class={styles.pole} />
      <div class={styles.sign}>{translate("christmas.northPole")}</div>
    </div>
    <ChristmasTree />
    <Gifts />
    <Snowman />
    <Snowfall density="light" />
  </div>
);
