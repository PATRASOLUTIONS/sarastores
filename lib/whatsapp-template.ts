import { z } from "zod"
import type { WhatsAppPayload } from "@/lib/marketing/whatsapp"

const whatsappAcceptanceSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  messages: z.array(z.object({
    id: z.string().min(1),
    message_status: z.enum(["accepted", "sent"]).optional(),
  })).min(1),
})

export type WhatsAppNotificationResult =
  | { success: true; data: z.infer<typeof whatsappAcceptanceSchema> }
  | { success: false; error: string }

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
    const parsed = whatsappAcceptanceSchema.safeParse(await response.json().catch(() => null))
    if (!response.ok || !parsed.success) {
      console.error(`[${label}] Provider did not accept the message`, { status: response.status })
      return { success: false, error: "WhatsApp provider did not accept the message" }
    }
    return { success: true, data: parsed.data }
  } catch {
    console.error(`[${label}] Request failed`)
    return { success: false, error: "WhatsApp request failed" }
  }
}
