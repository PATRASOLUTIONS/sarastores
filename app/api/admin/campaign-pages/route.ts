import { NextResponse } from "next/server";
import { getCollection, normalizeId } from "@/lib/db-service";
import { requireAdmin } from "@/lib/auth";
import { CreateCampaignPageSchema, type CampaignPageDocument } from "@/lib/campaign-page";
import { MongoServerError } from "mongodb";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const collection = await getCollection<CampaignPageDocument>("campaign_pages");
    const campaigns = await collection.find({}).sort({ _id: -1 }).toArray();
    return NextResponse.json({ success: true, campaigns: campaigns.map(normalizeId) });
  } catch (error) {
    console.error("Failed to fetch campaigns", error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = CreateCampaignPageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid campaign details" }, { status: 400 });
    const collection = await getCollection<Omit<CampaignPageDocument, "_id">>("campaign_pages");
    const existing = await collection.findOne({ slug: parsed.data.slug });
    if (existing) {
      return NextResponse.json({ success: false, error: "A campaign with this slug already exists" }, { status: 409 });
    }

    const newCampaign = {
      ...parsed.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newCampaign);
    return NextResponse.json({ success: true, campaign: normalizeId({ ...newCampaign, _id: result.insertedId }) });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json(
      { success: false, error: "A campaign with this slug already exists" }, { status: 409 }
    );
    console.error("Failed to create campaign", error);
    return NextResponse.json({ success: false, error: "Failed to create campaign" }, { status: 500 });
  }
}
