# Admin Dashboard and Model Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a maintainable operations dashboard with recent request logs and verify forwarding for every configured model, especially streaming tool calls for `grok-4.5`.

**Architecture:** Add a bounded in-memory request log store and expose authenticated dashboard APIs from `ModelRouter`. Split the current inline admin page into an HTML shell, a CSS response, and a JavaScript response without adding a build system. Add deterministic forwarding tests with a fake upstream plus a separate live verification script that exercises the configured upstreams through the local router.

**Tech Stack:** Deno 2, TypeScript, native Fetch/Streams, ECharts 5, CodeMirror 5, Lucide browser bundle, Deno tests, Playwright or in-app browser screenshots.

## Global Constraints

- Keep request logs in memory only, with a default capacity of 500 records.
- Never store request bodies, response bodies, API keys, authorization headers, or sensitive query strings in request logs.
- Preserve all current model, endpoint, Key, Token, cost, and configuration management capabilities.
- Do not add a frontend bundler, framework, WebSocket, or SSE log transport.
- Poll recent request logs incrementally every 2 seconds using a cursor.
- Use a desktop-first 65% / 35% operations layout and remain usable at 768px and 390px widths.
- Use Lucide icons for interface actions; do not use emoji as primary interface icons.
- Keep cards at 8px radius or less and avoid nested cards.
- Use test-first development for backend behavior and forwarding corrections.

---

### Task 1: Bounded Request Log Store

**Files:**
- Create: `src/request_log_store.ts`
- Create: `src/request_log_store_test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `RequestLogRecord`, `RequestLogInput`, `RequestLogQuery`, and `RequestLogStore`.
- Produces: `RequestLogStore.record(input): RequestLogRecord`, `query(query): { records: RequestLogRecord[]; latestId: number }`, and `summary(windowMs): RequestLogSummary`.

- [ ] **Step 1: Write failing capacity and cursor tests**

```ts
Deno.test("request log store keeps only the newest records", () => {
    const store = new RequestLogStore(2);
    store.record(sample({ model: "a" }));
    store.record(sample({ model: "b" }));
    store.record(sample({ model: "c" }));
    assertEquals(store.query({ limit: 10 }).records.map(r => r.model), ["b", "c"]);
});

Deno.test("request log store returns records after a cursor", () => {
    const store = new RequestLogStore(10);
    const first = store.record(sample({ model: "a" }));
    store.record(sample({ model: "b" }));
    assertEquals(store.query({ after: first.id }).records.length, 1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `deno test src/request_log_store_test.ts`

Expected: FAIL because `RequestLogStore` does not exist.

- [ ] **Step 3: Implement bounded storage and filters**

```ts
export class RequestLogStore {
    private records: RequestLogRecord[] = [];
    private nextId = 1;

    constructor(private readonly capacity = 500) {}

    record(input: RequestLogInput): RequestLogRecord {
        const record = { ...input, id: this.nextId++ };
        this.records.push(record);
        if (this.records.length > this.capacity) {
            this.records.splice(0, this.records.length - this.capacity);
        }
        return record;
    }
}
```

Add model, status, path, limit, and cursor filtering. Compute request count, success rate, error count, P95 latency, per-minute buckets, and model distribution for a supplied window.

- [ ] **Step 4: Add privacy-shape test**

Assert that `RequestLogRecord` exposes only the approved metadata fields and has no body, headers, key, or authorization property.

- [ ] **Step 5: Run tests and commit**

Run: `deno test src/request_log_store_test.ts`

Expected: all request log store tests pass.

Commit: `feat: add bounded request log store`

---

### Task 2: Record Final Forwarding Outcomes

**Files:**
- Modify: `src/model_router.ts`
- Modify: `src/model_router_test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: `RequestLogStore.record()` from Task 1.
- Produces: `ModelRouter.requestLogStore` and final-outcome logging for normal, retried, redirected, and streaming requests.

- [ ] **Step 1: Write failing non-stream final-outcome tests**

Cover a successful response, a retry followed by success, and all keys failing. Assert exactly one record per client request with status, duration, retry count, original model, resolved model, path, and upstream base URL.

- [ ] **Step 2: Write failing streaming lifecycle tests**

Use real `ReadableStream` objects. Assert a completed stream records success only after `wrapped.text()` completes, and a stream error records a failed final outcome.

- [ ] **Step 3: Write a failing redirect test**

Configure `alias-model` to redirect to `resolved-model`. Assert the record keeps `originalModel: "alias-model"` and `resolvedModel: "resolved-model"`.

- [ ] **Step 4: Run targeted tests and verify RED**

Run: `deno test --allow-read --allow-write --allow-env --filter "request log|stream lifecycle|redirect outcome" src/model_router_test.ts`

Expected: FAIL because requests are not recorded.

- [ ] **Step 5: Implement a request context passed through redirects and retries**

```ts
interface RequestContext {
    originalModel: string;
    startedAt: number;
    retryCount: number;
}
```

Create the context once in `handleRequest`, preserve it through `processRequest`, increment retries in `forwardRequest`, and write exactly one final record. For stream responses, pass a completion callback into `wrapStreamResponse`.

- [ ] **Step 6: Preserve tool-call SSE bytes exactly**

Add a regression test containing OpenAI-compatible streamed `tool_calls` argument fragments. Consume the wrapped response and assert its bytes equal the upstream bytes exactly. Do not parse or rewrite tool-call payloads.

- [ ] **Step 7: Run tests and commit**

Run: `deno test --allow-read --allow-write --allow-env src/model_router_test.ts`

Expected: all router tests pass.

Commit: `feat: record final request outcomes`

---

### Task 3: Dashboard and Request Log APIs

**Files:**
- Modify: `src/model_router.ts`
- Modify: `src/admin/routes.ts`
- Create: `src/admin/routes_test.ts`

**Interfaces:**
- Produces: `GET /admin/request-logs`.
- Produces: `GET /admin/dashboard-summary?window=24h`.

- [ ] **Step 1: Write failing authenticated API tests**

Test unauthorized responses, cursor pagination, limit clamping to 500, model/status/path filters, and JSON content type.

- [ ] **Step 2: Write failing summary tests**

Seed request records with known statuses and durations. Seed endpoint managers with active and cooling keys. Assert request count, success rate, P95, errors, active/total/cooling Key counts, available/total endpoint counts, timeline buckets, and model distribution.

- [ ] **Step 3: Run API tests and verify RED**

Run: `deno test --allow-read --allow-write --allow-env src/admin/routes_test.ts`

Expected: FAIL with 404 for the new routes.

- [ ] **Step 4: Implement query parsing and summary responses**

Route both paths through existing admin authentication. Reject invalid windows and numeric parameters with status 400. Return `{ records, latest_id }` for logs and a stable snake_case summary schema for the dashboard.

- [ ] **Step 5: Run tests and commit**

Run: `deno test --allow-read --allow-write --allow-env src/admin/routes_test.ts`

Expected: all admin API tests pass.

Commit: `feat: expose dashboard operations APIs`

---

### Task 4: Split the Admin Frontend Assets

**Files:**
- Rewrite: `src/admin/page.ts`
- Create: `src/admin/styles.ts`
- Create: `src/admin/script.ts`
- Modify: `src/admin/routes.ts`
- Modify: `src/admin/routes_test.ts`

**Interfaces:**
- Produces: `getAdminPageResponse()`, `getAdminStylesResponse()`, and `getAdminScriptResponse()`.
- Produces: `/admin/assets/admin.css` and `/admin/assets/admin.js`.

- [ ] **Step 1: Write failing asset route tests**

Assert the page references the two local assets, CSS returns `text/css`, JavaScript returns `application/javascript`, and the page still references ECharts, CodeMirror, and Lucide.

- [ ] **Step 2: Run tests and verify RED**

Run: `deno test --allow-read --allow-write --allow-env --filter "admin asset" src/admin/routes_test.ts`

Expected: FAIL with 404 for local assets.

- [ ] **Step 3: Move existing behavior without redesigning it yet**

Extract current styles and script into response modules. Keep element IDs and API calls stable. Serve assets before the authenticated API gate because they contain no secrets.

- [ ] **Step 4: Run existing and asset tests**

Run: `deno test --allow-read --allow-write --allow-env src/admin/routes_test.ts src/model_router_test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

Commit: `refactor: split admin frontend assets`

---

### Task 5: Build the Operations Dashboard and Efficient Secondary Views

**Files:**
- Modify: `src/admin/page.ts`
- Modify: `src/admin/styles.ts`
- Modify: `src/admin/script.ts`
- Modify: `src/admin/routes_test.ts`

**Interfaces:**
- Consumes: dashboard and log APIs from Task 3.
- Preserves: all existing model, endpoint, Key, Token/cost, and config API operations.

- [ ] **Step 1: Add structural DOM tests**

Assert the page contains IDs for eight summary metrics, request/error and Token/cost chart containers, model distribution, endpoint health matrix, request log table, log filters, pause control, mobile navigation control, model drawer, endpoint table, Token pricing table, and config editor.

- [ ] **Step 2: Run structural tests and verify RED**

Run: `deno test --allow-read --allow-write --allow-env --filter "dashboard structure" src/admin/routes_test.ts`

Expected: FAIL because the new layout IDs do not exist.

- [ ] **Step 3: Implement the HTML shell and design tokens**

Use the approved palette and desktop 65% / 35% layout. Use one-level panels, 8px maximum radius, stable table row heights, visible focus rings, reduced-motion rules, and no emoji navigation labels.

- [ ] **Step 4: Implement incremental log polling**

Maintain `latestLogId`, poll every 2 seconds, prepend or append without duplicates, cap rendered rows, support pause/resume, and reset the cursor when the backend latest ID is lower after restart.

- [ ] **Step 5: Implement summary and chart rendering**

Render request count, Token, cost, success rate, P95, active/total Keys, available/total endpoints, and errors. Reuse the existing cost and Token endpoints where their data is already authoritative.

- [ ] **Step 6: Refine secondary workspaces**

Preserve every current action. Convert model editing to a right drawer, endpoints to an expandable sortable table, Token/cost charts to a shared filter toolbar, and config editing to a full-height workspace with dirty-state protection.

- [ ] **Step 7: Add resilient dependency states**

If ECharts is unavailable, show a table summary. If CodeMirror is unavailable, keep the textarea usable. If Lucide is unavailable, preserve button labels and accessible names.

- [ ] **Step 8: Run backend tests and commit**

Run: `deno test --allow-read --allow-write --allow-env`

Expected: all tests pass.

Commit: `feat: redesign admin operations console`

---

### Task 6: Configured Model Forwarding Test Harness

**Files:**
- Create: `scripts/verify_models.ts`
- Create: `scripts/verify_models_test.ts`
- Modify if defects are found: `src/model_router.ts`
- Modify if defects are found: `src/model_router_test.ts`

**Interfaces:**
- Produces: a command that reads `config.yaml`, exercises each configured non-redirect model through a supplied router URL, and prints a redacted JSON report.

- [ ] **Step 1: Write failing request-construction tests**

For `chat`, `response`, and `images` model types, assert the harness selects the correct path and minimal body. Assert redirect-only models are marked as aliases instead of called independently.

- [ ] **Step 2: Add a failing grok streaming tool-call parser test**

Use SSE fixtures with fragmented `delta.tool_calls[0].function.arguments`. Assert the harness reconstructs the function name and JSON arguments, observes a tool-call finish reason, and reports malformed SSE separately from an upstream model failure.

- [ ] **Step 3: Run tests and verify RED**

Run: `deno test --allow-read scripts/verify_models_test.ts`

Expected: FAIL because the harness does not exist.

- [ ] **Step 4: Implement the redacted verification report**

Accept `--base-url`, `--auth-key`, `--config`, and `--model`. Never print configured upstream keys. Report model, route, HTTP status, duration, stream event count, tool name, reconstructed argument JSON, token usage presence, and error summary.

- [ ] **Step 5: Run harness tests**

Run: `deno test --allow-read scripts/verify_models_test.ts`

Expected: all harness tests pass.

- [ ] **Step 6: Start the local router and perform live tests**

Run the router on an unused port with the actual local configuration, then run:

```powershell
deno run --allow-read --allow-net scripts/verify_models.ts --base-url http://localhost:<port> --config config.yaml
```

For `grok-4.5`, send an OpenAI-compatible streaming tool call with a forced function:

```json
{
  "model": "grok-4.5",
  "stream": true,
  "messages": [{ "role": "user", "content": "Call get_weather for Hong Kong." }],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get weather for a city",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  }],
  "tool_choice": { "type": "function", "function": { "name": "get_weather" } }
}
```

Verify HTTP 200, SSE framing, tool-call deltas, reconstructed valid JSON arguments, and unchanged forwarding bytes through the deterministic regression test.

- [ ] **Step 7: Fix only reproduced forwarding defects using RED/GREEN tests**

For each live defect, add the smallest fake-upstream reproduction to `src/model_router_test.ts`, verify RED, implement the correction, and rerun all tests.

- [ ] **Step 8: Save the redacted report and commit**

Save the report to `docs/verification/2026-07-17-model-forwarding.md`. Do not include keys or request authorization values.

Commit: `test: verify configured model forwarding`

---

### Task 7: Browser and Completion Verification

**Files:**
- Modify as needed: `src/admin/styles.ts`
- Modify as needed: `src/admin/script.ts`
- Create: `docs/verification/2026-07-17-admin-ui.md`

**Interfaces:**
- Consumes the completed admin UI and local router.
- Produces screenshot evidence and a requirement-by-requirement verification report.

- [ ] **Step 1: Start the router on an unused port**

Keep the server running during browser verification and provide the authenticated admin URL.

- [ ] **Step 2: Capture desktop and mobile screenshots**

Use 1440x900, 1920x1080, 768x1024, and 390x844. Verify no overlap, clipped controls, unreadable labels, blank charts, or inaccessible drawers.

- [ ] **Step 3: Exercise core workflows**

Verify navigation, log pause/resume/filtering, metric-to-detail filtering, model search, endpoint expansion, Token/cost range changes, config dirty-state warning, and authentication modal behavior.

- [ ] **Step 4: Run final automated verification**

Run:

```powershell
deno test --allow-read --allow-write --allow-env
deno check src/main.ts scripts/verify_models.ts
```

Expected: all tests pass and both entry points type-check.

- [ ] **Step 5: Audit every design requirement**

Record evidence for every requirement in the design specification, including Key counts, endpoint counts, costs, recent logs, privacy constraints, responsive behavior, and `grok-4.5` tool-call forwarding.

- [ ] **Step 6: Commit completion evidence**

Commit: `docs: record dashboard and forwarding verification`
