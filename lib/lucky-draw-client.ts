import { z } from "zod"

const count = z.number().int().nonnegative()
const prizeSchema = z.object({ name: z.string(), icon: z.string(), quantity: count })
export const drawStateSchema = z.object({
  success: z.literal(true),
  campaign: z.object({
    name: z.string(), store: z.string(), status: z.enum(["draft", "active", "paused", "completed"]),
    prizes: z.array(prizeSchema),
  }),
  stats: z.object({ totalParticipants: count, remainingParticipants: count, prizesLeft: count }),
  shuffleNames: z.array(z.string()),
  winners: z.array(z.object({ name: z.string(), phone: z.string(), prize: z.string(), prizeIcon: z.string(), drawnAt: z.string() })),
})
export const drawResultSchema = z.object({
  success: z.literal(true),
  winnerId: z.string().regex(/^[a-f0-9]{24}$/),
  winner: z.object({ name: z.string(), phone: z.string(), email: z.string() }),
  prize: z.object({ name: z.string(), icon: z.string() }),
  stats: z.object({ remainingParticipants: count, prizesLeft: count }),
})
export const drawNotificationSchema = z.object({
  success: z.literal(true), emailSent: z.boolean(), emailError: z.string().nullable(),
}).refine(value => value.emailSent ? value.emailError === null : !!value.emailError, "Inconsistent notification acknowledgement")

export type DrawState = z.infer<typeof drawStateSchema>
export type DrawResult = z.infer<typeof drawResultSchema>

export const drawStoreListSchema = z.object({
  success: z.literal(true),
  stores: z.array(z.object({ id: z.string().min(1), shopName: z.string(), isActive: z.boolean().optional() })),
}).transform(value => value.stores.filter(store => store.isActive !== false))

export function winnerNotificationLabel(winner: {
  emailSent?: boolean
  emailDeliveryStatus?: "sending" | "sent" | "failed" | "uncertain"
  emailError?: string | null
}): string {
  if (winner.emailSent) return "email accepted"
  if (winner.emailDeliveryStatus === "sending") return "pending reconciliation"
  if (winner.emailDeliveryStatus === "uncertain") return "needs reconciliation"
  if (winner.emailError) return "email not accepted"
  return "not notified"
}

export async function requestDrawJson<T>(
  url: string, parse: (value: unknown) => T, body?: unknown, method = "POST",
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      method, signal: controller.signal, cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: unknown = await response.json()
    if (!response.ok) {
      const error = z.object({ error: z.string().min(1) }).safeParse(data)
      return { ok: false, error: error.success ? error.data.error : "Draw request failed" }
    }
    return { ok: true, data: parse(data) }
  } catch (error) {
    console.error("[lucky-draw] request failed", error)
    return { ok: false, error: error instanceof Error && error.name === "AbortError"
      ? "The request timed out. Retry the same draw to retrieve its recorded result."
      : "The draw response could not be confirmed. Please retry." }
  } finally {
    clearTimeout(timer)
  }
}
