// Fixed UTC+8 helpers used for UI-facing timestamps and statistic buckets.

export const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

function shiftedIso(timestamp: number): string {
  return new Date(timestamp + UTC8_OFFSET_MS).toISOString();
}

export function utc8DateKey(timestamp: number): string {
  return shiftedIso(timestamp).slice(0, 10);
}

export function utc8MinuteKey(timestamp: number): string {
  return shiftedIso(timestamp).slice(0, 16);
}

export function utc8HourKey(timestamp: number): string {
  return shiftedIso(timestamp).slice(0, 13) + ":00";
}

export function utc8StartOfDay(timestamp: number): number {
  const shifted = new Date(timestamp + UTC8_OFFSET_MS);
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) - UTC8_OFFSET_MS;
}

export function formatUtc8Timestamp(timestamp = Date.now()): string {
  return shiftedIso(timestamp).slice(0, 19).replace("T", " ");
}
