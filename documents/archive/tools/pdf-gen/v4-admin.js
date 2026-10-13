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
