import {
  formatUtc8Timestamp,
  utc8DateKey,
  utc8HourKey,
  utc8MinuteKey,
  utc8StartOfDay,
} from "./time.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("UTC+8 helpers format timestamps independently of host timezone", () => {
  const timestamp = Date.UTC(2026, 6, 18, 14, 5, 9);
  assertEquals(utc8DateKey(timestamp), "2026-07-18");
  assertEquals(utc8MinuteKey(timestamp), "2026-07-18T22:05");
  assertEquals(utc8HourKey(timestamp), "2026-07-18T22:00");
  assertEquals(formatUtc8Timestamp(timestamp), "2026-07-18 22:05:09");
  assertEquals(utc8StartOfDay(timestamp), Date.UTC(2026, 6, 17, 16));
});
