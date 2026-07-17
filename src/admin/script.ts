export function getAdminScriptResponse(): Response {
    const script = String.raw`        (function() {
            'use strict';

            const BASE = '';
            const API = {
                AUTH_CHECK: BASE + '/admin/auth-check',
                STATUS: BASE + '/admin/status',
                DASHBOARD: BASE + '/admin/dashboard-summary',
                REQUEST_LOGS: BASE + '/admin/request-logs',
                TOKEN_STATS: BASE + '/admin/token-stats',
                TOKEN_COST: BASE + '/admin/token-stats/cost',
                REMOVE_KEY: BASE + '/admin/remove-key',
                CONFIG: BASE + '/admin/config',
                MODELS: BASE + '/admin/api/models',
                POOL: BASE + '/admin/api/endpoint-pool',
            };

            let authToken = null;
            let autoRefreshInterval = null;
            let autoRefreshEnabled = true;
            let currentStatusData = null;
            let refreshCountdown = 0;
            let countdownInterval = null;
            let selectedModelName = null;
            let dashboardCharts = {};
            let requestLogRows = [];
            let latestLogId = 0;
            let requestLogPaused = false;
            let requestLogInterval = null;
            let configDirty = false;
            let loadingConfig = false;

            // ======================== Toast ========================
            function showToast(message, type, duration) {
                type = type || 'info';
                duration = duration || 3000;
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = 'toast toast-' + type;
                const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
                toast.innerHTML = (icons[type] || '') + ' ' + message;
                container.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, duration);
                setTimeout(() => toast.remove(), duration + 300);
            }

            // ======================== Modal ========================
            function openModal(title, bodyHtml, footerHtml) {
                const container = document.getElementById('modal-container');
                container.innerHTML =
                    '<div class="modal-overlay" id="modal-overlay">' +
                    '<div class="modal">' +
                    '<div class="modal-header"><h2>' + title + '</h2><button class="modal-close" id="modal-close-btn">✕</button></div>' +
                    '<div class="modal-body">' + bodyHtml + '</div>' +
                    (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
                    '</div></div>';
                var overlay = document.getElementById('modal-overlay');
                var closeBtn = document.getElementById('modal-close-btn');
                if (overlay) overlay.onclick = function(e) { if (e.target === this) closeModal(); };
                if (closeBtn) closeBtn.onclick = closeModal;
                setTimeout(function() {
                    var cancelBtns = container.querySelectorAll('.modal-footer .btn-outline');
                    cancelBtns.forEach(function(btn) { btn.onclick = closeModal; });
                }, 0);
                return container.querySelector('.modal');
            }
            function closeModal() {
                document.getElementById('modal-container').innerHTML = '';
            }
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeModal();
            });

            function confirmAction(message, confirmText, danger) {
                return new Promise(function(resolve) {
                    var icon = danger ? '⚠️' : 'ℹ️';
                    var btnClass = danger ? 'btn-danger' : 'btn-primary';
                    openModal('确认操作',
                        '<div class="confirm-body"><div class="ico">' + icon + '</div><p>' + message + '</p></div>',
                        '<button class="btn btn-outline" id="confirm-cancel">取消</button>' +
                        '<button class="btn ' + btnClass + '" id="confirm-ok">' + (confirmText || '确认') + '</button>'
                    );
                    setTimeout(function() {
                        document.getElementById('confirm-cancel').onclick = function() { closeModal(); resolve(false); };
                        document.getElementById('confirm-ok').onclick = function() { closeModal(); resolve(true); };
                    }, 0);
                });
            }

            // ======================== Auth Fetch ========================
            async function authFetch(url, options) {
                options = options || {};
                var headers = Object.assign({}, options.headers || {});
                if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
                var res = await fetch(url, Object.assign({}, options, { headers: headers }));
                if (res.status === 401) {
                    showToast('会话已过期，请重新验证', 'error');
                    showAuthModal();
                    throw new Error('Unauthorized');
                }
                return res;
            }

            // ======================== Auth ========================
            var authModal = document.getElementById('auth-modal');
            var authKeyInput = document.getElementById('auth-key-input');
            var authSubmit = document.getElementById('auth-submit');

            function showAuthModal() { authModal.style.display = 'flex'; }
            function hideAuthModal() { authModal.style.display = 'none'; }

            authSubmit.addEventListener('click', async function() {
                var key = authKeyInput.value.trim();
                if (!key) { showToast('请输入密钥', 'warning'); return; }
                try {
                    var testRes = await fetch(API.STATUS, {
                        headers: { 'Authorization': 'Bearer ' + key }
                    });
                    if (testRes.ok) {
                        authToken = key;
                        localStorage.setItem('admin_auth_key', key);
                        hideAuthModal();
                        initApp();
                    } else {
                        showToast('密钥无效，请重试', 'error');
                        authKeyInput.value = '';
                    }
                } catch (e) {
                    showToast('网络错误', 'error');
                }
            });

            authKeyInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') authSubmit.click();
            });

            async function checkAuthAndInit() {
                try {
                    var res = await fetch(API.AUTH_CHECK);
                    var data = await res.json();
                    if (data.required) {
                        var savedKey = localStorage.getItem('admin_auth_key');
                        if (savedKey) {
                            authToken = savedKey;
                            var testRes = await fetch(API.STATUS, {
                                headers: { 'Authorization': 'Bearer ' + savedKey }
                            });
                            if (testRes.ok) {
                                hideAuthModal();
                                initApp();
                                return;
                            } else {
                                localStorage.removeItem('admin_auth_key');
                                authToken = null;
                            }
                        }
                        showAuthModal();
                    } else {
                        hideAuthModal();
                        initApp();
                    }
                } catch (e) {
                    showToast('初始化失败: ' + e.message, 'error');
                }
            }

            // ======================== 页面导航（侧边栏） ========================
            function switchPage(pageName) {
                var activePage = document.querySelector('.page.active');
                if (activePage && activePage.id === 'page-config' && pageName !== 'config' && configDirty) {
                    if (!window.confirm('配置尚未保存，确认离开？')) return;
                }
                document.querySelectorAll('.sidebar-nav button').forEach(function(b) {
                    b.classList.toggle('active', b.dataset.page === pageName);
                });
                document.querySelectorAll('.page').forEach(function(p) {
                    p.classList.toggle('active', p.id === 'page-' + pageName);
                });
                var titles = { dashboard:'仪表盘', models:'模型', endpoints:'端点', token:'Token 与成本', config:'配置' };
                document.getElementById('page-title').textContent = titles[pageName] || pageName;
                sessionStorage.setItem('active_page', pageName);

                if (pageName === 'token') {
                    setTimeout(function() {
                        if (currentStatusData) updateModelSelect(currentStatusData);
                        loadTokenCharts();
                    }, 50);
                }
                if (pageName === 'config') { setTimeout(function(){ initCodeMirror(); loadConfigToEditor(); }, 50); }
                if (pageName === 'endpoints') {
                    setTimeout(function(){
                        var activeEndpointView = document.querySelector('#endpoint-view-tabs button.active');
                        switchEndpointView(activeEndpointView ? activeEndpointView.dataset.endpointView : 'runtime');
                    }, 50);
                }
                if (pageName === 'models' && selectedModelName) {
                    setTimeout(function(){ loadModelDetail(selectedModelName); }, 50);
                }
                if (window.innerWidth <= 600) document.getElementById('sidebar').classList.remove('open');
                refreshIcons();
            }

            document.querySelectorAll('.sidebar-nav button').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchPage(btn.dataset.page);
                });
            });

            // ======================== 工具函数 ========================
            function escapeHtml(text) {
                if (text === null || text === undefined) return '';
                var div = document.createElement('div');
                div.textContent = String(text);
                return div.innerHTML;
            }

            function formatTime(ts) {
                if (!ts) return '--';
                return new Date(ts).toLocaleString('zh-CN');
            }

            function getMatchType(name) {
                if (!name) return '精确';
                if (name === '*') return '全部';
                if (name.startsWith('^')) return '正则';
                if (name.endsWith('*')) return '前缀';
                return '精确';
            }

            /** 从状态数据更新 Token 统计页面的模型选择下拉框 */
            function updateModelSelect(statusData) {
                if (!statusData) return;
                var select = document.getElementById('token-model');
                if (!select) return;
                var currentVal = select.value;
                var modelSet = new Set();
                modelSet.add('all');
                for (var key in statusData) {
                    if (key === '_summary') continue;
                    var name = extractModelPattern(key);
                    if (name) modelSet.add(name);
                }
                select.innerHTML = '';
                modelSet.forEach(function(m) {
                    var opt = document.createElement('option');
                    opt.value = m === 'all' ? 'all' : m;
                    opt.textContent = m === 'all' ? '📊 全部模型' : m;
                    select.appendChild(opt);
                });
                if (currentVal && modelSet.has(currentVal)) select.value = currentVal;
            }

            function refreshIcons() {
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
                }
            }

            function setMetric(id, value, detail) {
                var node = document.getElementById(id);
                if (!node) return;
                var strong = node.querySelector('strong');
                var small = node.querySelector('small');
                if (strong) strong.textContent = value;
                if (small && detail !== undefined) small.textContent = detail;
            }

            function initDashboardChart(id) {
                var node = document.getElementById(id);
                if (!node || !window.echarts) return null;
                if (!dashboardCharts[id]) dashboardCharts[id] = window.echarts.init(node);
                return dashboardCharts[id];
            }

            function chartFallback(id, message) {
                var node = document.getElementById(id);
                if (node && !window.echarts) {
                    node.innerHTML = '<div class="empty-state"><p>' + escapeHtml(message) + '</p></div>';
                }
            }

            async function loadDashboardSummary() {
                try {
                    var responses = await Promise.all([
                        authFetch(API.DASHBOARD + '?window=24h'),
                        authFetch(API.TOKEN_STATS + '/hourly?hours=24'),
                    ]);
                    if (!responses[0].ok) throw new Error('HTTP ' + responses[0].status);
                    var summary = await responses[0].json();
                    var tokenTimeline = responses[1].ok ? await responses[1].json() : [];
                    renderDashboardSummary(summary, tokenTimeline);
                    document.getElementById('last-updated').textContent = '更新于 ' + formatTime(Date.now());
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        document.getElementById('last-updated').textContent = '数据已过期';
                        showToast('仪表盘更新失败: ' + err.message, 'warning');
                    }
                }
            }

            function renderDashboardSummary(data, tokenTimeline) {
                setMetric('metric-requests', Number(data.request_count || 0).toLocaleString(), '最近 24 小时');
                setMetric('metric-tokens', fmtUnit(data.total_tokens || 0), '输入与输出');
                setMetric('metric-cost', '$' + Number(data.total_cost_usd || 0).toFixed(4), '预估 USD');
                setMetric('metric-success', Number(data.success_rate || 0).toFixed(2) + '%', 'HTTP < 400');
                setMetric('metric-p95', formatDuration(data.p95_latency_ms || 0), '端到端');
                setMetric('metric-keys', (data.active_keys || 0) + ' / ' + (data.total_keys || 0), '冷却 ' + (data.cooling_keys || 0));
                setMetric('metric-endpoints', (data.available_endpoints || 0) + ' / ' + (data.total_endpoints || 0), '实时健康');
                setMetric('metric-errors', Number(data.error_count || 0).toLocaleString(), '最近 24 小时');
                renderRequestChart(data.timeline || []);
                renderTokenCostChart(tokenTimeline || [], data.total_cost_usd || 0);
                renderModelShareChart(data.models || []);
            }

            function renderRequestChart(timeline) {
                var chart = initDashboardChart('chart-requests');
                if (!chart) { chartFallback('chart-requests', '图表组件未加载'); return; }
                chart.setOption({
                    animationDuration: 260,
                    grid: { left: 46, right: 18, top: 20, bottom: 28 },
                    tooltip: { trigger: 'axis' },
                    legend: { right: 14, top: 2, itemWidth: 10, textStyle: { fontSize: 10 } },
                    xAxis: { type: 'category', data: timeline.map(function(item) { return item.bucket.slice(11); }), axisLabel: { fontSize: 9 }, axisTick: { show: false } },
                    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: '#edf0f2' } } },
                    series: [
                        { name: '请求', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#167c73' }, areaStyle: { color: 'rgba(22,124,115,.08)' }, data: timeline.map(function(item) { return item.requestCount; }) },
                        { name: '异常', type: 'bar', barMaxWidth: 10, itemStyle: { color: '#c84a42' }, data: timeline.map(function(item) { return item.errorCount; }) },
                    ],
                }, true);
            }

            function renderTokenCostChart(timeline, totalCost) {
                var chart = initDashboardChart('chart-token-cost');
                if (!chart) { chartFallback('chart-token-cost', '图表组件未加载'); return; }
                chart.setOption({
                    animationDuration: 260,
                    grid: { left: 58, right: 20, top: 28, bottom: 28 },
                    tooltip: { trigger: 'axis', formatter: function(points) { return points[0].axisValue + '<br>Token: ' + Number(points[0].value).toLocaleString() + '<br>24h 成本: $' + Number(totalCost).toFixed(4); } },
                    xAxis: { type: 'category', data: timeline.map(function(item) { return item.date.slice(11, 16); }), axisLabel: { fontSize: 9 }, axisTick: { show: false } },
                    yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: fmtUnit }, splitLine: { lineStyle: { color: '#edf0f2' } } },
                    series: [{ type: 'bar', barMaxWidth: 16, itemStyle: { color: '#447aa8', borderRadius: [2, 2, 0, 0] }, data: timeline.map(function(item) { return item.totalTokens || 0; }) }],
                }, true);
            }

            function renderModelShareChart(models) {
                var chart = initDashboardChart('chart-model-share');
                if (!chart) { chartFallback('chart-model-share', '图表组件未加载'); return; }
                chart.setOption({
                    animationDuration: 260,
                    color: ['#167c73', '#447aa8', '#c27a21', '#6d6a9c', '#6e8797', '#c84a42'],
                    tooltip: { trigger: 'item' },
                    legend: { type: 'scroll', bottom: 2, textStyle: { fontSize: 9 } },
                    series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '43%'], label: { show: false }, data: models.map(function(item) { return { name: item.model, value: item.requestCount }; }) }],
                }, true);
            }

            function renderHealthMatrix(data) {
                var container = document.getElementById('endpoint-health-matrix');
                if (!container) return;
                var rows = [];
                Object.keys(data || {}).forEach(function(name) {
                    if (name === '_summary') return;
                    (data[name] || []).forEach(function(endpoint) {
                        var keys = endpoint.keys || {};
                        var total = keys.total || 0;
                        var active = keys.active || 0;
                        var health = total > 0 ? Math.round(active / total * 100) : 0;
                        rows.push('<div class="health-row" title="' + escapeHtml(endpoint.base_url || '') + '">' +
                            '<span class="health-name">' + escapeHtml(extractModelPattern(name)) + '</span>' +
                            '<span class="health-meter"><span style="width:' + health + '%;background:' + (health >= 80 ? '#2f8f62' : health >= 50 ? '#c27a21' : '#c84a42') + '"></span></span>' +
                            '<span class="health-keys">' + active + ' / ' + total + '</span></div>');
                    });
                });
                container.innerHTML = rows.length ? rows.join('') : '<div class="empty-state"><p>暂无端点</p></div>';
            }

            function formatDuration(ms) {
                if (ms >= 1000) return (ms / 1000).toFixed(ms >= 10_000 ? 0 : 1) + 's';
                return Math.round(ms) + 'ms';
            }

            function resetRequestLogs() {
                requestLogRows = [];
                latestLogId = 0;
                renderRequestLogs();
                loadRequestLogs();
            }

            async function loadRequestLogs() {
                if (requestLogPaused) return;
                try {
                    var url = API.REQUEST_LOGS + '?after=' + latestLogId + '&limit=100';
                    var model = document.getElementById('request-log-model').value.trim();
                    var path = document.getElementById('request-log-path').value;
                    if (model) url += '&model=' + encodeURIComponent(model);
                    if (path) url += '&path=' + encodeURIComponent(path);
                    var response = await authFetch(url);
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    var data = await response.json();
                    if (data.latest_id < latestLogId) requestLogRows = [];
                    latestLogId = data.latest_id || 0;
                    if (data.records && data.records.length) {
                        var known = new Set(requestLogRows.map(function(row) { return row.id; }));
                        data.records.forEach(function(row) { if (!known.has(row.id)) requestLogRows.push(row); });
                        if (requestLogRows.length > 200) requestLogRows = requestLogRows.slice(-200);
                    }
                    renderRequestLogs();
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        var table = document.getElementById('request-log-table');
                        if (table && requestLogRows.length === 0) table.innerHTML = '<tr><td colspan="5" class="muted-cell">日志暂不可用</td></tr>';
                    }
                }
            }

            function renderRequestLogs() {
                var table = document.getElementById('request-log-table');
                if (!table) return;
                var statusFilter = document.getElementById('request-log-status').value;
                var rows = requestLogRows.filter(function(row) {
                    if (statusFilter === '400') return row.status >= 400 && row.status < 500;
                    if (statusFilter === '500') return row.status >= 500;
                    if (statusFilter) return String(row.status) === statusFilter;
                    return true;
                }).slice().reverse();
                if (!rows.length) {
                    table.innerHTML = '<tr><td colspan="5" class="muted-cell">等待匹配的请求...</td></tr>';
                    return;
                }
                table.innerHTML = rows.map(function(row) {
                    var statusClass = row.status >= 500 ? 'error' : row.status >= 400 ? 'warn' : '';
                    var errorClass = row.status >= 400 ? ' is-error' : '';
                    return '<tr class="request-row' + errorClass + '" data-log-id="' + row.id + '">' +
                        '<td>' + new Date(row.timestamp).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</td>' +
                        '<td><span class="status-code ' + statusClass + '">' + row.status + '</span></td>' +
                        '<td><span class="request-model">' + escapeHtml(row.resolvedModel || row.originalModel) + '</span><span class="request-path">' + escapeHtml(row.path) + '</span></td>' +
                        '<td>' + formatDuration(row.durationMs || 0) + '</td>' +
                        '<td>' + (row.totalTokens === undefined ? '—' : fmtUnit(row.totalTokens)) + '</td></tr>' +
                        '<tr class="request-detail" data-detail-id="' + row.id + '" hidden><td colspan="5">' +
                        '原始模型: ' + escapeHtml(row.originalModel) + '<br>' +
                        '上游: ' + escapeHtml(row.upstreamBaseUrl || '未选择') + '<br>' +
                        '模式: ' + (row.stream ? '流式' : '非流式') + ' · 重试: ' + row.retryCount +
                        (row.error ? '<br>错误: ' + escapeHtml(row.error) : '') + '</td></tr>';
                }).join('');
                table.querySelectorAll('.request-row').forEach(function(row) {
                    row.addEventListener('click', function() {
                        var detail = table.querySelector('[data-detail-id="' + row.dataset.logId + '"]');
                        if (detail) detail.hidden = !detail.hidden;
                    });
                });
            }

            function startRequestLogPolling() {
                if (requestLogInterval) clearInterval(requestLogInterval);
                requestLogInterval = setInterval(loadRequestLogs, 2000);
                loadRequestLogs();
            }

            // ======================== 仪表盘 ========================
            async function loadStatus() {
                try {
                    var res = await authFetch(API.STATUS);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    currentStatusData = await res.json();
                    renderSummary(currentStatusData);
                    renderDashboardStatus(currentStatusData);
                    renderHealthMatrix(currentStatusData);
                    updateModelSelect(currentStatusData);
                    document.getElementById('last-updated').textContent = '更新于 ' + formatTime(Date.now());
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        document.getElementById('status-container').innerHTML =
                            '<div class="empty-state"><div class="ico">❌</div><p>加载失败: ' + escapeHtml(err.message) + '</p></div>';
                    }
                }
            }

            function renderSummary(data) {
                var models, endpoints, activeKeys, totalKeys;
                // 优先使用后端去重汇总（适配端点池共享架构）
                if (data._summary) {
                    var s = data._summary;
                    models = s.models; endpoints = s.endpoints;
                    activeKeys = s.active_keys; totalKeys = s.total_keys;
                } else {
                    models = 0; endpoints = 0; activeKeys = 0; totalKeys = 0;
                    for (var modelName in data) {
                        if (modelName === '_summary') continue;
                        models++;
                        var eps = data[modelName] || [];
                        endpoints += eps.length;
                        eps.forEach(function(ep) {
                            var k = ep.keys || {};
                            totalKeys += k.total || 0;
                            activeKeys += k.active || 0;
                        });
                    }
                }
                var healthPct = totalKeys > 0 ? Math.round(activeKeys / totalKeys * 100) : 0;
                document.getElementById('summary-cards').innerHTML =
                    '<div class="stat-card"><span class="ico">📦</span><div class="num">' + models + '</div><div class="lbl">模型</div></div>' +
                    '<div class="stat-card" style="border-left-color:#3b82f6;"><span class="ico">🔗</span><div class="num">' + endpoints + '</div><div class="lbl">端点</div></div>' +
                    '<div class="stat-card" style="border-left-color:#8b5cf6;"><span class="ico">🔑</span><div class="num">' + totalKeys + '</div><div class="lbl">Key</div></div>' +
                    '<div class="stat-card" style="border-left-color:' + (healthPct >= 50 ? '#059669' : '#d97706') + ';"><span class="ico">✅</span><div class="num">' + activeKeys + '<span style="font-size:0.8rem;font-weight:400;">/' + totalKeys + '</span></div><div class="lbl">活跃 Key (' + healthPct + '%)</div></div>' +
                    '<div class="stat-card" style="border-left-color:#6366f1;" id="today-token-card"><span class="ico">📊</span><div class="num">-</div><div class="lbl">今日 Token</div></div>' +
                    '<div class="stat-card" style="border-left-color:#ec4899;"><span class="ico">💰</span><div class="num" id="today-cost-num">-</div><div class="lbl">今日成本 (USD)</div></div>';
                document.getElementById('header-info').textContent = models + ' 个模型 · ' + totalKeys + ' 个密钥';

                authFetch(API.TOKEN_STATS + '/daily?days=1').then(function(r) { return r.json(); }).then(function(d) {
                    if (d && d.length > 0) {
                        document.getElementById('today-token-card').querySelector('.num').textContent = fmtUnit(d[0].totalTokens);
                    }
                }).catch(function(_) {});
                authFetch(API.TOKEN_COST + '?window=1d').then(function(r) { return r.json(); }).then(function(d) {
                    if (d && d.total_cost_usd !== undefined) {
                        document.getElementById('today-cost-num').textContent = '$' + d.total_cost_usd.toFixed(4);
                    }
                }).catch(function(_) {});
            }

            function extractModelPattern(displayName) {
                var m = displayName.match(/^\\[\\d+\\]\\s(.+?)\\s\\((.+?)\\)$/);
                if (m) {
                    var p = m[1];
                    if (m[2] === 'prefix') p += '*';
                    if (m[2] === 'regex') p = '^' + p;
                    return p;
                }
                return displayName;
            }

            function renderDashboardStatus(data) {
                var container = document.getElementById('status-container');
                if (!data || Object.keys(data).length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="ico">📭</div><p>暂无模型配置</p></div>';
                    return;
                }
                var html = '<div class="card" style="padding:0;"><table><thead><tr>' +
                    '<th>模型</th><th>匹配</th><th>端点</th><th>Key 健康</th><th>活跃/总数</th><th style="text-align:right;">操作</th></tr></thead><tbody>';
                var idx = 0;
                for (var modelName in data) {
                    if (modelName === '_summary') continue;
                    var pattern = extractModelPattern(modelName);
                    var endpoints = data[modelName] || [];
                    var totalEpKeys = 0, activeEpKeys = 0;
                    endpoints.forEach(function(ep) {
                        var k = ep.keys || {};
                        totalEpKeys += k.total || 0;
                        activeEpKeys += k.active || 0;
                    });
                    var health = totalEpKeys > 0 ? Math.round(activeEpKeys / totalEpKeys * 100) : 0;
                    var healthBadge = health >= 80 ? 'badge-green' : (health >= 50 ? 'badge-yellow' : 'badge-red');
                    html += '<tr>' +
                        '<td><strong>' + escapeHtml(modelName) + '</strong></td>' +
                        '<td><span class="badge badge-blue">' + escapeHtml(getMatchType(pattern)) + '</span></td>' +
                        '<td>' + (endpoints.length || 0) + '</td>' +
                        '<td><div class="progress-bar" style="width:80px;"><div class="fill" style="width:' + health + '%;background:' + (health >= 80 ? '#059669' : health >= 50 ? '#d97706' : '#dc2626') + ';"></div></div></td>' +
                        '<td><span class="badge ' + healthBadge + '">' + activeEpKeys + '/' + totalEpKeys + '</span></td>' +
                        '<td style="text-align:right;"><button class="btn btn-xs btn-ghost view-model-btn" data-pattern="' + escapeHtml(pattern) + '">查看</button></td></tr>';
                    idx++;
                }
                html += '</tbody></table></div>';
                container.innerHTML = html;
                container.querySelectorAll('.view-model-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        selectedModelName = btn.dataset.pattern;
                        switchPage('models');
                        loadModelDetail(selectedModelName);
                    });
                });
            }

            // ======================== 模型管理（左右分栏） ========================
            async function loadModels() {
                try {
                    var res = await authFetch(API.MODELS);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    var models = await res.json();
                    renderModelList(models);
                } catch (err) {
                    if (err.message !== 'Unauthorized') showToast('加载模型列表失败', 'error');
                }
            }

            function renderModelList(models) {
                var container = document.getElementById('model-list');
                var filter = (document.getElementById('model-filter').value || '').toLowerCase();
                var filtered = models;
                if (filter) {
                    filtered = models.filter(function(m) { return m.name.toLowerCase().includes(filter); });
                }
                if (!filtered || filtered.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding:20px 0;"><div class="ico" style="font-size:1.5rem;">📭</div><p style="font-size:0.85rem;">' + (filter ? '未匹配到模型' : '暂无模型') + '</p></div>';
                    return;
                }
                container.innerHTML = filtered.map(function(m) {
                    var active = selectedModelName === m.name ? 'active' : '';
                    var matchType = getMatchType(m.name);
                    var matchBadge = matchType === '精确' ? 'badge-blue' : (matchType === '前缀' ? 'badge-teal' : 'badge-yellow');
                    var refBadge = m.has_refs ? '<span class="badge badge-teal">池 ' + (m.endpoint_ref_count || 0) + '</span>' : '';
                    return '<div class="model-list-item ' + active + '" data-name="' + escapeHtml(m.name) + '">' +
                        '<span class="ml-name">' + escapeHtml(m.name) + '</span>' +
                        '<span class="ml-badges">' +
                        '<span class="badge ' + matchBadge + '">' + matchType + '</span>' +
                        refBadge +
                        '<span class="badge badge-gray">直 ' + (m.endpoint_count || 0) + '</span>' +
                        '<span class="badge badge-gray">Key ' + (m.key_count || 0) + '</span>' +
                        '</span></div>';
                }).join('');

                container.querySelectorAll('.model-list-item').forEach(function(item) {
                    item.addEventListener('click', function() {
                        container.querySelectorAll('.model-list-item').forEach(function(i) { i.classList.remove('active'); });
                        item.classList.add('active');
                        selectedModelName = item.dataset.name;
                        loadModelDetail(selectedModelName);
                    });
                });
                // 自动选中第一个
                if (!selectedModelName || !filtered.some(function(m) { return m.name === selectedModelName; })) {
                    var first = container.querySelector('.model-list-item');
                    if (first) { first.classList.add('active'); selectedModelName = first.dataset.name; loadModelDetail(selectedModelName); }
                }
            }

            async function loadModelDetail(name) {
                var detail = document.getElementById('model-detail');
                if (!name) { detail.innerHTML = '<div class="empty-state"><div class="ico">👈</div><p>选择一个模型查看详情</p></div>'; return; }
                detail.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner" style="width:24px;height:24px;border-width:3px;border-top-color:var(--primary);"></span></div>';
                try {
                    var encoded = encodeURIComponent(name);
                    var res = await authFetch(API.MODELS + '/' + encoded);
                    if (!res.ok) {
                        var errText = '';
                        try { errText = await res.text(); } catch(_) {}
                        detail.innerHTML = '<div class="empty-state"><div class="ico">❌</div><p>加载失败: HTTP ' + res.status + (errText ? ' (' + escapeHtml(errText.substring(0,80)) + ')' : '') + '</p></div>';
                        return;
                    }
                    var model = await res.json();
                    var epRes = await authFetch(API.MODELS + '/' + encoded + '/endpoints');
                    var endpoints = epRes.ok ? await epRes.json() : [];
                    renderModelDetail(model, endpoints);
                } catch (e) {
                    if (e.message !== 'Unauthorized') detail.innerHTML = '<div class="empty-state"><div class="ico">❌</div><p>加载失败: ' + escapeHtml(e.message) + '</p></div>';
                }
            }

            function renderModelDetail(model, endpoints) {
                var detail = document.getElementById('model-detail');
                var name = model.name;
                var matchType = getMatchType(name);
                var matchBadge = matchType === '精确' ? 'badge-blue' : (matchType === '前缀' ? 'badge-teal' : 'badge-yellow');
                var html = '<div class="model-detail-content">' +
                    '<div class="card-header">' +
                    '<div class="card-title"><i data-lucide="box"></i>' + escapeHtml(name) + ' <span class="badge ' + matchBadge + '">' + matchType + '</span></div>' +
                    '<div style="display:flex;gap:6px;">' +
                    '<button class="btn btn-sm btn-outline edit-model-btn" data-name="' + escapeHtml(name) + '"><i data-lucide="pencil"></i>编辑</button>' +
                    '<button class="btn btn-sm btn-danger del-model-btn" data-name="' + escapeHtml(name) + '"><i data-lucide="trash-2"></i>删除</button>' +
                    '</div></div>' +
                    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px;">';
                var fields = [
                    { label: '冷冻时间', value: model.cooldown_ms ? model.cooldown_ms + 'ms' : '默认(60000ms)' },
                    { label: '失败删除', value: model.delete_after_failure_ms ? model.delete_after_failure_ms + 'ms' : '默认(3600000ms)' },
                    { label: '超时', value: model.default_timeout ? model.default_timeout + 's' : '默认(120s)' },
                    { label: '最大重试', value: model.default_max_retries || '默认(3)' },
                ];
                fields.forEach(function(f) {
                    html += '<div style="padding:8px 12px;background:var(--primary-50);border-radius:6px;"><div style="font-size:0.72rem;color:var(--text-secondary);font-weight:600;">' + f.label + '</div><div style="font-size:0.88rem;font-weight:600;">' + f.value + '</div></div>';
                });
                html += '</div>';

                // 类型标签
                if (model.type && model.type.length > 0) {
                    html += '<div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">' + model.type.map(function(t) { return '<span class="badge badge-teal">' + escapeHtml(t) + '</span>'; }).join('') + '</div>';
                }

                // 重定向
                var displayRedirects = model.redirects && model.redirects.length > 0
                    ? model.redirects
                    : (model.redirect_to ? [{ pre: '*', to: model.redirect_to, weight: 1 }] : []);
                if (displayRedirects.length > 0) {
                    html += '<div style="margin-bottom:12px;"><span style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);">↳ 重定向规则:</span> ';
                    displayRedirects.forEach(function(r) {
                        html += '<span class="badge badge-yellow" style="margin-left:4px;">' + escapeHtml(r.pre) + ' → ' + escapeHtml(r.to) + ' (w:' + (r.weight||1) + ')</span>';
                    });
                    html += '</div>';
                }

                if (model.headers) {
                    var setHeaderNames = model.headers.set ? Object.keys(model.headers.set) : [];
                    var deleteHeaderNames = model.headers.delete || [];
                    html += '<div class="model-policy-row"><span>Headers 覆盖</span><div>' +
                        (setHeaderNames.length ? '<span class="badge badge-blue">设置 ' + setHeaderNames.length + '</span>' : '') +
                        (deleteHeaderNames.length ? '<span class="badge badge-gray">删除 ' + deleteHeaderNames.length + '</span>' : '') +
                        '</div></div>';
                }

                // 端点列表
                var totalEps = (endpoints.length || 0) + (model.endpoint_refs ? model.endpoint_refs.length : 0);
                html += '<div class="detail-section-title"><span>端点与 Key</span><strong>' + totalEps + '</strong></div>';
                // 共享端点（来自 endpoint_pool）
                if (model.endpoint_refs && model.endpoint_refs.length > 0) {
                    model.endpoint_refs.forEach(function(refName, refIdx) {
                        var poolEpId = 'pool-ep-' + refIdx;
                        html += '<div class="ep-card" style="border-left:3px solid var(--primary);">' +
                            '<div class="ep-header">' +
                            '<span class="ep-url">' + escapeHtml(refName) + '</span>' +
                            '<span class="badge badge-teal">端点池共享</span></div>' +
                            '<div id="' + poolEpId + '"></div>' +
                            '<div class="input-group" style="margin-top:8px;">' +
                            '<input type="text" id="pool-key-input-' + refIdx + '" placeholder="新增 Key 到 ' + escapeHtml(refName) + '..." style="font-size:0.82rem;">' +
                            '<button class="btn btn-sm btn-primary add-pool-key-btn" data-pool="' + escapeHtml(refName) + '" data-idx="' + refIdx + '">添加</button></div></div>';
                    });
                }
                // 模型独占端点
                if (!endpoints || endpoints.length === 0) {
                    if (!(model.endpoint_refs && model.endpoint_refs.length > 0)) {
                        html += '<div class="ep-card"><p style="color:var(--text-muted);font-size:0.82rem;">暂无端点</p></div>';
                    }
                } else {
                    endpoints.forEach(function(ep, i) {
                        html += '<div class="ep-card">' +
                            '<div class="ep-header">' +
                            '<span class="ep-url">' + escapeHtml(ep.base_url) + '</span>' +
                            '<span class="endpoint-card-actions"><span style="font-size:0.75rem;color:var(--text-secondary);">权重:' + (ep.weight||1) + ' 超时:' + (ep.timeout||'-') + 's</span>' +
                            '<button class="icon-btn edit-ep-btn" data-idx="' + i + '" title="编辑端点" aria-label="编辑端点"><i data-lucide="pencil"></i></button></span></div>';
                        // Keys
                        html += '<div id="ep-keys-' + i + '">';
                        // Load key status inline
                        html += '</div>' +
                            '<div class="input-group" style="margin-top:8px;">' +
                            '<input type="text" id="ep-key-input-' + i + '" placeholder="新增 API Key..." style="font-size:0.82rem;" class="key-input">' +
                            '<button class="btn btn-sm btn-primary add-ep-key-btn" data-model="' + escapeHtml(name) + '" data-idx="' + i + '">添加</button>' +
                            '<button class="icon-btn delete-ep-btn" data-model="' + escapeHtml(name) + '" data-idx="' + i + '" title="删除此端点" aria-label="删除此端点"><i data-lucide="trash-2"></i></button></div></div>';
                    });
                }

                // 添加端点按钮
                html += '<div style="margin-top:12px;text-align:center;"><button class="btn btn-sm btn-outline add-ep-btn" data-model="' + escapeHtml(name) + '"><i data-lucide="plus"></i>添加端点</button></div>';

                html += '</div>';
                detail.innerHTML = html;

                // 加载每个独占端点的 keys
                endpoints.forEach(function(ep, i) {
                    loadKeysForEndpointInline(name, i);
                });
                // 加载每个共享端点（池）的 keys
                if (model.endpoint_refs) {
                    model.endpoint_refs.forEach(function(refName, refIdx) {
                        loadPoolKeysInline(refName, refIdx);
                    });
                }

                // 绑定事件
                detail.querySelectorAll('.del-model-btn').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var c = await confirmAction('确认删除模型 <strong>' + escapeHtml(name) + '</strong>？', '确认删除', true);
                        if (!c) return;
                        var r = await authFetch(API.MODELS + '/' + encodeURIComponent(name), { method: 'DELETE' });
                        if (r.ok || r.status === 204) {
                            showToast('模型已删除', 'success');
                            selectedModelName = null;
                            loadModels();
                            loadStatus();
                        } else {
                            var errorBody = await r.json();
                            showToast('删除失败: ' + (errorBody.error || 'HTTP ' + r.status), 'error', 5000);
                        }
                    });
                });
                detail.querySelectorAll('.edit-model-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        openModelForm(model);
                    });
                });
                detail.querySelectorAll('.edit-ep-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        openEndpointForm(name, endpoints[parseInt(btn.dataset.idx)], false);
                    });
                });
                detail.querySelectorAll('.add-ep-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        openEndpointForm(name, null, false);
                    });
                });
                detail.querySelectorAll('.delete-ep-btn').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var idx = btn.dataset.idx;
                        var c = await confirmAction('确认删除端点 #' + idx + '？', '确认删除', true);
                        if (!c) return;
                        var r = await authFetch(API.MODELS + '/' + encodeURIComponent(name) + '/endpoints/' + idx, { method: 'DELETE' });
                        if (r.ok || r.status === 204) { showToast('端点已删除', 'success'); loadModelDetail(name); loadStatus(); }
                        else { showToast('删除失败', 'error'); }
                    });
                });
                detail.querySelectorAll('.add-ep-key-btn').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var idx = btn.dataset.idx;
                        var input = document.getElementById('ep-key-input-' + idx);
                        var key = input.value.trim();
                        if (!key) { showToast('请输入 Key', 'warning'); return; }
                        var r = await authFetch(API.MODELS + '/' + encodeURIComponent(name) + '/endpoints/' + idx + '/keys', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key })
                        });
                        if (r.ok || r.status === 201) { showToast('Key 已添加', 'success'); input.value = ''; loadModelDetail(name); loadStatus(); }
                        else { var e = await r.json(); showToast('添加失败: ' + (e.error || ''), 'error'); }
                    });
                });
                // 池端点 Key 事件
                detail.querySelectorAll('.add-pool-key-btn').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var poolName = btn.dataset.pool;
                        var refIdx = btn.dataset.idx;
                        var input = document.getElementById('pool-key-input-' + refIdx);
                        var key = input.value.trim();
                        if (!key) { showToast('请输入 Key', 'warning'); return; }
                        var r = await authFetch(API.POOL + '/' + encodeURIComponent(poolName) + '/keys', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key })
                        });
                        if (r.ok || r.status === 201) { showToast('Key 已添加到端点池', 'success'); input.value = ''; loadModelDetail(name); loadStatus(); }
                        else { var e = await r.json(); showToast('添加失败: ' + (e.error || ''), 'error'); }
                    });
                });
                refreshIcons();
            }

            /** 加载端点池 Key 状态（与模型独占端点类似，但调用池 API） */
            async function loadPoolKeysInline(poolName, refIdx) {
                var container = document.getElementById('pool-ep-' + refIdx);
                if (!container) return;
                try {
                    var res = await authFetch(API.POOL + '/' + encodeURIComponent(poolName));
                    if (!res.ok) { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem;padding:4px 0;">加载失败</p>'; return; }
                    var data = await res.json();
                    var keys = data.keys || [];
                    if (keys.length === 0) {
                        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem;padding:4px 0;">暂无密钥 (' + escapeHtml(data.base_url) + ')</p>';
                        return;
                    }
                    var html = '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:4px;">' + escapeHtml(data.base_url) + '</div>';
                    keys.forEach(function(k, i) {
                        var dotClass = k.active ? 'dot-green' : (k.cooldown ? 'dot-yellow' : 'dot-red');
                        var statusText = k.active ? '活跃' : (k.cooldown ? '冷却' : '失效');
                        html += '<div class="key-row">' +
                            '<span class="status-dot-sm ' + dotClass + '"></span>' +
                            '<span class="key-val" title="' + escapeHtml(k.key_preview) + '">' + escapeHtml(k.key_preview) + '</span>' +
                            '<span class="badge ' + (k.active ? 'badge-green' : k.cooldown ? 'badge-yellow' : 'badge-red') + '">' + statusText + '</span>' +
                            '<span class="key-actions"><button class="icon-btn del-pool-key-btn" title="删除 Key" aria-label="删除 Key" data-pool="' + escapeHtml(poolName) + '" data-key="' + i + '"><i data-lucide="trash-2"></i></button></span></div>';
                    });
                    container.innerHTML = html;
                    container.querySelectorAll('.del-pool-key-btn').forEach(function(btn) {
                        btn.addEventListener('click', async function() {
                            var c = await confirmAction('确认从端点池中删除此 Key？', '确认删除', true);
                            if (!c) return;
                            var r = await authFetch(API.POOL + '/' + encodeURIComponent(poolName) + '/keys/' + btn.dataset.key, { method: 'DELETE' });
                            if (r.ok || r.status === 204) { showToast('Key 已从端点池删除', 'success'); loadPoolKeysInline(poolName, refIdx); loadStatus(); }
                            else { showToast('删除失败', 'error'); }
                        });
                    });
                    refreshIcons();
                } catch (e) {
                    if (e.message !== 'Unauthorized') container.innerHTML = '<p style="color:var(--danger);font-size:0.78rem;">加载失败</p>';
                }
            }

            async function loadKeysForEndpointInline(modelName, epIdx) {
                var container = document.getElementById('ep-keys-' + epIdx);
                if (!container) return;
                try {
                    var res = await authFetch(API.MODELS + '/' + encodeURIComponent(modelName) + '/endpoints/' + epIdx + '/keys');
                    var keys = await res.json();
                    if (!keys || keys.length === 0) {
                        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem;padding:4px 0;">暂无密钥</p>';
                        return;
                    }
                    var html = '';
                    keys.forEach(function(k, i) {
                        var dotClass = k.active ? 'dot-green' : (k.cooldown ? 'dot-yellow' : 'dot-red');
                        var statusText = k.active ? '活跃' : (k.cooldown ? '冷却' : '失效');
                        html += '<div class="key-row">' +
                            '<span class="status-dot-sm ' + dotClass + '"></span>' +
                            '<span class="key-val" title="' + escapeHtml(k.key_preview) + '">' + escapeHtml(k.key_preview) + '</span>' +
                            '<span class="badge ' + (k.active ? 'badge-green' : k.cooldown ? 'badge-yellow' : 'badge-red') + '">' + statusText + '</span>' +
                            '<span class="key-actions"><button class="icon-btn del-key-btn" title="删除 Key" aria-label="删除 Key" data-model="' + escapeHtml(modelName) + '" data-ep="' + epIdx + '" data-key="' + i + '"><i data-lucide="trash-2"></i></button></span></div>';
                    });
                    container.innerHTML = html;

                    container.querySelectorAll('.del-key-btn').forEach(function(btn) {
                        btn.addEventListener('click', async function() {
                            var c = await confirmAction('确认删除此 Key？', '确认删除', true);
                            if (!c) return;
                            var r = await authFetch(API.MODELS + '/' + encodeURIComponent(modelName) + '/endpoints/' + epIdx + '/keys/' + btn.dataset.key, { method: 'DELETE' });
                            if (r.ok || r.status === 204) { showToast('Key 已删除', 'success'); loadModelDetail(modelName); loadStatus(); }
                            else { showToast('删除失败', 'error'); }
                        });
                    });
                    refreshIcons();
                } catch (e) {
                    if (e.message !== 'Unauthorized') container.innerHTML = '<p style="color:var(--danger);font-size:0.78rem;">加载失败</p>';
                }
            }

            // ======================== 模型表单 ========================
            async function openModelForm(existingModel) {
                var isEdit = !!existingModel;
                var pools = [];
                try {
                    var poolRes = await authFetch(API.POOL);
                    if (poolRes.ok) pools = await poolRes.json();
                } catch (_) {}

                var title = isEdit ? '编辑模型: ' + existingModel.name : '创建模型';
                var body = '<div class="form-section"><div class="form-section-title">匹配与请求类型</div>';
                body += '<div class="form-group"><label>模型名称 / 匹配模式 <span style="color:var(--danger)">*</span></label>' +
                    '<input type="text" id="mf-name" value="' + escapeHtml(existingModel ? existingModel.name : '') + '"' + (isEdit ? ' readonly' : '') + '>' +
                    '<div class="help">支持精确名称、以 * 结尾的前缀匹配和以 ^ 开头的正则匹配</div></div>';
                body += '<div class="form-group"><label>支持端点类型</label><input type="text" id="mf-type" value="' + escapeHtml(existingModel && existingModel.type ? existingModel.type.join(', ') : '') + '" placeholder="chat, response, images">' +
                    '<div class="help">逗号分隔；留空表示不限制请求路径</div></div></div>';

                body += '<div class="form-section"><div class="form-section-title">共享端点池</div>';
                if (pools.length === 0) {
                    body += '<div class="empty-inline">当前没有端点池，可在“端点”页面创建。</div>';
                } else {
                    body += '<div class="pool-choice-grid">';
                    pools.forEach(function(pool) {
                        var checked = existingModel && existingModel.endpoint_refs && existingModel.endpoint_refs.includes(pool.name);
                        body += '<label class="pool-choice"><input type="checkbox" class="mf-pool-ref" value="' + escapeHtml(pool.name) + '"' + (checked ? ' checked' : '') + '><span><strong>' + escapeHtml(pool.name) + '</strong><small>' + escapeHtml(pool.base_url) + ' · ' + (pool.key_count || 0) + ' Keys</small></span></label>';
                    });
                    body += '</div>';
                }
                body += '</div>';

                body += '<div class="form-section"><div class="form-section-title">故障策略</div><div class="form-row">' +
                    '<div class="form-group"><label>冷却时间 (ms)</label><input type="number" id="mf-cooldown" min="0" value="' + escapeHtml(existingModel && existingModel.cooldown_ms !== undefined ? String(existingModel.cooldown_ms) : '') + '" placeholder="60000"></div>' +
                    '<div class="form-group"><label>持续失败删除 (ms)</label><input type="number" id="mf-delete-after" min="0" value="' + escapeHtml(existingModel && existingModel.delete_after_failure_ms !== undefined ? String(existingModel.delete_after_failure_ms) : '') + '" placeholder="3600000"></div>' +
                    '<div class="form-group"><label>默认超时 (秒)</label><input type="number" id="mf-timeout" min="1" value="' + escapeHtml(existingModel && existingModel.default_timeout !== undefined ? String(existingModel.default_timeout) : '') + '" placeholder="120"></div>' +
                    '<div class="form-group"><label>默认最大重试</label><input type="number" id="mf-retries" min="0" value="' + escapeHtml(existingModel && existingModel.default_max_retries !== undefined ? String(existingModel.default_max_retries) : '') + '" placeholder="3"></div></div></div>';

                body += '<div class="form-section"><div class="form-section-title">重定向规则</div><div id="redirect-rules-container">';
                var redirects = existingModel && existingModel.redirects
                    ? existingModel.redirects
                    : (existingModel && existingModel.redirect_to ? [{ pre: '*', to: existingModel.redirect_to, weight: 1 }] : []);
                redirects.forEach(function(rule) { body += redirectRuleHtml(rule); });
                body += '</div><button class="btn btn-sm btn-outline" id="btn-add-redirect-rule"><i data-lucide="plus"></i>添加规则</button></div>';

                var headersText = existingModel && existingModel.headers ? JSON.stringify(existingModel.headers, null, 2) : '';
                body += '<div class="form-section"><div class="form-section-title">Headers 覆盖</div><div class="form-group"><textarea class="json-field" id="mf-headers" placeholder="{ &quot;set&quot;: { &quot;x-header&quot;: &quot;value&quot; }, &quot;delete&quot;: [&quot;x-old&quot;] }">' + escapeHtml(headersText) + '</textarea><div class="help">JSON 格式；留空使用全局 headers 策略</div></div></div>';

                var footer = '<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" id="btn-model-save">' + (isEdit ? '保存修改' : '创建模型') + '</button>';
                var modal = openModal(title, body, footer);
                modal.classList.add('modal-wide');
                refreshIcons();

                document.getElementById('btn-add-redirect-rule').addEventListener('click', function() {
                    document.getElementById('redirect-rules-container').insertAdjacentHTML('beforeend', redirectRuleHtml(null));
                    refreshIcons();
                });

                document.getElementById('btn-model-save').addEventListener('click', async function() {
                    var name = document.getElementById('mf-name').value.trim();
                    if (!name) { showToast('模型名称不能为空', 'warning'); return; }
                    var payload = { name: name };
                    setOptionalNumber(payload, 'cooldown_ms', 'mf-cooldown', isEdit);
                    setOptionalNumber(payload, 'delete_after_failure_ms', 'mf-delete-after', isEdit);
                    setOptionalNumber(payload, 'default_timeout', 'mf-timeout', isEdit);
                    setOptionalNumber(payload, 'default_max_retries', 'mf-retries', isEdit);

                    var typeStr = document.getElementById('mf-type').value.trim();
                    if (typeStr) payload.type = typeStr.split(',').map(function(value) { return value.trim(); }).filter(Boolean);
                    else if (isEdit) payload.type = null;

                    var refs = Array.from(document.querySelectorAll('.mf-pool-ref:checked')).map(function(input) { return input.value; });
                    if (refs.length > 0) payload.endpoint_refs = refs;
                    else if (isEdit) payload.endpoint_refs = null;

                    var redirectRules = [];
                    document.querySelectorAll('#redirect-rules-container .redirect-rule-row').forEach(function(group) {
                        var pre = group.querySelector('.rd-pre').value.trim();
                        var to = group.querySelector('.rd-to').value.trim();
                        var weight = Number(group.querySelector('.rd-weight').value || 1);
                        if (pre && to) redirectRules.push({ pre: pre, weight: weight, to: to });
                    });
                    if (redirectRules.length > 0) payload.redirects = redirectRules;
                    else if (isEdit) payload.redirects = null;
                    if (isEdit) payload.redirect_to = null;

                    var headersValue = document.getElementById('mf-headers').value.trim();
                    if (headersValue) {
                        try { payload.headers = JSON.parse(headersValue); }
                        catch (_) { showToast('Headers 必须是有效 JSON', 'warning'); return; }
                    } else if (isEdit) payload.headers = null;

                    var btn = document.getElementById('btn-model-save');
                    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 保存中...';
                    try {
                        var endpoint = isEdit ? API.MODELS + '/' + encodeURIComponent(existingModel.name) : API.MODELS;
                        var res = await authFetch(endpoint, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!res.ok && res.status !== 201) {
                            var errorBody = await res.json();
                            throw new Error(errorBody.error || 'HTTP ' + res.status);
                        }
                        showToast(isEdit ? '模型已更新' : '模型已创建', 'success');
                        closeModal();
                        selectedModelName = isEdit ? existingModel.name : name;
                        loadModels();
                        loadStatus();
                        loadEndpointView();
                    } catch (error) {
                        if (error.message !== 'Unauthorized') showToast('操作失败: ' + error.message, 'error');
                        btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '创建模型';
                    }
                });
            }

            function redirectRuleHtml(rule) {
                return '<div class="input-group redirect-rule-row" style="margin-bottom:8px;">' +
                    '<input type="text" class="rd-pre" placeholder="匹配模式，如 *" value="' + escapeHtml(rule ? rule.pre : '') + '">' +
                    '<input type="text" class="rd-to" placeholder="目标模型" value="' + escapeHtml(rule ? rule.to : '') + '">' +
                    '<input type="number" class="rd-weight" min="0" placeholder="权重" style="width:82px;" value="' + (rule && rule.weight !== undefined ? rule.weight : 1) + '">' +
                    '<button class="icon-btn" type="button" title="移除规则" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button></div>';
            }

            function setOptionalNumber(payload, field, inputId, includeNull) {
                var raw = document.getElementById(inputId).value.trim();
                if (raw !== '') payload[field] = Number(raw);
                else if (includeNull) payload[field] = null;
            }

            function openEndpointForm(modelName, endpoint, poolMode) {
                var isEdit = !!endpoint;
                var prefix = poolMode ? '端点池' : '端点';
                var body = '<div class="form-group"><label>Base URL <span style="color:var(--danger)">*</span></label><input type="url" id="ef-url" value="' + escapeHtml(endpoint ? endpoint.base_url : '') + '" placeholder="https://api.example.com/v1"></div>' +
                    '<div class="form-row"><div class="form-group"><label>权重</label><input type="number" id="ef-weight" min="0.01" step="0.01" value="' + (endpoint && endpoint.weight !== undefined ? endpoint.weight : 1) + '"></div>' +
                    '<div class="form-group"><label>超时 (秒)</label><input type="number" id="ef-timeout" min="1" value="' + (endpoint && endpoint.timeout !== undefined ? endpoint.timeout : '') + '" placeholder="继承默认值"></div>' +
                    '<div class="form-group"><label>最大重试</label><input type="number" id="ef-retries" min="0" value="' + (endpoint && endpoint.max_retries !== undefined ? endpoint.max_retries : '') + '" placeholder="继承默认值"></div></div>';
                var footer = '<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" id="ef-save">' + (isEdit ? '保存修改' : '添加端点') + '</button>';
                openModal((isEdit ? '编辑' : '添加') + prefix + (poolMode ? '' : ' · ' + escapeHtml(modelName)), body, footer);
                document.getElementById('ef-save').addEventListener('click', async function() {
                    var url = document.getElementById('ef-url').value.trim();
                    var weight = Number(document.getElementById('ef-weight').value);
                    if (!url) { showToast('Base URL 不能为空', 'warning'); return; }
                    if (!Number.isFinite(weight) || weight <= 0) { showToast('权重必须大于 0', 'warning'); return; }
                    var payload = { base_url: url, weight: weight };
                    var timeoutRaw = document.getElementById('ef-timeout').value.trim();
                    var retriesRaw = document.getElementById('ef-retries').value.trim();
                    if (timeoutRaw) payload.timeout = Number(timeoutRaw); else if (isEdit) payload.timeout = null;
                    if (retriesRaw) payload.max_retries = Number(retriesRaw); else if (isEdit) payload.max_retries = null;
                    var btn = document.getElementById('ef-save');
                    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 保存中...';
                    var apiUrl = API.MODELS + '/' + encodeURIComponent(modelName) + '/endpoints' + (isEdit ? '/' + endpoint.index : '');
                    try {
                        var response = await authFetch(apiUrl, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!response.ok && response.status !== 201) { var errorBody = await response.json(); throw new Error(errorBody.error || 'HTTP ' + response.status); }
                        showToast(isEdit ? '端点已更新' : '端点已添加', 'success');
                        closeModal(); loadModelDetail(modelName); loadStatus(); loadEndpointView();
                    } catch (error) {
                        if (error.message !== 'Unauthorized') showToast('保存失败: ' + error.message, 'error');
                        btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '添加端点';
                    }
                });
            }

            // ======================== 端点管理（端点维度视图） ========================
            async function loadEndpointView() {
                try {
                    var statusRes = await authFetch(API.STATUS);
                    var status = await statusRes.json();
                    renderEndpointView(status);
                } catch (e) {
                    if (e.message !== 'Unauthorized') {
                        document.getElementById('endpoint-list').innerHTML = '<div class="empty-state"><div class="ico">❌</div><p>加载失败</p></div>';
                    }
                }
            }

            function renderEndpointView(statusData) {
                var container = document.getElementById('endpoint-list');
                var filterModel = document.getElementById('ep-filter-model').value;
                var filterStatus = document.getElementById('ep-filter-status').value;

                var allEndpoints = [];
                var modelNames = new Set();
                for (var modelKey in statusData) {
                    if (modelKey === '_summary') continue;
                    var pattern = extractModelPattern(modelKey);
                    var eps = statusData[modelKey] || [];
                    eps.forEach(function(ep) {
                        if (!ep.base_url) return;
                        modelNames.add(pattern);
                        allEndpoints.push({ model: pattern, modelKey: modelKey, baseUrl: ep.base_url, keys: ep.keys || {}, weight: ep.weight });
                    });
                }

                // 更新筛选器
                var select = document.getElementById('ep-filter-model');
                var curVal = select.value;
                select.innerHTML = '<option value="all">全部模型</option>';
                modelNames.forEach(function(n) {
                    var o = document.createElement('option');
                    o.value = n; o.textContent = n;
                    select.appendChild(o);
                });
                if (curVal) select.value = curVal;
                select.onchange = loadEndpointView;

                document.getElementById('ep-filter-status').onchange = loadEndpointView;

                var filtered = allEndpoints;
                if (filterModel !== 'all') filtered = filtered.filter(function(ep) { return ep.model === filterModel; });
                if (filterStatus === 'healthy') filtered = filtered.filter(function(ep) { return ep.keys.active === ep.keys.total && ep.keys.total > 0; });
                else if (filterStatus === 'warning') filtered = filtered.filter(function(ep) { return ep.keys.active > 0 && ep.keys.active < ep.keys.total; });
                else if (filterStatus === 'down') filtered = filtered.filter(function(ep) { return ep.keys.active === 0; });

                if (!filtered || filtered.length === 0) {
                    document.getElementById('endpoint-filter-summary').textContent = '0 条模型-端点绑定';
                    container.innerHTML = '<div class="empty-state"><i data-lucide="server-off"></i><p>当前筛选条件下没有实际转发端点</p></div>';
                    refreshIcons();
                    return;
                }

                var availableCount = filtered.filter(function(ep) { return (ep.keys.active || 0) > 0; }).length;
                document.getElementById('endpoint-filter-summary').textContent = availableCount + ' / ' + filtered.length + ' 条模型-端点绑定可用';
                var html = '<table class="endpoint-data-table"><thead><tr><th></th><th>模型</th><th>Base URL</th><th>Key 状态</th><th>健康度</th><th>权重</th></tr></thead><tbody>';
                filtered.forEach(function(ep, index) {
                    var total = ep.keys.total || 0;
                    var active = ep.keys.active || 0;
                    var cooldown = ep.keys.cooldown || 0;
                    var health = total > 0 ? Math.round(active / total * 100) : 0;
                    var healthColor = health >= 80 ? '#059669' : (health >= 50 ? '#d97706' : '#dc2626');
                    var stateClass = active === 0 ? 'badge-red' : (active < total ? 'badge-yellow' : 'badge-green');
                    var stateText = active === 0 ? '不可用' : (active < total ? '部分可用' : '健康');
                    html += '<tr class="endpoint-main-row" data-detail="endpoint-detail-' + index + '" data-ep-model="' + escapeHtml(ep.model) + '">' +
                        '<td><button class="endpoint-toggle" title="展开 Key 状态" aria-label="展开 Key 状态"><i data-lucide="chevron-right"></i></button></td>' +
                        '<td><strong>' + escapeHtml(ep.model) + '</strong><div class="table-subtext">' + stateText + '</div></td>' +
                        '<td class="endpoint-url-cell" title="' + escapeHtml(ep.baseUrl) + '">' + escapeHtml(ep.baseUrl) + '</td>' +
                        '<td><span class="badge ' + stateClass + '">' + active + ' / ' + total + ' 有效</span></td>' +
                        '<td><div class="health-inline"><div class="progress-bar"><div class="fill" style="width:' + health + '%;background:' + healthColor + ';"></div></div><strong>' + health + '%</strong></div></td>' +
                        '<td>' + (ep.weight || 1) + '</td></tr>' +
                        '<tr class="endpoint-detail-row" id="endpoint-detail-' + index + '" hidden><td colspan="6"><div class="endpoint-detail-content">' +
                        '<div class="endpoint-detail-metric"><span>有效 Key</span><strong>' + active + '</strong></div>' +
                        '<div class="endpoint-detail-metric"><span>冷却 Key</span><strong>' + cooldown + '</strong></div>' +
                        '<div class="endpoint-detail-metric"><span>Key 总数</span><strong>' + total + '</strong></div>' +
                        '<div class="endpoint-detail-metric"><span>管理入口</span><strong><button class="btn btn-xs btn-outline endpoint-manage-btn" data-ep-model="' + escapeHtml(ep.model) + '">查看模型</button></strong></div>' +
                        '</div></td></tr>';
                });
                html += '</tbody></table>';
                container.innerHTML = html;
                container.querySelectorAll('.endpoint-main-row').forEach(function(row) {
                    row.addEventListener('click', function(event) {
                        if (event.target.closest('.endpoint-manage-btn')) return;
                        var detail = document.getElementById(row.dataset.detail);
                        var expanded = !detail.hidden;
                        detail.hidden = expanded;
                        row.classList.toggle('expanded', !expanded);
                    });
                });
                container.querySelectorAll('.endpoint-manage-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var m = btn.dataset.epModel;
                        switchPage('models');
                        selectedModelName = m;
                        loadModels();
                        setTimeout(function() { loadModelDetail(m); }, 200);
                    });
                });
                refreshIcons();
            }

            function switchEndpointView(view) {
                var poolView = view === 'pool';
                document.getElementById('endpoint-runtime-view').hidden = poolView;
                document.getElementById('endpoint-pool-view').hidden = !poolView;
                document.querySelectorAll('#endpoint-view-tabs button').forEach(function(button) {
                    button.classList.toggle('active', button.dataset.endpointView === view);
                });
                document.getElementById('btn-create-pool').style.display = poolView ? '' : 'none';
                if (poolView) loadEndpointPools(); else loadEndpointView();
                refreshIcons();
            }

            async function loadEndpointPools() {
                var container = document.getElementById('endpoint-pool-list');
                try {
                    var response = await authFetch(API.POOL);
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    var pools = await response.json();
                    renderEndpointPools(pools);
                } catch (error) {
                    if (error.message !== 'Unauthorized') {
                        container.innerHTML = '<div class="empty-state"><i data-lucide="circle-alert"></i><p>端点池加载失败</p></div>';
                        refreshIcons();
                    }
                }
            }

            function renderEndpointPools(pools) {
                var container = document.getElementById('endpoint-pool-list');
                var summary = document.getElementById('endpoint-pool-summary');
                if (!pools || pools.length === 0) {
                    summary.textContent = '0 个端点池';
                    container.innerHTML = '<div class="empty-state"><i data-lucide="database-zap"></i><p>尚未创建共享端点池</p><button class="btn btn-primary" id="empty-create-pool"><i data-lucide="plus"></i>创建端点池</button></div>';
                    document.getElementById('empty-create-pool').addEventListener('click', function() { openEndpointPoolForm(null); });
                    refreshIcons();
                    return;
                }
                var totalKeys = pools.reduce(function(sum, pool) { return sum + (pool.key_count || 0); }, 0);
                var totalRefs = pools.reduce(function(sum, pool) { return sum + (pool.referenced_by ? pool.referenced_by.length : 0); }, 0);
                summary.textContent = pools.length + ' 个池 · ' + totalKeys + ' Keys · ' + totalRefs + ' 个模型引用';
                var html = '<table class="pool-data-table"><thead><tr><th></th><th>端点池</th><th>Base URL</th><th>Key 状态</th><th>引用模型</th><th>操作</th></tr></thead><tbody>';
                pools.forEach(function(pool, index) {
                    var runtime = pool.runtime || { active: 0, total: 0, cooldown: 0 };
                    var active = runtime.active || 0;
                    var configured = pool.key_count || 0;
                    var refs = pool.referenced_by || [];
                    var mounted = refs.length > 0;
                    var stateClass = !mounted ? 'badge-gray' : (active > 0 ? (active < configured ? 'badge-yellow' : 'badge-green') : 'badge-red');
                    var keyStateText = !mounted ? '未挂载 · ' + configured + ' Keys' : active + ' / ' + configured + ' 有效';
                    html += '<tr class="endpoint-main-row pool-main-row" data-detail="pool-detail-' + index + '" data-pool="' + escapeHtml(pool.name) + '">' +
                        '<td><button class="endpoint-toggle" title="展开 Key 管理" aria-label="展开 Key 管理"><i data-lucide="chevron-right"></i></button></td>' +
                        '<td><span class="pool-name">' + escapeHtml(pool.name) + '</span><div class="table-subtext">权重 ' + (pool.weight || 1) + (pool.timeout ? ' · ' + pool.timeout + 's' : '') + '</div></td>' +
                        '<td class="endpoint-url-cell" title="' + escapeHtml(pool.base_url) + '">' + escapeHtml(pool.base_url) + '</td>' +
                        '<td><span class="badge ' + stateClass + '">' + keyStateText + '</span></td>' +
                        '<td><div class="pool-reference-list">' + (refs.length ? refs.slice(0, 3).map(function(name) { return '<span class="badge badge-gray">' + escapeHtml(name) + '</span>'; }).join('') : '<span class="table-subtext">未被引用</span>') + (refs.length > 3 ? '<span class="badge badge-gray">+' + (refs.length - 3) + '</span>' : '') + '</div></td>' +
                        '<td><div class="pool-actions"><button class="icon-btn edit-pool-btn" data-pool-index="' + index + '" title="编辑端点池" aria-label="编辑端点池"><i data-lucide="pencil"></i></button><button class="icon-btn delete-pool-btn" data-pool-index="' + index + '" title="删除端点池" aria-label="删除端点池"><i data-lucide="trash-2"></i></button></div></td></tr>' +
                        '<tr class="pool-detail-row" id="pool-detail-' + index + '" hidden><td colspan="6"><div class="pool-detail-shell"><div class="pool-key-list" id="pool-key-list-' + index + '"><div class="muted-cell">展开后加载 Key 状态</div></div><div class="pool-key-add"><label>添加 API Key</label><div class="input-group"><input type="password" id="pool-key-new-' + index + '" placeholder="输入新的 Key" autocomplete="off"><button class="btn btn-primary add-pool-key-inline" data-pool-index="' + index + '">添加</button></div><div class="help">Key 保存后仅显示脱敏预览。</div></div></div></td></tr>';
                });
                html += '</tbody></table>';
                container.innerHTML = html;

                container.querySelectorAll('.pool-main-row').forEach(function(row) {
                    row.addEventListener('click', function(event) {
                        if (event.target.closest('.pool-actions')) return;
                        var detail = document.getElementById(row.dataset.detail);
                        var opening = detail.hidden;
                        detail.hidden = !opening;
                        row.classList.toggle('expanded', opening);
                        if (opening) loadPoolDetail(row.dataset.pool, parseInt(row.dataset.detail.split('-').pop()));
                    });
                });
                container.querySelectorAll('.edit-pool-btn').forEach(function(button) {
                    button.addEventListener('click', function() { openEndpointPoolForm(pools[parseInt(button.dataset.poolIndex)]); });
                });
                container.querySelectorAll('.delete-pool-btn').forEach(function(button) {
                    button.addEventListener('click', async function() {
                        var pool = pools[parseInt(button.dataset.poolIndex)];
                        var refs = pool.referenced_by || [];
                        if (refs.length > 0) {
                            showToast('请先从模型中移除该端点池引用: ' + refs.join(', '), 'warning', 5000);
                            return;
                        }
                        var confirmed = await confirmAction('确认删除端点池 <strong>' + escapeHtml(pool.name) + '</strong>？', '删除端点池', true);
                        if (!confirmed) return;
                        var response = await authFetch(API.POOL + '/' + encodeURIComponent(pool.name), { method: 'DELETE' });
                        if (response.ok || response.status === 204) { showToast('端点池已删除', 'success'); loadEndpointPools(); loadStatus(); }
                        else { var errorBody = await response.json(); showToast('删除失败: ' + (errorBody.error || ''), 'error'); }
                    });
                });
                container.querySelectorAll('.add-pool-key-inline').forEach(function(button) {
                    button.addEventListener('click', async function() {
                        var index = parseInt(button.dataset.poolIndex);
                        var pool = pools[index];
                        var input = document.getElementById('pool-key-new-' + index);
                        var key = input.value.trim();
                        if (!key) { showToast('请输入 Key', 'warning'); return; }
                        button.disabled = true;
                        var response = await authFetch(API.POOL + '/' + encodeURIComponent(pool.name) + '/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) });
                        button.disabled = false;
                        if (response.ok || response.status === 201) { input.value = ''; showToast('Key 已添加', 'success'); loadEndpointPools(); loadStatus(); }
                        else { var errorBody = await response.json(); showToast('添加失败: ' + (errorBody.error || ''), 'error'); }
                    });
                });
                refreshIcons();
            }

            async function loadPoolDetail(poolName, index) {
                var container = document.getElementById('pool-key-list-' + index);
                if (!container) return;
                container.innerHTML = '<div class="muted-cell">正在加载 Key 状态...</div>';
                try {
                    var response = await authFetch(API.POOL + '/' + encodeURIComponent(poolName));
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    var pool = await response.json();
                    if (!pool.keys || pool.keys.length === 0) {
                        container.innerHTML = '<div class="muted-cell">暂无 Key</div>';
                        return;
                    }
                    container.innerHTML = pool.keys.map(function(key) {
                        var mounted = pool.referenced_by && pool.referenced_by.length > 0;
                        var statusClass = !mounted ? 'badge-gray' : (key.active ? 'badge-green' : (key.cooldown ? 'badge-yellow' : 'badge-red'));
                        var statusText = !mounted ? '未挂载' : (key.active ? '有效' : (key.cooldown ? '冷却' : '不可用'));
                        var dotClass = !mounted ? 'dot-gray' : (key.active ? 'dot-green' : key.cooldown ? 'dot-yellow' : 'dot-red');
                        return '<div class="key-row"><span class="status-dot-sm ' + dotClass + '"></span><span class="key-val">' + escapeHtml(key.key_preview) + '</span><span class="badge ' + statusClass + '">' + statusText + '</span><button class="icon-btn delete-pool-key-inline" data-key-index="' + key.index + '" title="删除 Key" aria-label="删除 Key"><i data-lucide="trash-2"></i></button></div>';
                    }).join('');
                    container.querySelectorAll('.delete-pool-key-inline').forEach(function(button) {
                        button.addEventListener('click', async function() {
                            var confirmed = await confirmAction('确认删除此 Key？', '删除 Key', true);
                            if (!confirmed) return;
                            var result = await authFetch(API.POOL + '/' + encodeURIComponent(poolName) + '/keys/' + button.dataset.keyIndex, { method: 'DELETE' });
                            if (result.ok || result.status === 204) { showToast('Key 已删除', 'success'); loadEndpointPools(); loadStatus(); }
                            else { var errorBody = await result.json(); showToast('删除失败: ' + (errorBody.error || ''), 'error'); }
                        });
                    });
                    refreshIcons();
                } catch (error) {
                    if (error.message !== 'Unauthorized') container.innerHTML = '<div class="muted-cell">Key 状态加载失败</div>';
                }
            }

            function openEndpointPoolForm(pool) {
                var isEdit = !!pool;
                var body = '<div class="form-group"><label>端点池名称 <span style="color:var(--danger)">*</span></label><input type="text" id="pf-name" value="' + escapeHtml(pool ? pool.name : '') + '"' + (isEdit ? ' readonly' : '') + ' placeholder="例如 primary-openai"></div>' +
                    '<div class="form-group"><label>Base URL <span style="color:var(--danger)">*</span></label><input type="url" id="pf-url" value="' + escapeHtml(pool ? pool.base_url : '') + '" placeholder="https://api.example.com/v1"></div>' +
                    '<div class="form-row"><div class="form-group"><label>权重</label><input type="number" id="pf-weight" min="0.01" step="0.01" value="' + (pool && pool.weight !== undefined ? pool.weight : 1) + '"></div>' +
                    '<div class="form-group"><label>超时 (秒)</label><input type="number" id="pf-timeout" min="1" value="' + (pool && pool.timeout !== undefined ? pool.timeout : '') + '" placeholder="使用模型默认值"></div>' +
                    '<div class="form-group"><label>最大重试</label><input type="number" id="pf-retries" min="0" value="' + (pool && pool.max_retries !== undefined ? pool.max_retries : '') + '" placeholder="使用模型默认值"></div></div>' +
                    (isEdit && pool.referenced_by && pool.referenced_by.length ? '<div class="form-group"><label>当前引用</label><div class="pool-reference-list">' + pool.referenced_by.map(function(name) { return '<span class="badge badge-gray">' + escapeHtml(name) + '</span>'; }).join('') + '</div></div>' : '');
                var footer = '<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" id="pf-save">' + (isEdit ? '保存修改' : '创建端点池') + '</button>';
                openModal(isEdit ? '编辑端点池' : '创建端点池', body, footer);
                document.getElementById('pf-save').addEventListener('click', async function() {
                    var name = document.getElementById('pf-name').value.trim();
                    var url = document.getElementById('pf-url').value.trim();
                    var weight = Number(document.getElementById('pf-weight').value);
                    if (!name || !url) { showToast('名称和 Base URL 不能为空', 'warning'); return; }
                    if (!Number.isFinite(weight) || weight <= 0) { showToast('权重必须大于 0', 'warning'); return; }
                    var payload = { name: name, base_url: url, weight: weight };
                    var timeoutRaw = document.getElementById('pf-timeout').value.trim();
                    var retriesRaw = document.getElementById('pf-retries').value.trim();
                    if (timeoutRaw) payload.timeout = Number(timeoutRaw); else if (isEdit) payload.timeout = null;
                    if (retriesRaw) payload.max_retries = Number(retriesRaw); else if (isEdit) payload.max_retries = null;
                    var button = document.getElementById('pf-save');
                    button.disabled = true; button.innerHTML = '<span class="spinner"></span> 保存中...';
                    try {
                        var apiUrl = isEdit ? API.POOL + '/' + encodeURIComponent(pool.name) : API.POOL;
                        var response = await authFetch(apiUrl, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!response.ok && response.status !== 201) { var errorBody = await response.json(); throw new Error(errorBody.error || 'HTTP ' + response.status); }
                        showToast(isEdit ? '端点池已更新' : '端点池已创建', 'success');
                        closeModal(); loadEndpointPools(); loadModels(); loadStatus();
                    } catch (error) {
                        if (error.message !== 'Unauthorized') showToast('保存失败: ' + error.message, 'error');
                        button.disabled = false; button.textContent = isEdit ? '保存修改' : '创建端点池';
                    }
                });
            }

            // ======================== Token 统计 ========================
            var tokenRange = '1h';
            var tokenRanges = {
                '1h': { apiPath: '/minutely', value: 60, param: 'minutes', windowMs: 3600000, costWindow: '1h', minutes: 60, type: 'm', label: '最近 1 小时' },
                '5h': { apiPath: '/minutely', value: 300, param: 'minutes', windowMs: 18000000, costWindow: '5h', minutes: 300, type: 'm', label: '最近 5 小时' },
                '1d': { apiPath: '/hourly', value: 24, param: 'hours', windowMs: 86400000, costWindow: '1d', minutes: 1440, type: 'h', label: '最近 1 天' },
                '7d': { apiPath: '/daily', value: 7, param: 'days', windowMs: 604800000, costWindow: '7d', minutes: 10080, type: 'd', label: '最近 7 天' },
                '30d': { apiPath: '/daily', value: 30, param: 'days', windowMs: 2592000000, costWindow: '30d', minutes: 43200, type: 'd', label: '最近 30 天' }
            };
            var tokenChartInst = {};

            function fmtUnit(v) {
                if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
                if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
                if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
                return v;
            }

            function fmtXLabel(dateStr, type) {
                if (type === 'd') {
                    var d = new Date(dateStr + 'T00:00:00Z');
                    return (d.getMonth() + 1).toString().padStart(2,'0') + '-' + d.getDate().toString().padStart(2,'0');
                }
                var d = new Date(dateStr + 'Z');
                return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
            }

            var tokenResizeRegistered = false;

            function ensureCharts() {
                ['chart-bar', 'chart-line', 'chart-pie'].forEach(function(id) {
                    var dom = document.getElementById(id);
                    if (dom) {
                        try {
                            if (tokenChartInst[id]) tokenChartInst[id].dispose();
                            tokenChartInst[id] = echarts.init(dom);
                        } catch (e) { console.warn('[TokenStats] echarts init failed:', id, e); }
                    }
                });
                if (!tokenResizeRegistered) {
                    window.addEventListener('resize', function() {
                        Object.values(tokenChartInst).forEach(function(c) { if (c) c.resize(); });
                    });
                    tokenResizeRegistered = true;
                }
            }

            async function loadTokenCharts() {
                var model = document.getElementById('token-model').value;
                var range = tokenRanges[tokenRange];
                var params = range.param + '=' + range.value;
                if (model !== 'all') params += '&model=' + encodeURIComponent(model);
                try {
                    var dailyRes = await authFetch(API.TOKEN_STATS + range.apiPath + '?' + params);
                    var daily = await dailyRes.json();
                    var summaryParams = 'window=' + range.windowMs;
                    if (model !== 'all') summaryParams += '&model=' + encodeURIComponent(model);
                    var summaryRes = await authFetch(API.TOKEN_STATS + '/summary?' + summaryParams);
                    var summary = await summaryRes.json();
                    var costParams = 'window=' + range.costWindow;
                    if (model !== 'all') costParams += '&model=' + encodeURIComponent(model);
                    var costRes = await authFetch(API.TOKEN_COST + '?' + costParams);
                    var costData = costRes.ok ? await costRes.json() : null;
                    document.getElementById('token-range-label').textContent = range.label;
                    renderTokenMetrics(daily, costData, range);
                    if (typeof echarts !== 'undefined') {
                        ensureCharts();
                        (function(typ) { setTimeout(function() {
                            try { updateBarChart(daily, typ); updateLineChart(daily, typ); updatePieChart(summary); } catch (e) { console.warn('[TokenStats] chart error:', e); }
                        }, 50); })(range.type);
                    }
                } catch (e) { if (e.message !== 'Unauthorized') showToast('加载统计数据失败', 'error'); }
            }

            function renderTokenMetrics(daily, costData, range) {
                var totalTokens = daily.reduce(function(s, d) { return s + d.totalTokens; }, 0);
                var totalReqs = daily.reduce(function(s, d) { return s + d.requestCount; }, 0);
                var minutes = range.minutes;
                var rpm = totalReqs > 0 ? (totalReqs / minutes).toFixed(1) : '0';
                var tpm = totalTokens > 0 ? Math.round(totalTokens / minutes) : 0;
                var totalCost = costData ? Number(costData.total_cost_usd || 0) : 0;
                document.getElementById('token-summary-cards').innerHTML =
                    '<article class="usage-metric"><span>Token 总量</span><strong>' + fmtUnit(totalTokens) + '</strong><small>输入与输出合计</small></article>' +
                    '<article class="usage-metric"><span>请求总数</span><strong>' + (totalReqs >= 1e3 ? fmtUnit(totalReqs) : totalReqs.toLocaleString()) + '</strong><small>' + range.label + '</small></article>' +
                    '<article class="usage-metric cost"><span>预估成本</span><strong>$' + totalCost.toFixed(4) + '</strong><small>USD</small></article>' +
                    '<article class="usage-metric"><span>平均 RPM</span><strong>' + rpm + '</strong><small>每分钟请求</small></article>' +
                    '<article class="usage-metric"><span>平均 TPM</span><strong>' + fmtUnit(tpm) + '</strong><small>每分钟 Token</small></article>';
                renderPricingTable(costData && costData.models ? costData.models : []);
            }

            function renderPricingTable(models) {
                var container = document.getElementById('pricing-table-container');
                var pricedModels = models.filter(function(m) { return m.has_pricing && m.pricing; });
                var unpricedModels = models.filter(function(m) { return !m.has_pricing && m.total_tokens > 0; });
                var html = '';
                if (pricedModels.length > 0) {
                    html += '<table><thead><tr>' +
                        '<th>模型</th><th>输入 $/1M</th><th>输出 $/1M</th><th>缓存读 $/1M</th><th>消耗 Token</th><th>输入成本</th><th>输出成本</th><th style="text-align:right;">总成本</th></tr></thead><tbody>';
                    pricedModels.forEach(function(m) {
                        var p = m.pricing;
                        var isDeepSeek = m.model.toLowerCase().includes('deepseek');
                        html += '<tr' + (isDeepSeek ? ' style="background:#f0fdfa;"' : '') + '>' +
                            '<td><strong>' + escapeHtml(m.model) + '</strong>' + (isDeepSeek ? ' <span class="badge badge-teal">DeepSeek</span>' : '') + '</td>' +
                            '<td>$' + (p.input).toFixed(4) + '</td>' +
                            '<td>$' + (p.output).toFixed(4) + '</td>' +
                            '<td>' + (p.cache_read ? '$' + p.cache_read.toFixed(4) : '-') + '</td>' +
                            '<td>' + (m.total_tokens || 0).toLocaleString() + '</td>' +
                            '<td>' + (m.input_cost_usd !== null ? '$' + m.input_cost_usd.toFixed(6) : '-') + '</td>' +
                            '<td>' + (m.output_cost_usd !== null ? '$' + m.output_cost_usd.toFixed(6) : '-') + '</td>' +
                            '<td style="text-align:right;"><strong>' + (m.cost_usd !== null ? '$' + m.cost_usd.toFixed(6) : '-') + '</strong></td></tr>';
                    });
                    html += '</tbody></table>';
                }
                if (unpricedModels.length > 0) {
                    html += '<p style="color:var(--text-muted);font-size:0.78rem;margin-top:8px;">⚠️ 以下模型无定价数据：' + unpricedModels.map(function(m) { return escapeHtml(m.model); }).join(', ') + '</p>';
                }
                if (pricedModels.length === 0 && unpricedModels.length === 0) html = '<p style="color:var(--text-muted);font-size:0.82rem;">暂无消耗数据</p>';
                container.innerHTML = html;
            }

            function updateBarChart(data, typ) {
                var c = tokenChartInst['chart-bar'];
                if (!c) return;
                var dates = data.map(function(d) { return fmtXLabel(d.date, typ); });
                var vals = data.map(function(d) { return d.totalTokens; });
                c.setOption({
                    tooltip: { trigger: 'axis', formatter: function(p) { return p[0].axisValue + '<br/>Token: ' + p[0].data.toLocaleString(); } },
                    grid: { left: '10%', right: '4%', top: 10, bottom: 30 },
                    xAxis: { type: 'category', data: dates, axisLabel: { rotate: 0, fontSize: 10, interval: data.length > 24 ? Math.floor(data.length / 8) : 0 } },
                    yAxis: { type: 'value', axisLabel: { formatter: fmtUnit } },
                    series: [{ type: 'bar', data: vals, barMaxWidth: 40, itemStyle: { borderRadius: [4,4,0,0], color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#0d9488'},{offset:1,color:'#5eead4'}]) } }]
                });
            }

            function updateLineChart(data, typ) {
                var c = tokenChartInst['chart-line'];
                if (!c) return;
                var dates = data.map(function(d) { return fmtXLabel(d.date, typ); });
                var vals = data.map(function(d) { return d.requestCount; });
                c.setOption({
                    tooltip: { trigger: 'axis', formatter: function(p) { return p[0].axisValue + '<br/>请求: ' + p[0].data.toLocaleString(); } },
                    grid: { left: '10%', right: '4%', top: 10, bottom: 30 },
                    xAxis: { type: 'category', data: dates, axisLabel: { rotate: 0, fontSize: 10, interval: data.length > 24 ? Math.floor(data.length / 8) : 0 } },
                    yAxis: { type: 'value', axisLabel: { formatter: fmtUnit } },
                    series: [{ type: 'line', data: vals, smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#6366f1', width: 2 }, itemStyle: { color: '#6366f1' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(99,102,241,0.2)'},{offset:1,color:'rgba(99,102,241,0)'}]) } }]
                });
            }

            function updatePieChart(data) {
                var c = tokenChartInst['chart-pie'];
                if (!c) return;
                if (!data || data.length === 0) { c.setOption({}); return; }
                c.setOption({
                    tooltip: { formatter: function(p) { return p.name + ': ' + p.value.toLocaleString() + ' (' + p.percent + '%)'; } },
                    series: [{
                        type: 'pie', radius: ['55%', '78%'], center: ['50%', '50%'],
                        avoidLabelOverlap: true, itemStyle: { borderRadius: 3 },
                        label: { formatter: '{b}\\n{d}%', fontSize: 11 },
                        emphasis: { label: { fontSize: 16, fontWeight: 'bold' } },
                        data: data.map(function(d) { return { name: d.model, value: d.totalTokens }; }),
                        color: ['#0d9488','#6366f1','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#10b981','#ec4899'],
                    }]
                });
            }

            // ======================== 配置编辑器 ========================
            var codeMirrorEditor = null;

            function initCodeMirror() {
                var ta = document.getElementById('config-editor');
                if (!ta || codeMirrorEditor) return;
                if (!window.CodeMirror) {
                    ta.style.display = 'block';
                    ta.style.minHeight = 'calc(100vh - 210px)';
                    ta.addEventListener('input', markConfigDirty);
                    return;
                }
                codeMirrorEditor = window.CodeMirror.fromTextArea(ta, {
                    mode: 'yaml', theme: 'default', lineNumbers: true, lineWrapping: true,
                    indentUnit: 2, tabSize: 2, indentWithTabs: false, styleActiveLine: true, viewportMargin: Infinity,
                });
                codeMirrorEditor.setSize(null, 420);
                codeMirrorEditor.on('keydown', function(cm, e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveConfig(); }
                });
                codeMirrorEditor.on('change', function() {
                    if (!loadingConfig) markConfigDirty();
                });
            }

            function markConfigDirty() {
                configDirty = true;
                document.getElementById('config-status').innerHTML = '<span style="color:var(--warning);font-weight:600;">存在未保存修改</span>';
            }

            function getConfigEditorValue() {
                return codeMirrorEditor ? codeMirrorEditor.getValue() : document.getElementById('config-editor').value;
            }

            function setConfigEditorValue(value) {
                loadingConfig = true;
                if (codeMirrorEditor) {
                    codeMirrorEditor.setValue(value);
                    codeMirrorEditor.clearHistory();
                } else {
                    document.getElementById('config-editor').value = value;
                }
                loadingConfig = false;
            }

            async function loadConfigToEditor() {
                if (!codeMirrorEditor) initCodeMirror();
                try {
                    setConfigEditorValue('加载中...');
                    var res = await authFetch(API.CONFIG);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    var text = await res.text();
                    setConfigEditorValue(text);
                    configDirty = false;
                    document.getElementById('config-status').innerHTML = '<span style="color:var(--success);font-weight:600;">✅ 配置已加载 (' + formatTime(Date.now()) + ')</span>';
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        document.getElementById('config-status').innerHTML = '<span style="color:var(--danger);font-weight:600;">❌ 加载失败: ' + escapeHtml(err.message) + '</span>';
                    }
                }
            }

            async function saveConfig() {
                var yaml = getConfigEditorValue();
                try {
                    var res = await authFetch(API.CONFIG, { method: 'POST', body: yaml });
                    if (!res.ok) { var err = await res.text(); throw new Error(err); }
                    configDirty = false;
                    document.getElementById('config-status').innerHTML = '<span style="color:var(--success);font-weight:600;">✅ 配置已保存（热加载将自动生效）(' + formatTime(Date.now()) + ')</span>';
                    showToast('配置已保存', 'success');
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        document.getElementById('config-status').innerHTML = '<span style="color:var(--danger);font-weight:600;">❌ 保存失败: ' + escapeHtml(err.message) + '</span>';
                        showToast('保存失败: ' + err.message, 'error');
                    }
                }
            }

            document.getElementById('btn-load-config').addEventListener('click', loadConfigToEditor);
            document.getElementById('btn-save-config').addEventListener('click', saveConfig);
            document.getElementById('btn-download-config').addEventListener('click', function() {
                var text = getConfigEditorValue();
                var blob = new Blob([text], { type: 'text/yaml' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = 'config.yaml'; a.click();
                URL.revokeObjectURL(url);
            });
            window.addEventListener('beforeunload', function(event) {
                if (!configDirty) return;
                event.preventDefault();
                event.returnValue = '';
            });

            // ======================== 自动刷新带倒计时 ========================
            function startCountdown() {
                refreshCountdown = 5;
                updateCountdown();
                if (countdownInterval) clearInterval(countdownInterval);
                countdownInterval = setInterval(function() {
                    refreshCountdown--;
                    if (refreshCountdown <= 0) { refreshCountdown = 5; }
                    updateCountdown();
                }, 1000);
            }

            function updateCountdown() {
                var el = document.getElementById('countdown-timer');
                if (el) el.textContent = refreshCountdown + 's';
            }

            function startAutoRefresh() {
                if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                autoRefreshInterval = setInterval(function() {
                    if (autoRefreshEnabled) {
                        loadStatus();
                        loadDashboardSummary();
                    }
                }, 5000);
                document.getElementById('btn-auto-refresh').innerHTML = '<i data-lucide="pause"></i>';
                document.getElementById('btn-auto-refresh').title = '暂停自动刷新';
                autoRefreshEnabled = true;
                startCountdown();
                refreshIcons();
            }

            function stopAutoRefresh() {
                if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                document.getElementById('btn-auto-refresh').innerHTML = '<i data-lucide="play"></i>';
                document.getElementById('btn-auto-refresh').title = '恢复自动刷新';
                autoRefreshEnabled = false;
                if (countdownInterval) clearInterval(countdownInterval);
                document.getElementById('countdown-timer').textContent = '';
                refreshIcons();
            }

            document.getElementById('btn-auto-refresh').addEventListener('click', function() {
                if (autoRefreshEnabled) stopAutoRefresh(); else startAutoRefresh();
            });
            document.getElementById('btn-refresh').addEventListener('click', function() { loadStatus(); loadDashboardSummary(); });
            document.getElementById('btn-ep-refresh').addEventListener('click', function() {
                var activeEndpointView = document.querySelector('#endpoint-view-tabs button.active');
                if (activeEndpointView && activeEndpointView.dataset.endpointView === 'pool') loadEndpointPools();
                else loadEndpointView();
            });
            document.querySelectorAll('#endpoint-view-tabs button').forEach(function(button) {
                button.addEventListener('click', function() { switchEndpointView(button.dataset.endpointView); });
            });
            document.getElementById('btn-create-pool').addEventListener('click', function() { openEndpointPoolForm(null); });
            document.getElementById('btn-log-pause').addEventListener('click', function() {
                requestLogPaused = !requestLogPaused;
                this.innerHTML = requestLogPaused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
                this.title = requestLogPaused ? '恢复日志' : '暂停日志';
                if (!requestLogPaused) loadRequestLogs();
                refreshIcons();
            });
            document.getElementById('request-log-model').addEventListener('change', resetRequestLogs);
            document.getElementById('request-log-status').addEventListener('change', renderRequestLogs);
            document.getElementById('request-log-path').addEventListener('change', resetRequestLogs);
            document.getElementById('mobile-nav-toggle').addEventListener('click', function() {
                document.getElementById('sidebar').classList.toggle('open');
            });

            // Token 统计事件
            document.getElementById('token-model').addEventListener('change', function() { loadTokenCharts(); });
            document.querySelectorAll('#token-range-group button').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('#token-range-group button').forEach(function(b) { b.classList.remove('active'); });
                    this.classList.add('active');
                    tokenRange = this.dataset.range;
                    loadTokenCharts();
                });
            });

            // 模型搜索
            document.getElementById('model-filter').addEventListener('input', function() {
                loadModels();
            });

            document.getElementById('btn-create-model').addEventListener('click', function() {
                openModelForm(null);
            });

            // ======================== 初始化 ========================
            function initApp() {
                var savedPage = sessionStorage.getItem('active_page') || 'dashboard';
                switchPage(savedPage);
                loadStatus();
                loadDashboardSummary();
                loadModels();
                if (savedPage === 'endpoints') { setTimeout(function() { switchEndpointView('runtime'); }, 200); }
                if (savedPage === 'token') { setTimeout(function() { loadTokenCharts(); }, 200); }
                if (savedPage === 'config') { setTimeout(function() { initCodeMirror(); loadConfigToEditor(); }, 200); }
                startAutoRefresh();
                startRequestLogPolling();
                refreshIcons();
            }

            // Visibility
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                } else {
                    if (autoRefreshEnabled) startAutoRefresh();
                    loadStatus();
                    loadDashboardSummary();
                    loadRequestLogs();
                }
            });

            window.addEventListener('resize', function() {
                Object.keys(dashboardCharts).forEach(function(key) { dashboardCharts[key].resize(); });
                Object.keys(tokenChartInst).forEach(function(key) { tokenChartInst[key].resize(); });
            });

            // Start
            checkAuthAndInit();
        })();`;
    return new Response(script, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
    });
}
