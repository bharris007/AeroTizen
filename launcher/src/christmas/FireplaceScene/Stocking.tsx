import styles from "./FireplaceScene.module.css";

interface Props {
  readonly body: string;
  readonly delay: string;
  readonly trim: string;
  readonly x: number;
}

const BODY_PATH = "M18 40 H86 V150 Q86 168 102 176 L132 192 Q150 204 140 222 Q128 240 104 230 L40 200 Q18 188 18 160 Z";

// A knitted stocking with a cream cuff, hung from the mantel and swaying gently.
export const Stocking = ({ body, trim, delay, x }: Props) => (
  <div class={styles.stocking} style={{ left: x + "px", animationDelay: delay }}>
    <svg class={styles.stockingArt} viewBox="0 0 160 250" aria-hidden="true">
      <path d="M52 0 V24" stroke="#c9a46a" stroke-width="3" />
      <path d={BODY_PATH} fill={body} />
      <path d={BODY_PATH} fill="url(#christmas-stocking-shade)" />
      <path d="M18 92 H86 M18 104 H86 M18 128 H86 M18 140 H86" stroke={trim} stroke-width="5" opacity="0.85" />
      <path d="M38 116 l6 -6 6 6 6 -6 6 6 6 -6 6 6" stroke={trim} stroke-width="3" fill="none" opacity="0.85" />
      <path d="M104 230 Q128 240 140 222 Q150 204 132 192 L118 185 Q104 206 104 230 Z" fill={trim} opacity="0.9" />
      <rect x="10" y="18" width="84" height="34" rx="10" fill="#efe6d4" />
      <rect x="10" y="18" width="84" height="34" rx="10" fill="url(#christmas-stocking-cuff)" />
    </svg>
  </div>
);
