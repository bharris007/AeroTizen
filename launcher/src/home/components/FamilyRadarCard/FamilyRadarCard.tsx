import { Minus, Move, Plus } from "lucide-preact";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { radarViewport } from "../../../services/radar/radarView";
import { useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment } from "../../types";
import { FamilyRadarMap } from "../FamilyRadarMap/FamilyRadarMap";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyRadarCard.module.css";

// The weather card while live radar is on. Arrows move between the card, zoom,
// pan button, and radar toggle. OK on the pan button arms map movement. OK on
// the card still opens the full-screen view.
export const FamilyRadarCard = ({
  cardClass,
  enabled,
  env,
  forecast,
  registered,
}: {
  cardClass: string;
  enabled: boolean;
  env: HomeEnvironment;
  forecast: FamilyForecastSnapshot;
  registered: boolean;
}) => {
  const { t } = useTranslation();
  const saved = useStoreSelector(env.settings, (settings) => settings.radarView);
  const focus = useStoreSelector(env.state, (state) => state.weatherFocus);
  const panning = useStoreSelector(env.state, (state) => state.radarPanning);
  const viewport = radarViewport(saved, forecast);
  const title = t("family.radar") + ", " + forecast.locationLabel + ". " + t("family.openFullScreen");
  const zoom = (delta: number) => (event: Event) => {
    event.stopPropagation();
    env.zoomRadar(delta);
  };
  return (
    <HomeControl env={env} controlKey="family-weather" className={cardClass} registered={registered} title={title}>
      <FamilyRadarMap
        enabled={enabled}
        env={env}
        label={forecast.locationLabel}
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        zoom={viewport.zoom}
      />
      <div class={styles.tools} data-family-radar-panning={panning ? "true" : "false"}>
        <div class={styles.zoom} role="group" aria-label={t("family.radarZoom")} data-family-radar-zoom>
          <button
            type="button"
            class={styles.zoomButton}
            tabIndex={-1}
            aria-label={t("family.radarZoomIn")}
            data-family-radar-zoom="1"
            data-focused={focus === "zoomIn" ? "true" : undefined}
            onClick={zoom(1)}
          >
            <Icon icon={Plus} size={26} />
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
            data-focused={focus === "zoomOut" ? "true" : undefined}
            onClick={zoom(-1)}
          >
            <Icon icon={Minus} size={26} />
          </button>
        </div>
        <button
          type="button"
          class={styles.pan}
          tabIndex={-1}
          aria-label={t("family.radarPan")}
          aria-pressed={panning ? "true" : "false"}
          data-family-radar-pan
          data-focused={focus === "pan" ? "true" : undefined}
          data-active={panning ? "true" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            env.toggleRadarPanning();
          }}
        >
          <Icon icon={Move} size={22} />
          <span class={styles.panLabel}>{t(panning ? "family.radarPanOn" : "family.radarPan")}</span>
        </button>
      </div>
    </HomeControl>
  );
};
