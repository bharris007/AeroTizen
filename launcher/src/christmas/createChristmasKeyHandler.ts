import type { ChristmasControls } from "../contracts/christmas";
import type { LauncherConfig, RemoteKeyHandler } from "../contracts/launcher";

export const createChristmasKeyHandler = (
  keys: Pick<LauncherConfig["KEY"], "BACK" | "ESC">,
  christmas: Omit<ChristmasControls, "open">,
): RemoteKeyHandler => ({
  isActive: () => christmas.isOpen(),
  subscribe: (listener) => christmas.subscribe?.(listener) ?? (() => {}),
  keydown(code, event) {
    // The mode is a full-screen scene: every other remote key is swallowed so
    // Home underneath never moves while it is open.
    event.preventDefault();
    if (code === keys.BACK || code === keys.ESC) {
      christmas.close();
    }
  },
});
