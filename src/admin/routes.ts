// src/admin/routes.ts
// 管理 API 路由处理 — 包含现有端点和新 CRUD 端点

import { ModelRouter } from "../model_router.ts";
import { loadConfig, parseConfig, saveConfig, findModelIndex, isModelNameDuplicate, validateModelConfig, validateRouterConfig, getModelsFromConfig } from "../config.ts";
import type { RouterConfig, ModelConfig, EndpointConfig } from "../types.ts";
import { getAdminPageResponse } from "./page.ts";
import { getAdminStylesResponse } from "./styles.ts";
import { getAdminScriptResponse } from "./script.ts";

/** 处理所有 /admin/* 路由，非 admin 路由返回 null */
export async function handleAdminRoutes(
    req: Request,
    router: ModelRouter,
    configPath: string
): Promise<Response | null> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // 1. 管理页面 HTML（无需鉴权）
    if ((path === "/admin" || path === "/admin/") && method === "GET") {
        return getAdminPageResponse();
    }
    if (path === "/admin/assets/admin.css" && method === "GET") {
        return getAdminStylesResponse();
    }
    if (path === "/admin/assets/admin.js" && method === "GET") {
        return getAdminScriptResponse();
    }

    // 2. 鉴权检查 API（无需鉴权）
    if (path === "/admin/auth-check" && method === "GET") {
        return new Response(JSON.stringify({
            required: router.authKeys.length > 0
        }), { headers: { "content-type": "application/json" } });
    }

    // ---------- 以下路由需要鉴权 ----------
    if (!router.isAuthenticated(req)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }

    // 3. 配置读写
    if (path === "/admin/config" && method === "GET") {
        try {
            const raw = await Deno.readTextFile(configPath);
            return new Response(raw, { headers: { "content-type": "text/yaml; charset=utf-8" } });
        } catch (e) {
            return new Response(`Error reading config: ${e}`, { status: 500 });
        }
    }
    if (path === "/admin/config" && method === "POST") {
        try {
            const body = await req.text();
            const config = parseConfig(body);
            const validationError = validateRouterConfig(config);
            if (validationError) {
                return new Response(JSON.stringify({ error: validationError }), {
                    status: 400,
                    headers: { "content-type": "application/json" },
                });
            }
            await saveConfig(configPath, config);
            await router.reload(getModelsFromConfig(config), config.endpoint_pool, config);
            return new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } });
        } catch (e) {
            return new Response(JSON.stringify({ error: `Invalid config: ${e}` }), { status: 400, headers: { "content-type": "application/json" } });
        }
    }

    // 4. 现有端点 + 新 Token 图表端点（由 ModelRouter 处理）
    if (
        (path === "/admin/status" && method === "GET") ||
        (path === "/admin/request-logs" && method === "GET") ||
        (path === "/admin/dashboard-summary" && method === "GET") ||
        (path.startsWith("/admin/token-stats") && method === "GET") ||
        (path === "/admin/add-key" && method === "POST") ||
        (path === "/admin/remove-key" && method === "POST")
    ) {
        return router.handleAdmin(req);
    }

    // 5. 端点池 CRUD（/admin/api/endpoint-pool/*）
    if (path.startsWith("/admin/api/endpoint-pool")) {
        return handlePoolRoutes(req, router, configPath);
    }

    // 6. 模型/端点/Key CRUD（/admin/api/models/*）
    if (path.startsWith("/admin/api/")) {
        return handleCrudRoutes(req, router, configPath);
    }

    return null; // 非 admin 路由
}

// ============================================================================
// CRUD 路由处理
// ============================================================================

async function handleCrudRoutes(
    req: Request,
    router: ModelRouter,
    configPath: string
): Promise<Response | null> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // 匹配: /admin/api/models/:name/endpoints/:idx/keys/:keyIdx
    let m = path.match(/^\/admin\/api\/models\/([^/]+)\/endpoints\/(\d+)\/keys\/(\d+)$/);
    if (m) {
        const modelName = decodeURIComponent(m[1]);
        const endpointIdx = parseInt(m[2]);
        const keyIdx = parseInt(m[3]);
        return handleKeyCrud(req, method, modelName, endpointIdx, keyIdx, configPath, router);
    }

    // 匹配: /admin/api/models/:name/endpoints/:idx/keys
    m = path.match(/^\/admin\/api\/models\/([^/]+)\/endpoints\/(\d+)\/keys$/);
    if (m) {
        const modelName = decodeURIComponent(m[1]);
        const endpointIdx = parseInt(m[2]);
        return handleKeyListCrud(req, method, modelName, endpointIdx, configPath, router);
    }

    // 匹配: /admin/api/models/:name/endpoints/:idx
    m = path.match(/^\/admin\/api\/models\/([^/]+)\/endpoints\/(\d+)$/);
    if (m) {
        const modelName = decodeURIComponent(m[1]);
        const endpointIdx = parseInt(m[2]);
        return handleEndpointItemCrud(req, method, modelName, endpointIdx, configPath, router);
    }

    // 匹配: /admin/api/models/:name/endpoints
    m = path.match(/^\/admin\/api\/models\/([^/]+)\/endpoints$/);
    if (m) {
        const modelName = decodeURIComponent(m[1]);
        return handleEndpointListCrud(req, method, modelName, configPath, router);
    }

    // 匹配: /admin/api/models/:name
    m = path.match(/^\/admin\/api\/models\/([^/]+)$/);
    if (m) {
        const modelName = decodeURIComponent(m[1]);
        return handleModelItemCrud(req, method, modelName, configPath, router);
    }

    // 匹配: /admin/api/models
    if (path === "/admin/api/models") {
        return handleModelListCrud(req, method, configPath, router);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "content-type": "application/json" } });
}

// ============================================================================
// 端点池 CRUD
// ============================================================================

async function handlePoolRoutes(
    req: Request,
    router: ModelRouter,
    configPath: string
): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // GET  /admin/api/endpoint-pool          → 列出所有池端点
    if (path === "/admin/api/endpoint-pool" && method === "GET") {
        const config = await readConfig(configPath);
        const pool = config.endpoint_pool || {};
        const result = Object.entries(pool).map(([name, ep]) => ({
            name,
            base_url: ep.base_url,
            key_count: ep.keys?.length || 0,
            weight: ep.weight || 1,
            timeout: ep.timeout,
            max_retries: ep.max_retries,
            referenced_by: getPoolReferences(config, name),
            runtime: summarizePoolRuntime(router, name),
        }));
        return jsonResponse(result);
    }

    // POST /admin/api/endpoint-pool          → 创建池端点
    if (path === "/admin/api/endpoint-pool" && method === "POST") {
        const config = await readConfig(configPath);
        try {
            const body = await req.json();
            const poolName = typeof body.name === "string" ? body.name.trim() : "";
            if (!poolName) return jsonError("端点池名称不能为空");
            config.endpoint_pool = config.endpoint_pool || {};
            if (config.endpoint_pool[poolName]) {
                return jsonError(`端点池 '${poolName}' 已存在`, 409);
            }
            const endpoint: EndpointConfig = {
                base_url: body.base_url,
                keys: body.keys ?? [],
                weight: body.weight ?? 1,
                timeout: body.timeout,
                max_retries: body.max_retries,
            };
            config.endpoint_pool[poolName] = endpoint;
            await writeAndReload(configPath, config, router);
            return jsonResponse({ name: poolName, ...endpoint }, 201);
        } catch (err) {
            return jsonError(`请求体无效: ${errMsg(err)}`);
        }
    }

    // GET  /admin/api/endpoint-pool/:name    → 获取单个池端点 + Key 运行时状态
    let m = path.match(/^\/admin\/api\/endpoint-pool\/([^/]+)$/);
    if (m && method === "GET") {
        const poolName = decodeURIComponent(m[1]);
        const config = await readConfig(configPath);
        const ep = config.endpoint_pool?.[poolName];
        if (!ep) return jsonError(`端点池 '${poolName}' 未找到`, 404);
        const statuses = router.getPoolKeyStatus(poolName);
        const statusMap = new Map(statuses.map(s => [s.value, s]));
        const keys = (ep.keys || []).map((k, i) => {
            const st = statusMap.get(k);
            return {
                index: i,
                key_preview: k.length > 12 ? k.substring(0, 12) + "..." : k,
                active: st ? st.active : false,
                cooldown: st ? st.cooldown : false,
            };
        });
        return jsonResponse({
            name: poolName,
            base_url: ep.base_url,
            keys,
            weight: ep.weight || 1,
            timeout: ep.timeout,
            max_retries: ep.max_retries,
            referenced_by: getPoolReferences(config, poolName),
        });
    }

    // PUT/DELETE /admin/api/endpoint-pool/:name → 更新或删除池端点
    if (m && method === "PUT") {
        const poolName = decodeURIComponent(m[1]);
        const config = await readConfig(configPath);
        const current = config.endpoint_pool?.[poolName];
        if (!current) return jsonError(`端点池 '${poolName}' 未找到`, 404);
        try {
            const body = await req.json();
            const updated: EndpointConfig = {
                base_url: body.base_url,
                keys: body.keys !== undefined ? body.keys : current.keys,
                weight: body.weight !== undefined ? body.weight : (current.weight ?? 1),
            };
            const timeout = body.timeout !== undefined ? body.timeout : current.timeout;
            const maxRetries = body.max_retries !== undefined ? body.max_retries : current.max_retries;
            if (timeout !== null && timeout !== undefined) updated.timeout = timeout;
            if (maxRetries !== null && maxRetries !== undefined) updated.max_retries = maxRetries;
            config.endpoint_pool![poolName] = updated;
            await writeAndReload(configPath, config, router);
            return jsonResponse({ name: poolName, ...updated });
        } catch (err) {
            return jsonError(`请求体无效: ${errMsg(err)}`);
        }
    }
    if (m && method === "DELETE") {
        const poolName = decodeURIComponent(m[1]);
        const config = await readConfig(configPath);
        if (!config.endpoint_pool?.[poolName]) {
            return jsonError(`端点池 '${poolName}' 未找到`, 404);
        }
        const references = getPoolReferences(config, poolName);
        if (references.length > 0) {
            return jsonError(`端点池 '${poolName}' 正被模型引用: ${references.join(", ")}`, 409);
        }
        delete config.endpoint_pool[poolName];
        await writeAndReload(configPath, config, router);
        return new Response(null, { status: 204 });
    }

    // POST /admin/api/endpoint-pool/:name/keys → 添加 Key
    m = path.match(/^\/admin\/api\/endpoint-pool\/([^/]+)\/keys$/);
    if (m && method === "POST") {
        const poolName = decodeURIComponent(m[1]);
        const config = await readConfig(configPath);
        const ep = config.endpoint_pool?.[poolName];
        if (!ep) return jsonError(`端点池 '${poolName}' 未找到`, 404);
        try {
            const body = await req.json();
            if (!body.key || typeof body.key !== "string" || body.key.trim() === "") {
                return jsonError("Key 不能为空");
            }
            ep.keys = ep.keys || [];
            if (ep.keys.includes(body.key.trim())) {
                return jsonError("Key 已存在");
            }
            ep.keys.push(body.key.trim());
            await writeAndReload(configPath, config, router);
            return jsonResponse({ key: body.key.trim(), index: ep.keys.length - 1 }, 201);
        } catch (err) {
            return jsonError(`请求体无效: ${errMsg(err)}`);
        }
    }

    // DELETE /admin/api/endpoint-pool/:name/keys/:idx → 删除 Key
    m = path.match(/^\/admin\/api\/endpoint-pool\/([^/]+)\/keys\/(\d+)$/);
    if (m && method === "DELETE") {
        const poolName = decodeURIComponent(m[1]);
        const keyIdx = parseInt(m[2]);
        const config = await readConfig(configPath);
        const ep = config.endpoint_pool?.[poolName];
        if (!ep) return jsonError(`端点池 '${poolName}' 未找到`, 404);
        if (!ep.keys || keyIdx >= ep.keys.length) {
            return jsonError(`Key 索引 ${keyIdx} 超出范围`, 404);
        }
        ep.keys.splice(keyIdx, 1);
        await writeAndReload(configPath, config, router);
        return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "content-type": "application/json" } });
}

// ============================================================================
// 辅助函数
// ============================================================================

async function readConfig(configPath: string): Promise<RouterConfig> {
    return await loadConfig(configPath);
}

async function writeAndReload(configPath: string, config: RouterConfig, router: ModelRouter): Promise<void> {
    const validationError = validateRouterConfig(config);
    if (validationError) throw new Error(validationError);
    await saveConfig(configPath, config);
    await router.reload(getModelsFromConfig(config), config.endpoint_pool, config);
}

function getPoolReferences(config: RouterConfig, poolName: string): string[] {
    return getModelsFromConfig(config)
        .filter(model => model.endpoint_refs?.includes(poolName))
        .map(model => model.name);
}

function summarizePoolRuntime(router: ModelRouter, poolName: string): { total: number; active: number; cooldown: number } {
    const statuses = router.getPoolKeyStatus(poolName);
    return {
        total: statuses.length,
        active: statuses.filter(status => status.active).length,
        cooldown: statuses.filter(status => status.cooldown).length,
    };
}

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function jsonError(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

// ============================================================================
// 模型 CRUD
// ============================================================================

/** /admin/api/models — 列出所有模型或创建新模型 */
async function handleModelListCrud(
    req: Request,
    method: string,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);

    switch (method) {
        case "GET": {
            const pool = config.endpoint_pool || {};
            const summary = models.map(m => {
                const directKeyCount = m.endpoints?.reduce((sum, ep) => sum + (ep.keys?.length || 0), 0) || 0;
                const poolKeyCount = m.endpoint_refs?.reduce((sum, ref) => sum + (pool[ref]?.keys?.length || 0), 0) || 0;
                return {
                    name: m.name,
                    endpoint_count: m.endpoints?.length || 0,
                    endpoint_ref_count: m.endpoint_refs?.length || 0,
                    direct_key_count: directKeyCount,
                    key_count: directKeyCount + poolKeyCount,
                    type: m.type || null,
                    redirect_count: m.redirects?.length || (m.redirect_to ? 1 : 0),
                    has_refs: !!(m.endpoint_refs && m.endpoint_refs.length > 0),
                };
            });
            return jsonResponse(summary);
        }
        case "POST": {
            try {
                const body: Partial<ModelConfig> = await req.json();
                const validationError = validateModelConfig(body);
                if (validationError) {
                    return jsonError(validationError);
                }
                if (isModelNameDuplicate(models, body.name!)) {
                    return jsonError(`模型名称 '${body.name}' 已存在`);
                }
                const newModel: ModelConfig = {
                    name: body.name!,
                    endpoints: body.endpoints || [],
                };
                if (body.type !== undefined) newModel.type = body.type;
                if (body.endpoint_refs !== undefined) newModel.endpoint_refs = body.endpoint_refs;
                // 清理 undefined 字段（stringify 不支持 undefined）
                if (body.cooldown_ms !== undefined) newModel.cooldown_ms = body.cooldown_ms;
                if (body.delete_after_failure_ms !== undefined) newModel.delete_after_failure_ms = body.delete_after_failure_ms;
                if (body.default_timeout !== undefined) newModel.default_timeout = body.default_timeout;
                if (body.default_max_retries !== undefined) newModel.default_max_retries = body.default_max_retries;
                if (body.redirects !== undefined) newModel.redirects = body.redirects;
                if (body.redirect_to !== undefined) newModel.redirect_to = body.redirect_to;
                if (body.headers !== undefined) newModel.headers = body.headers;
                models.push(newModel);
                config.models = models;
                await writeAndReload(configPath, config, router);
                return jsonResponse(newModel, 201);
            } catch (err) {
                return jsonError(`请求体无效: ${errMsg(err)}`);
            }
        }
        default:
            return jsonError("Method Not Allowed", 405);
    }
}

/** /admin/api/models/:name — 获取/更新/删除单个模型 */
async function handleModelItemCrud(
    req: Request,
    method: string,
    modelName: string,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);
    const idx = findModelIndex(models, modelName);

    if (idx === -1) {
        return jsonError(`模型 '${modelName}' 未找到`, 404);
    }

    switch (method) {
        case "GET": {
            return jsonResponse(models[idx]);
        }
        case "PUT": {
            try {
                const body = await req.json() as Record<string, unknown>;
                const updatedModel: ModelConfig = { ...models[idx] };
                const optionalFields = [
                    "type", "endpoints", "endpoint_refs", "cooldown_ms",
                    "delete_after_failure_ms", "default_timeout", "default_max_retries",
                    "redirect_to", "redirects", "headers",
                ] as const;
                for (const field of optionalFields) {
                    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
                    if (body[field] === null) {
                        delete (updatedModel as unknown as Record<string, unknown>)[field];
                    } else {
                        (updatedModel as unknown as Record<string, unknown>)[field] = body[field];
                    }
                }
                const validationError = validateModelConfig(updatedModel);
                if (validationError) {
                    return jsonError(validationError);
                }
                models[idx] = updatedModel;
                config.models = models;
                await writeAndReload(configPath, config, router);
                return jsonResponse(updatedModel);
            } catch (err) {
                return jsonError(`请求体无效: ${errMsg(err)}`);
            }
        }
        case "DELETE": {
            const referencedBy = models
                .filter(model => model.name !== modelName &&
                    (model.redirect_to === modelName || model.redirects?.some(rule => rule.to === modelName)))
                .map(model => model.name);
            if (referencedBy.length > 0) {
                return jsonError(`模型 '${modelName}' 正被重定向规则引用: ${referencedBy.join(", ")}`, 409);
            }
            models.splice(idx, 1);
            config.models = models;
            await writeAndReload(configPath, config, router);
            return new Response(null, { status: 204 });
        }
        default:
            return jsonError("Method Not Allowed", 405);
    }
}

// ============================================================================
// 端点 CRUD
// ============================================================================

/** /admin/api/models/:name/endpoints — 列出所有端点或添加新端点 */
async function handleEndpointListCrud(
    req: Request,
    method: string,
    modelName: string,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);
    const idx = findModelIndex(models, modelName);

    if (idx === -1) {
        return jsonError(`模型 '${modelName}' 未找到`, 404);
    }

    const model = models[idx];

    switch (method) {
        case "GET": {
            const endpoints = (model.endpoints || []).map((ep, i) => ({
                index: i,
                base_url: ep.base_url,
                keys_count: ep.keys?.length || 0,
                weight: ep.weight || 1,
                timeout: ep.timeout,
                max_retries: ep.max_retries,
            }));
            return jsonResponse(endpoints);
        }
        case "POST": {
            try {
                const body: Partial<EndpointConfig> = await req.json();
                if (!body.base_url || typeof body.base_url !== "string") {
                    return jsonError("端点 base_url 不能为空");
                }
                if (!model.endpoints) model.endpoints = [];
                const newEndpoint: EndpointConfig = {
                    base_url: body.base_url,
                    keys: body.keys ?? [],
                    weight: body.weight ?? 1,
                    timeout: body.timeout,
                    max_retries: body.max_retries,
                };
                model.endpoints.push(newEndpoint);
                config.models = models;
                await writeAndReload(configPath, config, router);
                return jsonResponse(newEndpoint, 201);
            } catch (err) {
                return jsonError(`请求体无效: ${errMsg(err)}`);
            }
        }
        default:
            return jsonError("Method Not Allowed", 405);
    }
}

/** /admin/api/models/:name/endpoints/:idx — 更新或删除端点 */
async function handleEndpointItemCrud(
    req: Request,
    method: string,
    modelName: string,
    endpointIdx: number,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);
    const idx = findModelIndex(models, modelName);

    if (idx === -1) {
        return jsonError(`模型 '${modelName}' 未找到`, 404);
    }

    const model = models[idx];
    if (!model.endpoints || endpointIdx >= model.endpoints.length) {
        return jsonError(`端点索引 ${endpointIdx} 超出范围`, 404);
    }

    switch (method) {
        case "PUT": {
            try {
                const body: Partial<EndpointConfig> = await req.json();
                if (!body.base_url || typeof body.base_url !== "string") {
                    return jsonError("端点 base_url 不能为空");
                }
                const updatedEndpoint: EndpointConfig = {
                    base_url: body.base_url,
                    keys: body.keys !== undefined ? body.keys : model.endpoints[endpointIdx].keys,
                    weight: body.weight !== undefined ? body.weight : (model.endpoints[endpointIdx].weight ?? 1),
                };
                const timeout = body.timeout !== undefined ? body.timeout : model.endpoints[endpointIdx].timeout;
                const maxRetries = body.max_retries !== undefined ? body.max_retries : model.endpoints[endpointIdx].max_retries;
                if (timeout !== null && timeout !== undefined) updatedEndpoint.timeout = timeout;
                if (maxRetries !== null && maxRetries !== undefined) updatedEndpoint.max_retries = maxRetries;
                model.endpoints[endpointIdx] = updatedEndpoint;
                config.models = models;
                await writeAndReload(configPath, config, router);
                return jsonResponse(updatedEndpoint);
            } catch (err) {
                return jsonError(`请求体无效: ${errMsg(err)}`);
            }
        }
        case "DELETE": {
            model.endpoints.splice(endpointIdx, 1);
            config.models = models;
            await writeAndReload(configPath, config, router);
            return new Response(null, { status: 204 });
        }
        default:
            return jsonError("Method Not Allowed", 405);
    }
}

// ============================================================================
// Key CRUD
// ============================================================================

/** /admin/api/models/:name/endpoints/:idx/keys — 列出所有 Key 或添加新 Key */
async function handleKeyListCrud(
    req: Request,
    method: string,
    modelName: string,
    endpointIdx: number,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);
    const idx = findModelIndex(models, modelName);

    if (idx === -1) {
        return jsonError(`模型 '${modelName}' 未找到`, 404);
    }

    const model = models[idx];
    if (!model.endpoints || endpointIdx >= model.endpoints.length) {
        return jsonError(`端点索引 ${endpointIdx} 超出范围`, 404);
    }

    const endpoint = model.endpoints[endpointIdx];

    switch (method) {
        case "GET": {
            // 从运行时获取 key 状态
            const statuses = router.getKeyRuntimeStatus(modelName, endpoint.base_url);
            const statusMap = new Map<string, { active: boolean; cooldown: boolean }>();
            for (const s of statuses) {
                statusMap.set(s.value, { active: s.active, cooldown: s.cooldown });
            }
            const keys = (endpoint.keys || []).map((k, i) => {
                const st = statusMap.get(k);
                return {
                    index: i,
                    key_preview: k.length > 12 ? k.substring(0, 12) + "..." : k,
                    active: st ? st.active : false,
                    cooldown: st ? st.cooldown : false,
                };
            });
            return jsonResponse(keys);
        }
        case "POST": {
            try {
                const body = await req.json();
                if (!body.key || typeof body.key !== "string" || body.key.trim() === "") {
                    return jsonError("Key 不能为空");
                }
                if (!endpoint.keys) endpoint.keys = [];
                if (endpoint.keys.includes(body.key.trim())) {
                    return jsonError("Key 已存在");
                }
                endpoint.keys.push(body.key.trim());
                config.models = models;
                await writeAndReload(configPath, config, router);
                // writeAndReload 已调用 router.reload() 重建运行时状态
                return jsonResponse({ key: body.key.trim(), index: endpoint.keys.length - 1 }, 201);
            } catch (err) {
                return jsonError(`请求体无效: ${errMsg(err)}`);
            }
        }
        default:
            return jsonError("Method Not Allowed", 405);
    }
}

/** /admin/api/models/:name/endpoints/:idx/keys/:keyIdx — 删除指定 Key */
async function handleKeyCrud(
    req: Request,
    method: string,
    modelName: string,
    endpointIdx: number,
    keyIdx: number,
    configPath: string,
    router: ModelRouter
): Promise<Response> {
    if (method !== "DELETE") {
        return jsonError("Method Not Allowed", 405);
    }

    const config = await readConfig(configPath);
    const models = getModelsFromConfig(config);
    const idx = findModelIndex(models, modelName);

    if (idx === -1) {
        return jsonError(`模型 '${modelName}' 未找到`, 404);
    }

    const model = models[idx];
    if (!model.endpoints || endpointIdx >= model.endpoints.length) {
        return jsonError(`端点索引 ${endpointIdx} 超出范围`, 404);
    }

    const endpoint = model.endpoints[endpointIdx];
    if (!endpoint.keys || keyIdx >= endpoint.keys.length) {
        return jsonError(`Key 索引 ${keyIdx} 超出范围`, 404);
    }

    const keyValue = endpoint.keys[keyIdx];
    endpoint.keys.splice(keyIdx, 1);
    config.models = models;
    await writeAndReload(configPath, config, router);
    // writeAndReload 已调用 router.reload() 重建运行时状态，无需额外同步

    return new Response(null, { status: 204 });
}
