import styles from "./NorthPoleScene.module.css";

const GIFTS = [
  { key: "g1", x: 0, y: 70, w: 120, h: 90, box: "#e03131", ribbon: "#ffd43b" },
  { key: "g2", x: 110, y: 40, w: 100, h: 120, box: "#1c7ed6", ribbon: "#f8f9fa" },
  { key: "g3", x: 390, y: 60, w: 130, h: 100, box: "#2b8a3e", ribbon: "#e03131" },
  { key: "g4", x: 510, y: 90, w: 90, h: 70, box: "#ae3ec9", ribbon: "#ffd43b" },
] as const;

export const Gifts = () => (
  <svg class={styles.gifts} viewBox="0 0 600 170" aria-hidden="true">
    {GIFTS.map((gift) => {
      const middle = gift.x + gift.w / 2;
      return (
        <g key={gift.key}>
          <rect x={gift.x} y={gift.y} width={gift.w} height={gift.h} rx="6" fill={gift.box} />
          <rect x={middle - 8} y={gift.y} width="16" height={gift.h} fill={gift.ribbon} />
          <rect x={gift.x} y={gift.y + gift.h / 2 - 8} width={gift.w} height="16" fill={gift.ribbon} />
          <path
            d={"M" + middle + " " + gift.y + " q-34 -30 -30 2 z M" + middle + " " + gift.y + " q34 -30 30 2 z"}
            fill={gift.ribbon}
          />
        </g>
      );
    })}
  </svg>
);
