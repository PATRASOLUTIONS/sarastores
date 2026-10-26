import { z } from "zod"
import { apiFetch } from "@/lib/api-client"
import { scraperItemNumberKey } from "./bulk-import"

const responseSchema = z.object({ success: z.literal(true), existingItemNumbers: z.array(z.string()) })
export async function checkScraperItemNumbers(itemnos: string[], signal?: AbortSignal): Promise<Set<string>> {
  const response = await apiFetch("/api/scrape/check-items", { method: "POST", json: { itemnos }, signal: signal || AbortSignal.timeout(15000) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || "Could not check existing item numbers. Please retry.")
  return new Set(responseSchema.parse(body).existingItemNumbers.map(scraperItemNumberKey))
}
