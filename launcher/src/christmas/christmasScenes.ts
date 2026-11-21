import type { MessageKey } from "../shared/i18n/catalogues";

export const christmasScenes = [
  { id: "countdown", label: "christmas.countdown" },
  { id: "fireplace", label: "christmas.fireplace" },
  { id: "northPole", label: "christmas.northPole" },
] as const satisfies readonly { id: string; label: MessageKey }[];

export type ChristmasScene = (typeof christmasScenes)[number]["id"];

export const stepChristmasScene = (scene: ChristmasScene, step: number): ChristmasScene => {
  const index = christmasScenes.findIndex((item) => item.id === scene);
  const count = christmasScenes.length;
  return christmasScenes[(((index + step) % count) + count) % count].id;
};
