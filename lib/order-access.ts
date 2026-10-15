import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import type { AuthSession } from "@/lib/auth"
import { staffCanAccessApi } from "@/lib/admin-access"

export type OrderAdminScope =
  | { kind: "all"; filter: Record<string, unknown> }
  | { kind: "stores"; filter: Record<string, unknown>; storeIds: string[] }
  | { kind: "none"; filter: Record<string, unknown> }

export interface OrderAccessUser {
  _id: ObjectId | string
  email?: string
  role?: string
  status?: string
  dashboardAccess?: boolean
  allowedPages?: string[]
  storeAccess?: unknown
  storeIds?: unknown
}

export function orderScopeForUser(record: OrderAccessUser | null): OrderAdminScope {
  if (!record || record.status === "inactive" || record.status === "deleted" ||
    !staffCanAccessApi({ ...record, role: record.role || "user" }, "/api/orders")) {
    return { kind: "none", filter: { _id: null } }
  }
  if (record.role === "admin" || record.role === "superadmin" || record.storeAccess === "all") {
    return { kind: "all", filter: {} }
  }
  const storeIds = record.storeAccess === "selected" && Array.isArray(record.storeIds)
    ? record.storeIds.filter((id): id is string => typeof id === "string" && !!id)
    : []
  if (!storeIds.length) return { kind: "none", filter: { _id: null } }
  return { kind: "stores", storeIds, filter: { "fulfilment.storeId": { $in: storeIds } } }
}

export async function getOrderAdminScope(session: AuthSession | null): Promise<OrderAdminScope> {
  const user = session?.user
  if (!user || !staffCanAccessApi(user, "/api/orders")) {
    return { kind: "none", filter: { _id: null } }
  }
  if (user.role === "admin" || user.role === "superadmin") return { kind: "all", filter: {} }
  const users = await getCollection<OrderAccessUser>("users")
  const record = await users.findOne({ _id: ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id })
  return orderScopeForUser(record)
}

export function orderWithinAdminScope(scope: OrderAdminScope, order: object): boolean {
  if (scope.kind === "all") return true
  if (scope.kind === "none") return false
  const fulfilment = "fulfilment" in order ? order.fulfilment : undefined
  return !!fulfilment && typeof fulfilment === "object" && "storeId" in fulfilment &&
    typeof fulfilment.storeId === "string" && scope.storeIds.includes(fulfilment.storeId)
}
