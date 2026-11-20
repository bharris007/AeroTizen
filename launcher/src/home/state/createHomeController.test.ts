import { expect, test } from "vitest";

import { launcherConfig } from "../../launcherConfig";
import { createStore } from "../../shared/state/createStore";
import type { Inventory } from "../types";

import { createHomeController } from "./createHomeController";

const KEY = launcherConfig.KEY;

const controller = () => {
  const inventory = createStore<Inventory>({
    apps: [{ id: "demo", name: "Demo" }],
    inputs: [],
    items: [],
    ready: true,
  });
  const settings = {
    getSnapshot: () => ({
      continueWatching: false,
      home: ["demo"],
      homeAppLayout: "grid",
      homeCardColumns: 3,
      homeInitialized: true,
    }),
    subscribe: () => () => undefined,
    update: () => undefined,
  };
  const runtime = {
    apps: { byId: (id: string) => (id === "demo" ? { id, name: "Demo" } : undefined) },
    config: launcherConfig,
    continueWatching: { getSnapshot: () => ({ items: [] }) },
    hideToast: () => undefined,
    homewatch: { useSamsungHome: () => undefined },
    inputs: { show: () => undefined },
  };
  return createHomeController(
    {
      appItems: { current: null },
      appViewport: { current: null },
      continueItems: { current: null },
      continueViewport: { current: null },
      describe: () => ({ artwork: [], title: "" }),
      inventory,
      nodes: new Map(),
      rows: { current: null },
      runtime,
      settings,
      showMoveInstructions: () => undefined,
    } as never,
    (action) => {
      action();
    },
  );
};

const press = (home: ReturnType<typeof controller>, code: number) => {
  home.bridge.keydown(code, { preventDefault() {} });
};

const ok = (home: ReturnType<typeof controller>) => {
  press(home, KEY.ENTER);
  home.bridge.keyup(KEY.ENTER);
};

test("moves from the header to Family and between its columns", () => {
  const home = controller();
  home.bridge.focus();
  // Family is the default page; its weather card is the first content item.
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-weather" });

  // Up lands on the Family tab (the default, left-most tab).
  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-tab" });

  // Down moves into the family content columns.
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-weather");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");
  press(home, KEY.UP);
  expect(home.state.getSnapshot().selected).toBe("family-tab");

  // Right moves to the Watch tab; activating it switches pages.
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("home-tab");
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ page: "home", selected: "home-tab" });

  // Back returns to the default Family page.
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-tab" });
});
