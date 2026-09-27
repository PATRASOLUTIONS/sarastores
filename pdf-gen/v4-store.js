// CATEGORY, PRODUCT DETAIL, AUTH, CART, CHECKOUT PAGES

pages.push(W.page('Category Page', '📂', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Products','Categories','Brands','Offers'], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Category', 'Televisions'),
  W.sec('Filters & Sort',
    W.filterBar('All TVs','Smart TV','LED','OLED','QLED','4K','Under ₹20K','₹20K-50K','Above ₹50K')
  ),
  W.grid('grid-2',
    W.sec('Filter Sidebar',
      W.card('Brand', '<div style="font-size:6px;display:flex;flex-direction:column;gap:4px"><label><input type="checkbox" checked> Samsung (12)</label><label><input type="checkbox" checked> LG (8)</label><label><input type="checkbox"> Sony (6)</label><label><input type="checkbox"> TCL (5)</label></div>'),
      W.card('Price Range', '<div style="display:flex;gap:4px"><input class="fi" style="width:50%" placeholder="Min"><input class="fi" style="width:50%" placeholder="Max"></div><div style="margin-top:4px"><span class="btn btn-primary btn-sm">Apply</span></div>'),
      W.card('Rating', '<div style="font-size:6px;display:flex;flex-direction:column;gap:4px"><label><input type="checkbox"> ★★★★★ (4.5+)</label><label><input type="checkbox" checked> ★★★★ (4.0+)</label><label><input type="checkbox"> ★★★ (3.0+)</label></div>'),
      W.card('Availability', '<label style="font-size:6px"><input type="checkbox" checked> In Stock Only</label>')
    ),
    W.sec('Product Grid',
      W.grid('grid-3',
        W.prod('Samsung 55" Crystal UHD 4K TV', '₹34,990', '₹54,990', 4.5),
        W.prod('LG 43" Full HD Smart LED', '₹22,990', '₹32,990', 4.3),
        W.prod('Sony Bravia 50" 4K OLED', '₹89,990', '₹1,29,990', 4.7),
        W.prod('TCL 32" HD Smart LED', '₹12,990', '₹18,990', 4.1),
        W.prod('Hisense 55" QLED 4K', '₹39,990', '₹59,990', 4.4),
        W.prod('Vu 43" Premium 4K', '₹24,990', '₹34,990', 4.2)
      ),
      W.flex('flex-center gap-4 mt-8', W.btn('← Prev','btn-outline btn-sm'), W.btn('1','btn-primary btn-sm'), W.btn('2','btn-outline btn-sm'), W.btn('3','btn-outline btn-sm'), W.btn('Next →','btn-outline btn-sm'))
    )
  )
));

pages.push(W.page('Product Detail Page', '📦', 'All Visitors',
  W.topbar('SARA ELECTRONICS', ['Home','Products','Categories','Brands','Offers'], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Televisions', 'Samsung 55" Crystal UHD 4K Smart TV'),
  W.twoCol(
    W.sec('Image Gallery',
      W.card('', '<div style="background:#F1F5F9;height:140px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:48px;color:#CBD5E1">📺</div>'),
      W.grid('grid-4 mt-4',
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">📺</div>'),
        W.card('', '<div style="background:#F1F5F9;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#CBD5E1">+</div>')
      )
    ),
    W.sec('Product Info',
      W.badge('In Stock','badge-green'),
      W.card('Samsung 55" Crystal UHD 4K Smart TV (2025)', ''),
      W.card('', '<div style="margin:4px 0"><span style="font-size:16px;font-weight:800;color:#FF6B35">₹34,990</span><span style="font-size:9px;color:#94A3B8;text-decoration:line-through;margin-left:4px">₹54,990</span><span class="badge badge-green" style="margin-left:4px">36% OFF</span></div><div style="font-size:6px;color:#64748B">Inclusive of all taxes | EMI starts at ₹1,666/month</div>'),
      W.grid('grid-2 mt-4',
        W.card('Size', '<div style="display:flex;gap:4px"><span class="btn btn-outline btn-sm">43"</span><span class="btn btn-primary btn-sm">55"</span><span class="btn btn-outline btn-sm">65"</span></div>'),
        W.card('Color', '<div style="display:flex;gap:4px"><span class="btn btn-primary btn-sm">Black</span><span class="btn btn-outline btn-sm">Silver</span></div>')
      ),
      W.card('Delivery', '<div style="display:flex;gap:6px"><input class="fi" style="flex:1" placeholder="Enter pincode"><span class="btn btn-primary btn-sm">Check</span></div><div style="font-size:6px;color:#059669;margin-top:4px">✓ Delivery by Tomorrow | Free</div>'),
      W.flex('gap-4 mt-4', W.btn('Add to Cart','btn-primary'), W.btn('Buy Now','btn-accent'), W.btn('❤️','btn-outline'))
    )
  ),
  W.sec('Product Tabs',
    W.tabs(['Specifications','Description','Reviews (128)','Q&A','Warranty']),
    W.card('', '<div class="stat-row"><span class="label">Brand</span><span class="value">Samsung</span></div><div class="stat-row"><span class="label">Model</span><span class="value">UA55CU7700</span></div><div class="stat-row"><span class="label">Display</span><span class="value">55" 4K UHD (3840x2160)</span></div><div class="stat-row"><span class="label">Smart TV</span><span class="value">Yes (Tizen OS)</span></div><div class="stat-row"><span class="label">HDR</span><span class="value">HDR10+</span></div><div class="stat-row"><span class="label">Ports</span><span class="value">3 HDMI, 1 USB</span></div><div class="stat-row"><span class="label">Warranty</span><span class="value">2 Years Comprehensive</span></div>')
  ),
  W.sec('Structured Data (JSON-LD)',
    W.code('@type: Product\nname: Samsung 55" Crystal UHD 4K Smart TV\nbrand: Samsung\nmpn: UA55CU7700\noffers: { price: 34990, currency: INR, availability: InStock }\naggregateRating: { ratingValue: 4.5, reviewCount: 128 }')
  )
));

// AUTH PAGES
pages.push(W.page('Login Page (Split-Screen)', '🔐', 'Unauthenticated',
  W.twoCol(
    W.card('', '<div style="background:linear-gradient(135deg,#2A7FFF,#1E5FCC,#0F3460);border-radius:12px;padding:24px;color:white;min-height:300px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:16px;font-weight:800;font-family:Poppins;margin-bottom:12px">Welcome back to<br>Sara Electronics</div><div style="font-size:7px;opacity:.8;line-height:1.8"><div style="margin-bottom:6px">⚡ Fast Checkout</div><div style="margin-bottom:6px">🎁 Exclusive Deals</div><div>🛡️ Priority Support</div></div></div>'),
    W.card('', '<div style="padding:16px"><div style="font-size:6px;color:#64748B;margin-bottom:4px">← Back to store</div><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Sign in</div><div style="font-size:7px;margin-bottom:12px">Don\'t have an account? <span style="color:#2A7FFF;font-weight:600">Create one</span></div><div style="display:flex;gap:6px;border:1px solid #E2E8F0;border-radius:8px;padding:8px;justify-content:center;margin-bottom:12px;font-size:7px">🔵 Continue with Google</div><div style="text-align:center;font-size:6px;color:#94A3B8;margin-bottom:8px">or sign in with email</div>' + W.fg('Email','email','you@example.com') + W.fg('Password','password','••••••••') + '<div style="display:flex;justify-content:space-between;font-size:6px;margin:8px 0"><label><input type="checkbox"> Remember me</label><span style="color:#2A7FFF;cursor:pointer">Forgot password?</span></div>' + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px">Sign in</span><div style="font-size:5px;color:#94A3B8;text-align:center;margin-top:8px">By signing in, you agree to our Terms & Privacy Policy</div></div>')
  )
));

pages.push(W.page('Signup & Forgot Password', '🔐', 'Unauthenticated',
  W.twoCol(
    W.card('', '<div style="padding:16px"><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Create Account</div>' + W.fr(W.fg('First Name'), W.fg('Last Name')) + W.fg('Email','email') + W.fg('Phone','tel') + W.fg('Password','password') + W.fg('Confirm Password','password') + '<div style="font-size:6px;margin:8px 0"><input type="checkbox"> I agree to <span style="color:#2A7FFF">Terms</span> & <span style="color:#2A7FFF">Privacy Policy</span></div>' + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px">Create Account</span><div style="font-size:7px;text-align:center;margin-top:8px">Already have an account? <span style="color:#2A7FFF;font-weight:600">Sign in</span></div></div>'),
    W.card('', '<div style="padding:16px"><div style="font-size:14px;font-weight:800;font-family:Poppins;margin-bottom:12px">Reset Password</div><div style="font-size:7px;color:#64748B;margin-bottom:12px">Enter your email to receive a reset link</div>' + W.fg('Email','email','you@example.com') + '<span class="btn btn-primary" style="width:100%;text-align:center;padding:8px;border-radius:8px;margin-top:8px">Send Reset Link</span><div style="font-size:7px;text-align:center;margin-top:12px">Remember your password? <span style="color:#2A7FFF;font-weight:600">Sign in</span></div></div>')
  )
));

// CART
pages.push(W.page('Shopping Cart', '🛒', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🔍','❤️','🛒','👤']),
  W.breadcrumb('Home', 'Shopping Cart'),
  W.sec('Cart Items & Order Summary',
    W.twoCol(
      W.card('', '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:8px;color:#64748B">Continue Shopping</span><span style="font-size:8px;color:#DC2626;cursor:pointer;font-weight:600">Clear Cart</span></div>' +
        '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;margin-bottom:8px;display:flex;gap:10px"><div style="width:80px;height:80px;background:#F1F5F9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#CBD5E1">📺</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Samsung 55" Crystal UHD 4K TV</div><div style="font-size:6px;color:#64748B">SKU: SAM-55-CU7700 | Size: 55"</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">−</span><span style="padding:2px 8px;font-size:8px">1</span><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">+</span></div><span style="font-size:10px;font-weight:700;color:#FF6B35">₹34,990</span></div></div><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:10px;cursor:pointer">❤️</span><span style="font-size:10px;cursor:pointer;color:#DC2626">🗑️</span></div></div>' +
        '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;display:flex;gap:10px"><div style="width:80px;height:80px;background:#F1F5F9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#CBD5E1">🎧</div><div style="flex:1"><div style="font-size:8px;font-weight:600">Boat Airdopes 141 TWS Earbuds</div><div style="font-size:6px;color:#64748B">Color: Black</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="display:flex;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden"><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">−</span><span style="padding:2px 8px;font-size:8px">2</span><span style="padding:2px 8px;font-size:8px;cursor:pointer;background:#F8FAFC">+</span></div><span style="font-size:10px;font-weight:700;color:#FF6B35">₹2,598</span></div></div><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:10px;cursor:pointer">❤️</span><span style="font-size:10px;cursor:pointer;color:#DC2626">🗑️</span></div></div>'),
      W.card('', '<div style="position:sticky;top:24px"><div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Order Summary</div><div style="display:flex;gap:6px;margin-bottom:8px"><input class="fi" style="flex:1" placeholder="Coupon code"><span class="btn btn-primary btn-sm">Apply</span></div>' + W.statRow('Subtotal (3 items)','₹37,588') + W.statRow('GST (18%)','₹6,766') + W.statRow('Shipping','<span style="color:#059669">FREE</span>') + '<div class="stat-row" style="border-top:2px solid #E2E8F0;padding-top:6px;margin-top:4px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#FF6B35;font-size:12px">₹44,354</span></div><span class="btn btn-accent" style="width:100%;text-align:center;padding:8px;border-radius:8px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:4px">💳 Proceed to Checkout</span><div style="font-size:6px;color:#64748B;text-align:center;margin-top:6px">🔒 Secure checkout powered by Razorpay</div></div>')
    )
  )
));

// CHECKOUT
pages.push(W.page('Checkout (Multi-Step)', '💳', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🛒','👤']),
  W.steps(['Customer Details','Payment'], 0),
  W.twoCol(
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Customer Details</div>' +
      W.fr(W.fg('First Name'), W.fg('Last Name')) +
      W.fr(W.fg('Email','email'), W.fg('Phone','tel')) +
      W.fg('Address Line 1','text','Street address') +
      W.fg('Address Line 2','text','Apt, suite (optional)') +
      W.fr(W.fg('City'), W.fg('State')) +
      W.fr(W.fg('PIN Code'), W.fg('Country')) +
      '<div style="display:flex;gap:6px;margin-top:12px"><span class="btn btn-outline" style="flex:1;text-align:center">Back</span><span class="btn btn-accent" style="flex:1;text-align:center">Continue to Payment →</span></div>'),
    W.card('', '<div style="position:sticky;top:4px"><div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Order Summary</div>' +
      '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9"><div style="width:40px;height:40px;background:#F1F5F9;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">📺</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Samsung 55" TV × 1</div><div style="font-size:8px;font-weight:700;color:#FF6B35">₹34,990</div></div></div>' +
      '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9"><div style="width:40px;height:40px;background:#F1F5F9;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">🎧</div><div style="flex:1"><div style="font-size:7px;font-weight:600">Boat Airdopes × 2</div><div style="font-size:8px;font-weight:700;color:#FF6B35">₹2,598</div></div></div>' +
      W.statRow('Subtotal','₹37,588') + W.statRow('GST','₹6,766') + W.statRow('Shipping','<span style="color:#059669">FREE</span>') + '<div class="stat-row" style="border-top:2px solid #E2E8F0;padding-top:6px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#FF6B35;font-size:12px">₹44,354</span></div></div>')
  )
));

pages.push(W.page('Checkout - Payment & Confirmation', '✅', 'Authenticated Users',
  W.steps(['Customer Details','Payment'], 1),
  W.twoCol(
    W.card('', '<div style="font-size:9px;font-weight:700;margin-bottom:8px;font-family:Poppins">Payment Method</div>' +
      '<div style="border:2px solid #2A7FFF;border-radius:12px;padding:10px;margin-bottom:6px;background:#EFF6FF"><div style="font-size:7px;font-weight:600">💳 Online Payment (Razorpay)</div><div style="font-size:6px;color:#64748B">UPI, Cards, Net Banking, Wallets</div></div>' +
      '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px;margin-bottom:6px"><div style="font-size:7px;font-weight:600">🏪 In-Store Purchase</div><div style="font-size:6px;color:#64748B">Visit store with employee verification</div></div>' +
      '<div style="display:flex;gap:6px;margin-top:12px"><span class="btn btn-outline" style="flex:1;text-align:center">Back</span><span class="btn btn-accent" style="flex:1;text-align:center">Pay ₹44,354 →</span></div>'),
    W.card('', '<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:8px">✅</div><div style="font-size:14px;font-weight:800;color:#059669;font-family:Poppins">Order Confirmed!</div><div style="font-size:7px;color:#64748B;margin-top:4px">Order #SARA-2026-4521</div><div style="font-size:6px;color:#64748B;margin-top:2px">Confirmation sent to rahul@email.com</div></div>' +
      W.card('card-blue', '<div style="font-size:7px;font-weight:600;margin-bottom:4px">📦 Order Tracking</div>' + W.steps(['Confirmed','Picked','Shipped','Delivered'], 2)) +
      W.statRow('Payment','Razorpay UPI') + W.statRow('Delivery By','June 21, 2026') +
      '<div style="display:flex;gap:6px;margin-top:8px"><span class="btn btn-primary" style="flex:1;text-align:center">Track Order</span><span class="btn btn-outline" style="flex:1;text-align:center">Continue Shopping</span></div>')
  )
));
