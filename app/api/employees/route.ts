import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import bcrypt from "bcryptjs"

const accessFields = (body: any) => {
  const dashboardAccess = body.dashboardAccess === true
  const allowedPages = dashboardAccess && Array.isArray(body.allowedPages)
    ? [...new Set(body.allowedPages.map(String).filter((page: string) => page.startsWith("/admin/") || page.startsWith("https://ott.systechdigital.co.in/")))].slice(0, 100)
    : []
  const storeAccess = body.storeAccess === "all" || body.storeAccess === "selected" ? body.storeAccess : "none"
  const storeIds = storeAccess === "selected" && Array.isArray(body.storeIds)
    ? [...new Set(body.storeIds.map(String).filter(Boolean))].slice(0, 100)
    : []
  return { dashboardAccess, allowedPages, storeAccess, storeIds }
}

// GET all employees
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const collection = await getCollection("employees")
    const employees = await collection.find({}).limit(200).toArray()
    
    return NextResponse.json(employees)
  } catch (error) {
    console.error("Error fetching employees:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ 
      error: "Failed to fetch employees",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST new employee
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await req.json()
    const collection = await getCollection("employees")

    // Validate required fields
    if (!body.employeeId || !body.name || !body.email) {
      return NextResponse.json(
        { error: "Employee ID, name and email are required" },
        { status: 400 }
      )
    }

    // Check if employee ID already exists
    const normalizedEmail = String(body.email).trim().toLowerCase()
    const employeeId = String(body.employeeId).trim()
    const existing = await collection.findOne({ $or: [{ employeeId }, { email: normalizedEmail }] })
    if (existing) {
      return NextResponse.json(
        { error: "Employee ID or email already exists" },
        { status: 400 }
      )
    }

    const temporaryPassword = body.password || `${employeeId}@12345`
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)
    const access = accessFields(body)
    const employee = {
      employeeId,
      name: String(body.name).trim(),
      email: normalizedEmail,
      department: String(body.department || "").trim(),
      role: String(body.role || "Staff").trim(),
      status: body.status || "active",
      ...access,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = await collection.insertOne(employee)

    // Also create a corresponding user with role 'staff' so the employee can login
    try {
      const usersCollection = await getCollection("users")
      const existingUser = await usersCollection.findOne({ email: employee.email })
      let createdUserId = null
      if (!existingUser) {
        const userDoc = {
          email: employee.email,
          password: passwordHash,
          name: employee.name,
          role: 'user',
          employeeId: employee.employeeId,
          allowedPages: employee.allowedPages,
          dashboardAccess: employee.dashboardAccess,
          storeAccess: employee.storeAccess,
          storeIds: employee.storeIds,
          status: employee.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const ur = await usersCollection.insertOne(userDoc)
        createdUserId = ur.insertedId
      } else {
        await usersCollection.updateOne(
          { _id: existingUser._id },
          { $set: { name: employee.name, employeeId: employee.employeeId, ...access, status: employee.status, updatedAt: new Date().toISOString() } },
        )
      }

      return NextResponse.json({
        success: true,
        employeeId: result.insertedId,
        userId: createdUserId || (existingUser?._id ?? null)
      })
    } catch (uErr) {
      return NextResponse.json({
        success: true,
        employeeId: result.insertedId,
        userCreationError: uErr instanceof Error ? uErr.message : String(uErr)
      })
    }
  } catch (error) {
    return NextResponse.json({
      error: "Failed to create employee",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}