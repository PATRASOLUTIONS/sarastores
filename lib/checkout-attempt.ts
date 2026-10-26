import { z } from "zod"

const AttemptSchema = z.object({
  key: z.string().uuid(), provider: z.string(), body: z.record(z.unknown()),
  orderData: z.record(z.unknown()), resolved: z.boolean().optional(),
})
export type CheckoutAttempt = z.infer<typeof AttemptSchema>
const storageKey = (owner: string) => `sara_checkout_attempt:${owner}`

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",") + "}"
  return JSON.stringify(value)
}

export function clearCheckoutAttempt(owner: string) {
  try { window.localStorage.removeItem(storageKey(owner)) } catch { /* A completed purchase must still finish. */ }
}

export function resolveCheckoutAttempt(owner: string) {
  const raw = window.localStorage.getItem(storageKey(owner))
  if (raw) window.localStorage.setItem(storageKey(owner), JSON.stringify({ ...AttemptSchema.parse(JSON.parse(raw)), resolved: true }))
}

export async function prepareCheckoutAttempt(owner: string, provider: string, body: Record<string, unknown>, orderData: Record<string, unknown>): Promise<CheckoutAttempt> {
  body = JSON.parse(JSON.stringify(body))
  const prepare = () => {
    const raw = window.localStorage.getItem(storageKey(owner))
    if (raw) {
      const old = AttemptSchema.parse(JSON.parse(raw))
      if (old.provider === provider && stable(old.body) === stable(body)) return old
      if (!old.resolved) throw new Error("Your earlier payment setup needs confirmation. Restore its cart and payment option before retrying; contact support if it timed out.")
    }
    const attempt: CheckoutAttempt = { key: crypto.randomUUID(), provider, body: JSON.parse(JSON.stringify(body)), orderData: JSON.parse(JSON.stringify(orderData)) }
    // Shared storage is required so another tab sees the same attempt. Fail closed
    // before the API call when persistence is unavailable.
    window.localStorage.setItem(storageKey(owner), JSON.stringify(attempt))
    return attempt
  }
  // Serialize the initial read/write across tabs where Web Locks are supported.
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(storageKey(owner), prepare)
  return prepare()
}
