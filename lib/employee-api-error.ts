import { NextResponse } from "next/server"
import { EmployeeError } from "@/lib/employee-service"
import type { EmployeeFailure } from "@/lib/employee-failure"

/** Return actionable reasons without exposing MongoDB messages, credentials or request bodies. */
export function employeeApiError(error: unknown) {
  if (error instanceof EmployeeError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status, headers: { "Cache-Control": "no-store" } })
  const detail = error && typeof error === "object" ? error as { code?: number; keyPattern?: Record<string, unknown>; name?: string; message?: string; hasErrorLabel?: (label: string) => boolean } : {}
  const reference = crypto.randomUUID()
  console.error(`[Staff request ${reference}]`, error)
  let status = 500
  let failure: EmployeeFailure = { error: "The server could not complete the staff request because of an unexpected error.",
    action: "Reload the staff list before retrying. If the problem continues, share the reference below with the system administrator so they can check the server logs." }
  if (detail.hasErrorLabel?.("UnknownTransactionCommitResult")) {
    failure = { error: "The database did not confirm whether the staff request was saved.", code: "STAFF_RESULT_UNCONFIRMED",
      action: "Reload the staff list before retrying. If the staff member already exists, edit that record instead of creating a duplicate." }
  } else if (detail.code === 11000) {
    const field = detail.keyPattern?.employeeId ? "employeeId" : detail.keyPattern?.email ? "email" : "form"
    status = 409
    failure = { error: field === "employeeId" ? "This Employee ID is already in use." : field === "email" ? "This login email is already in use." : "An Employee ID or login email is already in use.",
      code: "DUPLICATE_STAFF", fieldErrors: { [field]: ["This value must be unique."] }, action: "Use a different value, or find the existing staff member and edit their access." }
  } else if (detail.code === 85 || detail.code === 86) {
    failure = { error: "Existing database indexes conflict with the staff configuration.", code: "STAFF_INDEX_CONFLICT",
      action: "Ask the system administrator to reconcile the conflicting staff or account index, then retry. Changing the form values will not fix this problem." }
  } else if (detail.code === 20 && /transaction|replica set|mongos/i.test(detail.message || "")) {
    failure = { error: "The database does not support the transaction needed to save the staff member and login together.", code: "STAFF_TRANSACTION_UNSUPPORTED",
      action: "Ask the system administrator to use a MongoDB replica set or compatible cluster, then retry." }
  } else if (detail.code === 13 || detail.code === 18) {
    status = 503
    failure = { error: "The server's database account could not authenticate or does not have the permissions required to save staff.", code: "STAFF_DATABASE_ACCESS_DENIED",
      action: "Ask the system administrator to check the database credentials and write/index permissions, then retry." }
  } else if (/Mongo(Network|ServerSelection)|Timeout/i.test(detail.name || "") || /MongoDB connection failed|Failed to connect to MongoDB/i.test(detail.message || "")) {
    status = 503
    failure = { error: "The server could not reach the staff database or the database request timed out.", code: "STAFF_DATABASE_UNAVAILABLE",
      action: "Ask the system administrator to check database availability. Reload the staff list before retrying to confirm whether the request was saved." }
  }
  return NextResponse.json({ ...failure, reference }, { status, headers: { "Cache-Control": "no-store" } })
}
