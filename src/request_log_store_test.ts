import { RequestLogStore } from "./request_log_store.ts";
import type { RequestLogInput } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(message || `Expected ${expectedJson}, got ${actualJson}`);
    }
}

function sample(overrides: Partial<RequestLogInput> = {}): RequestLogInput {
    return {
        timestamp: 1_700_000_000_000,
        originalModel: "demo",
        resolvedModel: "demo",
        path: "/v1/chat/completions",
        status: 200,
        durationMs: 120,
        firstByteMs: 40,
        totalTokens: 42,
        upstreamBaseUrl: "https://upstream.example/v1",
        stream: false,
        retryCount: 0,
        ...overrides,
    };
}

Deno.test("request log store keeps only the newest records", () => {
    const store = new RequestLogStore(2);
    store.record(sample({ resolvedModel: "a" }));
    store.record(sample({ resolvedModel: "b" }));
    store.record(sample({ resolvedModel: "c" }));

    assertEquals(
        store.query({ limit: 10 }).records.map(record => record.resolvedModel),
        ["b", "c"],
    );
});

Deno.test("request log store returns records after a cursor", () => {
    const store = new RequestLogStore(10);
    const first = store.record(sample({ resolvedModel: "a" }));
    store.record(sample({ resolvedModel: "b" }));

    const result = store.query({ after: first.id });

    assertEquals(result.records.map(record => record.resolvedModel), ["b"]);
    assertEquals(result.latestId, first.id + 1);
});

Deno.test("request log store filters by model status and path", () => {
    const store = new RequestLogStore(10);
    store.record(sample({ originalModel: "alias", resolvedModel: "target", status: 200 }));
    store.record(sample({ resolvedModel: "other", status: 500, path: "/v1/responses" }));

    assertEquals(store.query({ model: "alias" }).records.length, 1);
    assertEquals(store.query({ model: "target" }).records.length, 1);
    assertEquals(store.query({ status: 500 }).records.length, 1);
    assertEquals(store.query({ path: "/v1/responses" }).records.length, 1);
});

Deno.test("request log summary calculates success rate p95 timeline and model totals", () => {
    const store = new RequestLogStore(10);
    const base = 1_700_000_000_000;
    store.record(sample({ timestamp: base, durationMs: 10, firstByteMs: 5, totalTokens: 10, resolvedModel: "a" }));
    store.record(sample({ timestamp: base + 10_000, durationMs: 20, firstByteMs: 15, totalTokens: 20, resolvedModel: "a" }));
    store.record(sample({ timestamp: base + 70_000, durationMs: 100, firstByteMs: 80, totalTokens: 0, resolvedModel: "b", status: 500 }));

    const summary = store.summary(120_000, base + 90_000);

    assertEquals(summary.requestCount, 3);
    assertEquals(summary.errorCount, 1);
    assertEquals(summary.successRate, 66.67);
    assertEquals(summary.p95LatencyMs, 100);
    assertEquals(summary.p95FirstByteMs, 80);
    assertEquals(summary.timeline.length, 2);
    assertEquals(summary.timeline.map(item => item.bucket), ["2023-11-15T06:13", "2023-11-15T06:14"]);
    assertEquals(summary.models, [
        { model: "a", requestCount: 2, totalTokens: 30 },
        { model: "b", requestCount: 1, totalTokens: 0 },
    ]);
});

Deno.test("request log records contain metadata only", () => {
    const store = new RequestLogStore(10);
    const record = store.record(sample({ error: "upstream timeout" }));
    const keys = Object.keys(record);

    for (const forbidden of ["body", "requestBody", "responseBody", "headers", "key", "authorization"]) {
        assert(!keys.includes(forbidden), `record must not expose ${forbidden}`);
    }
});
