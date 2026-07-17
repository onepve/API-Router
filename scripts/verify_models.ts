import { loadConfig, resolveModelTypes } from "../src/config.ts";
import type { ModelConfig, RouterConfig } from "../src/types.ts";

export type ProbeKind = "chat" | "response" | "image" | "alias";

export interface ModelProbe {
    model: string;
    path: string;
    kind: ProbeKind;
    body: Record<string, unknown>;
    stream: boolean;
    skipReason?: string;
}

export interface ToolCallParseResult {
    eventCount: number;
    finishReason?: string;
    toolCalls: Array<{
        id?: string;
        name?: string;
        argumentsText: string;
        arguments?: unknown;
    }>;
    errors: string[];
}

function isPattern(name: string): boolean {
    return name === "*" || name.startsWith("^") || name.endsWith("*");
}

function createProbe(model: string, config: ModelConfig): ModelProbe {
    const paths = resolveModelTypes(config.type);
    const isAlias = (config.endpoints?.length ?? 0) === 0 &&
        !config.endpoint_refs?.length &&
        !!(config.redirect_to || config.redirects?.length);
    const path = paths[0] || "/v1/chat/completions";

    if (path.startsWith("/v1/images/")) {
        return {
            model,
            path,
            kind: "image",
            stream: false,
            body: {
                model,
                prompt: "A simple blue circle centered on a white background.",
                size: "2048x2048",
                n: 1,
            },
        };
    }

    if (path === "/v1/responses") {
        return {
            model,
            path,
            kind: "response",
            stream: false,
            body: { model, input: "Reply with exactly OK.", max_output_tokens: 32 },
        };
    }

    if (model === "grok-4.5") {
        return {
            model,
            path: "/v1/chat/completions",
            kind: "chat",
            stream: true,
            body: {
                model,
                stream: true,
                messages: [{ role: "user", content: "Call get_weather for Hong Kong." }],
                tools: [{
                    type: "function",
                    function: {
                        name: "get_weather",
                        description: "Get weather for a city",
                        parameters: {
                            type: "object",
                            properties: { city: { type: "string" } },
                            required: ["city"],
                        },
                    },
                }],
                tool_choice: { type: "function", function: { name: "get_weather" } },
            },
        };
    }

    return {
        model,
        path: path === "/v1/messages" ? path : "/v1/chat/completions",
        kind: isAlias ? "alias" : "chat",
        stream: false,
        body: path === "/v1/messages"
            ? { model, max_tokens: 32, messages: [{ role: "user", content: "Reply with exactly OK." }] }
            : { model, max_tokens: 32, messages: [{ role: "user", content: "Reply with exactly OK." }] },
    };
}

export function buildModelProbes(config: RouterConfig): ModelProbe[] {
    return (config.models || []).map(model => {
        const probe = createProbe(model.name, model);
        if (isPattern(model.name)) {
            probe.skipReason = "pattern requires a concrete model id";
        }
        return probe;
    });
}

export function buildConcreteModelProbe(config: RouterConfig, modelId: string): ModelProbe | null {
    const exact = config.models.find(model => model.name === modelId);
    if (exact) return createProbe(modelId, exact);
    for (const model of config.models) {
        if (!model.name.startsWith("^")) continue;
        try {
            if (new RegExp(model.name).test(modelId)) return createProbe(modelId, model);
        } catch (_) {
            // Invalid patterns are already rejected by router configuration validation.
        }
    }
    return null;
}

export function parseToolCallStream(sse: string): ToolCallParseResult {
    const calls = new Map<number, { id?: string; name?: string; argumentsText: string }>();
    const errors: string[] = [];
    let eventCount = 0;
    let finishReason: string | undefined;

    for (const rawLine of sse.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trimStart();
        if (!data || data === "[DONE]") continue;
        let payload: any;
        try {
            payload = JSON.parse(data);
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            continue;
        }
        eventCount++;
        const choice = payload?.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        for (const delta of choice?.delta?.tool_calls || []) {
            const index = typeof delta.index === "number" ? delta.index : 0;
            const current = calls.get(index) || { argumentsText: "" };
            if (delta.id) current.id = delta.id;
            if (delta.function?.name) current.name = delta.function.name;
            if (typeof delta.function?.arguments === "string") {
                current.argumentsText += delta.function.arguments;
            }
            calls.set(index, current);
        }
    }

    return {
        eventCount,
        finishReason,
        toolCalls: Array.from(calls.entries())
            .sort(([a], [b]) => a - b)
            .map(([, call]) => {
                let args: unknown;
                if (call.argumentsText) {
                    try {
                        args = JSON.parse(call.argumentsText);
                    } catch (error) {
                        errors.push(`Tool arguments JSON: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                return {
                    id: call.id,
                    name: call.name,
                    argumentsText: call.argumentsText,
                    arguments: args,
                };
            }),
        errors,
    };
}

function parseArgs(args: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith("--")) continue;
        const value = args[i + 1];
        if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
        result[arg.slice(2)] = value;
        i++;
    }
    return result;
}

async function runProbe(baseUrl: string, authKey: string | undefined, probe: ModelProbe) {
    if (probe.skipReason) {
        return { model: probe.model, path: probe.path, kind: probe.kind, skipped: probe.skipReason };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const started = Date.now();
    try {
        const headers = new Headers({ "content-type": "application/json" });
        if (authKey) headers.set("authorization", `Bearer ${authKey}`);
        const response = await fetch(new URL(probe.path, baseUrl), {
            method: "POST",
            headers,
            body: JSON.stringify(probe.body),
            signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();
        const result: Record<string, unknown> = {
            model: probe.model,
            path: probe.path,
            kind: probe.kind,
            status: response.status,
            duration_ms: Date.now() - started,
            content_type: contentType,
            response_bytes: new TextEncoder().encode(text).length,
        };
        if (probe.stream) {
            const parsed = parseToolCallStream(text);
            result.stream_event_count = parsed.eventCount;
            result.finish_reason = parsed.finishReason;
            result.tool_calls = parsed.toolCalls;
            result.parse_errors = parsed.errors;
        } else if (contentType.includes("application/json")) {
            try {
                const json = JSON.parse(text);
                result.usage_present = !!(json?.usage || json?.response?.usage);
                result.error = json?.error?.message || json?.error || undefined;
            } catch (error) {
                result.parse_error = error instanceof Error ? error.message : String(error);
            }
        }
        return result;
    } catch (error) {
        return {
            model: probe.model,
            path: probe.path,
            kind: probe.kind,
            status: 0,
            duration_ms: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

if (import.meta.main) {
    const args = parseArgs(Deno.args);
    const configPath = args.config || "./config.yaml";
    const baseUrl = args["base-url"] || "http://localhost:8080";
    const config = await loadConfig(configPath);
    let probes: ModelProbe[];
    if (args.model) {
        const probe = buildConcreteModelProbe(config, args.model);
        if (!probe) throw new Error(`No configuration matches model: ${args.model}`);
        probes = [probe];
    } else {
        probes = buildModelProbes(config);
    }

    const report = [];
    for (const probe of probes) {
        report.push(await runProbe(baseUrl, args["auth-key"] || Deno.env.get("ROUTER_AUTH_KEY"), probe));
    }
    console.log(JSON.stringify({
        generated_at: new Date().toISOString(),
        base_url: baseUrl,
        results: report,
    }, null, 2));
}
