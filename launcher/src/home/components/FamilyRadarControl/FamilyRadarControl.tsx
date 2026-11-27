import { CloudSun, Radar } from "lucide-preact";

import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import { FAMILY_RADAR_KEY } from "../../state/createHomeController";
import type { HomeEnvironment } from "../../types";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyRadarControl.module.css";

// Small corner control on the weather card. Up from the card focuses it; OK toggles live radar.
export const FamilyRadarControl = ({
  env,
  radar,
  registered,
}: {
  env: HomeEnvironment;
  radar: boolean;
  registered: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <HomeControl
      env={env}
      controlKey={FAMILY_RADAR_KEY}
      className={styles.control}
      registered={registered}
      title={t(radar ? "family.showForecast" : "family.showRadar")}
      dataAttributes={{ "data-family-radar": radar ? "on" : "off" }}
    >
      <Icon icon={radar ? CloudSun : Radar} size={36} />
    </HomeControl>
  );
};
