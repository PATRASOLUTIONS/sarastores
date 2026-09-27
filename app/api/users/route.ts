import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { checkAdminAuthorization } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  try {
    // Listing all users exposes PII — admins only.
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ message: auth.error || "Admin access required" }, { status: 401 })
    }

    const url = request.nextUrl
    const role = url.searchParams.get("role") || undefined
    const segment = url.searchParams.get("segment") || "all"
    const limitParam = url.searchParams.get("limit")
    const offsetParam = url.searchParams.get("offset")
    const limit = Number.isFinite(Number(limitParam)) ? Math.max(0, Number(limitParam)) : undefined
    const offset = Number.isFinite(Number(offsetParam)) ? Math.max(0, Number(offsetParam)) : undefined

    const usersCollection = await getCollection("users")

    const query: any = {}
    if (role) query.role = role

    // Segment membership is derived from the customer_profiles rollup; the user
    // document carries no spend or last-order fields.
    let segmentUserIds: string[] | null = null
    if (segment === "active" || segment === "dormant" || segment === "high-spenders") {
      const profiles = await getCollection("customer_profiles")
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const profileQuery =
        segment === "high-spenders"
          ? { lifetimeSpend: { $gte: 10000 } }
          : segment === "active"
            ? { lastOrderAt: { $gte: thirtyDaysAgo } }
            : { $or: [{ lastOrderAt: { $lt: thirtyDaysAgo } }, { lastOrderAt: null }] }
      const docs = await profiles.find(profileQuery, { projection: { userId: 1 } }).toArray()
      segmentUserIds = docs.map((d: any) => String(d.userId))
    }

    if (segmentUserIds) {
      query.$expr = { $in: [{ $toString: "$_id" }, segmentUserIds] }
    }

    const total = await usersCollection.countDocuments(query)
    let cursor = usersCollection.find(query).sort({ createdAt: -1 })
    if (typeof offset === "number") cursor = cursor.skip(offset)
    if (typeof limit === "number" && limit > 0) cursor = cursor.limit(limit)

    const docs = await cursor.toArray()

    // Strip the password and every credential-equivalent token: these grant account
    // takeover if they ever leave the database.
    const usersWithoutPasswords = docs.map((user) => {
      const {
        password,
        emailVerificationToken,
        emailVerificationExpiry,
        resetPasswordToken,
        resetPasswordExpiry,
        resetToken,
        resetTokenExpiry,
        ...safeUser
      } = user as Record<string, unknown>
      return safeUser
    })

    return NextResponse.json({
      items: normalizeId(usersWithoutPasswords),
      total,
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ message: "An error occurred while fetching users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Creating users (and assigning roles) is an admin-only operation.
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ message: auth.error || "Admin access required" }, { status: 401 })
    }

    const data = await request.json()
    const { email, password, name, role = "user" } = data

    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
      return NextResponse.json({ message: "Email, password, and name are required" }, { status: 400 })
    }

    const usersCollection = await getCollection("users")

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 409 })
    }

    // Create new user with a hashed password (never store plaintext).
    const newUser = {
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 12),
      name,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await usersCollection.insertOne(newUser)

    // Don't return the password
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      ...userWithoutPassword,
      id: result.insertedId.toString(),
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "An error occurred while creating user" }, { status: 500 })
  }
}
