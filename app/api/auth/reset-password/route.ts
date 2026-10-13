import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { revokeAllForUser } from "@/lib/refresh-tokens"
import { z } from "zod"
import { passwordSchema } from "@/lib/validation"

const ResetSchema = z.object({ token: z.string().min(1).max(200), password: passwordSchema })

export async function POST(req: Request) {
  try {
    const parsed = ResetSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { token, password } = parsed.data

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // Find user with valid reset token
    const user = await usersCollection.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpiry: { $gt: new Date() }, // Token not expired
    })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token. Please request a new password reset link." },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password and clear reset token
    const result = await usersCollection.updateOne(
      { _id: user._id, resetPasswordToken: resetTokenHash, resetPasswordExpiry: { $gt: new Date() } },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpiry: "",
        },
        $inc: { sessionVersion: 1 },
      }
    )
    if (!result.matchedCount) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }
    await revokeAllForUser(user._id.toString(), "password_reset")

    return NextResponse.json({
      ok: true,
      message: "Password has been reset successfully. You can now login with your new password.",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password. Please try again later." },
      { status: 500 }
    )
  }
}
