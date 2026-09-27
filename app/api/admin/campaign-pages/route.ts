import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { db } = await connectToDatabase();
    const campaigns = await db.collection("campaign_pages").find({}).sort({ _id: -1 }).toArray();
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error("Failed to fetch campaigns", error);
    return NextResponse.json({ success: false, error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { db } = await connectToDatabase();
    const data = await req.json();
    
    // basic validation
    if (!data.name || !data.slug) {
      return NextResponse.json({ success: false, error: "Name and Slug are required" }, { status: 400 });
    }

    // Check slug uniqueness
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const existing = await db.collection("campaign_pages").findOne({ slug });
    if (existing) {
      return NextResponse.json({ success: false, error: `A campaign with the slug '${slug}' already exists` }, { status: 400 });
    }

    const newCampaign = {
      name: data.name,
      slug: slug,
      banner: data.banner || "",
      productIds: data.productIds || [],
      isActive: data.isActive ?? true,
      createdAt: new Date(),
    };

    const result = await db.collection("campaign_pages").insertOne(newCampaign);
    return NextResponse.json({ success: true, campaign: { ...newCampaign, _id: result.insertedId } });
  } catch (error) {
    console.error("Failed to create campaign", error);
    return NextResponse.json({ success: false, error: "Failed to create campaign" }, { status: 500 });
  }
}
