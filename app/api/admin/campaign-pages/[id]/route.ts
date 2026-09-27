import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/auth";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const { db } = await connectToDatabase();
    const data = await req.json();
    
    // Check slug uniqueness if slug changed
    let finalSlug = data.slug?.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (finalSlug) {
      const existing = await db.collection("campaign_pages").findOne({ 
        slug: finalSlug,
        _id: { $ne: new ObjectId(id) }
      });
      if (existing) {
        return NextResponse.json({ success: false, error: "A campaign with this slug already exists" }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (finalSlug !== undefined) updateData.slug = finalSlug;
    if (data.banner !== undefined) updateData.banner = data.banner;
    if (data.productIds !== undefined) updateData.productIds = data.productIds;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedAt = new Date();

    await db.collection("campaign_pages").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    return NextResponse.json({ success: true, message: "Campaign updated" });
  } catch (error) {
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

    const { db } = await connectToDatabase();
    await db.collection("campaign_pages").deleteOne({ _id: new ObjectId(id) });
    
    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error) {
    console.error("Failed to delete campaign", error);
    return NextResponse.json({ success: false, error: "Failed to delete campaign" }, { status: 500 });
  }
}
