// src/config.ts
// 配置文件加载与保存

import { parse, stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import type { RouterConfig, ModelConfig } from "./types.ts";

// ============================================================================
// 端点类型别名映射
// ============================================================================

/** 类别别名 → 具体端点路径的映射 */
export const TYPE_ALIAS_MAP: Record<string, string[]> = {
    "openai":         ["/v1/chat/completions"],
    "chat":           ["/v1/chat/completions"],
    "completions":    ["/v1/completions"],
    "embeddings":     ["/v1/embeddings"],
    "images":         ["/v1/images/generations", "/v1/images/edits", "/v1/images/variations"],
    "audio":          ["/v1/audio/transcriptions", "/v1/audio/translations", "/v1/audio/speech"],
    "moderations":    ["/v1/moderations"],
    "response":       ["/v1/responses"],
    "responses":      ["/v1/responses"],
    "claude":         ["/v1/messages"],
    "messages":       ["/v1/messages"],
};

/**
 * 解析模型的 type 配置，将别名展开为具体端点路径。
 * - 以 "/" 开头的值视为字面路径，直接保留
 * - 其他值在 TYPE_ALIAS_MAP 中查找，找到则展开，未找到则原样保留
 */
export function resolveModelTypes(types: string[] | undefined): string[] {
    if (!types || types.length === 0) return [];
    const resolved: string[] = [];
    for (const t of types) {
        if (t.startsWith("/")) {
            resolved.push(t);
        } else {
            const mapped = TYPE_ALIAS_MAP[t];
            if (mapped) {
                resolved.push(...mapped);
            } else {
                // 未知别名：原样保留（允许自定义扩展）
                resolved.push(t);
            }
        }
    }
    return resolved;
}

/** 读取并解析 YAML 配置文件 */
export async function loadConfig(path: string): Promise<RouterConfig> {
    const content = await Deno.readTextFile(path);
    return parseConfig(content);
}

/** 解析 YAML 配置文本 */
export function parseConfig(content: string): RouterConfig {
    const config = parse(content);
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("配置必须是 YAML 对象");
    }
    return config as RouterConfig;
}

/** 保存配置到 YAML 文件（原子写入，自动跳过 undefined 字段） */
export async function saveConfig(path: string, config: RouterConfig): Promise<void> {
    // JSON 序列化会移除 undefined 字段，避免 stringify 报错
    const clean = JSON.parse(JSON.stringify(config));
    const yaml = stringify(clean as Record<string, unknown>);
    const tmpPath = path + ".tmp";
    await Deno.writeTextFile(tmpPath, yaml);
    await Deno.rename(tmpPath, path);
}

/** 从配置中提取模型列表 */
export function getModelsFromConfig(config: RouterConfig): ModelConfig[] {
    return config.models || [];
}

/** 获取模型在列表中的索引，未找到返回 -1 */
export function findModelIndex(models: ModelConfig[], name: string): number {
    return models.findIndex(m => m.name === name);
}

/** 检查模型名是否已存在 */
export function isModelNameDuplicate(models: ModelConfig[], name: string): boolean {
    return models.some(m => m.name === name);
}

function validateEndpointConfig(endpoint: unknown, label: string): string | null {
    if (!endpoint || typeof endpoint !== "object" || Array.isArray(endpoint)) {
        return `${label} 必须是对象`;
    }
    const ep = endpoint as Record<string, unknown>;
    if (!ep.base_url || typeof ep.base_url !== "string") {
        return `${label} base_url 不能为空`;
    }
    if (!Array.isArray(ep.keys) || ep.keys.some(key => typeof key !== "string")) {
        return `${label} keys 必须是字符串数组`;
    }
    if (ep.weight !== undefined && (typeof ep.weight !== "number" || !Number.isFinite(ep.weight) || ep.weight <= 0)) {
        return `${label}权重必须是正数`;
    }
    if (ep.timeout !== undefined && (typeof ep.timeout !== "number" || !Number.isFinite(ep.timeout) || ep.timeout <= 0)) {
        return `${label} timeout 必须是正数`;
    }
    if (ep.max_retries !== undefined &&
        (typeof ep.max_retries !== "number" || !Number.isFinite(ep.max_retries) || ep.max_retries < 0)) {
        return `${label} max_retries 必须是非负数`;
    }
    return null;
}

/** 验证单个模型配置 */
export function validateModelConfig(model: Partial<ModelConfig>): string | null {
    if (!model.name || typeof model.name !== "string" || model.name.trim() === "") {
        return "模型名称不能为空";
    }
    if (model.name.trim() === "") {
        return "模型名称不能为空";
    }
    if (model.cooldown_ms !== undefined && (typeof model.cooldown_ms !== "number" || model.cooldown_ms < 0)) {
        return "冷却时间必须是非负整数";
    }
    if (model.delete_after_failure_ms !== undefined && (typeof model.delete_after_failure_ms !== "number" || model.delete_after_failure_ms < 0)) {
        return "持续失败删除时间必须是非负整数";
    }
    if (model.default_timeout !== undefined && (typeof model.default_timeout !== "number" || model.default_timeout <= 0)) {
        return "超时时间必须是正整数";
    }
    if (model.default_max_retries !== undefined && (typeof model.default_max_retries !== "number" || model.default_max_retries < 0)) {
        return "最大重试次数必须是非负整数";
    }
    if (model.endpoints) {
        if (!Array.isArray(model.endpoints)) return "endpoints 必须是数组";
        for (const ep of model.endpoints) {
            const error = validateEndpointConfig(ep, "端点");
            if (error) return error;
        }
    }
    if (model.endpoint_refs !== undefined &&
        (!Array.isArray(model.endpoint_refs) ||
            model.endpoint_refs.some(ref => typeof ref !== "string" || ref.trim() === ""))) {
        return "endpoint_refs 必须是非空字符串数组";
    }
    if (model.type !== undefined) {
        if (!Array.isArray(model.type)) {
            return "type 必须是字符串数组";
        }
        if (model.type.length === 0) {
            return "type 数组不能为空（若要允许所有端点，请移除该字段）";
        }
        for (const t of model.type) {
            if (typeof t !== "string" || t.trim() === "") {
                return "type 数组中的每个值必须是非空字符串";
            }
        }
    }
    if (model.redirects) {
        for (const r of model.redirects) {
            if (!r || typeof r !== "object" || typeof r.pre !== "string" || !r.pre ||
                typeof r.to !== "string" || !r.to) {
                return "重定向规则的 pre 和 to 不能为空";
            }
            if (r.weight !== undefined &&
                (typeof r.weight !== "number" || !Number.isFinite(r.weight) || r.weight < 0)) {
                return "重定向规则的 weight 必须是非负数";
            }
        }
    }
    return null;
}

/** 验证完整路由配置 */
export function validateRouterConfig(config: Partial<RouterConfig>): string | null {
    if (!Array.isArray(config.models) || config.models.length === 0) {
        return "models 必须是非空数组";
    }
    const names = new Set<string>();
    for (const model of config.models) {
        const error = validateModelConfig(model);
        if (error) return `${model?.name || "未命名模型"}: ${error}`;
        if (names.has(model.name)) return `模型名称 '${model.name}' 重复`;
        names.add(model.name);
    }
    if (config.auth_key !== undefined &&
        (!Array.isArray(config.auth_key) || config.auth_key.some(key => typeof key !== "string" || key.trim() === ""))) {
        return "auth_key 必须是非空字符串数组";
    }
    if (config.endpoint_pool !== undefined) {
        if (!config.endpoint_pool || typeof config.endpoint_pool !== "object" || Array.isArray(config.endpoint_pool)) {
            return "endpoint_pool 必须是对象";
        }
        for (const [name, endpoint] of Object.entries(config.endpoint_pool)) {
            const error = validateEndpointConfig(endpoint, `端点池 '${name}'`);
            if (error) return error;
        }
    }
    return null;
}
