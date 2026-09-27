import { NextResponse, type NextRequest } from "next/server"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"

// This endpoint is deliberately public (in-store checkout happens before login),
// so it is rate limited to stop employee-ID enumeration.
const VALIDATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: "Too many validation attempts, please try again later.",
}

async function handler(req: NextRequest) {
  try {
    const { employeeId, email } = await req.json()

    if (!employeeId || typeof employeeId !== "string") {
      return NextResponse.json(
        { valid: false, message: "Employee ID is required" },
        { status: 400 }
      )
    }

    const collection = await getCollection("employees")

    const employee = await collection.findOne({
      employeeId: employeeId.trim(),
      status: "active",
    })

    if (!employee) {
      return NextResponse.json({
        valid: false,
        message: "Invalid employee ID",
      })
    }

    // If email is provided, verify it matches
    if (email && typeof email === "string" && email.trim() && employee.email !== email.trim()) {
      return NextResponse.json({
        valid: false,
        message: "Employee ID and email do not match",
      })
    }

    return NextResponse.json({
      valid: true,
      message: "Valid employee",
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
      },
    })
  } catch (error) {
    console.error("Employee validation error:", error)
    return NextResponse.json(
      { valid: false, message: "Error validating employee" },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(handler, VALIDATE_LIMIT)
