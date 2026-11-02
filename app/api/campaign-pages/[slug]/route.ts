import { NextResponse } from "next/server";
import { getCollection, normalizeId } from "@/lib/db-service";
import { ObjectId } from "mongodb";
import { type CampaignPageDocument, campaignPageResponseSchema } from "@/lib/campaign-page";
import { productCardResponseSchema, type ProductCardResponse } from "@/lib/product-card-response";
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility";
import { getPublicCatalogueSelection } from "@/lib/public-catalogue";

interface CampaignProductDocument {
  _id: ObjectId | string;
  id?: string;
  active?: boolean;
  [field: string]: unknown;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const campaigns = await getCollection<CampaignPageDocument>("campaign_pages");
    
    // Find active campaign
    const campaign = await campaigns.findOne({ slug, isActive: true });
    
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const normalized = campaignPageResponseSchema.parse(normalizeId(campaign));
    let products: ProductCardResponse[] = [];
    if (normalized.productIds.length) {
      if (normalized.productIds.length > 500) throw new Error("Stored campaign exceeds product limit");
      const collection = await getCollection<CampaignProductDocument>("products");
      const selection = await getPublicCatalogueSelection();
      const nativeIds = normalized.productIds.flatMap(id => selection.representativeIds.get(id) ?? []);
      const documents = await collection.find({
        ...PUBLIC_PRODUCT_FILTER,
        _id: { $in: nativeIds },
      }).toArray();
      products = documents.map(product => productCardResponseSchema.parse(normalizeId(product)));
    }

    return NextResponse.json({ 
      success: true, 
      campaign: {
        id: normalized.id,
        name: normalized.name,
        slug: normalized.slug,
        banner: normalized.banner,
        isActive: normalized.isActive,
        products
      } 
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error(`Failed to fetch campaign for slug [${slug}]:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaign" }, { status: 500 });
  }
}
