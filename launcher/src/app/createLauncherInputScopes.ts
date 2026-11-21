import type { HomeBridge, RemoteKeyHandler, SettingsBridge } from "../contracts/launcher";
import { createInputScope } from "../shared/input/createInputScope";

interface KeyTargets {
  christmas: RemoteKeyHandler;
  fireplace: RemoteKeyHandler;
  home: Pick<HomeBridge, "inputScope">;
  inputs: RemoteKeyHandler;
  settings: Pick<SettingsBridge, "inputScope">;
}

// Existing screen controllers remain adapters while their controls adopt scoped actions.
export const createLauncherInputScopes = ({ christmas, fireplace, home, inputs, settings }: KeyTargets) => {
  const overlay = (handler: RemoteKeyHandler) =>
    createInputScope({
      isActive: handler.isActive,
      subscribe: handler.subscribe,
      handle(event) {
        if (event.phase === "down") {
          handler.keydown(event.code, event.nativeEvent);
        }
        return "native";
      },
    });
  return [overlay(christmas), overlay(fireplace), overlay(inputs), settings.inputScope, home.inputScope];
};
