import { z } from "zod"

export const MARKETING_PAGES = [
  { id: "home", label: "Homepage", href: "/" },
  { id: "products", label: "Products & Offers", href: "/products" },
  { id: "product", label: "Product Details", href: "/products" },
  { id: "cart", label: "Cart", href: "/cart" },
  { id: "brands", label: "Brands", href: "/brands" },
  { id: "about", label: "About SARA", href: "/about" },
  { id: "header", label: "Header", href: "/" },
  { id: "footer", label: "Footer", href: "/" },
] as const

export type MarketingPage = typeof MARKETING_PAGES[number]["id"]
export type MarketingField = { key: string; label: string; type: "text" | "image" | "link"; value: string }
export type MarketingDefinition = {
  page: MarketingPage; section: string; title: string; order: number; fields: MarketingField[]
  tool?: string; note?: string; pinned?: boolean
}
export type MarketingContent = {
  id: string; page: MarketingPage; section: string; enabled: boolean; order: number
  values: Record<string, string>; revision: number
}
export type MarketingResponse = { sections: MarketingContent[] }
export const marketingResponseSchema = z.object({
  sections: z.array(z.object({
    id: z.string(), page: z.enum(["home", "products", "product", "cart", "brands", "about", "header", "footer"]),
    section: z.string(), enabled: z.boolean(), order: z.number().int().min(0).max(999),
    values: z.record(z.string().max(6000)), revision: z.number().int().min(0),
  })),
})

type Defaults = Record<string, string>
const definition = (page: MarketingPage, section: string, title: string, order: number, values: Defaults = {},
  extra: Pick<MarketingDefinition, "tool" | "note" | "pinned"> = {}): MarketingDefinition => ({
  page, section, title, order, ...extra,
  fields: Object.entries(values).map(([key, value]) => ({
    key, value, label: key.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, character => character.toUpperCase()),
    type: /image|logo/i.test(key) ? "image" : /link|href/i.test(key) ? "link" : "text",
  })),
})
export function marketingItems(items: { title: string; detail?: string; href?: string; image?: string }[]): Defaults {
  return Object.fromEntries(items.flatMap((item, index) => Object.entries(item).map(([key, value]) =>
    [`item${index + 1}${key[0].toUpperCase()}${key.slice(1)}`, value || ""])))
}
const services = marketingItems([
  { title: "Genuine Products", detail: "Manufacturer warranty terms", href: "/warranty" },
  { title: "EMI Options", detail: "Check bank eligibility", href: "/emi" },
  { title: "Upgrade Assistance", detail: "Talk to our team", href: "/contact" },
  { title: "Delivery Options", detail: "Charges confirmed at checkout", href: "/shipping-policy" },
])

export const MARKETING_SECTIONS: MarketingDefinition[] = [
  definition("home", "hero", "Hero & side offers", 0, {}, { tool: "/admin/listing-banners", note: "Edit Home main poster and Home side banners in Banners & Promos." }),
  definition("home", "benefits", "Service benefits", 1, marketingItems([
    { title: "Stores Near You", detail: "Across Karnataka", href: "/store-locator" },
    { title: "100% Genuine Products", detail: "Direct from Brands", href: "/about" },
    { title: "Easy EMI", detail: "All Major Banks", href: "/emi" },
    { title: "Exchange Available", detail: "Get Best Value", href: "/contact" },
    { title: "Fast Delivery", detail: "Across India", href: "/shipping-policy" },
    { title: "Expert Support", detail: "In-store & Online", href: "/contact" },
  ]), { note: "Store totals continue to come from the live store directory." }),
  definition("home", "categories", "Brand shortcuts", 2, { title: "Shop by Brands", ctaText: "View All", ctaLink: "/brands",
    ...marketingItems(["Mobiles", "Laptops", "Televisions", "Refrigerators", "Washing Machines", "Air Conditioners", "Kitchen Appliances", "Audio", "Wearables", "Accessories"]
      .map(title => ({ title, image: "", href: "" }))) }, { tool: "/admin/catalogue", note: "Blank image/link inherits the catalog category. Names, artwork and destinations can be overridden here." }),
  definition("home", "deals", "Today's deals", 3, { title: "Today's Deals", ctaText: "View All", ctaLink: "/offers", warrantyLabel: "Brand warranty included" }, { tool: "/admin/products", note: "Product prices, discounts and availability remain catalog-driven." }),
  definition("home", "promotions", "Promotion cards", 4, {}, { tool: "/admin/listing-banners" }),
  definition("home", "brands", "Top-brand shortcuts", 5, { title: "Top Brands", ctaText: "View All", ctaLink: "/brands",
    ...marketingItems(["Apple", "Samsung", "OnePlus", "Xiaomi", "Vivo", "OPPO", "realme", "Lenovo", "Dell", "HP"].map(title => ({ title, image: "", href: "" }))) }, { tool: "/admin/catalogue", note: "Blank image/link inherits the brand settings." }),
  definition("home", "stores", "Store finder & Why SARA", 6, {
    title: "Find a SARA Store Near You", description: "Experience. Explore. Buy.", ctaText: "Find a Store", ctaLink: "/store-locator", image: "",
    whyTitle: "Why Choose SARA?", ...marketingItems([
      { title: "Local Stores", detail: "Across Karnataka" }, { title: "Happy Customers", detail: "Our SARA Family" },
      { title: "Trusted Brands", detail: "100% Genuine" }, { title: "Easy EMI", detail: "All Major Banks" }, { title: "Expert Support", detail: "Always Here" },
    ]),
  }, { tool: "/admin/settings", note: "Blank image inherits Branding > Storefront image. Store count remains live." }),
  definition("products", "hero", "Offers hero", 0, { ribbonTitle: "SAVINGS & OFFERS", ribbonDetail: "Find your everyday upgrade" }, { tool: "/admin/listing-banners", pinned: true }),
  definition("products", "tabs", "Offer-category labels", 1, {
    ...Object.fromEntries(["All Offers", "Festival Offers", "Bank Offers", "Exchange Offers", "No Cost EMI", "Bundle Offers", "Brand Offers", "Online Exclusive", "All Products"].map((label, index) => [`item${index + 1}Title`, label])),
  }, { pinned: true, note: "Labels only: eligibility still comes from the catalog and Razorpay. Tabs never create a bank discount." }),
  definition("products", "promotions", "Featured promotion cards", 2, {
    item1CtaText: "Shop Now", item2CtaText: "View Offers", item3CtaText: "Know More",
    ...marketingItems([
      { title: "Home Upgrades", detail: "Explore appliances", href: "/products?category=HOME%20APPLIANCES", image: "/banners/promo-appliances.svg" },
      { title: "Ways to Pay", detail: "Check current bank offers", href: "", image: "/brand-page/hero-products.webp" },
      { title: "Exchange & Upgrade", detail: "Ask about available options", href: "", image: "/brand-page/hero-products.webp" },
    ]),
  }, { tool: "/admin/listing-banners", note: "These are fallback cards. Enabled listing promo banners take precedence; a blank link keeps the Bank/Exchange tab action.", pinned: true }),
  definition("products", "results", "Results heading & exchange copy", 3, {
    title: "Top Offers for You", exchangeDescription: "Exchange options depend on your device and store assessment. Contact our team before planning your purchase.",
    exchangeCtaText: "Ask about exchange options", exchangeCtaLink: "/contact",
  }, { pinned: true, note: "Visibility controls the marketing heading and exchange copy only. Filters, prices and 24-product pagination remain available." }),
  definition("products", "services", "Shopping-service strip", 4, services, { pinned: true }),
  definition("product", "trust", "Purchase-panel service icons", 0, marketingItems([
    { title: "Returns Policy" }, { title: "Brand Warranty" }, { title: "100% Genuine" }, { title: "Secure Payment" },
  ]), { pinned: true }),
  definition("product", "pickup", "Store-pickup promotion", 0, { title: "Available for Store Pickup", ctaText: "View Stores", ctaLink: "/store-locator" }, { pinned: true }),
  definition("product", "suggestions", "Catalog suggestions", 1, {
    title: "Frequently Bought Together", description: "Suggested products from our catalog, not based on purchase history.",
  }, { pinned: true, note: "The purchase-history disclosure is retained. Suggested products, images and prices remain catalog-driven." }),
  definition("product", "rail", "Product-page brand/service banners", 2, {}, { tool: "/admin/listing-banners", pinned: true }),
  definition("product", "faqs", "Product FAQs", 3, marketingItems([
    { title: "Is this product covered by the manufacturer warranty?", detail: "Warranty coverage and duration depend on the product and manufacturer. Check the Specifications tab and retain your SARA invoice. Contact us if warranty details have not been supplied." },
    { title: "Do you install it for me?", detail: "Installation availability, charges and scheduling depend on the product and manufacturer. Contact SARA before ordering if you need installation assistance." },
    { title: "Can I pay in instalments?", detail: "Available EMI offers are supplied by Razorpay. Your bank confirms eligible cards, tenure, interest and processing fees at checkout before you pay." },
    { title: "What if it arrives damaged?", detail: "Contact SARA promptly with your order number and photographs. Returns and replacements follow our cancellation and returns policy. Do not accept a package that arrives visibly tampered with." },
    { title: "Can I collect it from a store instead?", detail: "Yes. Reserve online and collect from your nearest SARA store — there are stores across Karnataka, listed on our store locator." },
  ]), { pinned: true }),
  definition("cart", "recommendations", "Recommendations & promotion", 0, { title: "You May Also Like", description: "Explore more from our available catalog.",
    offersTitle: "Available Offers", offersCtaText: "View All", offersLink: "/offers",
  }, { tool: "/admin/listing-banners", pinned: true }),
  definition("cart", "intro", "Cart introduction & empty-cart message", 0, {
    description: "Good choices! You're just a few steps away from a better tomorrow.",
    emptyDescription: "Find technology and appliances for every home.", ctaText: "Start Shopping", ctaLink: "/products",
  }, { pinned: true }),
  definition("cart", "services", "Shopping-service strip", 1, marketingItems([
    { title: "Delivery Options", detail: "Across Karnataka", href: "/shipping-policy" },
    { title: "Genuine Products", detail: "From Trusted Brands", href: "/warranty" },
    { title: "Easy EMI", detail: "Available at Checkout", href: "/emi" },
    { title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" },
  ]), { pinned: true }),
  definition("brands", "hero", "Brands hero & highlights", 0, { title: "The Best Brands.\nAll in One Place.", description: "Top brands. Genuine products. Best deals. Only at SARA.", image: "/brand-page/hero-products.webp",
    ...marketingItems([{ title: "Genuine", detail: "Products" }, { title: "Explore", detail: "Brand Offers" }, { title: "Wide Range", detail: "Across Categories" }]),
  }, { tool: "/admin/listing-banners", note: "Enabled Brands hero banners take precedence." }),
  definition("brands", "directory", "Brand directory heading", 1, { title: "Shop by Brand", ctaText: "View Products" }, { tool: "/admin/catalogue", note: "Brand availability, logos and landing pages remain in Categories & Brands." }),
  definition("brands", "services", "Shopping-service strip", 2, marketingItems([
    { title: "Genuine Products", detail: "From Trusted Brands", href: "/warranty" },
    { title: "Easy EMI Options", detail: "Available at Checkout", href: "/emi" },
    { title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" },
    { title: "Delivery Options", detail: "See Our Shipping Policy", href: "/shipping-policy" },
  ])),
  definition("about", "hero", "About hero", 0, { eyebrow: "About SARA", title: "Karnataka's\nTrusted Electronics\nRetail Partner",
    description: "SARA has been bringing the latest technology closer to people, with a simple belief — A Brighter Tomorrow for Every Home.",
    image: "", ctaText: "Our Journey", ctaLink: "#our-journey",
  }, { note: "Blank image inherits the Branding storefront image." }),
  definition("about", "stats", "Company-statistics labels", 1, { item4Value: "Genuine Products", item5Value: "Pan Karnataka", ...marketingItems([
    { title: "Stores Across", detail: "Karnataka" }, { title: "Happy Customers", detail: "" },
    { title: "Years of Trust", detail: "" }, { title: "From Top Brands", detail: "" }, { title: "Presence", detail: "Across Cities" },
  ]) }, { tool: "/admin/settings", note: "Company figures stay in Settings; no invented store/customer counts." }),
  definition("about", "story", "Our story & principles", 2, { title: "Our Story", description: "SARA brings together electronics, home appliances and personal technology for customers across Karnataka. Our focus is on making technology accessible, affordable and enjoyable for every home.",
    secondParagraph: "From mobiles to home appliances, from the latest gadgets to everyday essentials, our customers remain at the heart of what we do. SARA connects people with the products, guidance and support they need.",
    image: "", ctaText: "Our Journey", ctaLink: "#our-journey",
    ...marketingItems([{ title: "Customer", detail: "First" }, { title: "People", detail: "Driven" }, { title: "Always", detail: "Innovating" }, { title: "Growing", detail: "Together" }]),
  }),
  definition("about", "purpose", "Vision, mission & values", 3, {
    visionTitle: "Our Vision", visionDescription: "To be the most trusted and preferred electronics retail brand in India, enriching lives through technology.",
    missionTitle: "Our Mission", missionDescription: "To make the latest technology accessible to every home with great products, best value, and exceptional customer experience.",
    valuesTitle: "Our Values", ...marketingItems(["Trust & Transparency", "Innovation & Adaptability", "Customer Delight", "Respect for People", "Integrity in Business", "Commitment to Community"].map(title => ({ title }))),
  }),
  definition("about", "journey", "Our journey", 4, { title: "Our Journey", ...Object.fromEntries([
    ["Our Roots", "Electronics retail", "In Karnataka"], ["Our Reach", "Stores across", "Multiple cities"], ["Our Range", "Multi-brand", "Technology & appliances"],
    ["Our Approach", "Expert guidance", "In-store & online"], ["Our Community", "Customers at", "The heart of SARA"], ["Today", "Shop online", "Or visit a store"], ["Beyond", "A brighter", "Tomorrow"],
  ].flatMap(([marker, title, detail], index) => [[`item${index + 1}Marker`, marker], [`item${index + 1}Title`, title], [`item${index + 1}Detail`, detail]])) }),
  definition("about", "statement", "Showroom statement", 5, { title: "More Than a Store\nA Part of Your Story", description: "At SARA, we don't just sell products. We build lasting relationships, create happier homes, and bring people closer through the power of technology.",
    image: "/about/showroom-interior.webp", ctaText: "Shop With Us", ctaLink: "/products" }),
  definition("about", "services", "Shopping-service strip", 6, marketingItems([
    { title: "Easy EMI Options", detail: "Available at Checkout", href: "/emi" }, { title: "Warranty Support", detail: "& After-Sales Assistance", href: "/warranty" },
    { title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" }, { title: "Stores", detail: "Across Karnataka", href: "/store-locator" },
  ])),
  definition("header", "announcement", "Announcement & utility links", 0, { title: "SARA Super Sunday", description: "Biggest Deals. Brighter Days.",
    downloadTitle: "Download App", downloadLink: "/#download-app", storeTitle: "Find a Store", storeLink: "/store-locator",
    helpTitle: "Help", helpLink: "/faq", phoneSuffix: "(Toll Free)",
  }, { tool: "/admin/settings", pinned: true, note: "Phone number, logo and store name remain in Settings; festival announcement is in Theme & Festivals." }),
  definition("header", "promotion", "Navigation campaign button", 1, { title: "SARA Super Sunday", ctaLink: "/super-sunday" }, { pinned: true }),
  // These two must stay in step with STATIC_LINKS in components/MegaMenu.tsx:
  // the override is applied by position, so when Brands, New Arrivals, Business
  // Enquiries and About SARA were removed from the row, the leftover item1/item2
  // defaults pointed "Offers" at /brands and "Store Locator" at /offers.
  definition("header", "navigation", "Navigation marketing links", 2, marketingItems([
    { title: "Offers", href: "/offers" }, { title: "Store Locator", href: "/store-locator" },
  ]), { pinned: true, note: "Category navigation remains catalog-driven. Account/cart controls are never hidden." }),
  definition("header", "brand", "Header logo & search hint", 3, { image: "/sara-logo.png", searchHint: "Search for products, brands and more..." }, { pinned: true }),
  definition("footer", "newsletter", "Newsletter & social strip", 0, { title: "Stay Updated with the Latest Offers", description: "Subscribe to get exclusive deals, new launches and more.", ctaText: "Subscribe", followTitle: "Follow Us" }, { pinned: true }),
  definition("footer", "brand", "Brand message", 1, { tagline: "Mobiles | Electronics | More", description: "Your trusted technology partner.\nOnline. In-store. Always with you.", image: "/sara-logo.png", ctaLink: "/" }),
  ...(["shop", "service", "about", "legal"] as const).map((section, index) => definition("footer", section,
    ["Shop links", "Customer-service links", "About links", "Legal links"][index], index + 2, {
      title: ["Shop", "Customer Service", "About SARA", "Legal"][index],
      ...marketingItems([
        [["Mobiles", "/products?q=mobile"], ["Electronics", "/products"], ["Computers", "/products?q=laptop"], ["Audio", "/products?q=audio"], ["Wearables", "/products?q=watch"], ["Accessories", "/products?q=accessories"], ["Offers", "/offers"], ["New Arrivals", "/products"], ["Brands", "/brands"]],
        [["Track Order", "/track"], ["Returns & Refunds", "/returns"], ["Exchange", "/contact"], ["EMI Options", "/emi"], ["Shipping Policy", "/shipping-policy"], ["Warranty", "/warranty"], ["Installation Support", "/installation"], ["Help & FAQs", "/faq"], ["Contact Us", "/contact"]],
        [["Our Story", "/about"], ["Our Stores", "/stores"], ["Careers", "/careers"], ["Business Enquiries", "/business-enquiries"], ["Press & Media", "/press"], ["Blog / Buying Guides", "/blog"], ["Corporate Information", "/corporate-information"]],
        [["Terms & Conditions", "/terms-and-conditions"], ["Privacy Policy", "/privacy-policy"], ["Privacy & My Data", "/account/privacy"], ["Cancellation Policy", "/cancellation-policy"], ["Return Policy", "/returns"], ["Shipping Policy", "/shipping-policy"], ["Disclaimer", "/disclaimer"], ["Sitemap", "/sitemap"]],
      ][index].map(([title, href]) => ({ title, href }))),
    }, { note: section === "legal" ? "The cookie-preferences control is always retained." : undefined })),
  definition("footer", "download", "App download & QR", 6, { title: "Download the SARA App", description: "Shop on the go", qrTitle: "Scan QR Code" }, { tool: "/admin/settings", note: "App-store/social URLs are controlled by Settings, not fictional download links." }),
  definition("footer", "bottom", "Footer assurance messages", 7, { paymentTitle: "Secure Payments", genuineTitle: "100% Genuine Products" }, { pinned: true }),
]

export function marketingDefinition(page: string, section: string) {
  return MARKETING_SECTIONS.find(item => item.page === page && item.section === section)
}
export function defaultMarketingContent(definition: MarketingDefinition): MarketingContent {
  return { id: `${definition.page}:${definition.section}`, page: definition.page, section: definition.section,
    enabled: true, order: definition.order, values: Object.fromEntries(definition.fields.map(field => [field.key, field.value])), revision: 0 }
}
