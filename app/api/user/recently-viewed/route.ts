import { NextResponse } from "next/server";
import { getCollection, normalizeId } from "@/lib/db-service";
import { ObjectId } from "mongodb";
import { getCurrentUserId } from "@/lib/auth";
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility";

const COLLECTION = "users";

interface UserRecentlyViewedDocument {
    recentlyViewed?: string[];
}

export async function POST(req: Request) {
    try {
        const userId = await getCurrentUserId();
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const { productId } = await req.json();
        if (!productId || typeof productId !== "string") {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const productsCollection = await getCollection<{ _id: ObjectId | string; id?: string; active?: boolean }>("products");
        const product = await productsCollection.findOne({
            ...PUBLIC_PRODUCT_FILTER,
            $or: [
                ...(ObjectId.isValid(productId) ? [{ _id: new ObjectId(productId) }] : []),
                { _id: productId },
                { id: productId },
            ],
        });
        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const collection = await getCollection<UserRecentlyViewedDocument>(COLLECTION);

        // Add to beginning of array, limit to 20 items, prevent duplicates
        await collection.updateOne(
            { _id: new ObjectId(userId) },
            {
                $pull: { recentlyViewed: productId } // Remove if exists to re-add at top
            }
        );

        await collection.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    recentlyViewed: {
                        $each: [productId],
                        $position: 0,
                        $slice: 20
                    }
                }
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating recently viewed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const userId = await getCurrentUserId();
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const collection = await getCollection<UserRecentlyViewedDocument>(COLLECTION);
        const user = await collection.findOne({ _id: new ObjectId(userId) });

        if (!user || !user.recentlyViewed) {
            return NextResponse.json({ products: [] });
        }

        // Fetch product details for the recent IDs
        const productsCollection = await getCollection<{ _id: ObjectId | string; id?: string; slug?: string; name?: string; active?: boolean }>("products");

        // Convert string IDs to ObjectIds if your product IDs are ObjectIds
        // Assuming product IDs are strings based on project context, but handling both
        const productIds = user.recentlyViewed;

        let products = [];

        // Try matching as strings first
        products = await productsCollection.find({
            ...PUBLIC_PRODUCT_FILTER,
            $or: [
                { id: { $in: productIds } },
                {
                    _id: {
                        $in: productIds.map((id: string) => {
                            try { return new ObjectId(id) } catch { return id }
                        })
                    }
                }
            ]
        }).toArray();

        // Sort products by the order in recentlyViewed
        const sortedProducts = productIds
            .map((id: string) => products.find((p) => String(p.id) === String(id) || String(p._id) === String(id)))
            .filter((product) => product !== undefined);

        // Ensure slug exists on each product
        const { generateProductSlug } = await import("@/utils/slug")
        const productsWithSlug = sortedProducts.map((p) => {
            const normalized = normalizeId(p)
            if (!normalized.slug && normalized.name) normalized.slug = generateProductSlug(normalized.name)
            return normalized
        })

        return NextResponse.json({ products: productsWithSlug });
    } catch (error) {
        console.error("Error fetching recently viewed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
