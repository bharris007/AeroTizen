// Samsung Tizen TVs deliver MediaPlay / MediaPause / MediaPlayPause only after registering them.
const RADAR_MEDIA_KEYS = ["MediaPlay", "MediaPause", "MediaPlayPause"] as const;

interface TvInputDevice {
  registerKey?(name: string): void;
  unregisterKey?(name: string): void;
}

interface TizenMediaHost {
  tizen?: {
    tvinputdevice?: TvInputDevice;
  } | null;
}

let activeHolders = 0;

const callDeviceKey = (device: TvInputDevice | undefined, action: "registerKey" | "unregisterKey") => {
  const fn = device?.[action];
  if (typeof fn !== "function") {
    return;
  }
  RADAR_MEDIA_KEYS.forEach((key) => {
    try {
      fn.call(device, key);
    } catch {
      // Unsupported remote keys on older TV firmware must not break playback.
    }
  });
};

// Ref-counted registration so mounted radar views receive hardware Play/Pause keys cleanly.
export const acquireRadarMediaKeys = (host: TizenMediaHost = window as unknown as TizenMediaHost) => {
  const device = host.tizen?.tvinputdevice;
  activeHolders += 1;
  if (activeHolders === 1) {
    callDeviceKey(device, "registerKey");
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activeHolders = Math.max(0, activeHolders - 1);
    if (activeHolders === 0) {
      callDeviceKey(device, "unregisterKey");
    }
  };
};
