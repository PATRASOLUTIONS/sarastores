// ===== AUTH, CART, CHECKOUT PAGES =====

// PAGE: Auth Pages
pages.push(W.page('Authentication — Login & Signup', '🔐', 'Unauthenticated Users',
  W.twoCol(
    // LOGIN
    W.section('Login', '',
      W.card('', '<div style="text-align:center;padding:10px"><div style="font-size:24px;margin-bottom:6px">🔐</div><div style="font-size:12px;font-weight:700;margin-bottom:8px">Welcome Back</div></div>'),
      W.formGroup('Email Address', 'email', 'you@example.com'),
      W.formGroup('Password', 'password', '••••••••'),
      W.flex('flex-between', W.card('', '<span style="font-size:6px"><input type="checkbox"> Remember me</span>'), W.card('', '<span style="font-size:6px;color:#e94560;cursor:pointer">Forgot Password?</span>')),
      W.btn('Login', 'btn-primary w-full'),
      W.card('card-blue mt-4', '<div style="text-align:center;font-size:7px">Or continue with</div><div style="display:flex;gap:6px;justify-content:center;margin-top:6px"><span class="btn btn-outline btn-sm">🔵 Google</span><span class="btn btn-outline btn-sm">📱 OTP</span></div>'),
      W.card('card-green mt-4', '<div style="text-align:center;font-size:7px">Don\'t have an account? <span style="color:#e94560;font-weight:600">Sign Up</span></div>')
    ),
    // SIGNUP
    W.section('Signup', '',
      W.card('', '<div style="text-align:center;padding:10px"><div style="font-size:24px;margin-bottom:6px">👤</div><div style="font-size:12px;font-weight:700;margin-bottom:8px">Create Account</div></div>'),
      W.formRow(W.formGroup('First Name', 'text'), W.formGroup('Last Name', 'text')),
      W.formGroup('Email Address', 'email', 'you@example.com'),
      W.formGroup('Phone Number', 'tel', '+91 98765 43210'),
      W.formGroup('Password', 'password', '••••••••'),
      W.formGroup('Confirm Password', 'password', '••••••••'),
      W.card('', '<div style="font-size:6px"><input type="checkbox"> I agree to the <span style="color:#e94560">Terms of Service</span> and <span style="color:#e94560">Privacy Policy</span></div>'),
      W.btn('Create Account', 'btn-primary w-full'),
      W.card('card-blue mt-4', '<div style="text-align:center;font-size:7px">Already have an account? <span style="color:#e94560;font-weight:600">Login</span></div>')
    )
  )
));

// PAGE: Forgot Password & OTP
pages.push(W.page('Authentication — Password Reset & OTP', '🔐', 'Unauthenticated Users',
  W.twoCol(
    W.section('Forgot Password', '',
      W.card('', '<div style="text-align:center;padding:10px"><div style="font-size:24px;margin-bottom:6px">🔑</div><div style="font-size:12px;font-weight:700;margin-bottom:8px">Reset Password</div><div style="font-size:7px;color:#64748b">Enter your email to receive a reset link</div></div>'),
      W.formGroup('Email Address', 'email', 'you@example.com'),
      W.btn('Send Reset Link', 'btn-primary w-full'),
      W.card('card-green mt-4', '<div style="text-align:center;font-size:7px">Remember your password? <span style="color:#e94560;font-weight:600">Login</span></div>')
    ),
    W.section('OTP Verification', '',
      W.card('', '<div style="text-align:center;padding:10px"><div style="font-size:24px;margin-bottom:6px">📱</div><div style="font-size:12px;font-weight:700;margin-bottom:8px">Enter OTP</div><div style="font-size:7px;color:#64748b">We sent a 6-digit code to +91 98765 43210</div></div>'),
      W.flex('gap-4 flex-center',
        W.formGroup('', 'text'), W.formGroup('', 'text'), W.formGroup('', 'text'),
        W.formGroup('', 'text'), W.formGroup('', 'text'), W.formGroup('', 'text')
      ),
      W.btn('Verify OTP', 'btn-primary w-full mt-8'),
      W.card('card-blue mt-4', '<div style="text-align:center;font-size:7px">Didn\'t receive code? <span style="color:#e94560;font-weight:600">Resend OTP</span> (30s)</div>')
    )
  )
));

// PAGE: Cart
pages.push(W.page('Shopping Cart', '🛒', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', ['Home', 'Products', 'Categories', 'Brands', 'Offers'], ['🔍', '❤️', '🛒', '👤']),
  W.section('Cart Items', '',
    W.table(
      ['Product', 'Price', 'Quantity', 'Total', 'Action'],
      [
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:30px;height:30px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px">📺</div><div><div style="font-weight:600">Samsung 55" TV</div><div style="color:#64748b;font-size:6px">Size: 55" | Color: Black</div></div></div>', '₹34,990', '<div style="display:flex;gap:4px;align-items:center"><span class="btn btn-outline btn-sm">−</span><span style="padding:2px 8px;border:1px solid #e2e8f0;border-radius:4px;font-size:7px">1</span><span class="btn btn-outline btn-sm">+</span></div>', '₹34,990', '<span class="btn btn-danger btn-sm">🗑️</span>'],
        ['<div style="display:flex;gap:6px;align-items:center"><div style="width:30px;height:30px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px">🎧</div><div><div style="font-weight:600">Boat Airdopes 141</div><div style="color:#64748b;font-size:6px">Color: Black</div></div></div>', '₹1,299', '<div style="display:flex;gap:4px;align-items:center"><span class="btn btn-outline btn-sm">−</span><span style="padding:2px 8px;border:1px solid #e2e8f0;border-radius:4px;font-size:7px">2</span><span class="btn btn-outline btn-sm">+</span></div>', '₹2,598', '<span class="btn btn-danger btn-sm">🗑️</span>']
      ]
    )
  ),
  W.twoCol(
    W.section('Coupon Code', '',
      W.card('Apply Coupon', '<div style="display:flex;gap:6px"><input class="form-input" placeholder="Enter coupon code"><span class="btn btn-primary btn-sm">Apply</span></div><div style="font-size:6px;color:#64748b;margin-top:4px">Try: MEGA60 for 60% OFF</div>'),
      W.card('card-green', '<div style="font-size:7px">🏷️ MEGA60 applied! You saved ₹3,000</div>')
    ),
    W.section('Price Summary', '',
      W.card('', '<div class="stat-row"><span class="label">Subtotal (3 items)</span><span class="value">₹37,588</span></div><div class="stat-row"><span class="label">Discount</span><span class="value" style="color:#22c55e">-₹3,000</span></div><div class="stat-row"><span class="label">Shipping</span><span class="value" style="color:#22c55e">FREE</span></div><div class="stat-row"><span class="label">Tax</span><span class="value">₹4,500</span></div><div class="stat-row" style="border-top:2px solid #e2e8f0;padding-top:6px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#e94560;font-size:12px">₹39,088</span></div><div style="margin-top:8px"><span class="btn btn-success w-full">Proceed to Checkout →</span></div>')
    )
  ),
  W.section('Save for Later', '',
    W.grid('grid-4',
      W.product('LG Washing Machine', '₹29,990', '₹42,990', 4.3),
      W.product('HP Laptop', '₹49,990', '₹69,990', 4.6),
      W.product('Sony Speaker', '₹3,999', '₹6,999', 4.4),
      W.product('Dell Monitor', '₹14,990', '₹22,990', 4.5)
    )
  )
));

// PAGE: Checkout
pages.push(W.page('Checkout — Multi-Step Flow', '💳', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🛒', '👤']),
  W.steps(['Address', 'Payment', 'Confirmation'], 1),
  W.twoCol(
    W.section('Shipping Address', '',
      W.card('card-accent', '<div style="font-size:7px"><strong>Rahul Kumar</strong><br>123, MG Road, Sector 5<br>Noida, UP - 201301<br>Phone: +91 98765 43210</div><div style="margin-top:4px"><span class="btn btn-outline btn-sm">Change</span> <span class="btn btn-outline btn-sm">Edit</span></div>'),
      W.card('Or add new address', ''),
      W.formRow(W.formGroup('Full Name', 'text'), W.formGroup('Phone', 'tel')),
      W.formGroup('Address Line 1', 'text', 'Street address'),
      W.formGroup('Address Line 2', 'text', 'Apt, suite (optional)'),
      W.formRow(W.formGroup('City', 'text'), W.formGroup('State', 'text')),
      W.formRow(W.formGroup('PIN Code', 'text'), W.formGroup('Country', 'text'))
    ),
    W.section('Order Summary', '',
      W.card('', '<div class="stat-row"><span class="label">Samsung 55" TV × 1</span><span class="value">₹34,990</span></div><div class="stat-row"><span class="label">Boat Airdopes × 2</span><span class="value">₹2,598</span></div><div class="stat-row"><span class="label">Discount (MEGA60)</span><span class="value" style="color:#22c55e">-₹3,000</span></div><div class="stat-row"><span class="label">Shipping</span><span class="value" style="color:#22c55e">FREE</span></div><div class="stat-row"><span class="label">Tax</span><span class="value">₹4,500</span></div><div class="stat-row" style="border-top:2px solid #e2e8f0;padding-top:6px"><span class="label" style="font-weight:700">Total</span><span class="value" style="color:#e94560;font-size:12px">₹39,088</span></div>'),
      W.section('Payment Method', '',
        W.card('card-accent', '<div style="font-size:7px;display:flex;align-items:center;gap:6px"><input type="radio" checked> <strong>Razorpay UPI</strong></div><div style="font-size:6px;color:#64748b;margin-top:2px">Pay via Google Pay, PhonePe, Paytm</div>'),
        W.card('', '<div style="font-size:7px;display:flex;align-items:center;gap:6px"><input type="radio"> <strong>Credit/Debit Card</strong></div><div style="font-size:6px;color:#64748b;margin-top:2px">Visa, Mastercard, RuPay</div>'),
        W.card('', '<div style="font-size:7px;display:flex;align-items:center;gap:6px"><input type="radio"> <strong>Net Banking</strong></div><div style="font-size:6px;color:#64748b;margin-top:2px">All major banks</div>'),
        W.card('', '<div style="font-size:7px;display:flex;align-items:center;gap:6px"><input type="radio"> <strong>Cash on Delivery</strong></div><div style="font-size:6px;color:#64748b;margin-top:2px">Additional ₹99 COD charges</div>'),
        W.card('', '<div style="font-size:7px;display:flex;align-items:center;gap:6px"><input type="radio"> <strong>EMI</strong></div><div style="font-size:6px;color:#64748b;margin-top:2px">No Cost EMI from ₹1,666/month</div>')
      ),
      W.btn('Pay ₹39,088 →', 'btn-success w-full mt-8')
    )
  )
));

// PAGE: Checkout Confirmation
pages.push(W.page('Order Confirmation', '✅', 'Authenticated Users',
  W.topbar('SARA ELECTRONICS', [], ['🛒', '👤']),
  W.card('', '<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:8px">✅</div><div style="font-size:16px;font-weight:800;color:#22c55e">Order Placed Successfully!</div><div style="font-size:9px;color:#64748b;margin-top:4px">Order #SARA-2026-4521 | Confirmation sent to rahul@email.com</div></div>'),
  W.card('card-green', '<div style="font-size:8px;font-weight:600;margin-bottom:6px">📦 Order Tracking</div>', W.tracking('Order Confirmed', 'Picked', 'Shipped', 'Out for Delivery', 'Delivered', 2)),
  W.twoCol(
    W.section('Order Details', '',
      W.card('', '<div class="stat-row"><span class="label">Order Date</span><span class="value">June 19, 2026</span></div><div class="stat-row"><span class="label">Payment</span><span class="value">Razorpay UPI</span></div><div class="stat-row"><span class="label">Delivery By</span><span class="value">June 21, 2026</span></div><div class="stat-row"><span class="label">Shipping Address</span><span class="value">123, MG Road, Noida</span></div>')
    ),
    W.section('Actions', '',
      W.btn('Track Order', 'btn-primary w-full mb-4'),
      W.btn('Continue Shopping', 'btn-outline w-full mb-4'),
      W.btn('Download Invoice', 'btn-outline w-full')
    )
  ),
  W.section('Recommended Products', '',
    W.grid('grid-4',
      W.product('Samsung Soundbar', '₹8,990', '₹14,990', 4.5),
      W.product('HDMI Cable 4K', '₹599', '₹1,299', 4.3),
      W.product('TV Wall Mount', '₹1,299', '₹2,499', 4.2),
      W.product('Samsung Remote', '₹1,499', '₹2,999', 4.4)
    )
  )
));
