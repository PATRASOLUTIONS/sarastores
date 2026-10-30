import { ObjectId, type Document } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import { EmployeeListResponseSchema } from "@/lib/validation"

const text = (value: unknown) => typeof value === "string" ? value : value instanceof ObjectId ? value.toHexString() : ""
const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
const dateText = (value: unknown) => value instanceof Date ? value.toISOString() : text(value)
const key = (value: unknown) => text(value).trim().toLowerCase()

/** Staff profiles plus every dashboard/store login, without creating records. */
export async function getEmployeeAccessDirectory() {
  const employees = await getCollection("employees")
  const users = await getCollection("users")
  const staff = await employees.find({}, { projection: { employeeId: 1, userId: 1, name: 1, email: 1, department: 1, role: 1, status: 1, dashboardAccess: 1, allowedPages: 1, storeAccess: 1, storeIds: 1, createdAt: 1, updatedAt: 1 } }).toArray()
  const accessQuery = { $or: [{ dashboardAccess: true }, { role: { $in: ["admin", "superadmin"] } }, { storeAccess: { $in: ["selected", "all"] } }] }
  const ids = staff.map(employee => text(employee.userId)).filter(ObjectId.isValid).map(id => new ObjectId(id))
  const emails = staff.map(employee => text(employee.email).trim()).filter(Boolean)
  const employeeIds = staff.map(employee => text(employee.employeeId)).filter(Boolean)
  const accounts = await users.find({ $or: [accessQuery, { _id: { $in: ids } }, { email: { $in: emails } }, { employeeId: { $in: employeeIds } }] }, {
    projection: { name: 1, email: 1, employeeId: 1, role: 1, status: 1, dashboardAccess: 1, allowedPages: 1, storeAccess: 1, storeIds: 1, createdAt: 1, updatedAt: 1 },
    collation: { locale: "en", strength: 2 },
  }).toArray()
  const byId = new Map(accounts.map(account => [String(account._id), account]))
  const used = new Set<string>()
  const permissions = (account: Document) => {
    const fullAdmin = account.role === "admin" || account.role === "superadmin"
    return {
      accountId: String(account._id), accountEmail: text(account.email), linkedAccountRole: text(account.role) || "user",
      dashboardAccess: fullAdmin || account.dashboardAccess === true,
      allowedPages: stringList(account.allowedPages),
      storeAccess: fullAdmin ? "all" : account.storeAccess === "all" || account.storeAccess === "selected" ? account.storeAccess : "none",
      storeIds: stringList(account.storeIds),
      status: account.status === "inactive" || account.status === "deleted" ? "inactive" : "active",
    }
  }
  const rows: Document[] = staff.map(employee => {
    const explicit = text(employee.userId)
    const linked = explicit ? byId.get(explicit) : undefined
    const matches = explicit ? linked ? [linked] : [] : accounts.filter(account =>
      (key(employee.email) && key(employee.email) === key(account.email)) ||
      (text(employee.employeeId) && text(employee.employeeId) === text(account.employeeId)))
    const account = matches.length === 1 ? matches[0] : null
    if (account) used.add(String(account._id))
    return { ...normalizeId(employee), source: "employee", ...(account ? permissions(account) : {}) }
  })
  for (const account of accounts) {
    const granted = account.dashboardAccess === true || account.role === "admin" || account.role === "superadmin" || account.storeAccess === "all" || account.storeAccess === "selected"
    if (!granted || used.has(String(account._id))) continue
    rows.push({
      id: `account:${String(account._id)}`, source: "account", employeeId: text(account.employeeId),
      name: text(account.name) || text(account.email) || "Dashboard account", email: text(account.email),
      department: account.dashboardAccess === true || account.role === "admin" || account.role === "superadmin" ? "Dashboard account" : "Store account",
      role: text(account.role) || "user", ...permissions(account),
      createdAt: dateText(account.createdAt), updatedAt: dateText(account.updatedAt),
    })
  }
  return EmployeeListResponseSchema.parse(rows.sort((a, b) => text(a.name).localeCompare(text(b.name)) || text(a.email).localeCompare(text(b.email))))
}
