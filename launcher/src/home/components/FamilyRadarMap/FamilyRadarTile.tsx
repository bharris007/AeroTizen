import { useEffect, useRef } from "preact/hooks";

import type { RadarTile } from "../../../services/radar/rainViewer";
import { loadRadarTile, type RadarTilePriority } from "../../../services/radar/tileLoadQueue";

import styles from "./FamilyRadarMap.module.css";

// Loads a tile through the shared queue so leaving the view can clear src immediately.
export const FamilyRadarTile = ({
  onSettled,
  priority = "high",
  src,
  tile,
}: {
  onSettled?: (loaded: boolean) => void;
  priority?: RadarTilePriority;
  src: string;
  tile: RadarTile;
}) => {
  const node = useRef<HTMLImageElement>(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  useEffect(() => {
    const image = node.current;
    if (!image || !src) {
      return;
    }
    return loadRadarTile(image, src, {
      onSettled(loaded) {
        settledRef.current?.(loaded);
      },
      priority,
    });
  }, [priority, src]);
  return (
    <img
      ref={node}
      class={styles.image + " " + styles.tile}
      alt=""
      decoding="async"
      style={{ height: tile.size + "px", left: tile.left + "px", top: tile.top + "px", width: tile.size + "px" }}
    />
  );
};
