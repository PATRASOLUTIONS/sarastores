import { NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CreateEmployeeSchema, createEmployee, type EmployeeDocument } from "@/lib/employee-service"
import { employeeValidationFailure } from "@/lib/employee-failure"
import { employeeApiError } from "@/lib/employee-api-error"
import { EmployeeListResponseSchema } from "@/lib/validation"
import { getEmployeeAccessDirectory } from "@/lib/employee-directory"

export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    if (request && new URL(request.url).searchParams.get("includeAccessAccounts") === "true") {
      return NextResponse.json(await getEmployeeAccessDirectory(), { headers: { "Cache-Control": "no-store" } })
    }
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
    if (!parsed.success) return NextResponse.json(employeeValidationFailure(parsed.error.issues), { status: 400, headers: { "Cache-Control": "no-store" } })
    return NextResponse.json(await createEmployee(parsed.data), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return employeeApiError(error)
  }
}
