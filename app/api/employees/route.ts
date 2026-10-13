import { NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CreateEmployeeSchema, createEmployee, EmployeeError, type EmployeeDocument } from "@/lib/employee-service"
import { EmployeeListResponseSchema } from "@/lib/validation"

export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const collection = await getCollection<EmployeeDocument>("employees")
    const employees = await collection.find({}).limit(200).toArray()
    return NextResponse.json(EmployeeListResponseSchema.parse(normalizeId(employees)), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleApiError(error, "Failed to fetch employees")
  }
}

export async function POST(req: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = CreateEmployeeSchema.safeParse(await req.json().catch(error => {
      console.warn("Invalid employee creation JSON:", error)
      return null
    }))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid employee" }, { status: 400 })
    return NextResponse.json(await createEmployee(parsed.data), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof EmployeeError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(error, "Failed to create employee")
  }
}
