export const Reindeer = ({ x, nose }: { x: number; nose: string }) => (
  <g transform={"translate(" + x + " 40)"}>
    <circle cx="28" cy="55" r="7" fill="#f3e5d0" />
    <path d="M45 74 L24 92 M53 78 L36 102" stroke="#5e3a1b" stroke-width="7" stroke-linecap="round" />
    <path d="M95 74 L117 94 M87 78 L101 102" stroke="#5e3a1b" stroke-width="7" stroke-linecap="round" />
    <ellipse cx="70" cy="62" rx="42" ry="20" fill="#9a6232" />
    <ellipse cx="72" cy="71" rx="30" ry="8" fill="#d2a679" opacity="0.7" />
    <path d="M96 50 L112 22 L125 27 L112 60 Z" fill="#9a6232" />
    <path d="M96 45 Q105 62 96 79" stroke="#d6262c" stroke-width="7" fill="none" />
    <circle cx="103" cy="70" r="5" fill="#ffd34d" />
    <ellipse cx="126" cy="24" rx="14" ry="10" fill="#a86d38" />
    <ellipse cx="138" cy="28" rx="9" ry="6.5" fill="#b97b44" />
    <path
      d="M120 15 L113 -1 M116 7 L106 4 M129 14 L134 -3 M132 6 L141 2"
      stroke="#e8c48f"
      stroke-width="4"
      stroke-linecap="round"
    />
    <ellipse cx="115" cy="17" rx="7" ry="3" fill="#7a4a22" transform="rotate(-30 115 17)" />
    <circle cx="127" cy="20" r="2.4" fill="#1a0e05" />
    <circle cx="146" cy="27" r="9" fill={nose} opacity="0.35" />
    <circle cx="146" cy="27" r="5" fill={nose} />
  </g>
);
