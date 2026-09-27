import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

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

// GET single employee
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const collection = await getCollection("employees")
    
    const employee = await collection.findOne({ _id: new ObjectId(id) })
    
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }
    
    return NextResponse.json(employee)
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json({ 
      error: "Failed to fetch employee",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// PUT update employee
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const body = await req.json()
    const collection = await getCollection("employees")
    const access = accessFields(body)

    // Fetch existing employee to locate linked user(s)
    const existingEmployee = await collection.findOne({ _id: new ObjectId(id) })

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          employeeId: String(body.employeeId || "").trim(),
          name: String(body.name || "").trim(),
          email: String(body.email || "").trim().toLowerCase(),
          department: String(body.department || "").trim(),
          role: String(body.role || "Staff").trim(),
          status: body.status === "inactive" ? "inactive" : "active",
          ...access,
          updatedAt: new Date().toISOString()
        }
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Sync allowedPages and dashboardAccess to the users collection for the linked user(s)
    try {
      const usersCollection = await getCollection("users")

      const userMatch = [] as Record<string, any>[]
      if (existingEmployee) {
        if (existingEmployee.employeeId) userMatch.push({ employeeId: existingEmployee.employeeId })
        if (existingEmployee.email) userMatch.push({ email: existingEmployee.email })
      }
      // also consider matching by values provided in the request body
      if (body.employeeId) userMatch.push({ employeeId: body.employeeId })
      if (body.email) userMatch.push({ email: body.email })

      if (userMatch.length > 0) {
        await usersCollection.updateMany(
          { $or: userMatch },
          { $set: { name: String(body.name || "").trim(), email: String(body.email || "").trim().toLowerCase(), employeeId: String(body.employeeId || "").trim(), ...access, status: body.status === "inactive" ? "inactive" : "active", updatedAt: new Date().toISOString() } }
        )
        await usersCollection.updateMany(
          { $or: userMatch, employeeId: { $exists: true }, role: { $nin: ["superadmin"] } },
          { $set: { role: "user" } },
        )
      }
    } catch (uErr) {
      console.error('Error syncing user allowedPages for employee update:', uErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating employee:", error)
    return NextResponse.json({ 
      error: "Failed to update employee",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// DELETE employee
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const collection = await getCollection("employees")
    
    const employee = await collection.findOne({ _id: new ObjectId(id) })
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    if (employee) {
      const users = await getCollection("users")
      await users.deleteMany({
        $or: [{ employeeId: employee.employeeId }, { email: employee.email }],
        role: { $ne: "superadmin" },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting employee:", error)
    return NextResponse.json({ 
      error: "Failed to delete employee",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}