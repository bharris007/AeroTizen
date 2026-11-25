import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { radarViewport } from "../../../services/radar/radarView";
import { useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import type { HomeEnvironment } from "../../types";
import { FamilyRadarMap } from "../FamilyRadarMap/FamilyRadarMap";
import { HomeControl } from "../HomeControl/HomeControl";

// The weather card while live radar is on. OK still opens the full-screen view.
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
  const viewport = radarViewport(saved, forecast);
  const title = t("family.radar") + ", " + forecast.locationLabel + ". " + t("family.openFullScreen");
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
    </HomeControl>
  );
};
