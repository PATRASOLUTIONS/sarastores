import { z } from "zod"

export const EMPLOYEE_FIELD_LABELS: Record<string, string> = {
  employeeId: "Employee ID", name: "Full name", email: "Login email", department: "Department",
  role: "Job title", status: "Status", dashboardAccess: "Dashboard access", allowedPages: "Dashboard pages",
  storeAccess: "Store access", storeIds: "Selected stores", password: "Password", form: "Staff details",
}
export const EmployeeFailureSchema = z.object({
  error: z.string().min(1).max(2000), code: z.string().max(100).optional(),
  action: z.string().max(2000).optional(), fieldErrors: z.record(z.array(z.string().max(2000))).optional(),
  reference: z.string().max(100).optional(),
})
export type EmployeeFailure = z.infer<typeof EmployeeFailureSchema>
export function employeeValidationFailure(issues: z.ZodIssue[]): EmployeeFailure {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues.slice(0, 20)) {
    const field = String(issue.path[0] || "form")
    const messages = fieldErrors[field] ||= []
    if (!messages.includes(issue.message)) messages.push(issue.message)
  }
  return { error: "Some staff details are invalid or missing.", code: "INVALID_STAFF_DETAILS", fieldErrors,
    action: "Correct the fields listed below, then submit the form again." }
}
export function employeeResponseFailure(status: number, data: unknown): EmployeeFailure {
  if (status === 401) return { error: "Your sign-in session is no longer valid.", action: "Sign in again with an administrator account, then retry." }
  if (status === 403) return { error: "This login does not have permission to manage staff.", action: "Sign in with a full administrator account to create or edit staff." }
  if (status === 429) return { error: "Too many staff requests were submitted in a short time.", action: "Wait briefly, then retry only the rows that were not created. Check the staff list first." }
  const parsed = EmployeeFailureSchema.safeParse(data)
  if (parsed.success) return { ...parsed.data, action: parsed.data.action || "Review the reason above, correct the details if needed, then retry." }
  return { error: status >= 500 ? "The staff service returned an unavailable or unreadable response." : "The staff request was rejected.",
    action: "Reload the staff list before retrying to check whether the staff member was already created." }
}
export class EmployeeRequestError extends Error {
  constructor(public readonly failure: EmployeeFailure) { super(failure.error); this.name = "EmployeeRequestError" }
}
export function employeeNetworkFailure(): EmployeeFailure {
  return { error: "The request did not finish, so the staff creation or update could not be confirmed.",
    action: "Check your connection and reload the staff list before retrying. If the staff member is already listed, edit that record instead of creating it again." }
}
