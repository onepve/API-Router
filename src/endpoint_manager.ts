// src/endpoint_manager.ts
// 端点管理器（管理单个 base_url 下的多个 Key）

import type { KeyInfo } from "./types.ts";
import { Mutex } from "./mutex.ts";
import { Logger } from "./logger.ts";

export class EndpointManager {
    private keys: KeyInfo[] = [];
    private currentIndex = 0;
    private mutex = new Mutex();
    private config: {
        maxFailures: number;
        cooldownMs: number;
        maxFailureDurationMs: number;
        weight: number;
        timeout?: number;
        maxRetries?: number;
    };
    private logger: Logger;

    constructor(
        keys: string[],
        weight: number = 1,
        cooldownMs: number = 60000,
        maxFailureDurationMs: number = 3600000,
        logger?: Logger,
        requestOptions?: { timeout?: number; maxRetries?: number }
    ) {
        this.logger = logger || new Logger("info");
        this.config = {
            maxFailures: 3,
            cooldownMs,
            maxFailureDurationMs,
            weight: Math.max(1, weight),
            timeout: requestOptions?.timeout,
            maxRetries: requestOptions?.maxRetries,
        };
        this.keys = keys.map((v) => ({
            value: v,
            active: true,
            failCount: 0,
            cooldownUntil: 0,
            failureStartTime: 0,
            deleteTimerId: null,
        }));
    }

    /** 轮询获取一个可用 Key */
    async getAvailableKey(): Promise<string | null> {
        return this.mutex.run(() => {
            const total = this.keys.length;
            if (total === 0) return null;

            for (let i = 0; i < total; i++) {
                const idx = (this.currentIndex + i) % total;
                const key = this.keys[idx];
                if (key.active && Date.now() >= key.cooldownUntil) {
                    this.currentIndex = (idx + 1) % total;
                    return key.value;
                }
            }
            return null;
        });
    }

    getKeyCount(): number {
        return this.keys.length;
    }

    getWeight(): number {
        return this.config.weight;
    }

    getTimeout(): number | undefined {
        return this.config.timeout;
    }

    getMaxRetries(): number | undefined {
        return this.config.maxRetries;
    }

    /** 标记 Key 失败，达到阈值后冷却，并启动持续失败删除计时器 */
    async markFailure(keyValue: string): Promise<void> {
        await this.mutex.run(() => {
            const key = this.keys.find((k) => k.value === keyValue);
            if (!key) return;
            key.failCount++;
            if (key.failCount >= this.config.maxFailures) {
                if (key.failureStartTime === 0) {
                    key.failureStartTime = Date.now();
                }
                key.active = false;
                key.cooldownUntil = Date.now() + this.config.cooldownMs;
                key.failCount = 0;

                this.logger.info(`Key ${keyValue.slice(0, 8)}... cooldown ${this.config.cooldownMs}ms`);

                if (key.deleteTimerId === null) {
                    const remaining = key.failureStartTime + this.config.maxFailureDurationMs - Date.now();
                    const delay = Math.max(remaining, 0);
                    key.deleteTimerId = setTimeout(() => {
                        this.mutex.run(() => {
                            const k = this.keys.find(k => k.value === keyValue);
                            if (k && k.failureStartTime !== 0 &&
                                Date.now() - k.failureStartTime >= this.config.maxFailureDurationMs) {
                                this.keys = this.keys.filter(k => k.value !== keyValue);
                                this.logger.info(`Key ${keyValue.slice(0, 8)}... failed >${this.config.maxFailureDurationMs}ms, auto-deleted`);
                            }
                            if (k) k.deleteTimerId = null;
                        });
                    }, delay);
                }

                this.scheduleRecovery(key);
            }
        });
    }

    /** 标记 Key 成功，取消持续失败计时并恢复 */
    async markSuccess(keyValue: string): Promise<void> {
        await this.mutex.run(() => {
            const key = this.keys.find((k) => k.value === keyValue);
            if (key) {
                key.failCount = 0;
                if (key.failureStartTime !== 0) {
                    this.logger.info(`Key ${keyValue.slice(0, 8)}... recovered, auto-delete cancelled`);
                    key.failureStartTime = 0;
                    if (key.deleteTimerId !== null) {
                        clearTimeout(key.deleteTimerId);
                        key.deleteTimerId = null;
                    }
                }
                if (!key.active) {
                    key.active = true;
                    key.cooldownUntil = 0;
                }
            }
        });
    }

    /** 短冷却期结束后恢复 Key 可用性（不影响持续失败计时） */
    private scheduleRecovery(key: KeyInfo): void {
        const keyValue = key.value;
        const delay = key.cooldownUntil - Date.now();
        setTimeout(() => {
            this.mutex.run(() => {
                const currentKey = this.keys.find((k) => k.value === keyValue);
                if (!currentKey) return;
                if (!currentKey.active && Date.now() >= currentKey.cooldownUntil) {
                    currentKey.active = true;
                    currentKey.cooldownUntil = 0;
                    currentKey.failCount = 0;
                    this.logger.info(`Key ${keyValue.slice(0, 8)}... cooldown ended, recovered`);
                }
            });
        }, Math.max(delay, 0));
    }

    async addKey(value: string): Promise<void> {
        await this.mutex.run(() => {
            if (!this.keys.some((k) => k.value === value)) {
                this.keys.push({
                    value,
                    active: true,
                    failCount: 0,
                    cooldownUntil: 0,
                    failureStartTime: 0,
                    deleteTimerId: null,
                });
            }
        });
    }

    async removeKey(value: string): Promise<void> {
        await this.mutex.run(() => {
            const key = this.keys.find(k => k.value === value);
            if (key?.deleteTimerId !== null && key?.deleteTimerId !== undefined) {
                clearTimeout(key.deleteTimerId);
            }
            this.keys = this.keys.filter((k) => k.value !== value);
        });
    }

    /** 立即冷却 key（用于 401/403 等永久鉴权失败，不等 3 次重试） */
    /** 鉴权失败 401 — key 永久无效，直接删除 */
    async markPermanentFailure(keyValue: string, statusCode: number = 401): Promise<void> {
        await this.mutex.run(() => {
            const key = this.keys.find((k) => k.value === keyValue);
            if (!key) return;
            // 取消自动删除计时器
            if (key.deleteTimerId !== null && key.deleteTimerId !== undefined) {
                clearTimeout(key.deleteTimerId);
            }
            // 从列表中移除
            this.keys = this.keys.filter(k => k.value !== keyValue);
            this.logger.warn(`Key ${keyValue.slice(0, 8)}... auth failure ${statusCode}, permanently deleted`);
        });
    }

    async getStatus(): Promise<{
        total: number;
        active: number;
        cooldown: number;
        weight: number;
    }> {
        return this.mutex.run(() => {
            const total = this.keys.length;
            const active = this.keys.filter(
                (k) => k.active && Date.now() >= k.cooldownUntil
            ).length;
            return {
                total,
                active,
                cooldown: total - active,
                weight: this.config.weight,
            };
        });
    }

    async hasAvailableKey(): Promise<boolean> {
        return this.mutex.run(() => {
            return this.keys.some(
                (k) => k.active && Date.now() >= k.cooldownUntil
            );
        });
    }

    getKeys(): string[] {
        return this.keys.map(k => k.value);
    }

    /** 获取每个 key 的运行时状态 */
    getKeyStatuses(): Array<{ value: string; active: boolean; cooldown: boolean }> {
        const now = Date.now();
        return this.keys.map(k => ({
            value: k.value,
            active: k.active && now >= k.cooldownUntil,
            cooldown: !k.active || now < k.cooldownUntil,
        }));
    }
}
