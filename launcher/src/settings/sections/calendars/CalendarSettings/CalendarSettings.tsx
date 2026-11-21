import { useEffect, useState } from "preact/hooks";

import type { CalendarSource, CalendarSyncStatus } from "../../../../contracts/familyCalendar";
import type { SettingsSnapshot } from "../../../../contracts/preferences";
import { formatEventTime } from "../../../../home/family/calendarEvents";
import { CALENDAR_RELAY_HOST, formatPairingCode } from "../../../../services/calendar/calendarRelay";
import { FRANKLIN_TIME_ZONE, resolveFamilyLocation } from "../../../../services/family/familyLocation";
import { useStore } from "../../../../shared/hooks/useStore";
import type { MessageKey } from "../../../../shared/i18n/catalogues";
import type { Translate } from "../../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../../shared/i18n/useTranslation";
import { ChoiceOption } from "../../../components/ChoiceOption/ChoiceOption";
import { ControlGroup } from "../../../components/ControlGroup/ControlGroup";
import { SettingsField } from "../../../components/SettingsField/SettingsField";
import { SettingsHint } from "../../../components/SettingsHint/SettingsHint";
import { SettingsToggle } from "../../../components/SettingsToggle/SettingsToggle";
import { useSettingsEnvironment } from "../../../hooks/useSettingsEnvironment";
import type { SettingsActions } from "../../../types";
import { PairingQr } from "../PairingQr/PairingQr";

import styles from "./CalendarSettings.module.css";

const ERROR_MESSAGES: Readonly<Record<Exclude<CalendarSyncStatus["error"], "">, MessageKey>> = {
  invalid: "settings.calendars.errorInvalid",
  network: "settings.calendars.errorNetwork",
  notFound: "settings.calendars.errorNotFound",
};

const statusText = (
  calendar: CalendarSource,
  status: CalendarSyncStatus,
  format: (instant: number) => string,
  t: Translate,
) => {
  if (!calendar.enabled) {
    return t("settings.calendars.off");
  }
  if (status.state === "error" && status.error) {
    const error = t(ERROR_MESSAGES[status.error]);
    return status.lastSyncedAt === null
      ? error
      : error + " " + t("settings.calendars.syncedAt", { time: format(status.lastSyncedAt) });
  }
  if (status.lastSyncedAt !== null) {
    return t("settings.calendars.syncedAt", { time: format(status.lastSyncedAt) });
  }
  return t(status.state === "syncing" ? "settings.calendars.syncing" : "settings.calendars.pending");
};

export const CalendarSettings = ({
  active,
  actions,
  settings,
}: {
  active: boolean;
  actions: Pick<SettingsActions, "removeCalendar" | "setCalendarEnabled">;
  settings: Pick<SettingsSnapshot, "calendars" | "timeFormat" | "weatherLocation">;
}) => {
  const { services, drawer } = useSettingsEnvironment();
  const { t } = useTranslation();
  const calendar = useStore(services.familyCalendar);
  const { category } = useStore(drawer);
  const [confirming, setConfirming] = useState("");
  const shown = active && category === "calendars";
  useEffect(() => {
    if (!shown) {
      return undefined;
    }
    services.familyCalendar.startPairing();
    return () => services.familyCalendar.stopPairing();
  }, [shown, services]);
  useEffect(() => {
    if (!shown) {
      setConfirming("");
    }
  }, [shown]);
  const timeZone = resolveFamilyLocation(settings.weatherLocation).timezone || FRANKLIN_TIME_ZONE;
  const format = (instant: number) => formatEventTime(instant, timeZone, settings.timeFormat, t);
  const { pairing } = calendar;
  const ready = pairing.state === "ready" && Boolean(pairing.code);
  return (
    <>
      <section class={styles.pairing} data-calendar-pairing={pairing.state}>
        <div class={styles.qr}>
          {ready ? (
            <PairingQr label={t("settings.calendars.scan")} value={pairing.url.toUpperCase()} />
          ) : (
            <div class={styles.placeholder} aria-hidden="true" />
          )}
        </div>
        <div class={styles.copy}>
          <h3 class={styles.title}>{t("settings.calendars.addTitle")}</h3>
          <p class={styles.text}>{t("settings.calendars.scan")}</p>
          {ready ? (
            <p class={styles.text}>
              {t("settings.calendars.orVisit", { url: CALENDAR_RELAY_HOST })}{" "}
              <strong class={styles.code} dir="ltr" data-calendar-code>
                {formatPairingCode(pairing.code)}
              </strong>
            </p>
          ) : (
            <p class={styles.text} role="status">
              {t(pairing.state === "offline" ? "settings.calendars.offline" : "settings.calendars.connecting")}
            </p>
          )}
        </div>
      </section>
      <SettingsField
        title={t("settings.calendars.connected")}
        details={settings.calendars.length ? undefined : <SettingsHint>{t("settings.calendars.none")}</SettingsHint>}
      >
        <ControlGroup id="calendar-sync">
          <ChoiceOption
            id="calendars:sync"
            inline
            busy={calendar.syncing}
            disabled={!settings.calendars.length}
            onSelect={services.familyCalendar.syncNow}
          >
            {t(calendar.syncing ? "settings.calendars.syncing" : "settings.calendars.syncNow")}
          </ChoiceOption>
        </ControlGroup>
      </SettingsField>
      {settings.calendars.map((source) => {
        const status = calendar.statuses[source.id];
        const failed = source.enabled && status?.state === "error";
        return (
          <SettingsField
            key={source.id}
            title={source.name}
            description={
              <span class={styles.status} data-calendar-status={source.enabled ? status?.state : "off"}>
                <span class={styles.dot} style={{ background: source.color }} aria-hidden="true" />
                <span class={failed ? styles.error : undefined}>
                  {status ? statusText(source, status, format, t) : t("settings.calendars.pending")}
                </span>
              </span>
            }
          >
            <ControlGroup id={"calendar-" + source.id}>
              <SettingsToggle
                focusKey={"calendar:" + source.id + ":enabled"}
                checked={source.enabled}
                label={t("settings.calendars.show", { name: source.name })}
                onChange={(enabled) => actions.setCalendarEnabled(source.id, enabled)}
              />
              <ChoiceOption
                id={"calendar:" + source.id + ":remove"}
                inline
                selected={confirming === source.id}
                onSelect={() => {
                  if (confirming === source.id) {
                    setConfirming("");
                    actions.removeCalendar(source.id);
                  } else {
                    setConfirming(source.id);
                  }
                }}
              >
                {t(confirming === source.id ? "settings.calendars.confirmRemove" : "settings.calendars.remove")}
              </ChoiceOption>
            </ControlGroup>
          </SettingsField>
        );
      })}
    </>
  );
};
