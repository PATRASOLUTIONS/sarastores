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
