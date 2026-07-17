// src/mutex.ts
// 基础异步互斥锁

export class Mutex {
    private locked = false;
    private waiting: (() => void)[] = [];

    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }
        await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    release(): void {
        if (this.waiting.length > 0) {
            const next = this.waiting.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }

    async run<T>(fn: () => T | Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}
