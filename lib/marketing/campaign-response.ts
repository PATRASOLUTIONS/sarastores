import { z } from "zod"

export const savedEmailTemplateSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  name: z.string().default(""),
  subject: z.string().default(""),
  html: z.string().default(""),
  image: z.string().default(""),
}).refine(template => Boolean(template.id || template._id || template.name), "Template identity is missing")

export const campaignRecipientResponseSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().nullish(),
  fullName: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  mobile: z.string().nullish(),
  totalOrders: z.number().nullish(),
  totalSpent: z.number().nullish(),
  source: z.string().nullish(),
  segments: z.array(z.string()).nullish(),
  tier: z.string().nullish(),
  lifecycle: z.string().nullish(),
}).refine(recipient => Boolean(recipient.id || recipient._id || recipient.userId), "Recipient identity is missing")

export const campaignRecipientListResponseSchema = z.union([
  z.array(campaignRecipientResponseSchema),
  z.object({ items: z.array(campaignRecipientResponseSchema) }),
])

export const campaignLibraryResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    segments: z.array(z.string()),
    occasion: z.string().nullable(),
    subject: z.string(),
    preheader: z.string(),
    recommended: z.boolean(),
    html: z.string().optional(),
    whatsapp: z.object({
      templateName: z.string(),
      bodyParams: z.array(z.string()),
      preview: z.string(),
    }),
  })),
})

const count = z.number().int().nonnegative()
export const whatsappPreviewResponseSchema = z.object({
  mode: z.literal("dry-run"),
  whatsappTemplateName: z.string(),
  totalAudience: count,
  plannedTotal: count,
  skipped: z.array(z.object({ recipientId: z.string(), name: z.string(), reason: z.string() })),
  planned: z.array(z.object({ renderedPreview: z.string(), payload: z.record(z.unknown()) })),
  batches: z.object({ count, size: count, estimatedMinutes: z.number().nonnegative() }),
  warnings: z.array(z.string()),
})
export type WhatsAppPreview = z.infer<typeof whatsappPreviewResponseSchema>

export const campaignProgressEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), totalRecipients: count, totalBatches: count, batchSize: count }),
  z.object({ type: z.literal("batch_start"), batch: count, totalBatches: count, emailsInBatch: count, sentSoFar: count, failedSoFar: count }),
  z.object({ type: z.literal("batch_complete"), batch: count, totalBatches: count, sent: count, failed: count, processed: count, totalRecipients: count }),
  z.object({ type: z.literal("batch_delay"), batch: count, totalBatches: count, delaySeconds: count, nextBatch: count }),
  z.object({ type: z.literal("complete"), sent: count, failed: count, totalRecipients: count }),
])
export type CampaignProgressEvent = z.infer<typeof campaignProgressEventSchema>

export async function* readCampaignProgress(body: ReadableStream<Uint8Array> | null): AsyncGenerator<CampaignProgressEvent> {
  if (!body) throw new Error("Campaign response has no progress stream")
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let complete = false
  let totalRecipients: number | undefined
  let completion: Extract<CampaignProgressEvent, { type: "complete" }> | undefined
  function parse(line: string): CampaignProgressEvent {
    if (complete) throw new Error("Campaign progress continued after completion")
    const event = campaignProgressEventSchema.parse(JSON.parse(line))
    if (event.type === "start") {
      if (totalRecipients !== undefined) throw new Error("Campaign progress started more than once")
      totalRecipients = event.totalRecipients
    } else if (totalRecipients === undefined) {
      throw new Error("Campaign progress has no start event")
    }
    if (event.type === "complete" &&
      (event.totalRecipients !== totalRecipients || event.sent + event.failed !== totalRecipients)) {
      throw new Error("Campaign completion counts do not match the audience")
    }
    if (event.type === "complete") complete = true
    return event
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        if (!line.trim()) continue
        const event = parse(line)
        if (event.type === "complete") completion = event
        else yield event
      }
    }
    if (buffer.trim()) {
      const event = parse(buffer)
      if (event.type === "complete") completion = event
      else yield event
    }
    if (!completion) throw new Error("Campaign progress ended before completion; check history before retrying")
    yield completion
  } finally {
    reader.releaseLock()
  }
}
