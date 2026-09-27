import { ObjectId } from "mongodb"
import { randomBytes, randomInt } from "crypto"

export const LUCKY_DRAW_COLLECTIONS = {
  CAMPAIGNS: "lucky_draw_campaigns",
  PARTICIPANTS: "lucky_draw_participants",
  WINNERS: "lucky_draw_winners",
} as const

export type LuckyDrawPrize = {
  name: string
  icon: string
  quantity: number
}

export type LuckyDrawCampaign = {
  _id: string
  name: string
  store: string
  storeId?: string | null
  prizes: LuckyDrawPrize[]
  status: "draft" | "active" | "paused" | "completed"
  drawToken: string
  createdAt: Date | string
  updatedAt: Date | string
}

export type LuckyDrawParticipant = {
  _id: string
  campaignId: string
  name: string
  phone: string
  email: string
  wonAt?: Date | null
  createdAt: Date | string
}

/** Existing documents use hex string _ids rather than ObjectId. */
export function newId(): string {
  return new ObjectId().toHexString()
}

export function newDrawToken(): string {
  return randomBytes(16).toString("hex")
}

/** Cryptographically uniform pick — Math.random() is not acceptable for prize draws. */
export function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null
  return items[randomInt(items.length)]
}

export function normalisePrizes(input: unknown): LuckyDrawPrize[] {
  if (!Array.isArray(input)) return []
  return input
    .map((p: any) => ({
      name: String(p?.name ?? "").trim(),
      icon: String(p?.icon ?? "🎁").trim() || "🎁",
      quantity: Math.max(0, Math.floor(Number(p?.quantity ?? 0)) || 0),
    }))
    .filter((p) => p.name.length > 0)
}

export type ParsedParticipant = { name: string; phone: string; email: string }

/**
 * Accepts CSV or tab-separated text with a header row. Recognised headers:
 * name, phone/mobile, email. Falls back to positional name,phone,email.
 */
export function parseParticipantList(raw: string): { rows: ParsedParticipant[]; skipped: number } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return { rows: [], skipped: 0 }

  const splitLine = (line: string) => {
    const parts = line.includes("\t") ? line.split("\t") : line.split(",")
    return parts.map((p) => p.trim().replace(/^"|"$/g, ""))
  }

  const header = splitLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = header.some((h) => ["name", "phone", "mobile", "email"].includes(h))

  let nameIdx = 0
  let phoneIdx = 1
  let emailIdx = 2
  if (hasHeader) {
    nameIdx = header.findIndex((h) => h === "name" || h === "customer" || h === "customername")
    phoneIdx = header.findIndex((h) => h === "phone" || h === "mobile" || h === "mobileno" || h === "contact")
    emailIdx = header.findIndex((h) => h === "email" || h === "emailid" || h === "mail")
  }

  const rows: ParsedParticipant[] = []
  let skipped = 0

  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cols = splitLine(line)
    const name = (nameIdx >= 0 ? cols[nameIdx] : "") || ""
    const phone = (phoneIdx >= 0 ? cols[phoneIdx] : "") || ""
    const email = (emailIdx >= 0 ? cols[emailIdx] : "") || ""

    if (!name && !phone && !email) {
      skipped++
      continue
    }
    if (!name) {
      skipped++
      continue
    }

    rows.push({ name: name.slice(0, 120), phone: phone.slice(0, 30), email: email.slice(0, 160).toLowerCase() })
  }

  return { rows, skipped }
}

export function maskPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "")
  if (digits.length < 4) return "••••"
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

export function winnerEmailHtml(opts: {
  winnerName: string
  prizeName: string
  prizeIcon: string
  campaignName: string
  storeName: string
}): string {
  const { winnerName, prizeName, prizeIcon, campaignName, storeName } = opts
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 14px rgba(16,24,40,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#e8262a,#b81b1f);padding:28px 24px;text-align:center;color:#fff;">
            <div style="font-size:40px;line-height:1;">${prizeIcon}</div>
            <div style="font-size:22px;font-weight:700;margin-top:10px;">Congratulations, ${winnerName}!</div>
            <div style="font-size:13px;opacity:.9;margin-top:4px;">You are a winner in ${campaignName}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 24px;color:#1f2933;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 14px;">We are delighted to inform you that your name was drawn in our lucky draw at <strong>${storeName}</strong>.</p>
            <div style="border:1px solid #e3e7ec;border-left:4px solid #e8262a;border-radius:0 10px 10px 0;padding:14px 18px;background:#faf7f7;margin:18px 0;">
              <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6e6e6e;">Your prize</div>
              <div style="font-size:19px;font-weight:700;color:#1f2933;margin-top:4px;">${prizeIcon} ${prizeName}</div>
            </div>
            <p style="margin:0 0 14px;">Please visit <strong>${storeName}</strong> with a valid photo ID to collect your prize. Our team will guide you through the handover.</p>
            <p style="margin:0;color:#5f6b78;font-size:12.5px;">If you have any questions, simply reply to this email and we will be happy to help.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 24px;text-align:center;color:#7b8794;font-size:11.5px;border-top:1px solid #e3e7ec;">
            This email was sent because your details were entered into ${campaignName}.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
