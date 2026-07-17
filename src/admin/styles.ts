export function getAdminStylesResponse(): Response {
    const css = String.raw`        /* ===== 设计系统变量 ===== */
        :root {
            --bg: #f0fdfa;
            --bg-sidebar: #0f172a;
            --bg-sidebar-hover: #1e293b;
            --bg-card: #ffffff;
            --text: #0f172a;
            --text-secondary: #475569;
            --text-muted: #94a3b8;
            --border: #e2e8f0;
            --border-light: #f1f5f9;
            --primary: #0d9488;
            --primary-hover: #0f766e;
            --primary-light: #ccfbf1;
            --primary-50: #f0fdfa;
            --success: #059669;
            --success-light: #d1fae5;
            --warning: #d97706;
            --warning-light: #fef3c7;
            --danger: #dc2626;
            --danger-light: #fee2e2;
            --info: #3b82f6;
            --info-light: #dbeafe;
            --radius-sm: 6px;
            --radius: 10px;
            --radius-lg: 16px;
            --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
            --shadow: 0 4px 12px rgba(0,0,0,0.08);
            --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
            --sidebar-w: 220px;
            --header-h: 56px;
            --transition: all 0.15s ease;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            min-height: 100vh;
            display: flex;
        }

        /* ===== 侧边栏 ===== */
        .sidebar {
            width: var(--sidebar-w);
            min-height: 100vh;
            background: var(--bg-sidebar);
            color: #fff;
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; left: 0;
            z-index: 100;
            transition: var(--transition);
            overflow-y: auto;
        }
        .sidebar-logo {
            height: var(--header-h);
            display: flex;
            align-items: center;
            padding: 0 18px;
            gap: 10px;
            font-weight: 700;
            font-size: 1rem;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            flex-shrink: 0;
        }
        .sidebar-logo .logo-icon { font-size: 1.25rem; }
        .sidebar-logo .sub { font-weight: 400; font-size: 0.7rem; opacity: 0.5; }
        .sidebar-nav { flex: 1; padding: 8px; }
        .sidebar-nav button {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 10px 14px;
            background: transparent;
            border: none;
            border-radius: var(--radius-sm);
            color: rgba(255,255,255,0.65);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition);
            text-align: left;
        }
        .sidebar-nav button:hover { background: var(--bg-sidebar-hover); color: #fff; }
        .sidebar-nav button.active {
            background: rgba(13,148,136,0.2);
            color: #5eead4;
            font-weight: 600;
        }
        .sidebar-nav button .nav-icon { font-size: 1.05rem; width: 20px; text-align: center; }

        .sidebar-footer {
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.08);
            font-size: 0.72rem;
            color: rgba(255,255,255,0.35);
            flex-shrink: 0;
        }
        .sidebar-footer .status-dot {
            display: inline-block;
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 4px;
            animation: pulse 2s infinite;
        }

        /* ===== 主内容区 ===== */
        .main {
            margin-left: var(--sidebar-w);
            flex: 1;
            min-height: 100vh;
        }
        .main-header {
            height: var(--header-h);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 28px;
            background: #fff;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .main-header h1 {
            font-size: 1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .main-header .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .main-body {
            padding: 20px 28px 40px;
            max-width: 1440px;
        }

        /* ===== 页面容器 ===== */
        .page { display: none; }
        .page.active { display: block; }

        /* ===== 卡片系统 ===== */
        .card {
            background: var(--bg-card);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            padding: 20px 24px;
            margin-bottom: 16px;
            transition: var(--transition);
        }
        .card:hover { box-shadow: var(--shadow); }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-light);
        }
        .card-title {
            font-size: 1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* ===== 统计卡片栅格 ===== */
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: var(--bg-card);
            border-radius: var(--radius);
            padding: 16px 20px;
            border-left: 3px solid var(--primary);
            box-shadow: var(--shadow-sm);
            transition: var(--transition);
        }
        .stat-card:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
        .stat-card .num {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text);
            line-height: 1.2;
            font-variant-numeric: tabular-nums;
        }
        .stat-card .lbl {
            color: var(--text-secondary);
            font-size: 0.78rem;
            margin-top: 2px;
            font-weight: 500;
        }
        .stat-card .ico { font-size: 1.25rem; margin-bottom: 6px; display: block; }

        /* ===== 徽章 ===== */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 10px;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.01em;
        }
        .badge-teal { background: var(--primary-light); color: #0f766e; }
        .badge-green { background: var(--success-light); color: #065f46; }
        .badge-yellow { background: var(--warning-light); color: #92400e; }
        .badge-red { background: var(--danger-light); color: #991b1b; }
        .badge-blue { background: var(--info-light); color: #1e40af; }
        .badge-gray { background: #f1f5f9; color: var(--text-secondary); }

        /* ===== 按钮 ===== */
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            border: none;
            border-radius: var(--radius-sm);
            font-weight: 600;
            font-size: 0.8rem;
            cursor: pointer;
            transition: var(--transition);
            white-space: nowrap;
            line-height: 1.4;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-primary:hover:not(:disabled) { background: var(--primary-hover); box-shadow: 0 2px 8px rgba(13,148,136,0.3); }
        .btn-success { background: var(--success); color: #fff; }
        .btn-success:hover:not(:disabled) { background: #047857; box-shadow: 0 2px 8px rgba(5,150,99,0.3); }
        .btn-danger { background: var(--danger); color: #fff; }
        .btn-danger:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 2px 8px rgba(220,38,38,0.3); }
        .btn-outline {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-secondary);
        }
        .btn-outline:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); background: var(--primary-50); }
        .btn-ghost { background: transparent; color: var(--text-secondary); border: none; }
        .btn-ghost:hover:not(:disabled) { background: var(--primary-50); color: var(--primary); }
        .btn-sm { padding: 5px 10px; font-size: 0.78rem; }
        .btn-xs { padding: 3px 8px; font-size: 0.72rem; }

        /* ===== 表格 ===== */
        .table-wrap {
            overflow-x: auto;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
        }
        table { width: 100%; border-collapse: collapse; }
        th {
            text-align: left;
            padding: 10px 12px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border);
            background: #f8fafc;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-light);
            font-size: 0.85rem;
            color: var(--text);
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--primary-50); }

        /* ===== 输入框 ===== */
        input, select, textarea {
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            font-size: 0.88rem;
            font-family: inherit;
            transition: var(--transition);
            background: #fff;
            color: var(--text);
            width: 100%;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(13,148,136,0.12);
        }
        .input-group {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .input-group input { flex: 1; }
        .filter-input { max-width: 260px; }

        /* ===== 工具栏 ===== */
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 14px;
        }
        .toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
        .toolbar-right { display: flex; align-items: center; gap: 6px; }
        .last-updated { font-size: 0.78rem; color: var(--text-muted); }

        /* ===== 空状态 ===== */
        .empty-state {
            text-align: center;
            padding: 40px 24px;
            color: var(--text-muted);
        }
        .empty-state .ico { font-size: 2.5rem; margin-bottom: 8px; }

        /* ===== loading ===== */
        .skeleton {
            display: inline-block;
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
            height: 14px;
        }

        /* ===== 模态框 ===== */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 200;
            animation: fadeIn 0.12s ease;
            backdrop-filter: blur(2px);
        }
        .modal {
            background: #fff;
            border-radius: var(--radius-lg);
            box-shadow: 0 25px 50px rgba(0,0,0,0.18);
            width: 90%;
            max-width: 560px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.2s ease;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
        }
        .modal-header h2 { font-size: 1rem; font-weight: 600; }
        .modal-close {
            width: 28px; height: 28px;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 1.1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            transition: var(--transition);
        }
        .modal-close:hover { background: var(--danger-light); color: var(--danger); }
        .modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 14px 24px;
            border-top: 1px solid var(--border);
        }
        .form-group { margin-bottom: 14px; }
        .form-group label {
            display: block;
            font-size: 0.82rem;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--text);
        }
        .form-group .help {
            font-size: 0.72rem;
            color: var(--text-muted);
            margin-top: 2px;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        /* ===== Toast ===== */
        .toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999;
            display: flex;
            flex-direction: column-reverse;
            gap: 8px;
        }
        .toast {
            padding: 10px 18px;
            border-radius: var(--radius-sm);
            font-weight: 500;
            font-size: 0.85rem;
            box-shadow: var(--shadow-lg);
            animation: slideInRight 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 400px;
        }
        .toast-success { background: #065f46; color: #fff; }
        .toast-error { background: #991b1b; color: #fff; }
        .toast-warning { background: #92400e; color: #fff; }
        .toast-info { background: #1e40af; color: #fff; }
        .toast .progress {
            position: absolute;
            bottom: 0; left: 0;
            height: 2px;
            background: rgba(255,255,255,0.4);
            border-radius: 1px;
            animation: toastProgress 3s linear forwards;
        }
        .toast { position: relative; overflow: hidden; }

        /* ===== 确认弹窗 ===== */
        .confirm-body { text-align: center; padding: 12px 0; }
        .confirm-body .ico { font-size: 2.5rem; margin-bottom: 8px; }
        .confirm-body p { color: var(--text-secondary); font-size: 0.9rem; }

        /* ===== 左右分栏（模型页） ===== */
        .split-view {
            display: flex;
            gap: 16px;
            align-items: flex-start;
        }
        .split-left {
            width: 280px;
            flex-shrink: 0;
        }
        .split-right {
            flex: 1;
            min-width: 0;
        }

        .model-list-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: var(--transition);
            border: 1px solid transparent;
        }
        .model-list-item:hover { background: var(--primary-50); }
        .model-list-item.active {
            background: var(--primary-50);
            border-color: var(--primary);
        }
        .model-list-item .ml-name {
            font-weight: 600;
            font-size: 0.85rem;
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .model-list-item .ml-badges {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
        }

        /* ===== 端点卡片 ===== */
        .ep-card {
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 12px 14px;
            margin-top: 8px;
            background: #f8fafc;
            transition: var(--transition);
        }
        .ep-card:first-child { margin-top: 0; }
        .ep-card:hover { border-color: var(--primary); }
        .ep-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
        }
        .ep-url {
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--primary);
            word-break: break-all;
            background: var(--primary-light);
            padding: 2px 8px;
            border-radius: 4px;
        }

        /* ===== Key 行 ===== */
        .key-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            border-radius: 4px;
            transition: var(--transition);
        }
        .key-row:hover { background: #fff; }
        .key-row .key-val {
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 0.78rem;
            color: var(--text-secondary);
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .key-row .key-actions { display: flex; gap: 4px; flex-shrink: 0; }

        /* ===== 状态指示 ===== */
        .status-dot-sm {
            width: 7px; height: 7px;
            border-radius: 50%;
            display: inline-block;
            flex-shrink: 0;
        }
        .dot-green { background: var(--success); }
        .dot-yellow { background: var(--warning); }
        .dot-red { background: var(--danger); }
        .dot-gray { background: var(--text-muted); }

        .status-row {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
            margin: 6px 0;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.82rem;
            color: var(--text-secondary);
        }

        /* ===== 进度条 ===== */
        .progress-bar {
            height: 6px;
            border-radius: 3px;
            background: var(--border-light);
            overflow: hidden;
        }
        .progress-bar .fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        /* ===== 单选按钮组 ===== */
        .btn-group {
            display: inline-flex;
            gap: 2px;
            background: #e6f7f5;
            border-radius: 6px;
            padding: 3px;
            flex-wrap: nowrap;
        }
        .btn-group button {
            padding: 5px 12px;
            border: none;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            background: transparent;
            color: var(--text-secondary);
            transition: var(--transition);
            white-space: nowrap;
            flex-shrink: 0;
        }
        .btn-group button:hover { color: var(--primary); }
        .btn-group button.active {
            background: #fff;
            color: var(--primary);
            box-shadow: 0 1px 3px rgba(13,148,136,0.15);
        }

        /* ===== 复制按钮反馈 ===== */
        .copy-feedback { animation: copyFlash 0.4s ease; }
        @keyframes copyFlash {
            0% { background: rgba(13,148,136,0.2); }
            100% { background: transparent; }
        }

        /* ===== 提示工具 ===== */
        .tooltip-wrap { position: relative; display: inline-flex; cursor: help; }
        .tooltip-wrap .tip {
            display: none;
            position: absolute;
            bottom: calc(100% + 4px);
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: #fff;
            font-size: 0.7rem;
            padding: 4px 8px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 10;
        }
        .tooltip-wrap:hover .tip { display: block; }

        /* ===== 动画 ===== */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }

        .spinner {
            display: inline-block;
            width: 14px; height: 14px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        /* ===== 端点详情页 ===== */
        .ep-view-card {
            background: var(--bg-card);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            margin-bottom: 10px;
            overflow: hidden;
        }
        .ep-view-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 18px;
            cursor: pointer;
            transition: var(--transition);
        }
        .ep-view-header:hover { background: var(--primary-50); }
        .ep-view-body { padding: 0 18px 12px; }

        /* ===== 健康度环 ===== */
        .health-ring {
            width: 40px; height: 40px;
            border-radius: 50%;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 700;
        }

        /* ===== 计数器倒计时 ===== */
        .countdown-ring { position: relative; display: inline-flex; align-items: center; gap: 4px; }

        /* ===== 响应式 ===== */
        @media (max-width: 900px) {
            .sidebar { width: 56px; }
            .sidebar-logo .sub, .sidebar-nav button span:not(.nav-icon) { display: none; }
            .sidebar-nav button { justify-content: center; padding: 10px; }
            .main { margin-left: 56px; }
            .split-view { flex-direction: column; }
            .split-left { width: 100%; }
            .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .main-body { padding: 12px 16px; }
            .main-header { padding: 0 16px; }
        }
        @media (max-width: 600px) {
            .stat-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
            .form-row { grid-template-columns: 1fr; }
            .sidebar { width: 0; overflow: hidden; }
            .sidebar.open { width: 220px; }
            .main { margin-left: 0; }
        }`;
    return new Response(css, {
        headers: { "content-type": "text/css; charset=utf-8" },
    });
}
