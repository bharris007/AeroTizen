export const SILHOUETTE = "#0a0f1e";

export const Reindeer = ({ x, y }: { x: number; y: number }) => (
  <g transform={"translate(" + x + " " + (y + 26) + ")"}>
    <ellipse cx="40" cy="32" rx="24" ry="9" />
    <path d="M56 27 L65 12 L72 15 L64 33 Z" />
    <ellipse cx="72" cy="14" rx="8" ry="5" transform="rotate(-15 72 14)" />
    <ellipse cx="79" cy="17" rx="5" ry="3" />
    <path
      d="M70 10 L64 0 M66 4 L60 2 M73 9 L77 -1 M75 4 L82 2 M58 36 L71 44 L79 42 M54 38 L65 48 L72 49 M24 36 L12 44 L4 42 M28 38 L18 48 L10 51 M17 28 L11 25"
      stroke={SILHOUETTE}
      stroke-width="3.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
);
