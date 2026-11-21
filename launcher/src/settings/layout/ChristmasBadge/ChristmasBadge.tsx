import { SettingsControl } from "../../components/SettingsControl/SettingsControl";

import { BadgeReindeer } from "./BadgeReindeer";
import styles from "./ChristmasBadge.module.css";

const BULB_COLOURS = ["#ff4d4d", "#ffd43b", "#51cf66", "#4dabf7", "#f783ac"];
const TWINKLES = [styles.twinkleA, styles.twinkleB, styles.twinkleC];
const BULB_COUNT = 11;

const createBulbs = (edge: "top" | "bottom") =>
  Array.from({ length: BULB_COUNT }, (_, index) => ({
    key: edge + index,
    className: styles.bulb + " " + styles[edge] + " " + TWINKLES[index % TWINKLES.length],
    style: {
      left: (4 + (index * 92) / (BULB_COUNT - 1)).toFixed(1) + "%",
      background: BULB_COLOURS[(index + (edge === "top" ? 0 : 2)) % BULB_COLOURS.length],
      color: BULB_COLOURS[(index + (edge === "top" ? 0 : 2)) % BULB_COLOURS.length],
    },
  }));

const BULBS = [...createBulbs("top"), ...createBulbs("bottom")];

interface Props {
  hint: string;
  label: string;
  onSelect(): void;
}

export const ChristmasBadge = ({ hint, label, onSelect }: Props) => (
  <SettingsControl
    id="christmas-mode-badge"
    class={styles.badge}
    focusKey="christmas-mode"
    role="button"
    data-settings-focus-owner="control"
    data-christmas-badge
    onClick={onSelect}
  >
    <span class={styles.glow} aria-hidden="true" />
    <span class={styles.wire} aria-hidden="true" />
    {BULBS.map((bulb) => (
      <span key={bulb.key} class={bulb.className} style={bulb.style} aria-hidden="true" />
    ))}
    <BadgeReindeer />
    <span class={styles.text}>
      <strong class={styles.title}>{label}</strong>
      <small class={styles.hint}>{hint}</small>
    </span>
  </SettingsControl>
);
