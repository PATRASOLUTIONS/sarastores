const { chromium } = require('C:\\Users\\nabap\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core');
const fs = require('fs');
const path = require('path');
let pageNum = 0;
const pages = [];
function W() {}
W.page = (title, icon, role, ...content) => { pageNum++; return `<div class="page"><div class="page-header"><span class="icon">${icon}</span><h2>${title}</h2>${role?`<span class="role">${role}</span>`:''}</div>${content.join('')}<div class="pn">${pageNum}</div></div>`; };
W.cover = (t, s, m) => `<div class="cover"><div class="logo-text">SARA ELECTRONICS</div><h1>${t}</h1><h2>${s}</h2><div class="meta">${m}</div></div>`;
W.sec = (t, ...c) => `<div class="section"><div class="sec-title">${t}</div>${c.join('')}</div>`;
W.grid = (cls, ...items) => `<div class="grid ${cls}">${items.join('')}</div>`;
W.card = (t, d, c='') => `<div class="card ${c}"><h4>${t}</h4><p>${d}</p></div>`;
W.ci = (i, t, d, c='') => `<div class="card ${c}"><div style="font-size:14px;margin-bottom:4px">${i}</div><h4>${t}</h4><p>${d}</p></div>`;
W.badge = (t, c='bg-gray-100 text-gray-600') => `<span class="badge ${c}">${t}</span>`;
W.btn = (t, c='btn-primary', s='') => `<span class="btn ${c} ${s}">${t}</span>`;
W.kpi = (v, l, c='') => `<div class="kpi ${c}"><div class="val">${v}</div><div class="lbl">${l}</div></div>`;
W.kpiG = (...i) => `<div class="kpi-grid">${i.join('')}</div>`;
W.tbl = (h, r) => `<table class="tbl"><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
W.sb = (items, a=0) => `<div class="sidebar">${items.map((it,i)=>{if(it.s)return`<div class="sb-sec">${it.s}</div>`;return`<div class="sb-item ${i===a?'active':''}">${it.i||''} ${it.l}</div>`;}).join('')}</div>`;
W.topbar = (logo, nav, right) => `<div class="topbar"><span class="logo">${logo}</span><span class="search">Search products, brands and more...</span>${(nav||[]).map(n=>`<span class="nav-item">${n}</span>`).join('')}<div class="icons">${(right||[]).join('')}</div></div>`;
W.prod = (n, p, op, r, img='📦') => `<div class="prod-card"><div class="img">${img}</div><div class="info"><div class="name">${n}</div><div><span class="price">${p}</span>${op?`<span class="old-price">${op}</span>`:''}</div><div class="rating">${'★'.repeat(Math.floor(r||4))}${'☆'.repeat(5-Math.floor(r||4))} <span style="color:#94a3b8">(${r||4.0})</span></div><div class="btn-add">Add to Cart</div></div></div>`;
W.alert = (t, c='info') => `<div class="alert alert-${c}">${t}</div>`;
W.fg = (l, tp='text', ph='') => `<div class="fg"><label>${l}</label><input class="fi" type="${tp}" placeholder="${ph||l}"></div>`;
W.fr = (...f) => `<div class="fr">${f.join('')}</div>`;
W.tabs = (items, a=0) => `<div class="tabs">${items.map((t,i)=>`<span class="tab ${i===a?'active':''}">${t}</span>`).join('')}</div>`;
W.toolbar = (t, ...b) => `<div class="toolbar"><span class="tb-title">${t}</span><div style="margin-left:auto;display:flex;gap:4px">${b.join('')}</div></div>`;
W.steps = (items, a=0) => `<div class="steps">${items.map((s,i)=>`<div class="step ${i<a?'done':''} ${i===a?'active':''}"><span class="circle">${i<a?'✓':i+1}</span><div class="sl">${s}</div></div>`).join('')}</div>`;
W.progress = (p, c='fill-blue') => `<div class="pbar"><div class="fill ${c}" style="width:${p}%"></div></div>`;
W.twoCol = (l, r) => `<div class="two-col"><div>${l}</div><div>${r}</div></div>`;
W.threeCol = (...c) => `<div class="three-col">${c.join('')}</div>`;
W.breadcrumb = (...items) => `<div class="breadcrumb">${items.map((b,i)=>i<items.length-1?`${b} › `:`<span>${b}</span>`).join('')}</div>`;
W.miniChart = (...h) => `<div class="mini-chart">${h.map(x=>`<div class="bar" style="height:${x}px"></div>`).join('')}</div>`;
W.code = (t) => `<div class="code-block">${t}</div>`;
W.codeR = (t) => `<div class="code-resp">${t}</div>`;
W.donut = () => `<div class="donut"></div>`;
W.accordion = (t, c) => `<div class="accordion"><div class="acc-header"><span>${t}</span><span>▼</span></div><div class="acc-body">${c}</div></div>`;
W.timeline = (...items) => `<div class="timeline">${items.map(i=>`<div class="tl-item"><div class="tl-time">${i.time}</div><div class="tl-event">${i.event}</div></div>`).join('')}</div>`;
W.statRow = (l, v) => `<div class="stat-row"><span class="label">${l}</span><span class="value">${v}</span></div>`;
W.avatar = (ini, c='') => `<div class="avatar ${c}">${ini}</div>`;
W.toggle = (on=false) => `<div class="toggle ${on?'on':''}"></div>`;
W.flex = (cls, ...items) => `<div style="display:flex" class="${cls}">${items.join('')}</div>`;
W.filterBar = (...f) => `<div class="filter-bar">${f.map((x,i)=>`<span class="filter ${i===0?'active':''}">${x}</span>`).join('')}</div>`;
W.footer = () => `<div class="footer-bar"><span>Sara Electronics © 2026</span><span>Confidential — Internal Use Only</span><span>Wireframe Document v4.0</span></div>`;

const CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;background:#FAFBFC;color:#0F172A;font-size:7px;line-height:1.4}
.cover{width:100%;min-height:100vh;background:linear-gradient(135deg,#0F172A 0%,#1e3a5f 50%,#2A7FFF 100%);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;page-break-after:always}
.cover h1{font-size:42px;font-weight:800;letter-spacing:2px;margin-bottom:8px;font-family:Poppins,sans-serif}
.cover h2{font-size:20px;font-weight:400;opacity:.7;margin-bottom:30px}
.cover .logo-text{font-size:56px;font-weight:900;background:linear-gradient(135deg,#2A7FFF,#FF6B35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;font-family:Poppins,sans-serif}
.cover .subtitle{font-size:14px;opacity:.6;margin-top:20px}
.cover .meta{margin-top:40px;font-size:10px;opacity:.5}
.page{width:100%;min-height:100vh;background:white;padding:20px;page-break-after:always;position:relative}
.page-header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:linear-gradient(135deg,#0F172A,#1e3a5f);color:white;border-radius:12px;margin-bottom:16px}
.page-header .icon{font-size:22px}
.page-header h2{font-size:16px;font-weight:700;font-family:Poppins,sans-serif}
.page-header .role{font-size:9px;opacity:.7;margin-left:auto;padding:3px 10px;border:1px solid rgba(255,255,255,.3);border-radius:12px}
.section{margin-bottom:14px}
.sec-title{font-size:10px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;border-bottom:2px solid #2A7FFF;margin-bottom:8px;display:flex;align-items:center;gap:6px;font-family:Poppins,sans-serif}
.grid{display:grid;gap:10px}
.grid-2{grid-template-columns:1fr 1fr}
.grid-3{grid-template-columns:1fr 1fr 1fr}
.grid-4{grid-template-columns:1fr 1fr 1fr 1fr}
.grid-5{grid-template-columns:1fr 1fr 1fr 1fr 1fr}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px}
.card h4{font-size:9px;font-weight:700;color:#0F172A;margin-bottom:4px}
.card p{font-size:7px;color:#475569;line-height:1.5}
.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:6px;font-weight:600}
.badge-blue{background:#DBEAFE;color:#2563EB}
.badge-green{background:#D1FAE5;color:#059669}
.badge-orange{background:#FFF7ED;color:#EA580C}
.badge-red{background:#FEE2E2;color:#DC2626}
.badge-purple{background:#F3E8FF;color:#9333EA}
.badge-gray{background:#F1F5F9;color:#64748B}
.btn{display:inline-block;padding:5px 14px;border-radius:8px;font-size:7px;font-weight:600;border:none;cursor:pointer}
.btn-primary{background:#2A7FFF;color:white}
.btn-accent{background:#FF6B35;color:white}
.btn-success{background:#059669;color:white}
.btn-outline{background:transparent;border:1px solid #E2E8F0;color:#475569}
.btn-sm{padding:3px 10px;font-size:6px}
.btn-danger{background:#DC2626;color:white}
.sidebar{background:#1F2937;color:white;padding:10px;border-radius:8px;min-height:400px}
.sb-item{padding:6px 10px;border-radius:8px;font-size:7px;color:#9CA3AF;cursor:pointer;margin-bottom:2px;display:flex;align-items:center;gap:8px}
.sb-item.active{background:#7F1D1D;color:white}
.sb-item:hover{background:rgba(255,255,255,.1)}
.sb-sec{font-size:6px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:10px 10px 4px;font-weight:600}
.tbl{width:100%;border-collapse:collapse;font-size:7px}
.tbl th{background:#F8FAFC;padding:6px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #E2E8F0;font-size:6px;text-transform:uppercase;letter-spacing:.5px}
.tbl td{padding:6px 8px;border-bottom:1px solid #F1F5F9}
.tbl tr:hover{background:#F8FAFC}
.status{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:6px;font-weight:600}
.status-green{background:#D1FAE5;color:#059669}
.status-yellow{background:#FEF3C7;color:#D97706}
.status-red{background:#FEE2E2;color:#DC2626}
.status-blue{background:#DBEAFE;color:#2563EB}
.status-purple{background:#F3E8FF;color:#9333EA}
.status-gray{background:#F1F5F9;color:#64748B}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.kpi{background:white;border:1px solid #E2E8F0;border-radius:12px;padding:10px;text-align:center}
.kpi .val{font-size:18px;font-weight:800;color:#0F172A;font-family:Poppins,sans-serif}
.kpi .lbl{font-size:6px;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.kpi.k-blue .val{color:#2A7FFF}
.kpi.k-green .val{color:#059669}
.kpi.k-orange .val{color:#FF6B35}
.kpi.k-purple .val{color:#9333EA}
.topbar{background:white;border:1px solid #E2E8F0;border-radius:12px;padding:6px 12px;display:flex;align-items:center;gap:10px;margin-bottom:12px}
.topbar .logo{font-size:12px;font-weight:800;color:#2A7FFF;font-family:Poppins,sans-serif}
.topbar .search{flex:1;background:#F1F5F9;border-radius:8px;padding:5px 12px;font-size:7px;color:#94A3B8}
.topbar .nav-item{font-size:7px;color:#475569;cursor:pointer;padding:4px 8px;border-radius:6px}
.topbar .nav-item:hover{background:#F1F5F9}
.topbar .icons{display:flex;gap:8px;font-size:10px}
.prod-card{background:white;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}
.prod-card .img{height:80px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:24px;color:#CBD5E1}
.prod-card .info{padding:8px}
.prod-card .name{font-size:8px;font-weight:600;color:#0F172A;margin-bottom:2px}
.prod-card .price{font-size:10px;font-weight:700;color:#FF6B35}
.prod-card .old-price{font-size:7px;color:#94A3B8;text-decoration:line-through;margin-left:4px}
.prod-card .rating{font-size:6px;color:#F59E0B;margin-top:2px}
.btn-add{display:block;width:100%;padding:5px;background:#2A7FFF;color:white;text-align:center;border-radius:8px;font-size:7px;font-weight:600;margin-top:6px}
.filter-bar{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.filter{padding:3px 12px;border:1px solid #E2E8F0;border-radius:9999px;font-size:6px;color:#64748B;background:white}
.filter.active{background:#2A7FFF;color:white;border-color:#2A7FFF}
.breadcrumb{font-size:6px;color:#94A3B8;margin-bottom:8px}
.breadcrumb span{color:#2A7FFF}
.fg{margin-bottom:8px}
.fg label{display:block;font-size:7px;font-weight:600;color:#475569;margin-bottom:3px}
.fi{width:100%;padding:6px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:7px}
.fi:focus{outline:none;border-color:#2A7FFF;box-shadow:0 0 0 3px rgba(42,127,255,.1)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.alert{padding:8px 12px;border-radius:8px;font-size:7px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.alert-info{background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE}
.alert-success{background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0}
.alert-warning{background:#FFFBEB;color:#D97706;border:1px solid #FDE68A}
.alert-danger{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA}
.tabs{display:flex;gap:0;border-bottom:2px solid #E2E8F0;margin-bottom:10px}
.tab{padding:6px 14px;font-size:7px;color:#64748B;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}
.tab.active{color:#2A7FFF;border-bottom-color:#2A7FFF;font-weight:600}
.toolbar{display:flex;gap:6px;margin-bottom:10px;align-items:center}
.tb-title{font-size:11px;font-weight:700;font-family:Poppins,sans-serif}
.pbar{height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;margin-top:4px}
.fill{height:100%;border-radius:3px}
.fill-blue{background:#2A7FFF}
.fill-green{background:#059669}
.fill-orange{background:#FF6B35}
.two-col{display:grid;grid-template-columns:200px 1fr;gap:12px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.mini-chart{display:flex;align-items:flex-end;gap:2px;height:30px}
.mini-chart .bar{flex:1;background:#2A7FFF;border-radius:2px 2px 0 0}
.code-block{background:#1E293B;color:#E2E8F0;padding:6px;border-radius:8px;font-size:6px;font-family:monospace;line-height:1.6;margin:4px 0}
.code-resp{background:#1E293B;color:#22C55E;padding:6px;border-radius:8px;font-size:6px;font-family:monospace;margin:4px 0}
.stat-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #F1F5F9;font-size:7px}
.stat-row .label{color:#64748B}
.stat-row .value{font-weight:600;color:#0F172A}
.donut{width:50px;height:50px;border-radius:50%;background:conic-gradient(#2A7FFF 0% 35%,#FF6B35 35% 55%,#059669 55% 75%,#F59E0B 75% 100%);position:relative}
.donut::after{content:'';position:absolute;top:12px;left:12px;width:26px;height:26px;background:white;border-radius:50%}
.accordion{border:1px solid #E2E8F0;border-radius:8px;margin-bottom:4px}
.acc-header{padding:6px 10px;background:#F8FAFC;font-size:7px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;border-radius:8px}
.acc-body{padding:6px 10px;font-size:7px;color:#475569}
.timeline{position:relative;padding-left:16px}
.timeline::before{content:'';position:absolute;left:6px;top:0;bottom:0;width:2px;background:#E2E8F0}
.tl-item{position:relative;margin-bottom:8px;padding-left:10px}
.tl-item::before{content:'';position:absolute;left:-13px;top:3px;width:8px;height:8px;border-radius:50%;background:#2A7FFF;border:2px solid white}
.tl-time{font-size:6px;color:#94A3B8}
.tl-event{font-size:7px;color:#0F172A}
.avatar{width:24px;height:24px;border-radius:50%;background:#7F1D1D;color:white;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700}
.avatar-sm{width:18px;height:18px;font-size:6px}
.avatar-lg{width:36px;height:36px;font-size:14px}
.toggle{width:28px;height:14px;background:#E2E8F0;border-radius:7px;position:relative;display:inline-block}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:10px;height:10px;background:white;border-radius:50%;transition:.2s}
.toggle.on{background:#059669}
.toggle.on::after{left:16px}
.steps{display:flex;gap:0;margin-bottom:12px}
.step{flex:1;text-align:center;position:relative}
.step::after{content:'';position:absolute;top:10px;left:50%;width:100%;height:2px;background:#E2E8F0;z-index:0}
.step:last-child::after{display:none}
.step .circle{width:20px;height:20px;border-radius:50%;background:#E2E8F0;color:#94A3B8;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;position:relative;z-index:1}
.step.active .circle{background:#2A7FFF;color:white}
.step.done .circle{background:#059669;color:white}
.sl{font-size:6px;color:#64748B;margin-top:4px}
.step.active .sl{color:#2A7FFF;font-weight:600}
.pn{position:absolute;bottom:10px;right:16px;font-size:6px;color:#94A3B8}
.footer-bar{background:#111827;color:#9CA3AF;padding:12px 16px;border-radius:8px;margin-top:12px;font-size:6px;display:flex;justify-content:space-between}
.sale-banner{height:24px;background:linear-gradient(90deg,#FF6B35,#F97316);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700;letter-spacing:1px}
.chart-placeholder{background:#F8FAFC;border:1px dashed #E2E8F0;border-radius:8px;padding:16px;text-align:center;color:#94A3B8;font-size:7px}
.empty-state{text-align:center;padding:30px;color:#94A3B8}
.empty-state .icon{font-size:30px;margin-bottom:8px}
.empty-state p{font-size:8px}
.toast{position:fixed;top:20px;right:20px;padding:8px 14px;border-radius:8px;font-size:7px;font-weight:600;color:white;z-index:100}
.toast-success{background:#059669}
.toast-error{background:#DC2626}
.list-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9;font-size:7px}
.list-item .icon{font-size:12px}
.list-item .text{flex:1}
.list-item .action{color:#2A7FFF;font-weight:600;font-size:6px}
.page-number{position:absolute;bottom:10px;right:16px;font-size:6px;color:#94A3B8}
`;
pages.push(W.cover('E-Commerce Platform', 'Complete Wireframe Document - Every Feature, Every Screen', 'Version 4.0 - June 2026 | Confidential'));

// TABLE OF CONTENTS
pages.push(W.page('Table of Contents', '📑', '', W.sec('Platform Sections',
  W.grid('grid-2',
    W.card('1. Homepage', 'Header (2-layer), CategoryCircles, HeroSection, TrustBar, DealsOfTheDay, CategoryShowcase, OfferSection, TopBrands, CategoryProducts, RecentlyViewed, Footer'),
    W.card('2. Category Page', 'Filters, sort, product grid, subcategory marquee, pagination'),
    W.card('3. Product Detail', 'Image gallery, specs tabs, reviews, delivery estimator, add-to-cart, JSON-LD'),
    W.card('4. Search', 'Autocomplete, results, filters, recent searches'),
    W.card('5. Auth', 'Login (split-screen), Signup, Forgot Password, OTP'),
    W.card('6. Cart', 'Cart items, quantity controls, order summary (sticky), coupon'),
    W.card('7. Checkout', 'Progress steps, customer details, payment (Razorpay), confirmation'),
    W.card('8. Customer Dashboard', 'Overview, orders, wishlist, reviews, addresses, profile'),
    W.card('9. Admin Panel', 'Sidebar (gray-800, 30+ items), dashboard, products, orders, users, vendors, marketing, content, home builder, settings'),
    W.card('10. Vendor Panel', 'Sidebar (blue-800), products, orders, payouts'),
    W.card('11. Software Store', 'Listing, detail, license management, activation'),
    W.card('12. Gamification', 'Spin wheel, lucky draw, referral program'),
    W.card('13. Partner API', 'Dashboard, keys, docs, wallet, orders'),
    W.card('14. Informational', 'About, contact, FAQ, policies, store locator, brand pages'),
    W.card('15. SEO', 'JSON-LD, sitemap, robots, meta tags, breadcrumbs'),
    W.card('16. Security', 'CSP, rate limiting, bot detection, encryption, sessions')
  )
)));

// HOMEPAGE - HEADER
pages.push(W.page('Homepage - Header (Two-Layer)', '🏠', 'All Visitors',
  W.sec('Top Navigation Bar (bg-blue-600, white text)',
    W.card('', '<div style="background:linear-gradient(90deg,#2A7FFF,#1E5FCC);padding:6px 16px;border-radius:8px;color:white;display:flex;justify-content:space-between;align-items:center;font-size:7px"><div style="display:flex;gap:12px"><span>Home</span><span>Products</span><span>About Us</span><span>Contact</span></div><div style="opacity:.7;font-size:6px">Delivering quality electronics across India</div><div style="display:flex;gap:12px"><span>📍 Deliver to: Noida 201301</span><span>📍 Store Locator</span><span>📦 Track Order</span></div></div>')
  ),
  W.sec('Main Header (white, sticky)',
    W.card('', '<div style="display:flex;align-items:center;gap:12px;padding:8px 16px;background:white;border:1px solid #E2E8F0;border-radius:12px"><div style="font-size:16px;display:none">☰</div><div style="font-size:14px;font-weight:800;color:#2A7FFF;font-family:Poppins">SARA<br>ELECTRONICS</div><div style="flex:1;display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><div style="background:#F1F5F9;padding:6px 10px;font-size:6px;color:#64748B;border-right:1px solid #E2E8F0">All Categories ▾</div><div style="flex:1;padding:6px 10px;font-size:7px;color:#94A3B8">Search for products, brands and more...</div><div style="background:#FF6B35;padding:6px 12px;color:white;font-size:8px;display:flex;align-items:center">🔍</div></div><div style="display:flex;gap:12px;align-items:center;font-size:7px;color:#475569"><span>❤️ Wishlist</span><span style="position:relative">🛒 Cart<span style="position:absolute;top:-4px;right:-6px;background:#FF6B35;color:white;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:5px">3</span></span><span>👤 Account</span></div></div>')
  ),
  W.sec('Mobile Header',
    W.card('', '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:white;border:1px solid #E2E8F0;border-radius:12px"><span style="font-size:14px">☰</span><div style="font-size:10px;font-weight:800;color:#2A7FFF">SARA ELECTRONICS</div><div style="flex:1"></div><span>🔍</span><span>🛒<span style="background:#FF6B35;color:white;border-radius:50%;width:10px;height:10px;display:inline-flex;align-items:center;justify-content:center;font-size:4px">3</span></span></div><div style="margin-top:4px;display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><div style="padding:6px 10px;font-size:7px;color:#94A3B8;flex:1">Search for products...</div><div style="background:#FF6B35;padding:6px 10px;color:white;font-size:8px">🔍</div></div>')
  )
));

// HOMEPAGE - CATEGORY CIRCLES
pages.push(W.page('Homepage - Category Circles & Hero', '🏠', 'All Visitors',
  W.sec('Category Circles (below header, white bg, scrollable)',
    W.card('', '<div style="display:flex;gap:12px;overflow:hidden;padding:10px 0;background:white;border-bottom:1px solid #E2E8F0"><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">📺</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">TVs</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#F0FDF4;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">📱</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Mobiles</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#FFF7ED;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">💻</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Laptops</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#FEF2F2;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">❄️</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">ACs</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#F5F3FF;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">🌀</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Washing</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">🔊</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Audio</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#FEF9C3;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">🎮</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Gaming</div></div><div style="text-align:center;min-width:60px"><div style="width:56px;height:56px;border-radius:50%;background:#F0F9FF;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto">🏠</div><div style="font-size:6px;color:#0F172A;margin-top:4px;font-weight:500">Home</div></div></div>')
  ),
  W.sec('Hero Section (full-width, 16:5 aspect, rounded-2xl on desktop)',
    W.card('', '<div style="background:linear-gradient(135deg,#0F172A 0%,#1e3a5f 50%,#2A7FFF 100%);border-radius:12px;padding:24px;color:white;position:relative;overflow:hidden;min-height:120px"><div style="position:absolute;top:0;right:0;width:200px;height:200px;background:rgba(255,107,53,.2);border-radius:50%;filter:blur(40px)"></div><div style="position:absolute;bottom:-40px;left:40%;width:150px;height:150px;background:rgba(42,127,255,.3);border-radius:50%;filter:blur(40px)"></div><div style="position:relative;z-index:1"><div style="font-size:7px;opacity:.7;margin-bottom:4px">SARA ELECTRONICS</div><div style="font-size:20px;font-weight:800;font-family:Poppins;margin-bottom:6px">MEGA SALE<br>Up to 60% OFF</div><div style="font-size:8px;opacity:.8;margin-bottom:10px">Premium Electronics at Unbeatable Prices</div><div style="display:flex;gap:6px"><span class="btn btn-accent">Shop Now →</span><span class="btn btn-outline" style="border-color:rgba(255,255,255,.3);color:white">View Deals</span></div></div><div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px"><span style="width:28px;height:4px;background:white;border-radius:2px"></span><span style="width:8px;height:4px;background:rgba(255,255,255,.4);border-radius:2px"></span><span style="width:8px;height:4px;background:rgba(255,255,255,.4);border-radius:2px"></span></div></div>')
  )
));

// HOMEPAGE - TRUST BAR + DEALS
pages.push(W.page('Homepage - Trust Bar & Deals of the Day', '🏠', 'All Visitors',
  W.sec('Trust Bar (full-width, white bg, borders)',
    W.grid('grid-4',
      W.ci('🚚', 'Free Shipping', 'On orders above ₹999', 'border-l-4 border-l-blue-500'),
      W.ci('✅', 'Genuine Products', '100% authentic items', 'border-l-4 border-l-green-500'),
      W.ci('🛡️', 'Quality Assured', 'Certified electronics', 'border-l-4 border-l-amber-500'),
      W.ci('🔒', 'Secure Payment', '100% secure checkout', 'border-l-4 border-l-violet-500')
    )
  ),
  W.sec('Deals of the Day (countdown timer, horizontal scroll)',
    W.card('', '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:10px;font-weight:800;color:#0F172A;font-family:Poppins">🔥 Deals of the Day</span><div style="display:flex;gap:3px"><span style="background:#0F172A;color:white;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;font-variant-numeric:tabular-nums">08</span><span style="color:#0F172A;font-size:8px">:</span><span style="background:#0F172A;color:white;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;font-variant-numeric:tabular-nums">45</span><span style="color:#0F172A;font-size:8px">:</span><span style="background:#0F172A;color:white;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:700;font-variant-numeric:tabular-nums">30</span></div></div>'),
    W.grid('grid-4',
      W.prod('Samsung 55" Crystal UHD 4K TV', '₹34,990', '₹54,990', 4.5),
      W.prod('Boat Airdopes 141 TWS', '₹1,299', '₹4,490', 4.2),
      W.prod('HP Pavilion 15 Ryzen 5', '₹49,990', '₹69,990', 4.6),
      W.prod('LG 8kg Front Load Washer', '₹29,990', '₹42,990', 4.3)
    )
  )
));

// HOMEPAGE - CATEGORY SHOWCASE + OFFERS
pages.push(W.page('Homepage - Category Showcase & Offer Section', '🏠', 'All Visitors',
  W.sec('Category Showcase (Shop by Category, 2x2 mobile, 4-col desktop)',
    W.grid('grid-4',
      W.card('', '<div style="background:linear-gradient(135deg,#0F172A,#1e3a5f);border-radius:12px;padding:12px;color:white;position:relative;overflow:hidden;min-height:80px"><div style="font-size:8px;font-weight:700">Televisions</div><div style="font-size:6px;opacity:.7;margin-top:2px">Shop now →</div><div style="position:absolute;bottom:0;right:0;font-size:28px;opacity:.3">📺</div></div>'),
      W.card('', '<div style="background:linear-gradient(135deg,#1e3a5f,#2A7FFF);border-radius:12px;padding:12px;color:white;position:relative;overflow:hidden;min-height:80px"><div style="font-size:8px;font-weight:700">Mobiles</div><div style="font-size:6px;opacity:.7;margin-top:2px">Shop now →</div><div style="position:absolute;bottom:0;right:0;font-size:28px;opacity:.3">📱</div></div>'),
      W.card('', '<div style="background:linear-gradient(135deg,#0E7490,#06B6D4);border-radius:12px;padding:12px;color:white;position:relative;overflow:hidden;min-height:80px"><div style="font-size:8px;font-weight:700">Laptops</div><div style="font-size:6px;opacity:.7;margin-top:2px">Shop now →</div><div style="position:absolute;bottom:0;right:0;font-size:28px;opacity:.3">💻</div></div>'),
      W.card('', '<div style="background:linear-gradient(135deg,#0369A1,#38BDF8);border-radius:12px;padding:12px;color:white;position:relative;overflow:hidden;min-height:80px"><div style="font-size:8px;font-weight:700">Home Appliances</div><div style="font-size:6px;opacity:.7;margin-top:2px">Shop now →</div><div style="position:absolute;bottom:0;right:0;font-size:28px;opacity:.3">🏠</div></div>')
    )
  ),
  W.sec('Offer Section (two-column promotional cards)',
    W.grid('grid-2',
      W.card('', '<div style="background:linear-gradient(135deg,#FF6B35,#F97316);border-radius:12px;padding:16px;color:white"><div style="font-size:8px;opacity:.8">EXCLUSIVE OFFER</div><div style="font-size:12px;font-weight:800;margin:4px 0;font-family:Poppins">Up to 40% OFF on Audio</div><div style="font-size:7px;opacity:.8">Premium headphones & speakers</div><span class="btn" style="background:white;color:#FF6B35;margin-top:8px;font-size:6px">Shop Now</span></div>'),
      W.card('', '<div style="background:linear-gradient(135deg,#2A7FFF,#1E5FCC);border-radius:12px;padding:16px;color:white"><div style="font-size:8px;opacity:.8">NEW ARRIVALS</div><div style="font-size:12px;font-weight:800;margin:4px 0;font-family:Poppins">Latest Smartphones 2026</div><div style="font-size:7px;opacity:.8">Starting from ₹11,999</div><span class="btn" style="background:white;color:#2A7FFF;margin-top:8px;font-size:6px">Explore</span></div>')
    )
  )
));

// HOMEPAGE - TOP BRANDS + PRODUCTS
pages.push(W.page('Homepage - Top Brands & Category Products', '🏠', 'All Visitors',
  W.sec('Top Brands (brand logo grid)',
    W.grid('grid-4',
      W.card('', '<div style="text-align:center;padding:12px"><div style="font-size:18px;margin-bottom:4px">📱</div><div style="font-size:10px;font-weight:800;color:#0F172A">Samsung</div><div style="font-size:6px;color:#64748B">45 products</div></div>'),
      W.card('', '<div style="text-align:center;padding:12px"><div style="font-size:18px;margin-bottom:4px">📺</div><div style="font-size:10px;font-weight:800;color:#0F172A">LG</div><div style="font-size:6px;color:#64748B">32 products</div></div>'),
      W.card('', '<div style="text-align:center;padding:12px"><div style="font-size:18px;margin-bottom:4px">🎧</div><div style="font-size:10px;font-weight:800;color:#0F172A">Boat</div><div style="font-size:6px;color:#64748B">28 products</div></div>'),
      W.card('', '<div style="text-align:center;padding:12px"><div style="font-size:18px;margin-bottom:4px">💻</div><div style="font-size:10px;font-weight:800;color:#0F172A">HP</div><div style="font-size:6px;color:#64748B">38 products</div></div>')
    )
  ),
  W.sec('Category Products Section (horizontal scroll carousel, from home_components collection)',
    W.card('card-blue', '<div style="font-size:8px;font-weight:700;margin-bottom:6px">📺 Televisions</div>'),
    W.grid('grid-4',
      W.prod('Samsung 55" Crystal UHD 4K TV', '₹34,990', '₹54,990', 4.5),
      W.prod('LG 43" Full HD Smart LED', '₹22,990', '₹32,990', 4.3),
      W.prod('Sony Bravia 50" 4K OLED', '₹89,990', '₹1,29,990', 4.7),
      W.prod('TCL 32" HD Smart LED', '₹12,990', '₹18,990', 4.1)
    )
  ),
  W.sec('Recently Viewed (customer-specific, SSR disabled)',
    W.grid('grid-5',
      W.prod('Samsung 55" TV', '₹34,990', '₹54,990', 4.5),
      W.prod('Boat Airdopes', '₹1,299', '₹4,490', 4.2),
      W.prod('HP Laptop', '₹49,990', '₹69,990', 4.6),
      W.prod('LG Washer', '₹29,990', '₹42,990', 4.3),
      W.prod('Sony Speaker', '₹3,999', '₹6,999', 4.4)
    )
  )
));

// HOMEPAGE - FOOTER
pages.push(W.page('Homepage - Footer', '🏠', 'All Visitors',
  W.sec('Footer - Trust Badges Row (top, dark bg)',
    W.card('', '<div style="background:#111827;border-radius:12px;padding:12px;color:white"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><div style="text-align:center"><div style="width:32px;height:32px;border-radius:12px;background:rgba(42,127,255,.2);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px">🚚</div><div style="font-size:7px;font-weight:600;margin-top:4px">Free Shipping</div><div style="font-size:5px;color:#9CA3AF">On orders above ₹999</div></div><div style="text-align:center"><div style="width:32px;height:32px;border-radius:12px;background:rgba(5,150,105,.2);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px">🔒</div><div style="font-size:7px;font-weight:600;margin-top:4px">Secure Payments</div><div style="font-size:5px;color:#9CA3AF">100% secure checkout</div></div><div style="text-align:center"><div style="width:32px;height:32px;border-radius:12px;background:rgba(147,51,234,.2);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px">🛡️</div><div style="font-size:7px;font-weight:600;margin-top:4px">Quality Assured</div><div style="font-size:5px;color:#9CA3AF">Certified products</div></div><div style="text-align:center"><div style="width:32px;height:32px;border-radius:12px;background:rgba(234,88,12,.2);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px">💬</div><div style="font-size:7px;font-weight:600;margin-top:4px">24/7 Support</div><div style="font-size:5px;color:#9CA3AF">Mon-Sat 10AM-8PM</div></div></div></div>')
  ),
  W.sec('Footer - Main Content (4-column grid, dark gradient)',
    W.card('', '<div style="background:linear-gradient(180deg,#111827,#030712);border-radius:12px;padding:16px;color:white"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;font-size:6px"><div><div style="font-size:10px;font-weight:800;color:#2A7FFF;margin-bottom:6px;font-family:Poppins">SARA ELECTRONICS</div><div style="color:#9CA3AF;line-height:1.5">Your trusted partner for genuine electronics. Shop from top brands with warranty and free delivery.</div><div style="display:flex;gap:6px;margin-top:8px"><span style="width:24px;height:24px;border-radius:50%;background:#1F2937;display:flex;align-items:center;justify-content:center;font-size:8px">f</span><span style="width:24px;height:24px;border-radius:50%;background:#1F2937;display:flex;align-items:center;justify-content:center;font-size:8px">𝕏</span><span style="width:24px;height:24px;border-radius:50%;background:#1F2937;display:flex;align-items:center;justify-content:center;font-size:8px">📷</span></div></div><div><div style="font-weight:700;margin-bottom:6px">Quick Links</div><div style="color:#9CA3AF;line-height:2">Home<br>Products<br>About Us<br>Contact Us</div></div><div><div style="font-weight:700;margin-bottom:6px">Information</div><div style="color:#9CA3AF;line-height:2">Privacy Policy<br>Terms & Conditions<br>FAQ<br>Complaints</div></div><div><div style="font-weight:700;margin-bottom:6px">Contact Us</div><div style="color:#9CA3AF;line-height:2">📍 123, Electronics Market, Noida<br>📞 +91 1800-123-4567<br>📧 support@saraelectronics.in</div></div></div><div style="text-align:center;margin-top:12px;padding-top:8px;border-top:1px solid #1F2937;color:#6B7280;font-size:5px">© 2026 Sara Electronics. All rights reserved.</div></div>')
  )
));

// CATEGORY, PRODUCT DETAIL, AUTH, CART, CHECKOUT PAGES

pages.push(W.page('Category Page', '📂', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Products','Categories','Brands','Offers'], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Category', 'Televisions'),
  W.sec('Filters & Sort',
    W.filterBar('All TVs','Smart TV','LED','OLED','QLED','4K','Under ₹20K','₹20K-50K','Above ₹50K')
  ),
  W.grid('grid-2',
    W.sec('Filter Sidebar',
      W.card('Brand', '<div style="font-size:6px;display:flex;flex-direction:column;gap:4px"><label><input type="checkbox" checked> Samsung (12)</label><label><input type="checkbox" checked> LG (8)</label><label><input type="checkbox"> Sony (6)</label><label><input type="checkbox"> TCL (5)</label></div>'),
      W.card('Price Range', '<div style="display:flex;gap:4px"><input class="fi" style="width:50%" placeholder="Min"><input class="fi" style="width:50%" placeholder="Max"></div><div style="margin-top:4px"><span class="btn btn-primary btn-sm">Apply</span></div>'),
      W.card('Rating', '<div style="font-size:6px;display:flex;flex-direction:column;gap:4px"><label><input type="checkbox"> ★★★★★ (4.5+)</label><label><input type="checkbox" checked> ★★★★ (4.0+)</label><label><input type="checkbox"> ★★★ (3.0+)</label></div>'),
      W.card('Availability', '<label style="font-size:6px"><input type="checkbox" checked> In Stock Only</label>')
    ),
    W.sec('Product Grid',
      W.grid('grid-3',
        W.prod('Samsung 55" Crystal UHD 4K TV', '₹34,990', '₹54,990', 4.5),
        W.prod('LG 43" Full HD Smart LED', '₹22,990', '₹32,990', 4.3),
        W.prod('Sony Bravia 50" 4K OLED', '₹89,990', '₹1,29,990', 4.7),
        W.prod('TCL 32" HD Smart LED', '₹12,990', '₹18,990', 4.1),
        W.prod('Hisense 55" QLED 4K', '₹39,990', '₹59,990', 4.4),
        W.prod('Vu 43" Premium 4K', '₹24,990', '₹34,990', 4.2)
      ),
      W.flex('flex-center gap-4 mt-8', W.btn('← Prev','btn-outline btn-sm'), W.btn('1','btn-primary btn-sm'), W.btn('2','btn-outline btn-sm'), W.btn('3','btn-outline btn-sm'), W.btn('Next →','btn-outline btn-sm'))
    )
  )
));

pages.push(W.page('Product Detail Page', '📦', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Products','Categories','Brands','Offers'], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Televisions', 'Samsung 55" Crystal UHD 4K Smart TV'),
  W.twoCol(
    W.sec('Image Gallery',
      W.card('', '<div style="background:#F1F5F9;height:140px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:48px;color:#CBD5E1">📺</div>'),
      W.grid('grid-4 mt-4',
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">+</div>')
      )
    ),
    W.sec('Product Info',
      W.badge('In Stock','badge-green'),
      W.card('Samsung 55" Crystal UHD 4K Smart TV (2025)', ''),
      W.card('', '<div style="margin:4px 0"><span style="font-size:16px;font-weight:800;color:#FF6B35">₹34,990</span><span style="font-size:9px;color:#94A3B8;text-decoration:line-through;margin-left:4px">₹54,990</span><span class="badge badge-green" style="margin-left:4px">36% OFF</span></div><div style="font-size:6px;color:#64748B">Inclusive of all taxes | EMI starts at ₹1,666/month</div>'),
      W.grid('grid-2 mt-4',
        W.card('Size', '<div style="display:flex;gap:4px"><span class="btn btn-outline btn-sm">43"</span><span class="btn btn-primary btn-sm">55"</span><span class="btn btn-outline btn-sm">65"</span></div>'),
        W.card('Color', '<div style="display:flex;gap:4px"><span class="btn btn-primary btn-sm">Black</span><span class="btn btn-outline btn-sm">Silver</span></div>')
      ),
      W.card('Delivery', '<div style="display:flex;gap:6px"><input class="fi" style="flex:1" placeholder="Enter pincode"><span class="btn btn-primary btn-sm">Check</span></div><div style="font-size:6px;color:#059669;margin-top:4px">✓ Delivery by Tomorrow | Free</div>'),
      W.flex('gap-4 mt-4', W.btn('Add to Cart','btn-primary'), W.btn('Buy Now','btn-accent'), W.btn('❤️','btn-outline'))
    )
  ),
  W.sec('Product Tabs',
    W.tabs(['Specifications','Description','Reviews (128)','Q&A','Warranty']),
    W.card('', '<div class="stat-row"><span class="label">Brand</span><span class="value">Samsung</span></div><div class="stat-row"><span class="label">Model</span><span class="value">UA55CU7700</span></div><div class="stat-row"><span class="label">Display</span><span class="value">55" 4K UHD (3840x2160)</span></div><div class="stat-row"><span class="label">Smart TV</span><span class="value">Yes (Tizen OS)</span></div><div class="stat-row"><span class="label">HDR</span><span class="value">HDR10+</span></div><div class="stat-row"><span class="label">Ports</span><span class="value">3 HDMI, 1 USB</span></div><div class="stat-row"><span class="label">Warranty</span><span class="value">2 Years Comprehensive</span></div>')
  ),
  W.sec('Structured Data (JSON-LD)',
    W.code('@type: Product\nname: Samsung 55" Crystal UHD 4K Smart TV\nbrand: Samsung\nmpn: UA55CU7700\noffers: { price: 34990, currency: INR, availability: InStock }\naggregateRating: { ratingValue: 4.5, reviewCount: 128 }')
  )
));

// AUTH PAGES
pages.push(W.page('Login Page (Split-Screen)', '🔐', 'Unauthenticated',
  W.twoCol(
    W.card('', '<div style="background:linear-gradient(135deg,#2A7FFF,#1E5FCC,#0F3460);border-radius:12px;padding:24px;color:white;min-height:300px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:16px;font-weight:800;font-family:Poppins;margin-bottom:12px">Welcome back to<br>Sara Electronics</div><div style="font-size:7px;opacity:.8;line-height:1.8"><div style="margin-bottom:6px">⚡ Fast Checkout</div><div style="margin-bottom:6px">🎁 Exclusive Deals</div><div>🛡️ Priority Support</div></div></div>'),
    W.card('', '<div style="padding:16px"><div style="font-size:6px;color:#64748B;margin-bottom:4px">← Back to store</div><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Sign in</div><div style="font-size:7px;margin-bottom:12px">Don\'t have an account? <span style="color:#2A7FFF;font-weight:600">Create one</span></div><div style="display:flex;gap:6px;border:1px solid #E2E8F0;border-radius:8px;padding:8px;justify-content:center;margin-bottom:12px;font-size:7px">🔵 Continue with Google</div><div style="text-align:center;font-size:6px;color:#94A3B8;margin-bottom:8px">or sign in with email</div>' + W.fg('Email','email','you@example.com') + W.fg('Password','password','••••••••') + '<div style="display:flex;justify-content:space-between;font-size:6px;margin:8px 0"><label><input type="checkbox"> Remember me</label><span style="color:#2A7FFF;cursor:pointer">Forgot password?</span></div>' + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px">Sign in</span><div style="font-size:5px;color:#94A3B8;text-align:center;margin-top:8px">By signing in, you agree to our Terms & Privacy Policy</div></div>')
  )
));

pages.push(W.page('Signup & Forgot Password', '🔐', 'Unauthenticated',
  W.twoCol(
    W.card('', '<div style="padding:16px"><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Create Account</div>' + W.fr(W.fg('First Name'), W.fg('Last Name')) + W.fg('Email','email') + W.fg('Phone','tel') + W.fg('Password','password') + W.fg('Confirm Password','password') + '<div style="font-size:6px;margin:8px 0"><input type="checkbox"> I agree to <span style="color:#2A7FFF">Terms</span> & <span style="color:#2A7FFF">Privacy Policy</span></div>' + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px">Create Account</span><div style="font-size:7px;text-align:center;margin-top:8px">Already have an account? <span style="color:#2A7FFF;font-weight:600">Sign in</span></div></div>'),
    W.card('', '<div style="padding:16px"><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Reset Password</div><div style="font-size:7px;color:#64748B;margin-bottom:12px">Enter your email to receive a reset link</div>' + W.fg('Email','email','you@example.com') + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px;margin-top:8px">Send Reset Link</span><div style="font-size:7px;text-align:center;margin-top:12px">Remember your password? <span style="color:#2A7FFF;font-weight:600">Sign in</span></div></div>')
  )
));

// CART
pages.push(W.page('Shopping Cart', '🛒', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Shopping Cart'),
  W.sec('Cart Items & Order Summary',
    W.twoCol(
      W.card('', '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:8px;color:#64748B">Continue Shopping</span><span style="font-size:8px;color:#DC2626;cursor:pointer;font-weight:600">Clear Cart</span></div>' +
        '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;margin-bottom:8px;display:flex;gap:10px"><div style="width:80px;height:80px;background:#F1F5F9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#CBD5E1">📺</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Samsung 55" Crystal UHD 4K TV</div><div style="font-size:6px;color:#64748B">SKU: SAM-55-CU7700 | Size: 55"</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">−</span><span style="padding:2px 8px;font-size:8px">1</span><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">+</span></div><span style="font-size:10px;font-weight:700;color:#FF6B35">₹34,990</span></div></div><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:10px;cursor:pointer">❤️</span><span style="font-size:10px;cursor:pointer;color:#DC2626">🗑️</span></div></div>' +
        '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;display:flex;gap:10px"><div style="width:80px;height:80px;background:#F1F5F9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#CBD5E1">🎧</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Boat Airdopes 141 TWS Earbuds</div><div style="font-size:6px;color:#64748B">Color: Black</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">−</span><span style="padding:2px 8px;font-size:8px">2</span><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">+</span></div><span style="font-size:10px;font-weight:700;color:#FF6B35">₹2,598</span></div></div><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:10px;cursor:pointer">❤️</span><span style="font-size:10px;cursor:pointer;color:#DC2626">🗑️</span></div></div>'),
      W.card('', '<div style="position:sticky;top:24px"><div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Order Summary</div><div style="display:flex;gap:6px;margin-bottom:8px"><input class="fi" style="flex:1" placeholder="Coupon code"><span class="btn btn-primary btn-sm">Apply</span></div>' + W.statRow('Subtotal (3 items)','₹37,588') + W.statRow('GST (18%)','₹6,766') + W.statRow('Shipping','<span style="color:#059669">FREE</span>') + '<div class="stat-row" style="border-top:2px solid #E2E8F0;padding-top:6px;margin-top:4px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#FF6B35;font-size:12px">₹44,354</span></div><span class="btn btn-accent" style="width:100%;text-align:center;padding:8px;border-radius:8px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:4px">💳 Proceed to Checkout</span><div style="font-size:6px;color:#64748B;text-align:center;margin-top:6px">🔒 Secure checkout powered by Razorpay</div></div>')
    )
  )
));

// CHECKOUT
pages.push(W.page('Checkout (Multi-Step)', '💳', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🛒','👤']),
  W.steps(['Customer Details','Payment'], 0),
  W.twoCol(
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Customer Details</div>' +
      W.fr(W.fg('First Name'), W.fg('Last Name')) +
      W.fr(W.fg('Email','email'), W.fg('Phone','tel')) +
      W.fg('Address Line 1','text','Street address') +
      W.fg('Address Line 2','text','Apt, suite (optional)') +
      W.fr(W.fg('City'), W.fg('State')) +
      W.fr(W.fg('PIN Code'), W.fg('Country')) +
      '<div style="display:flex;gap:6px;margin-top:12px"><span class="btn btn-outline" style="flex:1;text-align:center">Back</span><span class="btn btn-accent" style="flex:1;text-align:center">Continue to Payment →</span></div>'),
    W.card('', '<div style="position:sticky;top:4px"><div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Order Summary</div>' +
      '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9"><div style="width:40px;height:40px;background:#F1F5F9;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">📺</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Samsung 55" TV × 1</div><div style="font-size:8px;font-weight:700;color:#FF6B35">₹34,990</div></div></div>' +
      '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9"><div style="width:40px;height:40px;background:#F1F5F9;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">🎧</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Boat Airdopes × 2</div><div style="font-size:8px;font-weight:700;color:#FF6B35">₹2,598</div></div></div>' +
      W.statRow('Subtotal','₹37,588') + W.statRow('GST','₹6,766') + W.statRow('Shipping','<span style="color:#059669">FREE</span>') + '<div class="stat-row" style="border-top:2px solid #E2E8F0;padding-top:6px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#FF6B35;font-size:12px">₹44,354</span></div></div>')
  )
));

pages.push(W.page('Checkout - Payment & Confirmation', '✅', 'Authenticated Users',
  W.steps(['Customer Details','Payment'], 1),
  W.twoCol(
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Payment Method</div>' +
      '<div style="border:2px solid #2A7FFF;border-radius:12px;padding:10px;margin-bottom:6px;background:#EFF6FF"><div style="font-size:7px;font-weight:600">💳 Online Payment (Razorpay)</div><div style="font-size:6px;color:#64748B">UPI, Cards, Net Banking, Wallets</div></div>' +
      '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;margin-bottom:6px"><div style="font-size:7px;font-weight:600">🏪 In-Store Purchase</div><div style="font-size:6px;color:#64748B">Visit store with employee verification</div></div>' +
      '<div style="display:flex;gap:6px;margin-top:12px"><span class="btn btn-outline" style="flex:1;text-align:center">Back</span><span class="btn btn-accent" style="flex:1;text-align:center">Pay ₹44,354 →</span></div>'),
    W.card('', '<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:8px">✅</div><div style="font-size:14px;font-weight:800;color:#059669;font-family:Poppins">Order Confirmed!</div><div style="font-size:7px;color:#64748B;margin-top:4px">Order #SARA-2026-4521</div><div style="font-size:6px;color:#64748B;margin-top:2px">Confirmation sent to rahul@email.com</div></div>' +
      W.card('card-blue', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📦 Order Tracking</div>' + W.steps(['Confirmed','Picked','Shipped','Delivered'], 2)) +
      W.statRow('Payment','Razorpay UPI') + W.statRow('Delivery By','June 21, 2026') +
      '<div style="display:flex;gap:6px;margin-top:8px"><span class="btn btn-primary" style="flex:1;text-align:center">Track Order</span><span class="btn btn-outline" style="flex:1;text-align:center">Continue Shopping</span></div>')
  )
));

// DASHBOARD PAGES
pages.push(W.page('Customer Dashboard - Overview', '📊', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Dashboard'),
  W.sec('Dashboard Overview',
    W.kpiG(W.kpi('3','Total Orders','k-blue'), W.kpi('₹44,354','Total Spent','k-green'), W.kpi('2','Pending','k-orange'), W.kpi('1','Delivered','k-purple')),
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:6px;font-family:Poppins">Recent Purchases</div>',
      W.tbl(['Order ID','Date','Items','Total','Status','Action'],[
        ['#SARA-4521','Jun 19','Samsung TV + Boat Airdopes','₹44,354','<span class="status status-blue">Processing</span>','<span class="btn btn-outline btn-sm">Track</span>'],
        ['#SARA-4498','Jun 15','HP Pavilion Laptop','₹49,990','<span class="status status-green">Delivered</span>','<span class="btn btn-outline btn-sm">Review</span>'],
        ['#SARA-4401','Jun 10','LG Washing Machine','₹29,990','<span class="status status-green">Delivered</span>','<span class="btn btn-outline btn-sm">Reorder</span>']
      ])
    )
  ),
  W.sec('My Profile',
    W.card('', '<div style="display:flex;gap:12px"><div style="text-align:center"><div class="avatar avatar-lg" style="margin:0 auto">RK</div><div style="font-size:8px;font-weight:700;margin-top:4px">Rahul Kumar</div><div style="font-size:6px;color:#64748B">rahul@email.com</div><div style="font-size:5px;color:#94A3B8;margin-top:2px">Member since Jan 2026</div></div><div style="flex:1">' + W.fr(W.fg('First Name','text','Rahul'), W.fg('Last Name','text','Kumar')) + W.fg('Phone','tel','+91 98765 43210') + W.fg('Address','text','123, MG Road, Noida') + '<span class="btn btn-primary btn-sm">Save Changes</span></div></div>')
  )
));

// ADMIN PANEL
pages.push(W.page('Admin Panel - Sidebar & Header', '⚙️', 'Admin / Super Admin',
  W.twoCol(
    W.sb([
      {s:'Dashboard'}, {i:'📊',l:'Dashboard'},
      {s:'Products'}, {i:'📦',l:'Products'},{i:'📋',l:'Amazon Scraper'},{i:'👤',l:'Customer Centric'},{i:'📐',l:'Product Specifications'},{i:'⚡',l:'Site Features'},
      {s:'Promotions'}, {i:'🎁',l:'Promotions'},{i:'🏠',l:'Homepage Promotions'},{i:'🧩',l:'Home Components'},
      {s:'Users'}, {i:'👥',l:'Customers'},{i:'🛒',l:'Orders'},{i:'📋',l:'Complaints'},{i:'📞',l:'Contact Inquiries'},
      {s:'Gamification'}, {i:'🎰',l:'Spin Wheel'},{i:'🎯',l:'Spin Campaigns'},
      {s:'Content'}, {i:'📄',l:'Custom Pages'},{i:'📢',l:'Leads'},{i:'🏷️',l:'Brand Manager'},
      {s:'Finance'}, {i:'💳',l:'Payment History'},
      {s:'Catalog'}, {i:'📂',l:'Categories'},{i:'📑',l:'Sub-Categories'},{i:'🖼️',l:'Product Advertisements'},
      {s:'Software'}, {i:'💻',l:'Software Management'},
      {s:'Delivery'}, {i:'📍',l:'Blocked Pincodes'},{i:'🏪',l:'Store Locations'},
      {s:'Team'}, {i:'👨‍💼',l:'Employees'},
      {s:'Partners'}, {i:'🤝',l:'Partners'},{i:'💰',l:'Partner Payouts'},
      {s:'Integrations'}, {i:'🔗',l:'OTT PLAY DASHBOARD'},{i:'📖',l:'Documentation'},
      {s:'System'}, {i:'⚙️',l:'Settings'}
    ], 1),
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Admin Panel Sidebar</div><div style="font-size:7px;color:#64748B;margin-bottom:8px">Fixed left sidebar with gray-800 background. Active item highlighted with maroon-700. Collapsible on desktop, slide-in drawer on mobile.</div><div style="font-size:7px;font-weight:600;margin-bottom:4px">Sidebar Features:</div><div style="font-size:6px;color:#64748B;line-height:1.8">• 30+ menu items organized in sections<br>• Collapsible (64px collapsed, 256px expanded)<br>• Active item: bg-maroon-700 text-white<br>• Mobile: slide-in with dark overlay<br>• Custom scrollbar styling<br>• Logout button in footer</div>')
  )
));

pages.push(W.page('Admin Panel - Dashboard Overview', '📊', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
  W.sec('Admin Dashboard',
    W.kpiG(W.kpi('₹2,45,890','Revenue Today','k-orange'), W.kpi('1,284','Total Orders','k-blue'), W.kpi('892','Active Users','k-green'), W.kpi('45','Pending Orders','k-purple')),
    W.grid('grid-2',
      W.sec('Revenue Chart',
        W.miniChart(8,12,6,15,10,18,14,20,16,22,19,24),
        W.grid('grid-4 mt-4',
          W.card('','<div style="font-size:6px;color:#64748B">Jan</div><div style="font-size:8px;font-weight:700">₹1.2L</div>'),
          W.card('','<div style="font-size:6px;color:#64748B">Feb</div><div style="font-size:8px;font-weight:700">₹1.8L</div>'),
          W.card('','<div style="font-size:6px;color:#64748B">Mar</div><div style="font-size:8px;font-weight:700">₹2.1L</div>'),
          W.card('','<div style="font-size:6px;color:#64748B">Apr</div><div style="font-size:8px;font-weight:700">₹2.5L</div>')
        )
      ),
      W.sec('Top Products',
        W.card('','<div class="stat-row"><span class="label">Samsung 55" TV</span><span class="value">₹34,990 × 12</span></div><div class="stat-row"><span class="label">Boat Airdopes</span><span class="value">₹1,299 × 45</span></div><div class="stat-row"><span class="label">HP Laptop</span><span class="value">₹49,990 × 8</span></div><div class="stat-row"><span class="label">LG Washing Machine</span><span class="value">₹29,990 × 6</span></div>')
      )
    ),
    W.sec('Recent Orders',
      W.tbl(['Order ID','Customer','Amount','Status','Date','Action'],[
        ['#SARA-4521','Rahul K.','₹44,354','<span class="status status-blue">Processing</span>','Jun 19','<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4518','Priya S.','₹1,299','<span class="status status-purple">Shipped</span>','Jun 19','<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4515','Amit P.','₹49,990','<span class="status status-green">Delivered</span>','Jun 18','<span class="btn btn-outline btn-sm">View</span>']
      ])
    )
  )
));

pages.push(W.page('Admin Panel - Product Management', '📦', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
  W.twoCol(
    W.sb([{i:'📊',l:'Dashboard'},{i:'📦',l:'Products'},{i:'📂',l:'Categories'},{i:'🛒',l:'Orders'},{i:'👥',l:'Users'}],1),
    W.sec('Products',
      W.toolbar('Product Management', W.btn('+ Add Product','btn-primary'), W.btn('📥 Excel Upload','btn-success'), W.btn('📤 Export','btn-outline')),
      W.filterBar('All (156)','Active (120)','Draft (20)','Inactive (16)'),
      W.tbl(['Product','SKU','Price','Stock','Category','Status','Actions'],[
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#F1F5F9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px">📺</div><span style="font-weight:600">Samsung 55" TV</span></div>','SAM-55-CU7700','₹34,990','45','TVs','<span class="status status-green">Active</span>','<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#F1F5F9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px">🎧</div><span style="font-weight:600">Boat Airdopes 141</span></div>','BOAT-AP-141','₹1,299','230','Audio','<span class="status status-green">Active</span>','<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#F1F5F9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px">💻</div><span style="font-weight:600">HP Pavilion 15</span></div>','HP-PAV-15-R5','₹49,990','12','Laptops','<span class="status status-green">Active</span>','<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#F1F5F9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px">🌀</div><span style="font-weight:600">LG 8kg Front Load</span></div>','LG-WM-8FL','₹29,990','8','Appliances','<span class="status status-red">Low Stock</span>','<span class="btn btn-outline btn-sm">Edit</span>']
      ])
    )
  )
));

pages.push(W.page('Admin Panel - Orders & Users', '🛒', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
  W.sec('Orders',
    W.toolbar('Order Management', W.btn('📥 Export','btn-outline'), W.btn('🔄 Refresh','btn-outline')),
    W.kpiG(W.kpi('1,284','Total Orders','k-blue'), W.kpi('45','Pending','k-orange'), W.kpi('128','Processing','k-green'), W.kpi('1,089','Delivered','k-purple')),
    W.tbl(['Order ID','Customer','Amount','Payment','Status','Date','Action'],[
      ['#SARA-4521','Rahul K.','₹44,354','UPI','<span class="status status-blue">Processing</span>','Jun 19','<span class="btn btn-outline btn-sm">View</span>'],
      ['#SARA-4518','Priya S.','₹1,299','Card','<span class="status status-purple">Shipped</span>','Jun 19','<span class="btn btn-outline btn-sm">View</span>'],
      ['#SARA-4515','Amit P.','₹49,990','Net Banking','<span class="status status-green">Delivered</span>','Jun 18','<span class="btn btn-outline btn-sm">View</span>']
    ])
  ),
  W.sec('Users',
    W.tbl(['User','Email','Role','Orders','Spent','Status'],[
      [W.avatar('RK','avatar-sm') + ' Rahul Kumar','rahul@email.com',W.badge('Customer','badge-blue'),'12','₹1,89,450','<span class="status status-green">Active</span>'],
      [W.avatar('PS','avatar-sm') + ' Priya Singh','priya@email.com',W.badge('Customer','badge-blue'),'8','₹89,990','<span class="status status-green">Active</span>'],
      [W.avatar('VM','avatar-sm') + ' Vendor Mahesh','mahesh@vendor.com',W.badge('Vendor','badge-green'),'—','—','<span class="status status-green">Active</span>']
    ])
  )
));

pages.push(W.page('Admin Panel - Home Builder & Settings', '🎨', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
  W.sec('Home Page Builder (Drag-Drop)',
    W.alert('Drag and drop components to build the homepage. Reorder by dragging.','info'),
    W.card('card-orange', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Hero Slider</div><div style="font-size:6px;color:#64748B">Main banner carousel — 3 slides</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Category Circles</div><div style="font-size:6px;color:#64748B">Category icons row</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Trust Bar</div><div style="font-size:6px;color:#64748B">4 trust badges</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Deals of the Day</div><div style="font-size:6px;color:#64748B">Countdown timer products</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Category Showcase</div><div style="font-size:6px;color:#64748B">Shop by category tiles</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px">☰</span><div><div style="font-size:8px;font-weight:700">Category Products</div><div style="font-size:6px;color:#64748B">Horizontal scroll carousels</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span>' + W.toggle(true) + '</div></div>'),
    W.btn('+ Add Component','btn-primary mt-4')
  ),
  W.sec('General Settings',
    W.fg('Store Name','text','Sara Electronics'),
    W.fg('Site URL','url','https://saraelectronics.in'),
    W.fg('Contact Email','email','support@saraelectronics.in'),
    W.fg('Currency','text','INR (₹)'),
    W.btn('Save Settings','btn-primary mt-4')
  )
));

// VENDOR, SOFTWARE, GAMIFICATION, PARTNER, INFO PAGES

pages.push(W.page('Vendor Dashboard', '🏪', 'Vendor',
  W.topbar('SARA ELECTRONICS (Vendor)', [], ['🔍','🔔','👤']),
  W.twoCol(
    W.sb([{i:'📊',l:'Dashboard'},{i:'📦',l:'My Products'},{i:'🛒',l:'Orders'},{i:'💰',l:'Payouts'}],0),
    W.sec('Vendor Overview',
      W.kpiG(W.kpi('₹2,34,560','Revenue (Jun)','k-orange'), W.kpi('45','Products','k-green'), W.kpi('234','Orders','k-blue'), W.kpi('4.5','Avg Rating','k-purple')),
      W.sec('Recent Orders',
        W.tbl(['Order','Amount','Status','Date'],[
          ['#V-4521','₹34,990','<span class="status status-blue">Processing</span>','Jun 19'],
          ['#V-4518','₹1,299','<span class="status status-purple">Shipped</span>','Jun 19'],
          ['#V-4515','₹29,990','<span class="status status-green">Delivered</span>','Jun 18']
        ])
      ),
      W.sec('Payouts',
        W.tbl(['Period','Sales','Commission (5%)','Net Payout','Status'],[
          ['Jun 1-15','₹2,34,560','₹11,728','₹2,22,832','<span class="status status-yellow">Pending</span>'],
          ['May 16-31','₹1,89,450','₹9,473','₹1,79,977','<span class="status status-green">Paid</span>']
        ])
      )
    )
  )
));

pages.push(W.page('Software Store', '💻', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Software','Licenses','Support'], ['🔍','🛒','👤']),
  W.sec('Software Store Header',
    W.card('', '<div style="background:linear-gradient(135deg,#0F172A,#1e3a5f);border-radius:12px;padding:16px;color:white;text-align:center"><div style="font-size:14px;font-weight:800;font-family:Poppins">💻 Software Store</div><div style="font-size:8px;opacity:.7;margin-top:4px">Genuine software licenses at the best prices</div></div>')
  ),
  W.filterBar('All Software','Operating Systems','Office Suites','Antivirus','Design Tools','Development'),
  W.grid('grid-4',
    W.card('','<div style="background:#EFF6FF;height:60px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#2A7FFF">🪟</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Windows 11 Pro</div><div style="font-size:6px;color:#64748B">Microsoft | Digital License</div><div style="font-size:8px;font-weight:700;color:#FF6B35;margin-top:2px">₹8,999</div><div style="font-size:6px;color:#94A3B8;text-decoration:line-through">₹12,999</div><div class="btn-add">Buy Now</div></div>'),
    W.card('','<div style="background:#FEF2F2;height:60px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#DC2626">📄</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Microsoft Office 2024</div><div style="font-size:6px;color:#64748B">Microsoft | Lifetime</div><div style="font-size:8px;font-weight:700;color:#FF6B35;margin-top:2px">₹5,999</div><div style="font-size:6px;color:#94A3B8;text-decoration:line-through">₹8,999</div><div class="btn-add">Buy Now</div></div>'),
    W.card('','<div style="background:#F0FDF4;height:60px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#059669">🛡️</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Norton 360 Deluxe</div><div style="font-size:6px;color:#64748B">Norton | 1 Year, 5 Devices</div><div style="font-size:8px;font-weight:700;color:#FF6B35;margin-top:2px">₹1,999</div><div style="font-size:6px;color:#94A3B8;text-decoration:line-through">₹3,499</div><div class="btn-add">Buy Now</div></div>'),
    W.card('','<div style="background:#FAF5FF;height:60px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#9333EA">🎨</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Adobe Creative Cloud</div><div style="font-size:6px;color:#64748B">Adobe | 1 Year, All Apps</div><div style="font-size:8px;font-weight:700;color:#FF6B35;margin-top:2px">₹16,999</div><div style="font-size:6px;color:#94A3B8;text-decoration:line-through">₹29,999</div><div class="btn-add">Buy Now</div></div>')
  ),
  W.sec('My Licenses',
    W.tbl(['Software','Key','Activated','Expires','Status'],[
      ['Windows 11 Pro','XXXXX-XXXXX-XXXXX','Jun 15','Lifetime','<span class="status status-green">Active</span>'],
      ['Office 2024','XXXXX-XXXXX-XXXXX','Jun 10','Lifetime','<span class="status status-green">Active</span>'],
      ['Norton 360','XXXXX-XXXXX-XXXXX','May 1','May 2027','<span class="status status-green">Active</span>']
    ]),
    W.sec('Activate Software',
      W.card('card-blue','<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔑 Enter your license key</div><div style="display:flex;gap:4px"><input class="fi" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"><span class="btn btn-primary btn-sm">Activate</span></div>')
    )
  )
));

pages.push(W.page('Spin the Wheel & Gamification', '🎰', 'Admin / All Visitors',
  W.twoCol(
    W.sec('Spin Wheel Admin',
      W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
      W.kpiG(W.kpi('234','Spins Today','k-blue'), W.kpi('12','Winners','k-green'), W.kpi('₹5,670','Prizes Awarded','k-orange')),
      W.tbl(['User','Prize','Coupon Code','Date','Status'],[
        ['Rahul K.','₹500 Coupon','SPIN-500-ABCD','Jun 19','<span class="status status-green">Claimed</span>'],
        ['Priya S.','Free Shipping','SHIP-FREE-EFGH','Jun 19','<span class="status status-green">Claimed</span>'],
        ['Amit P.','₹200 Coupon','SPIN-200-IJKL','Jun 18','<span class="status status-yellow">Pending</span>']
      ])
    ),
    W.sec('Spin Wheel - Customer View',
      W.card('', '<div style="background:linear-gradient(135deg,#0F172A,#1e3a5f);border-radius:12px;padding:16px;color:white;text-align:center"><div style="font-size:12px;font-weight:800;font-family:Poppins">🎰 Spin &amp; Win!</div><div style="font-size:7px;opacity:.7;margin-top:4px">Spin the wheel to win exciting prizes</div><div style="margin:12px auto;width:120px;height:120px;border-radius:50%;background:conic-gradient(#FF6B35 0% 14%,#F97316 14% 28%,#F59E0B 28% 42%,#059669 42% 56%,#2A7FFF 56% 70%,#9333EA 70% 84%,#94A3B8 84% 100%);display:flex;align-items:center;justify-content:center"><div style="width:60px;height:60px;border-radius:50%;background:#0F172E;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">SPIN</div></div><div style="font-size:7px;opacity:.7;margin-top:8px">Spins remaining: 2/3</div><span class="btn btn-accent" style="margin-top:8px">🎰 SPIN NOW</span></div>')
    )
  )
));

pages.push(W.page('Lucky Draw & Referral', '🎁', 'Admin / Authenticated Users',
  W.twoCol(
    W.sec('Lucky Draw Admin',
      W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍','🔔','👤']),
      W.tbl(['Campaign','Prize','Entries','Draw Date','Status'],[
        ['Summer Mega Draw','iPhone 15','1,234','Jun 30','<span class="status status-green">Active</span>'],
        ['Festival Special','Samsung TV','2,345','Oct 15','<span class="status status-gray">Draft</span>']
      ])
    ),
    W.sec('Referral Program',
      W.card('', '<div style="background:linear-gradient(135deg,#F3E8FF,#EDE9FE);border-radius:12px;padding:16px;text-align:center"><div style="font-size:18px;margin-bottom:4px">👥</div><div style="font-size:10px;font-weight:800;font-family:Poppins">Refer &amp; Earn ₹500</div><div style="font-size:7px;color:#64748B;margin-top:4px">Share your code with friends. Both get ₹500!</div><div style="margin:8px auto;background:white;padding:6px 16px;border-radius:8px;font-size:10px;font-weight:700;color:#9333EA;display:inline-block;border:1px dashed #9333EA">RAHUL500</div><div style="display:flex;gap:4px;justify-content:center;margin-top:8px"><span class="btn btn-primary btn-sm">📋 Copy</span><span class="btn btn-outline btn-sm">📱 Share</span></div></div>'),
      W.tbl(['Rank','User','Referrals','Earned'],[
        ['🥇','Priya S.','12','₹6,000'],
        ['🥈','Amit P.','8','₹4,000'],
        ['🥉','Rahul K.','5','₹1,500']
      ])
    )
  )
));

pages.push(W.page('Partner API', '🤝', 'Partner / Admin',
  W.topbar('SARA ELECTRONICS (Partner API)', [], ['🔍','🔔','👤']),
  W.twoCol(
    W.sb([{i:'📊',l:'Overview'},{i:'🔑',l:'API Keys'},{i:'📖',l:'Documentation'},{i:'📦',l:'Orders'},{i:'💰',l:'Wallet'}],0),
    W.sec('Partner API Overview',
      W.kpiG(W.kpi('12,345','API Calls Today','k-blue'), W.kpi('234','Orders','k-green'), W.kpi('₹1,23,456','Revenue','k-orange'), W.kpi('99.9%','Uptime','k-purple')),
      W.sec('API Keys',
        W.tbl(['Name','Key','Scopes','Last Used','Status'],[
          ['Production','pk_live_****3f2a','orders, products, wallet','2 min ago','<span class="status status-green">Active</span>'],
          ['Test','pk_test_****8b1c','orders, products','1 hour ago','<span class="status status-green">Active</span>']
        ])
      ),
      W.sec('API Documentation',
        W.tabs(['Authentication','Products','Orders','Wallet']),
        W.code('POST /api/v1/partner/orders\nHeaders:\n  X-API-Key: pk_live_****3f2a\n  X-API-Secret: sk_live_****\n  Content-Type: application/json'),
        W.code('{\n  "external_id": "EXT-12345",\n  "customer": { "name": "John Doe" },\n  "items": [{ "product_id": "prod_123", "quantity": 1 }]\n}'),
        W.codeR('{\n  "success": true,\n  "order": { "id": "ord_abc123", "status": "confirmed" }\n}')
      )
    )
  )
));

pages.push(W.page('Informational Pages', 'ℹ️', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','About','Contact','FAQ','Careers'], ['🔍','👤']),
  W.grid('grid-2',
    W.sec('About Us',
      W.card('','<div style="font-size:12px;font-weight:800;margin-bottom:6px;font-family:Poppins">About Sara Electronics</div><div style="font-size:7px;color:#64748B;line-height:1.6">Leading electronics retailer in India with 10+ years experience. Genuine products, best prices, excellent service.</div><div style="margin-top:6px"><span class="badge badge-green">✓ GST Registered</span> <span class="badge badge-blue">✓ Authorized Dealer</span></div>'),
      W.sec('Contact Us',
        W.card('','<div class="stat-row"><span class="label">📍 Address</span><span class="value">123, Electronics Market, Noida</span></div><div class="stat-row"><span class="label">📞 Phone</span><span class="value">+91 1800-123-4567</span></div><div class="stat-row"><span class="label">📧 Email</span><span class="value">support@saraelectronics.in</span></div><div class="stat-row"><span class="label">⏰ Hours</span><span class="value">Mon-Sat: 10AM - 8PM</span></div>')
      )
    ),
    W.sec('FAQ',
      W.accordion('How do I track my order?','Go to Dashboard → Orders → Track.'),
      W.accordion('What is the return policy?','7-day return policy. Electronics in original packaging.'),
      W.accordion('How do I use a coupon?','Enter code at checkout → Apply.'),
      W.accordion('Is EMI available?','Yes! No Cost EMI on select products.'),
      W.sec('Policies',
        W.grid('grid-2',
          W.card('card-orange','📜 Terms of Service'), W.card('card-orange','🔒 Privacy Policy'),
          W.card('card-blue','🚚 Shipping Policy'), W.card('card-blue','↩️ Return Policy'),
          W.card('card-green','🛡️ Warranty'), W.card('card-green','♻️ E-Waste Policy'),
          W.card('card-purple','📋 Grievance Officer'), W.card('card-purple','💼 Careers')
        )
      )
    )
  )
));

pages.push(W.page('Store Locator & Brand Pages', '📍', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Store Locator','Brands'], ['🔍','👤']),
  W.twoCol(
    W.sec('Store Locator',
      W.card('','<div style="background:#F1F5F9;height:100px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:8px">🗺️ Google Maps — 3 Store Locations</div>'),
      W.grid('grid-2',
        W.card('card-orange','<div style="font-size:7px"><strong>📍 Noida Flagship</strong><br>Sector 5, MG Road<br>Mon-Sat: 10AM - 9PM<br><span style="color:#059669">✓ Open Now</span></div>'),
        W.card('','<div style="font-size:7px"><strong>📍 Delhi Showroom</strong><br>Janpath, Connaught Place<br>Mon-Sat: 10AM - 8PM<br><span style="color:#059669">✓ Open Now</span></div>'),
        W.card('','<div style="font-size:7px"><strong>📍 Mumbai Store</strong><br>Linking Road, Bandra<br>Mon-Sun: 11AM - 9PM<br><span style="color:#059669">✓ Open Now</span></div>')
      )
    ),
    W.sec('Brand Landing Pages',
      W.grid('grid-2',
        W.card('card-orange','<div style="font-size:9px;font-weight:800">📱 Samsung</div><div style="font-size:6px;color:#64748B">45 products | Up to 36% OFF</div><div style="font-size:6px;color:#FF6B35;margin-top:2px">Shop Samsung →</div>'),
        W.card('card-blue','<div style="font-size:9px;font-weight:800">📺 LG</div><div style="font-size:6px;color:#64748B">32 products | Up to 30% OFF</div><div style="font-size:6px;color:#2A7FFF;margin-top:2px">Shop LG →</div>'),
        W.card('card-green','<div style="font-size:9px;font-weight:800">🎧 Boat</div><div style="font-size:6px;color:#64748B">28 products | Up to 70% OFF</div><div style="font-size:6px;color:#059669;margin-top:2px">Shop Boat →</div>'),
        W.card('card-purple','<div style="font-size:9px;font-weight:800">💻 HP</div><div style="font-size:6px;color:#64748B">38 products | Up to 28% OFF</div><div style="font-size:6px;color:#9333EA;margin-top:2px">Shop HP →</div>')
      )
    )
  )
));

pages.push(W.page('SEO & Security Features', '🔍🛡️', 'Technical',
  W.grid('grid-2',
    W.sec('SEO - JSON-LD Schemas',
      W.card('Organization',W.code('@type: Organization\nname: Sara Electronics\nurl: https://saraelectronics.in\ncontactPoint: +91-1800-123-4567')),
      W.card('WebSite',W.code('@type: WebSite\npotentialAction: SearchAction\ntarget: /products?q={search_term_string}')),
      W.card('Product',W.code('@type: Product\noffers: { price, currency, availability }\naggregateRating: { ratingValue, reviewCount }')),
      W.card('LocalBusiness',W.code('@type: LocalBusiness\naddress: { ... }\nopeningHours: Mo-Sa 10:00-20:00'))
    ),
    W.sec('SEO Configuration',
      W.card('Sitemap','<div style="font-size:7px"><div class="stat-row"><span class="label">URL</span><span class="value">/sitemap.xml</span></div><div class="stat-row"><span class="label">Products</span><span class="value">156 URLs</span></div><div class="stat-row"><span class="label">Categories</span><span class="value">24 URLs</span></div></div>'),
      W.card('Robots.txt',W.code('User-agent: *\nDisallow: /api/\nDisallow: /admin/\nSitemap: /sitemap.xml')),
      W.card('Meta Tags','<div style="font-size:7px"><div class="stat-row"><span class="label">Title</span><span class="value">Dynamic per page</span></div><div class="stat-row"><span class="label">Canonical</span><span class="value">Set on all pages</span></div><div class="stat-row"><span class="label">Open Graph</span><span class="value">Product + OG tags</span></div></div>')
    ),
    W.sec('Security',
      W.card('CSP Headers','<div style="font-size:6px"><div class="stat-row"><span class="label">default-src</span><span class="value">self</span></div><div class="stat-row"><span class="label">script-src</span><span class="value">self unsafe-eval</span></div><div class="stat-row"><span class="label">img-src</span><span class="value">* data: blob:</span></div></div>'),
      W.card('Rate Limiting','<div style="font-size:6px"><div class="stat-row"><span class="label">API</span><span class="value">100 req/min</span></div><div class="stat-row"><span class="label">Auth</span><span class="value">10 req/min</span></div><div class="stat-row"><span class="label">⚠️ Note</span><span class="value">Replace with Redis</span></div></div>'),
      W.card('Encryption','<div style="font-size:6px"><div class="stat-row"><span class="label">API Keys</span><span class="value">AES-256</span></div><div class="stat-row"><span class="label">Sessions</span><span class="value">HMAC-SHA256</span></div><div class="stat-row"><span class="label">Passwords</span><span class="value">bcrypt (cost 12)</span></div></div>'),
      W.card('Session','<div style="font-size:6px"><div class="stat-row"><span class="label">Token</span><span class="value">base64url(payload).hmac</span></div><div class="stat-row"><span class="label">Expiry</span><span class="value">24 hours</span></div><div class="stat-row"><span class="label">Cookie</span><span class="value">httpOnly, secure</span></div></div>')
    )
  )
));

pages.push(W.page('Complete Features Index', '📋', 'All Roles',
  W.kpiG(W.kpi('80+','Total Features','k-orange'), W.kpi('100+','Pages & Screens','k-green'), W.kpi('160+','API Endpoints','k-blue'), W.kpi('4','User Roles','k-purple')),
  W.grid('grid-2',
    W.sec('Storefront (20+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ Header (2-layer: blue top nav + white main)<br>✅ Category Circles (scrollable, 8+ categories)<br>✅ Hero Section (full-width, 16:5, gradient overlay)<br>✅ Trust Bar (4 badges: shipping/genuine/quality/secure)<br>✅ Deals of the Day (countdown timer)<br>✅ Category Showcase (gradient tiles)<br>✅ Offer Section (two-column promos)<br>✅ Top Brands (logo grid)<br>✅ Category Products (horizontal scroll carousels)<br>✅ Recently Viewed<br>✅ Footer (dark gradient, 4 columns, trust badges)<br>✅ Search with category selector<br>✅ Mega menu navigation<br>✅ Responsive mobile layout</div>')
    ),
    W.sec('Auth & Cart (12+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ Login (split-screen, blue gradient left)<br>✅ Signup with validation<br>✅ Forgot password (email reset)<br>✅ OTP verification<br>✅ Google OAuth<br>✅ Cart (items, quantity +/-, save for later)<br>✅ Order summary (sticky right column)<br>✅ Coupon application<br>✅ Multi-step checkout (2 steps)<br>✅ Payment (Razorpay: UPI/Cards/NetBanking)<br>✅ Order confirmation + tracking<br>✅ Breadcrumb navigation</div>')
    ),
    W.sec('Admin Panel (30+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ Sidebar (gray-800, maroon-700 active, 30+ items)<br>✅ Dashboard (KPIs, charts, recent orders)<br>✅ Products (CRUD, Excel upload, schema validation)<br>✅ Categories & Sub-categories<br>✅ Orders (list, detail, tracking, refunds)<br>✅ Users & Vendors<br>✅ Coupons & Email Campaigns (4-step wizard)<br>✅ Leads & Complaints (image upload)<br>✅ Home Builder (drag-drop, 12 components)<br>✅ Hero Slides & Advertisements<br>✅ Settings (general, payment, shipping, email)<br>✅ Integrations (Razorpay, Firebase, KGen, eXlr8)<br>✅ Blocked Pincodes (3 modes)<br>✅ Database Migration<br>✅ Spin Wheel & Lucky Draw<br>✅ Vendor Management & Payouts<br>✅ Partner API Management<br>✅ Security (CSP, rate limiting, bot detection)</div>')
    ),
    W.sec('Vendor, Software & Partner (16+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ Vendor Dashboard (blue-800 sidebar)<br>✅ Vendor Products & Orders<br>✅ Vendor Payouts<br>✅ Software Store (listing, detail, buy)<br>✅ License Management & Activation<br>✅ Spin the Wheel (admin + customer)<br>✅ Lucky Draw Campaigns<br>✅ Referral Program & Leaderboard<br>✅ Partner API Dashboard<br>✅ Partner API Keys & Rate Limiting<br>✅ Partner API Documentation<br>✅ Partner Wallet & Orders</div>')
    ),
    W.sec('Informational & SEO (14+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ About Us, Contact Us (form)<br>✅ FAQ (accordion)<br>✅ Terms, Privacy, Shipping, Return Policy<br>✅ Warranty, E-Waste, Grievance Officer<br>✅ Careers<br>✅ Store Locator (map, 3 stores)<br>✅ Brand Landing Pages (6+ brands)<br>✅ Sitemap.xml, Robots.txt<br>✅ JSON-LD (4 schemas: Org, WebSite, Product, LocalBusiness)<br>✅ Open Graph & Meta Tags<br>✅ Breadcrumbs (BreadcrumbJsonLd)<br>✅ Canonical URLs & Hreflang</div>')
    ),
    W.sec('Security (10+ features)',
      W.card('','<div style="font-size:6px;line-height:2">✅ CSP Headers (script-src, img-src, etc.)<br>✅ HSTS (production only)<br>✅ Rate Limiting (in-memory sliding window)<br>✅ Bot Detection (user-agent, IP blacklist)<br>✅ AES-256 Encryption (partner API keys)<br>✅ HMAC-SHA256 Session Tokens<br>✅ bcrypt Password Hashing (cost 12)<br>✅ Edge Runtime Safety (crypto.subtle)<br>✅ CSRF Protection<br>✅ Web Crypto API</div>')
    )
  ),
  W.footer()
));


const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1200"><title>Sara Electronics - Complete Wireframe Document</title><style>' + CSS + '</style></head><body>' + pages.join('\n') + '</body></html>';

(async () => {
  console.log('HTML size:', (html.length / 1024).toFixed(0), 'KB');
  console.log('Pages:', pageNum);
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\nabap\\AppData\\Local\\ms-playwright\\chromium-1200\\chrome-win64\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const pg = await browser.newPage();
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);
  const pdfPath = require('path').join(__dirname, 'Sara-Electronics-Wireframes.pdf');
  await pg.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  const stats = require('fs').statSync(pdfPath);
  console.log('PDF:', pdfPath);
  console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
})().catch(err => { console.error('Error:', err.message); process.exit(1); });
