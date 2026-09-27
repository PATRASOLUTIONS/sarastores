import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"

// Brand document schema
export interface BrandDocument {
    _id?: ObjectId
    name: string
    slug: string
    enabled: boolean
    landingPageEnabled: boolean
    logo?: string
    tagline?: string
    description?: string
    accentColor: string       // e.g. "blue", "red", "green"
    accentColorFrom: string   // tailwind gradient from e.g. "from-blue-600"
    accentColorTo: string     // tailwind gradient to e.g. "to-blue-500"
    heroBgFrom: string        // hero overlay gradient
    heroBgTo: string
    trustBadgeBg: string      // trust section bg e.g. "from-blue-900 via-blue-800 to-blue-900"

    // Content sections
    banners: {
        url: string
        alt: string
        link?: string
    }[]
    categories: {
        url: string
        title: string
        description: string
        link?: string
    }[]
    features: {
        icon: string    // icon name from lucide
        text: string
        color: string   // tailwind text color e.g. "text-blue-400"
    }[]
    whyChoose: {
        title: string
        heading: string
        subtitle: string
        reasons: {
            icon: string
            title: string
            description: string
        }[]
    }
    productsSection: {
        badge: string
        badgeColor: string   // e.g. "bg-red-50 text-red-600"
        heading: string
        subtitle: string
        manufacturerFilter: string  // used to filter products from DB
        maxProducts: number
        ctaText: string
        ctaLink: string
    }
    categorySection: {
        badge: string
        badgeColor: string
        heading: string
        subtitle: string
    }
    trustBadges: {
        icon: string
        iconColor: string
        bgColor: string
        title: string
        subtitle: string
    }[]
    heroContent: {
        title: string
        titleStyle?: string
        subtitle: string
        description: string
        ctaText: string
        ctaLink: string
        ctaColor: string     // gradient classes for CTA button
        secondaryCta?: string
    }
    leadFormEnabled: boolean
    leadFormSource?: string

    createdAt: Date
    updatedAt: Date
}

// GET - List all brands or get a single brand by slug
export async function GET(request: NextRequest) {
    try {
        const { db } = await connectToDatabase()
        const { searchParams } = new URL(request.url)

        const slug = searchParams.get("slug")
        const enabledOnly = searchParams.get("enabledOnly") === "true"
        const landingPagesOnly = searchParams.get("landingPagesOnly") === "true"

        if (slug) {
            const brand = await db.collection("brands").findOne({ slug })
            if (!brand) {
                return NextResponse.json({ success: false, message: "Brand not found" }, { status: 404 })
            }
            return NextResponse.json({ success: true, brand })
        }

        const filter: any = {}
        if (enabledOnly) filter.enabled = true
        if (landingPagesOnly) filter.landingPageEnabled = { $ne: false }

        const brands = await db.collection("brands")
            .find(filter)
            .sort({ name: 1 })
            .toArray()

        return NextResponse.json({ success: true, brands })
    } catch (error) {
        console.error("Error fetching brands:", error)
        return NextResponse.json({ success: false, message: "Failed to fetch brands" }, { status: 500 })
    }
}

// POST - Create a new brand
export async function POST(request: NextRequest) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { db } = await connectToDatabase()
        const body = await request.json()

        const { name, slug } = body

        if (!name || !slug) {
            return NextResponse.json({ success: false, message: "Name and slug are required" }, { status: 400 })
        }

        // Check for duplicate slug
        const existing = await db.collection("brands").findOne({ slug })
        if (existing) {
            return NextResponse.json({ success: false, message: "A brand with this slug already exists" }, { status: 409 })
        }

        const brand: Omit<BrandDocument, "_id"> = {
            name: body.name,
            slug: body.slug,
            enabled: body.enabled ?? true,
            landingPageEnabled: body.landingPageEnabled ?? false,
            logo: body.logo || "",
            tagline: body.tagline || "",
            description: body.description || "",
            accentColor: body.accentColor || "blue",
            accentColorFrom: body.accentColorFrom || "from-blue-600",
            accentColorTo: body.accentColorTo || "to-blue-500",
            heroBgFrom: body.heroBgFrom || "from-black/60",
            heroBgTo: body.heroBgTo || "to-transparent",
            trustBadgeBg: body.trustBadgeBg || "from-blue-900 via-blue-800 to-blue-900",
            banners: body.banners || [],
            categories: body.categories || [],
            features: body.features || [],
            whyChoose: body.whyChoose || {
                title: "Why Choose Us",
                heading: `Why Choose ${body.name}?`,
                subtitle: "Quality and innovation you can trust",
                reasons: [],
            },
            productsSection: body.productsSection || {
                badge: "Featured Products",
                badgeColor: "bg-red-50 text-red-600",
                heading: `Shop ${body.name} Products`,
                subtitle: `Discover our selection of ${body.name} products.`,
                manufacturerFilter: body.name.toLowerCase(),
                maxProducts: 12,
                ctaText: `View All ${body.name} Products`,
                ctaLink: `/products?brands=${encodeURIComponent(body.name)}`,
            },
            categorySection: body.categorySection || {
                badge: "Explore Categories",
                badgeColor: "bg-blue-50 text-blue-600",
                heading: `${body.name} Product Categories`,
                subtitle: `Discover the complete range of ${body.name} products.`,
            },
            trustBadges: body.trustBadges || [],
            heroContent: body.heroContent || {
                title: body.name.toUpperCase(),
                subtitle: body.tagline || "",
                description: body.description || "",
                ctaText: `Shop ${body.name} Products`,
                ctaLink: `/products?brands=${encodeURIComponent(body.name)}`,
                ctaColor: "from-blue-600 to-blue-500",
                secondaryCta: "Learn More",
            },
            leadFormEnabled: body.leadFormEnabled ?? false,
            leadFormSource: body.leadFormSource || `${body.name} Brand Page`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const result = await db.collection("brands").insertOne(brand)

        return NextResponse.json({
            success: true,
            message: "Brand created successfully",
            brandId: result.insertedId,
        })
    } catch (error) {
        console.error("Error creating brand:", error)
        return NextResponse.json({ success: false, message: "Failed to create brand" }, { status: 500 })
    }
}

// PATCH - Update an existing brand
export async function PATCH(request: NextRequest) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { db } = await connectToDatabase()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ success: false, message: "Brand ID is required" }, { status: 400 })
        }

        // If slug is being updated, check for duplicates
        if (updates.slug) {
            const existing = await db.collection("brands").findOne({
                slug: updates.slug,
                _id: { $ne: new ObjectId(id) },
            })
            if (existing) {
                return NextResponse.json({ success: false, message: "A brand with this slug already exists" }, { status: 409 })
            }
        }

        updates.updatedAt = new Date()

        const result = await db.collection("brands").updateOne(
            { _id: new ObjectId(id) },
            { $set: updates }
        )

        if (result.matchedCount === 0) {
            return NextResponse.json({ success: false, message: "Brand not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true, message: "Brand updated successfully" })
    } catch (error) {
        console.error("Error updating brand:", error)
        return NextResponse.json({ success: false, message: "Failed to update brand" }, { status: 500 })
    }
}

// DELETE - Delete a brand
export async function DELETE(request: NextRequest) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { db } = await connectToDatabase()
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ success: false, message: "Brand ID is required" }, { status: 400 })
        }

        const result = await db.collection("brands").deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
            return NextResponse.json({ success: false, message: "Brand not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true, message: "Brand deleted successfully" })
    } catch (error) {
        console.error("Error deleting brand:", error)
        return NextResponse.json({ success: false, message: "Failed to delete brand" }, { status: 500 })
    }
}
