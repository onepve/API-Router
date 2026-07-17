import { EndpointManager } from "./endpoint_manager.ts";
import { Logger } from "./logger.ts";
import { ModelRouter } from "./model_router.ts";
import { handleAdminRoutes } from "./admin/routes.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { RequestLogStore } from "./request_log_store.ts";

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

function createBareRouter(): ModelRouter {
    const router = Object.create(ModelRouter.prototype) as any;
    router.modelConfigs = [];
    router.defaultConfig = null;
    router.defaultWasUserDefined = false;
    router.poolCache = new Map();
    router.onReloadCallbacks = [];
    router.maxRedirectDepth = 5;
    router.authKeys = [];
    router.globalHeaderPolicy = undefined;
    router.logger = new Logger("error");
    router.tokenStore = { record() {} };
    router.requestLogStore = new RequestLogStore(500);
    router.configPath = "";
    return router as ModelRouter;
}

async function configureRouter(router: ModelRouter, models: any[]): Promise<void> {
    await (router as any).reload(models, undefined, { models });
}

function jsonRequest(url: string, body: unknown, authorization = "Bearer router-secret"): Request {
    return new Request(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "authorization": authorization,
        },
        body: JSON.stringify(body),
    });
}

Deno.test("reload applies top-level authentication and header settings", async () => {
    const router = createBareRouter() as any;
    router.authKeys = ["old-key"];
    router.globalHeaderPolicy = { set: { "x-old": "1" } };

    const rawConfig = {
        models: [{ name: "demo", endpoints: [] }],
        auth_key: ["new-key"],
        headers: { set: { "x-new": "1" } },
    };
    await router.reload(rawConfig.models, undefined, rawConfig);

    assert(router.isAuthenticated(new Request("http://local/v1/models", {
        headers: { authorization: "Bearer new-key" },
    })), "new auth key should be active after reload");
    assertEquals(router.globalHeaderPolicy, rawConfig.headers);
});

Deno.test("Anthropic forwarding does not leak the router authorization token", async () => {
    const router = createBareRouter() as any;
    const endpoint = new EndpointManager(["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"));
    const req = jsonRequest("http://local/v1/messages", { model: "demo" });
    let forwardedHeaders: Headers | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
        forwardedHeaders = new Headers(init?.headers);
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
        }));
    }) as typeof fetch;

    try {
        await router.forwardRequest(
            req,
            new TextEncoder().encode(await req.clone().text()),
            "https://api.anthropic.com/v1",
            endpoint,
            { name: "demo", default_max_retries: 1 },
            "demo",
            false,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert(forwardedHeaders, "request should be forwarded");
    assertEquals(forwardedHeaders.get("authorization"), null);
    assertEquals(forwardedHeaders.get("x-api-key"), "upstream-key");
});

Deno.test("endpoint max_retries overrides the model default", async () => {
    const router = createBareRouter() as any;
    const endpoint = new (EndpointManager as any)(
        ["upstream-key-1", "upstream-key-2", "upstream-key-3"],
        1, 60_000, 3_600_000, new Logger("error"),
        { maxRetries: 0 },
    ) as EndpointManager;
    const req = jsonRequest("http://local/v1/chat/completions", { model: "demo" });
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
        calls++;
        return Promise.resolve(new Response("failed", { status: 500 }));
    }) as typeof fetch;

    try {
        await router.forwardRequest(
            req,
            new TextEncoder().encode(await req.clone().text()),
            "https://upstream.example/v1",
            endpoint,
            { name: "demo", default_max_retries: 3 },
            "demo",
            false,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assertEquals(calls, 1, "max_retries=0 should make one initial attempt without retries");
});

Deno.test("endpoint timeout overrides the model default", async () => {
    const router = createBareRouter() as any;
    const endpoint = new (EndpointManager as any)(
        ["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"),
        { timeout: 0.01, maxRetries: 0 },
    ) as EndpointManager;
    const req = jsonRequest("http://local/v1/chat/completions", { model: "demo" });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
    }) as typeof fetch;

    const started = Date.now();
    try {
        await router.forwardRequest(
            req,
            new TextEncoder().encode(await req.clone().text()),
            "https://upstream.example/v1",
            endpoint,
            { name: "demo", default_timeout: 1, default_max_retries: 1 },
            "demo",
            false,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert(Date.now() - started < 500, "endpoint timeout should abort before the model timeout");
});

Deno.test("non-stream Responses usage is recorded from response.usage", async () => {
    const router = createBareRouter() as any;
    const records: unknown[][] = [];
    router.tokenStore = { record: (...args: unknown[]) => records.push(args) };
    const endpoint = new EndpointManager(["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"));
    const req = jsonRequest("http://local/v1/responses", { model: "demo" });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
        response: { usage: { input_tokens: 4, output_tokens: 6, total_tokens: 10 } },
    }), { headers: { "content-type": "application/json" } }))) as typeof fetch;

    try {
        await router.forwardRequest(
            req,
            new TextEncoder().encode(await req.clone().text()),
            "https://upstream.example/v1",
            endpoint,
            { name: "demo", default_max_retries: 1 },
            "demo",
            false,
        );
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
        globalThis.fetch = originalFetch;
    }

    assertEquals(records.length, 1);
    assertEquals(records[0][1], 10);
});

Deno.test("streaming Responses usage is recorded from response.usage", async () => {
    const router = createBareRouter() as any;
    const records: unknown[][] = [];
    router.tokenStore = { record: (...args: unknown[]) => records.push(args) };
    const endpoint = new EndpointManager(["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"));
    const payload = JSON.stringify({
        type: "response.completed",
        response: { usage: { input_tokens: 3, output_tokens: 7, total_tokens: 10 } },
    });
    const response = new Response(`data: ${payload}`, {
        headers: { "content-type": "text/event-stream" },
    });

    const wrapped = router.wrapStreamResponse(response, "demo", "upstream-key", endpoint);
    await wrapped.text();

    assertEquals(records.length, 1);
    assertEquals(records[0][1], 10);
});

Deno.test("stream failures mark the endpoint key as failed", async () => {
    const router = createBareRouter() as any;
    let successes = 0;
    let failures = 0;
    const endpoint = {
        markSuccess: () => { successes++; },
        markFailure: () => { failures++; },
    };
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode("data: {}\n"));
            controller.error(new Error("upstream disconnected"));
        },
    });

    const wrapped = router.wrapStreamResponse(
        new Response(body, { headers: { "content-type": "text/event-stream" } }),
        "demo",
        "upstream-key",
        endpoint,
    );
    try {
        await wrapped.arrayBuffer();
    } catch (_) {
        // Expected: the upstream stream failed.
    }
    await new Promise(resolve => setTimeout(resolve, 0));

    assertEquals(successes, 0);
    assertEquals(failures, 1);
});

Deno.test("401 removal persists keys referenced through endpoint_pool", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter() as any;
    router.configPath = configPath;
    await saveConfig(configPath, {
        endpoint_pool: {
            shared: { base_url: "https://upstream.example/v1", keys: ["bad-key", "good-key"] },
        },
        models: [{ name: "demo", endpoint_refs: ["shared"] }],
    });

    try {
        await router.removeKeyFromConfig("demo", "https://upstream.example/v1", "bad-key");
        const config = await loadConfig(configPath);
        assertEquals(config.endpoint_pool?.shared.keys, ["good-key"]);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("oversized request bodies return 413", async () => {
    const router = createBareRouter() as any;
    router.maxRequestBodyBytes = 8;
    const req = jsonRequest("http://local/v1/chat/completions", { model: "demo" });

    const response = await router.processRequest(req, new Set());

    assertEquals(response.status, 413);
});

Deno.test("admin config rejects invalid YAML without replacing the file", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    const originalConfig = { models: [{ name: "demo", endpoints: [] }] };
    await saveConfig(configPath, originalConfig);

    try {
        const response = await handleAdminRoutes(new Request("http://local/admin/config", {
            method: "POST",
            body: "models: [",
        }), router, configPath);
        assertEquals(response?.status, 400);
        assertEquals(await loadConfig(configPath), originalConfig);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("admin config rejects invalid endpoint fields without replacing the file", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    const originalConfig = { models: [{ name: "demo", endpoints: [] }] };
    await saveConfig(configPath, originalConfig);

    try {
        const response = await handleAdminRoutes(new Request("http://local/admin/config", {
            method: "POST",
            headers: { "content-type": "text/yaml" },
            body: [
                "models:",
                "  - name: demo",
                "    endpoints:",
                "      - base_url: https://upstream.example/v1",
                "        keys: invalid",
            ].join("\n"),
        }), router, configPath);
        assertEquals(response?.status, 400);
        assertEquals(await loadConfig(configPath), originalConfig);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("endpoint CRUD validates before saving", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    const originalConfig = { models: [{ name: "demo", endpoints: [] }] };
    await saveConfig(configPath, originalConfig);

    try {
        const response = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo/endpoints",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    base_url: "https://upstream.example/v1",
                    keys: "invalid",
                }),
            },
        ), router, configPath);
        assertEquals(response?.status, 400);
        assertEquals(await loadConfig(configPath), originalConfig);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("endpoint pool CRUD supports create update and referenced delete protection", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    await saveConfig(configPath, { models: [{ name: "demo", endpoints: [] }] });

    try {
        const createResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/endpoint-pool",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "shared",
                    base_url: "https://upstream-a.example/v1",
                    keys: ["key-1"],
                    weight: 2,
                    timeout: 30,
                    max_retries: 1,
                }),
            },
        ), router, configPath);
        assertEquals(createResponse?.status, 201);

        const attachResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ endpoint_refs: ["shared"] }),
            },
        ), router, configPath);
        assertEquals(attachResponse?.status, 200);

        const updateResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/endpoint-pool/shared",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    base_url: "https://upstream-b.example/v1",
                    weight: 3,
                    timeout: 45,
                    max_retries: 2,
                }),
            },
        ), router, configPath);
        assertEquals(updateResponse?.status, 200);

        const listResponse = await handleAdminRoutes(
            new Request("http://local/admin/api/endpoint-pool"),
            router,
            configPath,
        );
        const pools = await listResponse?.json();
        assertEquals(pools[0].name, "shared");
        assertEquals(pools[0].base_url, "https://upstream-b.example/v1");
        assertEquals(pools[0].timeout, 45);
        assertEquals(pools[0].max_retries, 2);
        assertEquals(pools[0].referenced_by, ["demo"]);

        const modelListResponse = await handleAdminRoutes(
            new Request("http://local/admin/api/models"),
            router,
            configPath,
        );
        const modelList = await modelListResponse?.json();
        assertEquals(modelList[0].direct_key_count, 0);
        assertEquals(modelList[0].key_count, 1);

        const protectedDelete = await handleAdminRoutes(new Request(
            "http://local/admin/api/endpoint-pool/shared",
            { method: "DELETE" },
        ), router, configPath);
        assertEquals(protectedDelete?.status, 409);

        await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ endpoint_refs: null }),
            },
        ), router, configPath);
        const deleteResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/endpoint-pool/shared",
            { method: "DELETE" },
        ), router, configPath);
        assertEquals(deleteResponse?.status, 204);
        assertEquals((await loadConfig(configPath)).endpoint_pool, {});
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("model CRUD preserves pool references and can clear optional routing fields", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    await saveConfig(configPath, {
        endpoint_pool: {
            shared: { base_url: "https://upstream.example/v1", keys: [] },
        },
        models: [{ name: "base", endpoints: [] }],
    });

    try {
        const createResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/models",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "demo",
                    endpoint_refs: ["shared"],
                    type: ["chat"],
                    redirects: [{ pre: "demo-*", to: "base", weight: 1 }],
                    headers: { set: { "x-router": "demo" } },
                }),
            },
        ), router, configPath);
        assertEquals(createResponse?.status, 201);
        let config = await loadConfig(configPath);
        let model = config.models.find(m => m.name === "demo");
        assertEquals(model?.endpoint_refs, ["shared"]);
        assertEquals(model?.headers, { set: { "x-router": "demo" } });

        const clearResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    endpoint_refs: null,
                    type: null,
                    redirects: null,
                    headers: null,
                }),
            },
        ), router, configPath);
        assertEquals(clearResponse?.status, 200);
        config = await loadConfig(configPath);
        model = config.models.find(m => m.name === "demo");
        assertEquals(model?.endpoint_refs, undefined);
        assertEquals(model?.type, undefined);
        assertEquals(model?.redirects, undefined);
        assertEquals(model?.headers, undefined);

        const invalidRef = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ endpoint_refs: ["missing"] }),
            },
        ), router, configPath);
        assertEquals(invalidRef?.status, 400);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("endpoint update rejects zero weight without replacing the endpoint", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    const originalConfig = {
        models: [{
            name: "demo",
            endpoints: [{ base_url: "https://upstream.example/v1", keys: [], weight: 2 }],
        }],
    };
    await saveConfig(configPath, originalConfig);

    try {
        const response = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/demo/endpoints/0",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ base_url: "https://upstream.example/v1", weight: 0 }),
            },
        ), router, configPath);
        assertEquals(response?.status, 400);
        assertEquals(await loadConfig(configPath), originalConfig);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("model deletion rejects redirect references and invalid headers", async () => {
    const dir = await Deno.makeTempDir();
    const configPath = `${dir}/config.yaml`;
    const router = createBareRouter();
    const originalConfig = {
        models: [
            { name: "target", endpoints: [] },
            { name: "alias", endpoints: [], redirects: [{ pre: "*", to: "target" }] },
        ],
    };
    await saveConfig(configPath, originalConfig);

    try {
        const deleteResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/target",
            { method: "DELETE" },
        ), router, configPath);
        assertEquals(deleteResponse?.status, 409);

        const headersResponse = await handleAdminRoutes(new Request(
            "http://local/admin/api/models/target",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ headers: { delete: "x-invalid" } }),
            },
        ), router, configPath);
        assertEquals(headersResponse?.status, 400);
        assertEquals(await loadConfig(configPath), originalConfig);
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("request log records one successful final outcome", async () => {
    const router = createBareRouter() as any;
    await configureRouter(router, [{
        name: "demo",
        endpoints: [{ base_url: "https://upstream.example/v1", keys: ["key-1"] }],
    }]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }), { headers: { "content-type": "application/json" } }))) as typeof fetch;

    try {
        const response = await router.handleRequest(jsonRequest(
            "http://local/v1/chat/completions",
            { model: "demo" },
            "Bearer unused",
        ));
        await response.text();
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
        globalThis.fetch = originalFetch;
    }

    const records = router.requestLogStore.query({ limit: 10 }).records;
    assertEquals(records.length, 1);
    assertEquals(records[0].status, 200);
    assertEquals(records[0].originalModel, "demo");
    assertEquals(records[0].resolvedModel, "demo");
    assertEquals(records[0].totalTokens, 5);
});

Deno.test("request log records retry count once after retry success", async () => {
    const router = createBareRouter() as any;
    await configureRouter(router, [{
        name: "demo",
        default_max_retries: 3,
        endpoints: [{
            base_url: "https://upstream.example/v1",
            keys: ["key-1", "key-2", "key-3"],
        }],
    }]);
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
        calls++;
        if (calls < 3) return Promise.resolve(new Response("failed", { status: 500 }));
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
        }));
    }) as typeof fetch;

    try {
        const response = await router.handleRequest(jsonRequest(
            "http://local/v1/chat/completions",
            { model: "demo" },
            "Bearer unused",
        ));
        await response.text();
    } finally {
        globalThis.fetch = originalFetch;
    }

    const records = router.requestLogStore.query({ limit: 10 }).records;
    assertEquals(calls, 3);
    assertEquals(records.length, 1);
    assertEquals(records[0].retryCount, 2);
    assertEquals(records[0].status, 200);
});

Deno.test("request log preserves original and resolved redirect models", async () => {
    const router = createBareRouter() as any;
    await configureRouter(router, [
        { name: "alias", endpoints: [], redirects: [{ pre: "*", to: "target" }] },
        {
            name: "target",
            endpoints: [{ base_url: "https://upstream.example/v1", keys: ["key-1"] }],
        },
    ]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
    }))) as typeof fetch;

    try {
        const response = await router.handleRequest(jsonRequest(
            "http://local/v1/chat/completions",
            { model: "alias" },
            "Bearer unused",
        ));
        await response.text();
    } finally {
        globalThis.fetch = originalFetch;
    }

    const record = router.requestLogStore.query({ limit: 10 }).records[0];
    assertEquals(record.originalModel, "alias");
    assertEquals(record.resolvedModel, "target");
});

Deno.test("redirect-only models do not create or count placeholder endpoints", async () => {
    const router = createBareRouter();
    await configureRouter(router, [
        { name: "alias", endpoints: [], redirects: [{ pre: "*", to: "target" }] },
        {
            name: "target",
            endpoints: [{ base_url: "https://upstream.example/v1", keys: ["key-1"] }],
        },
    ]);

    const status = await router.getFullStatus();

    assertEquals(status["[0] alias (exact)"].length, 0);
    assertEquals(status._summary.endpoints, 1);
    assertEquals(status._summary.available_endpoints, 1);
});

Deno.test("request log waits for stream completion", async () => {
    const router = createBareRouter() as any;
    await configureRouter(router, [{
        name: "demo",
        endpoints: [{ base_url: "https://upstream.example/v1", keys: ["key-1"] }],
    }]);
    const payload = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(payload, {
        headers: { "content-type": "text/event-stream" },
    }))) as typeof fetch;

    try {
        const response = await router.handleRequest(jsonRequest(
            "http://local/v1/chat/completions",
            { model: "demo", stream: true },
            "Bearer unused",
        ));
        assertEquals(router.requestLogStore.query().records.length, 0);
        await response.text();
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
        globalThis.fetch = originalFetch;
    }

    const records = router.requestLogStore.query().records;
    assertEquals(records.length, 1);
    assertEquals(records[0].status, 200);
    assertEquals(records[0].stream, true);
});

Deno.test("request log marks interrupted streams as failed", async () => {
    const router = createBareRouter() as any;
    await configureRouter(router, [{
        name: "demo",
        endpoints: [{ base_url: "https://upstream.example/v1", keys: ["key-1"] }],
    }]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode("data: {}\n"));
            controller.error(new Error("connection lost"));
        },
    }), { headers: { "content-type": "text/event-stream" } }))) as typeof fetch;

    try {
        const response = await router.handleRequest(jsonRequest(
            "http://local/v1/chat/completions",
            { model: "demo", stream: true },
            "Bearer unused",
        ));
        try {
            await response.text();
        } catch (_) {
            // Expected stream failure.
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
        globalThis.fetch = originalFetch;
    }

    const record = router.requestLogStore.query().records[0];
    assert(record.status >= 500, "interrupted stream should be recorded as a failed request");
    assert(record.error?.includes("connection lost"), "stream error summary should be recorded");
});

Deno.test("stream wrapper preserves tool call SSE bytes exactly", async () => {
    const router = createBareRouter() as any;
    const endpoint = new EndpointManager(["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"));
    const payload = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Hong Kong\\"}"}}]},"finish_reason":"tool_calls"}]}',
        "data: [DONE]",
        "",
    ].join("\n\n");

    const wrapped = router.wrapStreamResponse(
        new Response(payload, { headers: { "content-type": "text/event-stream" } }),
        "demo",
        "upstream-key",
        endpoint,
    );

    assertEquals(await wrapped.text(), payload);
});

Deno.test("request log ignores non API browser asset requests", async () => {
    const router = createBareRouter() as any;

    const response = await router.handleRequest(new Request("http://local/favicon.ico"));

    assertEquals(response.status, 404);
    assertEquals(router.requestLogStore.query().records.length, 0);
});

Deno.test("forwarding preserves an upstream path prefix before v1", async () => {
    const router = createBareRouter() as any;
    const endpoint = new EndpointManager(["upstream-key"], 1, 60_000, 3_600_000, new Logger("error"));
    const req = jsonRequest("http://local/v1/chat/completions", { model: "demo" });
    let forwardedUrl = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL) => {
        forwardedUrl = String(input);
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
        }));
    }) as typeof fetch;

    try {
        await router.forwardRequest(
            req,
            new TextEncoder().encode(await req.clone().text()),
            "https://opencode.ai/zen/v1",
            endpoint,
            { name: "demo", default_max_retries: 1 },
            "demo",
            false,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    assertEquals(forwardedUrl, "https://opencode.ai/zen/v1/chat/completions");
});
