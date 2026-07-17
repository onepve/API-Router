import { handleAdminRoutes } from "./routes.ts";
import { Logger } from "../logger.ts";
import { ModelRouter } from "../model_router.ts";
import { RequestLogStore } from "../request_log_store.ts";

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
    router.requestLogStore = new RequestLogStore(500);
    router.tokenStore = {
        query: () => ({ totalTokens: 1234, requestCount: 3 }),
        queryModelSummary: () => [{
            model: "demo",
            totalTokens: 1234,
            requestCount: 3,
            inputTokens: 1000,
            outputTokens: 234,
        }],
    };
    router.catalog = {
        calculateCost: () => ({ hasPricing: true, cost: 1.25 }),
        getPricing: () => ({ input: 1, output: 2 }),
    };
    router.configPath = "";
    return router as ModelRouter;
}

function logInput(overrides: Record<string, unknown> = {}) {
    return {
        timestamp: Date.now(),
        originalModel: "demo",
        resolvedModel: "demo",
        path: "/v1/chat/completions",
        status: 200,
        durationMs: 100,
        totalTokens: 10,
        upstreamBaseUrl: "https://upstream.example/v1",
        stream: false,
        retryCount: 0,
        ...overrides,
    } as any;
}

Deno.test("request log API requires admin authentication", async () => {
    const router = createBareRouter();
    router.authKeys = ["secret"];

    const response = await handleAdminRoutes(
        new Request("http://local/admin/request-logs"),
        router,
        "unused.yaml",
    );

    assertEquals(response?.status, 401);
});

Deno.test("request log API supports cursor and filters", async () => {
    const router = createBareRouter() as any;
    const first = router.requestLogStore.record(logInput());
    router.requestLogStore.record(logInput({
        originalModel: "alias",
        resolvedModel: "target",
        status: 500,
        path: "/v1/responses",
    }));

    const response = await handleAdminRoutes(
        new Request(`http://local/admin/request-logs?after=${first.id}&model=target&status=500&path=%2Fv1%2Fresponses&limit=10`),
        router,
        "unused.yaml",
    );
    const body = await response?.json();

    assertEquals(response?.status, 200);
    assertEquals(body.records.length, 1);
    assertEquals(body.records[0].resolvedModel, "target");
    assertEquals(body.latest_id, first.id + 1);
});

Deno.test("request log API rejects invalid numeric parameters", async () => {
    const router = createBareRouter();

    const response = await handleAdminRoutes(
        new Request("http://local/admin/request-logs?after=bad"),
        router,
        "unused.yaml",
    );

    assertEquals(response?.status, 400);
});

Deno.test("dashboard summary includes request token cost key and endpoint metrics", async () => {
    const router = createBareRouter() as any;
    await router.reload([{
        name: "demo",
        endpoints: [
            { base_url: "https://upstream-a.example/v1", keys: ["key-1", "key-2"] },
            { base_url: "https://upstream-b.example/v1", keys: [] },
        ],
    }]);
    router.requestLogStore.record(logInput({ durationMs: 10 }));
    router.requestLogStore.record(logInput({ durationMs: 20 }));
    router.requestLogStore.record(logInput({ durationMs: 100, status: 500 }));

    const response = await handleAdminRoutes(
        new Request("http://local/admin/dashboard-summary?window=24h"),
        router,
        "unused.yaml",
    );
    const body = await response?.json();

    assertEquals(response?.status, 200);
    assertEquals(body.request_count, 3);
    assertEquals(body.error_count, 1);
    assertEquals(body.success_rate, 66.67);
    assertEquals(body.p95_latency_ms, 100);
    assertEquals(body.total_tokens, 1234);
    assertEquals(body.total_cost_usd, 1.25);
    assertEquals(body.active_keys, 2);
    assertEquals(body.total_keys, 2);
    assertEquals(body.cooling_keys, 0);
    assertEquals(body.available_endpoints, 1);
    assertEquals(body.total_endpoints, 2);
});

Deno.test("dashboard summary rejects unknown windows", async () => {
    const router = createBareRouter();

    const response = await handleAdminRoutes(
        new Request("http://local/admin/dashboard-summary?window=forever"),
        router,
        "unused.yaml",
    );

    assertEquals(response?.status, 400);
});

Deno.test("admin page references local assets and required browser libraries", async () => {
    const router = createBareRouter();
    const response = await handleAdminRoutes(
        new Request("http://local/admin"),
        router,
        "unused.yaml",
    );
    const html = await response?.text() || "";

    assertEquals(html.includes("/admin/assets/admin.css"), true);
    assertEquals(html.includes("/admin/assets/admin.js"), true);
    assertEquals(html.includes("echarts"), true);
    assertEquals(html.includes("codemirror"), true);
    assertEquals(html.includes("lucide"), true);
});

Deno.test("admin asset routes return CSS and JavaScript", async () => {
    const router = createBareRouter();
    const css = await handleAdminRoutes(
        new Request("http://local/admin/assets/admin.css"),
        router,
        "unused.yaml",
    );
    const script = await handleAdminRoutes(
        new Request("http://local/admin/assets/admin.js"),
        router,
        "unused.yaml",
    );

    assertEquals(css?.status, 200);
    assertEquals(css?.headers.get("content-type"), "text/css; charset=utf-8");
    assertEquals(script?.status, 200);
    assertEquals(script?.headers.get("content-type"), "application/javascript; charset=utf-8");
});

Deno.test("admin page contains operations dashboard structure", async () => {
    const router = createBareRouter();
    const response = await handleAdminRoutes(
        new Request("http://local/admin"),
        router,
        "unused.yaml",
    );
    const html = await response?.text() || "";
    const requiredIds = [
        "metric-requests",
        "metric-tokens",
        "metric-cost",
        "metric-success",
        "metric-p95",
        "metric-keys",
        "metric-endpoints",
        "metric-errors",
        "chart-requests",
        "chart-token-cost",
        "chart-model-share",
        "endpoint-health-matrix",
        "request-log-table",
        "request-log-model",
        "request-log-status",
        "request-log-path",
        "btn-log-pause",
        "mobile-nav-toggle",
    ];
    for (const id of requiredIds) {
        assertEquals(html.includes(`id="${id}"`), true, `missing dashboard element ${id}`);
    }
});

Deno.test("admin secondary pages use dedicated operations workspaces", async () => {
    const router = createBareRouter();
    const response = await handleAdminRoutes(
        new Request("http://local/admin"),
        router,
        "unused.yaml",
    );
    const html = await response?.text() || "";
    const requiredIds = [
        "model-workspace",
        "model-list-panel",
        "model-detail-panel",
        "endpoint-workspace",
        "endpoint-table",
        "token-workspace",
        "token-overview",
        "token-trend-panel",
        "cost-breakdown-panel",
        "config-workspace",
        "config-editor-panel",
    ];
    for (const id of requiredIds) {
        assertEquals(html.includes(`id="${id}"`), true, `missing secondary workspace ${id}`);
    }
});

Deno.test("token page initial range matches the active one-hour control", async () => {
    const router = createBareRouter();
    const script = await handleAdminRoutes(
        new Request("http://local/admin/assets/admin.js"),
        router,
        "unused.yaml",
    );
    const source = await script?.text() || "";

    assertEquals(source.includes("var tokenRange = '1h';"), true);
    assertEquals(source.includes("'1h': { apiPath: '/minutely', value: 60"), true);
});
