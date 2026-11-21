import { useMemo } from "preact/hooks";
import qrcode from "qrcode-generator";

import styles from "./PairingQr.module.css";

// Quiet zone around the code, in modules, as the QR specification requires.
const QUIET_ZONE_MODULES = 2;

// Builds one SVG path of the dark modules. Uppercase URLs use QR alphanumeric mode, which
// keeps the code small enough to scan from the sofa.
export const qrPath = (value: string) => {
  const code = qrcode(0, "M");
  code.addData(value, /^[0-9A-Z $%*+\-./:]+$/.test(value) ? "Alphanumeric" : "Byte");
  code.make();
  const count = code.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (code.isDark(row, column)) {
        path += "M" + (column + QUIET_ZONE_MODULES) + " " + (row + QUIET_ZONE_MODULES) + "h1v1h-1z";
      }
    }
  }
  return { path, size: count + QUIET_ZONE_MODULES * 2 };
};

export const PairingQr = ({ label, value }: { label: string; value: string }) => {
  const { path, size } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      class={styles.code}
      viewBox={"0 0 " + size + " " + size}
      role="img"
      aria-label={label}
      shape-rendering="crispEdges"
      data-calendar-qr={value}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
};
