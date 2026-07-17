// src/admin/page.ts
// 管理后台 HTML 页面 — 侧边栏 + 5 页面新设计

export function getAdminPageResponse(): Response {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.5">
    <title>API Router 管理面板</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.17/codemirror.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.17/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.17/mode/yaml/yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.17/addon/selection/active-line.min.js"></script>\n    <script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
    <link rel="stylesheet" href="/admin/assets/admin.css">
</head>
<body>

    <!-- ====== 侧边栏 ====== -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
            <span class="brand-mark">AR</span>
            <span class="brand-copy"><strong>API Router</strong><small>Operations console</small></span>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
            <button class="active" data-page="dashboard"><i data-lucide="layout-dashboard"></i><span>仪表盘</span></button>
            <button data-page="models"><i data-lucide="box"></i><span>模型</span></button>
            <button data-page="endpoints"><i data-lucide="waypoints"></i><span>端点</span></button>
            <button data-page="token"><i data-lucide="chart-no-axes-combined"></i><span>Token 与成本</span></button>
            <button data-page="config"><i data-lucide="file-cog"></i><span>配置</span></button>
        </nav>
        <div class="sidebar-footer">
            <span class="status-dot"></span><span>路由服务在线</span>
        </div>
    </aside>

    <!-- ====== 主内容 ====== -->
    <div class="main">
        <header class="main-header">
            <button class="icon-btn mobile-nav-toggle" id="mobile-nav-toggle" title="打开导航" aria-label="打开导航"><i data-lucide="menu"></i></button>
            <h1 id="page-title">仪表盘</h1>
            <div class="header-right" id="header-info"></div>
        </header>
        <div class="main-body">

            <!-- 鉴权遮罩 -->
            <div id="auth-modal" class="modal-overlay" style="display:none;">
                <div class="modal" style="max-width:400px;">
                    <div class="modal-header"><h2>🔐 需要访问密钥</h2></div>
                    <div class="modal-body">
                        <p style="color:var(--text-secondary);margin-bottom:16px;">此管理页面已启用鉴权，请输入有效的 auth_key</p>
                        <input type="password" id="auth-key-input" placeholder="sk-..." autocomplete="off">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="auth-submit" style="width:100%;">验证并进入</button>
                    </div>
                </div>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 1: 仪表盘 -->
            <!-- ================================================================ -->
            <div class="page active" id="page-dashboard">
                <div class="ops-toolbar">
                    <div>
                        <div class="eyebrow">OPERATIONS</div>
                        <h2>路由运行概览</h2>
                    </div>
                    <div class="ops-toolbar-actions">
                        <span class="last-updated" id="last-updated">--</span>
                        <span id="countdown-timer"></span>
                        <button class="icon-btn" id="btn-refresh" title="立即刷新" aria-label="立即刷新"><i data-lucide="refresh-cw"></i></button>
                        <button class="icon-btn" id="btn-auto-refresh" title="暂停自动刷新" aria-label="暂停自动刷新"><i data-lucide="pause"></i></button>
                    </div>
                </div>

                <section class="ops-metrics" aria-label="关键指标">
                    <article class="ops-metric" id="metric-requests"><span>今日请求</span><strong>--</strong><small>最近 24 小时</small></article>
                    <article class="ops-metric" id="metric-tokens"><span>今日 Token</span><strong>--</strong><small>输入与输出</small></article>
                    <article class="ops-metric" id="metric-cost"><span>预估成本</span><strong>--</strong><small>USD</small></article>
                    <article class="ops-metric" id="metric-success"><span>成功率</span><strong>--</strong><small>HTTP &lt; 400</small></article>
                    <article class="ops-metric" id="metric-p95"><span>P95 延迟</span><strong>--</strong><small>端到端</small></article>
                    <article class="ops-metric" id="metric-keys"><span>有效 Key / 总数</span><strong>-- / --</strong><small>冷却 --</small></article>
                    <article class="ops-metric" id="metric-endpoints"><span>可用端点 / 总数</span><strong>-- / --</strong><small>实时健康</small></article>
                    <article class="ops-metric metric-alert" id="metric-errors"><span>异常请求</span><strong>--</strong><small>最近 24 小时</small></article>
                </section>

                <div class="ops-layout">
                    <div class="ops-primary">
                        <section class="panel chart-panel">
                            <div class="panel-heading"><div><span class="panel-kicker">TRAFFIC</span><h3>请求量与错误率</h3></div></div>
                            <div id="chart-requests" class="chart-surface"></div>
                        </section>
                        <section class="panel chart-panel">
                            <div class="panel-heading"><div><span class="panel-kicker">CONSUMPTION</span><h3>Token 与成本</h3></div></div>
                            <div id="chart-token-cost" class="chart-surface"></div>
                        </section>
                        <div class="ops-lower-grid">
                            <section class="panel">
                                <div class="panel-heading"><div><span class="panel-kicker">MODELS</span><h3>模型请求分布</h3></div></div>
                                <div id="chart-model-share" class="chart-surface chart-compact"></div>
                            </section>
                            <section class="panel">
                                <div class="panel-heading"><div><span class="panel-kicker">HEALTH</span><h3>端点与 Key</h3></div></div>
                                <div id="endpoint-health-matrix" class="health-matrix"></div>
                            </section>
                        </div>
                    </div>

                    <aside class="panel request-stream">
                        <div class="panel-heading request-stream-heading">
                            <div><span class="panel-kicker">LIVE REQUESTS</span><h3>最近请求流</h3></div>
                            <button class="icon-btn" id="btn-log-pause" title="暂停日志" aria-label="暂停日志"><i data-lucide="pause"></i></button>
                        </div>
                        <div class="request-filters">
                            <input id="request-log-model" type="search" placeholder="模型">
                            <select id="request-log-status"><option value="">全部状态</option><option value="200">200</option><option value="400">4xx</option><option value="500">5xx</option></select>
                            <select id="request-log-path"><option value="">全部接口</option><option value="/v1/chat/completions">Chat</option><option value="/v1/responses">Responses</option><option value="/v1/images/generations">Images</option></select>
                        </div>
                        <div class="request-table-wrap">
                            <table class="request-table">
                                <thead><tr><th>时间</th><th>状态</th><th>模型</th><th>耗时</th><th>Token</th></tr></thead>
                                <tbody id="request-log-table"><tr><td colspan="5" class="muted-cell">等待请求...</td></tr></tbody>
                            </table>
                        </div>
                    </aside>
                </div>

                <div id="summary-cards" hidden></div>
                <div id="status-container" hidden></div>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 2: 模型管理（左右分栏） -->
            <!-- ================================================================ -->
            <div class="page" id="page-models">
                <section class="workspace model-workspace" id="model-workspace">
                    <header class="workspace-header">
                        <div><span class="eyebrow">ROUTING CATALOG</span><h2>模型与路由规则</h2><p>集中维护匹配规则、转发端点、重定向和 Key。</p></div>
                        <button class="btn btn-primary" id="btn-create-model"><i data-lucide="plus"></i>新建模型</button>
                    </header>
                    <div class="model-master-detail">
                        <aside class="workspace-panel model-list-panel" id="model-list-panel">
                            <div class="panel-tools">
                                <div class="search-control"><i data-lucide="search"></i><input type="search" id="model-filter" placeholder="搜索模型"></div>
                            </div>
                            <div class="model-list-scroll" id="model-list"></div>
                        </aside>
                        <section class="workspace-panel model-detail-panel" id="model-detail-panel">
                            <div id="model-detail">
                                <div class="empty-state"><i data-lucide="mouse-pointer-click"></i><p>选择模型查看路由详情</p></div>
                            </div>
                        </section>
                    </div>
                </section>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 3: 端点管理（端点维度） -->
            <!-- ================================================================ -->
            <div class="page" id="page-endpoints">
                <section class="workspace" id="endpoint-workspace">
                    <header class="workspace-header">
                        <div><span class="eyebrow">UPSTREAM OPERATIONS</span><h2>端点与端点池</h2><p>查看实际转发健康度，并在线维护共享端点池、引用关系和 Key。</p></div>
                        <div class="workspace-actions">
                            <button class="btn btn-primary" id="btn-create-pool" style="display:none;"><i data-lucide="plus"></i>新建端点池</button>
                            <button class="icon-btn" id="btn-ep-refresh" title="刷新端点" aria-label="刷新端点"><i data-lucide="refresh-cw"></i></button>
                        </div>
                    </header>
                    <div class="view-tabs" id="endpoint-view-tabs">
                        <button class="active" data-endpoint-view="runtime"><i data-lucide="activity"></i>运行端点</button>
                        <button data-endpoint-view="pool"><i data-lucide="database"></i>共享端点池</button>
                    </div>
                    <div id="endpoint-runtime-view">
                        <div class="workspace-panel">
                            <div class="data-toolbar">
                                <div class="filter-control"><label for="ep-filter-model">模型</label><select id="ep-filter-model"><option value="all">全部模型</option></select></div>
                                <div class="filter-control"><label for="ep-filter-status">状态</label><select id="ep-filter-status"><option value="all">全部状态</option><option value="healthy">健康</option><option value="warning">部分可用</option><option value="down">不可用</option></select></div>
                                <div class="data-toolbar-summary" id="endpoint-filter-summary">等待端点数据</div>
                            </div>
                            <div class="endpoint-table" id="endpoint-table">
                                <div id="endpoint-list"><div class="empty-state"><i data-lucide="loader-circle"></i><p>正在加载端点</p></div></div>
                            </div>
                        </div>
                    </div>
                    <div id="endpoint-pool-view" hidden>
                        <div class="workspace-panel">
                            <div class="data-toolbar pool-toolbar">
                                <div><strong>共享端点池</strong><span>一个池可被多个模型复用，Key 状态实时同步。</span></div>
                                <div class="data-toolbar-summary" id="endpoint-pool-summary">等待端点池数据</div>
                            </div>
                            <div id="endpoint-pool-list"><div class="empty-state"><i data-lucide="loader-circle"></i><p>正在加载端点池</p></div></div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 4: Token 统计 -->
            <!-- ================================================================ -->
            <div class="page" id="page-token">
                <section class="workspace token-workspace" id="token-workspace">
                    <header class="workspace-header token-header">
                        <div><span class="eyebrow">USAGE & SPEND</span><h2>Token 与成本</h2><p>按统一时间范围查看用量、请求速率、模型占比和预估费用。</p></div>
                        <div class="token-controls">
                            <select id="token-model"><option value="all">全部模型</option></select>
                            <div class="btn-group" id="token-range-group" aria-label="统计范围">
                                <button class="active" data-range="1h">1 小时</button>
                                <button data-range="5h">5 小时</button>
                                <button data-range="1d">1 天</button>
                                <button data-range="7d">7 天</button>
                                <button data-range="30d">30 天</button>
                            </div>
                        </div>
                    </header>
                    <div class="token-overview" id="token-overview"><div id="token-summary-cards"></div></div>
                    <div class="token-analysis-grid">
                        <section class="workspace-panel token-trend-panel" id="token-trend-panel">
                            <div class="panel-heading"><div><span class="panel-kicker">TOKEN VOLUME</span><h3>Token 消耗趋势</h3></div><span class="panel-note" id="token-range-label">最近 1 小时</span></div>
                            <div id="chart-bar" class="analysis-chart chart-wide"></div>
                        </section>
                        <section class="workspace-panel">
                            <div class="panel-heading"><div><span class="panel-kicker">MODEL SHARE</span><h3>模型消耗占比</h3></div></div>
                            <div id="chart-pie" class="analysis-chart"></div>
                        </section>
                        <section class="workspace-panel">
                            <div class="panel-heading"><div><span class="panel-kicker">REQUEST RATE</span><h3>请求数趋势</h3></div></div>
                            <div id="chart-line" class="analysis-chart"></div>
                        </section>
                    </div>
                    <section class="workspace-panel cost-breakdown-panel" id="cost-breakdown-panel">
                        <div class="panel-heading"><div><span class="panel-kicker">COST BREAKDOWN</span><h3>模型定价与成本明细</h3></div><span class="panel-note">USD，按模型目录估算</span></div>
                        <div class="table-wrap" id="pricing-table-container"><p class="muted-cell">加载中...</p></div>
                    </section>
                </section>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 5: 配置编辑 -->
            <!-- ================================================================ -->
            <div class="page" id="page-config">
                <section class="workspace config-workspace" id="config-workspace">
                    <header class="workspace-header">
                        <div><span class="eyebrow">ROUTER CONFIGURATION</span><h2>配置文件</h2><p>编辑并校验当前 config.yaml，保存后立即重新加载路由。</p></div>
                        <div class="workspace-actions">
                            <button class="btn btn-outline" id="btn-load-config"><i data-lucide="rotate-ccw"></i>重新加载</button>
                            <button class="icon-btn" id="btn-download-config" title="下载配置" aria-label="下载配置"><i data-lucide="download"></i></button>
                            <button class="btn btn-primary" id="btn-save-config"><i data-lucide="save"></i>保存配置</button>
                        </div>
                    </header>
                    <section class="workspace-panel config-editor-panel" id="config-editor-panel">
                        <div class="config-editor-bar"><span class="config-file-name">config.yaml</span><div id="config-status">尚未加载</div></div>
                        <textarea id="config-editor"></textarea>
                    </section>
                </section>
            </div>

        </div>
    </div>

    <!-- Toast + Modal 容器 -->
    <div class="toast-container" id="toast-container"></div>
    <div id="modal-container"></div>

    <script src="/admin/assets/admin.js"></script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache, no-store, must-revalidate",
        },
    });
}
