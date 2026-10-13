import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { UpdateEmployeeSchema, updateEmployee, deleteEmployee, EmployeeError, type EmployeeDocument } from "@/lib/employee-service"
import { EmployeeResponseSchema } from "@/lib/validation"

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: Context) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    const collection = await getCollection<EmployeeDocument>("employees")
    const employee = await collection.findOne({ _id: new ObjectId(id) })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    return NextResponse.json(EmployeeResponseSchema.parse(normalizeId(employee)), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleApiError(error, "Failed to fetch employee")
  }
}

export async function PUT(req: Request, context: Context) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    const parsed = UpdateEmployeeSchema.safeParse(await req.json().catch(error => {
      console.warn("Invalid employee update JSON:", error)
      return null
    }))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid employee update" }, { status: 400 })
    return NextResponse.json(await updateEmployee(id, parsed.data))
  } catch (error) {
    if (error instanceof EmployeeError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(error, "Failed to update employee")
  }
}

export async function DELETE(_req: Request, context: Context) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    return NextResponse.json(await deleteEmployee(id))
  } catch (error) {
    if (error instanceof EmployeeError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(error, "Failed to delete employee")
  }
}
