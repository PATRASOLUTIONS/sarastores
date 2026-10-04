import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type WithId, type Document } from "mongodb";

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const { db } = await connectToDatabase();
    
    // Find active campaign
    const campaign = await db.collection("campaign_pages").findOne({ slug, isActive: true });
    
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // Populate products
    let products: WithId<Document>[] = [];
    if (campaign.productIds && campaign.productIds.length > 0) {
      // Filter out invalid IDs to prevent cast errors
      const validIds = campaign.productIds
        .filter((id: string) => ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));
        
      if (validIds.length > 0) {
        // Fetch matching products. Using standard find so we get full product data for <CategoryProductCard />
        products = await db.collection("products")
          .find({ _id: { $in: validIds } })
          .toArray();
      }
    }

    return NextResponse.json({ 
      success: true, 
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        slug: campaign.slug,
        banner: campaign.banner,
        isActive: campaign.isActive,
        products
      } 
    });
  } catch (error) {
    console.error(`Failed to fetch campaign for slug [${slug}]:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaign" }, { status: 500 });
  }
}
