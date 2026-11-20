import type { TimeFormat } from "../../contracts/preferences";
import type { Translate } from "../../shared/i18n/createTranslations";

const paddedHour = (hour: number) => (hour < 10 ? "0" + hour : String(hour));

export const formatFamilyHour = (hour: number, format: TimeFormat, t: Translate) => {
  if (format === "24") {
    return t("family.hour24", { hour: paddedHour(hour) });
  }
  const onClock = hour % 12 || 12;
  return t(hour < 12 ? "family.hourAm" : "family.hourPm", { hour: onClock });
};
