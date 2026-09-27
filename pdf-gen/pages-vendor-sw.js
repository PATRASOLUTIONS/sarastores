// ===== VENDOR, SOFTWARE STORE, GAMIFICATION, PARTNER API =====

// PAGE: Vendor Dashboard
pages.push(W.page('Vendor Dashboard', '🏪', 'Vendor',
  W.topbar('SARA ELECTRONICS (Vendor)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'Products' },
      { icon: '🛒', label: 'Orders' },
      { icon: '💰', label: 'Payouts' },
      { icon: '📈', label: 'Analytics' },
      { icon: '⚙️', label: 'Settings' }
    ], 0),
    W.section('Vendor Overview', '',
      W.kpiGrid(
        W.kpi('₹2,34,560', 'Revenue (Jun)', 'accent'),
        W.kpi('45', 'Products', 'green'),
        W.kpi('234', 'Orders', 'blue'),
        W.kpi('4.5', 'Avg Rating', 'yellow')
      ),
      W.grid('grid-2',
        W.section('Sales Chart', '',
          W.miniChart(6, 10, 8, 14, 12, 16, 15, 18, 14, 20, 17, 22),
          W.card('card-green mt-4', '<div style="font-size:7px">📈 Revenue up 23% compared to last month</div>')
        ),
        W.section('Recent Orders', '',
          W.table(['Order', 'Amount', 'Status', 'Date'], [
            ['#V-4521', '₹34,990', '<span class="status status-processing">Processing</span>', 'Jun 19'],
            ['#V-4518', '₹1,299', '<span class="status status-shipped">Shipped</span>', 'Jun 19'],
            ['#V-4515', '₹29,990', '<span class="status status-delivered">Delivered</span>', 'Jun 18']
          ])
        )
      ),
      W.section('Vendor Payouts', '',
        W.table(['Period', 'Sales', 'Commission (5%)', 'Net Payout', 'Status'], [
          ['Jun 1-15', '₹2,34,560', '₹11,728', '₹2,22,832', '<span class="status status-pending">Pending</span>'],
          ['May 16-31', '₹1,89,450', '₹9,473', '₹1,79,977', '<span class="status status-active">Paid</span>'],
          ['May 1-15', '₹1,56,780', '₹7,839', '₹1,48,941', '<span class="status status-active">Paid</span>']
        ])
      )
    )
  )
));

// PAGE: Vendor Products & Orders
pages.push(W.page('Vendor Dashboard — Products & Orders', '📦', 'Vendor',
  W.topbar('SARA ELECTRONICS (Vendor)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview' },
      { icon: '📦', label: 'Products' },
      { icon: '🛒', label: 'Orders' },
      { icon: '💰', label: 'Payouts' }
    ], 1),
    W.section('My Products', '',
      W.toolbar('Products', W.btn('+ Add Product', 'btn-primary')),
      W.table(['Product', 'SKU', 'Price', 'Stock', 'Sales', 'Status'], [
        ['Samsung 55" TV', 'SAM-55-001', '₹34,990', '45', '12', '<span class="status status-active">Active</span>'],
        ['Boat Airdopes', 'BOAT-AP-01', '₹1,299', '230', '45', '<span class="status status-active">Active</span>'],
        ['HP Laptop', 'HP-PAV-01', '₹49,990', '12', '8', '<span class="status status-low">Low Stock</span>']
      ]),
      W.section('My Orders', '',
        W.filterBar('All', 'New', 'Processing', 'Shipped', 'Delivered'),
        W.table(['Order ID', 'Customer', 'Product', 'Amount', 'Status', 'Action'], [
          ['#V-4521', 'Rahul K.', 'Samsung TV', '₹34,990', '<span class="status status-processing">Processing</span>', '<span class="btn btn-primary btn-sm">Ship</span>'],
          ['#V-4518', 'Priya S.', 'Boat Airdopes', '₹1,299', '<span class="status status-shipped">Shipped</span>', '<span class="btn btn-outline btn-sm">Track</span>'],
          ['#V-4515', 'Amit P.', 'HP Laptop', '₹49,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">View</span>']
        ])
      )
    )
  )
));

// PAGE: Software Store — Home
pages.push(W.page('Software Store — Product Listing', '💻', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'Software', 'Licenses', 'Support'], ['🔍', '🛒', '👤']),
  W.section('Software Store Header', '',
    W.card('card-dark', '<div style="text-align:center;padding:12px"><div style="font-size:14px;font-weight:800">💻 Software Store</div><div style="font-size:8px;opacity:.7;margin-top:4px">Genuine software licenses at the best prices</div></div>')
  ),
  W.filterBar('All Software', 'Operating Systems', 'Office Suites', 'Antivirus', 'Design Tools', 'Development'),
  W.grid('grid-4',
    W.card('', '<div style="background:#eff6ff;height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#3b82f6">🪟</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Windows 11 Pro</div><div style="font-size:6px;color:#64748b">Microsoft | Digital License</div><div style="font-size:8px;font-weight:700;color:#e94560;margin-top:2px">₹8,999</div><div style="font-size:6px;color:#94a3b8;text-decoration:line-through">₹12,999</div><div class="btn-add">Buy Now</div></div>'),
    W.card('', '<div style="background:#fef2f2;height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#e94560">📄</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Microsoft Office 2024</div><div style="font-size:6px;color:#64748b">Microsoft | Lifetime License</div><div style="font-size:8px;font-weight:700;color:#e94560;margin-top:2px">₹5,999</div><div style="font-size:6px;color:#94a3b8;text-decoration:line-through">₹8,999</div><div class="btn-add">Buy Now</div></div>'),
    W.card('', '<div style="background:#f0fdf4;height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#22c55e">🛡️</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Norton 360 Deluxe</div><div style="font-size:6px;color:#64748b">Norton | 1 Year, 5 Devices</div><div style="font-size:8px;font-weight:700;color:#e94560;margin-top:2px">₹1,999</div><div style="font-size:6px;color:#94a3b8;text-decoration:line-through">₹3,499</div><div class="btn-add">Buy Now</div></div>'),
    W.card('', '<div style="background:#faf5ff;height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#a855f7">🎨</div><div style="padding:6px"><div style="font-size:7px;font-weight:600">Adobe Creative Cloud</div><div style="font-size:6px;color:#64748b">Adobe | 1 Year, All Apps</div><div style="font-size:8px;font-weight:700;color:#e94560;margin-top:2px">₹16,999</div><div style="font-size:6px;color:#94a3b8;text-decoration:line-through">₹29,999</div><div class="btn-add">Buy Now</div></div>')
  )
));

// PAGE: Software Store — Product Detail & Licenses
pages.push(W.page('Software Store — Product Detail & Licenses', '💻', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', ['Home', 'Software', 'Licenses', 'Support'], ['🔍', '🛒', '👤']),
  W.breadcrumb('Software', 'Windows 11 Pro'),
  W.twoCol(
    W.section('Software Detail', '',
      W.card('', '<div style="background:#eff6ff;height:100px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#3b82f6">🪟</div>'),
      W.card('', '<div style="font-size:12px;font-weight:800">Windows 11 Pro — Digital License</div><div style="font-size:7px;color:#64748b;margin-top:2px">Microsoft Corporation | Instant Delivery</div><div style="margin-top:4px"><span style="font-size:14px;font-weight:800;color:#e94560">₹8,999</span><span style="font-size:8px;color:#94a3b8;text-decoration:line-through;margin-left:4px">₹12,999</span><span class="badge badge-green" style="margin-left:4px">31% OFF</span></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📋 What\'s Included</div><div style="font-size:6px;color:#64748b">✓ Genuine digital license key<br>✓ Lifetime activation<br>✓ All Windows 11 Pro features<br>✓ Microsoft support<br>✓ Free updates</div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">💳 Purchase Options</div><div style="display:flex;gap:4px;margin-top:4px"><span class="btn btn-primary">Buy Now — ₹8,999</span><span class="btn btn-outline">Add to Cart</span></div><div style="font-size:6px;color:#64748b;margin-top:4px">EMI starts at ₹450/month | UPI, Cards, Net Banking</div>')
    ),
    W.section('My Licenses', '',
      W.tabs(['Active', 'Expired', 'All']),
      W.table(['Software', 'Key', 'Activated', 'Expires', 'Devices', 'Status'], [
        ['Windows 11 Pro', 'XXXXX-XXXXX-XXXXX-XXXXX', 'Jun 15', 'Lifetime', '1/1', '<span class="status status-active">Active</span>'],
        ['Office 2024', 'XXXXX-XXXXX-XXXXX-XXXXX', 'Jun 10', 'Lifetime', '1/1', '<span class="status status-active">Active</span>'],
        ['Norton 360', 'XXXXX-XXXXX-XXXXX-XXXXX', 'May 1', 'May 1, 2027', '3/5', '<span class="status status-active">Active</span>']
      ]),
      W.section('License Activation', '',
        W.card('card-blue', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔑 Activate Software</div><div style="font-size:6px;color:#64748b;margin-bottom:4px">Enter your license key to activate</div><div style="display:flex;gap:4px"><input class="form-input" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"><span class="btn btn-primary btn-sm">Activate</span></div>')
      ),
      W.section('Software Documentation', '',
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📖 Installation Guide</div><div style="font-size:6px;color:#64748b">Step-by-step instructions for Windows 11 Pro installation and activation.</div><div style="margin-top:4px"><span class="btn btn-outline btn-sm">View Guide</span> <span class="btn btn-outline btn-sm">Download</span></div>')
      )
    )
  )
));

// PAGE: Spin the Wheel
pages.push(W.page('Spin the Wheel - Gamification', '🎰', 'Admin / All Visitors',
  W.twoCol(
    W.section('Spin Wheel Admin', '',
      W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
      W.toolbar('Spin Wheel Configuration', W.btn('Edit Prizes', 'btn-primary')),
      W.grid('grid-2',
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🎰 Wheel Configuration</div><div style="font-size:6px"><div class="stat-row"><span class="label">Total Spins (Today)</span><span class="value">234</span></div><div class="stat-row"><span class="label">Winners (Today)</span><span class="value">12</span></div><div class="stat-row"><span class="label">Prizes Awarded</span><span class="value">₹5,670</span></div><div class="stat-row"><span class="label">Spin Limit/User</span><span class="value">3/day</span></div></div>'),
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🎁 Prize Distribution</div><div style="font-size:6px"><div class="stat-row"><span class="label">₹500 Coupon</span><span class="value">5% chance</span></div><div class="stat-row"><span class="label">₹200 Coupon</span><span class="value">10% chance</span></div><div class="stat-row"><span class="label">₹100 Coupon</span><span class="value">15% chance</span></div><div class="stat-row"><span class="label">Free Shipping</span><span class="value">20% chance</span></div><div class="stat-row"><span class="label">Better Luck Next</span><span class="value">50% chance</span></div></div>')
      ),
      W.table(['User', 'Prize', 'Coupon Code', 'Date', 'Status'], [
        ['Rahul K.', '₹500 Coupon', 'SPIN-500-ABCD', 'Jun 19', '<span class="status status-active">Claimed</span>'],
        ['Priya S.', 'Free Shipping', 'SHIP-FREE-EFGH', 'Jun 19', '<span class="status status-active">Claimed</span>'],
        ['Amit P.', '₹200 Coupon', 'SPIN-200-IJKL', 'Jun 18', '<span class="status status-pending">Pending</span>']
      ])
    ),
    W.section('Spin Wheel - Customer View', '',
      W.card('card-dark', '<div style="text-align:center;padding:16px"><div style="font-size:14px;font-weight:800;color:white">🎰 Spin &amp; Win!</div><div style="font-size:7px;color:#94a3b8;margin-top:4px">Spin the wheel to win exciting prizes</div><div style="margin:12px auto;width:120px;height:120px;border-radius:50%;background:conic-gradient(#e94560 0% 14%,#f97316 14% 28%,#f59e0b 28% 42%,#22c55e 42% 56%,#3b82f6 56% 70%,#a855f7 70% 84%,#94a3b8 84% 100%);display:flex;align-items:center;justify-content:center"><div style="width:60px;height:60px;border-radius:50%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">SPIN</div></div><div style="margin-top:8px;font-size:7px;color:#94a3b8">Spins remaining: 2/3</div><span class="btn btn-primary mt-4">🎰 SPIN NOW</span></div>')
    )
  )
));

// PAGE: Lucky Draw & Referral
pages.push(W.page('Lucky Draw & Referral Program', '🎁', 'Admin / Authenticated Users',
  W.twoCol(
    // ADMIN: Lucky Draw
    W.section('Lucky Draw Admin', '',
      W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
      W.toolbar('Lucky Draw Campaigns', W.btn('+ New Campaign', 'btn-primary')),
      W.table(['Campaign', 'Prize', 'Entries', 'Draw Date', 'Status'], [
        ['Summer Mega Draw', 'iPhone 15', '1,234', 'Jun 30', '<span class="status status-active">Active</span>'],
        ['Festival Special', 'Samsung TV', '2,345', 'Oct 15', '<span class="status status-draft">Draft</span>'],
        ['New Year Giveaway', '₹10,000 Voucher', '—', 'Dec 31', '<span class="status status-draft">Draft</span>']
      ]),
      W.section('Lucky Draw Winner', '',
        W.card('card-green', '<div style="text-align:center;padding:10px"><div style="font-size:20px">🎉</div><div style="font-size:10px;font-weight:700;margin-top:4px">Winner: Rahul Kumar</div><div style="font-size:7px;color:#64748b">Prize: iPhone 15 | Draw: Jun 15, 2026</div><div style="font-size:6px;color:#22c55e;margin-top:2px">✓ Prize delivered | ✓ Winner notified via WhatsApp + Email</div></div>')
      )
    ),
    // CUSTOMER: Referral
    W.section('Referral Program', '',
      W.card('card-purple', '<div style="text-align:center;padding:12px"><div style="font-size:20px">👥</div><div style="font-size:10px;font-weight:700;margin-top:4px">Refer & Earn ₹500</div><div style="font-size:7px;color:#64748b;margin-top:4px">Share your referral code with friends. When they make their first purchase, you both get ₹500!</div><div style="margin:8px auto;background:#f1f5f9;padding:6px 16px;border-radius:4px;font-size:10px;font-weight:700;color:#e94560;display:inline-block">RAHUL500</div><div style="display:flex;gap:4px;justify-content:center;margin-top:8px"><span class="btn btn-primary btn-sm">📋 Copy Code</span><span class="btn btn-outline btn-sm">📱 Share</span></div></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📊 My Referrals</div><div style="font-size:6px"><div class="stat-row"><span class="label">Total Referrals</span><span class="value">5</span></div><div class="stat-row"><span class="label">Successful</span><span class="value">3</span></div><div class="stat-row"><span class="label">Pending</span><span class="value">2</span></div><div class="stat-row"><span class="label">Total Earned</span><span class="value" style="color:#22c55e">₹1,500</span></div></div>'),
      W.section('Referral Leaderboard', '',
        W.table(['Rank', 'User', 'Referrals', 'Earned'], [
          ['🥇', 'Priya S.', '12', '₹6,000'],
          ['🥈', 'Amit P.', '8', '₹4,000'],
          ['🥉', 'Rahul K.', '5', '₹1,500'],
          ['4', 'Neha G.', '3', '₹1,500'],
          ['5', 'Vikram R.', '2', '₹1,000']
        ])
      )
    )
  )
));

// PAGE: Partner API Dashboard
pages.push(W.page('Partner API — Dashboard & Keys', '🤝', 'Partner / Admin',
  W.topbar('SARA ELECTRONICS (Partner API)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Partner API' },
      { icon: '🔑', label: 'API Keys' },
      { icon: '📖', label: 'Documentation' },
      { icon: '📦', label: 'Orders' },
      { icon: '💰', label: 'Wallet' },
      { icon: '⚙️', label: 'Settings' }
    ], 0),
    W.section('Partner API Overview', '',
      W.kpiGrid(
        W.kpi('12,345', 'API Calls (Today)', 'accent'),
        W.kpi('234', 'Orders (This Month)', 'green'),
        W.kpi('₹1,23,456', 'Revenue', 'blue'),
        W.kpi('99.9%', 'Uptime', 'yellow')
      ),
      W.section('API Keys', '',
        W.toolbar('API Keys', W.btn('+ Generate Key', 'btn-primary')),
        W.table(['Name', 'Key', 'Scopes', 'Last Used', 'Status'], [
          ['Production Key', 'pk_live_****3f2a', 'orders, products, wallet', '2 min ago', '<span class="status status-active">Active</span>'],
          ['Test Key', 'pk_test_****8b1c', 'orders, products', '1 hour ago', '<span class="status status-active">Active</span>'],
          ['Read Only', 'pk_live_****2d4e', 'products', '3 days ago', '<span class="status status-active">Active</span>']
        ]),
        W.section('Rate Limiting', '',
          W.card('', '<div style="font-size:7px"><div class="stat-row"><span class="label">Rate Limit</span><span class="value">1000 req/min</span></div><div class="stat-row"><span class="label">Current Usage</span><span class="value">234 req/min (23.4%)</span></div><div class="stat-row"><span class="label">Burst Limit</span><span class="value">100 req/sec</span></div></div>'),
          W.progress(23.4, 'fill-green')
        )
      )
    )
  )
));

// PAGE: Partner API Documentation
pages.push(W.page('Partner API — Documentation', '📖', 'Partner / Admin',
  W.topbar('SARA ELECTRONICS (Partner API)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview' },
      { icon: '🔑', label: 'API Keys' },
      { icon: '📖', label: 'Documentation' },
      { icon: '📦', label: 'Orders' },
      { icon: '💰', label: 'Wallet' }
    ], 2),
    W.section('API Documentation', '',
      W.tabs(['Authentication', 'Products', 'Orders', 'Wallet', 'Webhooks']),
      W.section('Authentication', '',
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔐 API Key Authentication</div><div style="font-size:6px;color:#64748b">All requests require an API key in the header:</div>'),
        W.code('POST /api/v1/partner/orders\nHeaders:\n  X-API-Key: pk_live_****3f2a\n  X-API-Secret: sk_live_****\n  Content-Type: application/json\n  X-Timestamp: 1687152000\n  X-Signature: hmac-sha256-signature'),
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📦 Create Order</div>'),
        W.code('POST /api/v1/partner/orders\n{\n  "external_id": "EXT-12345",\n  "customer": {\n    "name": "John Doe",\n    "email": "john@example.com",\n    "phone": "+919876543210"\n  },\n  "items": [\n    {\n      "product_id": "prod_123",\n      "quantity": 1,\n      "price": 34990\n    }\n  ],\n  "shipping_address": {\n    "line1": "123 Main St",\n    "city": "Noida",\n    "state": "UP",\n    "pincode": "201301"\n  }\n}'),
        W.codeResp('{\n  "success": true,\n  "order": {\n    "id": "ord_abc123",\n    "external_id": "EXT-12345",\n    "status": "confirmed",\n    "total": 34990\n  }\n}')
      ),
      W.section('API Endpoints', '',
        W.table(['Method', 'Endpoint', 'Description', 'Auth'], [
          ['GET', '/api/v1/partner/products', 'List all products', 'API Key'],
          ['GET', '/api/v1/partner/products/:id', 'Get product details', 'API Key'],
          ['POST', '/api/v1/partner/orders', 'Create order', 'API Key + Secret'],
          ['GET', '/api/v1/partner/orders/:id', 'Get order details', 'API Key'],
          ['GET', '/api/v1/partner/wallet', 'Get wallet balance', 'API Key'],
          ['POST', '/api/v1/partner/wallet/transfer', 'Transfer funds', 'API Key + Secret']
        ])
      )
    )
  )
));

// PAGE: Partner Wallet & Orders
pages.push(W.page('Partner API — Wallet & Orders', '💰', 'Partner / Admin',
  W.topbar('SARA ELECTRONICS (Partner API)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview' },
      { icon: '📦', label: 'Orders' },
      { icon: '💰', label: 'Wallet' }
    ], 2),
    W.section('Partner Wallet', '',
      W.kpiGrid(
        W.kpi('₹5,67,890', 'Wallet Balance', 'accent'),
        W.kpi('₹1,23,456', 'This Month', 'green'),
        W.kpi('₹45,678', 'Pending', 'blue'),
        W.kpi('₹2,34,567', 'Total Earned', 'yellow')
      ),
      W.section('Wallet Transactions', '',
        W.table(['Date', 'Type', 'Description', 'Amount', 'Balance'], [
          ['Jun 19', 'Credit', 'Order #EXT-12345 commission', '+₹1,750', '₹5,67,890'],
          ['Jun 18', 'Debit', 'Wallet transfer to bank', '-₹50,000', '₹5,66,140'],
          ['Jun 17', 'Credit', 'Order #EXT-12340 commission', '+₹2,100', '₹6,16,140'],
          ['Jun 16', 'Credit', 'Order #EXT-12338 commission', '+₹890', '₹6,14,040']
        ]),
        W.flex('gap-4 mt-8', W.btn('Transfer to Bank', 'btn-primary'), W.btn('Download Statement', 'btn-outline'))
      ),
      W.section('Partner Orders', '',
        W.table(['Partner Order ID', 'External ID', 'Customer', 'Amount', 'Commission', 'Status'], [
          ['#P-7890', 'EXT-12345', 'John D.', '₹34,990', '₹1,750', '<span class="status status-delivered">Delivered</span>'],
          ['#P-7889', 'EXT-12340', 'Jane S.', '₹42,000', '₹2,100', '<span class="status status-shipped">Shipped</span>'],
          ['#P-7888', 'EXT-12338', 'Bob M.', '₹17,800', '₹890', '<span class="status status-processing">Processing</span>']
        ])
      )
    )
  )
));
