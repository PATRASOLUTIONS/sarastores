const { chromium } = require('C:\\Users\\nabap\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core');
const fs = require('fs');
const path = require('path');
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#f0f2f5;color:#1a1a2e;font-size:7px;line-height:1.4}
.cover{width:100%;min-height:100vh;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;page-break-after:always}
.cover h1{font-size:42px;font-weight:800;letter-spacing:2px;margin-bottom:8px}
.cover h2{font-size:20px;font-weight:400;opacity:.7;margin-bottom:30px}
.cover .logo-text{font-size:60px;font-weight:900;background:linear-gradient(135deg,#e94560,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
.cover .subtitle{font-size:14px;opacity:.6;margin-top:20px}
.cover .meta{margin-top:40px;font-size:10px;opacity:.5}
.page{width:100%;min-height:100vh;background:white;padding:20px;page-break-after:always;position:relative}
.page-header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;border-radius:6px;margin-bottom:16px}
.page-header .icon{font-size:22px}
.page-header h2{font-size:16px;font-weight:700}
.page-header .role{font-size:9px;opacity:.7;margin-left:auto;padding:3px 10px;border:1px solid rgba(255,255,255,.3);border-radius:12px}
.section{margin-bottom:14px}
.section-title{font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;border-bottom:2px solid #e94560;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.grid{display:grid;gap:10px}
.grid-2{grid-template-columns:1fr 1fr}
.grid-3{grid-template-columns:1fr 1fr 1fr}
.grid-4{grid-template-columns:1fr 1fr 1fr 1fr}
.grid-5{grid-template-columns:1fr 1fr 1fr 1fr 1fr}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px}
.card-dark{background:#1a1a2e;color:white;border-color:#334155}
.card-accent{background:#fef2f2;border-color:#e94560;border-left:3px solid #e94560}
.card-green{background:#f0fdf4;border-color:#22c55e;border-left:3px solid #22c55e}
.card-blue{background:#eff6ff;border-color:#3b82f6;border-left:3px solid #3b82f6}
.card-yellow{background:#fffbeb;border-color:#f59e0b;border-left:3px solid #f59e0b}
.card-purple{background:#faf5ff;border-color:#a855f7;border-left:3px solid #a855f7}
.card h4{font-size:9px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
.card-dark h4{color:white}
.card p{font-size:7px;color:#64748b;line-height:1.5}
.card-dark p{color:#94a3b8}
.badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:6px;font-weight:600}
.badge-red{background:#fef2f2;color:#e94560}
.badge-green{background:#f0fdf4;color:#22c55e}
.badge-blue{background:#eff6ff;color:#3b82f6}
.badge-yellow{background:#fffbeb;color:#f59e0b}
.badge-purple{background:#faf5ff;color:#a855f7}
.badge-gray{background:#f1f5f9;color:#64748b}
.btn{display:inline-block;padding:4px 12px;border-radius:4px;font-size:7px;font-weight:600;border:none;cursor:pointer}
.btn-primary{background:#e94560;color:white}
.btn-secondary{background:#1a1a2e;color:white}
.btn-success{background:#22c55e;color:white}
.btn-outline{background:transparent;border:1px solid #e2e8f0;color:#64748b}
.btn-sm{padding:2px 8px;font-size:6px}
.btn-danger{background:#ef4444;color:white}
.btn-warning{background:#f59e0b;color:white}
.sidebar{background:#1a1a2e;color:white;padding:10px;border-radius:6px;min-height:400px}
.sidebar-item{padding:5px 8px;border-radius:4px;font-size:7px;color:#94a3b8;cursor:pointer;margin-bottom:2px;display:flex;align-items:center;gap:6px}
.sidebar-item.active{background:#e94560;color:white}
.sidebar-item:hover{background:rgba(255,255,255,.1)}
.sidebar-section{font-size:6px;text-transform:uppercase;letter-spacing:1px;color:#475569;padding:8px 8px 4px;font-weight:600}
.table{width:100%;border-collapse:collapse;font-size:7px}
.table th{background:#f1f5f9;padding:6px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;font-size:6px;text-transform:uppercase;letter-spacing:.5px}
.table td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
.table tr:hover{background:#f8fafc}
.table .status{display:inline-block;padding:1px 6px;border-radius:8px;font-size:6px;font-weight:600}
.status-active{background:#dcfce7;color:#16a34a}
.status-pending{background:#fef3c7;color:#d97706}
.status-cancelled{background:#fee2e2;color:#dc2626}
.status-processing{background:#dbeafe;color:#2563eb}
.status-delivered{background:#dcfce7;color:#16a34a}
.status-shipped{background:#e0e7ff;color:#4f46e5}
.status-refunded{background:#fef3c7;color:#d97706}
.status-low{background:#fee2e2;color:#dc2626}
.status-medium{background:#fef3c7;color:#d97706}
.status-high{background:#dcfce7;color:#16a34a}
.status-draft{background:#f1f5f9;color:#64748b}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.kpi{background:white;border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}
.kpi .value{font-size:18px;font-weight:800;color:#1a1a2e}
.kpi .label{font-size:6px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.kpi.accent .value{color:#e94560}
.kpi.green .value{color:#22c55e}
.kpi.blue .value{color:#3b82f6}
.kpi.yellow .value{color:#f59e0b}
.topbar{background:white;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;display:flex;align-items:center;gap:10px;margin-bottom:12px}
.topbar .logo{font-size:12px;font-weight:800;color:#e94560}
.topbar .search{flex:1;background:#f1f5f9;border-radius:4px;padding:4px 10px;font-size:7px;color:#64748b}
.topbar .nav-item{font-size:7px;color:#475569;cursor:pointer;padding:4px 8px;border-radius:4px}
.topbar .nav-item:hover{background:#f1f5f9}
.topbar .icons{display:flex;gap:8px;font-size:10px}
.product-card{background:white;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
.product-card .img{height:80px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:24px;color:#cbd5e1}
.product-card .info{padding:8px}
.product-card .name{font-size:8px;font-weight:600;color:#1a1a2e;margin-bottom:2px}
.product-card .price{font-size:10px;font-weight:700;color:#e94560}
.product-card .old-price{font-size:7px;color:#94a3b8;text-decoration:line-through;margin-left:4px}
.product-card .rating{font-size:6px;color:#f59e0b;margin-top:2px}
.btn-add{display:block;width:100%;padding:4px;background:#e94560;color:white;text-align:center;border-radius:4px;font-size:7px;font-weight:600;margin-top:6px}
.filter-bar{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.filter{padding:3px 10px;border:1px solid #e2e8f0;border-radius:12px;font-size:6px;color:#64748b;background:white}
.filter.active{background:#e94560;color:white;border-color:#e94560}
.breadcrumb{font-size:6px;color:#94a3b8;margin-bottom:8px}
.breadcrumb span{color:#e94560}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:7px;font-weight:600;color:#475569;margin-bottom:3px}
.form-input{width:100%;padding:5px 8px;border:1px solid #e2e8f0;border-radius:4px;font-size:7px}
.form-input:focus{outline:none;border-color:#e94560}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.alert{padding:6px 10px;border-radius:4px;font-size:7px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.alert-info{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe}
.alert-success{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
.alert-warning{background:#fffbeb;color:#d97706;border:1px solid #fde68a}
.alert-danger{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.modal-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
.modal{background:white;border-radius:8px;padding:16px;width:80%;max-width:400px}
.modal h3{font-size:11px;font-weight:700;margin-bottom:8px}
.tabs{display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:10px}
.tab{padding:6px 14px;font-size:7px;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab.active{color:#e94560;border-bottom-color:#e94560;font-weight:600}
.toolbar{display:flex;gap:6px;margin-bottom:10px;align-items:center}
.toolbar .title{font-size:11px;font-weight:700}
.progress-bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:4px}
.progress-bar .fill{height:100%;border-radius:3px;transition:width .3s}
.progress-bar .fill-red{background:#e94560}
.progress-bar .fill-green{background:#22c55e}
.progress-bar .fill-blue{background:#3b82f6}
.progress-bar .fill-yellow{background:#f59e0b}
.avatar{width:24px;height:24px;border-radius:50%;background:#e94560;color:white;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700}
.avatar-sm{width:18px;height:18px;font-size:6px}
.avatar-lg{width:36px;height:36px;font-size:14px}
.stat-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:7px}
.stat-row .label{color:#64748b}
.stat-row .value{font-weight:600;color:#1a1a2e}
.timeline{position:relative;padding-left:16px}
.timeline::before{content:'';position:absolute;left:6px;top:0;bottom:0;width:2px;background:#e2e8f0}
.timeline-item{position:relative;margin-bottom:8px;padding-left:10px}
.timeline-item::before{content:'';position:absolute;left:-13px;top:3px;width:8px;height:8px;border-radius:50%;background:#e94560;border:2px solid white}
.timeline-item .time{font-size:6px;color:#94a3b8}
.timeline-item .event{font-size:7px;color:#1a1a2e}
.mini-chart{display:flex;align-items:flex-end;gap:2px;height:30px}
.mini-chart .bar{flex:1;background:#e94560;border-radius:2px 2px 0 0}
.toggle{width:28px;height:14px;background:#e2e8f0;border-radius:7px;position:relative;display:inline-block}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:10px;height:10px;background:white;border-radius:50%;transition:.2s}
.toggle.on{background:#22c55e}
.toggle.on::after{left:16px}
.code-block{background:#1e293b;color:#e2e8f0;padding:6px;border-radius:4px;font-size:6px;font-family:monospace;line-height:1.6;margin:4px 0}
.code-response{background:#1e293b;color:#22c55e;padding:6px;border-radius:4px;font-size:6px;font-family:monospace;margin:4px 0}
.sale-banner{height:20px;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700;letter-spacing:1px}
.page-number{position:absolute;bottom:10px;right:16px;font-size:6px;color:#94a3b8}
.footer-bar{background:#1a1a2e;color:#94a3b8;padding:12px 16px;border-radius:6px;margin-top:12px;font-size:6px;display:flex;justify-content:space-between}
.toast{position:fixed;top:20px;right:20px;padding:8px 14px;border-radius:6px;font-size:7px;font-weight:600;color:white;z-index:100}
.toast-success{background:#22c55e}
.toast-error{background:#ef4444}
.toast-info{background:#3b82f6}
.steps{display:flex;gap:0;margin-bottom:12px}
.step{flex:1;text-align:center;position:relative}
.step::after{content:'';position:absolute;top:10px;left:50%;width:100%;height:2px;background:#e2e8f0;z-index:0}
.step:last-child::after{display:none}
.step .circle{width:20px;height:20px;border-radius:50%;background:#e2e8f0;color:#94a3b8;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;position:relative;z-index:1}
.step.active .circle{background:#e94560;color:white}
.step.done .circle{background:#22c55e;color:white}
.step .step-label{font-size:6px;color:#64748b;margin-top:4px}
.step.active .step-label{color:#e94560;font-weight:600}
.accordion{border:1px solid #e2e8f0;border-radius:4px;margin-bottom:4px}
.accordion-header{padding:6px 10px;background:#f8fafc;font-size:7px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between}
.accordion-body{padding:6px 10px;font-size:7px;color:#64748b}
.chart-placeholder{background:#f8fafc;border:1px dashed #e2e8f0;border-radius:6px;padding:16px;text-align:center;color:#94a3b8;font-size:7px}
.donut{width:50px;height:50px;border-radius:50%;background:conic-gradient(#e94560 0% 35%,#3b82f6 35% 55%,#22c55e 55% 75%,#f59e0b 75% 100%);position:relative}
.donut::after{content:'';position:absolute;top:12px;left:12px;width:26px;height:26px;background:white;border-radius:50%}
.list-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:7px}
.list-item .icon{font-size:12px}
.list-item .text{flex:1}
.list-item .action{color:#e94560;font-weight:600;font-size:6px}
.empty-state{text-align:center;padding:30px;color:#94a3b8}
.empty-state .icon{font-size:30px;margin-bottom:8px}
.empty-state p{font-size:8px}
.wire-label{position:absolute;top:4px;right:4px;background:#e94560;color:white;padding:1px 5px;border-radius:3px;font-size:5px;font-weight:600}
.two-col{display:grid;grid-template-columns:200px 1fr;gap:12px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.flex{display:flex}
.flex-between{display:flex;justify-content:space-between;align-items:center}
.flex-center{display:flex;align-items:center;justify-content:center}
.gap-4{gap:4px}
.gap-8{gap:8px}
.gap-12{gap:12px}
.mt-4{margin-top:4px}
.mt-8{margin-top:8px}
.mt-12{margin-top:12px}
.mb-4{margin-bottom:4px}
.mb-8{margin-bottom:8px}
.mb-12{margin-bottom:12px}
.p-8{padding:8px}
.p-12{padding:12px}
.text-center{text-align:center}
.text-right{text-align:right}
.text-sm{font-size:6px}
.text-xs{font-size:5px}
.text-lg{font-size:10px}
.text-bold{font-weight:700}
.text-muted{color:#94a3b8}
.text-red{color:#e94560}
.text-green{color:#22c55e}
.text-blue{color:#3b82f6}
.text-yellow{color:#f59e0b}
.w-full{width:100%}
.border{border:1px solid #e2e8f0}
.rounded{border-radius:6px}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.1)}
`;
