import type { ChristmasControls } from "../contracts/christmas";
import type { LauncherConfig, RemoteKeyHandler } from "../contracts/launcher";

export const createChristmasKeyHandler = (
  keys: Pick<LauncherConfig["KEY"], "LEFT" | "RIGHT" | "BACK" | "ESC">,
  christmas: Omit<ChristmasControls, "open">,
): RemoteKeyHandler => ({
  isActive: () => christmas.isOpen(),
  subscribe: (listener) => christmas.subscribe?.(listener) ?? (() => {}),
  keydown(code, event) {
    // The mode is a full-screen scene: every other remote key is swallowed so
    // Home underneath never moves while it is open.
    event.preventDefault();
    const rtl = document.documentElement.dir === "rtl";
    if (code === keys.BACK || code === keys.ESC) {
      christmas.close();
    } else if (code === (rtl ? keys.LEFT : keys.RIGHT)) {
      christmas.nextScene();
    } else if (code === (rtl ? keys.RIGHT : keys.LEFT)) {
      christmas.previousScene();
    }
  },
});
