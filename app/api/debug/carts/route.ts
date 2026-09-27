import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db-service';
import { checkAdminAuthorization } from '@/lib/auth';

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const auth = await checkAdminAuthorization();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 });
  }

  try {
    const cartsCollection = await getCollection('carts');
    const recentCarts = await cartsCollection.find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray();

    return NextResponse.json({
      count: recentCarts.length,
      carts: recentCarts.map(c => ({
        _id: c._id,
        userId: c.userId,
        itemCount: c.items?.length,
        updatedAt: c.updatedAt,
        abandonedEmailSent: c.abandonedEmailSent
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
