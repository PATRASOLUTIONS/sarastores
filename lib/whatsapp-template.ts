import { z } from "zod"
import type { WhatsAppPayload } from "@/lib/marketing/whatsapp"

const whatsappAcceptanceSchema = z.object({
  messaging_product: z.literal("whatsapp").default("whatsapp"),
  messages: z.array(z.object({
    id: z.string().min(1),
    message_status: z.enum(["accepted", "sent", "delivered", "read", "held_for_quality_assessment"]).optional(),
  })).min(1),
})

export type WhatsAppNotificationResult =
  | { success: true; data: z.infer<typeof whatsappAcceptanceSchema> }
  | { success: false; error: string; deliveryUnknown?: true }

function providerRejected(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.error != null || record.success === false || record.status === false || record.status === "error" || record.status === "failed"
    || Array.isArray(record.messages) && record.messages.some(message => message && typeof message === "object" && message.message_status === "failed")
}

/** Sends one pre-approved AskEva template to a 10-digit Indian mobile number. */
export async function sendWhatsAppTemplate(
  phone: string,
  template: WhatsAppPayload["template"],
  senderOverride?: string,
  label = "WhatsApp",
): Promise<WhatsAppNotificationResult> {
  const apiKey = process.env.ASKEVA_API_KEY
  const apiUrl = process.env.ASKEVA_API_URL
  if (!apiKey || !apiUrl) {
    console.error(`[${label}] Provider is not configured`)
    return { success: false, error: "WhatsApp notifications are not configured" }
  }
  if (!/^\d{10}$/.test(phone)) {
    console.error(`[${label}] Invalid phone format`)
    return { success: false, error: "Invalid phone format" }
  }
  const payload: WhatsAppPayload = {
    to: `91${phone}`,
    type: "template",
    sender: senderOverride || process.env.ASKEVA_SENDER_NUMBER,
    template,
  }
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    const acknowledgement: unknown = await response.json().catch(() => null)
    const record = acknowledgement && typeof acknowledgement === "object" ? acknowledgement as Record<string, unknown> : undefined
    const direct = whatsappAcceptanceSchema.safeParse(acknowledgement)
    const parsed = direct.success ? direct : whatsappAcceptanceSchema.safeParse(record?.data)
    const explicitRejection = providerRejected(acknowledgement) || providerRejected(record?.data)
    if (!response.ok || !parsed.success || explicitRejection) {
      console.error(`[${label}] Provider acknowledgement was not confirmed`, { status: response.status })
      const deliveryUnknown = response.status >= 500 || response.ok && !explicitRejection
      return { success: false, error: "WhatsApp provider did not accept the message", ...(deliveryUnknown ? { deliveryUnknown: true as const } : {}) }
    }
    return { success: true, data: parsed.data }
  } catch {
    console.error(`[${label}] Request failed`)
    return { success: false, error: "WhatsApp request failed", deliveryUnknown: true }
  }
}
