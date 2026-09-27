import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 })
    }

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
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpiry: "",
        },
      }
    )

    return NextResponse.json({
      ok: true,
      message: "Password has been reset successfully. You can now login with your new password.",
    })
  } catch (error: any) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password. Please try again later." },
      { status: 500 }
    )
  }
}
