import { buildModelProbes, parseToolCallStream } from "./verify_models.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(message || `Expected ${expectedJson}, got ${actualJson}`);
    }
}

Deno.test("model verifier builds chat responses and image probes", () => {
    const probes = buildModelProbes({
        models: [
            { name: "chat-model", type: ["chat"], endpoints: [{ base_url: "x", keys: [] }] },
            { name: "response-model", type: ["response"], endpoints: [{ base_url: "x", keys: [] }] },
            { name: "image-model", type: ["images"], endpoints: [{ base_url: "x", keys: [] }] },
        ],
    });

    assertEquals(probes.map(probe => ({ model: probe.model, path: probe.path, kind: probe.kind })), [
        { model: "chat-model", path: "/v1/chat/completions", kind: "chat" },
        { model: "response-model", path: "/v1/responses", kind: "response" },
        { model: "image-model", path: "/v1/images/generations", kind: "image" },
    ]);
    assertEquals(probes[2].body.size, "2048x2048");
});

Deno.test("model verifier calls redirect aliases and skips unresolved regex patterns", () => {
    const probes = buildModelProbes({
        models: [
            { name: "alias", endpoints: [], redirects: [{ pre: "*", to: "target" }] },
            { name: "^gpt-5\\..*$", endpoint_refs: ["pool"], type: ["response"] },
        ],
    });

    assertEquals(probes.map(probe => ({ model: probe.model, kind: probe.kind, skipReason: probe.skipReason })), [
        { model: "alias", kind: "alias", skipReason: undefined },
        { model: "^gpt-5\\..*$", kind: "response", skipReason: "pattern requires a concrete model id" },
    ]);
});

Deno.test("tool call parser reconstructs fragmented streaming arguments", () => {
    const sse = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Hong Kong\\"}"}}]},"finish_reason":"tool_calls"}]}',
        "data: [DONE]",
        "",
    ].join("\n\n");

    const parsed = parseToolCallStream(sse);

    assertEquals(parsed.eventCount, 2);
    assertEquals(parsed.finishReason, "tool_calls");
    assertEquals(parsed.toolCalls, [{
        id: "call_1",
        name: "get_weather",
        argumentsText: '{"city":"Hong Kong"}',
        arguments: { city: "Hong Kong" },
    }]);
    assertEquals(parsed.errors, []);
});

Deno.test("tool call parser reports malformed SSE JSON separately", () => {
    const parsed = parseToolCallStream("data: {bad json}\n\ndata: [DONE]\n\n");

    assertEquals(parsed.eventCount, 0);
    assertEquals(parsed.errors.length, 1);
    assertEquals(parsed.toolCalls, []);
});
