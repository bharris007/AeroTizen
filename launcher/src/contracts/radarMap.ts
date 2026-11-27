import type { Store } from "../shared/state/createStore";

export interface RadarFrame {
  readonly kind: "forecast" | "past";
  readonly path: string;
  readonly time: number;
}

export type RadarMapStatus = "loading" | "ready" | "unavailable";

// Latest RainViewer frames. The host and paths come from their public maps API.
export interface RadarMapSnapshot {
  readonly frames: readonly RadarFrame[];
  // Unix seconds when RainViewer generated this catalog, or 0 when unknown.
  readonly generated: number;
  readonly host: string;
  readonly status: RadarMapStatus;
}

export interface RadarMapService extends Store<RadarMapSnapshot> {
  dispose(): void;
  // Fetches while at least one radar view is watching. The last watcher stops the refresh.
  watch(): () => void;
}
