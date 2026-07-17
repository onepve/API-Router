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
            <span class="logo-icon">🔧</span>
            API Router
            <span class="sub">v1.0</span>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
            <button class="active" data-page="dashboard"><span class="nav-icon">📊</span> <span>仪表盘</span></button>
            <button data-page="models"><span class="nav-icon">📦</span> <span>模型管理</span></button>
            <button data-page="endpoints"><span class="nav-icon">🔗</span> <span>端点管理</span></button>
            <button data-page="token"><span class="nav-icon">📈</span> <span>Token 统计</span></button>
            <button data-page="config"><span class="nav-icon">⚙️</span> <span>配置编辑</span></button>
        </nav>
        <div class="sidebar-footer">
            <span class="status-dot"></span> 运行中
        </div>
    </aside>

    <!-- ====== 主内容 ====== -->
    <div class="main">
        <header class="main-header">
            <button class="icon-btn mobile-nav-toggle" id="mobile-nav-toggle" title="打开导航" aria-label="打开导航"><i data-lucide="menu"></i></button>
            <h1 id="page-title">📊 仪表盘</h1>
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
                <div class="split-view">
                    <div class="split-left">
                        <div class="card" style="padding:12px;">
                            <input type="text" class="filter-input" id="model-filter" placeholder="🔍 搜索模型..." style="max-width:100%;margin-bottom:10px;">
                            <div id="model-list" style="max-height:calc(100vh - 200px);overflow-y:auto;"></div>
                            <button class="btn btn-primary btn-sm" id="btn-create-model" style="width:100%;margin-top:10px;">➕ 新建模型</button>
                        </div>
                    </div>
                    <div class="split-right">
                        <div id="model-detail">
                            <div class="empty-state"><div class="ico">👈</div><p>选择一个模型查看详情</p></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 3: 端点管理（端点维度） -->
            <!-- ================================================================ -->
            <div class="page" id="page-endpoints">
                <div class="toolbar">
                    <div class="toolbar-left">
                        <select id="ep-filter-model" style="max-width:200px;">
                            <option value="all">📊 全部模型</option>
                        </select>
                        <select id="ep-filter-status" style="max-width:140px;">
                            <option value="all">全部状态</option>
                            <option value="healthy">✓ 健康</option>
                            <option value="warning">⚠️ 警告</option>
                            <option value="down">✗ 不可用</option>
                        </select>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-sm btn-ghost" id="btn-ep-refresh" title="刷新">🔄</button>
                    </div>
                </div>
                <div id="endpoint-list"></div>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 4: Token 统计 -->
            <!-- ================================================================ -->
            <div class="page" id="page-token">
                <div class="toolbar">
                    <div class="toolbar-left">
                        <select id="token-model" style="max-width:220px;">
                            <option value="all">📊 全部模型</option>
                        </select>
                        <div class="btn-group" id="token-range-group">
                            <button class="active" data-range="1h">1 小时</button>
                            <button data-range="5h">5 小时</button>
                            <button data-range="1d">1 天</button>
                            <button data-range="7d">7 天</button>
                            <button data-range="30d">30 天</button>
                        </div>
                    </div>
                </div>
                <div class="stat-grid" id="token-summary-cards"></div>
                <div class="card"><div class="card-title" style="font-size:0.9rem;margin-bottom:8px;">📊 Token 消耗趋势</div><div id="chart-bar" style="width:100%;height:280px;"></div></div>
                <div class="card"><div class="card-title" style="font-size:0.9rem;margin-bottom:8px;">📈 请求数趋势</div><div id="chart-line" style="width:100%;height:280px;"></div></div>
                <div class="card"><div class="card-title" style="font-size:0.9rem;margin-bottom:8px;">🥧 各模型消耗占比</div><div id="chart-pie" style="width:100%;height:280px;"></div></div>
                <div class="card">
                    <div class="card-title" style="font-size:0.9rem;margin-bottom:8px;">💵 模型定价 & 成本明细</div>
                    <div class="table-wrap" id="pricing-table-container">
                        <p style="color:var(--text-muted);font-size:0.82rem;">加载中...</p>
                    </div>
                </div>
            </div>

            <!-- ================================================================ -->
            <!-- 页面 5: 配置编辑 -->
            <!-- ================================================================ -->
            <div class="page" id="page-config">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">⚙️ 编辑配置文件 (config.yaml)</div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-sm btn-outline" id="btn-load-config">📥 加载</button>
                            <button class="btn btn-sm btn-outline" id="btn-download-config">⬇️ 下载</button>
                            <button class="btn btn-sm btn-primary" id="btn-save-config">💾 保存</button>
                        </div>
                    </div>
                    <textarea id="config-editor"></textarea>
                    <div id="config-status" style="margin-top:12px;"></div>
                </div>
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
