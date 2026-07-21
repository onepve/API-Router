// src/model_catalog.ts
// 模型目录服务 — 从 models.dev 拉取模型列表、缓存、匹配、定价查询

import type { ModelConfig } from "./types.ts";
import { Logger } from "./logger.ts";

// ============================================================================
// 类型定义
// ============================================================================

/** 扁平化后的单个目录模型 */
export interface CatalogModel {
    id: string;           // "openai/gpt-4o"
    name: string;         // "GPT-4o"
    provider: string;     // "openai"
    cost: { input: number; output: number; cache_read?: number; cache_write?: number } | null;
    limit: { context: number; output: number } | null;
}

// ============================================================================
// ModelCatalog 类
// ============================================================================

const CATALOG_URL = "https://models.dev/api.json";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时

export class ModelCatalog {
    private models: CatalogModel[] = [];
    private modelMap: Map<string, CatalogModel> = new Map();
    private cachePath: string;
    private refreshTimer: ReturnType<typeof setInterval> | null = null;
    private logger: Logger;

    constructor(cachePath?: string, logger?: Logger) {
        this.cachePath = cachePath ||
            Deno.env.get("MODEL_CATALOG_PATH") ||
            "./model_catalog.json";
        this.logger = logger || new Logger("info");
    }

    // ------------------------------------------------------------------------
    // 初始化：先加载缓存，再后台拉取最新
    // ------------------------------------------------------------------------
    async init(): Promise<void> {
        const cached = await this.loadCache();
        if (cached) {
            this.buildIndex(cached);
            this.logger.info(`Loaded ${this.models.length} models from cache`);
        }

        // 后台拉取最新（不阻塞启动）
        this.refresh().catch(e =>
            this.logger.warn(`Background refresh failed: ${e.message}`)
        );

        // 定时刷新
        this.refreshTimer = setInterval(() => {
            this.refresh().catch(e =>
                this.logger.warn(`Scheduled refresh failed: ${e.message}`)
            );
        }, REFRESH_INTERVAL_MS);

        if (this.models.length === 0) {
            this.logger.info("Cache empty, initial fetch...");
        }
    }

    // ------------------------------------------------------------------------
    // 拉取最新目录并保存缓存
    // ------------------------------------------------------------------------
    async refresh(): Promise<void> {
        this.logger.info("Fetching model list from models.dev...");
        const startTime = Date.now();

        const response = await fetch(CATALOG_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const flattened = this.flattenProviders(data);
        this.buildIndex(flattened);
        await this.saveCache(flattened);

        const elapsed = Date.now() - startTime;
        this.logger.info(`Updated: ${this.models.length} models (${elapsed}ms)`);
    }

    // ------------------------------------------------------------------------
    // 将嵌套的 API 响应扁平化为 CatalogModel[]
    // ------------------------------------------------------------------------
    private flattenProviders(data: Record<string, any>): CatalogModel[] {
        const result: CatalogModel[] = [];
        for (const [providerId, provider] of Object.entries(data)) {
            if (!provider || typeof provider !== "object") continue;
            const models = provider.models;
            if (!models || typeof models !== "object") continue;

            for (const [modelId, model] of Object.entries(models)) {
                if (!model || typeof model !== "object") continue;
                const m = model as Record<string, any>;

                // 提取定价（USD / 百万 tokens）
                let cost: CatalogModel["cost"] = null;
                if (m.cost && typeof m.cost === "object") {
                    cost = {
                        input: typeof m.cost.input === "number" ? m.cost.input : 0,
                        output: typeof m.cost.output === "number" ? m.cost.output : 0,
                        cache_read: typeof m.cost.cache_read === "number" ? m.cost.cache_read : undefined,
                        cache_write: typeof m.cost.cache_write === "number" ? m.cost.cache_write : undefined,
                    };
                }

                // 提取限制
                let limit: CatalogModel["limit"] = null;
                if (m.limit && typeof m.limit === "object") {
                    limit = {
                        context: typeof m.limit.context === "number" ? m.limit.context : 0,
                        output: typeof m.limit.output === "number" ? m.limit.output : 0,
                    };
                }

                result.push({
                    id: typeof m.id === "string" ? m.id : `${providerId}/${modelId}`,
                    name: typeof m.name === "string" ? m.name : modelId as string,
                    provider: providerId,
                    cost,
                    limit,
                });
            }
        }
        return result;
    }

    // ------------------------------------------------------------------------
    // 构建索引
    // ------------------------------------------------------------------------
    private buildIndex(models: CatalogModel[]): void {
        this.models = models;
        this.modelMap.clear();
        for (const m of models) {
            this.modelMap.set(m.id, m);
        }
    }

    // ------------------------------------------------------------------------
    // 缓存读写
    // ------------------------------------------------------------------------
    private async loadCache(): Promise<CatalogModel[] | null> {
        try {
            const raw = await Deno.readTextFile(this.cachePath);
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
                return data as CatalogModel[];
            }
        } catch (_) {
            // 文件不存在或格式错误
        }
        return null;
    }

    private async saveCache(models: CatalogModel[]): Promise<void> {
        try {
            const json = JSON.stringify(models);
            const tmp = this.cachePath + ".tmp";
            await Deno.writeTextFile(tmp, json);
            await Deno.rename(tmp, this.cachePath);
        } catch (e) {
            this.logger.warn(`Cache write failed: ${(e as Error).message}`);
        }
    }

    // ------------------------------------------------------------------------
    // 公共查询方法
    // ------------------------------------------------------------------------
    getModels(): CatalogModel[] {
        return this.models;
    }

    getModel(id: string): CatalogModel | undefined {
        return this.modelMap.get(id);
    }

    getModelCount(): number {
        return this.models.length;
    }

    // ------------------------------------------------------------------------
    // 模式匹配：将配置模式解析为真实模型 ID 列表
    // ------------------------------------------------------------------------
    /**
     * 根据配置中的模型名称模式，从目录中匹配真实模型 ID。
     * - 精确匹配: config name 完整匹配某个 model.id
     * - 前缀匹配: config name 以 "*" 结尾，匹配 model.id 前缀
     * - 正则匹配: config name 以 "^" 开头，对 model.id 做正则测试
     * - 如果都没匹配到，保留原 pattern（允许自定义/私有模型）
     */
    resolvePatterns(configs: ModelConfig[]): string[] {
        const resolved: string[] = [];
        const seen = new Set<string>();

        for (const cfg of configs) {
            const pattern = cfg.name;

            // 默认 "*" 匹配所有
            if (pattern === "*") {
                for (const m of this.models) {
                    if (!seen.has(m.id)) {
                        seen.add(m.id);
                        resolved.push(m.id);
                    }
                }
                continue;
            }

            let matched = false;

            if (pattern.startsWith("^")) {
                // 正则匹配
                try {
                    const regex = new RegExp(pattern);
                    for (const m of this.models) {
                        if (regex.test(m.id) && !seen.has(m.id)) {
                            seen.add(m.id);
                            resolved.push(m.id);
                            matched = true;
                        }
                    }
                } catch {
                    // 无效正则，按精确匹配回退
                }
            } else if (pattern.endsWith("*")) {
                // 前缀匹配
                const prefix = pattern.slice(0, -1).toLowerCase();
                for (const m of this.models) {
                    if (m.id.toLowerCase().startsWith(prefix) && !seen.has(m.id)) {
                        seen.add(m.id);
                        resolved.push(m.id);
                        matched = true;
                    }
                }
            } else {
                // 精确配置必须保持原始 ID。路由匹配区分大小写，不能把目录中的
                // 大小写变体一并暴露，否则 /v1/models 会列出实际不可调用的模型。
                if (!seen.has(pattern)) {
                    seen.add(pattern);
                    resolved.push(pattern);
                }
                matched = true;
            }

            // 无匹配时保留原 pattern
            if (!matched && !seen.has(pattern)) {
                seen.add(pattern);
                resolved.push(pattern);
            }
        }

        return resolved;
    }

    // ------------------------------------------------------------------------
    // 定价查询
    // ------------------------------------------------------------------------
    /** 获取模型定价（USD / 百万 tokens），未找到返回 null */
    getPricing(modelId: string): {
        input: number;
        output: number;
        cache_read?: number;
        cache_write?: number;
    } | null {
        const model = this.modelMap.get(modelId);
        if (!model?.cost) return null;

        const c = model.cost;
        if (c.input <= 0 && (c.output ?? 0) <= 0) return null;

        return {
            input: c.input,
            output: c.output || c.input,
            cache_read: c.cache_read,
            cache_write: c.cache_write,
        };
    }

    /** 计算成本：支持分项 token 精确计算 + 向后兼容的粗估 */
    calculateCost(modelId: string, totalTokens: number, breakdown?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
    }): {
        cost: number;
        hasPricing: boolean;
        inputCost?: number;
        outputCost?: number;
        cacheReadCost?: number;
        cacheWriteCost?: number;
    } {
        const pricing = this.getPricing(modelId);
        if (!pricing) {
            return { cost: 0, hasPricing: false };
        }

        // 有分项数据时精确计算
        if (breakdown?.input !== undefined && breakdown?.output !== undefined) {
            const inputCost = (breakdown.input / 1_000_000) * pricing.input;
            const outputCost = (breakdown.output / 1_000_000) * pricing.output;
            const cacheReadCost = (breakdown.cacheRead && pricing.cache_read)
                ? (breakdown.cacheRead / 1_000_000) * pricing.cache_read : 0;
            const cacheWriteCost = (breakdown.cacheWrite && pricing.cache_write)
                ? (breakdown.cacheWrite / 1_000_000) * pricing.cache_write : 0;
            return {
                cost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
                hasPricing: true,
                inputCost,
                outputCost,
                cacheReadCost,
                cacheWriteCost,
            };
        }

        // 无分项数据时回退到 70/30 估算（向后兼容）
        const avgPrice = pricing.input * 0.7 + pricing.output * 0.3;
        const cost = (totalTokens / 1_000_000) * avgPrice;
        return { cost, hasPricing: true };
    }

    // ------------------------------------------------------------------------
    // 清理
    // ------------------------------------------------------------------------
    stop(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}
