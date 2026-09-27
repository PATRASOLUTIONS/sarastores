import { NextResponse } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { emailSchema } from "@/lib/validation"
import { withRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-error"

const SubscribeSchema = z.object({
  email: emailSchema,
  source: z.string().max(120).optional(),
})

export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const parsed = SubscribeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }

    const email = parsed.data.email.toLowerCase().trim()
    const collection = await getCollection("leads")

    // Re-subscribing must not create a duplicate lead for the same address.
    await collection.updateOne(
      { email, category: "Newsletter" },
      {
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          email,
          name: "",
          phone: "",
          pincode: "",
          category: "Newsletter",
          source: parsed.data.source || "Footer newsletter",
          status: "new",
          createdAt: new Date(),
        },
      },
      { upsert: true },
    )

    return NextResponse.json({ success: true, message: "You're subscribed. Watch your inbox for offers." })
  } catch (error) {
    return handleApiError(error, "Failed to subscribe")
  }
}, RATE_LIMITS.CONTACT)
