// ===== STOREFRONT PAGES =====

// PAGE: Homepage
pages.push(W.page('Homepage — Hero & Top Navigation', '🏪', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'Products', 'Categories', 'Brands', 'Offers', 'Software'], ['🔍', '❤️', '🛒', '👤']),
  W.section('Sale Banner', '',
    W.alert('🔥 MEGA SALE — Up to 60% OFF on Electronics! Free Delivery on orders above ₹999 | Use Code: MEGA60', 'danger'),
    W.saleBanner()
  ),
  W.section('Hero Slider', '',
    W.card('', '<div style="background:linear-gradient(135deg,#1a1a2e,#e94560);padding:16px;border-radius:6px;color:white"><div style="font-size:10px;opacity:.7">SARA ELECTRONICS</div><div style="font-size:18px;font-weight:800;margin:6px 0">MEGA SALE</div><div style="font-size:12px;margin-bottom:8px">Up to 60% OFF on Premium Electronics</div><div style="display:flex;gap:4px"><span class="btn btn-primary" style="font-size:7px">Shop Now →</span><span class="btn btn-outline" style="font-size:7px;border-color:rgba(255,255,255,.3);color:white">View Deals</span></div></div>', 'card-dark')
  ),
  W.section('Category Showcase', '',
    W.grid('grid-5',
      W.cardIcon('📺', 'Televisions', 'Smart TV, LED, OLED'),
      W.cardIcon('❄️', 'Refrigerators', 'Double Door, Side by Side'),
      W.cardIcon('🌀', 'Washing Machines', 'Front Load, Top Load'),
      W.cardIcon('❄️', 'ACs', 'Split, Window, Inverter'),
      W.cardIcon('📱', 'Mobiles', 'Smartphones, Tablets')
    ),
    W.grid('grid-5 mt-4',
      W.cardIcon('💻', 'Laptops', 'Gaming, Business, Student'),
      W.cardIcon('🔊', 'Speakers', 'Bluetooth, Soundbar'),
      W.cardIcon('🎮', 'Gaming', 'Consoles, Accessories'),
      W.cardIcon('🏠', 'Home', 'Kitchen, Appliances'),
      W.cardIcon('🔧', 'Accessories', 'Cables, Chargers, Cases')
    )
  ),
  W.section('Featured Products', '',
    W.grid('grid-4',
      W.product('Samsung 55" Crystal UHD 4K Smart TV', '₹34,990', '₹54,990', 4.5),
      W.product('LG 8kg Front Load Washing Machine', '₹29,990', '₹42,990', 4.3),
      W.product('Boat Airdopes 141 TWS Earbuds', '₹1,299', '₹4,490', 4.2),
      W.product('HP Pavilion 15 Ryzen 5 Laptop', '₹49,990', '₹69,990', 4.6)
    )
  ),
  W.section('Animated Banners & Brand Marquee', '',
    W.grid('grid-2',
      W.card('', '<div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:10px;border-radius:4px;color:white;text-align:center"><div style="font-size:8px;font-weight:700">GAMING ZONE</div><div style="font-size:6px;opacity:.8">Laptops, Consoles & Accessories</div></div>'),
      W.card('', '<div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:10px;border-radius:4px;color:white;text-align:center"><div style="font-size:8px;font-weight:700">HOME APPLIANCES</div><div style="font-size:6px;opacity:.8">Fridge, Washing Machine, AC</div></div>')
    ),
    W.card('', '<div style="display:flex;gap:16px;align-items:center;padding:8px;background:#f8fafc;border-radius:6px;overflow:hidden"><span style="font-size:10px;font-weight:700;color:#94a3b8">BRANDS</span><span style="font-size:10px;font-weight:700;color:#e94560">Samsung</span><span style="font-size:10px;font-weight:700;color:#3b82f6">LG</span><span style="font-size:10px;font-weight:700;color:#22c55e">Boat</span><span style="font-size:10px;font-weight:700;color:#f59e0b">HP</span><span style="font-size:10px;font-weight:700;color:#a855f7">Sony</span><span style="font-size:10px;font-weight:700;color:#ef4444">Dell</span><span style="font-size:10px;font-weight:700;color:#06b6d4">Lenovo</span></div>')
  )
));

// PAGE: Homepage continued
pages.push(W.page('Homepage — Trust, Testimonials & Footer', '🏪', 'All Visitors',
  W.section('Trust Bar', '',
    W.grid('grid-4',
      W.cardIcon('🚚', 'Free Delivery', 'On orders above ₹999'),
      W.cardIcon('🔒', 'Secure Payment', '100% secure checkout'),
      W.cardIcon('↩️', 'Easy Returns', '7-day return policy'),
      W.cardIcon('💬', '24/7 Support', 'Chat, call, email')
    )
  ),
  W.section('Testimonials', '',
    W.grid('grid-3',
      W.card('', W.avatar('RK') + ' <div style="margin-top:4px;font-size:7px;font-weight:600">Rahul K.</div><div style="font-size:6px;color:#f59e0b">★★★★★</div><div style="font-size:6px;color:#64748b;margin-top:2px">"Excellent service! Got my TV delivered in 2 days. Great packaging."</div>'),
      W.card('', W.avatar('PM') + ' <div style="margin-top:4px;font-size:7px;font-weight:600">Priya M.</div><div style="font-size:6px;color:#f59e0b">★★★★★</div><div style="font-size:6px;color:#64748b;margin-top:2px">"Best prices on Samsung products. Will buy again!"</div>'),
      W.card('', W.avatar('AS') + ' <div style="margin-top:4px;font-size:7px;font-weight:600">Amit S.</div><div style="font-size:6px;color:#f59e0b">★★★★☆</div><div style="font-size:6px;color:#64748b;margin-top:2px">"Good laptop selection. Support team was very helpful."</div>')
    )
  ),
  W.section('Recently Viewed', '',
    W.grid('grid-5',
      W.product('Samsung 55" TV', '₹34,990', '₹54,990', 4.5),
      W.product('Boat Airdopes', '₹1,299', '₹4,490', 4.2),
      W.product('HP Laptop', '₹49,990', '₹69,990', 4.6),
      W.product('LG Washing Machine', '₹29,990', '₹42,990', 4.3),
      W.product('Sony Speaker', '₹3,999', '₹6,999', 4.4)
    )
  ),
  W.section('OTT Section & Site Features', '',
    W.grid('grid-2',
      W.card('', '<div style="background:linear-gradient(135deg,#0f3460,#1a1a2e);padding:10px;border-radius:6px;color:white"><div style="font-size:8px;font-weight:700">📺 OTT SUBSCRIPTIONS</div><div style="font-size:6px;opacity:.8;margin-top:4px">Get free OTT subscriptions with select TV purchases</div><div style="margin-top:6px"><span class="btn btn-primary" style="font-size:6px">Explore Plans</span></div></div>'),
      W.grid('grid-2',
        W.cardIcon('🏆', 'Genuine Products', '100% authentic'),
        W.cardIcon('💰', 'Best Price', 'Price match guarantee'),
        W.cardIcon('🔄', 'Easy Exchange', 'Hassle-free exchange'),
        W.cardIcon('🛡️', 'Warranty', 'Extended warranty options')
      )
    )
  ),
  W.section('Offers Strip & Split Cards', '',
    W.card('', '<div style="display:flex;gap:8px;overflow:hidden;padding:6px;background:#fef2f2;border-radius:6px"><span style="white-space:nowrap;font-size:7px;font-weight:600;color:#e94560">🏷️ BANK OFFER: 10% cashback on HDFC cards</span><span style="white-space:nowrap;font-size:7px;color:#94a3b8">|</span><span style="white-space:nowrap;font-size:7px;font-weight:600;color:#e94560">🏷️ No Cost EMI from ₹3,000/month</span><span style="white-space:nowrap;font-size:7px;color:#94a3b8">|</span><span style="white-space:nowrap;font-size:7px;font-weight:600;color:#e94560">🏷️ Flat ₹500 OFF on first order</span></div>'),
    W.grid('grid-2 mt-4',
      W.card('', '<div style="display:flex;gap:8px;align-items:center"><div style="width:50px;height:50px;background:#e94560;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px">📺</div><div><div style="font-size:8px;font-weight:700">Smart TV Deals</div><div style="font-size:6px;color:#64748b">Starting from ₹14,990</div><div style="font-size:6px;color:#e94560;font-weight:600">Shop Now →</div></div></div>'),
      W.card('', '<div style="display:flex;gap:8px;align-items:center"><div style="width:50px;height:50px;background:#3b82f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px">💻</div><div><div style="font-size:8px;font-weight:700">Laptop Offers</div><div style="font-size:6px;color:#64748b">Starting from ₹29,990</div><div style="font-size:6px;color:#3b82f6;font-weight:600">Shop Now →</div></div></div>')
    )
  ),
  W.section('Footer', '',
    W.card('card-dark', '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:6px"><div><div style="font-weight:700;margin-bottom:4px">About</div><div style="color:#94a3b8">About Us<br>Careers<br>Blog<br>Press</div></div><div><div style="font-weight:700;margin-bottom:4px">Help</div><div style="color:#94a3b8">Contact Us<br>FAQs<br>Shipping<br>Returns</div></div><div><div style="font-weight:700;margin-bottom:4px">Legal</div><div style="color:#94a3b8">Terms<br>Privacy<br>Cookie Policy<br>Grievance</div></div><div><div style="font-weight:700;margin-bottom:4px">Connect</div><div style="color:#94a3b8">Facebook<br>Instagram<br>Twitter<br>YouTube</div></div></div><div style="text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid #334155;color:#475569">© 2026 Sara Electronics. All rights reserved.</div>')
  )
));

// PAGE: Category Page
pages.push(W.page('Category Page — Product Listing', '📂', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'Products', 'Categories', 'Brands', 'Offers'], ['🔍', '❤️', '🛒', '👤']),
  W.breadcrumb('Home', 'Category', 'Televisions'),
  W.section('Filters & Sort', '',
    W.filterBar('All TVs', 'Smart TV', 'LED', 'OLED', 'QLED', '4K', 'Under ₹20K', '₹20K-50K', 'Above ₹50K'),
    W.flex('gap-8 mt-4',
      W.card('Filters', '<div class="stat-row"><span class="label">Brand</span><span class="value">Samsung, LG, Sony</span></div><div class="stat-row"><span class="label">Price</span><span class="value">₹10K — ₹2L</span></div><div class="stat-row"><span class="label">Screen Size</span><span class="value">32" — 75"</span></div><div class="stat-row"><span class="label">Resolution</span><span class="value">4K, Full HD</span></div><div class="stat-row"><span class="label">Rating</span><span class="value">4★ & above</span></div><div class="stat-row"><span class="label">Availability</span><span class="value">In Stock</span></div><div style="margin-top:6px"><span class="btn btn-primary btn-sm">Apply Filters</span> <span class="btn btn-outline btn-sm">Clear All</span></div>', 'card-blue')
    )
  ),
  W.section('Product Grid', '',
    W.grid('grid-4',
      W.product('Samsung 55" Crystal UHD 4K Smart TV', '₹34,990', '₹54,990', 4.5),
      W.product('LG 43" Full HD Smart LED TV', '₹22,990', '₹32,990', 4.3),
      W.product('Sony Bravia 50" 4K OLED TV', '₹89,990', '₹1,29,990', 4.7),
      W.product('TCL 32" HD Smart LED TV', '₹12,990', '₹18,990', 4.1)
    ),
    W.grid('grid-4 mt-4',
      W.product('Hisense 55" QLED 4K TV', '₹39,990', '₹59,990', 4.4),
      W.product('Vu 43" Premium 4K Smart TV', '₹24,990', '₹34,990', 4.2),
      W.product('Redmi 32" HD Smart TV', '₹11,990', '₹16,990', 4.0),
      W.product('OnePlus 55" Q1 Pro QLED', '₹64,990', '₹89,990', 4.6)
    )
  ),
  W.section('Subcategory Marquee', '',
    W.card('', '<div style="display:flex;gap:12px;overflow:hidden;padding:6px;background:#f8fafc;border-radius:6px"><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">Smart TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">LED TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">OLED TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">QLED TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">4K TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">8K TVs</span><span style="white-space:nowrap;font-size:6px;color:#94a3b8">•</span><span style="white-space:nowrap;font-size:6px;color:#e94560;font-weight:600">Google TV</span></div>')
  ),
  W.section('Pagination', '',
    W.flex('flex-center gap-4', W.btn('← Prev', 'btn-outline btn-sm'), W.btn('1', 'btn-primary btn-sm'), W.btn('2', 'btn-outline btn-sm'), W.btn('3', 'btn-outline btn-sm'), W.btn('Next →', 'btn-outline btn-sm'))
  )
));

// PAGE: Product Detail
pages.push(W.page('Product Detail Page', '📦', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home', 'Products', 'Categories', 'Brands', 'Offers'], ['🔍', '❤️', '🛒', '👤']),
  W.breadcrumb('Home', 'Televisions', 'Samsung 55" Crystal UHD 4K Smart TV'),
  W.twoCol(
    // LEFT: Image gallery
    W.section('Image Gallery', '',
      W.card('', '<div style="background:#f1f5f9;height:120px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#cbd5e1">📺</div>', ''),
      W.grid('grid-4 mt-4',
        W.card('', '<div style="background:#f1f5f9;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1">📺</div>'),
        W.card('', '<div style="background:#f1f5f9;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1">📺</div>'),
        W.card('', '<div style="background:#f1f5f9;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1">📺</div>'),
        W.card('', '<div style="background:#f1f5f9;height:30px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1">+</div>')
      )
    ),
    // RIGHT: Product info
    W.section('Product Info', '',
      W.badge('In Stock', 'badge-green'),
      W.card('Samsung 55" Crystal UHD 4K Smart TV (2025 Model)', ''),
      W.card('', '<div style="margin:4px 0"><span style="font-size:16px;font-weight:800;color:#e94560">₹34,990</span><span style="font-size:9px;color:#94a3b8;text-decoration:line-through;margin-left:4px">₹54,990</span><span class="badge badge-green" style="margin-left:4px">36% OFF</span></div><div style="font-size:6px;color:#64748b">Inclusive of all taxes | EMI starts at ₹1,666/month</div>'),
      W.grid('grid-2 mt-4',
        W.card('', '<div style="font-size:6px;color:#64748b;margin-bottom:2px">Size</div><div style="display:flex;gap:4px"><span class="btn btn-outline btn-sm">43"</span><span class="btn btn-primary btn-sm">55"</span><span class="btn btn-outline btn-sm">65"</span><span class="btn btn-outline btn-sm">75"</span></div>'),
        W.card('', '<div style="font-size:6px;color:#64748b;margin-bottom:2px">Color</div><div style="display:flex;gap:4px"><span class="btn btn-primary btn-sm">Black</span><span class="btn btn-outline btn-sm">Silver</span></div>')
      ),
      W.card('Delivery Options', '<div style="display:flex;gap:6px"><input class="form-input" style="flex:1" placeholder="Enter pincode"><span class="btn btn-primary btn-sm">Check</span></div><div style="font-size:6px;color:#22c55e;margin-top:4px">✓ Delivery by Tomorrow | Free</div><div style="font-size:6px;color:#64748b">✓ 7 Days Replacement | Pay on Delivery available</div>'),
      W.flex('gap-4 mt-4', W.btn('Add to Cart', 'btn-primary'), W.btn('Buy Now', 'btn-success'), W.btn('❤️', 'btn-outline'))
    )
  ),
  W.section('Product Tabs', '',
    W.tabs(['Specifications', 'Description', 'Reviews (128)', 'Q&A', 'Warranty']),
    W.card('', '<div class="stat-row"><span class="label">Brand</span><span class="value">Samsung</span></div><div class="stat-row"><span class="label">Model</span><span class="value">UA55CU7700</span></div><div class="stat-row"><span class="label">Display Size</span><span class="value">55 inches (138 cm)</span></div><div class="stat-row"><span class="label">Resolution</span><span class="value">3840 x 2160 (4K UHD)</span></div><div class="stat-row"><span class="label">Refresh Rate</span><span class="value">60 Hz</span></div><div class="stat-row"><span class="label">Smart TV</span><span class="value">Yes (Tizen OS)</span></div><div class="stat-row"><span class="label">HDR</span><span class="value">HDR10+</span></div><div class="stat-row"><span class="label">Ports</span><span class="value">3 HDMI, 1 USB</span></div><div class="stat-row"><span class="label">Warranty</span><span class="value">2 Years Comprehensive</span></div>')
  ),
  W.section('Structured Data (JSON-LD)', '',
    W.code('@context: https://schema.org\n@type: Product\nname: Samsung 55" Crystal UHD 4K Smart TV\nimage: [url]\nbrand: { @type: Brand, name: "Samsung" }\nmpn: UA55CU7700\noffers: {\n  @type: Offer,\n  price: 34990,\n  priceCurrency: "INR",\n  availability: InStock\n}\naggregateRating: { ratingValue: 4.5, reviewCount: 128 }')
  )
));
