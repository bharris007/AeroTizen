// Relay that pairs a phone with this TV and proxies calendar feeds the TV cannot fetch
// directly. It keeps calendar addresses only until the TV collects them.
export const CALENDAR_RELAY_URL = "https://aerotizen-cal.vercel.app";
export const CALENDAR_RELAY_HOST = "aerotizen-cal.vercel.app";

const SECRET_BYTES = 16;

export const relaySessionUrl = (base: string) => base + "/api/session";
export const relayClaimUrl = (base: string, code: string) => base + "/api/session/" + code + "/claim";
export const relayProxyUrl = (base: string) => base + "/api/ics";
export const relayPairingUrl = (base: string, code: string) => base + "/c/" + code;

// "K7P29QXM" is easier to read from across the room as "K7P2-9QXM".
export const formatPairingCode = (code: string) => (code.length === 8 ? code.slice(0, 4) + "-" + code.slice(4) : code);

export type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => void;

export const createPairingSecret = (fillRandom: FillRandom) => {
  const bytes = new Uint8Array(SECRET_BYTES);
  fillRandom(bytes);
  let secret = "";
  bytes.forEach((byte) => {
    secret += (byte < 16 ? "0" : "") + byte.toString(16);
  });
  return secret;
};

export const validPairingSecret = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{32}$/.test(value);

interface SessionReply {
  readonly code: string;
  readonly expiresAt: number;
}

export const parseSessionReply = (text: string): SessionReply | null => {
  try {
    const data = JSON.parse(text) as Partial<SessionReply>;
    return typeof data.code === "string" && /^[0-9A-Z]{8}$/.test(data.code) && typeof data.expiresAt === "number"
      ? { code: data.code, expiresAt: data.expiresAt }
      : null;
  } catch {
    return null;
  }
};

export const parseClaimReply = (text: string): readonly Record<string, unknown>[] | null => {
  try {
    const data = JSON.parse(text) as { calendars?: unknown };
    return Array.isArray(data.calendars)
      ? data.calendars.filter(
          (item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item),
        )
      : null;
  } catch {
    return null;
  }
};
