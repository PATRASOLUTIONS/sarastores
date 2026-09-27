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
