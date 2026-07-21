import { Logger } from "./logger.ts";
import { TokenStore } from "./token_store.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

Deno.test("token statistic buckets use UTC+8 dates and hours", () => {
  const store = new TokenStore("unused.json", new Logger("error")) as any;
  const originalNow = Date.now;
  const now = Date.UTC(2026, 6, 18, 16, 30); // UTC+8: 2026-07-19 00:30
  Date.now = () => now;
  store.records = [
    {
      model: "demo",
      timestamp: Date.UTC(2026, 6, 18, 15, 30),
      totalTokens: 10,
    },
    {
      model: "demo",
      timestamp: Date.UTC(2026, 6, 18, 16, 10),
      totalTokens: 20,
    },
  ];

  try {
    assertEquals(store.queryHourly("demo", 2), [
      { date: "2026-07-18T23:00", totalTokens: 10, requestCount: 1 },
      { date: "2026-07-19T00:00", totalTokens: 20, requestCount: 1 },
    ]);
    assertEquals(store.queryDaily("demo", 2), [
      { date: "2026-07-18", totalTokens: 10, requestCount: 1 },
      { date: "2026-07-19", totalTokens: 20, requestCount: 1 },
    ]);
    assertEquals(store.queryDaily("demo", 1), [
      { date: "2026-07-19", totalTokens: 20, requestCount: 1 },
    ]);
  } finally {
    Date.now = originalNow;
  }
});
