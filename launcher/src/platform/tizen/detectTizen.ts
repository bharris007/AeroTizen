// True when running inside a Samsung Tizen TV web engine.
export const isTizenTv = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const tizenGlobal = (window as { tizen?: unknown }).tizen;
  if (typeof tizenGlobal !== "undefined") {
    return true;
  }
  return typeof navigator !== "undefined" && /tizen/i.test(navigator.userAgent || "");
};
