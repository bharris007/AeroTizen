// Wrapped presents at the foot of the tree, in the tree's 560 x 820 drawing space.
const GIFTS = [
  { key: "velvet", x: 96, width: 132, height: 96, face: "#8a1a2c", top: "#a8283d", ribbon: "#e2bd6b" },
  { key: "cream", x: 214, width: 96, height: 70, face: "#e6d8b8", top: "#f4ead2", ribbon: "#9b2233" },
  { key: "pine", x: 300, width: 150, height: 112, face: "#17402c", top: "#225a3d", ribbon: "#e2bd6b" },
  { key: "gold", x: 438, width: 78, height: 58, face: "#b88a3c", top: "#d6ab5c", ribbon: "#f4ead2" },
] as const;

const FLOOR_Y = 812;
const LID_PX = 14;

export const Gifts = () => (
  <g>
    <ellipse cx="300" cy={FLOOR_Y} rx="250" ry="14" fill="#000" opacity="0.4" />
    {GIFTS.map((gift) => {
      const top = FLOOR_Y - gift.height;
      const middle = gift.x + gift.width / 2;
      return (
        <g key={gift.key}>
          <rect x={gift.x} y={top} width={gift.width} height={gift.height} fill={gift.face} />
          <rect x={gift.x - 4} y={top - LID_PX + 4} width={gift.width + 8} height={LID_PX} fill={gift.top} />
          <rect x={gift.x} y={top + 4} width={gift.width} height={gift.height * 0.18} fill="#000" opacity="0.18" />
          <rect x={middle - 6} y={top - LID_PX + 4} width="12" height={gift.height + LID_PX - 4} fill={gift.ribbon} />
          <path
            d={`M${middle} ${top - 8} q-30 -26 -34 -4 q4 14 34 4 q30 10 34 -4 q-4 -22 -34 4 Z`}
            fill={gift.ribbon}
          />
          <rect x={gift.x} y={top} width={gift.width * 0.12} height={gift.height} fill="#fff" opacity="0.07" />
        </g>
      );
    })}
  </g>
);
