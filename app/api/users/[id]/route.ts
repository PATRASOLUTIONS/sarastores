import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { normalizeId } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { getSession } from "@/lib/auth"
import { AccountProfileSchema } from "@/lib/validation"
import { z } from "zod"

const AdminProfileSchema = AccountProfileSchema.extend({
  role: z.enum(["user", "vendor", "admin", "superadmin"]).optional(),
  dashboardAccess: z.boolean().optional(),
  allowedPages: z.array(z.string().startsWith("/admin/").max(200)).max(100).optional(),
  storeAccess: z.enum(["none", "selected", "all"]).optional(),
  storeIds: z.array(z.string().max(100)).max(100).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict()

function isAdminRole(role?: string) {
  return role === "admin" || role === "superadmin"
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Only the account owner or an admin may read a user profile.
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }
    if (session.user.id !== id && !isAdminRole(session.user.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const usersCollection = await getCollection("users")

    let objectId: ObjectId
    try {
      objectId = new ObjectId(id)
    } catch (err) {
      return NextResponse.json({ message: "Invalid user id" }, { status: 400 })
    }

    const user = await usersCollection.findOne({ _id: objectId })

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Don't send the password back to the client
    const { password, resetPasswordToken, resetPasswordExpiry, emailVerificationToken, emailVerificationExpiry, ...userWithoutPassword } = user

    return NextResponse.json(normalizeId(userWithoutPassword))
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ message: "An error occurred while fetching user" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Only the account owner or an admin may modify a profile.
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }
    const requesterIsAdmin = isAdminRole(session.user.role)
    if (session.user.id !== id && !requesterIsAdmin) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    let objectId: ObjectId
    try {
      objectId = new ObjectId(id)
    } catch (err) {
      return NextResponse.json({ message: "Invalid user id" }, { status: 400 })
    }
    const data = await request.json()
    const profile = (requesterIsAdmin ? AdminProfileSchema : AccountProfileSchema.strict()).safeParse(data)
    if (!profile.success) return NextResponse.json({ message: profile.error.issues[0].message }, { status: 400 })
    const usersCollection = await getCollection("users")

    const updateData: Record<string, unknown> = { ...profile.data }
    const target = await usersCollection.findOne({ _id: objectId })
    if (!target) return NextResponse.json({ message: "User not found" }, { status: 404 })
    if (session.user.role !== "superadmin" && (updateData.role === "superadmin" || target.role === "superadmin")) {
      return NextResponse.json({ message: "Only a superadmin may manage superadmin accounts" }, { status: 403 })
    }

    const result = await usersCollection.updateOne(
      { _id: objectId },
      { $set: { ...updateData, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const updatedUser = await usersCollection.findOne({ _id: objectId })

    // Don't send the password back to the client
    const { password: _, resetPasswordToken, resetPasswordExpiry, emailVerificationToken, emailVerificationExpiry, ...userWithoutPassword } = updatedUser!

    return NextResponse.json(normalizeId(userWithoutPassword))
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ message: "An error occurred while updating user" }, { status: 500 })
  }
}
