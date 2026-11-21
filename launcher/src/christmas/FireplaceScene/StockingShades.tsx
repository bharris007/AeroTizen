import styles from "./FireplaceScene.module.css";

// Shared gradients for every stocking, rendered once by the scene.
export const StockingShades = () => (
  <svg class={styles.defs} aria-hidden="true">
    <defs>
      <linearGradient id="christmas-stocking-shade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#ffb46a" stop-opacity="0.22" />
        <stop offset="0.5" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity="0.35" />
      </linearGradient>
      <linearGradient id="christmas-stocking-cuff" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.35" />
        <stop offset="1" stop-color="#7a6040" stop-opacity="0.35" />
      </linearGradient>
    </defs>
  </svg>
);
