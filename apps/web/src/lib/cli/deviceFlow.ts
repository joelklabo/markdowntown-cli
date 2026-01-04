import { createHash, randomBytes } from "crypto";

export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const USER_CODE_LENGTH = 8;
const DEVICE_CODE_BYTES = 32;

export type DeviceCodePayload = {
  deviceCode: string;
  userCode: string;
  deviceCodeHash: string;
  userCodeHash: string;
  expiresAt: Date;
  intervalSeconds: number;
};

export function normalizeUserCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateUserCode(): string {
  const bytes = randomBytes(USER_CODE_LENGTH);
  let raw = "";
  for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
    raw += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function generateDeviceCode(): string {
  return randomBytes(DEVICE_CODE_BYTES).toString("base64url");
}

export function createDeviceCodePayload(): DeviceCodePayload {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);
  return {
    deviceCode,
    userCode,
    deviceCodeHash: hashCode(deviceCode),
    userCodeHash: hashCode(normalizeUserCode(userCode)),
    expiresAt,
    intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
  };
}
