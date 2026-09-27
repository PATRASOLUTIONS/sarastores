// ===== ADMIN CONTENT, HOME BUILDER, SETTINGS =====

// PAGE: Admin Home Builder
pages.push(W.page('Admin Panel — Home Page Builder', '🎨', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '🎨', label: 'Home Builder', section: 'Content' },
      { icon: '🖼️', label: 'Hero Slides' },
      { icon: '📢', label: 'Advertisements' },
      { icon: '💬', label: 'Testimonials' }
    ], 0),
    W.section('Home Page Builder', '',
      W.alert('Drag and drop components to build the homepage. Reorder by dragging.', 'info'),
      W.card('card-accent', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Hero Slider</div><div style="font-size:6px;color:#64748b">Main banner carousel — 3 slides active</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Category Showcase</div><div style="font-size:6px;color:#64748b">10 category circles — showing all categories</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Sale Banner</div><div style="font-size:6px;color:#64748b">Countdown timer — ends Jun 30</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Featured Products</div><div style="font-size:6px;color:#64748b">4 product cards — curated selection</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Animated Banners</div><div style="font-size:6px;color:#64748b">2 promotional banners — gaming & appliances</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Brand Marquee</div><div style="font-size:6px;color:#64748b">Scrolling brand logos — 8 brands</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Offers Strip</div><div style="font-size:6px;color:#64748b">Marquee offers — 3 active offers</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Testimonials</div><div style="font-size:6px;color:#64748b">Customer reviews carousel — 5 reviews</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Trust Bar</div><div style="font-size:6px;color:#64748b">Trust badges — 4 features</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">Split Cards</div><div style="font-size:6px;color:#64748b">Category promo cards — 2 cards</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.card('', '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">☰</span><div><div style="font-size:8px;font-weight:700">OTT Section</div><div style="font-size:6px;color:#64748b">OTT subscription promo</div></div><div style="margin-left:auto;display:flex;gap:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="toggle on"></span></div></div>'),
      W.btn('+ Add Component', 'btn-primary mt-4')
    )
  )
));

// PAGE: Admin Hero Slides & Ads
pages.push(W.page('Admin Panel — Hero Slides & Advertisements', '🖼️', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '🖼️', label: 'Hero Slides' },
      { icon: '📢', label: 'Advertisements' },
      { icon: '🖼️', label: 'Product Slides' }
    ], 0),
    W.section('Hero Slides', '',
      W.toolbar('Hero Slides', W.btn('+ Add Slide', 'btn-primary')),
      W.grid('grid-3',
        W.card('card-accent', '<div style="background:linear-gradient(135deg,#1a1a2e,#e94560);height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">MEGA SALE — 60% OFF</div><div style="font-size:6px;margin-top:4px">Slide 1 | Active | Order: 1</div><div style="display:flex;gap:4px;margin-top:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="btn btn-danger btn-sm">Delete</span></div>'),
        W.card('', '<div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">GAMING ZONE</div><div style="font-size:6px;margin-top:4px">Slide 2 | Active | Order: 2</div><div style="display:flex;gap:4px;margin-top:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="btn btn-danger btn-sm">Delete</span></div>'),
        W.card('', '<div style="background:linear-gradient(135deg,#22c55e,#16a34a);height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">HOME APPLIANCES</div><div style="font-size:6px;margin-top:4px">Slide 3 | Active | Order: 3</div><div style="display:flex;gap:4px;margin-top:4px"><span class="btn btn-outline btn-sm">Edit</span><span class="btn btn-danger btn-sm">Delete</span></div>')
      ),
      W.section('Advertisements', '',
        W.table(['Name', 'Position', 'Type', 'Clicks', 'Impressions', 'CTR', 'Status'], [
          ['Top Banner', 'Header', 'Image', '1,234', '45,678', '2.7%', '<span class="status status-active">Active</span>'],
          ['Sidebar Ad', 'Category Page', 'HTML', '567', '23,456', '2.4%', '<span class="status status-active">Active</span>'],
          ['Footer Ad', 'Footer', 'Image', '234', '34,567', '0.7%', '<span class="status status-inactive">Inactive</span>']
        ]),
        W.section('Product Advertisements', '',
          W.card('', '<div style="font-size:7px"><strong>Samsung TV Promotion</strong><div style="font-size:6px;color:#64748b">Position: Homepage + Category | Banner + Carousel | Valid: Jun 1-30</div></div>'),
          W.card('', '<div style="font-size:7px"><strong>Boat Audio Sale</strong><div style="font-size:6px;color:#64748b">Position: Homepage + Search | Banner | Valid: Jun 15-30</div></div>')
        )
      )
    )
  )
));

// PAGE: Admin Settings
pages.push(W.page('Admin Panel — Settings & Configuration', '⚙️', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '⚙️', label: 'General', section: 'Settings' },
      { icon: '💳', label: 'Payment' },
      { icon: '🚚', label: 'Shipping' },
      { icon: '📧', label: 'Email' },
      { icon: '🔐', label: 'Security' },
      { icon: '🔗', label: 'Integrations' }
    ], 0),
    W.section('General Settings', '',
      W.formGroup('Store Name', 'text', 'Sara Electronics'),
      W.formGroup('Store Description', 'text', 'Your one-stop shop for premium electronics'),
      W.formGroup('Site URL', 'url', 'https://saraelectronics.in'),
      W.formGroup('Contact Email', 'email', 'support@saraelectronics.in'),
      W.formGroup('Contact Phone', 'tel', '+91 1800-123-4567'),
      W.formGroup('Currency', 'text', 'INR (₹)'),
      W.btn('Save Settings', 'btn-primary mt-4')
    ),
    W.section('Payment Settings', '',
      W.card('Razorpay Configuration', '<div class="stat-row"><span class="label">Key ID</span><span class="value">rzp_live_****</span></div><div class="stat-row"><span class="label">Key Secret</span><span class="value">••••••••</span></div><div class="stat-row"><span class="label">Webhook URL</span><span class="value">/api/razorpay/webhook</span></div><div class="stat-row"><span class="label">Status</span><span class="value"><span class="status status-active">Connected</span></span></div>'),
      W.section('Shipping Settings', '',
        W.formGroup('Free Shipping Threshold', 'number', '999'),
        W.formGroup('Default Shipping Cost', 'number', '99'),
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🚚 Shipping Partners</div><div style="font-size:6px"><div class="stat-row"><span class="label">BlueDart Express</span><span class="value"><span class="toggle on"></span></span></div><div class="stat-row"><span class="label">Delhivery</span><span class="value"><span class="toggle on"></span></span></div><div class="stat-row"><span class="label">DTDC</span><span class="value"><span class="toggle"></span></span></div></div>')
      ),
      W.section('Email Settings', '',
        W.formGroup('SMTP Host', 'text', 'smtp.gmail.com'),
        W.formRow(W.formGroup('SMTP Port', 'number', '587'), W.formGroup('SMTP User', 'text', 'noreply@saraelectronics.in')),
        W.formGroup('SMTP Password', 'password', '••••••••'),
        W.btn('Test Email', 'btn-outline mt-4')
      )
    )
  )
));

// PAGE: Admin Integrations & Security
pages.push(W.page('Admin Panel — Integrations & Security', '🔗', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '🔗', label: 'Integrations', section: 'System' },
      { icon: '🛡️', label: 'Security' },
      { icon: '📍', label: 'Blocked Pincodes' },
      { icon: '🔄', label: 'Database' }
    ], 0),
    W.section('Integrations', '',
      W.grid('grid-2',
        W.card('card-green', '<div style="font-size:8px;font-weight:700">🟢 Razorpay</div><div style="font-size:6px;color:#64748b;margin-top:2px">Payment gateway — Connected</div><div style="font-size:6px;color:#22c55e;margin-top:2px">✓ Webhook active | Live mode</div>'),
        W.card('card-green', '<div style="font-size:8px;font-weight:700">🟢 Firebase</div><div style="font-size:6px;color:#64748b;margin-top:2px">Auth + Storage — Connected</div><div style="font-size:6px;color:#22c55e;margin-top:2px">✓ Google OAuth enabled</div>'),
        W.card('card-blue', '<div style="font-size:8px;font-weight:700">🔵 KGen (ERP)</div><div style="font-size:6px;color:#64748b;margin-top:2px">Inventory sync — Connected</div><div style="font-size:6px;color:#3b82f6;margin-top:2px">ℹ Last sync: 2 hours ago</div>'),
        W.card('card-blue', '<div style="font-size:8px;font-weight:700">🔵 eXlr8 (CRM)</div><div style="font-size:6px;color:#64748b;margin-top:2px">Lead management — Connected</div><div style="font-size:6px;color:#3b82f6;margin-top:2px">ℹ API key configured</div>')
      ),
      W.section('Security', '',
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🛡️ Content Security Policy</div><div style="font-size:6px">CSP headers: <span class="status status-active">Enabled</span></div><div style="font-size:6px">HSTS: <span class="status status-active">Enabled</span> (production only)</div><div style="font-size:6px">X-Frame-Options: <span class="status status-active">DENY</span></div>'),
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">⏱️ Rate Limiting</div><div style="font-size:6px">API: 100 req/min per IP</div><div style="font-size:6px">Auth: 10 req/min per IP</div><div style="font-size:6px">Search: 30 req/min per IP</div><div style="font-size:6px">⚠️ In-memory store — replace with Redis for production</div>'),
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🤖 Bot Detection</div><div style="font-size:6px">Status: <span class="status status-active">Active</span></div><div style="font-size:6px">Blocked IPs: 23</div><div style="font-size:6px">Last 24h: 1,234 requests blocked</div>'),
        W.section('Blocked Pincodes', '',
          W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📍 Delivery Blocked Areas</div><div style="font-size:6px"><div class="stat-row"><span class="label">Mode</span><span class="value">Blacklist (block listed pincodes)</span></div><div class="stat-row"><span class="label">Blocked Count</span><span class="value">45 pincodes</span></div><div class="stat-row"><span class="label">Examples</span><span class="value">110001, 400001, 560001</span></div></div>'),
          W.card('card-yellow', '<div style="font-size:6px">三种模式: Blacklist (block listed), Whitelist (only allow listed), Disabled (allow all)</div>')
        ),
        W.section('Database Migration', '',
          W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔄 Schema Migration</div><div style="font-size:6px"><div class="stat-row"><span class="label">Status</span><span class="value">Up to date</span></div><div class="stat-row"><span class="label">Last Migration</span><span class="value">Jun 15, 2026</span></div><div class="stat-row"><span class="label">Products Migrated</span><span class="value">156/156</span></div></div><div style="margin-top:4px"><span class="btn btn-outline btn-sm">Dry Run</span> <span class="btn btn-primary btn-sm">Run Migration</span></div>')
        )
      )
    )
  )
));

// PAGE: Admin Testimonials & Notifications
pages.push(W.page('Admin Panel — Testimonials & Notifications', '💬', 'Admin / Super Admin',
  W.topbar('SARA ELECTRONICS (Admin)', [], ['🔍', '🔔', '👤']),
  W.twoCol(
    W.sidebar([
      { icon: '💬', label: 'Testimonials' },
      { icon: '🔔', label: 'Notifications' },
      { icon: '🏷️', label: 'Offers' }
    ], 0),
    W.section('Testimonials', '',
      W.toolbar('Testimonials', W.btn('+ Add Testimonial', 'btn-primary')),
      W.grid('grid-2',
        W.card('card-accent', '<div style="display:flex;gap:8px">' + W.avatar('RK') + '<div><div style="font-size:7px;font-weight:600">Rahul Kumar</div><div style="font-size:6px;color:#f59e0b">★★★★★</div><div style="font-size:6px;color:#64748b;margin-top:2px">"Excellent service! Got my TV delivered in 2 days."</div><div style="font-size:5px;color:#22c55e;margin-top:2px">✓ Approved | Featured</div></div></div>'),
        W.card('', '<div style="display:flex;gap:8px">' + W.avatar('PS') + '<div><div style="font-size:7px;font-weight:600">Priya Singh</div><div style="font-size:6px;color:#f59e0b">★★★★★</div><div style="font-size:6px;color:#64748b;margin-top:2px">"Best prices on Samsung products!"</div><div style="font-size:5px;color:#f59e0b;margin-top:2px">⏳ Pending Approval</div></div></div>')
      ),
      W.section('Notifications', '',
        W.table(['Type', 'Message', 'Target', 'Status', 'Date'], [
          ['📧 Email', 'Summer Sale Announcement', 'All Users (892)', '<span class="status status-sent">Sent</span>', 'Jun 18'],
          ['📱 Push', 'New Arrivals — Smartphones', 'Mobile Users (456)', '<span class="status status-sent">Sent</span>', 'Jun 17'],
          ['💬 WhatsApp', 'Order Update', 'Single User', '<span class="status status-pending">Scheduled</span>', 'Jun 20']
        ]),
        W.section('Spin Wheel Notifications', '',
          W.card('card-green', '<div style="font-size:7px;font-weight:600">🎰 Spin Wheel Winners</div><div style="font-size:6px;margin-top:4px">Last 24h: 12 winners | Prizes awarded: ₹5,670<br>Pending notifications: 3<br>WhatsApp messages sent: 9<br>Email notifications sent: 12</div>')
        )
      )
    )
  )
));
