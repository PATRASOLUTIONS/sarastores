// ===== INFORMATIONAL, SEO, SECURITY PAGES =====

// PAGE: Informational Pages
pages.push(W.page('Informational Pages', 'ℹ️', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'About', 'Contact', 'FAQ', 'Careers'], ['🔍', '👤']),
  W.grid('grid-2',
    W.section('About Us', '',
      W.card('', '<div style="font-size:12px;font-weight:800;margin-bottom:6px">About Sara Electronics</div><div style="font-size:7px;color:#64748b;line-height:1.6">Sara Electronics is a leading electronics retailer in India, offering a wide range of products including TVs, laptops, smartphones, home appliances, and more. With over 10 years of experience, we are committed to providing genuine products at the best prices with excellent customer service.</div><div style="margin-top:6px"><span class="badge badge-green">✓ GST Registered</span> <span class="badge badge-blue">✓ Authorized Dealer</span> <span class="badge badge-purple">✓ ISO 9001:2015</span></div>'),
      W.section('Contact Us', '',
        W.card('', '<div style="font-size:7px"><div class="stat-row"><span class="label">📍 Address</span><span class="value">123, Electronics Market, Noida - 201301</span></div><div class="stat-row"><span class="label">📞 Phone</span><span class="value">+91 1800-123-4567 (Toll Free)</span></div><div class="stat-row"><span class="label">📧 Email</span><span class="value">support@saraelectronics.in</span></div><div class="stat-row"><span class="label">⏰ Hours</span><span class="value">Mon-Sat: 10AM - 8PM</span></div></div>'),
        W.card('card-blue', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📝 Quick Contact Form</div>' + W.formGroup('Name', 'text') + W.formGroup('Email', 'email') + W.formGroup('Message', 'textarea') + W.btn('Send Message', 'btn-primary btn-sm'))
      )
    ),
    W.section('FAQ', '',
      W.accordion('How do I track my order?', 'Go to Dashboard → Orders → click Track on any order. You will see real-time tracking with carrier details.'),
      W.accordion('What is the return policy?', 'We offer a 7-day return policy for most products. Electronics must be in original packaging with all accessories.'),
      W.accordion('How do I use a coupon?', 'At checkout, enter the coupon code in the "Apply Coupon" field and click Apply. The discount will be reflected in the total.'),
      W.accordion('Is EMI available?', 'Yes! No Cost EMI is available on select products via credit cards from major banks. EMI starts at ₹1,666/month.'),
      W.accordion('How do I contact support?', 'You can reach us via phone (toll-free), email, live chat, or visit our store. Support is available Mon-Sat 10AM-8PM.'),
      W.section('Policies', '',
        W.grid('grid-2',
          W.card('card-accent', '<div style="font-size:7px;font-weight:600">📜 Terms of Service</div><div style="font-size:6px;color:#64748b;margin-top:2px">Terms governing use of our platform</div>'),
          W.card('card-accent', '<div style="font-size:7px;font-weight:600">🔒 Privacy Policy</div><div style="font-size:6px;color:#64748b;margin-top:2px">How we collect and protect your data</div>'),
          W.card('card-green', '<div style="font-size:7px;font-weight:600">🚚 Shipping Policy</div><div style="font-size:6px;color:#64748b;margin-top:2px">Delivery timelines and shipping partners</div>'),
          W.card('card-green', '<div style="font-size:7px;font-weight:600">↩️ Return Policy</div><div style="font-size:6px;color:#64748b;margin-top:2px">7-day return and exchange policy</div>'),
          W.card('card-blue', '<div style="font-size:7px;font-weight:600">🛡️ Warranty</div><div style="font-size:6px;color:#64748b;margin-top:2px">Manufacturer warranty information</div>'),
          W.card('card-blue', '<div style="font-size:7px;font-weight:600">♻️ E-Waste Policy</div><div style="font-size:6px;color:#64748b;margin-top:2px">Responsible electronics disposal</div>'),
          W.card('card-yellow', '<div style="font-size:7px;font-weight:600">📋 Grievance Officer</div><div style="font-size:6px;color:#64748b;margin-top:2px">IT Act compliance officer details</div>'),
          W.card('card-purple', '<div style="font-size:7px;font-weight:600">💼 Careers</div><div style="font-size:6px;color:#64748b;margin-top:2px">Join our growing team</div>')
        )
      )
    )
  )
));

// PAGE: Store Locator & Brand Pages
pages.push(W.page('Store Locator & Brand Landing Pages', '📍', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'Store Locator', 'Brands'], ['🔍', '👤']),
  W.twoCol(
    W.section('Store Locator', '',
      W.card('', '<div style="background:#f1f5f9;height:120px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:8px">🗺️ Google Maps Integration — 3 Store Locations</div>'),
      W.card('Our Stores', ''),
      W.grid('grid-2',
        W.card('card-accent', '<div style="font-size:7px"><strong>📍 Noida Flagship</strong><br>Sector 5, MG Road<br>Mon-Sat: 10AM - 9PM<br>📞 +91 120-1234567<br><span style="color:#22c55e">✓ Open Now</span></div>'),
        W.card('', '<div style="font-size:7px"><strong>📍 Delhi Showroom</strong><br>Janpath, Connaught Place<br>Mon-Sat: 10AM - 8PM<br>📞 +91 11-12345678<br><span style="color:#22c55e">✓ Open Now</span></div>'),
        W.card('', '<div style="font-size:7px"><strong>📍 Mumbai Store</strong><br>Linking Road, Bandra<br>Mon-Sun: 11AM - 9PM<br>📞 +91 22-12345678<br><span style="color:#22c55e">✓ Open Now</span></div>')
      ),
      W.section('Store Services', '',
        W.grid('grid-4',
          W.cardIcon('🔧', 'Repair', 'In-store repair'),
          W.cardIcon('📦', 'Pickup', 'Order & collect'),
          W.cardIcon('💡', 'Demo', 'Product demos'),
          W.cardIcon('💳', 'EMI', 'In-store EMI')
        )
      )
    ),
    W.section('Brand Landing Pages', '',
      W.grid('grid-2',
        W.card('card-accent', '<div style="font-size:9px;font-weight:800">📱 Samsung</div><div style="font-size:6px;color:#64748b;margin-top:2px">45 products | Up to 36% OFF</div><div style="font-size:6px;color:#e94560;margin-top:2px">Shop Samsung →</div>'),
        W.card('card-blue', '<div style="font-size:9px;font-weight:800">📺 LG</div><div style="font-size:6px;color:#64748b;margin-top:2px">32 products | Up to 30% OFF</div><div style="font-size:6px;color:#3b82f6;margin-top:2px">Shop LG →</div>'),
        W.card('card-green', '<div style="font-size:9px;font-weight:800">🎧 Boat</div><div style="font-size:6px;color:#64748b;margin-top:2px">28 products | Up to 70% OFF</div><div style="font-size:6px;color:#22c55e;margin-top:2px">Shop Boat →</div>'),
        W.card('card-purple', '<div style="font-size:9px;font-weight:800">💻 HP</div><div style="font-size:6px;color:#64748b;margin-top:2px">38 products | Up to 28% OFF</div><div style="font-size:6px;color:#a855f7;margin-top:2px">Shop HP →</div>'),
        W.card('', '<div style="font-size:9px;font-weight:800">🎵 Sony</div><div style="font-size:6px;color:#64748b;margin-top:2px">24 products | Up to 25% OFF</div><div style="font-size:6px;color:#e94560;margin-top:2px">Shop Sony →</div>'),
        W.card('', '<div style="font-size:9px;font-weight:800">🖥️ Dell</div><div style="font-size:6px;color:#64748b;margin-top:2px">20 products | Up to 22% OFF</div><div style="font-size:6px;color:#3b82f6;margin-top:2px">Shop Dell →</div>')
      ),
      W.section('Brand Guidelines', '',
        W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📋 Brand Page Configuration</div><div style="font-size:6px;color:#64748b">Each brand page includes: logo, description, product listing, offers, and SEO metadata. Pages are auto-generated from the brands collection in MongoDB.</div>')
      )
    )
  )
));

// PAGE: SEO Features
pages.push(W.page('SEO Features — Search Optimization', '🔍', 'Technical',
  W.topbar('SARA ELECTRONICS (SEO)', [], ['🔍', '👤']),
  W.grid('grid-2',
    W.section('Structured Data (JSON-LD)', '',
      W.card('Organization Schema', W.code('@type: Organization\nname: Sara Electronics\nurl: https://saraelectronics.in\nlogo: /logo.png\ncontactPoint: +91-1800-123-4567\nsameAs: [facebook, instagram, twitter]')),
      W.card('WebSite Schema', W.code('@type: WebSite\nurl: https://saraelectronics.in\npotentialAction: {\n  @type: SearchAction,\n  target: /products?q={search_term_string}\n}')),
      W.card('Product Schema', W.code('@type: Product\nname, image, brand, mpn, offers\naggregateRating: { ratingValue, reviewCount }\n→ Google Shopping eligibility')),
      W.card('LocalBusiness Schema', W.code('@type: LocalBusiness\nname: Sara Electronics\naddress: { ... }\ngeo: { lat, lng }\nopeningHours: Mo-Sa 10:00-20:00\n→ "near me" queries'))
    ),
    W.section('SEO Configuration', '',
      W.card('Sitemap', '<div style="font-size:7px"><div class="stat-row"><span class="label">URL</span><span class="value">/sitemap.xml</span></div><div class="stat-row"><span class="label">Products</span><span class="value">156 URLs</span></div><div class="stat-row"><span class="label">Categories</span><span class="value">24 URLs</span></div><div class="stat-row"><span class="label">Brands</span><span class="value">8 URLs</span></div><div class="stat-row"><span class="label">Last Updated</span><span class="value">Auto-generated</span></div></div>'),
      W.card('Robots.txt', W.code('User-agent: *\nDisallow: /api/\nDisallow: /admin/\nDisallow: /dashboard/\n\nSitemap: /sitemap.xml')),
      W.card('Meta Tags', '<div style="font-size:7px"><div class="stat-row"><span class="label">Title</span><span class="value">Dynamic per page</span></div><div class="stat-row"><span class="label">Description</span><span class="value">Auto from settings</span></div><div class="stat-row"><span class="label">Canonical</span><span class="value">Set on all pages</span></div><div class="stat-row"><span class="label">Open Graph</span><span class="value">Product + OG tags</span></div><div class="stat-row"><span class="label">Hreflang</span><span class="value">en-IN, x-default</span></div></div>'),
      W.card('Breadcrumbs', '<div style="font-size:7px"><div class="stat-row"><span class="label">Schema</span><span class="value">BreadcrumbJsonLd</span></div><div class="stat-row"><span class="label">Product Pages</span><span class="value">Home > Category > Product</span></div><div class="stat-row"><span class="label">Category Pages</span><span class="value">Home > Category</span></div><div class="stat-row"><span class="label">Brand Pages</span><span class="value">Home > Brands > Brand</span></div></div>'),
      W.card('Performance', '<div style="font-size:7px"><div class="stat-row"><span class="label">Core Web Vitals</span><span class="value">INP tracked via web-vitals</span></div><div class="stat-row"><span class="label">Image Format</span><span class="value">AVIF/WebP</span></div><div class="stat-row"><span class="label">Cache</span><span class="value">Immutable for /images, /fonts</span></div><div class="stat-row"><span class="label">HSTS</span><span class="value">Production only</span></div></div>')
    )
  )
));

// PAGE: Security Features
pages.push(W.page('Security Features', '🛡️', 'Technical',
  W.topbar('SARA ELECTRONICS (Security)', [], ['🔍', '👤']),
  W.grid('grid-2',
    W.section('Content Security Policy', '',
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🛡️ CSP Headers</div><div style="font-size:6px"><div class="stat-row"><span class="label">default-src</span><span class="value">\'self\'</span></div><div class="stat-row"><span class="label">script-src</span><span class="value">\'self\' \'unsafe-eval\'</span></div><div class="stat-row"><span class="label">style-src</span><span class="value">\'self\' \'unsafe-inline\'</span></div><div class="stat-row"><span class="label">img-src</span><span class="value">* data: blob:</span></div><div class="stat-row"><span class="label">connect-src</span><span class="value">\'self\' razorpay firebase</span></div></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔒 Other Headers</div><div style="font-size:6px"><div class="stat-row"><span class="label">HSTS</span><span class="value">max-age=31536000 (prod)</span></div><div class="stat-row"><span class="label">X-Frame-Options</span><span class="value">DENY</span></div><div class="stat-row"><span class="label">X-Content-Type</span><span class="value">nosniff</span></div><div class="stat-row"><span class="label">Referrer-Policy</span><span class="value">strict-origin</span></div><div class="stat-row"><span class="label">Permissions-Policy</span><span class="value">camera=(), microphone=()</span></div></div>')
    ),
    W.section('Rate Limiting & Bot Detection', '',
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">⏱️ Rate Limiting (In-Memory)</div><div style="font-size:6px"><div class="stat-row"><span class="label">Window</span><span class="value">60 seconds (sliding)</span></div><div class="stat-row"><span class="label">API Limit</span><span class="value">100 req/window/IP</span></div><div class="stat-row"><span class="label">Auth Limit</span><span class="value">10 req/window/IP</span></div><div class="stat-row"><span class="label">Search Limit</span><span class="value">30 req/window/IP</span></div><div class="stat-row"><span class="label">⚠️ Note</span><span class="value">Replace with Redis for production</span></div></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🤖 Bot Detection</div><div style="font-size:6px"><div class="stat-row"><span class="label">User-Agent Analysis</span><span class="value">Active</span></div><div class="stat-row"><span class="label">IP Blacklist</span><span class="value">23 IPs blocked</span></div><div class="stat-row"><span class="label">Request Pattern</span><span class="value">Suspicious pattern detection</span></div><div class="stat-row"><span class="label">Blocked (24h)</span><span class="value">1,234 requests</span></div></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔐 Encryption</div><div style="font-size:6px"><div class="stat-row"><span class="label">Partner API Keys</span><span class="value">AES-256 encrypted</span></div><div class="stat-row"><span class="label">Session Tokens</span><span class="value">HMAC-SHA256 signed</span></div><div class="stat-row"><span class="label">Password Hashing</span><span class="value">bcrypt (cost 12)</span></div><div class="stat-row"><span class="label">Data at Rest</span><span class="value">MongoDB encryption</span></div></div>'),
      W.card('', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">🔑 Session Management</div><div style="font-size:6px"><div class="stat-row"><span class="label">Token Format</span><span class="value">base64url(payload).base64url(hmac)</span></div><div class="stat-row"><span class="label">Secret</span><span class="value">SESSION_SECRET (≥16 chars)</span></div><div class="stat-row"><span class="label">Expiry</span><span class="value">24 hours</span></div><div class="stat-row"><span class="label">Cookie</span><span class="value">httpOnly, secure, signed</span></div><div class="stat-row"><span class="label">Edge Runtime</span><span class="value">crypto.subtle (no Buffer)</span></div></div>')
    )
  )
));

// PAGE: Summary & Features Index
pages.push(W.page('Complete Features Index', '📋', 'All Roles',
  W.section('Feature Count Summary', '',
    W.kpiGrid(
      W.kpi('80+', 'Total Features', 'accent'),
      W.kpi('100+', 'Pages & Screens', 'green'),
      W.kpi('160+', 'API Endpoints', 'blue'),
      W.kpi('4', 'User Roles', 'yellow')
    )
  ),
  W.grid('grid-2',
    W.section('Storefront (20+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">Homepage with Hero Slider</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Category Showcase (10 categories)</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Featured Products Grid</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Sale Banner with Countdown</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Animated Banners</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Brand Marquee</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Trust Bar (4 badges)</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Testimonials Carousel</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Recently Viewed Products</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">OTT Section</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Site Features</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Offers Strip / Bank Offers Marquee</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Split Cards (Category Promos)</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Footer with Links</span><span class="action">P4</span>',
        '<span class="icon">✅</span><span class="text">Category Page with Filters</span><span class="action">P5</span>',
        '<span class="icon">✅</span><span class="text">Subcategory Marquee</span><span class="action">P5</span>',
        '<span class="icon">✅</span><span class="text">Product Detail Page</span><span class="action">P6</span>',
        '<span class="icon">✅</span><span class="text">Search Autocomplete</span><span class="action">P5</span>',
        '<span class="icon">✅</span><span class="text">Mega Menu Navigation</span><span class="action">P3</span>',
        '<span class="icon">✅</span><span class="text">Responsive Design</span><span class="action">All</span>'
      )
    ),
    W.section('Auth & Cart (12+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">Login (Email + Password)</span><span class="action">P7</span>',
        '<span class="icon">✅</span><span class="text">Signup with Validation</span><span class="action">P7</span>',
        '<span class="icon">✅</span><span class="text">Forgot Password (Email Reset)</span><span class="action">P8</span>',
        '<span class="icon">✅</span><span class="text">OTP Verification</span><span class="action">P8</span>',
        '<span class="icon">✅</span><span class="text">Google OAuth</span><span class="action">P7</span>',
        '<span class="icon">✅</span><span class="text">Session Management (HMAC)</span><span class="action">P20</span>',
        '<span class="icon">✅</span><span class="text">Shopping Cart</span><span class="action">P9</span>',
        '<span class="icon">✅</span><span class="text">Mini Cart</span><span class="action">P9</span>',
        '<span class="icon">✅</span><span class="text">Coupon Application</span><span class="action">P9</span>',
        '<span class="icon">✅</span><span class="text">Multi-step Checkout</span><span class="action">P10</span>',
        '<span class="icon">✅</span><span class="text">Razorpay Payment Gateway</span><span class="action">P10</span>',
        '<span class="icon">✅</span><span class="text">Order Confirmation & Tracking</span><span class="action">P11</span>'
      )
    ),
    W.section('Admin Panel (30+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">Dashboard with KPIs & Charts</span><span class="action">P12</span>',
        '<span class="icon">✅</span><span class="text">Product CRUD + Excel Upload</span><span class="action">P13</span>',
        '<span class="icon">✅</span><span class="text">Product Schema Validation</span><span class="action">P14</span>',
        '<span class="icon">✅</span><span class="text">Category Management</span><span class="action">P15</span>',
        '<span class="icon">✅</span><span class="text">Order Management</span><span class="action">P16</span>',
        '<span class="icon">✅</span><span class="text">User Management</span><span class="action">P17</span>',
        '<span class="icon">✅</span><span class="text">Vendor Management</span><span class="action">P17</span>',
        '<span class="icon">✅</span><span class="text">Partner API Management</span><span class="action">P17</span>',
        '<span class="icon">✅</span><span class="text">Coupon Management</span><span class="action">P18</span>',
        '<span class="icon">✅</span><span class="text">Email Campaign Builder (4-step)</span><span class="action">P18</span>',
        '<span class="icon">✅</span><span class="text">Lead Management</span><span class="action">P19</span>',
        '<span class="icon">✅</span><span class="text">Complaint Management (Images)</span><span class="action">P19</span>',
        '<span class="icon">✅</span><span class="text">Home Page Builder (Drag-Drop)</span><span class="action">P21</span>',
        '<span class="icon">✅</span><span class="text">Hero Slides Management</span><span class="action">P22</span>',
        '<span class="icon">✅</span><span class="text">Advertisements</span><span class="action">P22</span>',
        '<span class="icon">✅</span><span class="text">Testimonials</span><span class="action">P23</span>',
        '<span class="icon">✅</span><span class="text">General Settings</span><span class="action">P24</span>',
        '<span class="icon">✅</span><span class="text">Payment Settings (Razorpay)</span><span class="action">P24</span>',
        '<span class="icon">✅</span><span class="text">Shipping Settings</span><span class="action">P24</span>',
        '<span class="icon">✅</span><span class="text">Email/SMTP Settings</span><span class="action">P24</span>',
        '<span class="icon">✅</span><span class="text">Integrations (KGen/eXlr8)</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Security Headers (CSP)</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Rate Limiting</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Bot Detection</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Blocked Pincodes (3 modes)</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Database Migration</span><span class="action">P25</span>',
        '<span class="icon">✅</span><span class="text">Spin Wheel Notifications</span><span class="action">P23</span>'
      )
    ),
    W.section('Vendor, Software & Gamification (16+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">Vendor Dashboard</span><span class="action">P26</span>',
        '<span class="icon">✅</span><span class="text">Vendor Product Management</span><span class="action">P27</span>',
        '<span class="icon">✅</span><span class="text">Vendor Order Processing</span><span class="action">P27</span>',
        '<span class="icon">✅</span><span class="text">Vendor Payouts</span><span class="action">P26</span>',
        '<span class="icon">✅</span><span class="text">Software Store Listing</span><span class="action">P28</span>',
        '<span class="icon">✅</span><span class="text">Software Product Detail</span><span class="action">P29</span>',
        '<span class="icon">✅</span><span class="text">License Management</span><span class="action">P29</span>',
        '<span class="icon">✅</span><span class="text">License Activation</span><span class="action">P29</span>',
        '<span class="icon">✅</span><span class="text">Spin the Wheel (Admin + Customer)</span><span class="action">P30</span>',
        '<span class="icon">✅</span><span class="text">Lucky Draw Campaigns</span><span class="action">P31</span>',
        '<span class="icon">✅</span><span class="text">Referral Program</span><span class="action">P31</span>',
        '<span class="icon">✅</span><span class="text">Referral Leaderboard</span><span class="action">P31</span>',
        '<span class="icon">✅</span><span class="text">Partner API Dashboard</span><span class="action">P32</span>',
        '<span class="icon">✅</span><span class="text">Partner API Keys</span><span class="action">P32</span>',
        '<span class="icon">✅</span><span class="text">Partner API Docs</span><span class="action">P33</span>',
        '<span class="icon">✅</span><span class="text">Partner Wallet</span><span class="action">P34</span>'
      )
    ),
    W.section('Informational & SEO (14+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">About Us</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Contact Us (Form)</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">FAQ (Accordion)</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Terms of Service</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Privacy Policy</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Shipping Policy</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Return Policy</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Warranty Info</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">E-Waste Policy</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Grievance Officer</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Careers</span><span class="action">P35</span>',
        '<span class="icon">✅</span><span class="text">Store Locator (Map + Stores)</span><span class="action">P36</span>',
        '<span class="icon">✅</span><span class="text">Brand Landing Pages (6+)</span><span class="action">P36</span>',
        '<span class="icon">✅</span><span class="text">Sitemap.xml</span><span class="action">P37</span>',
        '<span class="icon">✅</span><span class="text">Robots.txt</span><span class="action">P37</span>',
        '<span class="icon">✅</span><span class="text">JSON-LD (4 schemas)</span><span class="action">P37</span>',
        '<span class="icon">✅</span><span class="text">Open Graph / Meta Tags</span><span class="action">P37</span>'
      )
    ),
    W.section('Security & Technical (10+ features)', '',
      W.list(
        '<span class="icon">✅</span><span class="text">CSP Headers</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">HSTS (Production)</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">Rate Limiting (In-Memory)</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">Bot Detection</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">AES-256 Encryption</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">HMAC-SHA256 Sessions</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">bcrypt Password Hashing</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">Edge Runtime Safety</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">CSRF Protection</span><span class="action">P38</span>',
        '<span class="icon">✅</span><span class="text">Web Crypto API</span><span class="action">P38</span>'
      )
    )
  ),
  W.footer()
));

module.exports = pages;
