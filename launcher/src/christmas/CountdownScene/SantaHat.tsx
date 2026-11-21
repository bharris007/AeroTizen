import motion from "../sceneMotion.module.css";

import styles from "./SantaHat.module.css";

const FUR_TUFTS = [
  { cx: 40, cy: 150, r: 15 },
  { cx: 70, cy: 145, r: 17 },
  { cx: 104, cy: 142, r: 17 },
  { cx: 138, cy: 141, r: 16 },
  { cx: 170, cy: 143, r: 15 },
] as const;

// A velvet Santa hat whose tip flops over into a fur pom-pom. It perches on the
// countdown with a slow tilt; the SVG itself never animates.
export const SantaHat = ({ class: className }: { class: string }) => (
  <span class={styles.perch + " " + className} aria-hidden="true">
    <span class={styles.tilt + " " + motion.ambient}>
      <svg class={styles.art} viewBox="0 0 230 180">
        <defs>
          <linearGradient id="christmas-hat-velvet" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#e2475a" />
            <stop offset="0.45" stop-color="#a8182c" />
            <stop offset="1" stop-color="#560a16" />
          </linearGradient>
          <linearGradient id="christmas-hat-fur" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fffaf0" />
            <stop offset="0.6" stop-color="#efe3cc" />
            <stop offset="1" stop-color="#bfae8e" />
          </linearGradient>
          <radialGradient id="christmas-hat-pompom" cx="0.38" cy="0.35" r="0.7">
            <stop offset="0" stop-color="#ffffff" />
            <stop offset="0.6" stop-color="#efe3cc" />
            <stop offset="1" stop-color="#b8a684" />
          </radialGradient>
        </defs>
        <path
          d="M30 140 C38 92 70 46 122 28 C162 14 198 30 210 66 C214 82 212 98 206 110 C198 92 186 80 168 76 C178 98 184 120 186 140 Z"
          fill="url(#christmas-hat-velvet)"
        />
        <path d="M122 28 C110 64 120 104 138 138 L118 140 C100 108 98 64 122 28 Z" fill="#000" opacity="0.16" />
        <path d="M60 120 C70 84 92 56 120 40" stroke="#ff8c96" stroke-opacity="0.35" stroke-width="5" fill="none" />
        <rect x="18" y="128" width="176" height="36" rx="18" fill="url(#christmas-hat-fur)" />
        {FUR_TUFTS.map((tuft) => (
          <circle key={tuft.cx} cx={tuft.cx} cy={tuft.cy} r={tuft.r} fill="#fff" opacity="0.28" />
        ))}
        <circle cx="206" cy="122" r="21" fill="url(#christmas-hat-pompom)" />
      </svg>
    </span>
  </span>
);
