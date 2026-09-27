import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db-service';
import { emailTemplates } from '@/lib/emailTemplates';
import { sendEmail } from '@/lib/email';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const auth = await checkAdminAuthorization();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 });
  }

  try {
    const cartsCollection = await getCollection('carts');
    const usersCollection = await getCollection('users');

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleCarts = await cartsCollection.find({
      updatedAt: { $lt: twoMinutesAgo, $gt: twentyFourHoursAgo },
      items: { $not: { $size: 0 } },
      abandonedEmailSent: { $ne: true }
    }).toArray();

    const results = [];

    for (const cart of staleCarts) {
      if (!cart.userId) {
        results.push({ id: cart._id, status: 'Skipped: Guest' });
        continue;
      }

      const user = await usersCollection.findOne({ _id: new ObjectId(cart.userId) });
      if (!user || !user.email) {
        results.push({ id: cart._id, status: 'Skipped: No User/Email' });
        continue;
      }

      const itemsToShow = cart.items.slice(0, 3).map((item: any) => ({
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity
      }));

      const emailHtml = emailTemplates.CART_ABANDONMENT.html({
        customerName: user.firstName || 'Shopper',
        cartUrl: `${process.env.NEXTAUTH_URL}/cart`,
        items: itemsToShow
      });

      const result = await sendEmail({
        to: user.email,
        subject: emailTemplates.CART_ABANDONMENT.subject,
        html: emailHtml
      });

      if (result.success) {
        await cartsCollection.updateOne(
          { _id: cart._id },
          { $set: { abandonedEmailSent: true } }
        );
        results.push({ id: cart._id, email: user.email, status: 'Sent' });
      } else {
        results.push({ id: cart._id, email: user.email, status: 'Failed to Send' });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, details: results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
