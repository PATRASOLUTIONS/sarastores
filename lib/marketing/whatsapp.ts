/**
 * AskEva WhatsApp campaign client.
 *
 * WhatsApp does not allow free-form marketing messages: every campaign send must
 * use a template that Meta has pre-approved, referenced by name with ordered
 * positional parameters. So this module's job is to resolve a campaign into that
 * exact payload shape and validate it — the creative itself lives in AskEva.
 *
 * SAFETY: sending is off unless WHATSAPP_CAMPAIGNS_ENABLED === "true" AND the
 * caller passes `confirm: true`. Everything else returns the payloads that would
 * have been sent. A marketing blast is not reversible, so the default is dry-run.
 */

import type { CampaignTemplate } from "./campaigns"
import type { Recipient } from "./segments"

export type WhatsAppPayload = {
  to: string
  type: "template"
  sender?: string
  template: {
    language: { policy: "deterministic"; code: string }
    name: string
    components: Array<
      | { type: "body"; parameters: Array<{ type: "text"; text: string }> }
      | { type: "button"; sub_type: "url"; index: string; parameters: Array<{ type: "text"; text: string }> }
    >
  }
}

export type PlannedMessage = {
  recipientId: string
  name: string
  phone: string
  /** E.164 without the +, as AskEva expects. */
  to: string
  payload: WhatsAppPayload
  renderedPreview: string
}

export type SkippedMessage = {
  recipientId: string
  name: string
  reason: "no_phone" | "invalid_phone" | "no_consent" | "duplicate"
}

export type CampaignPlan = {
  templateId: string
  whatsappTemplateName: string
  totalAudience: number
  planned: PlannedMessage[]
  skipped: SkippedMessage[]
  batches: { count: number; size: number; delayMs: number; estimatedMinutes: number }
  dryRun: boolean
  configured: boolean
  warnings: string[]
}

export const BATCH_SIZE = 40
export const BATCH_DELAY_MS = 20000

/**
 * Template names confirmed APPROVED on the AskEva account
 * (GET https://backend.askeva.io/v1/templates). Anything not listed here will be
 * rejected with `{"error":"Template is not valid"}` until it is approved.
 */
export const APPROVED_WA_TEMPLATES = new Set([
  "sara_super_sunday_week4",
  "the_epic_full_moon_day",
  "samsung_fold_8",
  "bellary_campaign_fullmoon",
  "ugadi_mysore_english",
  "ugadi_mysore_kannad",
  "vivo_pre_booking",
  "vivo_v50",
  "iphone16e_camp2_copy_copy",
  "coupon_v1",
  "coupon_v2_copy",
  "coupon_v2_copy_copy",
  "invoice_v1",
  "spin_win_auth",
  "spin_win_confirm",
  "test_nov06",
])

export function isTemplateApproved(name: string): boolean {
  return APPROVED_WA_TEMPLATES.has(name)
}

/**
 * Normalises an Indian mobile number to AskEva's `91XXXXXXXXXX` form.
 * Returns null when the number cannot be trusted — sending to a malformed number
 * burns template quality rating, which is scored per-template by Meta.
 */
export function normaliseIndianPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "")
  if (!digits) return null
  const local = digits.length > 10 ? digits.slice(-10) : digits
  if (local.length !== 10) return null
  if (!/^[6-9]/.test(local)) return null
  return `91${local}`
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}

/** Per-recipient variables available to both channels. */
export function variablesFor(r: Recipient): Record<string, string> {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there"
  return {
    name: firstName,
    fullName: r.name || firstName,
    email: r.email,
    tier: r.tier ?? "silver",
    segment: r.lifecycle ?? "",
    orders: String(r.totalOrders),
    spent: String(Math.round(r.totalSpent)),
  }
}

export function buildPayload(
  template: CampaignTemplate,
  recipient: Recipient,
  to: string,
): WhatsAppPayload {
  const vars = variablesFor(recipient)
  const components: WhatsAppPayload["template"]["components"] = [
    {
      type: "body",
      parameters: template.whatsapp.bodyParams.map((p) => ({ type: "text" as const, text: fill(p, vars) })),
    },
  ]

  if (template.whatsapp.buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: fill(template.whatsapp.buttonUrlParam, vars) }],
    })
  }

  const payload: WhatsAppPayload = {
    to,
    type: "template",
    template: {
      language: { policy: "deterministic", code: "en" },
      name: template.whatsapp.templateName,
      components,
    },
  }

  const sender = process.env.ASKEVA_SENDER_NUMBER
  if (sender) payload.sender = sender

  return payload
}

export function isConfigured(): boolean {
  return Boolean(process.env.ASKEVA_API_KEY && process.env.ASKEVA_API_URL)
}

export function sendingEnabled(): boolean {
  return process.env.WHATSAPP_CAMPAIGNS_ENABLED === "true"
}

/**
 * Resolves a campaign + audience into the exact messages that would be sent.
 * Consent is enforced here rather than at send time so the preview count is honest.
 */
export function planCampaign(
  template: CampaignTemplate,
  audience: Recipient[],
  opts: { requireConsent?: boolean } = {},
): CampaignPlan {
  const requireConsent = opts.requireConsent !== false
  const planned: PlannedMessage[] = []
  const skipped: SkippedMessage[] = []
  const seen = new Set<string>()

  for (const r of audience) {
    if (requireConsent && !r.consent.whatsapp) {
      skipped.push({ recipientId: r.id, name: r.name, reason: "no_consent" })
      continue
    }
    if (!r.phone) {
      skipped.push({ recipientId: r.id, name: r.name, reason: "no_phone" })
      continue
    }
    const to = normaliseIndianPhone(r.phone)
    if (!to) {
      skipped.push({ recipientId: r.id, name: r.name, reason: "invalid_phone" })
      continue
    }
    if (seen.has(to)) {
      skipped.push({ recipientId: r.id, name: r.name, reason: "duplicate" })
      continue
    }
    seen.add(to)

    planned.push({
      recipientId: r.id,
      name: r.name,
      phone: r.phone,
      to,
      payload: buildPayload(template, r, to),
      renderedPreview: fill(template.whatsapp.preview, variablesFor(r)),
    })
  }

  const batchCount = Math.ceil(planned.length / BATCH_SIZE)
  const warnings: string[] = []
  if (!isConfigured()) warnings.push("ASKEVA_API_KEY / ASKEVA_API_URL are not set — sending is impossible.")
  if (!sendingEnabled()) warnings.push("WHATSAPP_CAMPAIGNS_ENABLED is not 'true' — this is a dry run.")
  if (requireConsent && planned.length === 0 && audience.length > 0) {
    warnings.push("No recipient has WhatsApp consent. Collect opt-in before running this campaign.")
  }
  if (!isTemplateApproved(template.whatsapp.templateName)) {
    warnings.push(
      `Template "${template.whatsapp.templateName}" is NOT approved on this AskEva account — every send will fail with "Template is not valid". Create and approve it in AskEva first.`,
    )
  }

  return {
    templateId: template.id,
    whatsappTemplateName: template.whatsapp.templateName,
    totalAudience: audience.length,
    planned,
    skipped,
    batches: {
      count: batchCount,
      size: BATCH_SIZE,
      delayMs: BATCH_DELAY_MS,
      estimatedMinutes: Math.round(((Math.max(batchCount - 1, 0) * BATCH_DELAY_MS) / 60000) * 10) / 10,
    },
    dryRun: !sendingEnabled(),
    configured: isConfigured(),
    warnings,
  }
}

/**
 * Sends a single planned message. Guarded so it cannot fire during a dry run.
 * Kept separate from planCampaign so the execution path is trivially auditable.
 */
export async function sendPlannedMessage(
  message: PlannedMessage,
): Promise<{ ok: boolean; status?: number; response?: unknown; error?: string }> {
  if (!sendingEnabled()) return { ok: false, error: "WhatsApp campaign sending is disabled" }
  if (!isConfigured()) return { ok: false, error: "AskEva is not configured" }

  try {
    const res = await fetch(process.env.ASKEVA_API_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ASKEVA_API_KEY}`,
      },
      body: JSON.stringify(message.payload),
    })
    const text = await res.text()
    let response: unknown = text
    try {
      response = JSON.parse(text)
    } catch {
      /* AskEva occasionally returns plain text on error */
    }
    return { ok: res.ok, status: res.status, response }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" }
  }
}
