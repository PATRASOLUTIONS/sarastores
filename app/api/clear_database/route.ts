import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { checkAdminAuthorization } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const auth = await checkAdminAuthorization();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();

    const collectionsToClear = ['products', 'categories', 'product_specifications'];
    const results = [];

    for (const collectionName of collectionsToClear) {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        results.push({
          collection: collectionName,
          deleted: result.deletedCount
        });
      } catch (err) {
        console.error(`Error clearing ${collectionName}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database cleared successfully",
      details: results
    });
  } catch (error) {
    console.error('Error in clear-database:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear database"
    }, { status: 500 });
  }
}
