// src/token_store.ts
// Token 用量存储器 — 支持 JSON 文件持久化

import type { TokenRecord } from "./types.ts";
import { Logger } from "./logger.ts";

export class TokenStore {
    private records: TokenRecord[] = [];
    private readonly maxAgeMs = 31 * 24 * 60 * 60 * 1000; // 31 天保留期
    private persistPath: string;
    private dirty = false;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private logger: Logger;

    constructor(persistPath?: string, logger?: Logger) {
        this.persistPath = persistPath ||
            Deno.env.get("TOKEN_STATS_PATH") ||
            "./token_stats.json";
        this.logger = logger || new Logger("info");
    }

    /** 从文件恢复历史数据 */
    async restore(): Promise<void> {
        try {
            const raw = await Deno.readTextFile(this.persistPath);
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                const cutoff = Date.now() - this.maxAgeMs;
                this.records = data.filter(
                    (r: TokenRecord) => r.timestamp >= cutoff &&
                        typeof r.model === "string" &&
                        typeof r.totalTokens === "number"
                );
                this.logger.info(`Restored ${this.records.length} records from ${this.persistPath}`);
            }
        } catch (_) {
            // 文件不存在或格式错误，从空记录开始
            if (_ instanceof Deno.errors.NotFound) {
                this.logger.info("No history file found, starting fresh");
            } else {
                this.logger.warn(`History data read failed, starting fresh: ${(_ as Error).message}`);
            }
        }
    }

    /** 记录一次成功请求的 token 用量 */
    record(model: string, totalTokens: number, breakdown?: {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
    }) {
        this.records.push({
            model,
            timestamp: Date.now(),
            totalTokens,
            ...(breakdown ? {
                inputTokens: breakdown.inputTokens,
                outputTokens: breakdown.outputTokens,
                cacheReadTokens: breakdown.cacheReadTokens,
                cacheWriteTokens: breakdown.cacheWriteTokens,
            } : {}),
        });
        this.dirty = true;
        this.scheduleFlush();
    }

    /** 延迟写入磁盘（5 秒 debounce） */
    private scheduleFlush() {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flush().catch((e) =>
                this.logger.error(`Persist write failed: ${e.message}`)
            );
        }, 5000);
    }

    /** 将记录写入 JSON 文件（原子写入） */
    private async flush(): Promise<void> {
        if (!this.dirty) return;
        const json = JSON.stringify(this.records);
        const tmp = this.persistPath + ".tmp";
        await Deno.writeTextFile(tmp, json);
        await Deno.rename(tmp, this.persistPath);
        this.dirty = false;
    }

    /** 按模型和时间窗口查询总量及请求次数 */
    query(model?: string, windowMs?: number): { totalTokens: number; requestCount: number } {
        const now = Date.now();
        const since = windowMs ? now - windowMs : 0;
        let filtered = this.records.filter(r => r.timestamp >= since);
        if (model) {
            filtered = filtered.filter(r => r.model === model);
        }
        const totalTokens = filtered.reduce((sum, r) => sum + r.totalTokens, 0);
        return {
            totalTokens,
            requestCount: filtered.length,
        };
    }

    /** 按日分组统计，返回最近 N 天数据（缺失日期用 0 填充） */
    queryDaily(model?: string, days: number = 30): Array<{ date: string; totalTokens: number; requestCount: number }> {
        const now = Date.now();
        const since = now - days * 86400000;
        const filtered = this.records.filter(r => r.timestamp >= since && (!model || r.model === model));

        const byDate = new Map<string, { totalTokens: number; requestCount: number }>();
        for (const r of filtered) {
            const date = new Date(r.timestamp).toISOString().slice(0, 10);
            const entry = byDate.get(date) || { totalTokens: 0, requestCount: 0 };
            entry.totalTokens += r.totalTokens;
            entry.requestCount++;
            byDate.set(date, entry);
        }

        const result: Array<{ date: string; totalTokens: number; requestCount: number }> = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
            const entry = byDate.get(d);
            result.push({ date: d, totalTokens: entry?.totalTokens || 0, requestCount: entry?.requestCount || 0 });
        }
        return result;
    }

    /** 按分钟分桶统计（用于分钟级图表） */
    queryMinutely(model?: string, minutes: number = 60): Array<{ date: string; totalTokens: number; requestCount: number }> {
        const now = Date.now();
        const since = now - minutes * 60000;
        const filtered = this.records.filter(r => r.timestamp >= since && (!model || r.model === model));

        const byBucket = new Map<string, { totalTokens: number; requestCount: number }>();
        for (const r of filtered) {
            const d = new Date(r.timestamp);
            const bucket = d.toISOString().slice(0, 16); // "2026-07-01T14:05"
            const entry = byBucket.get(bucket) || { totalTokens: 0, requestCount: 0 };
            entry.totalTokens += r.totalTokens;
            entry.requestCount++;
            byBucket.set(bucket, entry);
        }

        const result: Array<{ date: string; totalTokens: number; requestCount: number }> = [];
        for (let i = minutes - 1; i >= 0; i--) {
            const d = new Date(now - i * 60000);
            const bucket = d.toISOString().slice(0, 16);
            const entry = byBucket.get(bucket);
            result.push({ date: bucket, totalTokens: entry?.totalTokens || 0, requestCount: entry?.requestCount || 0 });
        }
        return result;
    }

    /** 按小时分桶统计（用于小时级图表） */
    queryHourly(model?: string, hours: number = 24): Array<{ date: string; totalTokens: number; requestCount: number }> {
        const now = Date.now();
        const since = now - hours * 3600000;
        const filtered = this.records.filter(r => r.timestamp >= since && (!model || r.model === model));

        const byBucket = new Map<string, { totalTokens: number; requestCount: number }>();
        for (const r of filtered) {
            const d = new Date(r.timestamp);
            const bucket = d.toISOString().slice(0, 13) + ":00"; // "2026-07-01T14:00"
            const entry = byBucket.get(bucket) || { totalTokens: 0, requestCount: 0 };
            entry.totalTokens += r.totalTokens;
            entry.requestCount++;
            byBucket.set(bucket, entry);
        }

        const result: Array<{ date: string; totalTokens: number; requestCount: number }> = [];
        for (let i = hours - 1; i >= 0; i--) {
            const d = new Date(now - i * 3600000);
            const bucket = d.toISOString().slice(0, 13) + ":00";
            const entry = byBucket.get(bucket);
            result.push({ date: bucket, totalTokens: entry?.totalTokens || 0, requestCount: entry?.requestCount || 0 });
        }
        return result;
    }

    /** 各模型汇总统计（用于饼图） */
    queryModelSummary(windowMs?: number): Array<{
        model: string;
        totalTokens: number;
        requestCount: number;
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
    }> {
        const since = windowMs ? Date.now() - windowMs : 0;
        const filtered = this.records.filter(r => r.timestamp >= since);
        const byModel = new Map<string, {
            totalTokens: number;
            requestCount: number;
            inputTokens: number;
            outputTokens: number;
            cacheReadTokens: number;
            cacheWriteTokens: number;
        }>();
        for (const r of filtered) {
            const entry = byModel.get(r.model) || {
                totalTokens: 0, requestCount: 0,
                inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
            };
            entry.totalTokens += r.totalTokens;
            entry.requestCount++;
            if (r.inputTokens !== undefined) entry.inputTokens += r.inputTokens;
            if (r.outputTokens !== undefined) entry.outputTokens += r.outputTokens;
            if (r.cacheReadTokens !== undefined) entry.cacheReadTokens += r.cacheReadTokens;
            if (r.cacheWriteTokens !== undefined) entry.cacheWriteTokens += r.cacheWriteTokens;
            byModel.set(r.model, entry);
        }
        return Array.from(byModel.entries())
            .map(([model, stats]) => ({ model, ...stats }))
            .sort((a, b) => b.totalTokens - a.totalTokens);
    }

    /** 定期清理过期记录 + 压缩文件 */
    startCleanup() {
        setInterval(() => {
            const cutoff = Date.now() - this.maxAgeMs;
            const before = this.records.length;
            this.records = this.records.filter(r => r.timestamp >= cutoff);
            if (this.records.length < before) {
                this.dirty = true;
                this.flush().catch((e) =>
                    this.logger.error(`Cleanup write failed: ${e.message}`)
                );
            }
        }, 3600000); // 每小时清理一次
    }
}
