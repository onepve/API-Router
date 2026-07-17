// src/model_router.ts
// 模型路由器核心 — 模型匹配、请求转发、重定向链

import type { ModelConfig, Matcher, MatcherType, RouterConfig, HeaderPolicy } from "./types.ts";
import type { RequestLogRecord } from "./types.ts";
import { TokenStore } from "./token_store.ts";
import { RequestLogStore } from "./request_log_store.ts";
import { EndpointManager } from "./endpoint_manager.ts";
import { WeightedLoadBalancer } from "./load_balancer.ts";
import { loadConfig, saveConfig, resolveModelTypes } from "./config.ts";
import { ModelCatalog } from "./model_catalog.ts";
import type { CatalogModel } from "./model_catalog.ts";
import { Logger } from "./logger.ts";
import type { LogLevel } from "./logger.ts";

class RequestBodyTooLargeError extends Error {}

interface RequestContext {
    startedAt: number;
    path: string;
    originalModel?: string;
    resolvedModel?: string;
    upstreamBaseUrl?: string;
    stream: boolean;
    attempts: number;
    totalTokens?: number;
    deferred: boolean;
    error?: string;
    record?: RequestLogRecord;
}

// ============================================================================
// 模型路由器核心
// ============================================================================
export class ModelRouter {
    // 存储所有模型配置的运行时数据
    private modelConfigs: Array<{
        matcher: Matcher;
        endpoints: EndpointManager[];
        balancer: WeightedLoadBalancer;
        config: ModelConfig;
        baseUrlMap: Map<EndpointManager, string>;
    }> = [];

    private defaultConfig: {
        endpoints: EndpointManager[];
        balancer: WeightedLoadBalancer;
        config: ModelConfig;
        baseUrlMap: Map<EndpointManager, string>;
    } | null = null;

    /** 标记默认配置是由用户明确定义还是自动创建的 */
    private defaultWasUserDefined = false;

    /** 端点池共享缓存：同名池端点在所有模型中共享同一个 EndpointManager */
    private poolCache = new Map<string, EndpointManager>();

    private onReloadCallbacks: (() => void)[] = [];
    private maxRedirectDepth = 5;
    private catalog: ModelCatalog;
    tokenStore: TokenStore;
    requestLogStore: RequestLogStore;
    authKeys: string[];
    configPath: string;
    globalHeaderPolicy: HeaderPolicy | undefined;
    logger: Logger;
    private maxRequestBodyBytes: number;

    constructor(configs: ModelConfig[], rawConfig: RouterConfig, catalog: ModelCatalog, configPath?: string, logger?: Logger) {
        this.catalog = catalog;
        this.authKeys = rawConfig.auth_key || [];
        this.configPath = configPath || Deno.env.get("CONFIG_PATH") || "./config.yaml";
        this.globalHeaderPolicy = rawConfig.headers;
        this.logger = logger || new Logger("info");
        const configuredBodyLimit = Number(Deno.env.get("MAX_REQUEST_BODY_BYTES"));
        this.maxRequestBodyBytes = Number.isFinite(configuredBodyLimit) && configuredBodyLimit > 0
            ? Math.floor(configuredBodyLimit)
            : 32 * 1024 * 1024;
        const persistPath = Deno.env.get("TOKEN_STATS_PATH") || "./token_stats.json";
        this.tokenStore = new TokenStore(persistPath, this.logger.child("TokenStore"));
        this.requestLogStore = new RequestLogStore(500);
        this.tokenStore.restore().then(() => {
            this.tokenStore.startCleanup();
        });
        this.buildRouter(configs, rawConfig.endpoint_pool);
    }

    // ------------------------------------------------------------------------
    // 构建或重新加载路由表
    // ------------------------------------------------------------------------
    private buildRouter(configs: ModelConfig[], endpointPool?: Record<string, any>): void {
        this.modelConfigs = [];
        this.defaultConfig = null;
        this.defaultWasUserDefined = false;

        // 重建端点池共享缓存
        this.poolCache.clear();

        for (const cfg of configs) {
            const isDefault = cfg.name === "*";
            const matcher = this.createMatcher(cfg.name);
            const cooldownMs = cfg.cooldown_ms || 60000;
            const deleteAfterFailureMs = cfg.delete_after_failure_ms || 3600000;

            const normalizedConfig: ModelConfig = { ...cfg };
            if (!normalizedConfig.redirects && normalizedConfig.redirect_to) {
                normalizedConfig.redirects = [{
                    pre: "*", weight: 1, to: normalizedConfig.redirect_to
                }];
            }
            if (normalizedConfig.redirects) {
                normalizedConfig.redirects = normalizedConfig.redirects.map(r => ({
                    ...r, weight: r.weight ?? 1,
                }));
            }

            const endpoints: EndpointManager[] = [];
            const baseUrlMap = new Map<EndpointManager, string>();

            // 1. 解析 endpoint_refs → 从端点池获取或创建共享 EndpointManager
            if (cfg.endpoint_refs && endpointPool) {
                for (const refName of cfg.endpoint_refs) {
                    const poolDef = endpointPool[refName];
                    if (!poolDef) {
                        this.logger.warn(`模型 ${cfg.name} 引用了不存在的端点池 '${refName}'`);
                        continue;
                    }
                    let manager = this.poolCache.get(refName);
                    if (!manager) {
                        manager = new EndpointManager(
                            poolDef.keys || [],
                            poolDef.weight || 1,
                            cooldownMs,
                            deleteAfterFailureMs,
                            this.logger.child("Endpoint"),
                            { timeout: poolDef.timeout, maxRetries: poolDef.max_retries }
                        );
                        this.poolCache.set(refName, manager);
                    }
                    endpoints.push(manager);
                    baseUrlMap.set(manager, poolDef.base_url);
                }
            }

            // 2. 模型独占端点
            if (cfg.endpoints && cfg.endpoints.length > 0) {
                for (const epCfg of cfg.endpoints) {
                    const manager = new EndpointManager(
                        epCfg.keys, epCfg.weight || 1,
                        cooldownMs, deleteAfterFailureMs,
                        this.logger.child("Endpoint"),
                        { timeout: epCfg.timeout, maxRetries: epCfg.max_retries }
                    );
                    endpoints.push(manager);
                    baseUrlMap.set(manager, epCfg.base_url);
                }
            }

            // 3. 既无 refs 也无独占端点 → 空占位
            if (endpoints.length === 0) {
                const manager = new EndpointManager([], 1, cooldownMs, deleteAfterFailureMs, this.logger.child("Endpoint"));
                endpoints.push(manager);
                baseUrlMap.set(manager, "");
            }

            const balancer = new WeightedLoadBalancer(endpoints);
            const managerData = {
                matcher, endpoints, balancer,
                config: normalizedConfig,
                baseUrlMap,
            };

            if (isDefault) {
                this.defaultConfig = managerData;
                this.defaultWasUserDefined = true;
            } else {
                this.modelConfigs.push(managerData);
            }
        }

        // 确保默认配置存在
        if (!this.defaultConfig) {
            const defaultCfg: ModelConfig = {
                name: "*",
                endpoints: [{
                    base_url: "https://api.openai.com/v1",
                    keys: [],
                }],
                cooldown_ms: 60000,
                delete_after_failure_ms: 3600000,
                default_timeout: 120,
                default_max_retries: 3,
            };
            const manager = new EndpointManager([], 1, 60000, 3600000, this.logger.child("Endpoint"));
            const baseUrlMap = new Map<EndpointManager, string>();
            baseUrlMap.set(manager, defaultCfg.endpoints![0].base_url);
            this.defaultConfig = {
                endpoints: [manager],
                balancer: new WeightedLoadBalancer([manager]),
                config: defaultCfg,
                baseUrlMap,
            };
        }

        for (const callback of this.onReloadCallbacks) {
            try { callback(); } catch (e) { this.logger.error(`Reload callback error: ${e}`); }
        }
    }

    async reload(configs: ModelConfig[], endpointPool?: Record<string, any>, rawConfig?: RouterConfig): Promise<void> {
        this.logger.info(`Reloading config... (${configs.length} models)`);
        const startTime = Date.now();
        if (rawConfig) {
            this.authKeys = rawConfig.auth_key || [];
            this.globalHeaderPolicy = rawConfig.headers;
        }
        this.buildRouter(configs, endpointPool);
        const elapsed = Date.now() - startTime;
        this.logger.info(`Config reloaded (${elapsed}ms)`);
        this.logConfigSummary(configs);
    }

    private logConfigSummary(configs: ModelConfig[]): void {
        let totalKeys = 0, totalEndpoints = 0;
        for (const model of configs) {
            if (model.endpoints) {
                totalEndpoints += model.endpoints.length;
                for (const ep of model.endpoints) {
                    totalKeys += ep.keys ? ep.keys.length : 0;
                }
            }
        }
        this.logger.info(`Config summary: ${configs.length} models, ${totalEndpoints} endpoints, ${totalKeys} keys`);
    }

    onReload(callback: () => void): void {
        this.onReloadCallbacks.push(callback);
    }

    // ------------------------------------------------------------------------
    // 鉴权
    // ------------------------------------------------------------------------
    isAuthenticated(req: Request): boolean {
        if (this.authKeys.length === 0) return true;

        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) return false;

        const token = authHeader.slice(7);
        return this.authKeys.includes(token);
    }

    // ------------------------------------------------------------------------
    // 匹配器创建
    // ------------------------------------------------------------------------
    private createMatcher(pattern: string): Matcher {
        if (pattern.startsWith("^")) {
            try {
                const regex = new RegExp(pattern);
                return { type: "regex", pattern, regex };
            } catch (e) {
                this.logger.error(`Invalid regex pattern: ${pattern} — ${e}`);
                return { type: "exact", pattern };
            }
        }
        if (pattern.endsWith("*")) {
            return { type: "prefix", pattern: pattern.slice(0, -1) };
        }
        return { type: "exact", pattern };
    }

    private matchModelPattern(modelName: string, matcher: Matcher): boolean {
        switch (matcher.type) {
            case "exact":   return modelName === matcher.pattern;
            case "prefix":  return modelName.startsWith(matcher.pattern);
            case "regex":   return matcher.regex?.test(modelName) || false;
            case "wildcard":return true;
            default:        return false;
        }
    }

    // ------------------------------------------------------------------------
    // 查找模型配置（不处理重定向）
    // ------------------------------------------------------------------------
    private resolveModelConfig(modelName: string) {
        for (const entry of this.modelConfigs) {
            if (this.matchModelPattern(modelName, entry.matcher)) {
                return { endpoints: entry.endpoints, balancer: entry.balancer, config: entry.config, baseUrlMap: entry.baseUrlMap };
            }
        }
        return this.defaultConfig;
    }

    // ------------------------------------------------------------------------
    // /v1/models 端点 — 返回可用模型列表 (OpenAI 兼容格式)
    // ------------------------------------------------------------------------
    private handleListModels(): Response {
        // 从目录解析配置模式 → 真实模型 ID
        const configs = this.modelConfigs.map(e => e.config);
        const resolvedIds = this.catalog.resolvePatterns(configs);

        const data = resolvedIds.map(id => {
            const catModel = this.catalog.getModel(id);
            return {
                id,
                object: "model",
                created: 1700000000,
                owned_by: catModel?.provider || "api-router",
            };
        });

        return new Response(JSON.stringify({
            object: "list",
            data,
        }), {
            headers: { "content-type": "application/json" },
        });
    }

    // ------------------------------------------------------------------------
    // 外部入口：处理 API 请求（含全局鉴权）
    // ------------------------------------------------------------------------
    async handleRequest(req: Request): Promise<Response> {
        if (!this.isAuthenticated(req)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "content-type": "application/json" },
            });
        }
        const pathname = new URL(req.url).pathname;
        if (!pathname.startsWith("/v1/")) {
            return this.processRequest(req, new Set());
        }
        const context: RequestContext = {
            startedAt: Date.now(),
            path: pathname,
            stream: false,
            attempts: 0,
            deferred: false,
        };
        const response = await this.processRequest(req, new Set(), context);
        if (!context.deferred) {
            this.recordRequestOutcome(context, response.status);
        }
        return response;
    }

    // ------------------------------------------------------------------------
    // 内部递归处理（支持重定向链）
    // ------------------------------------------------------------------------
    private async processRequest(
        req: Request,
        redirectChain: Set<string>,
        context?: RequestContext,
    ): Promise<Response> {
        const url = new URL(req.url);
        if (!url.pathname.startsWith("/v1/")) {
            return new Response("Not Found", { status: 404 });
        }

        // /v1/models 列表端点 — 无需请求体
        if (url.pathname === "/v1/models" && req.method === "GET") {
            return this.handleListModels();
        }

        let body: any;
        let bodyBuffer: Uint8Array | null = null;
        try {
            if (req.body) {
                bodyBuffer = await this.streamToBuffer(req.body);
                body = JSON.parse(new TextDecoder().decode(bodyBuffer));
            } else {
                return new Response("Missing body", { status: 400 });
            }
        } catch (error) {
            if (error instanceof RequestBodyTooLargeError) {
                return new Response(JSON.stringify({ error: "Request body too large" }), {
                    status: 413,
                    headers: { "content-type": "application/json" },
                });
            }
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "content-type": "application/json" } });
        }

        const originalModel = body.model;
        if (!originalModel) {
            return new Response(JSON.stringify({ error: "Missing 'model' field in request" }), { status: 400, headers: { "content-type": "application/json" } });
        }

        // 检测是否为流式请求
        const isStream = body.stream === true;
        if (context) {
            context.originalModel ??= originalModel;
            context.resolvedModel = originalModel;
            context.stream = isStream;
        }

        if (redirectChain.size >= this.maxRedirectDepth) {
            this.logger.error(`Exceeded max redirect depth`);
            return new Response(JSON.stringify({ error: "Too many redirects" }), { status: 508, headers: { "content-type": "application/json" } });
        }
        if (redirectChain.has(originalModel)) {
            this.logger.error(`Redirect loop: ${[...redirectChain].join(" -> ")} -> ${originalModel}`);
            return new Response(JSON.stringify({ error: "Redirect loop detected" }), { status: 508, headers: { "content-type": "application/json" } });
        }
        redirectChain.add(originalModel);

        const managerData = this.resolveModelConfig(originalModel);
        if (!managerData) {
            return new Response(JSON.stringify({ error: `No configuration found for model: ${originalModel}` }), { status: 404, headers: { "content-type": "application/json" } });
        }

        const { balancer, config, baseUrlMap } = managerData;

        // 验证请求端点是否在模型支持的 type 范围内
        const resolvedTypes = resolveModelTypes(config.type);
        if (resolvedTypes.length > 0 && !resolvedTypes.includes(url.pathname)) {
            return new Response(JSON.stringify({
                error: `Model '${originalModel}' does not support endpoint '${url.pathname}'. Supported: ${resolvedTypes.join(", ")}`
            }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        let endpoint = await balancer.getAvailableEndpoint();
        while (endpoint) {
            const baseUrl = baseUrlMap.get(endpoint);
            if (baseUrl && baseUrl !== "") {
                if (context) context.upstreamBaseUrl = baseUrl;
                const response = await this.forwardRequest(
                    req,
                    bodyBuffer!,
                    baseUrl,
                    endpoint,
                    config,
                    originalModel,
                    isStream,
                    context,
                );
                if (response !== null) {
                    return response;
                }
                this.logger.debug(`Endpoint ${baseUrl} all keys unavailable, trying next`);
            } else {
                this.logger.info(`Model ${originalModel} is redirect-only, triggering redirect`);
                break;
            }
            endpoint = await balancer.getAvailableEndpoint();
        }

        if (config.redirects && config.redirects.length > 0) {
            const matching = config.redirects.filter(rule => {
                const matcher = this.createMatcher(rule.pre);
                return this.matchModelPattern(originalModel, matcher);
            });

            if (matching.length > 0) {
                let candidates = matching.filter(r => (r.weight ?? 1) > 0);
                if (candidates.length === 0) candidates = matching;

                const totalWeight = candidates.reduce((sum, r) => sum + (r.weight ?? 1), 0);
                let rand = Math.random() * totalWeight;
                let selected: typeof matching[0] | null = null;
                for (const rule of candidates) {
                    rand -= (rule.weight ?? 1);
                    if (rand <= 0) { selected = rule; break; }
                }
                if (!selected) selected = candidates[candidates.length - 1];

                this.logger.info(`Model ${originalModel} no available endpoints, redirect to ${selected.to} (weight ${selected.weight})`);

                body.model = selected.to;
                const newBody = new TextEncoder().encode(JSON.stringify(body));
                const newReq = new Request(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: newBody,
                });
                return this.processRequest(newReq, new Set(redirectChain), context);
            }
        }

        if (context) context.error = `No available endpoints for model: ${originalModel}`;
        return new Response(JSON.stringify({ error: `No available endpoints for model: ${originalModel}` }), { status: 503, headers: { "content-type": "application/json" } });
    }

    // ------------------------------------------------------------------------
    // 实际转发请求到上游 API
    // ------------------------------------------------------------------------
    private async forwardRequest(
        req: Request,
        bodyBuffer: Uint8Array,
        baseUrl: string,
        endpoint: EndpointManager,
        config: ModelConfig,
        modelName: string,
        isStream: boolean = false,
        context?: RequestContext,
    ): Promise<Response | null> {
        const url = new URL(req.url);
        const timeout = endpoint.getTimeout() ?? config.default_timeout ?? 120;
        const maxRetries = endpoint.getMaxRetries() ?? config.default_max_retries ?? 3;

        const upstreamUrl = this.buildUpstreamUrl(baseUrl, url.pathname);
        upstreamUrl.search = url.search;

        const headers = new Headers(req.headers);
        headers.delete("host");
        headers.delete("authorization");
        headers.set("content-type", "application/json");
        // 应用配置的 header 策略（模型级优先于全局）
        const headerPolicy = config.headers ?? this.globalHeaderPolicy;
        if (headerPolicy) {
            if (headerPolicy.delete) {
                for (const name of headerPolicy.delete) {
                    headers.delete(name.toLowerCase());
                }
            }
            if (headerPolicy.set) {
                for (const [name, value] of Object.entries(headerPolicy.set)) {
                    headers.set(name.toLowerCase(), value);
                }
            }
        }

        let lastError: Error | null = null;
        let attempts = 0;
        const maxAttempts = Math.min(Math.max(maxRetries, 1), endpoint.getKeyCount() || 1);

        while (attempts < maxAttempts) {
            const key = await endpoint.getAvailableKey();
            if (!key) break;

            this.setAuthHeader(headers, key, baseUrl);

            try {
                if (context) context.attempts++;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

                this.logger.debug(`Forward: model=${modelName} stream=${isStream} path=${url.pathname}`);

                let response: Response;
                try {
                    response = await fetch(upstreamUrl.toString(), {
                        method: req.method,
                        headers,
                        body: bodyBuffer as BodyInit,
                        signal: controller.signal,
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                // 401 = 凭据确实无效 → 永久删除 key
                // 403 = 服务器拒绝（WAF/IP/UA/流式差异等，非凭据问题）→ 临时冷却
                if (response.status === 401) {
                    await this.removeKeyFromConfig(config.name, baseUrl, key);
                    await endpoint.markPermanentFailure(key, 401);
                    this.logger.warn(`Key ${key.slice(0, 8)}... auth failure 401, permanently deleted`);
                    continue;
                }
                if (response.status === 403) {
                    await endpoint.markFailure(key);
                    attempts++;
                    this.logger.warn(`Key ${key.slice(0, 8)}... upstream returned 403 (possible WAF/UA/stream block), entering cooldown (${endpoint.getKeyCount()} keys remaining)`);
                    lastError = new Error(`Upstream error: 403`);
                    continue;
                }
                if (response.status === 429 || response.status >= 500) {
                    await endpoint.markFailure(key);
                    attempts++;
                    this.logger.warn(`Key ${key.slice(0, 8)}... returned status ${response.status}`);
                    lastError = new Error(`Upstream error: ${response.status}`);
                    continue;
                }

                // ---------- 流式 Token 统计（SSE 流截取） ----------
                if (isStream && response.body) {
                    if (context) context.deferred = true;
                    const wrapped = this.wrapStreamResponse(
                        response,
                        modelName,
                        key,
                        endpoint,
                        context
                            ? (result) => {
                                context.totalTokens = result.totalTokens;
                                if (result.error) context.error = result.error;
                                this.recordRequestOutcome(context, result.status);
                            }
                            : undefined,
                    );
                    return wrapped;
                }

                // ---------- 非流式 Token 统计（JSON 响应） ----------
                const contentType = response.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    const cloned = response.clone();
                    (async () => {
                        try {
                            const json = await cloned.json();
                            const usage = this.findUsageObject(json);
                            if (usage && typeof usage === "object") {
                                let totalTokens: number | undefined;
                                if (typeof usage.total_tokens === "number") {
                                    totalTokens = usage.total_tokens;
                                } else if (typeof usage.input_tokens === "number" || typeof usage.output_tokens === "number") {
                                    // Anthropic 格式：从 input + output 计算总量
                                    totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
                                } else if (typeof usage.prompt_tokens === "number" || typeof usage.completion_tokens === "number") {
                                    // OpenAI 格式 fallback
                                    totalTokens = (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
                                }
                                if (totalTokens !== undefined) {
                                    if (context) {
                                        context.totalTokens = totalTokens;
                                        if (context.record) context.record.totalTokens = totalTokens;
                                    }
                                    const breakdown = this.extractTokenBreakdown(usage);
                                    this.tokenStore.record(modelName, totalTokens,
                                        (breakdown.inputTokens !== undefined || breakdown.outputTokens !== undefined)
                                            ? breakdown : undefined);
                                }
                            }
                        } catch (_) {
                            try { await cloned.body?.cancel(); } catch (_) {}
                        }
                    })();
                }

                await endpoint.markSuccess(key);
                return response;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                await endpoint.markFailure(key);
                attempts++;
                this.logger.debug(`Key ${key.slice(0, 8)}... error: ${lastError.message}`);
            }
        }

        if (lastError) {
            this.logger.error(`Endpoint ${baseUrl} all keys failed: ${lastError.message}`);
        }
        return null;
    }

    // ------------------------------------------------------------------------
    // 流式响应包装：截取 SSE 流，提取 usage 信息
    // ------------------------------------------------------------------------
    private wrapStreamResponse(
        response: Response,
        modelName: string,
        key: string,
        endpoint: EndpointManager,
        onComplete?: (result: { status: number; totalTokens?: number; error?: string }) => void,
    ): Response {
        let streamBuffer = "";
        let lastUsage: { totalTokens: number; usageObj: any } | null = null;
        const tokenStore = this.tokenStore;
        const decoder = new TextDecoder();
        const self = this;

        const inspectLine = (line: string) => {
            const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
            if (!normalized.startsWith("data: ") || normalized === "data: [DONE]") return;
            try {
                const json = JSON.parse(normalized.slice(6));
                const usage = self.findUsageObject(json);
                if (usage && typeof usage === "object") {
                    let totalTokens: number | undefined;
                    if (typeof usage.total_tokens === "number") {
                        totalTokens = usage.total_tokens;
                    } else if (typeof usage.input_tokens === "number" || typeof usage.output_tokens === "number") {
                        totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
                    } else if (typeof usage.prompt_tokens === "number" || typeof usage.completion_tokens === "number") {
                        totalTokens = (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
                    }
                    if (totalTokens !== undefined) {
                        lastUsage = { totalTokens, usageObj: usage };
                    }
                }
            } catch {
                // 非 JSON 行，忽略
            }
        };

        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                // 按行解析 SSE 数据帧
                streamBuffer += decoder.decode(chunk, { stream: true });
                const lines = streamBuffer.split("\n");
                // 最后一行可能不完整，保留到下次
                streamBuffer = lines.pop() || "";

                for (const line of lines) inspectLine(line);
                // 原样转发 chunk 给客户端
                controller.enqueue(chunk);
            },
            async flush() {
                streamBuffer += decoder.decode();
                if (streamBuffer) inspectLine(streamBuffer);
                // 流结束后记录 token 用量
                if (lastUsage) {
                    const breakdown = self.extractTokenBreakdown(lastUsage.usageObj);
                    tokenStore.record(modelName, lastUsage.totalTokens,
                        (breakdown.inputTokens !== undefined || breakdown.outputTokens !== undefined)
                            ? breakdown : undefined);
                    self.logger.info(`Stream token stats: ${modelName} = ${lastUsage.totalTokens} tokens`);
                }
                await endpoint.markSuccess(key);
                onComplete?.({ status: response.status, totalTokens: lastUsage?.totalTokens });
            },
        });

        // 启动管道：上游响应 → TransformStream → 下游 Readable
        response.body!.pipeTo(writable).catch(async (e) => {
            await endpoint.markFailure(key);
            const message = e?.message || String(e);
            onComplete?.({ status: 502, totalTokens: lastUsage?.totalTokens, error: message });
            self.logger.error(`Stream pipe error: ${message}`);
        });

        return new Response(readable, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    private setAuthHeader(headers: Headers, key: string, baseUrl: string): void {
        if (baseUrl.includes("openai") || baseUrl.includes("azure")) {
            headers.set("Authorization", `Bearer ${key}`);
        } else if (baseUrl.includes("anthropic")) {
            headers.delete("authorization");
            headers.set("x-api-key", key);
            headers.set("anthropic-version", "2023-06-01");
        } else if (baseUrl.includes("googleapis") || baseUrl.includes("generativelanguage")) {
            // Gemini 通常使用查询参数
        } else {
            headers.set("Authorization", `Bearer ${key}`);
        }
    }

    private buildUpstreamUrl(baseUrl: string, requestPath: string): URL {
        const upstreamUrl = new URL(baseUrl);
        const basePath = upstreamUrl.pathname.replace(/\/$/, "");
        let suffix = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
        if (basePath.endsWith("/v1") && suffix.startsWith("/v1/")) {
            suffix = suffix.slice(3);
        }
        upstreamUrl.pathname = basePath && basePath !== "/"
            ? `${basePath}${suffix}`
            : suffix;
        return upstreamUrl;
    }

    private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalLen += value.length;
            if (totalLen > this.maxRequestBodyBytes) {
                await reader.cancel();
                throw new RequestBodyTooLargeError();
            }
            chunks.push(value);
        }
        const buffer = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        return buffer;
    }

    private findUsageObject(payload: any): any {
        return payload?.usage ?? payload?.response?.usage;
    }

    private recordRequestOutcome(context: RequestContext, status: number): void {
        if (context.record) return;
        context.record = this.requestLogStore.record({
            timestamp: context.startedAt,
            originalModel: context.originalModel || "",
            resolvedModel: context.resolvedModel || context.originalModel || "",
            path: context.path,
            status,
            durationMs: Math.max(0, Date.now() - context.startedAt),
            totalTokens: context.totalTokens,
            upstreamBaseUrl: context.upstreamBaseUrl,
            stream: context.stream,
            retryCount: Math.max(0, context.attempts - 1),
            error: context.error,
        });
    }

    /** 从上游 API usage 对象中提取分项 token */
    private extractTokenBreakdown(usage: any): {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
    } {
        if (!usage || typeof usage !== "object") return {};

        // OpenAI 格式: prompt_tokens, completion_tokens, prompt_tokens_details.cached_tokens
        if (typeof usage.prompt_tokens === "number") {
            return {
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens ?? 0,
                cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? undefined,
                cacheWriteTokens: undefined,
            };
        }

        // Anthropic 格式: input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
        if (typeof usage.input_tokens === "number") {
            return {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens ?? 0,
                cacheReadTokens: usage.cache_read_input_tokens ?? undefined,
                cacheWriteTokens: usage.cache_creation_input_tokens ?? undefined,
            };
        }

        // 其他格式：仅记录总量
        return {};
    }

    // ------------------------------------------------------------------------
    // 管理接口 — 运行时状态
    // ------------------------------------------------------------------------
    async handleAdmin(req: Request): Promise<Response> {
        const url = new URL(req.url);

        if (url.pathname === "/admin/status" && req.method === "GET") {
            const status = await this.getFullStatus();
            return new Response(JSON.stringify(status, null, 2), {
                headers: { "content-type": "application/json" },
            });
        }

        if (url.pathname === "/admin/request-logs" && req.method === "GET") {
            const afterParam = url.searchParams.get("after");
            const limitParam = url.searchParams.get("limit");
            const statusParam = url.searchParams.get("status");
            const after = afterParam === null ? undefined : Number(afterParam);
            const limit = limitParam === null ? undefined : Number(limitParam);
            const status = statusParam === null ? undefined : Number(statusParam);
            if ((after !== undefined && (!Number.isInteger(after) || after < 0)) ||
                (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) ||
                (status !== undefined && (!Number.isInteger(status) || status < 100 || status > 599))) {
                return new Response(JSON.stringify({ error: "Invalid request log query" }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                });
            }
            const result = this.requestLogStore.query({
                after,
                limit,
                status,
                model: url.searchParams.get("model") || undefined,
                path: url.searchParams.get("path") || undefined,
            });
            return new Response(JSON.stringify({
                records: result.records,
                latest_id: result.latestId,
            }), { headers: { "content-type": "application/json" } });
        }

        if (url.pathname === "/admin/dashboard-summary" && req.method === "GET") {
            const windowStr = url.searchParams.get("window") || "24h";
            const windowMap: Record<string, number> = {
                "1h": 3_600_000,
                "5h": 18_000_000,
                "24h": 86_400_000,
                "1d": 86_400_000,
                "7d": 604_800_000,
                "30d": 2_592_000_000,
            };
            const windowMs = windowMap[windowStr];
            if (!windowMs) {
                return new Response(JSON.stringify({ error: "Invalid dashboard window" }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                });
            }
            const requests = this.requestLogStore.summary(windowMs);
            const tokens = this.tokenStore.query(undefined, windowMs);
            const cost = this.calculateCostData(windowMs);
            const runtime = await this.getFullStatus();
            return new Response(JSON.stringify({
                window: windowStr,
                request_count: requests.requestCount,
                error_count: requests.errorCount,
                success_rate: requests.successRate,
                p95_latency_ms: requests.p95LatencyMs,
                total_tokens: tokens.totalTokens,
                total_cost_usd: cost.totalCostUsd,
                active_keys: runtime._summary.active_keys,
                total_keys: runtime._summary.total_keys,
                cooling_keys: runtime._summary.cooling_keys,
                available_endpoints: runtime._summary.available_endpoints,
                total_endpoints: runtime._summary.endpoints,
                timeline: requests.timeline,
                models: requests.models,
            }), { headers: { "content-type": "application/json" } });
        }

        if (url.pathname === "/admin/token-stats" && req.method === "GET") {
            const model = url.searchParams.get("model") || undefined;
            const windowStr = url.searchParams.get("window") || "1d";

            const windowMap: Record<string, number> = {
                "1h": 3600000,
                "5h": 18000000,
                "1d": 86400000,
                "3d": 259200000,
                "7d": 604800000,
                "30d": 2592000000,
            };

            const windowMs = windowMap[windowStr] ?? windowMap["1d"];
            const stats = this.tokenStore.query(model, windowMs);

            return new Response(JSON.stringify({
                model: model ?? "all",
                window: windowStr,
                total_tokens: stats.totalTokens,
                request_count: stats.requestCount,
            }), { headers: { "content-type": "application/json" } });
        }

        // 按分钟 Token 统计（用于前端分钟级图表）
        if (url.pathname === "/admin/token-stats/minutely" && req.method === "GET") {
            const model = url.searchParams.get("model") || undefined;
            const minutes = Math.min(Math.max(parseInt(url.searchParams.get("minutes") || "60"), 1), 1440);
            const minutely = this.tokenStore.queryMinutely(model, minutes);
            return new Response(JSON.stringify(minutely), {
                headers: { "content-type": "application/json" },
            });
        }

        // 按小时 Token 统计（用于前端图表）
        if (url.pathname === "/admin/token-stats/hourly" && req.method === "GET") {
            const model = url.searchParams.get("model") || undefined;
            const hours = Math.min(Math.max(parseInt(url.searchParams.get("hours") || "24"), 1), 168);
            const hourly = this.tokenStore.queryHourly(model, hours);
            return new Response(JSON.stringify(hourly), {
                headers: { "content-type": "application/json" },
            });
        }

        // 按日 Token 统计（用于前端图表）
        if (url.pathname === "/admin/token-stats/daily" && req.method === "GET") {
            const model = url.searchParams.get("model") || undefined;
            const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "7"), 1), 90);
            const daily = this.tokenStore.queryDaily(model, days);
            return new Response(JSON.stringify(daily), {
                headers: { "content-type": "application/json" },
            });
        }

        // 各模型汇总统计（用于前端饼图）
        if (url.pathname === "/admin/token-stats/summary" && req.method === "GET") {
            const windowMs = parseInt(url.searchParams.get("window") || "") || 86400000;
            const summary = this.tokenStore.queryModelSummary(windowMs);
            return new Response(JSON.stringify(summary), {
                headers: { "content-type": "application/json" },
            });
        }

        // 成本统计端点 — 基于目录定价计算 USD 成本
        if (url.pathname === "/admin/token-stats/cost" && req.method === "GET") {
            const model = url.searchParams.get("model") || undefined;
            const windowStr = url.searchParams.get("window") || "7d";

            const windowMap: Record<string, number> = {
                "1h": 3600000, "5h": 18000000, "1d": 86400000,
                "3d": 259200000, "7d": 604800000, "30d": 2592000000,
            };
            const windowMs = windowMap[windowStr] ?? windowMap["7d"];

            const cost = this.calculateCostData(windowMs, model);
            return new Response(JSON.stringify({
                window: windowStr,
                model: model ?? "all",
                total_cost_usd: cost.totalCostUsd,
                models: cost.models,
            }), { headers: { "content-type": "application/json" } });
        }

        if (url.pathname === "/admin/add-key" && req.method === "POST") {
            try {
                const { model_pattern, base_url, key } = await req.json();
                if (!model_pattern || !base_url || !key) {
                    return new Response("Missing model_pattern, base_url or key", { status: 400 });
                }

                let targetConfig = null;
                for (const entry of this.modelConfigs) {
                    if (this.matchModelPattern(model_pattern, entry.matcher)) {
                        targetConfig = entry;
                        break;
                    }
                }
                if (!targetConfig && this.defaultConfig) {
                    targetConfig = this.defaultConfig;
                }
                if (!targetConfig) {
                    return new Response(`Model pattern ${model_pattern} not found`, { status: 404 });
                }

                let targetEndpoint: EndpointManager | null = null;
                for (const [ep, bUrl] of targetConfig.baseUrlMap.entries()) {
                    if (bUrl === base_url) {
                        targetEndpoint = ep;
                        break;
                    }
                }
                if (!targetEndpoint) {
                    return new Response(`Base URL ${base_url} not found for model ${model_pattern}`, { status: 404 });
                }

                await targetEndpoint.addKey(key);
                return new Response("OK", { status: 200 });
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return new Response(`Invalid request: ${errMsg}`, { status: 400 });
            }
        }

        if (url.pathname === "/admin/remove-key" && req.method === "POST") {
            try {
                const { model_pattern, base_url, key } = await req.json();
                if (!model_pattern || !base_url || !key) {
                    return new Response("Missing model_pattern, base_url or key", { status: 400 });
                }

                let targetConfig = null;
                for (const entry of this.modelConfigs) {
                    if (this.matchModelPattern(model_pattern, entry.matcher)) {
                        targetConfig = entry;
                        break;
                    }
                }
                if (!targetConfig && this.defaultConfig) {
                    targetConfig = this.defaultConfig;
                }
                if (!targetConfig) {
                    return new Response(`Model pattern ${model_pattern} not found`, { status: 404 });
                }

                let targetEndpoint: EndpointManager | null = null;
                for (const [ep, bUrl] of targetConfig.baseUrlMap.entries()) {
                    if (bUrl === base_url) {
                        targetEndpoint = ep;
                        break;
                    }
                }
                if (!targetEndpoint) {
                    return new Response(`Base URL ${base_url} not found for model ${model_pattern}`, { status: 404 });
                }

                await targetEndpoint.removeKey(key);
                // 持久化到 config.yaml，防止重启后恢复
                await this.removeKeyFromConfig(model_pattern, base_url, key);
                return new Response("OK", { status: 200 });
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return new Response(`Invalid request: ${errMsg}`, { status: 400 });
            }
        }

        return new Response("Not Found", { status: 404 });
    }

    private calculateCostData(windowMs: number, model?: string): {
        totalCostUsd: number;
        models: Array<Record<string, unknown>>;
    } {
        const summary = this.tokenStore.queryModelSummary(windowMs);
        const models = summary
            .filter(s => model ? s.model === model : true)
            .map(s => {
                const hasBreakdown = s.inputTokens !== undefined || s.outputTokens !== undefined;
                const costInfo = this.catalog.calculateCost(s.model, s.totalTokens,
                    hasBreakdown ? {
                        input: s.inputTokens,
                        output: s.outputTokens,
                        cacheRead: s.cacheReadTokens,
                        cacheWrite: s.cacheWriteTokens,
                    } : undefined);
                return {
                    model: s.model,
                    total_tokens: s.totalTokens,
                    input_tokens: s.inputTokens,
                    output_tokens: s.outputTokens,
                    cache_read_tokens: s.cacheReadTokens,
                    cache_write_tokens: s.cacheWriteTokens,
                    request_count: s.requestCount,
                    cost_usd: costInfo.hasPricing ? Math.round(costInfo.cost * 10_000) / 10_000 : null,
                    input_cost_usd: costInfo.inputCost !== undefined
                        ? Math.round(costInfo.inputCost * 1_000_000) / 1_000_000
                        : null,
                    output_cost_usd: costInfo.outputCost !== undefined
                        ? Math.round(costInfo.outputCost * 1_000_000) / 1_000_000
                        : null,
                    cache_read_cost_usd: costInfo.cacheReadCost !== undefined
                        ? Math.round(costInfo.cacheReadCost * 1_000_000) / 1_000_000
                        : null,
                    has_pricing: costInfo.hasPricing,
                    pricing: costInfo.hasPricing ? this.catalog.getPricing(s.model) : null,
                };
            });
        const total = models.reduce((sum, item) => sum + (typeof item.cost_usd === "number" ? item.cost_usd : 0), 0);
        return {
            totalCostUsd: Math.round(total * 10_000) / 10_000,
            models,
        };
    }

    /** 运行时向端点池添加 Key */
    addPoolKey(poolName: string, key: string): EndpointManager | null {
        const manager = this.poolCache.get(poolName);
        if (manager) {
            manager.addKey(key);
            return manager;
        }
        return null;
    }

    /** 运行时从端点池删除 Key */
    removePoolKey(poolName: string, key: string): EndpointManager | null {
        const manager = this.poolCache.get(poolName);
        if (manager) {
            manager.removeKey(key);
            return manager;
        }
        return null;
    }

    /** 获取端点池 Key 运行时状态 */
    getPoolKeyStatus(poolName: string): Array<{ value: string; active: boolean; cooldown: boolean }> {
        const manager = this.poolCache.get(poolName);
        return manager ? manager.getKeyStatuses() : [];
    }

    /** 从 config.yaml 删除 key 并持久化（避免重启恢复） */
    async removeKeyFromConfig(modelPattern: string, baseUrl: string, keyValue: string): Promise<void> {
        try {
            const config = await loadConfig(this.configPath);
            const model = config.models.find(model => model.name === modelPattern);
            let changed = false;
            if (model?.endpoints) {
                for (const ep of model.endpoints) {
                    if (ep.base_url === baseUrl && ep.keys.includes(keyValue)) {
                        ep.keys = ep.keys.filter(k => k !== keyValue);
                        changed = true;
                    }
                }
            }
            if (model?.endpoint_refs && config.endpoint_pool) {
                for (const refName of model.endpoint_refs) {
                    const ep = config.endpoint_pool[refName];
                    if (ep?.base_url === baseUrl && ep.keys.includes(keyValue)) {
                        ep.keys = ep.keys.filter(k => k !== keyValue);
                        changed = true;
                    }
                }
            }
            if (changed) {
                await saveConfig(this.configPath, config);
                this.logger.info(`Key ${keyValue.slice(0, 8)}... removed from config file`);
            }
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            this.logger.error(`Failed to remove key: ${m}`);
        }
    }

    /** 获取指定模型+端点的 key 运行时状态 */
    getKeyRuntimeStatus(modelPattern: string, baseUrl: string): Array<{ value: string; active: boolean; cooldown: boolean }> {
        let targetEntry = null;
        for (const entry of this.modelConfigs) {
            if (this.matchModelPattern(modelPattern, entry.matcher)) { targetEntry = entry; break; }
        }
        if (!targetEntry && this.defaultConfig) targetEntry = this.defaultConfig;
        if (!targetEntry) return [];
        for (const [ep, bUrl] of targetEntry.baseUrlMap.entries()) {
            if (bUrl === baseUrl) {
                return ep.getKeyStatuses();
            }
        }
        return [];
    }

    async getFullStatus(): Promise<any> {
        const status: any = {};
        const seenManagers = new Set<EndpointManager>();
        let index = 0;
        let totalUniqueKeys = 0, totalUniqueActive = 0, availableEndpoints = 0;

        for (const entry of this.modelConfigs) {
            const key = `[${index}] ${entry.matcher.pattern} (${entry.matcher.type})`;
            status[key] = [];
            for (const endpoint of entry.endpoints) {
                const baseUrl = entry.baseUrlMap.get(endpoint);
                const epStatus = await endpoint.getStatus();
                status[key].push({
                    base_url: baseUrl,
                    weight: epStatus.weight,
                    keys: epStatus,
                    type: entry.config.type || [],
                    redirects: entry.config.redirects?.map(r => ({ pre: r.pre, weight: r.weight, to: r.to })) || [],
                });
                // 去重计数（共享 EndpointManager 只计一次）
                if (!seenManagers.has(endpoint)) {
                    seenManagers.add(endpoint);
                    totalUniqueKeys += epStatus.total;
                    totalUniqueActive += epStatus.active;
                    if (epStatus.active > 0) availableEndpoints++;
                }
            }
            if (entry.config.endpoint_refs && entry.config.endpoint_refs.length > 0) {
                status[key]._refs = entry.config.endpoint_refs;
            }
            index++;
        }
        if (this.defaultConfig && this.defaultWasUserDefined) {
            status["* (default)"] = [];
            for (const endpoint of this.defaultConfig.endpoints) {
                const baseUrl = this.defaultConfig.baseUrlMap.get(endpoint);
                const epStatus = await endpoint.getStatus();
                status["* (default)"].push({
                    base_url: baseUrl,
                    weight: epStatus.weight,
                    keys: epStatus,
                    type: this.defaultConfig.config.type || [],
                    redirects: this.defaultConfig.config.redirects?.map(r => ({ pre: r.pre, weight: r.weight, to: r.to })) || [],
                });
                if (!seenManagers.has(endpoint)) {
                    seenManagers.add(endpoint);
                    totalUniqueKeys += epStatus.total;
                    totalUniqueActive += epStatus.active;
                    if (epStatus.active > 0) availableEndpoints++;
                }
            }
            if (this.defaultConfig.config.endpoint_refs?.length) {
                status["* (default)"]._refs = this.defaultConfig.config.endpoint_refs;
            }
        }
        status._summary = {
            models: this.modelConfigs.length + (this.defaultConfig && this.defaultWasUserDefined ? 1 : 0),
            endpoints: seenManagers.size,
            total_keys: totalUniqueKeys,
            active_keys: totalUniqueActive,
            cooling_keys: totalUniqueKeys - totalUniqueActive,
            available_endpoints: availableEndpoints,
        };
        return status;
    }
}
