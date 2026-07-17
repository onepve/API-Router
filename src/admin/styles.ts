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
        }

        /* ===== Operations console redesign ===== */
        :root {
            --bg: #f3f5f7;
            --bg-sidebar: #202830;
            --bg-sidebar-hover: #2a3540;
            --bg-card: #ffffff;
            --text: #17212b;
            --text-secondary: #61707d;
            --text-muted: #8a97a2;
            --border: #dce2e7;
            --border-light: #edf0f2;
            --primary: #167c73;
            --primary-hover: #11665f;
            --primary-light: #dcefeb;
            --primary-50: #f1f8f7;
            --success: #2f8f62;
            --success-light: #e3f2ea;
            --warning: #c27a21;
            --warning-light: #fbefdc;
            --danger: #c84a42;
            --danger-light: #f8e5e3;
            --info: #447aa8;
            --info-light: #e4edf5;
            --radius-sm: 5px;
            --radius: 7px;
            --radius-lg: 8px;
            --shadow-sm: 0 1px 2px rgba(22, 33, 43, .05);
            --shadow: 0 8px 22px rgba(22, 33, 43, .07);
            --shadow-lg: 0 18px 48px rgba(22, 33, 43, .16);
            --sidebar-w: 208px;
            --header-h: 52px;
        }
        body { background: var(--bg); font-size: 14px; letter-spacing: 0; }
        button, input, select, textarea { letter-spacing: 0; }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
            outline: 2px solid rgba(22, 124, 115, .55);
            outline-offset: 2px;
        }
        .sidebar { box-shadow: 1px 0 0 rgba(255,255,255,.06); }
        .sidebar-logo { height: 68px; padding: 0 16px; gap: 10px; }
        .brand-mark {
            display: inline-grid; place-items: center; width: 32px; height: 32px;
            border: 1px solid rgba(255,255,255,.24); border-radius: 6px;
            color: #fff; font: 700 12px/1 ui-monospace, monospace;
        }
        .brand-copy { display: flex; min-width: 0; flex-direction: column; }
        .brand-copy strong { font-size: 13px; color: #fff; }
        .brand-copy small { color: #8fa0ad; font-size: 9px; text-transform: uppercase; }
        .sidebar-nav { padding: 14px 10px; }
        .sidebar-nav button { min-height: 38px; padding: 9px 11px; border-radius: 5px; gap: 11px; font-size: 13px; }
        .sidebar-nav button svg { width: 17px; height: 17px; stroke-width: 1.8; flex: 0 0 auto; }
        .sidebar-nav button.active { background: #31423f; color: #91d2c9; box-shadow: inset 2px 0 #52a99f; }
        .sidebar-footer { display: flex; align-items: center; gap: 6px; padding: 14px 16px; }
        .main-header { padding: 0 24px; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); }
        .main-header h1 { font-size: 14px; font-weight: 650; }
        .main-body { max-width: none; padding: 18px 24px 36px; }
        .mobile-nav-toggle { display: none; }
        .card, .ep-view-card, .panel {
            border: 1px solid var(--border); border-radius: var(--radius); background: #fff;
            box-shadow: var(--shadow-sm);
        }
        .card { padding: 18px 20px; }
        .card:hover { box-shadow: var(--shadow-sm); }
        .panel { min-width: 0; overflow: hidden; }
        .icon-btn {
            display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0;
            border: 1px solid var(--border); border-radius: 5px; background: #fff;
            color: var(--text-secondary); cursor: pointer;
        }
        .icon-btn:hover { color: var(--primary); border-color: #aacdc8; background: var(--primary-50); }
        .icon-btn svg { width: 15px; height: 15px; }
        .ops-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .ops-toolbar h2 { font-size: 20px; line-height: 1.15; font-weight: 680; }
        .eyebrow, .panel-kicker { color: var(--primary); font: 700 9px/1.2 ui-monospace, monospace; letter-spacing: .08em; }
        .ops-toolbar-actions { display: flex; align-items: center; gap: 7px; }
        .ops-toolbar-actions .last-updated, #countdown-timer { font-size: 11px; color: var(--text-muted); }
        .ops-metrics { display: grid; grid-template-columns: repeat(8, minmax(118px, 1fr)); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: #fff; margin-bottom: 12px; }
        .ops-metric { min-width: 0; padding: 12px 13px; border-right: 1px solid var(--border-light); cursor: default; }
        .ops-metric:last-child { border-right: 0; }
        .ops-metric span, .ops-metric small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ops-metric span { font-size: 10px; color: var(--text-secondary); margin-bottom: 5px; }
        .ops-metric strong { display: block; font: 700 19px/1.15 ui-monospace, Consolas, monospace; color: var(--text); white-space: nowrap; }
        .ops-metric small { margin-top: 4px; font-size: 9px; color: var(--text-muted); }
        .ops-metric.metric-alert strong { color: var(--danger); }
        .ops-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(340px, .85fr); gap: 12px; align-items: start; }
        .ops-primary { display: grid; gap: 12px; min-width: 0; }
        .panel-heading { min-height: 49px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--border-light); }
        .panel-heading h3 { margin-top: 2px; font-size: 13px; font-weight: 650; }
        .chart-surface { width: 100%; height: 210px; padding: 4px; }
        .chart-compact { height: 192px; }
        .ops-lower-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 12px; }
        .health-matrix { min-height: 192px; max-height: 260px; overflow: auto; }
        .health-row { display: grid; grid-template-columns: minmax(110px,1fr) 92px 80px; gap: 10px; align-items: center; min-height: 38px; padding: 7px 12px; border-bottom: 1px solid var(--border-light); }
        .health-row:last-child { border-bottom: 0; }
        .health-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
        .health-keys { font: 600 10px/1 ui-monospace, monospace; color: var(--text-secondary); text-align: right; }
        .health-meter { height: 5px; background: #e8ecef; border-radius: 2px; overflow: hidden; }
        .health-meter span { display: block; height: 100%; background: var(--success); }
        .request-stream { position: sticky; top: calc(var(--header-h) + 12px); height: calc(100vh - var(--header-h) - 30px); display: flex; flex-direction: column; }
        .request-stream-heading { flex: 0 0 auto; }
        .request-filters { display: grid; grid-template-columns: minmax(90px,1fr) 92px 110px; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border-light); }
        .request-filters input, .request-filters select { height: 30px; padding: 5px 8px; font-size: 10px; }
        .request-table-wrap { flex: 1; min-height: 0; overflow: auto; }
        .request-table { table-layout: fixed; }
        .request-table th { position: sticky; top: 0; z-index: 1; padding: 7px 8px; font-size: 9px; background: #f7f9fa; }
        .request-table td { padding: 7px 8px; font-size: 10px; vertical-align: middle; }
        .request-table th:nth-child(1), .request-table td:nth-child(1) { width: 54px; }
        .request-table th:nth-child(2), .request-table td:nth-child(2) { width: 48px; }
        .request-table th:nth-child(4), .request-table td:nth-child(4) { width: 56px; text-align: right; }
        .request-table th:nth-child(5), .request-table td:nth-child(5) { width: 58px; text-align: right; }
        .request-row { cursor: pointer; position: relative; }
        .request-row td:first-child { border-left: 2px solid var(--success); }
        .request-row.is-error td:first-child { border-left-color: var(--danger); }
        .request-row:hover td { background: #f5faf9; }
        .request-model { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 10px/1.2 ui-monospace, monospace; }
        .request-path { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 8px; margin-top: 2px; }
        .status-code { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 20px; border-radius: 3px; background: var(--success-light); color: #256d4b; font: 700 9px/1 ui-monospace, monospace; }
        .status-code.warn { background: var(--warning-light); color: #895415; }
        .status-code.error { background: var(--danger-light); color: #963a34; }
        .request-detail td { padding: 8px 12px 10px 16px; background: #f7f9fa; color: var(--text-secondary); font: 9px/1.55 ui-monospace, monospace; }
        .muted-cell { text-align: center; color: var(--text-muted); padding: 26px 10px !important; }
        .table-wrap { border-radius: 5px; }
        th { background: #f7f9fa; letter-spacing: .04em; }
        .badge { border-radius: 3px; padding: 2px 6px; letter-spacing: 0; }
        .btn { border-radius: 5px; }
        .modal { border-radius: 8px; }
        .modal-overlay { backdrop-filter: blur(3px); }
        .split-left { width: 300px; }
        .model-list-item { border-radius: 4px; }
        .model-list-item.active { border-color: #9ccac4; box-shadow: inset 2px 0 var(--primary); }
        .CodeMirror { min-height: calc(100vh - 190px); border: 1px solid var(--border); border-radius: 5px; font: 12px/1.55 ui-monospace, Consolas, monospace; }

        /* ===== Secondary operations workspaces ===== */
        .workspace { min-width: 0; }
        .workspace-header {
            min-height: 64px; display: flex; align-items: flex-end; justify-content: space-between;
            gap: 18px; margin-bottom: 14px;
        }
        .workspace-header h2 { margin-top: 3px; font-size: 20px; line-height: 1.2; font-weight: 680; }
        .workspace-header p { margin-top: 4px; color: var(--text-secondary); font-size: 11px; }
        .workspace-actions, .token-controls { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .workspace-panel { min-width: 0; background: #fff; border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); overflow: hidden; }
        .panel-note { color: var(--text-muted); font-size: 10px; }
        .panel-tools { padding: 10px; border-bottom: 1px solid var(--border-light); }
        .search-control { position: relative; }
        .search-control svg { position: absolute; top: 50%; left: 9px; width: 14px; height: 14px; color: var(--text-muted); transform: translateY(-50%); pointer-events: none; }
        .search-control input { height: 34px; padding-left: 31px; font-size: 12px; }

        .model-master-detail { display: grid; grid-template-columns: 318px minmax(0, 1fr); gap: 12px; align-items: start; }
        .model-list-panel, .model-detail-panel { height: calc(100vh - 154px); }
        .model-list-panel { display: flex; flex-direction: column; }
        .model-list-scroll { flex: 1; min-height: 0; overflow: auto; padding: 6px; }
        .model-detail-panel { overflow: auto; }
        .model-detail-content { min-height: 100%; padding: 18px 20px; }
        .model-detail-content > .card-header { margin: -2px 0 16px; }
        .model-detail-content .card-title svg { width: 16px; height: 16px; }
        .detail-section-title { display: flex; align-items: center; justify-content: space-between; margin: 17px 0 8px; color: var(--text-secondary); font-size: 11px; font-weight: 650; }
        .detail-section-title strong { display: inline-grid; place-items: center; min-width: 24px; height: 20px; padding: 0 6px; border-radius: 3px; background: #edf2f4; color: var(--text); font: 700 9px/1 ui-monospace, Consolas, monospace; }
        .model-list-item { min-height: 48px; padding: 8px 10px; }
        .model-list-item .ml-name { font: 600 11px/1.35 ui-monospace, Consolas, monospace; }
        .model-list-item .ml-badges { max-width: 118px; flex-wrap: wrap; justify-content: flex-end; }
        .model-list-item .badge { font-size: 8px; }
        .model-detail-panel .ep-card { background: #f8fafb; }

        .data-toolbar { min-height: 58px; display: flex; align-items: flex-end; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border-light); }
        .filter-control { width: 190px; }
        .filter-control:nth-child(2) { width: 138px; }
        .filter-control label { display: block; margin: 0 0 4px 2px; color: var(--text-muted); font-size: 9px; font-weight: 650; text-transform: uppercase; }
        .filter-control select { height: 32px; padding: 5px 9px; font-size: 11px; }
        .data-toolbar-summary { margin-left: auto; align-self: center; color: var(--text-secondary); font: 600 10px/1.3 ui-monospace, Consolas, monospace; }
        .endpoint-table { overflow: auto; }
        .endpoint-data-table { table-layout: fixed; min-width: 780px; }
        .endpoint-data-table th, .endpoint-data-table td { padding: 9px 11px; }
        .endpoint-data-table th:nth-child(1), .endpoint-data-table td:nth-child(1) { width: 34px; text-align: center; }
        .endpoint-data-table th:nth-child(2), .endpoint-data-table td:nth-child(2) { width: 20%; }
        .endpoint-data-table th:nth-child(4), .endpoint-data-table td:nth-child(4) { width: 130px; }
        .endpoint-data-table th:nth-child(5), .endpoint-data-table td:nth-child(5) { width: 128px; }
        .endpoint-data-table th:nth-child(6), .endpoint-data-table td:nth-child(6) { width: 74px; text-align: right; }
        .endpoint-main-row { cursor: pointer; }
        .endpoint-main-row td { background: #fff; }
        .endpoint-main-row:hover td { background: #f5faf9; }
        .endpoint-toggle { display: inline-grid; place-items: center; width: 24px; height: 24px; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; }
        .endpoint-toggle svg { width: 14px; height: 14px; transition: transform .15s ease; }
        .endpoint-main-row.expanded .endpoint-toggle svg { transform: rotate(90deg); }
        .endpoint-url-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font: 600 11px/1.35 ui-monospace, Consolas, monospace; }
        .endpoint-detail-row[hidden] { display: none; }
        .endpoint-detail-row td { padding: 0; background: #f7f9fa; }
        .endpoint-detail-content { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--border-light); border-top: 1px solid var(--border-light); }
        .endpoint-detail-metric { padding: 11px 14px; background: #f8fafb; }
        .endpoint-detail-metric span { display: block; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
        .endpoint-detail-metric strong { display: block; margin-top: 3px; font: 650 12px/1.3 ui-monospace, Consolas, monospace; }
        .health-inline { display: flex; align-items: center; gap: 8px; }
        .health-inline .progress-bar { flex: 1; min-width: 58px; }

        .token-header { align-items: flex-end; }
        .token-controls select { width: 190px; height: 32px; font-size: 11px; }
        .btn-group { display: inline-flex; border: 1px solid var(--border); border-radius: 5px; overflow: hidden; background: #fff; }
        .btn-group button { min-height: 30px; padding: 5px 10px; border: 0; border-right: 1px solid var(--border); background: #fff; color: var(--text-secondary); font-size: 10px; cursor: pointer; }
        .btn-group button:last-child { border-right: 0; }
        .btn-group button.active { background: var(--primary); color: #fff; }
        .token-overview { margin-bottom: 12px; }
        #token-summary-cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: #fff; }
        #token-summary-cards .usage-metric { min-width: 0; padding: 12px 14px; border-right: 1px solid var(--border-light); }
        #token-summary-cards .usage-metric:last-child { border-right: 0; }
        .usage-metric span { display: block; color: var(--text-secondary); font-size: 10px; }
        .usage-metric strong { display: block; margin-top: 5px; color: var(--text); font: 700 19px/1.15 ui-monospace, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; }
        .usage-metric small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 9px; }
        .usage-metric.cost strong { color: var(--primary); }
        .token-analysis-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .65fr); gap: 12px; margin-bottom: 12px; }
        .token-trend-panel { grid-row: span 2; }
        .analysis-chart { width: 100%; height: 214px; }
        .chart-wide { height: 478px; }
        .cost-breakdown-panel .table-wrap { border: 0; border-radius: 0; max-height: 420px; }
        .cost-breakdown-panel th { position: sticky; top: 0; z-index: 1; }

        .config-workspace { display: flex; flex-direction: column; min-height: calc(100vh - 90px); }
        .config-editor-panel { flex: 1; display: flex; flex-direction: column; min-height: 620px; }
        .config-editor-bar { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 12px; border-bottom: 1px solid var(--border-light); background: #f7f9fa; }
        .config-file-name { color: var(--text); font: 650 11px/1 ui-monospace, Consolas, monospace; }
        #config-status { color: var(--text-muted); font-size: 10px; }
        .config-editor-panel .CodeMirror { flex: 1; min-height: 0; height: auto; border: 0; border-radius: 0; }
        .config-editor-panel > textarea { flex: 1; min-height: 560px; border: 0; border-radius: 0; resize: vertical; font-family: ui-monospace, Consolas, monospace; }

        @media (max-width: 1280px) {
            .ops-metrics { grid-template-columns: repeat(4, 1fr); }
            .ops-metric:nth-child(4) { border-right: 0; }
            .ops-metric:nth-child(-n+4) { border-bottom: 1px solid var(--border-light); }
            .ops-layout { grid-template-columns: minmax(0, 1.4fr) minmax(320px, .8fr); }
            .token-analysis-grid { grid-template-columns: minmax(0, 1.3fr) minmax(260px, .7fr); }
        }
        @media (max-width: 980px) {
            .ops-layout { grid-template-columns: 1fr; }
            .request-stream { position: static; height: 540px; }
            .ops-lower-grid { grid-template-columns: 1fr; }
            .model-master-detail { grid-template-columns: 280px minmax(0, 1fr); }
            .token-analysis-grid { grid-template-columns: 1fr 1fr; }
            .token-trend-panel { grid-column: 1 / -1; grid-row: auto; }
            .chart-wide { height: 280px; }
        }
        @media (max-width: 900px) {
            .brand-copy, .sidebar-footer span:last-child { display: none; }
            .sidebar-logo { justify-content: center; padding: 0; }
            .sidebar-nav button { justify-content: center; padding: 9px; }
            .sidebar-nav button span { display: none; }
        }
        @media (max-width: 600px) {
            .main-header { padding: 0 12px; }
            .main-body { padding: 12px; }
            .mobile-nav-toggle { display: inline-grid; }
            .main-header h1 { flex: 1; }
            .ops-toolbar { align-items: flex-start; }
            .ops-toolbar-actions .last-updated, #countdown-timer { display: none; }
            .ops-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .ops-metric { border-bottom: 1px solid var(--border-light); }
            .ops-metric:nth-child(even) { border-right: 0; }
            .ops-layout { display: block; }
            .ops-primary { margin-bottom: 12px; }
            .chart-surface { height: 190px; }
            .request-stream { height: 480px; }
            .request-filters { grid-template-columns: 1fr 82px; }
            .request-filters select:last-child { grid-column: 1 / -1; }
            .split-left { width: 100%; }
            .workspace-header { align-items: flex-start; flex-direction: column; }
            .workspace-header > .btn, .workspace-actions { width: 100%; }
            .workspace-actions .btn { flex: 1; }
            .model-master-detail { display: block; }
            .model-list-panel { height: 320px; margin-bottom: 12px; }
            .model-detail-panel { height: auto; min-height: 480px; }
            .data-toolbar { align-items: stretch; flex-wrap: wrap; }
            .filter-control, .filter-control:nth-child(2) { width: calc(50% - 5px); }
            .data-toolbar-summary { width: 100%; margin-left: 0; }
            .token-controls { width: 100%; align-items: stretch; }
            .token-controls select { width: 100%; }
            .btn-group { width: 100%; overflow-x: auto; }
            .btn-group button { flex: 1; white-space: nowrap; }
            #token-summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            #token-summary-cards .usage-metric { border-bottom: 1px solid var(--border-light); }
            #token-summary-cards .usage-metric:nth-child(even) { border-right: 0; }
            #token-summary-cards .usage-metric:last-child { grid-column: 1 / -1; border-bottom: 0; }
            .token-analysis-grid { grid-template-columns: 1fr; }
            .token-trend-panel { grid-column: auto; }
            .analysis-chart, .chart-wide { height: 240px; }
            .endpoint-detail-content { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .config-workspace { min-height: calc(100vh - 76px); }
            .config-editor-panel { min-height: 540px; }
            .sidebar.open { width: 208px; box-shadow: 12px 0 32px rgba(0,0,0,.2); }
            .sidebar.open .brand-copy, .sidebar.open .sidebar-footer span:last-child { display: flex; }
            .sidebar.open .sidebar-nav button { justify-content: flex-start; }
            .sidebar.open .sidebar-nav button span { display: inline; }
        }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }`;
    return new Response(css, {
        headers: { "content-type": "text/css; charset=utf-8" },
    });
}
