import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { RADAR_FULL_ZOOM } from "../../../services/radar/rainViewer";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import type { HomeEnvironment } from "../../types";
import { FamilyRadarMap } from "../FamilyRadarMap/FamilyRadarMap";

import styles from "./FamilyRadarFull.module.css";

// Full-screen live radar. Up focuses the corner toggle; Back closes the pane.
export const FamilyRadarFull = ({ env, forecast }: { env: HomeEnvironment; forecast: FamilyForecastSnapshot }) => {
  const { t } = useTranslation();
  return (
    <section
      class={styles.screen}
      data-family-expanded="radar"
      aria-label={t("family.radar") + ", " + forecast.locationLabel}
    >
      <FamilyRadarMap
        enabled
        env={env}
        label={forecast.locationLabel}
        latitude={forecast.latitude}
        longitude={forecast.longitude}
        zoom={RADAR_FULL_ZOOM}
      />
      <p class={styles.hint}>{t("family.closeHint")}</p>
    </section>
  );
};
