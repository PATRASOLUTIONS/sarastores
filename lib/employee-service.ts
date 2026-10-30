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
const validAccess = (value: Pick<z.infer<typeof employeeFields>, "dashboardAccess" | "allowedPages" | "storeAccess" | "storeIds">, ctx: z.RefinementCtx) => {
  if (value.dashboardAccess && !value.allowedPages.length) ctx.addIssue({ code: "custom", path: ["allowedPages"], message: "Select at least one dashboard page, or turn off dashboard access." })
  if (value.storeAccess === "selected" && !value.storeIds.length) ctx.addIssue({ code: "custom", path: ["storeIds"], message: "Select at least one store, or change store access to No stores or All stores." })
}
export const CreateEmployeeSchema = employeeFields.extend({ employeeId: employeeFields.shape.employeeId.optional(), password: passwordSchema.optional() }).strict()
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

async function prepareEmployeeCreationIndexes() {
  const employees = await getCollection<EmployeeDocument>("employees")
  try {
    await employees.createIndex({ employeeId: 1 }, { unique: true, name: "employee_id_unique" })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new EmployeeError(
      "Existing staff records contain duplicate Employee IDs, so ID uniqueness could not be prepared.", 409,
      { code: "EXISTING_STAFF_DUPLICATES", action: "Ask the system administrator to reconcile the duplicate Employee IDs before retrying." })
    throw error
  }
}

async function employeeTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  // Login emails must remain unique even when legacy staff profiles share an
  // email. Do not rebuild the staff-email index as a prerequisite to editing
  // or deleting one profile.
  const users = await getCollection<EmployeeUser>("users")
  try {
    await users.createIndex({ email: 1 }, { unique: true, name: "email_unique" })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new EmployeeError(
      "Existing login accounts contain duplicate emails, so account uniqueness could not be prepared.", 409,
      { code: "EXISTING_STAFF_DUPLICATES", action: "Ask the system administrator to reconcile the duplicate login accounts before retrying." })
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
  if (matches.length > 1) throw new EmployeeError("This staff record matches more than one login account.", 409,
    { code: "STAFF_LOGIN_AMBIGUOUS", action: "Ask the system administrator to link this staff record to the correct login account, then retry." })
  if (matches.some(user => user.role !== "user")) throw new EmployeeError("This staff record is linked to an administrator, superadmin or vendor login.", 409,
    { code: "STAFF_LOGIN_PRIVILEGED", action: "Reconcile the staff profile and privileged login before changing or removing it. Staff management cannot downgrade or disable a privileged account." })
  if (matches.some(user => user.employeeId && user.employeeId !== employee.employeeId)) throw new EmployeeError("The linked login belongs to a different Employee ID.", 409,
    { code: "STAFF_LOGIN_MISMATCH", action: "Ask the system administrator to correct the staff-to-login link before retrying, so another staff member's access is not changed." })
  return matches[0] ?? null
}

async function revokeEmployeeSessions(userId: string, session: ClientSession) {
  const tokens = await getCollection("refresh_tokens")
  const result = await tokens.updateMany({ userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: "employee_access_changed" } }, { session })
  if (!result.acknowledged) throw new Error("Employee refresh-token revocation was not acknowledged")
}

export async function createEmployee(input: z.infer<typeof CreateEmployeeSchema>) {
  await prepareEmployeeCreationIndexes()
  // Older spreadsheet clients may supply an ID. Add Staff leaves it out and
  // receives a server-generated code protected by the unique employee-ID index.
  const employeeCode = input.employeeId || `SM${randomBytes(8).toString("hex").toUpperCase()}`
  const password = input.password || randomBytes(24).toString("base64url")
  const hash = await bcrypt.hash(password, 12)
  return employeeTransaction(async session => {
    const employees = await getCollection<EmployeeDocument>("employees")
    const users = await getCollection<EmployeeUser>("users")
    const { password: suppliedPassword, ...suppliedFields } = input
    const fields = { ...suppliedFields, employeeId: employeeCode }
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
      success: true, employeeId: String(created.insertedId), employeeCode, userId: String(userId),
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
    const changedIdentity: Array<{ employeeId: string } | { email: string }> = []
    if (fields.employeeId !== employee.employeeId) changedIdentity.push({ employeeId: fields.employeeId })
    if (fields.email !== employee.email) changedIdentity.push({ email: fields.email })
    if (changedIdentity.length) {
      const conflicts = await employees.find({ _id: { $ne: employee._id }, $or: changedIdentity }, { session }).limit(2).toArray()
      const fieldErrors: Record<string, string[]> = {}
      if (fields.employeeId !== employee.employeeId && conflicts.some(record => record.employeeId === fields.employeeId)) fieldErrors.employeeId = ["This Employee ID already belongs to another staff member."]
      if (fields.email !== employee.email && conflicts.some(record => record.email === fields.email)) fieldErrors.email = ["This login email already belongs to another staff member."]
      if (Object.keys(fieldErrors).length) throw new EmployeeError("The new staff identity conflicts with another staff record.", 409,
        { code: "DUPLICATE_STAFF", fieldErrors, action: "Use a different Employee ID or login email, or keep this staff member's current details." })
    }
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
