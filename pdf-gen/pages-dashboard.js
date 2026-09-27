// ===== CUSTOMER DASHBOARD PAGES =====

// PAGE: Dashboard Home
pages.push(W.page('Customer Dashboard — Home', '📊', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍', '❤️', '🛒', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'My Orders' },
      { icon: '❤️', label: 'Wishlist' },
      { icon: '⭐', label: 'Reviews' },
      { icon: '📍', label: 'Addresses' },
      { icon: '👤', label: 'Profile' },
      { icon: '🔔', label: 'Notifications' },
      { icon: '💬', label: 'Support' },
      { icon: '🔑', label: 'Security' },
      { icon: '🎫', label: 'Coupons' },
      { icon: '🎁', label: 'Rewards' },
      { icon: '👥', label: 'Referrals' }
    ], 0),
    W.section('Dashboard Overview', '',
      W.kpiGrid(
        W.kpi('3', 'Total Orders', 'accent'),
        W.kpi('₹39,088', 'Total Spent', 'green'),
        W.kpi('2', 'Wishlist Items', 'blue'),
        W.kpi('150', 'Reward Points', 'yellow')
      ),
      W.section('Recent Orders', '',
        W.table(['Order ID', 'Date', 'Items', 'Total', 'Status', 'Action'], [
          ['#SARA-4521', 'Jun 19, 2026', 'Samsung TV + Boat Airdopes', '₹39,088', '<span class="status status-processing">Processing</span>', '<span class="btn btn-outline btn-sm">Track</span>'],
          ['#SARA-4498', 'Jun 15, 2026', 'HP Laptop', '₹49,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">Review</span>'],
          ['#SARA-4401', 'Jun 10, 2026', 'LG Washing Machine', '₹29,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">Reorder</span>']
        ])
      ),
      W.section('Wishlist', '',
        W.grid('grid-4',
          W.product('Sony Speaker', '₹3,999', '₹6,999', 4.4),
          W.product('Dell Monitor', '₹14,990', '₹22,990', 4.5),
          W.product('JBL Headphones', '₹2,999', '₹5,999', 4.3),
          W.product('Lenovo Tab', '₹19,990', '₹27,990', 4.2)
        )
      )
    )
  )
));

// PAGE: Orders
pages.push(W.page('Customer Dashboard — My Orders', '📦', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍', '❤️', '🛒', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'My Orders' },
      { icon: '❤️', label: 'Wishlist' },
      { icon: '⭐', label: 'Reviews' },
      { icon: '📍', label: 'Addresses' },
      { icon: '👤', label: 'Profile' }
    ], 1),
    W.section('My Orders', '',
      W.filterBar('All', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'),
      W.table(['Order ID', 'Date', 'Items', 'Total', 'Status', 'Action'], [
        ['#SARA-4521', 'Jun 19, 2026', 'Samsung TV + Boat Airdopes', '₹39,088', '<span class="status status-processing">Processing</span>', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4498', 'Jun 15, 2026', 'HP Laptop', '₹49,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4401', 'Jun 10, 2026', 'LG Washing Machine', '₹29,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4380', 'Jun 5, 2026', 'Boat Airdopes', '₹1,299', '<span class="status status-cancelled">Cancelled</span>', '<span class="btn btn-outline btn-sm">View</span>'],
        ['#SARA-4299', 'May 28, 2026', 'Sony TV 43"', '₹28,990', '<span class="status status-delivered">Delivered</span>', '<span class="btn btn-outline btn-sm">Reorder</span>']
      ]),
      W.flex('flex-center gap-4 mt-8', W.btn('← Prev', 'btn-outline btn-sm'), W.btn('1', 'btn-primary btn-sm'), W.btn('2', 'btn-outline btn-sm'), W.btn('3', 'btn-outline btn-sm'), W.btn('Next →', 'btn-outline btn-sm'))
    )
  )
));

// PAGE: Order Detail
pages.push(W.page('Customer Dashboard — Order Detail', '📦', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍', '❤️', '🛒', '👤']),
  W.breadcrumb('Dashboard', 'Orders', '#SARA-4521'),
  W.twoCol(
    W.section('Order Tracking', '',
      W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:6px">📦 Order #SARA-4521</div>'),
      W.alert('📦 Your order is being processed. Expected delivery by June 21, 2026.', 'info'),
      W.timeline([
        { time: 'Jun 19, 10:30 AM', event: 'Order placed successfully' },
        { time: 'Jun 19, 11:15 AM', event: 'Payment confirmed via Razorpay UPI' },
        { time: 'Jun 19, 02:00 PM', event: 'Order picked from warehouse' },
        { time: 'Jun 20, 09:00 AM', event: 'Shipped via BlueDart — Tracking: BD1234567890' },
        { time: 'Jun 21, Expected', event: 'Out for delivery' }
      ]),
      W.section('Shipping Details', '',
        W.card('', '<div class="stat-row"><span class="label">Carrier</span><span class="value">BlueDart Express</span></div><div class="stat-row"><span class="label">Tracking</span><span class="value" style="color:#3b82f6">BD1234567890</span></div><div class="stat-row"><span class="label">Delivery By</span><span class="value">June 21, 2026</span></div><div class="stat-row"><span class="label">Address</span><span class="value">123, MG Road, Noida</span></div>')
      )
    ),
    W.section('Order Items & Summary', '',
      W.card('', '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9"><div style="width:40px;height:40px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">📺</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Samsung 55" Crystal UHD 4K Smart TV</div><div style="font-size:6px;color:#64748b">Size: 55" | Color: Black</div><div style="font-size:7px;font-weight:600;color:#e94560">₹34,990 × 1</div></div></div><div style="display:flex;gap:8px;padding:6px 0"><div style="width:40px;height:40px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">🎧</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Boat Airdopes 141 TWS Earbuds</div><div style="font-size:6px;color:#64748b">Color: Black</div><div style="font-size:7px;font-weight:600;color:#e94560">₹1,299 × 2</div></div></div>'),
      W.card('', '<div class="stat-row"><span class="label">Subtotal</span><span class="value">₹37,588</span></div><div class="stat-row"><span class="label">Discount</span><span class="value" style="color:#22c55e">-₹3,000</span></div><div class="stat-row"><span class="label">Shipping</span><span class="value" style="color:#22c55e">FREE</span></div><div class="stat-row"><span class="label">Tax</span><span class="value">₹4,500</span></div><div class="stat-row" style="border-top:2px solid #e2e8f0;padding-top:6px"><span class="label" style="font-weight:700">Total Paid</span><span class="value" style="color:#e94560">₹39,088</span></div>'),
      W.flex('gap-4 mt-8',
        W.btn('Download Invoice', 'btn-outline'),
        W.btn('Track Shipment', 'btn-primary'),
        W.btn('Request Return', 'btn-danger')
      )
    )
  )
));

// PAGE: Wishlist & Reviews
pages.push(W.page('Customer Dashboard — Wishlist & Reviews', '❤️', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍', '❤️', '🛒', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'My Orders' },
      { icon: '❤️', label: 'Wishlist' },
      { icon: '⭐', label: 'Reviews' },
      { icon: '📍', label: 'Addresses' },
      { icon: '👤', label: 'Profile' }
    ], 2),
    W.section('My Wishlist', '',
      W.grid('grid-3',
        W.product('Sony Speaker', '₹3,999', '₹6,999', 4.4),
        W.product('Dell Monitor', '₹14,990', '₹22,990', 4.5),
        W.product('JBL Headphones', '₹2,999', '₹5,999', 4.3)
      )
    ),
    W.section('My Reviews', '',
      W.card('', '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9"><div style="font-size:6px;color:#f59e0b">★★★★★</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Samsung 55" TV</div><div style="font-size:6px;color:#64748b">"Excellent picture quality and smart features. Delivery was fast."</div><div style="font-size:5px;color:#94a3b8">June 18, 2026</div></div><span class="btn btn-outline btn-sm">Edit</span></div>'),
      W.card('', '<div style="display:flex;gap:8px;padding:6px 0"><div style="font-size:6px;color:#f59e0b">★★★★☆</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Boat Airdopes 141</div><div style="font-size:6px;color:#64748b">"Good value for money. Sound quality is decent for the price."</div><div style="font-size:5px;color:#94a3b8">June 16, 2026</div></div><span class="btn btn-outline btn-sm">Edit</span></div>'),
      W.btn('Write a Review', 'btn-primary mt-4')
    )
  )
));

// PAGE: Addresses & Profile
pages.push(W.page('Customer Dashboard — Addresses & Profile', '📍', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍', '❤️', '🛒', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '📊', label: 'Overview', section: 'Dashboard' },
      { icon: '📦', label: 'My Orders' },
      { icon: '❤️', label: 'Wishlist' },
      { icon: '⭐', label: 'Reviews' },
      { icon: '📍', label: 'Addresses' },
      { icon: '👤', label: 'Profile' }
    ], 4),
    W.section('My Addresses', '',
      W.grid('grid-2',
        W.card('card-accent', '<div style="font-size:7px"><strong>🏠 Home</strong><br>Rahul Kumar<br>123, MG Road, Sector 5<br>Noida, UP - 201301<br>Phone: +91 98765 43210</div><div style="margin-top:4px"><span class="btn btn-outline btn-sm">Edit</span> <span class="btn btn-outline btn-sm">Delete</span></div>'),
        W.card('', '<div style="font-size:7px"><strong>🏢 Office</strong><br>Rahul Kumar<br>456, Tech Park, Sector 62<br>Noida, UP - 201301<br>Phone: +91 98765 43210</div><div style="margin-top:4px"><span class="btn btn-outline btn-sm">Edit</span> <span class="btn btn-outline btn-sm">Delete</span></div>')
      ),
      W.btn('+ Add New Address', 'btn-primary mt-4')
    ),
    W.section('My Profile', '',
      W.flex('gap-12 mb-8', W.avatar('RK', 'avatar-lg'), W.card('', '<div style="font-size:9px;font-weight:700">Rahul Kumar</div><div style="font-size:7px;color:#64748b">rahul@email.com | +91 98765 43210</div><div style="font-size:6px;color:#22c55e">✓ Email Verified</div>')),
      W.formRow(W.formGroup('First Name', 'text', 'Rahul'), W.formGroup('Last Name', 'text', 'Kumar')),
      W.formGroup('Email', 'email', 'rahul@email.com'),
      W.formGroup('Phone', 'tel', '+91 98765 43210'),
      W.formGroup('Date of Birth', 'date'),
      W.btn('Save Changes', 'btn-primary mt-4')
    )
  )
));
