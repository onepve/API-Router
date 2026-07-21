// src/types.ts
// 所有类型定义

/** Header 覆盖策略 */
export interface HeaderPolicy {
    /** 要设置/覆盖的 header */
    set?: Record<string, string>;
    /** 要删除的 header 名 */
    delete?: string[];
}

/** 单个 API 端点配置 */
export interface EndpointConfig {
    base_url: string;
    keys: string[];
    weight?: number;
    timeout?: number;
    max_retries?: number;
}

/** 重定向规则 */
export interface RedirectRule {
    pre: string;
    weight?: number;
    to: string;
}

/** 单个模型配置 */
export interface ModelConfig {
    name: string;
    /** 可选：支持的端点类型。支持别名 (openai/response/claude/embeddings 等) 和字面路径 (/v1/chat/completions) */
    type?: string[];
    /** 模型独占端点 */
    endpoints?: EndpointConfig[];
    /** 引用全局 endpoint_pool 中的端点名称 */
    endpoint_refs?: string[];
    cooldown_ms?: number;
    delete_after_failure_ms?: number;
    default_timeout?: number;
    default_max_retries?: number;
    redirect_to?: string;
    redirects?: RedirectRule[];
    /** 模型级 header 覆盖策略（覆盖全局） */
    headers?: HeaderPolicy;
}

/** YAML 配置文件顶层结构 */
export interface RouterConfig {
    models: ModelConfig[];
    auth_key?: string[];
    /** 全局端点池。模型中可通过 endpoint_refs 引用，实现多模型共享端点+Key */
    endpoint_pool?: Record<string, EndpointConfig>;
    /** 全局 header 覆盖策略（模型级可覆盖） */
    headers?: HeaderPolicy;
    /** 日志等级: error | warn | info | debug（默认 info） */
    log_level?: string;
}

/** 匹配器类型 */
export type MatcherType = "exact" | "prefix" | "regex" | "wildcard";

/** 匹配器 */
export interface Matcher {
    type: MatcherType;
    pattern: string;
    regex?: RegExp;
}

/** 单个 Key 运行时信息 */
export interface KeyInfo {
    value: string;
    active: boolean;
    failCount: number;
    cooldownUntil: number;
    failureStartTime: number;
    deleteTimerId: ReturnType<typeof setTimeout> | null;
}

/** Token 记录 */
export interface TokenRecord {
    model: string;
    timestamp: number;
    totalTokens: number;
    /** 分项 token 统计（从上游 API usage 提取） */
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}

/** 单次客户端请求的最终转发结果（仅包含非敏感元数据） */
export interface RequestLogInput {
    timestamp: number;
    originalModel: string;
    resolvedModel: string;
    path: string;
    status: number;
    durationMs: number;
    /** 首字节/首个流式数据块到达延迟 */
    firstByteMs?: number;
    totalTokens?: number;
    upstreamBaseUrl?: string;
    stream: boolean;
    retryCount: number;
    error?: string;
}

export interface RequestLogRecord extends RequestLogInput {
    id: number;
}

export interface RequestLogQuery {
    after?: number;
    limit?: number;
    model?: string;
    status?: number;
    path?: string;
}

export interface RequestLogSummary {
    requestCount: number;
    errorCount: number;
    successRate: number;
    p95LatencyMs: number;
    p95FirstByteMs: number;
    timeline: Array<{
        bucket: string;
        requestCount: number;
        errorCount: number;
    }>;
    models: Array<{
        model: string;
        requestCount: number;
        totalTokens: number;
    }>;
}
