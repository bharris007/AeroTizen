const LEAF_PATH =
  "M0 0 C6 -6 12 -4 16 -10 C18 -4 24 -4 28 -10 C30 -4 36 -2 42 -6 C38 2 40 8 34 12 C28 8 22 12 18 8 C14 12 8 10 4 6 C2 4 0 2 0 0 Z";

// Gold hairlines meeting at a holly sprig, used between display lines.
export const Flourish = ({ class: className }: { class: string }) => (
  <svg class={className} viewBox="0 0 420 44" aria-hidden="true">
    <defs>
      <linearGradient id="christmas-flourish-left" x1="0" x2="1">
        <stop offset="0" stop-color="#e9cf98" stop-opacity="0" />
        <stop offset="1" stop-color="#e9cf98" />
      </linearGradient>
      <linearGradient id="christmas-flourish-right" x1="0" x2="1">
        <stop offset="0" stop-color="#e9cf98" />
        <stop offset="1" stop-color="#e9cf98" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="christmas-holly-leaf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#3f8a5a" />
        <stop offset="1" stop-color="#174a30" />
      </linearGradient>
      <radialGradient id="christmas-holly-berry" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stop-color="#ff8a8a" />
        <stop offset="0.45" stop-color="#c8202f" />
        <stop offset="1" stop-color="#5c0812" />
      </radialGradient>
    </defs>
    <rect x="0" y="21.25" width="156" height="1.5" fill="url(#christmas-flourish-left)" />
    <rect x="264" y="21.25" width="156" height="1.5" fill="url(#christmas-flourish-right)" />
    <path d={LEAF_PATH} fill="url(#christmas-holly-leaf)" transform="translate(208 24) rotate(200) scale(1.15)" />
    <path d={LEAF_PATH} fill="url(#christmas-holly-leaf)" transform="translate(212 24) rotate(-20) scale(1.15)" />
    <path d="M168 22 Q190 18 200 24 M252 22 Q230 18 220 24" stroke="#e9cf98" stroke-width="1" fill="none" />
    <circle cx="203" cy="25" r="6" fill="url(#christmas-holly-berry)" />
    <circle cx="216" cy="25" r="6" fill="url(#christmas-holly-berry)" />
    <circle cx="210" cy="16" r="6" fill="url(#christmas-holly-berry)" />
  </svg>
);
