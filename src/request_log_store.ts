import type {
    RequestLogInput,
    RequestLogQuery,
    RequestLogRecord,
    RequestLogSummary,
} from "./types.ts";
import { utc8MinuteKey } from "./time.ts";

export class RequestLogStore {
    private records: RequestLogRecord[] = [];
    private nextId = 1;

    constructor(private readonly capacity = 500) {
        if (!Number.isInteger(capacity) || capacity <= 0) {
            throw new Error("Request log capacity must be a positive integer");
        }
    }

    record(input: RequestLogInput): RequestLogRecord {
        const record: RequestLogRecord = { ...input, id: this.nextId++ };
        this.records.push(record);
        if (this.records.length > this.capacity) {
            this.records.splice(0, this.records.length - this.capacity);
        }
        return record;
    }

    query(query: RequestLogQuery = {}): { records: RequestLogRecord[]; latestId: number } {
        let filtered = this.records;
        if (query.after !== undefined) {
            filtered = filtered.filter(record => record.id > query.after!);
        }
        if (query.model) {
            filtered = filtered.filter(record =>
                record.originalModel === query.model || record.resolvedModel === query.model
            );
        }
        if (query.status !== undefined) {
            filtered = filtered.filter(record => record.status === query.status);
        }
        if (query.path) {
            filtered = filtered.filter(record => record.path === query.path);
        }

        const requestedLimit = query.limit ?? 100;
        const limit = Math.min(this.capacity, Math.max(1, Math.floor(requestedLimit)));
        return {
            records: filtered.slice(-limit),
            latestId: this.nextId - 1,
        };
    }

    summary(windowMs: number, now = Date.now()): RequestLogSummary {
        const cutoff = now - windowMs;
        const records = this.records.filter(record => record.timestamp >= cutoff && record.timestamp <= now);
        const errors = records.filter(record => record.status >= 400);
        const durations = records.map(record => record.durationMs).sort((a, b) => a - b);
        const p95Index = durations.length === 0 ? -1 : Math.ceil(durations.length * 0.95) - 1;
        const firstByteDurations = records
            .map(record => record.firstByteMs)
            .filter((value): value is number => typeof value === "number")
            .sort((a, b) => a - b);
        const p95FirstByteIndex = firstByteDurations.length === 0
            ? -1
            : Math.ceil(firstByteDurations.length * 0.95) - 1;

        const timelineMap = new Map<string, { requestCount: number; errorCount: number }>();
        const modelMap = new Map<string, { requestCount: number; totalTokens: number }>();
        for (const record of records) {
            const bucket = utc8MinuteKey(record.timestamp);
            const timeline = timelineMap.get(bucket) || { requestCount: 0, errorCount: 0 };
            timeline.requestCount++;
            if (record.status >= 400) timeline.errorCount++;
            timelineMap.set(bucket, timeline);

            const model = modelMap.get(record.resolvedModel) || { requestCount: 0, totalTokens: 0 };
            model.requestCount++;
            model.totalTokens += record.totalTokens ?? 0;
            modelMap.set(record.resolvedModel, model);
        }

        return {
            requestCount: records.length,
            errorCount: errors.length,
            successRate: records.length === 0
                ? 0
                : Math.round(((records.length - errors.length) / records.length) * 10_000) / 100,
            p95LatencyMs: p95Index >= 0 ? durations[p95Index] : 0,
            p95FirstByteMs: p95FirstByteIndex >= 0 ? firstByteDurations[p95FirstByteIndex] : 0,
            timeline: Array.from(timelineMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([bucket, value]) => ({ bucket, ...value })),
            models: Array.from(modelMap.entries())
                .map(([model, value]) => ({ model, ...value }))
                .sort((a, b) => b.requestCount - a.requestCount || a.model.localeCompare(b.model)),
        };
    }
}
