// src/logger.ts
// 日志分级系统 — 支持 error / warn / info / debug 四个等级

export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_MAP: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const LEVEL_EMOJI: Record<number, string> = {
    0: "❌",
    1: "⚠️",
    2: "ℹ️",
    3: "🔍",
};

/**
 * 从环境变量或配置解析日志等级
 * 优先级：LOG_LEVEL 环境变量 > 传入值 > "info"
 */
export function resolveLogLevel(configLevel?: string): LogLevel {
    const envLevel = Deno.env.get("LOG_LEVEL")?.toLowerCase();
    if (envLevel && LEVEL_MAP[envLevel as LogLevel] !== undefined) {
        return envLevel as LogLevel;
    }
    if (configLevel && LEVEL_MAP[configLevel as LogLevel] !== undefined) {
        return configLevel as LogLevel;
    }
    return "info";
}

export class Logger {
    private level: number;
    private prefix: string;
    private parent: Logger | null;

    constructor(level: LogLevel | number, prefix?: string, parent?: Logger) {
        if (typeof level === "number") {
            this.level = level;
        } else {
            this.level = LEVEL_MAP[level];
        }
        this.prefix = prefix ? `[${prefix}]` : "";
        this.parent = parent || null;
    }

    /** 更新日志等级（热加载时使用），会同步到所有子 logger */
    setLevel(level: LogLevel): void {
        this.level = LEVEL_MAP[level];
    }

    /** 当前有效等级（考虑父级继承） */
    private get effectiveLevel(): number {
        return this.parent ? this.parent.level : this.level;
    }

    getLevel(): LogLevel {
        const lv = this.effectiveLevel;
        const entry = Object.entries(LEVEL_MAP).find(([, v]) => v === lv);
        return (entry?.[0] as LogLevel) ?? "info";
    }

    /** 创建子 logger，继承父级等级（父级 setLevel 会同步生效） */
    child(prefix: string): Logger {
        return new Logger(this.level, prefix, this);
    }

    error(msg: string): void {
        if (this.effectiveLevel >= 0) console.error(this.format(0, msg));
    }

    warn(msg: string): void {
        if (this.effectiveLevel >= 1) console.warn(this.format(1, msg));
    }

    info(msg: string): void {
        if (this.effectiveLevel >= 2) console.log(this.format(2, msg));
    }

    debug(msg: string): void {
        if (this.effectiveLevel >= 3) console.log(this.format(3, msg));
    }

    private pad(n: number): string {
        return n.toString().padStart(2, "0");
    }

    private localTime(): string {
        const d = new Date();
        return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ` +
            `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
    }

    private format(level: number, msg: string): string {
        const emoji = LEVEL_EMOJI[level] || "";
        const ts = this.localTime();
        return this.prefix
            ? `${ts} ${emoji} ${this.prefix} ${msg}`
            : `${ts} ${emoji} ${msg}`;
    }
}
