// Array.prototype.flatMap and flat need Chromium 69; the TV runtime is Chromium 63.
export const flatMap = <T, U>(items: readonly T[], map: (item: T, index: number) => readonly U[]): U[] =>
  items.reduce<U[]>((all, item, index) => all.concat(map(item, index)), []);
