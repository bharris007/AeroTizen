import styles from "./ChristmasBadge.module.css";

export const BadgeReindeer = () => (
  <svg class={styles.reindeer} viewBox="0 0 80 80" aria-hidden="true">
    <path
      d="M26 22 L18 6 M22 14 L12 12 M20 10 L16 2 M54 22 L62 6 M58 14 L68 12 M60 10 L64 2"
      stroke="#f1d39a"
      stroke-width="4"
      stroke-linecap="round"
      fill="none"
    />
    <ellipse cx="22" cy="30" rx="8" ry="4.5" fill="#8a5530" transform="rotate(-30 22 30)" />
    <ellipse cx="58" cy="30" rx="8" ry="4.5" fill="#8a5530" transform="rotate(30 58 30)" />
    <ellipse cx="40" cy="42" rx="17" ry="20" fill="#a86d38" />
    <ellipse cx="40" cy="56" rx="12" ry="9" fill="#c99260" />
    <circle cx="33" cy="38" r="3" fill="#1a0e05" />
    <circle cx="47" cy="38" r="3" fill="#1a0e05" />
    <circle cx="34" cy="37" r="1" fill="#fff" />
    <circle cx="48" cy="37" r="1" fill="#fff" />
    <circle class={styles.noseGlow} cx="40" cy="58" r="10" fill="#ff4d4d" opacity="0.35" />
    <circle cx="40" cy="58" r="6" fill="#ff1f1f" />
    <circle cx="38" cy="56" r="1.8" fill="#ffd0d0" />
  </svg>
);
