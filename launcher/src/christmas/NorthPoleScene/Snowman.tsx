import styles from "./NorthPoleScene.module.css";

export const Snowman = () => (
  <svg class={styles.snowman} viewBox="0 0 260 380" aria-hidden="true">
    <ellipse cx="130" cy="372" rx="110" ry="10" fill="#9fb7e0" opacity="0.5" />
    <path
      d="M70 200 L10 150 M190 200 L250 140 M20 158 L4 140 M240 150 L256 128"
      stroke="#5c3d1e"
      stroke-width="7"
      stroke-linecap="round"
    />
    <circle cx="130" cy="300" r="75" fill="#f8f9fa" />
    <circle cx="130" cy="195" r="56" fill="#f1f3f5" />
    <circle cx="130" cy="110" r="42" fill="#f8f9fa" />
    <path d="M86 140 Q130 160 174 140 L178 156 Q130 176 82 156 Z" fill="#e03131" />
    <path d="M152 152 L170 210 L152 214 L140 160 Z" fill="#c92a2a" />
    <circle cx="130" cy="185" r="6" fill="#343a40" />
    <circle cx="130" cy="210" r="6" fill="#343a40" />
    <circle cx="130" cy="290" r="7" fill="#343a40" />
    <circle cx="116" cy="100" r="5" fill="#212529" />
    <circle cx="144" cy="100" r="5" fill="#212529" />
    <path d="M130 112 L168 120 L130 122 Z" fill="#ff922b" />
    <path d="M112 128 Q130 138 148 128" stroke="#343a40" stroke-width="4" stroke-linecap="round" fill="none" />
    <rect x="84" y="66" width="92" height="10" rx="4" fill="#212529" />
    <rect x="98" y="16" width="64" height="54" rx="4" fill="#212529" />
    <rect x="98" y="54" width="64" height="10" fill="#c92a2a" />
  </svg>
);
