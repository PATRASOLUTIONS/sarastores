import { z } from "zod"
import type { Document, Filter } from "mongodb"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, "Invalid lead date")

export const LeadQuerySchema = z.object({
  status: z.string().max(100).optional(),
  category: z.string().max(200).optional(),
  source: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  startDate: day.optional(),
  endDate: day.optional(),
  sort: z.enum(["latest", "oldest"]).default("latest"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(10),
}).refine(value => !value.startDate || !value.endDate || value.startDate <= value.endDate, "Invalid lead date range")

export function buildLeadFilter(query: z.infer<typeof LeadQuerySchema>): Filter<Document> {
  const filter: Filter<Document> = {}
  for (const key of ["status", "category", "source"] as const) {
    if (query[key] && query[key] !== "all") filter[key] = query[key]
  }
  if (query.search) {
    const literal = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = ["name", "phone", "email"].map(key => ({ [key]: { $regex: literal, $options: "i" } }))
  }
  if (query.startDate || query.endDate) {
    filter.createdAt = {
      ...(query.startDate ? { $gte: new Date(`${query.startDate}T00:00:00Z`) } : {}),
      ...(query.endDate ? { $lte: new Date(`${query.endDate}T23:59:59.999Z`) } : {}),
    }
  }
  return filter
}
