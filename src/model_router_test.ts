import { EndpointManager } from "./endpoint_manager.ts";
import { Logger } from "./logger.ts";
import { ModelRouter } from "./model_router.ts";
import { handleAdminRoutes } from "./admin/routes.ts";
import { loadConfig, saveConfig } from "./config.ts";

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
    router.configPath = "";
    return router as ModelRouter;
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
