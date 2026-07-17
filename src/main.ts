// src/main.ts
// API Router 入口 — 组装配置、路由、监听、HTTP 服务

import { loadConfig, getModelsFromConfig } from "./config.ts";
import { ModelRouter } from "./model_router.ts";
import { ModelCatalog } from "./model_catalog.ts";
import { watchConfigFile } from "./watcher.ts";
import { handleAdminRoutes } from "./admin/routes.ts";
import { Logger, resolveLogLevel } from "./logger.ts";

// ============================================================================
// 启动入口
// ============================================================================
export async function main() {
    const configPath = Deno.env.get("CONFIG_PATH") || "./config.yaml";
    const port = parseInt(Deno.env.get("PORT") || "8080");
    const enableWatch = Deno.env.get("DISABLE_WATCH") !== "true";

    console.log(`🔧 API Router by JiXieShi`);
    console.log(`🌐 https://www.starss.cc`);

    const config = await loadConfig(configPath);
    const logLevel = resolveLogLevel(config.log_level);
    const logger = new Logger(logLevel);

    logger.info(`Loading config from: ${configPath}`);

    if (!config.models || config.models.length === 0) {
        logger.error("No models configured in YAML");
        Deno.exit(1);
    }

    logger.info(`Loaded ${config.models.length} model configurations`);

    // 初始化模型目录（先加载缓存，后台拉取最新）
    const catalog = new ModelCatalog(undefined, logger.child("Catalog"));
    await catalog.init();
    console.log(`📚 Model catalog: ${catalog.getModelCount()} models available`);

    for (const model of config.models) {
        if (model.endpoints) {
            for (const ep of model.endpoints) {
                console.log(`  - ${model.name}  →  ${ep.base_url} (${ep.keys.length} keys, weight: ${ep.weight || 1})`);
            }
        } else if (model.endpoint_refs) {
            console.log(`  - ${model.name}  →  [pool] ${model.endpoint_refs.join(", ")}`);
        } else {
            console.log(`  - ${model.name}`);
        }
        if (model.redirects) {
            for (const r of model.redirects) {
                console.log(`      ↳ redirect: ${r.pre} → ${r.to} (weight: ${r.weight ?? 1})`);
            }
        } else if (model.redirect_to) {
            console.log(`      ↳ redirect: * → ${model.redirect_to}`);
        }
    }

    const router = new ModelRouter(config.models, config, catalog, configPath, logger.child("Router"));
    router.onReload(() => logger.info("Reload state updated"));

    logger.info(`API Router listening on http://localhost:${port}`);
    logger.info(`Admin: http://localhost:${port}/admin`);
    logger.info(`Hot reload: ${enableWatch ? 'enabled' : 'disabled'}`);
    logger.info(`Log level: ${logger.getLevel()}`);

    if (enableWatch) {
        watchConfigFile(configPath, logger.child("Watcher"), async (models, endpointPool) => {
            // 热加载时同步更新日志等级（父级 setLevel 自动同步到所有子 logger）
            const newConfig = await loadConfig(configPath);
            const newLevel = resolveLogLevel(newConfig.log_level);
            logger.setLevel(newLevel);
            await router.reload(models, endpointPool, newConfig);
        });
    }

    Deno.serve({ port }, async (req) => {
        const url = new URL(req.url);

        // 管理路由（包含页面、鉴权检查、现有 API、新 CRUD API）
        const adminResponse = await handleAdminRoutes(req, router, configPath);
        if (adminResponse !== null) {
            return adminResponse;
        }

        // 普通 API 转发（内部已包含鉴权）
        return router.handleRequest(req);
    });
}

if (import.meta.main) {
    await main();
}
