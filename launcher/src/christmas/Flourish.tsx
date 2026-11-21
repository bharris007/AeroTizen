// A hairline ornament with a small four-point star, used between display lines.
export const Flourish = ({ class: className }: { class: string }) => (
  <svg class={className} viewBox="0 0 420 24" aria-hidden="true">
    <defs>
      <linearGradient id="christmas-flourish-left" x1="0" x2="1">
        <stop offset="0" stop-color="#e9cf98" stop-opacity="0" />
        <stop offset="1" stop-color="#e9cf98" />
      </linearGradient>
      <linearGradient id="christmas-flourish-right" x1="0" x2="1">
        <stop offset="0" stop-color="#e9cf98" />
        <stop offset="1" stop-color="#e9cf98" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect x="0" y="11.25" width="180" height="1.5" fill="url(#christmas-flourish-left)" />
    <rect x="240" y="11.25" width="180" height="1.5" fill="url(#christmas-flourish-right)" />
    <path d="M210 0 L213 9 L222 12 L213 15 L210 24 L207 15 L198 12 L207 9 Z" fill="#f3d9a4" />
    <circle cx="190" cy="12" r="2" fill="#e9cf98" />
    <circle cx="230" cy="12" r="2" fill="#e9cf98" />
  </svg>
);
