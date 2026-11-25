import { ZoomIn, ZoomOut } from "lucide-preact";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { radarViewport } from "../../../services/radar/radarView";
import { useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment, WeatherFocus } from "../../types";
import { FamilyRadarMap } from "../FamilyRadarMap/FamilyRadarMap";

import styles from "./FamilyRadarFull.module.css";

// Full-screen radar. Arrows pan. OK opens zoom. Left and right zoom. Back closes.
export const FamilyRadarFull = ({
  env,
  focus,
  forecast,
}: {
  env: HomeEnvironment;
  focus: WeatherFocus;
  forecast: FamilyForecastSnapshot;
}) => {
  const { t } = useTranslation();
  const saved = useStoreSelector(env.settings, (settings) => settings.radarView);
  const viewport = radarViewport(saved, forecast);
  const hint = (() => {
    if (focus === "zoom") {
      return t("family.radarZoomHint");
    }
    if (focus === "view") {
      return t("family.radarPanHint");
    }
    return t("family.closeHint");
  })();
  const zoom = (delta: number) => (event: MouseEvent) => {
    event.stopPropagation();
    env.zoomRadar(delta);
  };
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
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        zoom={viewport.zoom}
      />
      <div
        class={styles.zoom}
        role="group"
        aria-label={t("family.radarZoom")}
        data-family-radar-zoom
        data-focused={focus === "zoom" ? "true" : undefined}
      >
        <button
          type="button"
          class={styles.zoomButton}
          tabIndex={-1}
          aria-label={t("family.radarZoomIn")}
          data-family-radar-zoom="1"
          onClick={zoom(1)}
        >
          <Icon icon={ZoomIn} size={32} />
        </button>
        <span class={styles.zoomLevel} data-family-radar-zoom-level>
          {viewport.zoom}
        </span>
        <button
          type="button"
          class={styles.zoomButton}
          tabIndex={-1}
          aria-label={t("family.radarZoomOut")}
          data-family-radar-zoom="-1"
          onClick={zoom(-1)}
        >
          <Icon icon={ZoomOut} size={32} />
        </button>
      </div>
      <p class={styles.hint}>{hint}</p>
    </section>
  );
};
