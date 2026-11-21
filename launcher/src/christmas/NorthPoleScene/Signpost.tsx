import styles from "./NorthPoleScene.module.css";

// The striped pole itself, topped with a glowing gold sphere and a carved sign.
export const Signpost = ({ label }: { label: string }) => (
  <div class={styles.signpost} aria-hidden="true">
    <span class={styles.poleGlow} />
    <span class={styles.pole} />
    <span class={styles.poleCap} />
    <div class={styles.sign}>{label}</div>
    <span class={styles.poleDrift} />
  </div>
);
