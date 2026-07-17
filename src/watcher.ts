// src/watcher.ts
// 配置文件热加载监听

import { loadConfig, getModelsFromConfig } from "./config.ts";
import type { ModelConfig, EndpointConfig } from "./types.ts";
import { Logger } from "./logger.ts";

export async function watchConfigFile(
    configPath: string,
    logger: Logger,
    onConfigChanged: (models: ModelConfig[], endpointPool?: Record<string, EndpointConfig>) => Promise<void>,
    reloadDelay = 500
): Promise<void> {
    logger.info(`Watching config file: ${configPath}`);
    let reloadTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastModified = 0;
    try {
        const fileInfo = await Deno.stat(configPath);
        lastModified = fileInfo.mtime?.getTime() || 0;
    } catch (_) {}

    const watcher = Deno.watchFs(configPath);
    for await (const event of watcher) {
        if (event.kind !== "modify" && event.kind !== "create") continue;
        if (reloadTimeout) clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(async () => {
            try {
                const fileInfo = await Deno.stat(configPath);
                const currentModified = fileInfo.mtime?.getTime() || 0;
                if (currentModified <= lastModified) return;
                lastModified = currentModified;
                logger.info("Config file changed, reloading...");
                await new Promise(resolve => setTimeout(resolve, 100));
                const config = await loadConfig(configPath);
                const models = getModelsFromConfig(config);
                if (!models || models.length === 0) {
                    logger.warn("Config is empty, skipping reload");
                    return;
                }
                await onConfigChanged(models, config.endpoint_pool);
                logger.info("Hot reload complete");
            } catch (error) {
                logger.error(`Hot reload failed: ${error}`);
            }
        }, reloadDelay);
    }
}
