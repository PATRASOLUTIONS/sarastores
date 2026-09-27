"use client"

import {
    Book, CheckCircle, Code, Cpu, Database, Globe, Layers, Layout, Lock,
    Server, Settings, ShoppingBag, ShoppingCart, Smartphone, Star, Zap,
    Truck, ShieldCheck, Mail, FileText, Users, CreditCard, MapPin,
    Monitor, Package, Bell, Key, RefreshCw, Wrench, Search, AlertTriangle,
    Gift, Heart, Menu, Home, Box, BarChart, UserCheck, HelpCircle, Briefcase,
    KeyRound, Tv, MessageSquare, BadgePercent, FileSpreadsheet, Contact2, FolderTree,
    Info, ExternalLink, ArrowRight, LayoutTemplate, Download, Clock, Palette, Store, UserPlus
} from "lucide-react"
import Link from "next/link"

export default function DocumentationPage() {

    const adminModules = [
        {
            name: "Dashboard",
            path: "/admin/dashboard",
            icon: <LayoutDashboardIcon />,
            desc: "Central command center.",
            features: ["Real-time Revenue & Order Stats", "Visual Sales Graphs", "Recent Activity Feed", "Low Stock Alerts"]
        },
        {
            name: "Products",
            path: "/admin/products",
            icon: <ShoppingBag className="h-4 w-4" />,
            desc: "Complete catalog management.",
            features: ["Add New Products", "Update Prices", "Clear Database", "Products Upload Excel", "Export", "Activate All", "Bulk Update MRP", "Add/Edit/Delete Products", "Rich Text Description", "Image Gallery Uploader", "Trusted Badge"]
        },
        { name: "Customer Centric", path: "/admin/customer-centric", icon: <MessageSquare className="h-4 w-4" />, desc: "User feedback & engagement.", features: ["Send Promotional Content", "Save all Template for future uses", "Email & WhatsApp Templates", "Template History"] },
        { name: "Product Specifications", path: "/admin/product-specifications", icon: <FileSpreadsheet className="h-4 w-4" />, desc: "Technical data templates.", features: ["Product Specifications Upload", "Assign Specs to Amazon Specifications", "Lock the file to prevent deletion", "Spec Template Management"] },
        { name: "Site Features", path: "/admin/features", icon: <Star className="h-4 w-4" />, desc: "Dynamic trust badges.", features: ["Create 'Key Features'", "Assign Icons & Colors", "Toggle Visibility", "Reorder Features"] },
        { name: "Promotions", path: "/admin/promotions", icon: <BadgePercent className="h-4 w-4" />, desc: "Sales and discounts.", features: ["Create Coupon Codes", "Set Discount Rules", "Usage Limits", "Add/Edit/Delete Coupons", "Usage Logs", "Percentage & Flat Discounts"] },
        { name: "Homepage Sections", path: "/admin/home-components", icon: <Layers className="h-4 w-4" />, desc: "Storefront merchandising order.", features: ["Publish or hide sections", "Configure category rails", "Curate product collections", "Reorder storefront sections"] },
        { name: "Customers", path: "/admin/customers", icon: <Users className="h-4 w-4" />, desc: "User database.", features: ["View Registered Users", "Order History", "Total Spending", "Details Management", "Customer Segmentation"] },
        { name: "Orders", path: "/admin/orders", icon: <FileText className="h-4 w-4" />, desc: "Order processing.", features: ["View New Orders", "Update orders Status", "Check order details", "Check order type", "Check order payment status", "Check order delivery status", "Bulk Update Orders"] },
        { name: "Complaints", path: "/admin/complaints", icon: <AlertTriangle className="h-4 w-4" />, desc: "Support ticket system.", features: ["View User Complaints", "Update Status", "Agent Responses", "Refund Status", "Failed Payment Analysis", "Priority Assignment"] },
        { name: "Contact Inquiries", path: "/admin/contact-inquiries", icon: <Contact2 className="h-4 w-4" />, desc: "General queries.", features: ["View Form Submissions", "Email Integration", "Contact Inquiries Analysis", "Response Tracking"] },
        { name: "Spin Wheel", path: "/admin/spin-wheel", icon: <Gift className="h-4 w-4" />, desc: "Gamification campaigns.", features: ["Create Spin Campaigns", "Configure Prize Wheel", "Set Win Probabilities", "Campaign Analytics", "User Participation Tracking"] },
        { name: "Spin Campaigns", path: "/admin/spin-wheel/campaigns", icon: <RefreshCw className="h-4 w-4" />, desc: "Manage spin campaigns.", features: ["View All Campaigns", "Activate/Deactivate", "Campaign Performance", "Prize Distribution Logs"] },
        { name: "Custom Pages", path: "/admin/campaign-pages", icon: <LayoutTemplate className="h-4 w-4" />, desc: "Landing page builder.", features: ["Create Campaign Pages", "Custom Layouts", "SEO Settings", "Page Analytics", "Scheduled Publishing"] },
        { name: "Leads", path: "/admin/leads", icon: <Users className="h-4 w-4" />, desc: "Lead management.", features: ["Capture Leads", "Lead Scoring", "Follow-up Reminders", "Lead Status Tracking", "Export Leads"] },
        { name: "Brand Manager", path: "/admin/brands", icon: <Palette className="h-4 w-4" />, desc: "Brand management.", features: ["Add/Edit/Delete Brands", "Brand Logos & Banners", "Brand Pages", "Brand Product Mapping", "Featured Brands"] },
        { name: "Payment History", path: "/admin/payments", icon: <CreditCard className="h-4 w-4" />, desc: "Financial logs.", features: ["Transaction Logs", "Refund Status", "Instore Payments", "Payment Filter & Search", "Revenue Reports"] },
        { name: "Categories", path: "/admin/categories", icon: <FolderTree className="h-4 w-4" />, desc: "Catalog structure.", features: ["Create Main Categories", "Upload Icons", "Enable/Disable", "Category Images", "SEO Metadata"] },
        { name: "Sub-Categories", path: "/admin/sub-categories", icon: <FolderTree className="h-4 w-4 text-gray-500" />, desc: "Nested catalog levels.", features: ["Create Sub Categories", "Upload Icons", "Enable/Disable", "Import from Products", "Parent Category Mapping"] },
        { name: "Product Advertisements", path: "/admin/product-advertisements", icon: <Monitor className="h-4 w-4" />, desc: "Internal ads.", features: ["Inject Ads into Lists", "Manage Banners", "Target URLs", "Ad Scheduling", "Performance Tracking"] },
        { name: "Software Management", path: "/admin/software", icon: <Package className="h-4 w-4" />, desc: "Digital products.", features: ["Add New Software", "Edit Software", "Delete Software", "View Software", "Upload License Keys", "Auto-assign to Software Orders", "Track Usage", "KGen/eXlr8 Integration"] },
        { name: "Blocked Pincodes", path: "/admin/blocked-pincodes", icon: <MapPin className="h-4 w-4" />, desc: "Logistics control.", features: ["Add Non-Serviceable Pincodes", "Bulk Block Regions", "Allowed Pincode Region", "Both List option", "Bulk Upload"] },
        { name: "Store Locations", path: "/admin/store-locations", icon: <MapPin className="h-4 w-4 text-green-600" />, desc: "Physical stores.", features: ["Add Store Locations", "Map Coordinates", "Store Hours", "Contact Details", "Store Images"] },
        { name: "Employees", path: "/admin/employees", icon: <Briefcase className="h-4 w-4" />, desc: "Staff management.", features: ["Create Admin Accounts", "Assign Permissions", "Activity Logging", "Bulk Upload", "Add/Edit/Delete Employees", "Role-based Access Control", "Allowed Pages Configuration"] },
        { name: "Partners", path: "/admin/partners", icon: <Users className="h-4 w-4 text-indigo-600" />, desc: "Partner ecosystem.", features: ["Add/Edit/Delete Partners", "API Key Management", "Partner Products", "Partner Orders", "Wallet & Transactions", "API Documentation"] },
        { name: "Partner Payouts", path: "/admin/partner-payouts", icon: <CreditCard className="h-4 w-4 text-indigo-600" />, desc: "Partner finances.", features: ["Process Payouts", "Transaction History", "Payment Reports", "Wallet Balance", "Payout Scheduling"] },
        { name: "OTT PLAY DASHBOARD", path: "https://ott.systechdigital.co.in/login", icon: <Tv className="h-4 w-4" />, desc: "External link.", features: ["Manage Streaming Services"], external: true },
        { name: "Documentation", path: "/admin/documentation", icon: <Book className="h-4 w-4" />, desc: "This page.", features: ["System Overview", "Feature Reference", "Admin Guide"] },
        { name: "Settings", path: "/admin/settings", icon: <Settings className="h-4 w-4" />, desc: "Global config.", features: ["Site Metadata", "Contact Info", "Social Links", "Logo & Branding", "SEO Settings"] },
        { name: "Integrations", path: "/admin/integrations", icon: <Database className="h-4 w-4" />, desc: "Third-party connections.", features: ["eXlr8/KGen Integration", "Product Sync", "Order Sync", "Transaction History", "Connection Status"] }
    ]

    const semiDynamicPages = [
        {
            name: "Home Page (Landing)",
            path: "/",
            icon: <Home className="h-5 w-5 text-blue-600" />,
            desc: "The dynamic flagship page driven by Admin Components.",
            features: [
                "Layout Engine: Reorder/Toggle sections via Admin",
                "Hero Carousel with Slide Transition",
                "Brand & Sub-Category Marquees (Auto-scroll)",
                "Dynamic Offer Section & 'Recently Viewed' History",
                "Performance: LocalStorage Caching for Layout Config",
                "Recently Viewed Products"
            ]
        },
        {
            name: "Product Detail Page",
            path: "/product/[slug]",
            icon: <Box className="h-5 w-5 text-green-600" />,
            desc: "Data-rich page template for individual items.",
            features: [
                "Cinematic Entrance & Image Gallery Animations",
                "Smart Caching: Instant load on revisit (30min TTL)",
                "Dynamic Trust Badges (Warranty, Returns icons)",
                "Tabbed Specs: Tech Data, Reviews, Manufacturer Info, Gallery, What'sIncluded",
                "Delivery Estimator (Pincode)",
                " Bank Offers Marquee"
            ]
        },
        {
            name: "Product Listing (PLP)",
            path: "/products",
            icon: <LayoutTemplate className="h-5 w-5 text-indigo-600" />,
            desc: "Grid view for browsing catalog.",
            features: [
                "Sidebar Filters: Brand, Price Range, Availability",
                "Sorting: Price (Low/High), Newest, Popularity",
                "Pagination & Lazy Loading",
                "Grid view",
                "Trusted Badge for specific products"
            ]
        },
        {
            name: "Category Page",
            path: "/category/[slug]",
            icon: <Layers className="h-5 w-5 text-purple-600" />,
            desc: "Dynamic routing for product categories.",
            features: [
                "Category-specific Banners",
                "Sub-category Navigation Chips",
                "SEO Friendly URLs",
                "Breadcrumb Navigation",
                "Product Grid with Filters"
            ]
        },
        {
            name: "Brand Pages",
            path: "/brands/[slug]",
            icon: <Palette className="h-5 w-5 text-yellow-600" />,
            desc: "Dynamic brand landing pages.",
            features: [
                "Brand-specific Hero Banners",
                "Curated Product Lists (Filtered by Brand)",
                "Brand Logo & Description",
                "SEO Metadata per Brand",
                "Featured Products Carousel"
            ]
        },
        {
            name: "Brand Microsites",
            path: "/lg, /bosch, /haier",
            icon: <Star className="h-5 w-5 text-yellow-500" />,
            desc: "Exclusive brand zones with custom themes.",
            features: [
                "Brand-specific Hero Banners",
                "Curated Product Lists (Filtered by Brand ID)",
                "Video Backgrounds & Storytelling Elements",
                "Custom Color Themes"
            ]
        },
        {
            name: "Shopping Cart",
            path: "/cart",
            icon: <ShoppingCart className="h-5 w-5 text-teal-600" />,
            desc: "User's basket management.",
            features: [
                "Merge Logic: Guest Cart + User Cart on Login",
                "Live Stock Check & Quantity Adjusters",
                "Coupon Code Input Field with Validation",
                "Price Breakdown (MRP vs Selling Price)"
            ]
        },
        {
            name: "User Dashboard",
            path: "/dashboard",
            icon: <UserCheck className="h-5 w-5 text-orange-600" />,
            desc: "Personalized user area.",
            features: [
                "Order History Table with Status Tracking",
                "Download Invoice Button (PDF)",
                "Address Management",
                "Saved Wishlist Items"
            ]
        },
        {
            name: "Software Store",
            path: "/software",
            icon: <Package className="h-5 w-5 text-cyan-600" />,
            desc: "Digital license marketplace.",
            features: [
                "Hybrid Catalog: Merges Internal & KGen/eXlr8 Products",
                "Smart Filters: OS, pack size, validity, price range",
                "Instant Search with debounced input",
                "Dynamic Pricing Engine (Base + Validity multiplier)"
            ]
        },
        {
            name: "Software Detail Page",
            path: "/software/[id]",
            icon: <Download className="h-5 w-5 text-blue-500" />,
            desc: "Configurable digital product view.",
            features: [
                "License Configurator: Select Pack Size (1-5 users) & Validity (1-5 years)",
                "System Requirements Tab (OS, RAM, Storage)",
                "Instant Delivery Badge (Email fulfillment)",
                "Bulk discounts for multi-year/multi-user packs"
            ]
        }
    ]

    const staticPages = [
        { name: "About Us", path: "/about", desc: "Company credentials.", features: ["Timeline", "Leadership", "Values", "Mission"] },
        { name: "Contact Us", path: "/contact", desc: "Inquiry channel.", features: ["Form", "Maps", "Address", "Phone", "Email"] },
        { name: "Store Locator", path: "/store-locator", desc: "Branch finder.", features: ["City Search", "Map Integration", "Directions", "Store Hours"] },
        { name: "FAQ", path: "/faq", desc: "Customer help.", features: ["Ordering", "Payment", "Shipping", "Returns", "Warranty"] },
        { name: "Privacy Policy", path: "/privacy-policy", desc: "Data rules.", features: ["Data Collection", "Cookies", "Third-party Sharing"] },
        { name: "Terms & Conditions", path: "/terms-and-conditions", desc: "Legal agreement.", features: ["Service Rules", "Liability", "Dispute Resolution"] },
        { name: "Cancellation", path: "/cancellation-policy", desc: "Returns.", features: ["Refund Rules", "Timelines", "Process"] },
        { name: "Licenses", path: "/licenses", desc: "Regulatory info.", features: ["Registrations", "Certs", "Compliance"] },
        { name: "Partner API Docs", path: "/partner-api-docs", desc: "Developer docs.", features: ["Authentication", "Endpoints", "Playground", "SDKs"] },
    ]

    return (
        <div className="min-h-screen bg-gray-50 pb-20 font-sans">
            <div className="max-w-[1600px] mx-auto px-6 py-10">

                <div className="mb-12 border-b border-gray-200 pb-8">
                    <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-4">
                        <Book className="h-10 w-10 text-blue-600" />
                        System Documentation
                    </h1>
                    <p className="mt-4 text-xl text-gray-600">
                        Comprehensive guide to Admin Modules, Core App Pages, and Static Content.
                    </p>
                </div>

                {/* SECTION 1: ADMIN MODULES */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Layout className="h-6 w-6 text-gray-700" />
                        Admin Capabilities
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x md:divide-gray-100 border-b border-gray-100 last:border-0 border-collapse">
                            {adminModules.map((mod, idx) => (
                                <div key={idx} className="p-6 hover:bg-gray-50 transition-colors border-b border-gray-100 border-r-0 md:border-r last:border-r-0 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                {mod.icon}
                                            </div>
                                            <h3 className="font-bold text-gray-900">{mod.name}</h3>
                                        </div>
                                        {mod.path !== '#logout' && (
                                            <Link
                                                href={mod.path}
                                                target={mod.external ? "_blank" : "_self"}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                {mod.external ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                            </Link>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4 h-8 overflow-hidden">{mod.desc}</p>
                                    <ul className="space-y-2 mb-6 flex-grow">
                                        {mod.features.map((feat, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                                <span className="text-xs leading-tight">{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {mod.path && mod.path !== '#logout' && (
                                        <div className="mt-auto pt-4 border-t border-gray-100">
                                            <Link
                                                href={mod.path}
                                                target={mod.external ? "_blank" : "_self"}
                                                className="flex items-center justify-center w-full py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                                            >
                                                Open Module
                                                <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SECTION 2: SEMI-DYNAMIC & CORE PAGES */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Cpu className="h-6 w-6 text-gray-700" />
                        Semi-Dynamic & Core App Pages
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {semiDynamicPages.map((page, idx) => (
                            <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col h-full border-t-4 border-t-blue-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                                            {page.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg">{page.name}</h3>
                                            <code className="text-[10px] text-gray-500 font-mono">{page.path}</code>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-4 italic border-l-2 border-gray-200 pl-3">
                                    "{page.desc}"
                                </p>
                                <div className="space-y-3 mb-6 flex-grow">
                                    {page.features.map((feat, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                            <span className="text-xs font-medium leading-tight">{feat}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-auto">
                                    <Link
                                        href={page.path.replace('[id]', 'preview').replace('[slug]', 'preview')}
                                        className="block w-full text-center py-2 text-xs font-bold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-800 hover:text-white transition-all"
                                    >
                                        View Live Page
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 3: CUSTOMER CENTRIC FEATURES */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-600" />
                        Customer Centric Features
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                title: "Recently Viewed History",
                                desc: "Personalized 'Continue Browsing' strip on Home & Product pages. Stores last 20 items.",
                                icon: <Clock className="h-5 w-5 text-blue-600" />
                            },
                            {
                                title: "Persistent Shopping Cart",
                                desc: "Cart items are saved to Database on login. Guest cart automatically merges with User cart.",
                                icon: <ShoppingCart className="h-5 w-5 text-green-600" />
                            },
                            {
                                title: "Abandoned Cart Recovery",
                                desc: "Automated email reminders sent to users who leave items in cart without checkout.",
                                icon: <Mail className="h-5 w-5 text-orange-600" />
                            },
                            {
                                title: "Smart Search & Filtering",
                                desc: "Instant predictive search and deep filters (Price, Brand, Specs) for finding products fast.",
                                icon: <Search className="h-5 w-5 text-purple-600" />
                            },
                            {
                                title: "Mobile-First UX",
                                desc: "Touch-optimized interface with bottom sheets, swipe carousels, and thumb-friendly navigation.",
                                icon: <Smartphone className="h-5 w-5 text-teal-600" />
                            },
                            {
                                title: "Product Comparison Tool",
                                desc: "Side-by-side specification comparison for up to 4 products to help users decide faster.",
                                icon: <LayoutTemplate className="h-5 w-5 text-gray-700" />
                            },
                            {
                                title: "Wishlist & Favorites",
                                desc: "Save products for later with a single click. Synced across devices for logged-in users.",
                                icon: <Heart className="h-5 w-5 text-pink-500" />
                            },
                            {
                                title: "Quick Cart Actions",
                                desc: "Add to cart directly from listing pages or product details with instant stock validation.",
                                icon: <ShoppingBag className="h-5 w-5 text-green-700" />
                            },
                        {
                            title: "Related Products Recommendation",
                            desc: "Intelligent suggestions on product pages based on matching categories and technical specifications.",
                            icon: <Layers className="h-5 w-5 text-indigo-600" />
                        },
                        {
                            title: "Spin the Wheel Gamification",
                            desc: "Interactive spin-the-wheel campaigns for promotions. Users win coupons, discounts, and prizes.",
                            icon: <Gift className="h-5 w-5 text-yellow-500" />
                        },
                        {
                            title: "Delivery Estimator",
                            desc: "Real-time delivery date estimation based on pincode and product availability.",
                            icon: <Truck className="h-5 w-5 text-blue-600" />
                        },
                        {
                            title: "Store Locator",
                            desc: "Find nearby physical stores with map integration, directions, and store hours.",
                            icon: <MapPin className="h-5 w-5 text-red-500" />
                        },
                        {
                            title: "Bank Offers Marquee",
                            desc: "Scrolling banner showing active bank offers and payment discounts on product pages.",
                            icon: <CreditCard className="h-5 w-5 text-green-600" />
                        },
                        {
                            title: "Invoice Download",
                            desc: "Download PDF invoices for completed orders from the user dashboard.",
                            icon: <FileText className="h-5 w-5 text-gray-600" />
                        },
                        {
                            title: "Order Tracking",
                            desc: "Real-time order status updates with delivery tracking and notifications.",
                            icon: <RefreshCw className="h-5 w-5 text-teal-600" />
                        },
                        {
                            title: "Address Management",
                            desc: "Save, edit, and delete multiple delivery addresses with default address selection.",
                            icon: <MapPin className="h-5 w-5 text-orange-500" />
                        }
                        ].map((feat, idx) => (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
                                <div className="p-3 bg-gray-50 rounded-lg shrink-0">
                                    {feat.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">{feat.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{feat.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 4: API & PARTNER FEATURES */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Key className="h-6 w-6 text-indigo-600" />
                        API & Partner Ecosystem
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                title: "Partner API (v1)",
                                desc: "RESTful API for third-party integrations with HMAC-SHA256 authentication, rate limiting, and API key management.",
                                icon: <Key className="h-5 w-5 text-indigo-600" />,
                                features: ["API Key Generation", "HMAC-SHA256 Signing", "Rate Limiting", "Request Validation"]
                            },
                            {
                                title: "Product Sync API",
                                desc: "Sync product catalog with external partners. Push/pull product data, prices, and inventory.",
                                icon: <RefreshCw className="h-5 w-5 text-blue-600" />,
                                features: ["Real-time Sync", "Batch Updates", "Inventory Tracking", "Price Management"]
                            },
                            {
                                title: "Order Management API",
                                desc: "Create, update, and track orders programmatically. Supports webhooks for status changes.",
                                icon: <ShoppingCart className="h-5 w-5 text-green-600" />,
                                features: ["Order Creation", "Status Updates", "Webhooks", "Bulk Operations"]
                            },
                            {
                                title: "Wallet & Payments",
                                desc: "Partner wallet system with balance tracking, transaction history, and automated payouts.",
                                icon: <CreditCard className="h-5 w-5 text-yellow-600" />,
                                features: ["Balance Tracking", "Transaction Logs", "Automated Payouts", "Refund Processing"]
                            },
                            {
                                title: "Webhook System",
                                desc: "Event-driven notifications for order status, payment updates, and inventory changes.",
                                icon: <Bell className="h-5 w-5 text-purple-600" />,
                                features: ["Event Subscriptions", "Retry Logic", "Payload Signing", "Delivery Logs"]
                            },
                            {
                                title: "API Playground",
                                desc: "Interactive testing environment for API endpoints with request/response previews.",
                                icon: <Code className="h-5 w-5 text-teal-600" />,
                                features: ["Try API Calls", "View Responses", "Authentication Setup", "Error Debugging"]
                            }
                        ].map((feat, idx) => (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4 hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
                                <div className="p-3 bg-indigo-50 rounded-lg shrink-0">
                                    {feat.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">{feat.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{feat.desc}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {feat.features.map((f, i) => (
                                            <span key={i} className="text-[10px] px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 5: SECURITY & INFRASTRUCTURE */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                        Security & Infrastructure
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                title: "Role-Based Access Control",
                                desc: "Admin, Super Admin, Vendor, Employee roles with granular page-level permissions.",
                                icon: <Lock className="h-5 w-5 text-green-600" />
                            },
                            {
                                title: "Session Management",
                                desc: "HMAC-SHA256 signed session tokens with 24h expiry. Edge & Node runtime support.",
                                icon: <Key className="h-5 w-5 text-blue-600" />
                            },
                            {
                                title: "Rate Limiting",
                                desc: "In-memory sliding window rate limiter for API endpoints. Redis-ready for production.",
                                icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            },
                            {
                                title: "Security Headers",
                                desc: "CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy configured.",
                                icon: <ShieldCheck className="h-5 w-5 text-green-700" />
                            },
                            {
                                title: "Data Encryption",
                                desc: "AES encryption for sensitive data like API keys and partner secrets.",
                                icon: <Lock className="h-5 w-5 text-purple-600" />
                            },
                            {
                                title: "Bot Detection",
                                desc: "Automated bot detection and prevention for form submissions and API calls.",
                                icon: <ShieldCheck className="h-5 w-5 text-red-600" />
                            },
                            {
                                title: "Cron Jobs",
                                desc: "Scheduled tasks for abandoned cart recovery, spin wheel notifications, and cleanup.",
                                icon: <Clock className="h-5 w-5 text-orange-600" />
                            },
                            {
                                title: "Performance Monitoring",
                                desc: "Web Vitals tracking, API response logging, and error monitoring.",
                                icon: <BarChart className="h-5 w-5 text-teal-600" />
                            }
                        ].map((feat, idx) => (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-3 hover:shadow-md transition-shadow">
                                <div className="p-2 bg-green-50 rounded-lg shrink-0">
                                    {feat.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-sm mb-1">{feat.title}</h3>
                                    <p className="text-xs text-gray-600 leading-relaxed">{feat.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 6: STATIC PAGES */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Info className="h-6 w-6 text-gray-700" />
                        Static & Informational Pages
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {staticPages.map((page, idx) => (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-900">{page.name}</h3>
                                    <Link href={page.path} className="text-gray-400 hover:text-blue-600">
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">{page.desc}</p>
                                <div className="space-y-1 mb-4 flex-grow">
                                    {page.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}

function LayoutDashboardIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
        >
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
    )
}
