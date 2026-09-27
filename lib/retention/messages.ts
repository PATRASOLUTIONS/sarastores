/**
 * Email bodies for lifecycle reminders.
 *
 * Kept deliberately plain: these are helpful, service-flavoured messages, and
 * dressing a warranty notice up as a sale is what turns a welcome reminder into an
 * unsubscribe. Every message carries a working one-click opt-out.
 */

import type { ReminderKind } from "./rules"

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://saraelectronics.in"
  )
}

type MessageInput = {
  customerName: string
  productName: string
  category: string | null
  purchasedAt: Date
  unsubscribeToken: string
  /** Consumable part name, when the reminder is a replenishment. */
  part?: string
  /** Days remaining, when the reminder is a warranty notice. */
  daysRemaining?: number
  /** Deep link to the product or cart the message is about. */
  actionUrl?: string
  /** Price fields, for wishlist price-drop alerts. */
  oldPrice?: number
  newPrice?: number
  /** Extra item count, for multi-item carts. */
  extraItems?: number
}

export type BuiltMessage = { subject: string; html: string }

const BRAND = "Sara Electronics"

function shell(bodyHtml: string, unsubscribeToken: string): string {
  const origin = siteOrigin()
  const unsubscribeUrl = `${origin}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&channel=email`
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f2f5fa;font-family:'Segoe UI',Arial,sans-serif;color:#1c2733;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0F2557;border-radius:14px 14px 0 0;padding:20px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.04em;">SARA <span style="color:#FF8A3D;">ELECTRONICS</span></span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px;">
      ${bodyHtml}
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#8794a5;line-height:1.6;">
      You're receiving this because you opted in to updates from ${BRAND}.<br />
      <a href="${unsubscribeUrl}" style="color:#8794a5;text-decoration:underline;">Unsubscribe from these emails</a>
    </p>
  </div>
</body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#FF6A2C;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">${escapeHtml(label)}</a>`
}

export function buildReminderMessage(
  kind: ReminderKind,
  input: MessageInput,
): BuiltMessage | null {
  const origin = siteOrigin()
  const name = escapeHtml(input.customerName || "there")
  const product = escapeHtml(input.productName || "your appliance")
  const purchased = input.purchasedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  switch (kind) {
    case "warranty_expiry": {
      const days = input.daysRemaining ?? 30
      return {
        subject: `Your ${input.productName} warranty ends in ${days} days`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             A quick heads-up: the manufacturer warranty on your <strong>${product}</strong>,
             bought on ${purchased}, is due to end in about <strong>${days} days</strong>.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             If you'd like to stay covered, our team can walk you through extended
             warranty options. If everything's running well, no action is needed.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/contact`, "Talk to our team")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "service_due": {
      return {
        subject: `Time for a service on your ${input.productName}?`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             Your <strong>${product}</strong> is due for a routine service. Regular servicing
             keeps it efficient, lowers running costs and helps it last longer.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             Our certified engineers can visit at a time that suits you.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/contact`, "Book a service visit")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "replenishment": {
      const part = escapeHtml(input.part || "replacement parts")
      return {
        subject: `Your ${input.productName} may need a ${input.part ?? "replacement"}`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             It's been about six months since your <strong>${product}</strong> was last due
             for a ${part}. Replacing it on schedule keeps performance and water quality
             where they should be.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/products`, "Order a replacement")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "accessory": {
      return {
        subject: `Getting on well with your ${input.productName}?`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             You've had your <strong>${product}</strong> for a couple of weeks now. If anything
             isn't working as expected, just reply and we'll sort it out.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             If all's well, we have accessories and add-ons that pair nicely with it.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/products`, "Browse add-ons")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "winback": {
      return {
        subject: `We've missed you at ${BRAND}`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             It's been a while since your last order. Plenty has changed — new arrivals across
             televisions, appliances and kitchen essentials, plus no-cost EMI and free
             installation on most products.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/products`, "See what's new")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "review_request": {
      return {
        subject: `How are you finding your ${input.productName}?`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             You've had your <strong>${product}</strong> for about a week now. Would you mind
             sharing a quick review? It genuinely helps other shoppers choose well.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             And if anything isn't right, reply to this email and we'll put it straight.
           </p>
           <p style="margin:0 0 8px;">${button(input.actionUrl || `${origin}/products`, "Write a review")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "abandoned_cart": {
      const extra = input.extraItems && input.extraItems > 0
        ? ` and ${input.extraItems} other item${input.extraItems > 1 ? "s" : ""}`
        : ""
      return {
        subject: `You left ${input.productName} in your basket`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             You left <strong>${product}</strong>${escapeHtml(extra)} in your basket. We've saved it
             for you — pick up right where you left off.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             Stock isn't reserved, so popular models can sell out.
           </p>
           <p style="margin:0 0 8px;">${button(`${origin}/cart`, "Return to my basket")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "back_in_stock": {
      return {
        subject: `Back in stock: ${input.productName}`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             Good news — <strong>${product}</strong> from your wishlist is available again.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
             It sold out once already, so we'd grab it sooner rather than later.
           </p>
           <p style="margin:0 0 8px;">${button(input.actionUrl || `${origin}/products`, "View it now")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    case "price_drop": {
      const oldP = Number(input.oldPrice ?? 0)
      const newP = Number(input.newPrice ?? 0)
      const saving = oldP > newP ? oldP - newP : 0
      const inr = (n: number) => `&#8377;${Math.round(n).toLocaleString("en-IN")}`
      return {
        subject: `Price drop on ${input.productName}`,
        html: shell(
          `<p style="margin:0 0 12px;font-size:15px;">Hi ${name},</p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
             <strong>${product}</strong> from your wishlist has dropped in price.
           </p>
           <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
             <span style="text-decoration:line-through;color:#8794a5;">${inr(oldP)}</span>
             &nbsp;<strong style="font-size:19px;color:#0F2557;">${inr(newP)}</strong>
             ${saving > 0 ? `<br /><span style="color:#0B7A4B;font-weight:700;">You save ${inr(saving)}</span>` : ""}
           </p>
           <p style="margin:0 0 8px;">${button(input.actionUrl || `${origin}/products`, "See the new price")}</p>`,
          input.unsubscribeToken,
        ),
      }
    }

    default:
      return null
  }
}
