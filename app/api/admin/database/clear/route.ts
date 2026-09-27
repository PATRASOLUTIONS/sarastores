import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { checkAdminAuthorization } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const auth = await checkAdminAuthorization();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    
    if (process.env.NODE_ENV === "development") console.log('Starting database clear operation...');
    
    // Collections to clear
    const collectionsToClear = ['products', 'categories', 'product_specifications'];
    const results = [];

    // Clear each collection
    for (const collectionName of collectionsToClear) {
      try {
        if (process.env.NODE_ENV === "development") console.log(`Clearing collection: ${collectionName}`);
        const result = await db.collection(collectionName).deleteMany({});
        results.push({
          collection: collectionName,
          deleted: result.deletedCount
        });
        if (process.env.NODE_ENV === "development") console.log(`Successfully cleared ${collectionName}:`, result.deletedCount, 'documents');
      } catch (err) {
        console.error(`Error clearing ${collectionName}:`, err);
        throw err;
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