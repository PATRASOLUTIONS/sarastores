let pageNum = 0;
function W() {}
W.page = (title, icon, role, ...content) => {
  pageNum++;
  return `<div class="page"><div class="page-header"><span class="icon">${icon}</span><h2>${title}</h2>${role ? `<span class="role">${role}</span>` : ''}</div>${content.join('')}<div class="page-number">${pageNum}</div></div>`;
};
W.cover = (title, subtitle, meta) => `<div class="cover"><div class="logo-text">SARA ELECTRONICS</div><h1>${title}</h1><h2>${subtitle}</h2><div class="meta">${meta}</div></div>`;
W.section = (title, icon, ...content) => `<div class="section"><div class="section-title">${icon ? icon + ' ' : ''}${title}</div>${content.join('')}</div>`;
W.grid = (cls, ...items) => `<div class="grid ${cls}">${items.join('')}</div>`;
W.card = (title, desc, cls = '') => `<div class="card ${cls}"><h4>${title}</h4><p>${desc}</p></div>`;
W.cardIcon = (icon, title, desc, cls = '') => `<div class="card ${cls}"><div style="font-size:14px;margin-bottom:4px">${icon}</div><h4>${title}</h4><p>${desc}</p></div>`;
W.badge = (text, cls = 'badge-gray') => `<span class="badge ${cls}">${text}</span>`;
W.btn = (text, cls = 'btn-primary', size = '') => `<span class="btn ${cls} ${size}">${text}</span>`;
W.kpi = (value, label, cls = '') => `<div class="kpi ${cls}"><div class="value">${value}</div><div class="label">${label}</div></div>`;
W.kpiGrid = (...items) => `<div class="kpi-grid">${items.join('')}</div>`;
W.table = (headers, rows) => {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
};
W.sidebar = (items, active = 0) => {
  const html = items.map((item, i) => {
    if (item.section) return `<div class="sidebar-section">${item.section}</div>`;
    return `<div class="sidebar-item ${i === active ? 'active' : ''}">${item.icon || ''} ${item.label}</div>`;
  }).join('');
  return `<div class="sidebar">${html}</div>`;
};
W.topbar = (logo, navItems, rightItems) => {
  const nav = navItems.map(n => `<span class="nav-item">${n}</span>`).join('');
  const right = (rightItems || []).map(r => `<span>${r}</span>`).join('');
  return `<div class="topbar"><span class="logo">${logo}</span><span class="search">Search products, orders, customers...</span>${nav}<div class="icons">${right}</div></div>`;
};
W.product = (name, price, oldPrice, rating, img = '📦') => `<div class="product-card"><div class="img">${img}</div><div class="info"><div class="name">${name}</div><div><span class="price">${price}</span>${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ''}</div><div class="rating">${'★'.repeat(Math.floor(rating || 4))}${'☆'.repeat(5 - Math.floor(rating || 4))} <span style="color:#94a3b8">(${rating || 4.0})</span></div><div class="btn-add">Add to Cart</div></div></div>`;
W.alert = (text, type = 'info') => `<div class="alert alert-${type}">${text}</div>`;
W.formGroup = (label, inputType = 'text', placeholder = '') => `<div class="form-group"><label>${label}</label><input class="form-input" type="${inputType}" placeholder="${placeholder || label}"></div>`;
W.formRow = (...fields) => `<div class="form-row">${fields.join('')}</div>`;
W.tabs = (items, active = 0) => `<div class="tabs">${items.map((t, i) => `<span class="tab ${i === active ? 'active' : ''}">${t}</span>`).join('')}</div>`;
W.toolbar = (title, ...btns) => `<div class="toolbar"><span class="title">${title}</span><div style="margin-left:auto;display:flex;gap:4px">${btns.join('')}</div></div>`;
W.steps = (items, active = 0) => `<div class="steps">${items.map((s, i) => `<div class="step ${i < active ? 'done' : ''} ${i === active ? 'active' : ''}"><span class="circle">${i < active ? '✓' : i + 1}</span><div class="step-label">${s}</div></div>`).join('')}</div>`;
W.progress = (pct, cls = 'fill-red') => `<div class="progress-bar"><div class="fill ${cls}" style="width:${pct}%"></div></div>`;
W.twoCol = (left, right) => `<div class="two-col"><div>${left}</div><div>${right}</div></div>`;
W.threeCol = (...cols) => `<div class="three-col">${cols.join('')}</div>`;
W.list = (...items) => items.map(i => `<div class="list-item">${i}</div>`).join('');
W.breadcrumb = (...items) => `<div class="breadcrumb">${items.map((b, i) => i < items.length - 1 ? `${b} › ` : `<span>${b}</span>`).join('')}</div>`;
W.miniChart = (...heights) => `<div class="mini-chart">${heights.map(h => `<div class="bar" style="height:${h}px"></div>`).join('')}</div>`;
W.toast = (text, type = 'success') => `<div class="toast toast-${type}">${text}</div>`;
W.code = (text) => `<div class="code-block">${text}</div>`;
W.codeResp = (text) => `<div class="code-response">${text}</div>`;
W.donut = () => `<div class="donut"></div>`;
W.accordion = (title, content) => `<div class="accordion"><div class="accordion-header"><span>${title}</span><span>▼</span></div><div class="accordion-body">${content}</div></div>`;
W.timeline = (...items) => `<div class="timeline">${items.map(i => `<div class="timeline-item"><div class="time">${i.time}</div><div class="event">${i.event}</div></div>`).join('')}</div>`;
W.emptyState = (icon, text) => `<div class="empty-state"><div class="icon">${icon}</div><p>${text}</p></div>`;
W.statRow = (label, value) => `<div class="stat-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
W.avatar = (initials, cls = '') => `<div class="avatar ${cls}">${initials}</div>`;
W.toggle = (on = false) => `<div class="toggle ${on ? 'on' : ''}"></div>`;
W.flex = (cls, ...items) => `<div class="flex ${cls}">${items.join('')}</div>`;
W.tracking = (...steps) => {
  const active = steps.length > 3 ? 3 : Math.floor(steps.length / 2);
  return '<div class="steps">' + steps.map((s, i) => `<div class="step ${i < active ? 'done' : ''} ${i === active ? 'active' : ''}"><span class="circle">${i < active ? '✓' : i + 1}</span><div class="step-label">${s}</div></div>`).join('') + '</div>';
};
W.saleBanner = () => `<div class="sale-banner">🔥 MEGA SALE — Up to 60% OFF on Electronics! Free Delivery on orders above ₹999</div>`;
W.filterBar = (...filters) => `<div class="filter-bar">${filters.map((f, i) => `<span class="filter ${i === 0 ? 'active' : ''}">${f}</span>`).join('')}</div>`;
W.modal = (title, ...content) => `<div class="modal-overlay"><div class="modal"><h3>${title}</h3>${content.join('')}</div></div>`;
W.footer = () => `<div class="footer-bar"><span>Sara Electronics © 2026</span><span>Confidential — Internal Use Only</span><span>Sara Electronics Wireframe Document v3.0</span></div>`;
W.pageBreak = () => `<div style="page-break-after:always"></div>`;
