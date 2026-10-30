import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { ObjectId, type ClientSession } from "mongodb"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation"
import type { EmployeeFailure } from "@/lib/employee-failure"

const employeeFields = z.object({
  employeeId: z.string().trim().min(1, "Enter an Employee ID.").max(100, "Employee ID must be at most 100 characters."),
  name: z.string().trim().pipe(nameSchema),
  email: z.string().trim().pipe(emailSchema).transform(value => value.toLowerCase()),
  department: z.string().trim().max(100).default(""),
  role: z.string().trim().min(1).max(100).default("Staff"),
  status: z.enum(["active", "inactive"]).default("active"),
  dashboardAccess: z.boolean().default(false),
  allowedPages: z.array(z.string().max(300).refine(value =>
    value === "/admin" || /^\/admin\/[a-zA-Z0-9/_-]+$/.test(value) ||
    /^https:\/\/ott\.systechdigital\.co\.in\/[a-zA-Z0-9/_-]*$/.test(value), "Invalid dashboard page")).max(100).default([]),
  storeAccess: z.enum(["none", "selected", "all"]).default("none"),
  storeIds: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
})
const validAccess = (value: z.infer<typeof employeeFields>, ctx: z.RefinementCtx) => {
  if (value.dashboardAccess && !value.allowedPages.length) ctx.addIssue({ code: "custom", path: ["allowedPages"], message: "Select at least one dashboard page, or turn off dashboard access." })
  if (value.storeAccess === "selected" && !value.storeIds.length) ctx.addIssue({ code: "custom", path: ["storeIds"], message: "Select at least one store, or change store access to No stores or All stores." })
}
export const CreateEmployeeSchema = employeeFields.extend({ password: passwordSchema.optional() }).strict()
  .superRefine(validAccess)
export const UpdateEmployeeSchema = employeeFields.strict()
  .superRefine(validAccess)

type EmployeeFields = z.infer<typeof employeeFields>
export interface EmployeeDocument extends EmployeeFields {
  _id?: ObjectId
  userId?: string
  createdAt: string
  updatedAt: string
}
interface EmployeeUser {
  _id?: ObjectId
  email: string
  name?: string
  password?: string
  role: string
  employeeId?: string
  sessionVersion?: number
  status?: string
  createdAt?: string
  updatedAt?: string
}

export class EmployeeError extends Error {
  constructor(message: string, public readonly status: number, public readonly details: Omit<EmployeeFailure, "error"> = {}) { super(message) }
}

function accessFields(input: EmployeeFields) {
  return {
    dashboardAccess: input.dashboardAccess,
    allowedPages: input.dashboardAccess ? [...new Set(input.allowedPages)] : [],
    storeAccess: input.storeAccess,
    storeIds: input.storeAccess === "selected" ? [...new Set(input.storeIds)] : [],
  }
}

async function employeeTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const employees = await getCollection<EmployeeDocument>("employees")
  const users = await getCollection<EmployeeUser>("users")
  try {
    await employees.createIndex({ employeeId: 1 }, { unique: true, name: "employee_id_unique" })
    await employees.createIndex({ email: 1 }, { unique: true, name: "employee_email_unique" })
    await users.createIndex({ email: 1 }, { unique: true, name: "email_unique" })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new EmployeeError(
      "Existing staff or login records contain duplicate IDs or emails, so the database uniqueness check could not be prepared.", 409,
      { code: "EXISTING_STAFF_DUPLICATES", action: "Ask the system administrator to reconcile the existing duplicate records, then retry. A different email in this form will not fix the database setup." })
    throw error
  }
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(() => work(session))
    if (result === undefined) throw new Error("Employee transaction did not complete")
    return result
  } finally {
    await session.endSession()
  }
}

async function linkedUser(employee: EmployeeDocument, session: ClientSession) {
  const users = await getCollection<EmployeeUser>("users")
  const matches = employee.userId && ObjectId.isValid(employee.userId)
    ? await users.find({ _id: new ObjectId(employee.userId) }, { session }).limit(2).toArray()
    : await users.find({ $or: [{ employeeId: employee.employeeId }, { email: employee.email }] }, { session }).limit(2).toArray()
  if (matches.length > 1 || matches.some(user => user.role !== "user" ||
    (user.employeeId && user.employeeId !== employee.employeeId))) {
    throw new EmployeeError("Linked account is ambiguous or privileged; reconcile it before editing staff", 409)
  }
  return matches[0] ?? null
}

async function revokeEmployeeSessions(userId: string, session: ClientSession) {
  const tokens = await getCollection("refresh_tokens")
  const result = await tokens.updateMany({ userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: "employee_access_changed" } }, { session })
  if (!result.acknowledged) throw new Error("Employee refresh-token revocation was not acknowledged")
}

export async function createEmployee(input: z.infer<typeof CreateEmployeeSchema>) {
  const password = input.password || randomBytes(24).toString("base64url")
  const hash = await bcrypt.hash(password, 12)
  return employeeTransaction(async session => {
    const employees = await getCollection<EmployeeDocument>("employees")
    const users = await getCollection<EmployeeUser>("users")
    const { password: suppliedPassword, ...fields } = input
    const conflicts = await employees.find({ $or: [{ employeeId: fields.employeeId }, { email: fields.email }] }, { session }).limit(2).toArray()
    if (conflicts.length) {
      const fieldErrors: Record<string, string[]> = {}
      if (conflicts.some(conflict => conflict.employeeId === fields.employeeId)) fieldErrors.employeeId = ["This Employee ID already belongs to a staff member."]
      if (conflicts.some(conflict => conflict.email === fields.email)) fieldErrors.email = ["This login email already belongs to a staff member."]
      throw new EmployeeError("A staff member already uses these details.", 409, { code: "DUPLICATE_STAFF", fieldErrors,
        action: "Find the existing staff member and edit their access, or enter a different Employee ID/login email for the new staff member." })
    }
    const existing = await users.findOne({ email: fields.email }, { session })
    if (existing && (existing.role !== "user" || existing.employeeId)) {
      throw new EmployeeError(existing.role !== "user" ? "This email belongs to a privileged account, such as an administrator or vendor." : "This email is already linked to another staff account.", 409,
        { code: "STAFF_ACCOUNT_CONFLICT", fieldErrors: { email: ["This account cannot be linked to a new staff record."] },
          action: "Use a different login email. If this person is already staff, edit their existing staff record instead." })
    }
    const now = new Date().toISOString()
    const employee = { ...fields, ...accessFields(fields), createdAt: now, updatedAt: now }
    let userId: ObjectId
    if (existing) {
      const synced = await users.updateOne({ _id: existing._id, role: "user", employeeId: { $exists: false } },
        { $set: { name: fields.name, employeeId: fields.employeeId, ...accessFields(fields), status: fields.status, updatedAt: now },
          $inc: { sessionVersion: 1 } }, { session })
      if (synced.matchedCount !== 1) throw new EmployeeError("The existing login account changed while this staff member was being created.", 409,
        { code: "STAFF_ACCOUNT_CHANGED", action: "Reload the staff list and check this email before retrying. If the login is already linked to staff, edit that staff record." })
      userId = existing._id
      await revokeEmployeeSessions(String(userId), session)
    } else {
      const created = await users.insertOne({
        email: fields.email, password: hash, name: fields.name, role: "user",
        employeeId: fields.employeeId, ...accessFields(fields), status: fields.status,
        createdAt: now, updatedAt: now,
      }, { session })
      if (!created.acknowledged) throw new Error("Employee login insertion was not acknowledged")
      userId = created.insertedId
    }
    const created = await employees.insertOne({ ...employee, userId: String(userId) }, { session })
    if (!created.acknowledged) throw new Error("Employee insertion was not acknowledged")
    return {
      success: true, employeeId: String(created.insertedId), userId: String(userId),
      ...(!existing && !suppliedPassword ? { temporaryPassword: password } : {}),
    }
  })
}

export async function updateEmployee(id: string, fields: z.infer<typeof UpdateEmployeeSchema>) {
  return employeeTransaction(async session => {
    const employees = await getCollection<EmployeeDocument>("employees")
    const users = await getCollection<EmployeeUser>("users")
    const employee = await employees.findOne({ _id: new ObjectId(id) }, { session })
    if (!employee) throw new EmployeeError("Employee not found", 404)
    const user = await linkedUser(employee, session)
    if (!user) throw new EmployeeError("Employee login is missing; reconcile it before editing access", 409)
    const collision = await users.findOne({ email: fields.email, _id: { $ne: user._id } }, { session })
    if (collision) throw new EmployeeError("This email belongs to another account", 409)
    const now = new Date().toISOString()
    const changes = { ...fields, ...accessFields(fields), updatedAt: now }
    const saved = await employees.updateOne({ _id: employee._id, updatedAt: employee.updatedAt },
      { $set: { ...changes, userId: String(user._id) } }, { session })
    if (saved.matchedCount !== 1) throw new EmployeeError("Employee changed; reload and try again", 409)
    const synced = await users.updateOne({ _id: user._id, role: "user" },
      { $set: { ...changes, role: "user" }, $inc: { sessionVersion: 1 } }, { session })
    if (synced.matchedCount !== 1) throw new EmployeeError("Linked account changed; reload and try again", 409)
    await revokeEmployeeSessions(String(user._id), session)
    return { success: true }
  })
}

export async function deleteEmployee(id: string) {
  return employeeTransaction(async session => {
    const employees = await getCollection<EmployeeDocument>("employees")
    const users = await getCollection<EmployeeUser>("users")
    const employee = await employees.findOne({ _id: new ObjectId(id) }, { session })
    if (!employee) throw new EmployeeError("Employee not found", 404)
    const user = await linkedUser(employee, session)
    if (user) {
      const disabled = await users.updateOne({ _id: user._id, role: "user" }, {
        $set: { status: "inactive", dashboardAccess: false, allowedPages: [], storeAccess: "none", storeIds: [], updatedAt: new Date().toISOString() },
        $unset: { employeeId: "" }, $inc: { sessionVersion: 1 },
      }, { session })
      if (disabled.matchedCount !== 1) throw new EmployeeError("Linked account changed; reload and try again", 409)
      await revokeEmployeeSessions(String(user._id), session)
    }
    const deleted = await employees.deleteOne({ _id: employee._id, updatedAt: employee.updatedAt }, { session })
    if (deleted.deletedCount !== 1) throw new EmployeeError("Employee changed; reload and try again", 409)
    return { success: true }
  })
}
