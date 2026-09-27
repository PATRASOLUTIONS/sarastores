// ===== ADMIN PANEL PAGES =====

// PAGE: Admin Overview
pages.push(W.page('Admin Panel — Overview Dashboard', '⚙️', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '📂', label: 'Categories' },
      { icon: '🛒', label: 'Orders' },
      { icon: '👥', label: 'Users' },
      { icon: '🏪', label: 'Vendors', section: 'Sales' },
      { icon: '🤝', label: 'Partners' },
      { icon: '💰', label: 'Payouts' },
      { icon: '🎫', label: 'Coupons', section: 'Marketing' },
      { icon: '📧', label: 'Emails' },
      { icon: '📢', label: 'Leads' },
      { icon: '📋', label: 'Complaints' },
      { icon: '🎨', label: 'Home Builder', section: 'Content' },
      { icon: '🖼️', label: 'Hero Slides' },
      { icon: '📢', label: 'Advertisements' },
      { icon: '💬', label: 'Testimonials' },
      { icon: '🎮', label: 'Spin Wheel', section: 'Gamification' },
      { icon: '🎁', label: 'Lucky Draw' },
      { icon: '🔗', label: 'Integrations', section: 'System' },
      { icon: '📍', label: 'Blocked Pincodes' },
      { icon: '⚙️', label: 'Settings' },
      { icon: '🛡️', label: 'Security' },
      { icon: '📄', label: 'Docs' }
    ], 0),
    W.section('Admin Dashboard', '',
      W.kpiGrid(
        W.kpi('₹2,45,890', 'Revenue Today', 'accent'),
        W.kpi('1,284', 'Total Orders', 'green'),
        W.kpi('892', 'Active Users', 'blue'),
        W.kpi('45', 'Pending Orders', 'yellow')
      ),
      W.grid('grid-2',
        W.section('Revenue Chart', '',
          W.miniChart(8, 12, 6, 15, 10, 18, 14, 20, 16, 22, 19, 24),
          W.grid('grid-4 mt-4',
            W.card('', '<div style="font-size:6px;color:#64748b">Jan</div><div style="font-size:8px;font-weight:700">₹1.2L</div>'),
            W.card('', '<div style="font-size:6px;color:#64748b">Feb</div><div style="font-size:8px;font-weight:700">₹1.8L</div>'),
            W.card('', '<div style="font-size:6px;color:#64748b">Mar</div><div style="font-size:8px;font-weight:700">₹2.1L</div>'),
            W.card('', '<div style="font-size:6px;color:#64748b">Apr</div><div style="font-size:8px;font-weight:700">₹2.5L</div>')
          )
        ),
        W.section('Top Products', '',
          W.card('', '<div class="stat-row"><span class="label">Samsung 55" TV</span><span class="value">₹34,990 × 12</span></div><div class="stat-row"><span class="label">Boat Airdopes</span><span class="value">₹1,299 × 45</span></div><div class="stat-row"><span class="label">HP Laptop</span><span class="value">₹49,990 × 8</span></div><div class="stat-row"><span class="label">LG Washing Machine</span><span class="value">₹29,990 × 6</span></div><div class="stat-row"><span class="label">Sony Speaker</span><span class="value">₹3,999 × 18</span></div>')
        )
      ),
      W.section('Recent Orders', '',
        W.table(['Order ID', 'Customer', 'Amount', 'Status', 'Date', 'Action'], [
          ['#SARA-4521', 'Rahul Kumar', '₹39,088', '<span class="status status-processing">Processing</span>', 'Jun 19', '<span class="btn btn-outline btn-sm">View</span>'],
          ['#SARA-4518', 'Priya Singh', '₹1,299', '<span class="status status-shipped">Shipped</span>', 'Jun 19', '<span class="btn btn-outline btn-sm">View</span>'],
          ['#SARA-4515', 'Amit Patel', '₹49,990', '<span class="status status-delivered">Delivered</span>', 'Jun 18', '<span class="btn btn-outline btn-sm">View</span>'],
          ['#SARA-4512', 'Neha Gupta', '₹29,990', '<span class="status status-pending">Pending</span>', 'Jun 18', '<span class="btn btn-outline btn-sm">View</span>']
        ])
      )
    )
  )
));

// PAGE: Admin Products
pages.push(W.page('Admin Panel — Product Management', '📦', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '📂', label: 'Categories' },
      { icon: '🛒', label: 'Orders' },
      { icon: '👥', label: 'Users' }
    ], 1),
    W.section('Products', '',
      W.toolbar('Product Management', W.btn('+ Add Product', 'btn-primary'), W.btn('📥 Excel Upload', 'btn-success'), W.btn('📤 Export', 'btn-outline')),
      W.filterBar('All (156)', 'Active (120)', 'Draft (20)', 'Inactive (16)'),
      W.table(['Product', 'SKU', 'Price', 'Stock', 'Category', 'Status', 'Actions'], [
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px">📺</div><span style="font-weight:600">Samsung 55" TV</span></div>', 'SAM-55-CU7700', '₹34,990', '45', 'TVs', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px">🎧</div><span style="font-weight:600">Boat Airdopes 141</span></div>', 'BOAT-AP-141', '₹1,299', '230', 'Audio', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px">💻</div><span style="font-weight:600">HP Pavilion 15</span></div>', 'HP-PAV-15-R5', '₹49,990', '12', 'Laptops', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:24px;height:24px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px">🌀</div><span style="font-weight:600">LG 8kg Front Load</span></div>', 'LG-WM-8FL', '₹29,990', '8', 'Appliances', '<span class="status status-low">Low Stock</span>', '<span class="btn btn-outline btn-sm">Edit</span>']
      ]),
      W.flex('flex-center gap-4 mt-8', W.btn('← Prev', 'btn-outline btn-sm'), W.btn('1', 'btn-primary btn-sm'), W.btn('2', 'btn-outline btn-sm'), W.btn('Next →', 'btn-outline btn-sm'))
    )
  )
));

// PAGE: Admin Product Form
pages.push(W.page('Admin Panel — Add/Edit Product', '📦', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '📂', label: 'Categories' }
    ], 1),
    W.section('Add Product', '',
      W.tabs(['Basic Info', 'Pricing', 'Media', 'SEO', 'Specifications', 'Variants']),
      W.formRow(W.formGroup('Product Name', 'text', 'Samsung 55" Crystal UHD 4K Smart TV'), W.formGroup('SKU', 'text', 'SAM-55-CU7700')),
      W.formRow(W.formGroup('Category', 'text', 'Televisions'), W.formGroup('Sub Category', 'text', 'Smart TV')),
      W.formRow(W.formGroup('Brand', 'text', 'Samsung'), W.formGroup('Vendor', 'text', 'Samsung India')),
      W.formGroup('Description', 'textarea', 'Product description...'),
      W.card('card-blue', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📐 Product Schema Validation</div><div style="font-size:6px">Required: name, sku, price, category, brand, stock</div><div style="font-size:6px">Optional: gtin, mpn, specifications, variants</div>'),
      W.section('Pricing', '',
        W.formRow(W.formGroup('Selling Price (₹)', 'number', '34990'), W.formGroup('MRP (₹)', 'number', '54990')),
        W.formRow(W.formGroup('Cost Price (₹)', 'number', '28000'), W.formGroup('Tax (%)', 'number', '18')),
        W.formRow(W.formGroup('Discount (%)', 'number', '36'), W.formGroup('Commission (%)', 'number', '5'))
      ),
      W.section('Stock & Shipping', '',
        W.formRow(W.formGroup('Stock Quantity', 'number', '45'), W.formGroup('Low Stock Threshold', 'number', '10')),
        W.formRow(W.formGroup('Weight (kg)', 'number', '12'), W.formGroup('Dimensions (L×W×H)', 'text', '123×78×8 cm')),
        W.formGroup('Barcode / GTIN', 'text', '1234567890123')
      ),
      W.flex('gap-4 mt-8', W.btn('Save Product', 'btn-primary'), W.btn('Save as Draft', 'btn-outline'), W.btn('Cancel', 'btn-outline'))
    )
  )
));

// PAGE: Admin Categories
pages.push(W.page('Admin Panel — Categories & Subcategories', '📂', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '📂', label: 'Categories' },
      { icon: '🛒', label: 'Orders' }
    ], 2),
    W.section('Categories', '',
      W.toolbar('Category Management', W.btn('+ Add Category', 'btn-primary')),
      W.table(['Category', 'Slug', 'Products', 'Subcategories', 'Status', 'Actions'], [
        ['📺 Televisions', 'televisions', '45', '6', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['❄️ Refrigerators', 'refrigerators', '32', '4', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['🌀 Washing Machines', 'washing-machines', '28', '3', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['❄️ Air Conditioners', 'air-conditioners', '24', '4', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['💻 Laptops', 'laptops', '38', '5', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>'],
        ['📱 Mobiles', 'mobiles', '52', '6', '<span class="status status-active">Active</span>', '<span class="btn btn-outline btn-sm">Edit</span>']
      ]),
      W.section('Subcategory Mapping', '',
        W.card('TVs Subcategories', '<div style="font-size:6px;display:flex;flex-wrap:wrap;gap:4px"><span class="badge badge-gray">Smart TV (20)</span><span class="badge badge-gray">LED TV (8)</span><span class="badge badge-gray">OLED TV (6)</span><span class="badge badge-gray">QLED TV (5)</span><span class="badge badge-gray">4K TV (4)</span><span class="badge badge-gray">8K TV (2)</span></div>')
      )
    )
  )
));

// PAGE: Admin Orders
pages.push(W.page('Admin Panel — Order Management', '🛒', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '🛒', label: 'Orders' },
      { icon: '👥', label: 'Users' }
    ], 2),
    W.section('Orders', '',
      W.toolbar('Order Management', W.btn('📥 Export', 'btn-outline'), W.btn('🔄 Refresh', 'btn-outline')),
      W.kpiGrid(
        W.kpi('1,284', 'Total Orders', 'accent'),
        W.kpi('45', 'Pending', 'yellow'),
        W.kpi('128', 'Processing', 'blue'),
        W.kpi('1,089', 'Delivered', 'green')
      ),
      W.filterBar('All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'),
      W.table(['Order ID', 'Customer', 'Items', 'Amount', 'Payment', 'Status', 'Date', 'Action'], [
        ['#SARA-4521', 'Rahul K.', '2', '₹39,088', 'UPI', '<span class="status status-processing">Processing</span>', 'Jun 19', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4518', 'Priya S.', '1', '₹1,299', 'Card', '<span class="status status-shipped">Shipped</span>', 'Jun 19', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4515', 'Amit P.', '1', '₹49,990', 'Net Banking', '<span class="status status-delivered">Delivered</span>', 'Jun 18', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4512', 'Neha G.', '1', '₹29,990', 'UPI', '<span class="status status-pending">Pending</span>', 'Jun 18', '<span class="btn btn-outline btn-sm">View</span>']
      ])
    )
  )
));

// PAGE: Admin Users & Vendors
pages.push(W.page('Admin Panel — Users & Vendor Management', '👥', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '🛒', label: 'Orders' },
      { icon: '👥', label: 'Users' },
      { icon: '🏪', label: 'Vendors' },
      { icon: '🤝', label: 'Partners' }
    ], 3),
    W.section('Users', '',
      W.toolbar('User Management', W.btn('📥 Export', 'btn-outline')),
      W.table(['User', 'Email', 'Role', 'Orders', 'Spent', 'Joined', 'Status'], [
        [W.flex('gap-4', W.avatar('RK', 'avatar-sm'), '<span style="font-weight:600">Rahul Kumar</span>'), 'rahul@email.com', W.badge('Customer', 'badge-blue'), '12', '₹1,89,450', 'Jan 2026', '<span class="status status-active">Active</span>'],
        [W.flex('gap-4', W.avatar('PS', 'avatar-sm'), '<span style="font-weight:600">Priya Singh</span>'), 'priya@email.com', W.badge('Customer', 'badge-blue'), '8', '₹89,990', 'Feb 2026', '<span class="status status-active">Active</span>'],
        [W.flex('gap-4', W.avatar('VM', 'avatar-sm'), '<span style="font-weight:600">Vendor Mahesh</span>'), 'mahesh@vendor.com', W.badge('Vendor', 'badge-green'), '—', '—', 'Dec 2025', '<span class="status status-active">Active</span>']
      ]),
      W.section('Vendors', '',
        W.table(['Vendor', 'Email', 'Products', 'Orders', 'Revenue', 'Commission', 'Status'], [
          [W.flex('gap-4', W.avatar('VM', 'avatar-sm'), '<span style="font-weight:600">Vendor Mahesh</span>'), 'mahesh@vendor.com', '45', '234', '₹5,67,890', '5%', '<span class="status status-active">Active</span>'],
          [W.flex('gap-4', W.avatar('RS', 'avatar-sm'), '<span style="font-weight:600">Ravi Sales</span>'), 'ravi@vendor.com', '32', '189', '₹3,45,670', '5%', '<span class="status status-active">Active</span>']
        ]),
        W.section('Vendor Payouts', '',
          W.table(['Vendor', 'Period', 'Sales', 'Commission', 'Payout', 'Status'], [
            ['Vendor Mahesh', 'Jun 1-15', '₹2,34,560', '₹11,728', '₹11,728', '<span class="status status-pending">Pending</span>'],
            ['Ravi Sales', 'Jun 1-15', '₹1,23,450', '₹6,173', '₹6,173', '<span class="status status-active">Paid</span>']
          ])
        )
      )
    )
  )
));

// PAGE: Admin Coupons & Marketing
pages.push(W.page('Admin Panel — Coupons & Email Campaigns', '🎫', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '🎫', label: 'Coupons', section: 'Marketing' },
      { icon: '📧', label: 'Emails' },
      { icon: '📢', label: 'Leads' },
      { icon: '📋', label: 'Complaints' }
    ], 0),
    W.section('Coupons', '',
      W.toolbar('Coupon Management', W.btn('+ Create Coupon', 'btn-primary')),
      W.table(['Code', 'Type', 'Value', 'Min Order', 'Uses', 'Limit', 'Expiry', 'Status'], [
        ['MEGA60', 'Percentage', '60%', '₹1,999', '456', '1000', 'Jun 30', '<span class="status status-active">Active</span>'],
        ['FLAT500', 'Fixed', '₹500', '₹4,999', '234', '500', 'Jul 15', '<span class="status status-active">Active</span>'],
        ['WELCOME10', 'Percentage', '10%', '₹999', '1,234', 'Unlimited', 'Dec 31', '<span class="status status-active">Active</span>'],
        ['SUMMER25', 'Percentage', '25%', '₹2,999', '89', '200', 'May 31', '<span class="status status-cancelled">Expired</span>']
      ]),
      W.section('Email Campaigns', '',
        W.card('Campaign Builder — 4-Step Wizard', '<div style="margin:6px 0">' + W.steps(['Audience', 'Template', 'Content', 'Schedule'], 2) + '</div><div style="margin-top:8px"><div class="stat-row"><span class="label">Campaign Name</span><span class="value">Summer Sale Blast</span></div><div class="stat-row"><span class="label">Audience</span><span class="value">All Active Users (892)</span></div><div class="stat-row"><span class="label">Template</span><span class="value">Promotional — Sale</span></div><div class="stat-row"><span class="label">Subject</span><span class="value">🔥 MEGA SALE — Up to 60% OFF!</span></div><div class="stat-row"><span class="label">Schedule</span><span class="value">Jun 20, 10:00 AM</span></div></div>'),
        W.card('card-green', '<div style="font-size:7px;font-weight:600">📧 Email Stats</div><div style="font-size:6px;margin-top:4px">Sent: 2,456 | Opened: 1,234 (50.2%) | Clicked: 567 (23.1%) | Converted: 89 (3.6%)</div>')
      )
    )
  )
));

// PAGE: Admin Leads & Complaints
pages.push(W.page('Admin Panel — Leads & Complaint Management', '📢', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📢', label: 'Leads' },
      { icon: '📋', label: 'Complaints' },
      { icon: '🔔', label: 'Notifications' }
    ], 0),
    W.section('Leads', '',
      W.toolbar('Lead Management', W.btn('📥 Import', 'btn-outline'), W.btn('📤 Export', 'btn-outline')),
      W.table(['Name', 'Email', 'Phone', 'Source', 'Status', 'Assigned To', 'Date'], [
        ['Rahul K.', 'rahul@email.com', '+91 98765', 'Website', '<span class="status status-new">New</span>', '—', 'Jun 19'],
        ['Priya S.', 'priya@email.com', '+91 87654', 'WhatsApp', '<span class="status status-contacted">Contacted</span>', 'Ravi', 'Jun 18'],
        ['Amit P.', 'amit@email.com', '+91 76543', 'Phone', '<span class="status status-qualified">Qualified</span>', 'Priya', 'Jun 17']
      ]),
      W.section('Complaints', '',
        W.table(['ID', 'Customer', 'Subject', 'Priority', 'Status', 'Assigned', 'Date'], [
          ['#C-001', 'Rahul K.', 'Wrong item delivered', '<span class="status status-high">High</span>', '<span class="status status-pending">Open</span>', 'Support Team', 'Jun 19'],
          ['#C-002', 'Priya S.', 'Damaged product', '<span class="status status-medium">Medium</span>', '<span class="status status-processing">In Progress</span>', 'Ravi', 'Jun 18'],
          ['#C-003', 'Amit P.', 'Refund not received', '<span class="status status-high">High</span>', '<span class="status status-resolved">Resolved</span>', 'Priya', 'Jun 15']
        ]),
        W.card('Complaint Detail', '<div style="font-size:7px"><strong>#C-001 — Wrong item delivered</strong><br>Customer: Rahul Kumar<br>Order: #SARA-4498<br>Subject: Received wrong color TV<br>Images: 📷 3 attached<br>Resolution: Replacement scheduled for Jun 21</div>')
      )
    )
  )
));
