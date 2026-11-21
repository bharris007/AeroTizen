import styles from "./FireplaceScene.module.css";

interface Props {
  accent: string;
  body: string;
  delay: string;
  x: number;
}

export const Stocking = ({ accent, body, delay, x }: Props) => (
  <div class={styles.stocking} style={{ left: x + "px", animationDelay: delay }}>
    <svg viewBox="0 0 120 210" class={styles.stockingArt} aria-hidden="true">
      <path d="M58 0 V18" stroke="#c9a46a" stroke-width="4" />
      <path
        d="M28 40 H92 V128 Q92 150 110 162 Q124 176 112 196 Q100 212 70 200 L30 180 Q8 168 20 142 L28 128 Z"
        fill={body}
      />
      <path d="M40 70 H82 M36 100 H88 M30 130 H86" stroke={accent} stroke-width="8" stroke-dasharray="10 8" />
      <path d="M88 186 Q110 198 116 182" stroke="#f8f9fa" stroke-width="12" stroke-linecap="round" fill="none" />
      <rect x="20" y="16" width="80" height="34" rx="12" fill="#f8f9fa" />
    </svg>
  </div>
);
