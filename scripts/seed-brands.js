// Seed script to populate existing brands (Bosch, LG, Haier, TCL) + Samsung
// Run with: npx ts-node --skip-project scripts/seed-brands.ts
// Or: node -e "require('./scripts/seed-brands.js')"

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Refusing to run.")
  process.exit(1)
}
const DB_NAME = "e-commerce-bytewise"

const brands = [
    {
        name: "Bosch",
        slug: "bosch",
        enabled: true,
        logo: "",
        tagline: "Invented for life",
        description: "Experience German engineering excellence. Discover Bosch's innovative technology in power tools, home appliances, and professional equipment.",
        accentColor: "blue",
        accentColorFrom: "from-red-600",
        accentColorTo: "to-red-500",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-blue-900 via-blue-800 to-blue-900",
        banners: [
            { url: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1920&h=1080&fit=crop", alt: "Bosch - Invented for Life" },
            { url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1920&h=1080&fit=crop", alt: "Bosch Power Tools - Professional Performance" },
            { url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1920&h=1080&fit=crop", alt: "Bosch Home Appliances - German Engineering" },
        ],
        categories: [
            { url: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&h=800&fit=crop", title: "Power Tools", description: "Professional Grade Tools" },
            { url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop", title: "Washing Machine", description: "Energy Efficient" },
            { url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=800&fit=crop", title: "Refrigerator", description: "VitaFresh Technology" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Dishwasher", description: "Silence Plus" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Microwave", description: "Smart Cooking" },
            { url: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&h=800&fit=crop", title: "Vacuum Cleaner", description: "Powerful Suction" },
        ],
        features: [
            { icon: "Settings", text: "German Engineering", color: "text-blue-400" },
            { icon: "Shield", text: "2 Year Warranty", color: "text-green-400" },
            { icon: "Zap", text: "Energy Efficient", color: "text-yellow-400" },
            { icon: "Award", text: "Award Winning", color: "text-purple-400" },
        ],
        whyChoose: {
            title: "Why Choose Bosch",
            heading: "Why Choose Bosch?",
            subtitle: "Over 130 years of innovation and engineering excellence",
            reasons: [
                { icon: "Wrench", title: "Professional Quality", description: "Built to last with premium materials and rigorous testing standards" },
                { icon: "CheckCircle", title: "Reliable Performance", description: "Consistent results backed by German engineering precision" },
                { icon: "Sparkles", title: "Innovation Leader", description: "Pioneering technology that sets industry standards" },
            ],
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-red-50 text-red-600",
            heading: "Shop Bosch Products",
            subtitle: "Discover our selection of Bosch products with cutting-edge technology and German engineering excellence.",
            manufacturerFilter: "bosch",
            maxProducts: 12,
            ctaText: "View All Bosch Products",
            ctaLink: "/products?brands=Bosch",
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: "Bosch Product Categories",
            subtitle: "From professional power tools to smart home appliances, discover the complete range of Bosch products designed with German precision.",
        },
        trustBadges: [
            { icon: "Star", iconColor: "text-blue-300", bgColor: "bg-blue-600/20", title: "130+ Years", subtitle: "Of Innovation" },
            { icon: "Shield", iconColor: "text-green-300", bgColor: "bg-green-600/20", title: "2 Year Warranty", subtitle: "On All Products" },
            { icon: "Award", iconColor: "text-yellow-300", bgColor: "bg-yellow-600/20", title: "Award Winning", subtitle: "Design & Quality" },
        ],
        heroContent: {
            title: "BOSCH",
            subtitle: "Invented for life",
            description: "Experience German engineering excellence. Discover Bosch's innovative technology in power tools, home appliances, and professional equipment.",
            ctaText: "Shop Bosch Products",
            ctaLink: "/products?brands=Bosch",
            ctaColor: "from-red-600 to-red-500",
            secondaryCta: "Learn More",
        },
        leadFormEnabled: false,
        leadFormSource: "Bosch Brand Page",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: "Samsung",
        slug: "samsung",
        enabled: true,
        logo: "",
        tagline: "Inspire the World, Create the Future",
        description: "Discover Samsung's innovative range of electronics, smartphones, TVs, home appliances, and more. Experience cutting-edge technology designed for modern living.",
        accentColor: "blue",
        accentColorFrom: "from-blue-600",
        accentColorTo: "to-blue-500",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-blue-900 via-blue-800 to-blue-900",
        banners: [
            { url: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=1920&h=1080&fit=crop", alt: "Samsung - Inspire the World" },
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1920&h=1080&fit=crop", alt: "Samsung Smart TVs - Crystal Clear" },
            { url: "https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=1920&h=1080&fit=crop", alt: "Samsung Home Appliances - Smart Living" },
        ],
        categories: [
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop", title: "Smart TV", description: "Crystal UHD & QLED" },
            { url: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&h=800&fit=crop", title: "Smartphone", description: "Galaxy Series" },
            { url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=800&fit=crop", title: "Refrigerator", description: "SpaceMax Technology" },
            { url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop", title: "Washing Machine", description: "AI EcoBubble" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Air Conditioner", description: "WindFree Cooling" },
            { url: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&h=800&fit=crop", title: "Microwave", description: "Smart Oven" },
        ],
        features: [
            { icon: "Sparkles", text: "AI-Powered Technology", color: "text-blue-400" },
            { icon: "Shield", text: "1 Year Warranty", color: "text-green-400" },
            { icon: "Zap", text: "Energy Star Rated", color: "text-yellow-400" },
            { icon: "Award", text: "#1 Global Brand", color: "text-purple-400" },
        ],
        whyChoose: {
            title: "Why Choose Samsung",
            heading: "Why Choose Samsung?",
            subtitle: "Innovation that inspires the world and creates the future",
            reasons: [
                { icon: "Sparkles", title: "Innovation Leader", description: "Pioneering AI, 5G, and smart home technology that shapes tomorrow" },
                { icon: "Globe", title: "Global Trust", description: "Trusted by millions worldwide with presence in 74+ countries" },
                { icon: "CheckCircle", title: "Smart Ecosystem", description: "Seamlessly connected devices with SmartThings integration" },
            ],
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: "Shop Samsung Products",
            subtitle: "Explore our curated selection of Samsung products featuring the latest innovations in technology and smart living.",
            manufacturerFilter: "samsung",
            maxProducts: 12,
            ctaText: "View All Samsung Products",
            ctaLink: "/products?brands=Samsung",
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: "Samsung Product Categories",
            subtitle: "From flagship smartphones to smart home appliances, discover the complete Samsung ecosystem.",
        },
        trustBadges: [
            { icon: "Globe", iconColor: "text-blue-300", bgColor: "bg-blue-600/20", title: "74+ Countries", subtitle: "Global Presence" },
            { icon: "Shield", iconColor: "text-green-300", bgColor: "bg-green-600/20", title: "1 Year Warranty", subtitle: "Comprehensive Coverage" },
            { icon: "Award", iconColor: "text-yellow-300", bgColor: "bg-yellow-600/20", title: "#1 Global Brand", subtitle: "Consumer Electronics" },
        ],
        heroContent: {
            title: "SAMSUNG",
            subtitle: "Inspire the World, Create the Future",
            description: "Discover Samsung's innovative range of electronics, smartphones, TVs, home appliances, and more. Experience cutting-edge technology designed for modern living.",
            ctaText: "Shop Samsung Products",
            ctaLink: "/products?brands=Samsung",
            ctaColor: "from-blue-600 to-blue-500",
            secondaryCta: "Explore Galaxy",
        },
        leadFormEnabled: true,
        leadFormSource: "Samsung Brand Page",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: "LG",
        slug: "lg",
        enabled: true,
        logo: "",
        tagline: "Life's Good",
        description: "Explore LG's innovative range of home electronics, appliances, and smart solutions. Experience technology designed to make life good.",
        accentColor: "red",
        accentColorFrom: "from-red-600",
        accentColorTo: "to-red-500",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-red-900 via-red-800 to-red-900",
        banners: [
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1920&h=1080&fit=crop", alt: "LG - Life's Good" },
            { url: "https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=1920&h=1080&fit=crop", alt: "LG OLED TVs" },
            { url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1920&h=1080&fit=crop", alt: "LG Home Appliances" },
        ],
        categories: [
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop", title: "Smart TV", description: "OLED & NanoCell" },
            { url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=800&fit=crop", title: "Refrigerator", description: "InstaView Door-in-Door" },
            { url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop", title: "Washing Machine", description: "AI Direct Drive" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Air Conditioner", description: "Dual Inverter" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Microwave", description: "Charcoal Healthy" },
        ],
        features: [
            { icon: "Sparkles", text: "AI ThinQ Technology", color: "text-red-400" },
            { icon: "Shield", text: "10 Year Warranty", color: "text-green-400" },
            { icon: "Zap", text: "Inverter Technology", color: "text-yellow-400" },
            { icon: "Award", text: "Award Winning Design", color: "text-purple-400" },
        ],
        whyChoose: {
            title: "Why Choose LG",
            heading: "Why Choose LG?",
            subtitle: "Innovation for a better life",
            reasons: [
                { icon: "Sparkles", title: "AI ThinQ Smart", description: "Intelligent AI technology that learns and adapts to your lifestyle" },
                { icon: "Zap", title: "Inverter Technology", description: "Energy-efficient inverter compressors for quiet, durable performance" },
                { icon: "Award", title: "Design Excellence", description: "Red Dot award-winning designs that complement your space" },
            ],
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-red-50 text-red-600",
            heading: "Shop LG Products",
            subtitle: "Discover our selection of LG products with AI-powered technology and innovative design.",
            manufacturerFilter: "lg",
            maxProducts: 12,
            ctaText: "View All LG Products",
            ctaLink: "/products?brands=LG",
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-red-50 text-red-600",
            heading: "LG Product Categories",
            subtitle: "From OLED TVs to smart home appliances, discover LG's innovative product range.",
        },
        trustBadges: [
            { icon: "Star", iconColor: "text-red-300", bgColor: "bg-red-600/20", title: "Life's Good", subtitle: "Since 1958" },
            { icon: "Shield", iconColor: "text-green-300", bgColor: "bg-green-600/20", title: "10 Year Warranty", subtitle: "On Compressors" },
            { icon: "Award", iconColor: "text-yellow-300", bgColor: "bg-yellow-600/20", title: "Red Dot Awards", subtitle: "Design Excellence" },
        ],
        heroContent: {
            title: "LG",
            subtitle: "Life's Good",
            description: "Explore LG's innovative range of home electronics, appliances, and smart solutions. Experience technology designed to make life good.",
            ctaText: "Shop LG Products",
            ctaLink: "/products?brands=LG",
            ctaColor: "from-red-600 to-red-500",
            secondaryCta: "Learn More",
        },
        leadFormEnabled: false,
        leadFormSource: "LG Brand Page",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: "Haier",
        slug: "haier",
        enabled: true,
        logo: "",
        tagline: "Inspired Living",
        description: "Discover Haier's world-class home appliances. From refrigerators to washing machines, experience innovation designed for modern Indian homes.",
        accentColor: "red",
        accentColorFrom: "from-red-600",
        accentColorTo: "to-red-500",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-red-900 via-red-800 to-red-900",
        banners: [
            { url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1920&h=1080&fit=crop", alt: "Haier - Inspired Living" },
            { url: "https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=1920&h=1080&fit=crop", alt: "Haier Home Appliances" },
            { url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=1920&h=1080&fit=crop", alt: "Haier Refrigerators" },
        ],
        categories: [
            { url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=800&fit=crop", title: "Refrigerator", description: "Twin Inverter Technology" },
            { url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop", title: "Washing Machine", description: "Direct Motion Motor" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Air Conditioner", description: "Triple Inverter Plus" },
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop", title: "LED TV", description: "Google Android TV" },
        ],
        features: [
            { icon: "Sparkles", text: "Smart Technology", color: "text-red-400" },
            { icon: "Shield", text: "5 Year Warranty", color: "text-green-400" },
            { icon: "Zap", text: "Inverter Technology", color: "text-yellow-400" },
            { icon: "Globe", text: "#1 Global Appliance Brand", color: "text-blue-400" },
        ],
        whyChoose: {
            title: "Why Choose Haier",
            heading: "Why Choose Haier?",
            subtitle: "World's #1 major appliance brand",
            reasons: [
                { icon: "Globe", title: "Global Leader", description: "World's #1 major appliance brand for 14 consecutive years" },
                { icon: "Sparkles", title: "Innovation First", description: "Connected IoT appliances for the smart Indian home" },
                { icon: "CheckCircle", title: "Made for India", description: "Products specifically designed for Indian households" },
            ],
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-red-50 text-red-600",
            heading: "Shop Haier Products",
            subtitle: "Discover Haier's innovative range of home appliances designed for modern Indian living.",
            manufacturerFilter: "haier",
            maxProducts: 12,
            ctaText: "View All Haier Products",
            ctaLink: "/products?brands=Haier",
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-red-50 text-red-600",
            heading: "Haier Product Categories",
            subtitle: "Discover the complete range of Haier home appliances.",
        },
        trustBadges: [
            { icon: "Globe", iconColor: "text-red-300", bgColor: "bg-red-600/20", title: "#1 Global Brand", subtitle: "14 Consecutive Years" },
            { icon: "Shield", iconColor: "text-green-300", bgColor: "bg-green-600/20", title: "5 Year Warranty", subtitle: "Comprehensive Coverage" },
            { icon: "Award", iconColor: "text-yellow-300", bgColor: "bg-yellow-600/20", title: "IoT Connected", subtitle: "Smart Appliances" },
        ],
        heroContent: {
            title: "HAIER",
            subtitle: "Inspired Living",
            description: "Discover Haier's world-class home appliances. From refrigerators to washing machines, experience innovation designed for modern Indian homes.",
            ctaText: "Shop Haier Products",
            ctaLink: "/products?brands=Haier",
            ctaColor: "from-red-600 to-red-500",
            secondaryCta: "Learn More",
        },
        leadFormEnabled: false,
        leadFormSource: "Haier Brand Page",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: "TCL",
        slug: "tcl",
        enabled: true,
        logo: "",
        tagline: "Inspire Greatness",
        description: "Experience TCL's innovative range of electronics. From QLED TVs to smart air conditioners, discover technology that inspires greatness.",
        accentColor: "blue",
        accentColorFrom: "from-blue-600",
        accentColorTo: "to-blue-500",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-gray-900 via-gray-800 to-gray-900",
        banners: [
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1920&h=1080&fit=crop", alt: "TCL - Inspire Greatness" },
            { url: "https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=1920&h=1080&fit=crop", alt: "TCL QLED Smart TVs" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=1920&h=1080&fit=crop", alt: "TCL Smart Home" },
        ],
        categories: [
            { url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop", title: "Smart TV", description: "QLED & 4K UHD" },
            { url: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800&h=800&fit=crop", title: "Air Conditioner", description: "Gentle Cool Technology" },
            { url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop", title: "Washing Machine", description: "Smart Control" },
        ],
        features: [
            { icon: "Sparkles", text: "QLED Technology", color: "text-blue-400" },
            { icon: "Shield", text: "3 Year Warranty", color: "text-green-400" },
            { icon: "Zap", text: "Energy Efficient", color: "text-yellow-400" },
            { icon: "Award", text: "Top 2 Global TV Brand", color: "text-purple-400" },
        ],
        whyChoose: {
            title: "Why Choose TCL",
            heading: "Why Choose TCL?",
            subtitle: "Greatness starts here",
            reasons: [
                { icon: "Star", title: "QLED Brilliance", description: "Quantum dot technology for stunning picture quality" },
                { icon: "Zap", title: "Smart Performance", description: "Google TV & AI-powered features for seamless entertainment" },
                { icon: "Award", title: "Value Champion", description: "Premium technology at accessible price points" },
            ],
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: "Shop TCL Products",
            subtitle: "Explore TCL's range of QLED TVs and smart home appliances.",
            manufacturerFilter: "tcl",
            maxProducts: 12,
            ctaText: "View All TCL Products",
            ctaLink: "/products?brands=TCL",
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: "TCL Product Categories",
            subtitle: "Discover TCL's innovative range of electronics and home appliances.",
        },
        trustBadges: [
            { icon: "Star", iconColor: "text-blue-300", bgColor: "bg-blue-600/20", title: "Top 2 TV Brand", subtitle: "Globally" },
            { icon: "Shield", iconColor: "text-green-300", bgColor: "bg-green-600/20", title: "3 Year Warranty", subtitle: "On All Products" },
            { icon: "Globe", iconColor: "text-yellow-300", bgColor: "bg-yellow-600/20", title: "160+ Countries", subtitle: "Global Presence" },
        ],
        heroContent: {
            title: "TCL",
            subtitle: "Inspire Greatness",
            description: "Experience TCL's innovative range of electronics. From QLED TVs to smart air conditioners, discover technology that inspires greatness.",
            ctaText: "Shop TCL Products",
            ctaLink: "/products?brands=TCL",
            ctaColor: "from-blue-600 to-blue-500",
            secondaryCta: "Learn More",
        },
        leadFormEnabled: false,
        leadFormSource: "TCL Brand Page",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
]

async function seedBrands() {
    const client = new MongoClient(MONGODB_URI)

    try {
        await client.connect()
        const db = client.db(DB_NAME)
        const collection = db.collection("brands")

        console.log("Connected to MongoDB. Seeding brands...")

        for (const brand of brands) {
            const existing = await collection.findOne({ slug: brand.slug })
            if (existing) {
                console.log(`  ⏭️  Brand "${brand.name}" already exists (slug: ${brand.slug}), skipping.`)
            } else {
                await collection.insertOne(brand)
                console.log(`  ✅ Brand "${brand.name}" created (slug: ${brand.slug})`)
            }
        }

        const total = await collection.countDocuments()
        console.log(`\nDone! Total brands in database: ${total}`)
    } catch (error) {
        console.error("Error seeding brands:", error)
    } finally {
        await client.close()
    }
}

seedBrands()
