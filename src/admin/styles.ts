// src/admin/styles.ts
// API Router 管理后台样式表 — 严格对齐 OnePve / PPanel 现代科技设计系统规范
// 1. 全屏视口自适应 (Single-Screen Viewport Fit): 杜绝整页出现上下滚动条，内容一页完整呈现，底部元素安全上移
// 2. 居中版心与舒适呼吸边距: 彻底解决“太靠边”问题，超宽屏与桌面端均有良好视觉轴线
// 3. 彻底修复前缀图标与文本重叠 Bug: .search-control 输入框精细内边距
// 4. 完备多端响应式断点: 宽屏/普通桌面/笔记本/平板/手机全自适应

export function getAdminStylesResponse(): Response {
    const css = `
        /* ============================================================
           PPanel Design System · Operations Console
           Color Tokens: 极光曜石青 (#00AEB9) + 赛博钛金蓝 (#0284C7 / #38BDF8)
           Light / Dark 双模完整闭环 · 严禁死黑泥淖 · 严禁暗底暗字
           ============================================================ */

        :root, html[data-theme="light"] {
            color-scheme: light;
            --bg-0: #f8fafc;
            --bg-1: #ffffff;
            --bg-2: #f1f5f9;
            --bg-3: #e2e8f0;
            --bg: #f8fafc;

            --text-0: #0f172a;       /* 标题正文：深蓝灰 */
            --text-1: #334155;       /* 次级说明：稳重中灰 */
            --text-2: #64748b;       /* 弱化辅助：浅灰 */
            --text: #0f172a;
            --text-secondary: #334155;
            --text-muted: #64748b;

            --border: #e2e8f0;
            --border-light: #f1f5f9;
            --border-hover: #cbd5e1;

            --primary: #00aeb9;
            --primary-hover: #00939d;
            --primary-light: #cbedee;
            --primary-50: #f0fdfa;
            --primary-text: #007a82;
            --primary-border: rgba(0, 174, 185, 0.4);
            --primary-shadow: rgba(0, 174, 185, 0.2);

            --success: #10b981;
            --success-light: #d1fae5;
            --warning: #f59e0b;
            --warning-light: #fef3c7;
            --danger: #ef4444;
            --danger-light: #fee2e2;
            --info: #0284c7;
            --info-light: #e0f2fe;

            --surface: #ffffff;
            --surface-muted: #f8fafc;
            --surface-soft: #f1f5f9;
            --surface-hover: #f1f5f9;
            --surface-control: #ffffff;
            --code-gutter: #f8fafc;

            --radius-sm: 6px;
            --radius: 10px;
            --radius-lg: 14px;
            --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
            --shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.1);
            --header-h: 56px;
            --chart-grid: #f1f5f9;
            --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        html[data-theme="dark"] {
            color-scheme: dark;
            --bg-0: #0a0e17;
            --bg-1: #111726;
            --bg-2: #161e31;
            --bg-3: #1f2b45;
            --bg: #0a0e17;

            --text-0: #f8fafc;
            --text-1: #cbd5e1;
            --text-2: #8492a6;
            --text: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-muted: #8492a6;

            --border: rgba(255, 255, 255, 0.09);
            --border-light: rgba(255, 255, 255, 0.05);
            --border-hover: rgba(255, 255, 255, 0.16);

            --primary: #00aeb9;
            --primary-hover: #00c5d2;
            --primary-light: rgba(0, 174, 185, 0.22);
            --primary-50: rgba(0, 174, 185, 0.12);
            --primary-text: #38bdf8;
            --primary-border: rgba(0, 174, 185, 0.45);
            --primary-shadow: rgba(0, 174, 185, 0.3);

            --success: #10b981;
            --success-light: rgba(16, 185, 129, 0.18);
            --warning: #f59e0b;
            --warning-light: rgba(245, 158, 11, 0.18);
            --danger: #ef4444;
            --danger-light: rgba(239, 68, 68, 0.18);
            --info: #38bdf8;
            --info-light: rgba(56, 189, 248, 0.18);

            --surface: rgba(17, 23, 38, 0.85);
            --surface-muted: rgba(22, 30, 49, 0.7);
            --surface-soft: rgba(26, 36, 58, 0.6);
            --surface-hover: rgba(33, 46, 74, 0.75);
            --surface-control: rgba(13, 18, 30, 0.85);
            --code-gutter: rgba(13, 18, 30, 0.95);

            --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
            --shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
            --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.65);
            --chart-grid: rgba(255, 255, 255, 0.05);
        }

        /* 核心重置与单屏高度闭环：彻底杜绝整页滚动条与左右溢出 */
        *, *::before, *::after {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        [hidden] {
            display: none !important;
        }

        html, body {
            width: 100%;
            height: 100%;
            max-width: 100vw;
            max-height: 100vh;
            overflow: hidden; /* 核心：锁定视口高度，杜绝全页上下滚动条 */
        }

        body {
            background-color: var(--bg-0);
            color: var(--text-0);
            font-family: var(--sans);
            font-size: 13.5px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            display: flex;
            flex-direction: column;
        }

        .skip-link {
            position: absolute;
            top: -9999px;
            left: -9999px;
            opacity: 0;
            pointer-events: none;
        }
        .skip-link:focus {
            top: 10px;
            left: 10px;
            opacity: 1;
            z-index: 9999;
            background: var(--primary);
            color: #ffffff;
            padding: 6px 12px;
            border-radius: var(--radius-sm);
        }

        /* ===== PPanel 标志性顶栏 (Masthead) ===== */
        .masthead {
            position: sticky;
            top: 0;
            z-index: 1000;
            height: var(--header-h);
            width: 100%;
            background: var(--surface);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            flex-shrink: 0;
        }
        /* 居中版心对齐机制：解决“太靠边”问题 */
        .masthead-inner {
            width: 100%;
            max-width: 1680px;
            margin: 0 auto;
            padding: 0 32px;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        .brand-logo-badge {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #00aeb9 0%, #0284c7 100%);
            display: inline-grid;
            place-items: center;
            color: #ffffff;
            font-family: var(--mono);
            font-weight: 700;
            font-size: 13px;
            box-shadow: 0 2px 10px var(--primary-shadow);
        }
        .brand-title {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: -0.3px;
            color: var(--text-0);
        }
        .brand-tag {
            font-size: 11px;
            color: var(--text-2);
            font-family: var(--mono);
            padding: 2px 6px;
            background: var(--surface-soft);
            border-radius: 4px;
            border: 1px solid var(--border-light);
        }

        /* 胶囊主导航标签 */
        .nav-tabs {
            display: flex;
            align-items: center;
            gap: 4px;
            background: var(--surface-muted);
            padding: 3px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            overflow-x: auto;
        }
        .tab-btn {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 5px 13px;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-1);
            background: transparent;
            border: none;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all .16s ease;
            white-space: nowrap;
        }
        .tab-btn svg {
            width: 15px;
            height: 15px;
            stroke-width: 1.8;
            color: var(--text-2);
            transition: color .16s ease;
        }
        .tab-btn:hover {
            color: var(--text-0);
            background: var(--surface-hover);
        }
        .tab-btn.active {
            color: var(--primary);
            background: var(--bg-1);
            font-weight: 600;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-light);
        }
        html[data-theme="dark"] .tab-btn.active {
            background: var(--primary-50);
            border-color: var(--primary-border);
            color: var(--primary-text);
        }
        .tab-btn.active svg {
            color: var(--primary);
        }

        .masthead-right {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        .readout-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 9px;
            border-radius: 999px;
            background: var(--success-light);
            border: 1px solid rgba(16, 185, 129, 0.3);
            font-family: var(--mono);
            font-size: 11px;
            color: var(--success);
            font-weight: 600;
        }
        .dot-status, .dot-online {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--success);
            box-shadow: 0 0 6px var(--success);
            animation: pulse-dot 2s infinite ease-in-out;
            display: inline-block;
        }
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
        }

        .appearance-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .icon-btn {
            display: inline-grid;
            place-items: center;
            width: 30px;
            height: 30px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-1);
            cursor: pointer;
            transition: all .16s ease;
        }
        .icon-btn svg { width: 14px; height: 14px; stroke-width: 1.8; }
        .icon-btn:hover {
            color: var(--text-0);
            border-color: var(--border-hover);
            background: var(--surface-hover);
        }
        .theme-color-menu { position: relative; }
        .theme-color-swatch {
            width: 13px;
            height: 13px;
            border-radius: 3px;
            background: var(--primary);
            box-shadow: 0 0 6px var(--primary-shadow);
        }
        .theme-color-popover {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: var(--bg-1);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 1001;
            width: 200px;
        }
        .theme-popover-heading { font-size: 11px; color: var(--text-2); margin-bottom: 8px; font-weight: 600; }
        .theme-presets { display: flex; gap: 8px; margin-bottom: 10px; }
        .theme-preset {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--swatch);
            cursor: pointer;
            transition: transform .14s ease;
        }
        .theme-preset:hover { transform: scale(1.1); }
        .theme-custom-color {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-1);
        }
        .theme-custom-color input {
            width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; background: transparent;
        }

        /* ===== 主内容视口容器：一屏撑满，杜绝溢出 ===== */
        .main {
            flex: 1;
            width: 100%;
            height: calc(100vh - var(--header-h));
            max-height: calc(100vh - var(--header-h));
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        /* 居中版心对齐机制：解决“太靠边”问题与底部留白安全感 */
        .main-body {
            width: 100%;
            max-width: 1680px;
            margin: 0 auto;
            padding: 12px 32px 20px;
            flex: 1;
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .page {
            display: none !important;
            width: 100%;
            height: 100%;
            min-height: 0;
        }
        .page.active {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            animation: fadeIn .18s ease;
            width: 100%;
            overflow: hidden;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== 页面顶部工具栏与标题：紧凑上移 ===== */
        .ops-toolbar, .workspace-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-light);
            gap: 14px;
            width: 100%;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .ops-toolbar .eyebrow, .workspace-header .eyebrow {
            font-size: 10.5px;
            font-family: var(--mono);
            color: var(--primary);
            letter-spacing: 0.8px;
            font-weight: 600;
        }
        .ops-toolbar h2, .workspace-header h2 {
            font-size: 17px;
            font-weight: 700;
            color: var(--text-0);
            letter-spacing: -0.3px;
        }
        .workspace-header p {
            font-size: 12px;
            color: var(--text-2);
            margin-top: 1px;
        }
        .ops-toolbar-actions, .workspace-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        .last-updated, #countdown-timer {
            font-family: var(--mono);
            font-size: 11px;
            color: var(--text-2);
        }

        /* ===== PPanel 标准通用工作区与卡片 ===== */
        .workspace, .workspace-panel, .panel, .card, .ep-view-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
        }
        .panel, .workspace-panel {
            overflow: hidden;
        }
        .panel-heading {
            padding: 10px 16px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .panel-heading h3 {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-0);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .panel-kicker {
            font-family: var(--mono);
            font-size: 10px;
            color: var(--primary);
            font-weight: 700;
            letter-spacing: 0.8px;
            margin-right: 6px;
        }
        .panel-note {
            font-size: 11px;
            color: var(--text-2);
            font-family: var(--mono);
        }

        /* ===== 页面 1: 仪表盘 (Dashboard) ===== */
        .ops-metrics {
            display: grid;
            grid-template-columns: repeat(8, minmax(100px, 1fr));
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            margin-bottom: 12px;
            overflow: hidden;
            width: 100%;
            flex-shrink: 0;
        }
        .ops-metric {
            padding: 10px 14px;
            border-right: 1px solid var(--border-light);
            display: flex;
            flex-direction: column;
            gap: 2px;
            background: var(--surface);
            transition: background .16s ease;
        }
        .ops-metric:hover { background: var(--surface-muted); }
        .ops-metric:last-child { border-right: none; }
        .ops-metric span {
            font-size: 11px;
            color: var(--text-2);
            font-weight: 500;
        }
        .ops-metric strong {
            font-family: var(--mono);
            font-size: 17px;
            font-weight: 700;
            color: var(--text-0);
            letter-spacing: -0.5px;
        }
        .ops-metric small {
            font-size: 10px;
            color: var(--text-2);
        }

        .ops-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.72fr) minmax(360px, 1.08fr);
            gap: 14px;
            flex: 1;
            height: 100%;
            min-height: 0;
            align-items: stretch;
            width: 100%;
            overflow: hidden;
        }
        .ops-primary {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 0;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        .chart-surface, .chart-wide {
            width: 100%;
            height: 100%;
            min-height: 0;
            padding: 8px 12px;
            background: var(--surface);
        }
        .chart-compact { height: 100%; min-height: 0; }
        .ops-lower-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            flex: 1;
            min-height: 0;
            height: 100%;
            overflow: hidden;
        }

        /* 仪表盘下半部：端点与 Key 健康矩阵 */
        .health-matrix {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px 14px;
            overflow-y: auto;
            height: 100%;
            min-height: 0;
            flex: 1;
        }
        .health-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 10px;
            background: var(--surface-control);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-sm);
            gap: 8px;
            transition: background .16s ease;
        }
        .health-row:hover { background: var(--surface-hover); }
        .health-name {
            font-family: var(--mono);
            font-size: 11.5px;
            font-weight: 600;
            color: var(--text-0);
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .health-meter {
            flex: 1;
            height: 6px;
            background: var(--surface-soft);
            border-radius: 999px;
            overflow: hidden;
            margin: 0 8px;
        }
        .health-meter span {
            display: block;
            height: 100%;
            border-radius: 999px;
            transition: width .3s ease;
        }
        .health-keys {
            font-family: var(--mono);
            font-size: 11px;
            color: var(--text-2);
            font-weight: 500;
            white-space: nowrap;
        }

        /* 仪表盘请求流 */
        .request-stream {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--surface);
            box-shadow: var(--shadow-sm);
            overflow: hidden;
        }
        .request-stream-heading {
            padding: 10px 16px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        .request-stream-heading h3 {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-0);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .request-filters {
            display: grid;
            grid-template-columns: 1fr 110px;
            gap: 8px;
            padding: 8px 14px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            flex-shrink: 0;
        }
        .request-filters input, .request-filters select {
            width: 100%;
            height: 30px;
            background: var(--surface-control);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-0);
            font-size: 11.5px;
            padding: 0 8px;
            font-family: var(--mono);
        }
        .request-table-wrap {
            flex: 1;
            height: 100%;
            min-height: 0;
            overflow-y: auto;
            background: var(--surface);
        }
        .request-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            font-family: var(--mono);
        }
        .request-table th {
            position: sticky;
            top: 0;
            background: var(--surface-muted);
            padding: 8px 12px;
            text-align: left;
            font-size: 11px;
            color: var(--text-2);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            z-index: 2;
        }
        .request-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-light);
            color: var(--text-1);
        }
        .request-table tr:hover td {
            background: var(--surface-hover);
            color: var(--text-0);
        }

        /* ===== 页面 2: 模型矩阵 (Models) 现代主从布局 ===== */
        .model-workspace {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            min-height: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            overflow: hidden;
        }
        .model-master-detail {
            display: grid;
            grid-template-columns: 310px minmax(0, 1fr);
            gap: 14px;
            flex: 1;
            height: 100%;
            min-height: 0;
            align-items: stretch;
            width: 100%;
            overflow: hidden;
        }
        .model-list-panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            height: 100%;
            min-height: 0;
        }
        .panel-tools {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            flex-shrink: 0;
        }

        /* 重点修复：搜索框前缀图标与文本重叠 Bug */
        .search-control {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
        }
        .search-control svg,
        .search-control [data-lucide="search"] {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 15px;
            height: 15px;
            color: var(--text-2);
            pointer-events: none;
            z-index: 10;
        }
        .search-control input,
        .search-control input[type="text"],
        .search-control input[type="search"],
        input#model-filter {
            width: 100% !important;
            height: 34px !important;
            padding-left: 38px !important; /* 彻底避开左侧 12px 处的放大镜图标 */
            padding-right: 12px !important;
            background: var(--surface-control) !important;
            border: 1px solid var(--border) !important;
            border-radius: var(--radius-sm) !important;
            color: var(--text-0) !important;
            font-size: 12px !important;
            font-family: var(--mono) !important;
        }

        .model-list-scroll {
            flex: 1;
            height: 100%;
            min-height: 0;
            overflow-y: auto;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .model-list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 9px 11px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            cursor: pointer;
            text-align: left;
            transition: all .16s ease;
            gap: 8px;
        }
        .model-list-item:hover {
            background: var(--surface-hover);
            border-color: var(--border-hover);
        }
        .model-list-item.active {
            background: var(--primary-50);
            border-color: var(--primary-border);
            box-shadow: 0 0 10px var(--primary-shadow);
        }
        .ml-name {
            font-family: var(--mono);
            font-size: 12px;
            font-weight: 600;
            color: var(--text-0);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .model-list-item.active .ml-name { color: var(--primary-text); }
        .ml-badges {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }

        /* 模型详情面板：内部滚动 */
        .model-detail-panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            padding: 18px 20px;
            overflow-y: auto;
            height: 100%;
            min-height: 0;
            flex: 1;
        }
        .model-detail-content .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            margin-bottom: 14px;
            border-bottom: 1px solid var(--border-light);
            gap: 12px;
        }
        .model-detail-content .card-title {
            font-size: 17px;
            font-weight: 700;
            color: var(--text-0);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: var(--mono);
        }
        .detail-section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            font-weight: 600;
            color: var(--text-0);
            margin: 16px 0 10px;
        }
        .detail-section-title strong {
            font-family: var(--mono);
            font-size: 11.5px;
            color: var(--primary);
            background: var(--primary-50);
            border: 1px solid var(--primary-border);
            padding: 1px 7px;
            border-radius: 4px;
        }
        .model-param-card, .endpoint-param-card {
            background: var(--surface-muted);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-sm);
            padding: 9px 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .model-param-card span { font-size: 11px; color: var(--text-2); }
        .model-param-card strong { font-family: var(--mono); font-size: 13px; color: var(--text-0); }

        .ep-card {
            background: var(--surface-muted);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 12px 14px;
            margin-bottom: 10px;
            transition: border-color .16s ease;
        }
        .ep-card:hover { border-color: var(--border-hover); }
        .ep-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            gap: 10px;
        }
        .ep-url {
            font-family: var(--mono);
            font-size: 12px;
            color: var(--text-1);
            word-break: break-all;
            margin-bottom: 8px;
        }
        .key-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 10px;
            background: var(--surface-control);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-sm);
            margin-bottom: 5px;
            font-family: var(--mono);
            font-size: 11.5px;
            gap: 8px;
        }
        .key-val { color: var(--text-0); }

        /* ===== 页面 3: 路由端点 (Endpoints) ===== */
        /* page-endpoints managed by .page.active */
        .endpoint-workspace {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            overflow: hidden;
        }
        .view-tabs {
            display: inline-flex;
            background: var(--surface-muted);
            padding: 3px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            gap: 3px;
            margin-bottom: 10px;
            flex-shrink: 0;
        }
        .view-tabs button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 30px;
            padding: 0 14px;
            font-size: 12px;
            font-weight: 500;
            border: none;
            background: transparent;
            color: var(--text-2);
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all .16s ease;
        }
        .view-tabs button svg { width: 13px; height: 13px; }
        .view-tabs button:hover { color: var(--text-0); }
        .view-tabs button.active {
            background: var(--bg-1);
            color: var(--primary);
            font-weight: 600;
            box-shadow: var(--shadow-sm);
        }
        html[data-theme="dark"] .view-tabs button.active {
            background: var(--primary-50);
            color: var(--primary-text);
        }

        .ep-view-card {
            flex: 1;
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .data-toolbar {
            display: flex;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            gap: 14px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .filter-control {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .filter-control label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-2);
            white-space: nowrap;
        }
        .filter-control select {
            height: 30px;
            min-width: 130px;
            background: var(--surface-control);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-0);
            font-size: 12px;
            padding: 0 8px;
            font-family: var(--mono);
        }
        .data-toolbar-summary {
            margin-left: auto;
            font-family: var(--mono);
            font-size: 11px;
            color: var(--text-2);
        }

        .endpoint-table {
            width: 100%;
            flex: 1;
            height: 100%;
            min-height: 0;
            overflow-y: auto;
            overflow-x: auto;
        }
        .endpoint-data-table, .pool-data-table, .pricing-data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .endpoint-data-table th, .pool-data-table th, .pricing-data-table th {
            position: sticky;
            top: 0;
            background: var(--surface-muted);
            padding: 9px 14px;
            text-align: left;
            font-size: 11px;
            color: var(--text-2);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            z-index: 2;
        }
        .endpoint-data-table td, .pool-data-table td, .pricing-data-table td {
            padding: 9px 14px;
            border-bottom: 1px solid var(--border-light);
            color: var(--text-1);
        }
        .endpoint-data-table tr:hover td, .pool-data-table tr:hover td, .pricing-data-table tr:hover td {
            background: var(--surface-hover);
        }
        .endpoint-toggle {
            display: inline-grid;
            place-items: center;
            width: 22px;
            height: 22px;
            border: 1px solid var(--border);
            background: var(--surface-control);
            border-radius: 4px;
            color: var(--text-2);
            cursor: pointer;
            transition: all .16s ease;
        }
        .endpoint-toggle:hover { color: var(--primary); border-color: var(--primary); }
        .endpoint-toggle svg { width: 13px; height: 13px; }
        .endpoint-url-cell {
            font-family: var(--mono);
            font-size: 12px;
            max-width: 420px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .health-inline {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 120px;
        }
        .table-subtext { font-size: 10.5px; color: var(--text-2); margin-top: 1px; }

        /* ===== 页面 4: Token 与成本 (Token & Spend) ===== */
        /* page-token managed by .page.active */
        .token-workspace {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            overflow-y: auto; /* 数据较多时支持内部微滚动 */
            padding-right: 4px;
        }
        .token-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .token-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .token-controls select {
            height: 30px;
            background: var(--surface-control);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-0);
            font-size: 11.5px;
            padding: 0 8px;
            font-family: var(--mono);
        }
        .btn-group {
            display: inline-flex;
            background: var(--surface-muted);
            padding: 2px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            gap: 2px;
            flex-shrink: 0;
        }
        .btn-group button {
            height: 24px;
            padding: 0 10px;
            font-size: 11px;
            font-weight: 500;
            border: none;
            background: transparent;
            color: var(--text-2);
            border-radius: 4px;
            cursor: pointer;
            transition: all .16s ease;
            white-space: nowrap !important;
            line-height: 24px;
            flex-shrink: 0;
        }
        .btn-group button.active {
            background: var(--bg-1);
            color: var(--primary);
            font-weight: 600;
            box-shadow: var(--shadow-sm);
        }
        html[data-theme="dark"] .btn-group button.active {
            background: var(--primary-50);
            color: var(--primary-text);
        }

        .token-overview {
            width: 100%;
            margin-bottom: 12px;
            flex-shrink: 0;
        }
        #token-summary-cards,
        .token-summary-cards {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(120px, 1fr)) !important;
            gap: 12px !important;
            width: 100% !important;
        }
        .usage-metric {
            padding: 12px 14px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            display: flex;
            flex-direction: column;
            gap: 3px;
            transition: background .16s ease;
        }
        .usage-metric:hover { background: var(--surface-muted); }
        .usage-metric span { font-size: 11px; color: var(--text-2); font-weight: 500; }
        .usage-metric strong { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--text-0); }
        .usage-metric small { font-size: 10.5px; color: var(--text-2); }
        .usage-metric.cost strong { color: var(--primary-text); }

        .token-analysis-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 14px;
            width: 100%;
            flex-shrink: 0;
        }
        .token-trend-panel { grid-column: 1 / -1; }
        .analysis-chart { width: 100%; height: 230px; padding: 10px 14px; background: var(--surface); }

        .cost-breakdown-panel {
            width: 100%;
            margin-top: 4px;
            margin-bottom: 14px;
        }

        /* ===== 页面 5: 网关配置 (Config Workspace) ===== */
        /* page-config managed by .page.active */
        .config-workspace {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            min-height: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            overflow: hidden;
        }
        .config-editor-panel {
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--surface-control);
            box-shadow: var(--shadow-sm);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            width: 100%;
            flex: 1;
            height: 100%;
            min-height: 0;
        }
        .config-editor-bar {
            padding: 8px 16px;
            border-bottom: 1px solid var(--border);
            background: var(--surface-muted);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: var(--mono);
            font-size: 11.5px;
            flex-shrink: 0;
        }
        .config-file-name { font-weight: 600; color: var(--text-0); }
        #config-status { font-size: 11px; color: var(--text-2); }

        .CodeMirror {
            flex: 1;
            height: 100% !important;
            font-family: var(--mono) !important;
            font-size: 13px !important;
            background: transparent !important;
            color: var(--text-0) !important;
            line-height: 1.6;
        }
        .CodeMirror-gutters { background: var(--surface-muted) !important; border-right: 1px solid var(--border) !important; }
        .CodeMirror-linenumber { color: var(--text-2) !important; padding: 0 8px !important; }
        .CodeMirror-cursor { border-left: 2px solid var(--primary) !important; }
        .CodeMirror-selected { background: var(--primary-light) !important; }

        /* ===== 徽章系统 (Badges & Pills) ===== */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            font-family: var(--mono);
            line-height: 1.3;
        }
        .badge-green, .badge-teal, .badge-success {
            background: var(--success-light);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .badge-blue, .badge-info {
            background: var(--info-light);
            color: var(--info);
            border: 1px solid rgba(2, 132, 199, 0.35);
        }
        .badge-yellow, .badge-warning {
            background: var(--warning-light);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .badge-red, .badge-danger {
            background: var(--danger-light);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .badge-gray {
            background: var(--surface-soft);
            color: var(--text-2);
            border: 1px solid var(--border);
        }

        /* ===== 按钮系统 (Buttons) ===== */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 32px;
            padding: 0 13px;
            font-size: 12.5px;
            font-weight: 500;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all .16s ease;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text-0);
            white-space: nowrap;
        }
        .btn svg { width: 14px; height: 14px; }
        .btn:hover { background: var(--surface-hover); border-color: var(--border-hover); }
        .btn-primary {
            background: var(--primary);
            border-color: var(--primary);
            color: #ffffff !important;
            font-weight: 600;
            box-shadow: 0 2px 8px var(--primary-shadow);
        }
        .btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
        .btn-outline { background: transparent; border-color: var(--border); color: var(--text-1); }
        .btn-outline:hover { background: var(--surface-hover); border-color: var(--border-hover); color: var(--text-0); }
        .btn-danger {
            background: var(--danger-light);
            border-color: rgba(239, 68, 68, 0.35);
            color: var(--danger) !important;
        }
        .btn-danger:hover { background: var(--danger); color: #ffffff !important; }
        .btn-ghost { background: transparent; border-color: transparent; color: var(--text-1); }
        .btn-ghost:hover { background: var(--surface-hover); color: var(--text-0); }
        .btn-sm { height: 28px; padding: 0 10px; font-size: 11.5px; }
        .btn-xs { height: 24px; padding: 0 8px; font-size: 11px; }

        /* ===== 通用表单控件 ===== */
        .form-control,
        input[type="text"],
        input[type="password"],
        input[type="number"],
        input[type="search"],
        select,
        textarea {
            width: 100%;
            height: 34px;
            background: var(--surface-control);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-0);
            padding: 0 10px;
            font-size: 12.5px;
            font-family: var(--mono);
            transition: border-color .16s ease, box-shadow .16s ease;
        }
        input::placeholder, textarea::placeholder { color: var(--text-2); opacity: 0.8; }
        .form-control:focus, input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px var(--primary-light);
        }
        .progress-bar { height: 6px; background: var(--surface-soft); border-radius: 999px; overflow: hidden; width: 100%; }
        .progress-bar .fill { height: 100%; border-radius: 999px; transition: width .3s ease; }

        /* 模态框 (Modal) */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10, 15, 25, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal {
            background: var(--bg-1);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            width: 100%;
            max-width: 520px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .modal-header {
            padding: 14px 18px;
            border-bottom: 1px solid var(--border-light);
            background: var(--surface-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .modal-header h2 { font-size: 15px; font-weight: 700; color: var(--text-0); }
        .modal-body { padding: 18px; overflow-y: auto; background: var(--bg-1); max-height: calc(85vh - 120px); }
        .modal-body p { color: var(--text-1); font-size: 13px; margin-bottom: 14px; }
        .modal-footer {
            padding: 12px 18px;
            border-top: 1px solid var(--border-light);
            background: var(--surface-muted);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        /* 消息提示 (Toast) */
        .toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; }
        .toast {
            padding: 10px 16px;
            border-radius: var(--radius-sm);
            background: var(--bg-1);
            border: 1px solid var(--border);
            color: var(--text-0);
            box-shadow: var(--shadow-lg);
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: slideIn .2s ease;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .empty-state {
            padding: 30px 20px;
            text-align: center;
            color: var(--text-2);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .empty-state svg { width: 30px; height: 30px; color: var(--text-2); opacity: 0.6; }

        /* 隐藏废弃抽屉与多余控件 */
        .sidebar, .sidebar-backdrop, .mobile-nav-toggle { display: none !important; }

        
        /* ============================================================
           全视口严格自适应弹性骨架 (Strict Viewport-Fit Engine)
           彻底保证卡片底边与视口下边缘留有安全呼吸区，禁止任何纵向溢出截断
           ============================================================ */

        /* 1. 路由端点页 (Endpoints) 链条 */
        #page-endpoints.active {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        #endpoint-workspace {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        #endpoint-runtime-view:not([hidden]),
        #endpoint-pool-view:not([hidden]) {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        #endpoint-runtime-view[hidden],
        #endpoint-pool-view[hidden] {
            display: none !important;
        }
        #endpoint-runtime-view .workspace-panel,
        #endpoint-pool-view .workspace-panel {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
        }
        .endpoint-table,
        #endpoint-list,
        .pool-table-wrap,
        #endpoint-pool-list {
            flex: 1 1 0% !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: auto;
            padding-bottom: 10px;
        }

        /* 2. 模型矩阵页 (Models) 链条 */
        #page-models.active {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        #model-workspace {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        .model-master-detail {
            display: grid;
            grid-template-columns: 310px minmax(0, 1fr);
            gap: 14px;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        .model-list-panel {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden;
        }
        .model-list-scroll {
            flex: 1 1 0% !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow-y: auto !important;
        }
        .model-detail-panel {
            flex: 1 1 0% !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow-y: auto !important;
        }

        /* 3. 网关配置页 (Config) 链条 */
        #page-config.active {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        #config-workspace {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        .config-editor-panel {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden;
        }

        /* 4. Token 统计与用量分析 (Token & Spend) 链条 */
        #page-token.active {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        #token-workspace {
            display: flex !important;
            flex-direction: column;
            flex: 1 1 0%;
            height: 100%;
            min-height: 0;
            overflow-y: auto !important;
            overflow-x: hidden;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding-right: 2px;
        }

/* ============================================================
           多端自适应响应式体系 (Responsive Breakpoints)
           覆盖：宽屏/普通显示器/笔记本/平板/手机
           ============================================================ */

        /* 1. 超宽显示器与 4K 巨屏 (> 1680px / > 2560px) 流式弹性放宽版心，杜绝孤岛效应 */
        @media (min-width: 1681px) {
            .masthead-inner, .main-body {
                max-width: min(2400px, 94vw);
                padding-left: 36px;
                padding-right: 36px;
            }
        }
        @media (min-width: 2560px) {
            .masthead-inner, .main-body {
                max-width: min(3200px, 95vw);
                padding-left: 48px;
                padding-right: 48px;
            }
        }

        /* 针对巨幕高度 (4K / 2K 垂直高度充裕) 比例优化，杜绝巨幅死白空洞 */
        @media (min-height: 1100px) {
            .chart-surface, .chart-wide {
                min-height: 240px;
                max-height: 420px;
            }
            .ops-lower-grid {
                max-height: 400px;
            }
            .request-stream {
                max-height: 900px;
            }
        }

        /* 2. 普通桌面与小屏台式机 (1200px - 1440px) */
        @media (max-width: 1440px) {
            .masthead-inner, .main-body {
                padding-left: 24px;
                padding-right: 24px;
            }
            .ops-metrics { grid-template-columns: repeat(4, 1fr); }
            .token-summary-cards { grid-template-columns: repeat(3, 1fr) !important; }
            .ops-layout { grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); }
        }

        /* 3. 笔记本电脑与中等屏幕 (992px - 1200px) */
        @media (max-width: 1200px) {
            .masthead-inner, .main-body {
                padding-left: 20px;
                padding-right: 20px;
            }
            .ops-layout { grid-template-columns: 1fr; }
            .ops-primary { height: auto; }
            .chart-surface, .chart-wide { height: 200px; }
            .model-master-detail { grid-template-columns: 260px minmax(0, 1fr); }
        }

        /* 4. 平板电脑与横屏移动端 (768px - 992px) */
        @media (max-width: 992px) {
            html, body {
                height: auto;
                max-height: none;
                overflow-y: auto; /* 平板端允许自然纵向滑动 */
            }
            .main {
                height: auto;
                max-height: none;
                overflow: visible;
            }
            .main-body {
                height: auto;
                max-height: none;
                overflow: visible;
                padding: 12px 16px 30px;
            }
            .page.active {
                height: auto;
                max-height: none;
                overflow: visible;
            }
            .model-master-detail {
                grid-template-columns: 1fr;
                height: auto;
            }
            .model-list-panel {
                max-height: 280px;
            }
            .model-detail-panel {
                max-height: none;
                height: auto;
            }
            .token-summary-cards { grid-template-columns: repeat(2, 1fr) !important; }
            .token-analysis-grid { grid-template-columns: 1fr; }
            .endpoint-table { max-height: 480px; }
            .config-editor-panel { height: 480px; }
        }

        /* 5. 手机端 (< 768px) */
        @media (max-width: 768px) {
            .masthead-inner {
                padding: 0 12px;
                gap: 8px;
            }
            .brand-title { display: none; }
            .brand-tag { display: none; }
            .nav-tabs {
                padding: 2px;
                gap: 2px;
            }
            .tab-btn {
                padding: 5px 8px;
                font-size: 11.5px;
                gap: 4px;
            }
            .tab-btn span { display: none; } /* 手机仅显示图标，省出空间 */
            .readout-pill { display: none; }
            .main-body {
                padding: 10px 12px 30px;
            }
            .ops-metrics { grid-template-columns: repeat(2, 1fr); }
            .ops-lower-grid { grid-template-columns: 1fr; }
            .token-summary-cards { grid-template-columns: 1fr !important; }
            .data-toolbar { padding: 8px 10px; gap: 8px; }
            .filter-control select { min-width: 100px; }
            .btn { height: 28px; padding: 0 10px; font-size: 11.5px; }
        }
    `;
    return new Response(css, {
        headers: { "Content-Type": "text/css; charset=utf-8" },
    });
}
