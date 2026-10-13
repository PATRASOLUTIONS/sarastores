import { NextResponse } from "next/server";
import { getCollection, normalizeId } from "@/lib/db-service";
import { ObjectId, MongoServerError } from "mongodb";
import { requireAdmin } from "@/lib/auth";
import { UpdateCampaignPageSchema, type CampaignPageDocument } from "@/lib/campaign-page";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = UpdateCampaignPageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid campaign details" }, { status: 400 });
    const data = parsed.data;
    const collection = await getCollection<CampaignPageDocument>("campaign_pages");
    
    // Check slug uniqueness if slug changed
    const finalSlug = data.slug;
    if (finalSlug) {
      const existing = await collection.findOne({ 
        slug: finalSlug,
        _id: { $ne: new ObjectId(id) }
      });
      if (existing) {
        return NextResponse.json({ success: false, error: "A campaign with this slug already exists" }, { status: 409 });
      }
    }

    const saved = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!saved) return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    
    return NextResponse.json({ success: true, message: "Campaign updated", campaign: normalizeId(saved) });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json(
      { success: false, error: "A campaign with this slug already exists" }, { status: 409 }
    );
    console.error("Failed to update campaign", error);
    return NextResponse.json({ success: false, error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const collection = await getCollection<CampaignPageDocument>("campaign_pages");
    const removed = await collection.deleteOne({ _id: new ObjectId(id) });
    if (!removed.deletedCount) return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    
    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error) {
    console.error("Failed to delete campaign", error);
    return NextResponse.json({ success: false, error: "Failed to delete campaign" }, { status: 500 });
  }
}
