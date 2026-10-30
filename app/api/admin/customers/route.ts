import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { Document } from "mongodb"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { AdminPeopleResponseSchema } from "@/lib/admin-people"

const QuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
  access: z.enum(["all", "staff", "dashboard", "store", "privileged", "users"]).default("all"),
  sort: z.enum(["name", "email", "role", "createdAt", "orders", "totalSpent"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000000).default(0),
})
const stringValue = (input: unknown): Document => ({ $convert: { input, to: "string", onError: "", onNull: "" } })
const emailValue = (input: unknown): Document => ({ $toLower: { $trim: { input: stringValue(input) } } })
const addressValue: Document = { $cond: [{ $eq: [{ $type: "$address" }, "object"] }, { $trim: { input: { $concat: [
  stringValue({ $ifNull: ["$address.street", "$address.line1"] }), " ", stringValue("$address.city"), " ", stringValue("$address.state"), " ", stringValue({ $ifNull: ["$address.zip", "$address.zipCode"] }), " ", stringValue("$address.country"),
] } } }, stringValue("$address")] }
const strings = (input: string): Document => ({ $filter: { input: { $cond: [{ $isArray: input }, input, []] }, as: "value", cond: { $eq: [{ $type: "$$value" }, "string"] } } })

// An explicit employee userId takes precedence. Legacy profiles without a link
// can match by their non-empty email or Employee ID. This is display-only;
// effective login permissions always come from the users document.
const employeeMatchesAccount = (employee: string, accountId: unknown, accountEmail: unknown, accountEmployeeId: unknown): Document => ({
  $cond: [
    { $ne: [stringValue(`${employee}userId`), ""] },
    { $eq: [stringValue(`${employee}userId`), accountId] },
    { $or: [
      { $and: [{ $ne: [emailValue(`${employee}email`), ""] }, { $eq: [emailValue(`${employee}email`), accountEmail] }] },
      { $and: [{ $ne: [stringValue(`${employee}employeeId`), ""] }, { $eq: [stringValue(`${employee}employeeId`), accountEmployeeId] }] },
    ] },
  ],
})
const staffProjection: Document = { _id: 0, id: stringValue("$_id"), employeeId: stringValue("$employeeId"), name: stringValue("$name"), email: stringValue("$email"), department: stringValue("$department"), role: stringValue("$role") }

export async function GET(request: NextRequest) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid directory filters" }, { status: 400 })
  try {
    const { search, access, sort, direction, limit, offset } = parsed.data
    const users = await getCollection("users")
    const fullAdmin = { $in: ["$role", ["admin", "superadmin"]] }
    const permissionProjection: Document = {
      role: { $ifNull: ["$role", "user"] }, status: { $ifNull: ["$status", "active"] },
      dashboardAccess: { $or: [fullAdmin, { $eq: ["$dashboardAccess", true] }] },
      allowedPages: strings("$allowedPages"),
      storeAccess: { $cond: [fullAdmin, "all", { $cond: [{ $in: ["$storeAccess", ["selected", "all"]] }, "$storeAccess", "none"] }] },
      storeIds: strings("$storeIds"),
    }
    const pipeline: Document[] = [
      // Allowlist fields before joins; passwords and tokens never enter results.
      { $project: { name: 1, email: 1, employeeId: 1, role: 1, status: 1, phone: 1, address: 1, createdAt: 1, dashboardAccess: 1, allowedPages: 1, storeAccess: 1, storeIds: 1 } },
      { $lookup: { from: "employees", let: { accountId: stringValue("$_id"), accountEmail: emailValue("$email"), accountEmployeeId: stringValue("$employeeId") }, pipeline: [
        { $match: { $expr: employeeMatchesAccount("$", "$$accountId", "$$accountEmail", "$$accountEmployeeId") } }, { $project: staffProjection },
      ], as: "staffProfiles" } },
      { $project: { _id: 0, id: stringValue("$_id"), userId: stringValue("$_id"), name: stringValue("$name"), email: stringValue("$email"), phone: stringValue("$phone"), address: addressValue, createdAt: stringValue("$createdAt"), staffProfiles: 1, ...permissionProjection } },
      { $unionWith: { coll: "employees", pipeline: [
        { $lookup: { from: "users", let: { staffUserId: stringValue("$userId"), staffEmail: emailValue("$email"), staffEmployeeId: stringValue("$employeeId") }, pipeline: [
          { $match: { $expr: { $cond: [ { $ne: ["$$staffUserId", ""] }, { $eq: [stringValue("$_id"), "$$staffUserId"] }, { $or: [
            { $and: [{ $ne: ["$$staffEmail", ""] }, { $eq: [emailValue("$email"), "$$staffEmail"] }] },
            { $and: [{ $ne: ["$$staffEmployeeId", ""] }, { $eq: [stringValue("$employeeId"), "$$staffEmployeeId"] }] },
          ] } ] } } }, { $limit: 1 }, { $project: { _id: 1 } },
        ], as: "linkedAccounts" } },
        { $match: { "linkedAccounts.0": { $exists: false } } },
        { $project: { _id: 0, id: { $concat: ["staff:", stringValue("$_id")] }, userId: { $literal: null }, name: stringValue("$name"), email: stringValue("$email"), phone: stringValue("$phone"), address: addressValue, createdAt: stringValue("$createdAt"),
          role: { $literal: "staff" }, status: { $ifNull: ["$status", "active"] }, dashboardAccess: { $eq: ["$dashboardAccess", true] }, allowedPages: strings("$allowedPages"),
          storeAccess: { $cond: [{ $in: ["$storeAccess", ["selected", "all"]] }, "$storeAccess", "none"] }, storeIds: strings("$storeIds"),
          staffProfiles: [{ id: stringValue("$_id"), employeeId: stringValue("$employeeId"), name: stringValue("$name"), email: stringValue("$email"), department: stringValue("$department"), role: stringValue("$role") }],
        } },
      ] } },
    ]
    const filters: Document[] = []
    if (search) {
      const literal = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      filters.push({ $or: ["name", "email", "phone", "role", "staffProfiles.name", "staffProfiles.email", "staffProfiles.employeeId", "staffProfiles.department"].map(field => ({ [field]: { $regex: literal, $options: "i" } })) })
    }
    if (access === "staff") filters.push({ "staffProfiles.0": { $exists: true } })
    if (access === "dashboard") filters.push({ dashboardAccess: true })
    if (access === "store") filters.push({ storeAccess: { $in: ["selected", "all"] } })
    if (access === "privileged") filters.push({ role: { $in: ["admin", "superadmin", "vendor"] } })
    if (access === "users") filters.push({ userId: { $ne: null }, role: "user", "staffProfiles.0": { $exists: false } })
    if (filters.length) pipeline.push({ $match: { $and: filters } })
    const statistics: Document[] = [
      { $lookup: { from: "orders", let: { accountId: "$userId" }, pipeline: [
        { $match: { $expr: { $and: [{ $ne: ["$$accountId", null] }, { $eq: ["$userId", "$$accountId"] }] } } },
        { $group: { _id: null, orders: { $sum: 1 }, totalSpent: { $sum: { $convert: { input: "$total", to: "double", onError: 0, onNull: 0 } } } } },
      ], as: "statistics" } },
      { $set: { orders: { $ifNull: [{ $first: "$statistics.orders" }, 0] }, totalSpent: { $max: [0, { $ifNull: [{ $first: "$statistics.totalSpent" }, 0] }] } } },
      { $unset: "statistics" },
    ]
    const sorting: Document = { $sort: { [sort]: direction === "asc" ? 1 : -1, id: 1 } }
    const moneySort = sort === "orders" || sort === "totalSpent"
    pipeline.push({ $facet: { count: [{ $count: "total" }], items: moneySort ? [...statistics, sorting, { $skip: offset }, { $limit: limit }] : [sorting, { $skip: offset }, { $limit: limit }, ...statistics] } })
    const [result] = await users.aggregate(pipeline, { collation: { locale: "en", strength: 2 }, maxTimeMS: 30000 }).toArray()
    return NextResponse.json(AdminPeopleResponseSchema.parse({ items: result?.items || [], total: result?.count?.[0]?.total || 0 }), { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Could not load the people and access directory") }
}
