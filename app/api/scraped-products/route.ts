import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { handleApiError } from "@/lib/api-error"

// GET - Fetch all products that have been scraped from Amazon
// GET - Fetch all products that have been scraped from Amazon
export async function GET(request: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")
        if (id && !ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 })
        const productsCollection = await getCollection("products")

        // If ID provided, return single full product (scraped data)
        if (id) {
            const product = await productsCollection.findOne({
                _id: new ObjectId(id)
            })

            if (!product) {
                return NextResponse.json(
                    { success: false, error: "Product not found" },
                    { status: 404 }
                )
            }

            return NextResponse.json(normalizeId(product))
        }

        // Find products that have Amazon data (source = amazon-scraper OR has asin field)
        const scrapedProducts = await productsCollection
            .find({
                $or: [
                    { source: "amazon-scraper" },
                    {
                        asin: { $exists: true },
                        $and: [
                            { asin: { $ne: null } },
                            { asin: { $ne: "" } }
                        ]
                    },
                ],
            })
            .project({
                _id: 1,
                itemno: 1,
                name: 1,
                brand: 1,
                category: 1,
                asin: 1,
                amazonUrl: 1,
                price: 1,
                mrp: 1,
                image: 1,
                scrapedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                source: 1,
                amazonRating: 1,
                amazonReviewCount: 1,
            })
            .sort({ updatedAt: -1 })
            .limit(100)
            .toArray()

        return NextResponse.json({
            success: true,
            products: scrapedProducts.map(normalizeId),
            count: scrapedProducts.length,
        })
    } catch (error) {
        return handleApiError(error, "Failed to fetch scraped products")
    }
}

// DELETE - Remove Amazon data from a product (keep product, just clear Amazon fields)
export async function DELETE(request: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { searchParams } = new URL(request.url)
        const productId = searchParams.get("id")
        const itemno = searchParams.get("itemno")

        if (!productId && !itemno) {
            return NextResponse.json(
                { success: false, error: "Product ID or Item No is required" },
                { status: 400 }
            )
        }

        if (productId && !ObjectId.isValid(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 })
        const productsCollection = await getCollection("products")

        const query = productId
            ? { _id: new ObjectId(productId) }
            : { itemno: itemno }

        // Clear Amazon-related fields
        const result = await productsCollection.updateOne(query, {
            $unset: {
                asin: "",
                amazonUrl: "",
                amazonName: "",
                amazonBrand: "",
                amazonCategory: "",
                amazonAboutThisItem: "",
                amazonDescription: "",
                amazonTechnicalDetails: "",
                amazonAdditionalInfo: "",
                amazonManufacturerInfo: "",
                amazonManufacturerImages: "",
                amazonWhatsIncluded: "",
                amazonReturnPolicy: "",
                amazonReviewsSummary: "",
                amazonWarranty: "",
                amazonPrice: "",
                amazonMrp: "",
                amazonImage: "",
                amazonImages: "",
                amazonSpecifications: "",
                amazonFeatures: "",
                amazonRating: "",
                amazonReviewCount: "",
                amazonInStock: "",
                scrapedAt: "",
            },
            $set: {
                source: "manual",
                updatedAt: new Date().toISOString(),
            },
        })

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: "Product not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: "Amazon data removed from product",
        })
    } catch (error) {
        return handleApiError(error, "Failed to remove Amazon data")
    }
}
