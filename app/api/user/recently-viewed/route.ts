import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db-service";
import { ObjectId } from "mongodb";
import { getCurrentUserId } from "@/lib/auth";

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
                } as any
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

        const collection = await getCollection(COLLECTION);
        const user = await collection.findOne({ _id: new ObjectId(userId) });

        if (!user || !user.recentlyViewed) {
            return NextResponse.json({ products: [] });
        }

        // Fetch product details for the recent IDs
        const productsCollection = await getCollection("products");

        // Convert string IDs to ObjectIds if your product IDs are ObjectIds
        // Assuming product IDs are strings based on project context, but handling both
        const productIds = user.recentlyViewed;

        let products = [];

        // Try matching as strings first
        products = await productsCollection.find({
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
            .map((id: string) => products.find((p: any) => String(p.id) === String(id) || String(p._id) === String(id)))
            .filter(Boolean); // Remove nulls if product not found

        // Ensure slug exists on each product
        const { generateProductSlug } = await import("@/utils/slug")
        const productsWithSlug = sortedProducts.map((p: any) => {
            const normalized = p._id ? { ...p, id: String(p._id), _id: undefined } : p
            if (!normalized.slug && normalized.name) normalized.slug = generateProductSlug(normalized.name)
            return normalized
        })

        return NextResponse.json({ products: productsWithSlug });
    } catch (error) {
        console.error("Error fetching recently viewed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
