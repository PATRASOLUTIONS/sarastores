import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/db-service";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/emailTemplates";
import { ObjectId } from "mongodb";

/**
 * TEST ENDPOINT: Manually trigger abandoned cart email
 * 
 * Usage:
 * POST http://localhost:3000/api/debug/test-abandoned-cart
 * Body: { userId: "user-id" }
 * 
 * Only works in development mode!
 */

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development mode" },
      { status: 403 }
    );
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required in request body" },
        { status: 400 }
      );
    }

    console.log(`\n🧪 [DEBUG] Testing abandoned cart email for userId: ${userId}\n`);

    const cartsCollection = await getCollection("carts");
    const usersCollection = await getCollection("users");

    // Find user's cart
    const cart = await cartsCollection.findOne({ userId });

    if (!cart) {
      return NextResponse.json(
        { error: `No cart found for user ${userId}` },
        { status: 404 }
      );
    }

    if (!cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: `Cart is empty for user ${userId}` },
        { status: 400 }
      );
    }

    // Find user
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return NextResponse.json(
        { error: `User ${userId} not found` },
        { status: 404 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: `User ${userId} has no email address` },
        { status: 400 }
      );
    }

    console.log(`✅ Found cart with ${cart.items.length} items for ${user.email}`);

    // Prepare email
    const itemsToShow = cart.items.slice(0, 3).map((item: any) => ({
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity
    }));

    const emailHtml = emailTemplates.CART_ABANDONMENT.html({
      customerName: user.firstName || "Shopper",
      cartUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/cart`,
      items: itemsToShow
    });

    // Send email
    console.log(`📧 Sending abandoned cart email to ${user.email}...`);

    const result = await sendEmail({
      to: user.email,
      subject: emailTemplates.CART_ABANDONMENT.subject,
      html: emailHtml
    });

    if (result.success) {
      console.log(`✅ Email sent successfully!`);

      // Update cart record
      await cartsCollection.updateOne(
        { _id: cart._id },
        {
          $set: {
            lastAbandonmentEmailSent: new Date(),
            abandonmentEmailCount: (cart.abandonmentEmailCount || 0) + 1
          }
        }
      );

      return NextResponse.json({
        success: true,
        message: `Abandoned cart email sent to ${user.email}`,
        details: {
          userId,
          cartId: cart._id,
          itemCount: cart.items.length,
          email: user.email,
          userName: `${user.firstName} ${user.lastName}`
        }
      });
    } else {
      console.error(`❌ Failed to send email`);
      return NextResponse.json(
        { error: "Failed to send email", details: result },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Error in test endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET request - shows test instructions
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development mode" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: "Abandoned Cart Email Test Endpoint",
    method: "POST",
    endpoint: "/api/debug/test-abandoned-cart",
    headers: {
      "Content-Type": "application/json"
    },
    body: {
      userId: "string (required) - MongoDB user ID"
    },
    example: {
      curl: `curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "YOUR_USER_ID_HERE"}'`
    },
    notes: [
      "⚠️ Only available in development mode",
      "✅ Sends a real abandoned cart email",
      "📧 User must have a valid email address",
      "🛒 User must have items in their cart",
      "You can call this multiple times to test repeated emails"
    ]
  });
}
