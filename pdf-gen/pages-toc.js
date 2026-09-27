const pages = [];
// ===== COVER =====
pages.push(W.cover('E-Commerce Platform', 'Complete Wireframe Document — Every Feature, Every Screen', 'Version 3.0 — June 2026 | Confidential'));

// ===== TABLE OF CONTENTS =====
pages.push(W.page('Table of Contents', '📑', '',
  W.section('Storefront', '🏪',
    W.grid('grid-2',
      W.card('Homepage', 'Hero slider, category showcase, featured products, sale banner, animated banners, brand marquee, testimonials, trust bar, recently viewed, OTT section, site features, offers strip, bank offers marquee, split cards'),
      W.card('Navigation', 'Mega menu, mobile nav, search autocomplete, breadcrumb, user menu, cart icon, compare bar, wishlist'),
      W.card('Category Pages', 'Product grid, filters (price/brand/rating/color/availability), sort options, pagination, subcategory marquee, brand filter, category circles'),
      W.card('Product Detail', 'Image gallery, specs tabs, reviews, delivery estimator, add-to-cart, size/variant selector, structured data, JSON-LD, brand landing page'),
      W.card('Search', 'Search autocomplete, search results, filters, recent searches, trending, search suggestions'),
      W.card('Sale & Offers', 'Sale banner, countdown timer, deal of the day, bank offers, coupon display, offer section, animated banners')
    )
  ),
  W.section('Customer Auth & Cart', '🔐',
    W.grid('grid-2',
      W.card('Authentication', 'Login, signup, forgot password, OTP, Google OAuth, session management, email verification'),
      W.card('Shopping Cart', 'Cart page, mini cart, quantity update, coupon apply, price breakdown, save for later, stock check'),
      W.card('Checkout', 'Multi-step checkout, address selection, payment gateway, Razorpay integration, order summary, delivery options'),
      W.card('Account Dashboard', 'Orders, wishlist, reviews, addresses, profile, notifications, support tickets, recently viewed')
    )
  ),
  W.section('Admin Panel', '⚙️',
    W.grid('grid-2',
      W.card('Dashboard', 'KPIs, charts, recent orders, top products, revenue analytics, sales overview, quick actions'),
      W.card('Product Management', 'CRUD, bulk upload (Excel), variants, pricing, stock, status, categories, brands, specifications, product schema'),
      W.card('Order Management', 'Order list, order detail, status tracking, shipping, refunds, external orders, orders test'),
      W.card('User & Vendor Mgmt', 'User list, roles, vendor management, partner API, commissions, payouts, blocked pincodes'),
      W.card('Content & Marketing', 'Hero slides, advertisements, testimonials, coupons, email campaigns, leads, complaints, notifications'),
      W.card('Home Builder', 'Drag-drop components, hero section, category showcase, featured products, banners, offers, split cards, animated banners, product slides, home components')
    )
  ),
  W.section('Vendor, Software & Gamification', '🎮',
    W.grid('grid-2',
      W.card('Vendor Dashboard', 'Vendor overview, product management, order processing, analytics, payouts, settings'),
      W.card('Software Store', 'Software listing, product detail, license purchase, license management, activation keys, download'),
      W.card('Spin the Wheel', 'Spin wheel setup, prizes, winners, notifications, spin history, analytics'),
      W.card('Lucky Draw & Referral', 'Lucky draw campaigns, referral program, referral tracking, rewards, leaderboard')
    )
  ),
  W.section('Partner API & Integrations', '🤝',
    W.grid('grid-2',
      W.card('Partner API', 'API keys, API docs, rate limiting, order management, wallet, payouts, webhook, authentication'),
      W.card('Integrations', 'KGen, eXlr8, Razorpay, Firebase, Amazon scraper, email service, WhatsApp')
    )
  ),
  W.section('Informational & SEO', '🔍',
    W.grid('grid-2',
      W.card('Informational Pages', 'About, contact, terms, privacy, shipping policy, return policy, warranty, e-waste, grievance officer, careers, FAQ'),
      W.card('Store Locator', 'Store map, store details, directions, blocked pincodes, delivery areas'),
      W.card('SEO Features', 'Sitemap, robots.txt, structured data, JSON-LD, Open Graph, canonical URLs, hreflang, metadata, breadcrumbs'),
      W.card('Security', 'CSP headers, rate limiting, bot detection, encryption, session management, CSRF protection')
    )
  )
));
