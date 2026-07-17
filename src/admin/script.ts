export function getAdminScriptResponse(): Response {
    const script = String.raw`        (function() {
            'use strict';

            const BASE = '';
            const API = {
                AUTH_CHECK: BASE + '/admin/auth-check',
                STATUS: BASE + '/admin/status',
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
                document.querySelectorAll('.sidebar-nav button').forEach(function(b) {
                    b.classList.toggle('active', b.dataset.page === pageName);
                });
                document.querySelectorAll('.page').forEach(function(p) {
                    p.classList.toggle('active', p.id === 'page-' + pageName);
                });
                var titles = { dashboard:'📊 仪表盘', models:'📦 模型管理', endpoints:'🔗 端点管理', token:'📈 Token 统计', config:'⚙️ 配置编辑' };
                document.getElementById('page-title').textContent = titles[pageName] || pageName;
                sessionStorage.setItem('active_page', pageName);

                if (pageName === 'token') {
                    setTimeout(function() {
                        if (currentStatusData) updateModelSelect(currentStatusData);
                        loadTokenCharts();
                    }, 50);
                }
                if (pageName === 'config') { setTimeout(function(){ initCodeMirror(); loadConfigToEditor(); }, 50); }
                if (pageName === 'endpoints') { setTimeout(function(){ loadEndpointView(); }, 50); }
                if (pageName === 'models' && selectedModelName) {
                    setTimeout(function(){ loadModelDetail(selectedModelName); }, 50);
                }
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

            // ======================== 仪表盘 ========================
            async function loadStatus() {
                try {
                    var res = await authFetch(API.STATUS);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    currentStatusData = await res.json();
                    renderSummary(currentStatusData);
                    renderDashboardStatus(currentStatusData);
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
                    var refBadge = m.has_refs ? '<span class="badge badge-teal">🔗' + (m.endpoint_ref_count || 0) + '</span>' : '';
                    return '<div class="model-list-item ' + active + '" data-name="' + escapeHtml(m.name) + '">' +
                        '<span class="ml-name">📦 ' + escapeHtml(m.name) + '</span>' +
                        '<span class="ml-badges">' +
                        '<span class="badge ' + matchBadge + '">' + matchType + '</span>' +
                        refBadge +
                        '<span class="badge badge-gray">' + (m.endpoint_count || 0) + 'EP</span>' +
                        '<span class="badge badge-gray">' + (m.key_count || 0) + 'K</span>' +
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
                var html = '<div class="card">' +
                    '<div class="card-header">' +
                    '<div class="card-title">📦 ' + escapeHtml(name) + ' <span class="badge ' + matchBadge + '">' + matchType + '</span></div>' +
                    '<div style="display:flex;gap:6px;">' +
                    '<button class="btn btn-sm btn-outline edit-model-btn" data-name="' + escapeHtml(name) + '">✏️ 编辑</button>' +
                    '<button class="btn btn-sm btn-danger del-model-btn" data-name="' + escapeHtml(name) + '">🗑 删除</button>' +
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
                if (model.redirects && model.redirects.length > 0) {
                    html += '<div style="margin-bottom:12px;"><span style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);">↳ 重定向规则:</span> ';
                    model.redirects.forEach(function(r) {
                        html += '<span class="badge badge-yellow" style="margin-left:4px;">' + escapeHtml(r.pre) + ' → ' + escapeHtml(r.to) + ' (w:' + (r.weight||1) + ')</span>';
                    });
                    html += '</div>';
                }

                // 端点列表
                var totalEps = (endpoints.length || 0) + (model.endpoint_refs ? model.endpoint_refs.length : 0);
                html += '<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">🔗 端点 (' + totalEps + ')</div>';
                // 共享端点（来自 endpoint_pool）
                if (model.endpoint_refs && model.endpoint_refs.length > 0) {
                    model.endpoint_refs.forEach(function(refName, refIdx) {
                        var poolEpId = 'pool-ep-' + refIdx;
                        html += '<div class="ep-card" style="border-left:3px solid var(--primary);">' +
                            '<div class="ep-header">' +
                            '<span class="ep-url">' + escapeHtml(refName) + '</span>' +
                            '<span class="badge badge-teal">🔗 端点池共享</span></div>' +
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
                            '<span style="font-size:0.75rem;color:var(--text-secondary);">权重:' + (ep.weight||1) + ' 超时:' + (ep.timeout||'-') + 's</span></div>';
                        // Keys
                        html += '<div id="ep-keys-' + i + '">';
                        // Load key status inline
                        html += '</div>' +
                            '<div class="input-group" style="margin-top:8px;">' +
                            '<input type="text" id="ep-key-input-' + i + '" placeholder="新增 API Key..." style="font-size:0.82rem;" class="key-input">' +
                            '<button class="btn btn-sm btn-primary add-ep-key-btn" data-model="' + escapeHtml(name) + '" data-idx="' + i + '">添加</button>' +
                            '<button class="btn btn-sm btn-danger delete-ep-btn" data-model="' + escapeHtml(name) + '" data-idx="' + i + '" title="删除此端点">✕</button></div></div>';
                    });
                }

                // 添加端点按钮
                html += '<div style="margin-top:12px;text-align:center;"><button class="btn btn-sm btn-outline add-ep-btn" data-model="' + escapeHtml(name) + '">➕ 添加端点</button></div>';

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
                        } else { showToast('删除失败', 'error'); }
                    });
                });
                detail.querySelectorAll('.edit-model-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        openModelForm(model, []);
                    });
                });
                detail.querySelectorAll('.add-ep-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        openAddEndpointForm(name);
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
                            '<span class="key-actions">' +
                            '<button class="btn btn-xs btn-ghost copy-key-btn" title="复制" data-key="' + escapeHtml(k.key_preview) + '">📋</button>' +
                            '<button class="btn btn-xs btn-ghost del-pool-key-btn" title="删除" data-pool="' + escapeHtml(poolName) + '" data-key="' + i + '" style="color:var(--danger);">✕</button></span></div>';
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
                    container.querySelectorAll('.copy-key-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            navigator.clipboard.writeText(btn.dataset.key).then(function() {
                                showToast('已复制到剪贴板', 'success');
                            }).catch(function() { showToast('复制失败', 'error'); });
                        });
                    });
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
                            '<span class="key-actions">' +
                            '<button class="btn btn-xs btn-ghost copy-key-btn" title="复制 Key" data-key="' + escapeHtml(k.key_preview) + '">📋</button>' +
                            '<button class="btn btn-xs btn-ghost del-key-btn" title="删除" data-model="' + escapeHtml(modelName) + '" data-ep="' + epIdx + '" data-key="' + i + '" style="color:var(--danger);">✕</button></span></div>';
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
                    container.querySelectorAll('.copy-key-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            navigator.clipboard.writeText(btn.dataset.key).then(function() {
                                showToast('已复制到剪贴板', 'success');
                                btn.parentElement.parentElement.classList.add('copy-feedback');
                                setTimeout(function() { btn.parentElement.parentElement.classList.remove('copy-feedback'); }, 400);
                            }).catch(function() {
                                showToast('复制失败', 'error');
                            });
                        });
                    });
                } catch (e) {
                    if (e.message !== 'Unauthorized') container.innerHTML = '<p style="color:var(--danger);font-size:0.78rem;">加载失败</p>';
                }
            }

            // ======================== 模型表单 ========================
            function openModelForm(existingModel, allModels) {
                var isEdit = !!existingModel;
                var title = isEdit ? '编辑模型: ' + existingModel.name : '创建模型';
                var body = '';
                var fields = [
                    { id: 'mf-name', label: '模型名称/匹配模式', type: 'text', value: existingModel ? existingModel.name : '', help: '支持精确匹配、前缀匹配(以*结尾)和正则匹配(以^开头)', required: true, readonly: isEdit },
                    { id: 'mf-cooldown', label: '冷却时间(ms)', type: 'number', value: existingModel && existingModel.cooldown_ms ? existingModel.cooldown_ms : '', help: '可选，默认 60000' },
                    { id: 'mf-delete-after', label: '持续失败删除(ms)', type: 'number', value: existingModel && existingModel.delete_after_failure_ms ? existingModel.delete_after_failure_ms : '', help: '可选，默认 3600000' },
                    { id: 'mf-timeout', label: '默认超时(秒)', type: 'number', value: existingModel && existingModel.default_timeout ? existingModel.default_timeout : '', help: '可选' },
                    { id: 'mf-retries', label: '默认最大重试', type: 'number', value: existingModel && existingModel.default_max_retries ? existingModel.default_max_retries : '', help: '可选' },
                    { id: 'mf-type', label: '支持端点类型', type: 'text', value: existingModel && existingModel.type ? existingModel.type.join(', ') : '', help: '可选，逗号分隔。别名: openai, chat, completions, embeddings, images, audio, response, claude, messages。也支持字面路径如 /v1/chat/completions' },
                ];
                fields.forEach(function(f) {
                    body += '<div class="form-group"><label>' + f.label + (f.required ? ' <span style="color:var(--danger)">*</span>' : '') + '</label>' +
                        '<input type="' + f.type + '" id="' + f.id + '" value="' + escapeHtml(String(f.value || '')) + '"' +
                        (f.readonly ? ' readonly style="background:#f1f5f9;"' : '') + '>' +
                        (f.help ? '<div class="help">' + f.help + '</div>' : '') + '</div>';
                });
                // 重定向
                body += '<div class="form-group"><label>重定向规则</label><div class="help">可选，当所有端点不可用时触发</div></div>';
                body += '<div id="redirect-rules-container">';
                var redirects = existingModel && existingModel.redirects ? existingModel.redirects : [];
                if (redirects.length === 0) {
                    body += '<div class="input-group" style="margin-bottom:8px;"><input type="text" class="rd-pre" placeholder="匹配模式(如 *)" style="flex:1;"><input type="text" class="rd-to" placeholder="目标模型" style="flex:1;"><input type="number" class="rd-weight" placeholder="权重" style="width:80px;" value="1"><button class="btn btn-sm btn-ghost remove-rule-btn" onclick="this.parentElement.remove()">✕</button></div>';
                } else {
                    redirects.forEach(function(r) {
                        body += '<div class="input-group" style="margin-bottom:8px;"><input type="text" class="rd-pre" placeholder="匹配模式" value="' + escapeHtml(r.pre) + '" style="flex:1;"><input type="text" class="rd-to" placeholder="目标模型" value="' + escapeHtml(r.to) + '" style="flex:1;"><input type="number" class="rd-weight" placeholder="权重" style="width:80px;" value="' + (r.weight || 1) + '"><button class="btn btn-sm btn-ghost remove-rule-btn" onclick="this.parentElement.remove()">✕</button></div>';
                    });
                }
                body += '</div>';
                body += '<button class="btn btn-sm btn-outline" id="btn-add-redirect-rule">➕ 添加重定向规则</button>';

                var footer =
                    '<button class="btn btn-outline" onclick="closeModal()">取消</button>' +
                    '<button class="btn btn-primary" id="btn-model-save">' + (isEdit ? '保存修改' : '创建') + '</button>';
                openModal(title, body, footer);

                document.getElementById('btn-add-redirect-rule').addEventListener('click', function() {
                    var c = document.getElementById('redirect-rules-container');
                    var d = document.createElement('div');
                    d.className = 'input-group';
                    d.style.marginBottom = '8px';
                    d.innerHTML = '<input type="text" class="rd-pre" placeholder="匹配模式(如 *)" style="flex:1;"><input type="text" class="rd-to" placeholder="目标模型" style="flex:1;"><input type="number" class="rd-weight" placeholder="权重" style="width:80px;" value="1"><button class="btn btn-sm btn-ghost remove-rule-btn" onclick="this.parentElement.remove()">✕</button>';
                    c.appendChild(d);
                });

                document.getElementById('btn-model-save').addEventListener('click', async function() {
                    var name = document.getElementById('mf-name').value.trim();
                    if (!name) { showToast('模型名称不能为空', 'warning'); return; }
                    var payload = {
                        name: name,
                        cooldown_ms: parseInt(document.getElementById('mf-cooldown').value) || undefined,
                        delete_after_failure_ms: parseInt(document.getElementById('mf-delete-after').value) || undefined,
                        default_timeout: parseInt(document.getElementById('mf-timeout').value) || undefined,
                        default_max_retries: parseInt(document.getElementById('mf-retries').value) || undefined,
                        redirects: []
                    };
                    document.querySelectorAll('#redirect-rules-container .input-group').forEach(function(group) {
                        var pre = group.querySelector('.rd-pre').value.trim();
                        var to = group.querySelector('.rd-to').value.trim();
                        var weight = parseInt(group.querySelector('.rd-weight').value) || 1;
                        if (pre && to) payload.redirects.push({ pre: pre, weight: weight, to: to });
                    });
                    if (payload.redirects.length === 0) delete payload.redirects;
                    var typeStr = document.getElementById('mf-type').value.trim();
                    if (typeStr) payload.type = typeStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });

                    var btn = document.getElementById('btn-model-save');
                    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 保存中...';
                    try {
                        var res;
                        if (isEdit) {
                            res = await authFetch(API.MODELS + '/' + encodeURIComponent(existingModel.name), {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            });
                        } else {
                            res = await authFetch(API.MODELS, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                            });
                        }
                        if (res.ok || res.status === 201) {
                            showToast(isEdit ? '模型已更新' : '模型已创建', 'success');
                            closeModal();
                            loadModels();
                            loadStatus();
                        } else { var e = await res.json(); showToast('操作失败: ' + (e.error || ''), 'error'); btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '创建'; }
                    } catch(e) { if (e.message !== 'Unauthorized') showToast('网络错误', 'error'); btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '创建'; }
                });
            }

            function openAddEndpointForm(modelName) {
                var body = '<div class="form-group"><label>Base URL <span style="color:var(--danger)">*</span></label>' +
                    '<input type="text" id="aef-url" placeholder="https://api.example.com/v1"></div>' +
                    '<div class="form-row"><div class="form-group"><label>权重</label><input type="number" id="aef-weight" value="1"></div>' +
                    '<div class="form-group"><label>超时(秒)</label><input type="number" id="aef-timeout" placeholder="默认"></div></div>' +
                    '<div class="form-row"><div class="form-group"><label>最大重试</label><input type="number" id="aef-retries" placeholder="默认"></div></div>';
                var footer = '<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" id="aef-save">添加</button>';
                openModal('添加端点到 ' + escapeHtml(modelName), body, footer);
                document.getElementById('aef-save').addEventListener('click', async function() {
                    var url = document.getElementById('aef-url').value.trim();
                    if (!url) { showToast('Base URL 不能为空', 'warning'); return; }
                    var payload = { base_url: url, weight: parseInt(document.getElementById('aef-weight').value) || 1, timeout: parseInt(document.getElementById('aef-timeout').value) || undefined, max_retries: parseInt(document.getElementById('aef-retries').value) || undefined };
                    var btn = document.getElementById('aef-save');
                    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 添加中...';
                    var r = await authFetch(API.MODELS + '/' + encodeURIComponent(modelName) + '/endpoints', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                    });
                    if (r.ok || r.status === 201) { showToast('端点已添加', 'success'); closeModal(); loadModelDetail(modelName); loadStatus(); }
                    else { var e = await r.json(); showToast('添加失败: ' + (e.error || ''), 'error'); btn.disabled = false; btn.textContent = '添加'; }
                });
            }

            // ======================== 端点管理（端点维度视图） ========================
            async function loadEndpointView() {
                try {
                    var statusRes = await authFetch(API.STATUS);
                    var status = await statusRes.json();
                    var modelRes = await authFetch(API.MODELS);
                    var models = await modelRes.json();
                    renderEndpointView(status, models);
                } catch (e) {
                    if (e.message !== 'Unauthorized') {
                        document.getElementById('endpoint-list').innerHTML = '<div class="empty-state"><div class="ico">❌</div><p>加载失败</p></div>';
                    }
                }
            }

            function renderEndpointView(statusData, models) {
                var container = document.getElementById('endpoint-list');
                var filterModel = document.getElementById('ep-filter-model').value;
                var filterStatus = document.getElementById('ep-filter-status').value;

                var allEndpoints = [];
                var modelNames = new Set();
                for (var modelKey in statusData) {
                    if (modelKey === '_summary') continue;
                    var pattern = extractModelPattern(modelKey);
                    modelNames.add(pattern);
                    var eps = statusData[modelKey] || [];
                    eps.forEach(function(ep) {
                        allEndpoints.push({ model: pattern, modelKey: modelKey, baseUrl: ep.base_url, keys: ep.keys || {}, weight: ep.weight });
                    });
                }

                // 更新筛选器
                var select = document.getElementById('ep-filter-model');
                var curVal = select.value;
                select.innerHTML = '<option value="all">📊 全部模型</option>';
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
                else if (filterStatus === 'down') filtered = filtered.filter(function(ep) { return ep.keys.active === 0 && ep.keys.total > 0; });

                if (!filtered || filtered.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="ico">📭</div><p>无匹配端点</p></div>';
                    return;
                }

                var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px;">';
                filtered.forEach(function(ep) {
                    var total = ep.keys.total || 0;
                    var active = ep.keys.active || 0;
                    var cooldown = ep.keys.cooldown || 0;
                    var health = total > 0 ? Math.round(active / total * 100) : 0;
                    var healthColor = health >= 80 ? '#059669' : (health >= 50 ? '#d97706' : '#dc2626');
                    html += '<div class="card ep-card-link" data-ep-model="' + escapeHtml(ep.model) + '" style="padding:14px 16px;cursor:pointer;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                        '<span class="ep-url" style="font-size:0.78rem;">' + escapeHtml(ep.baseUrl) + '</span>' +
                        '<span class="badge badge-gray" style="font-size:0.7rem;">' + escapeHtml(ep.model) + '</span></div>' +
                        '<div style="display:flex;gap:12px;align-items:center;">' +
                        '<div class="health-ring" style="border:3px solid ' + healthColor + ';color:' + healthColor + ';width:40px;height:40px;">' + health + '%</div>' +
                        '<div style="flex:1;"><div class="progress-bar"><div class="fill" style="width:' + health + '%;background:' + healthColor + ';"></div></div>' +
                        '<div style="display:flex;gap:8px;margin-top:4px;font-size:0.72rem;color:var(--text-secondary);">' +
                        '<span>● 活跃 ' + active + '</span>' +
                        (cooldown > 0 ? '<span>◉ 冷却 ' + cooldown + '</span>' : '') +
                        '<span>○ 总数 ' + total + '</span>' +
                        '<span>权重 ' + (ep.weight || 1) + '</span></div></div></div></div>';
                });
                html += '</div>';
                container.innerHTML = html;
                // 端点卡片点击 — 跳转模型管理并选中
                container.querySelectorAll('.ep-card-link').forEach(function(card) {
                    card.addEventListener('click', function() {
                        var m = card.dataset.epModel;
                        switchPage('models');
                        selectedModelName = m;
                        loadModels();
                        setTimeout(function() { loadModelDetail(m); }, 200);
                    });
                });
            }

            // ======================== Token 统计（保留现有 + 增强） ========================
            var tokenRangeType = 'd';
            var tokenRangeVal = 1;
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
                var apiPath, params, windowMs, actualVal = tokenRangeVal;
                if (tokenRangeType === 'm') {
                    actualVal = tokenRangeVal * 60;
                    apiPath = '/minutely'; params = 'minutes=' + actualVal;
                    windowMs = actualVal * 60000;
                } else if (tokenRangeType === 'h') {
                    // tokenRangeVal 已经是小时数 (如 1d=24h)
                    apiPath = '/hourly'; params = 'hours=' + tokenRangeVal;
                    windowMs = tokenRangeVal * 3600000;
                } else {
                    apiPath = '/daily'; params = 'days=' + tokenRangeVal;
                    windowMs = tokenRangeVal * 86400000;
                }
                if (model !== 'all') params += '&model=' + encodeURIComponent(model);
                try {
                    var dailyRes = await authFetch(API.TOKEN_STATS + apiPath + '?' + params);
                    var daily = await dailyRes.json();
                    var summaryRes = await authFetch(API.TOKEN_STATS + '/summary?window=' + windowMs);
                    var summary = await summaryRes.json();
                    var costParams = 'window=' + (tokenRangeType === 'm' ? '1h' : tokenRangeType === 'h' ? '1d' : tokenRangeVal + 'd');
                    if (model !== 'all') costParams += '&model=' + encodeURIComponent(model);
                    var costRes = await authFetch(API.TOKEN_COST + '?' + costParams);
                    var costData = costRes.ok ? await costRes.json() : null;
                    renderTokenMetrics(daily, costData, tokenRangeType);
                    if (typeof echarts !== 'undefined') {
                        ensureCharts();
                        (function(typ) { setTimeout(function() {
                            try { updateBarChart(daily, typ); updateLineChart(daily, typ); updatePieChart(summary); } catch (e) { console.warn('[TokenStats] chart error:', e); }
                        }, 50); })(tokenRangeType);
                    }
                } catch (e) { if (e.message !== 'Unauthorized') showToast('加载统计数据失败', 'error'); }
            }

            function renderTokenMetrics(daily, costData, type) {
                var totalTokens = daily.reduce(function(s, d) { return s + d.totalTokens; }, 0);
                var totalReqs = daily.reduce(function(s, d) { return s + d.requestCount; }, 0);
                var minutes;
                if (type === 'm') minutes = tokenRangeVal * 60;
                else if (type === 'h') minutes = tokenRangeVal * 60;
                else minutes = tokenRangeVal * 1440;
                var rpm = totalReqs > 0 ? (totalReqs / minutes).toFixed(1) : '0';
                var tpm = totalTokens > 0 ? Math.round(totalTokens / minutes) : 0;
                var costHtml = '';
                if (costData && costData.total_cost_usd > 0) {
                    costHtml = '<div class="stat-card" style="border-left-color:#6366f1;"><span class="ico">💰</span><div class="num">$' + costData.total_cost_usd.toFixed(4) + '</div><div class="lbl">预估成本 (USD)</div></div>';
                } else if (costData) {
                    costHtml = '<div class="stat-card" style="border-left-color:#94a3b8;"><span class="ico">💰</span><div class="num">$0.00</div><div class="lbl">预估成本 (USD)</div></div>';
                }
                document.getElementById('token-summary-cards').innerHTML =
                    '<div class="stat-card"><span class="ico">📊</span><div class="num">' + fmtUnit(totalTokens) + '</div><div class="lbl">总 Token 消耗</div></div>' +
                    '<div class="stat-card" style="border-left-color:#3b82f6;"><span class="ico">📨</span><div class="num">' + (totalReqs >= 1e3 ? fmtUnit(totalReqs) : totalReqs.toLocaleString()) + '</div><div class="lbl">总请求数</div></div>' +
                    costHtml +
                    '<div class="stat-card" style="border-left-color:#8b5cf6;"><span class="ico">⚡</span><div class="num">' + rpm + '</div><div class="lbl">RPM</div></div>' +
                    '<div class="stat-card" style="border-left-color:#ec4899;"><span class="ico">🚀</span><div class="num">' + fmtUnit(tpm) + '</div><div class="lbl">TPM</div></div>';
                if (costData && costData.models && costData.models.length > 0) {
                    renderPricingTable(costData.models);
                }
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
                codeMirrorEditor = CodeMirror.fromTextArea(ta, {
                    mode: 'yaml', theme: 'default', lineNumbers: true, lineWrapping: true,
                    indentUnit: 2, tabSize: 2, indentWithTabs: false, styleActiveLine: true, viewportMargin: Infinity,
                });
                codeMirrorEditor.setSize(null, 420);
                codeMirrorEditor.on('keydown', function(cm, e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveConfig(); }
                });
            }

            async function loadConfigToEditor() {
                if (!codeMirrorEditor) initCodeMirror();
                try {
                    codeMirrorEditor.setValue('加载中...');
                    var res = await authFetch(API.CONFIG);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    var text = await res.text();
                    codeMirrorEditor.setValue(text);
                    codeMirrorEditor.clearHistory();
                    document.getElementById('config-status').innerHTML = '<span style="color:var(--success);font-weight:600;">✅ 配置已加载 (' + formatTime(Date.now()) + ')</span>';
                } catch (err) {
                    if (err.message !== 'Unauthorized') {
                        document.getElementById('config-status').innerHTML = '<span style="color:var(--danger);font-weight:600;">❌ 加载失败: ' + escapeHtml(err.message) + '</span>';
                    }
                }
            }

            async function saveConfig() {
                if (!codeMirrorEditor) return;
                var yaml = codeMirrorEditor.getValue();
                try {
                    var res = await authFetch(API.CONFIG, { method: 'POST', body: yaml });
                    if (!res.ok) { var err = await res.text(); throw new Error(err); }
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
                if (!codeMirrorEditor) return;
                var text = codeMirrorEditor.getValue();
                var blob = new Blob([text], { type: 'text/yaml' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = 'config.yaml'; a.click();
                URL.revokeObjectURL(url);
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
                    if (autoRefreshEnabled) loadStatus();
                }, 5000);
                document.getElementById('btn-auto-refresh').textContent = '⏸️';
                autoRefreshEnabled = true;
                startCountdown();
            }

            function stopAutoRefresh() {
                if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                document.getElementById('btn-auto-refresh').textContent = '▶️';
                autoRefreshEnabled = false;
                if (countdownInterval) clearInterval(countdownInterval);
                document.getElementById('countdown-timer').textContent = '';
            }

            document.getElementById('btn-auto-refresh').addEventListener('click', function() {
                if (autoRefreshEnabled) stopAutoRefresh(); else startAutoRefresh();
            });
            document.getElementById('btn-refresh').addEventListener('click', function() { loadStatus(); });
            document.getElementById('btn-ep-refresh').addEventListener('click', function() { loadEndpointView(); });

            // Token 统计事件
            document.getElementById('token-model').addEventListener('change', function() { loadTokenCharts(); });
            document.querySelectorAll('#token-range-group button').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('#token-range-group button').forEach(function(b) { b.classList.remove('active'); });
                    this.classList.add('active');
                    var r = this.dataset.range;
                    var ch = r.slice(-1);
                    tokenRangeVal = parseInt(r);
                    if (ch === 'h') {
                        if (tokenRangeVal <= 5) { tokenRangeType = 'm'; }
                        else { tokenRangeType = 'h'; }
                    } else {
                        if (tokenRangeVal === 1) { tokenRangeType = 'h'; tokenRangeVal = 24; }
                        else { tokenRangeType = 'd'; }
                    }
                    loadTokenCharts();
                });
            });

            // 模型搜索
            document.getElementById('model-filter').addEventListener('input', function() {
                loadModels();
            });

            document.getElementById('btn-create-model').addEventListener('click', function() {
                openModelForm(null, []);
            });

            // ======================== 初始化 ========================
            function initApp() {
                var savedPage = sessionStorage.getItem('active_page') || 'dashboard';
                switchPage(savedPage);
                loadStatus();
                loadModels();
                if (savedPage === 'endpoints') { setTimeout(function() { loadEndpointView(); }, 200); }
                if (savedPage === 'token') { setTimeout(function() { loadTokenCharts(); }, 200); }
                if (savedPage === 'config') { setTimeout(function() { initCodeMirror(); loadConfigToEditor(); }, 200); }
                startAutoRefresh();
            }

            // Visibility
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                } else {
                    if (autoRefreshEnabled) startAutoRefresh();
                    loadStatus();
                }
            });

            // Start
            checkAuthAndInit();
        })();`;
    return new Response(script, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
    });
}
