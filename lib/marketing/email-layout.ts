/**
 * Shared email shell.
 *
 * Written as table-based HTML with inline styles because Gmail, Outlook and most
 * Indian mail clients strip <style> blocks and ignore flex/grid. Everything is
 * capped at 600px, which is the widest that renders without horizontal scroll on
 * a phone — where the majority of this audience reads mail.
 */

export type BrandTheme = {
  primary: string
  accent: string
  ink: string
}

export const THEMES: Record<string, BrandTheme> = {
  festive: { primary: "#c2410c", accent: "#f59e0b", ink: "#1f2937" },
  premium: { primary: "#111827", accent: "#d4af37", ink: "#111827" },
  fresh: { primary: "#0f766e", accent: "#14b8a6", ink: "#134e4a" },
  urgent: { primary: "#b91c1c", accent: "#ef4444", ink: "#1f2937" },
  brand: { primary: "#e8262a", accent: "#f5c451", ink: "#1f2937" },
  calm: { primary: "#1d4ed8", accent: "#3b82f6", ink: "#1e293b" },
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://sarastores.com"

export type BlockOptions = {
  theme: BrandTheme
  eyebrow?: string
  headline: string
  subhead?: string
  body: string
  ctaLabel: string
  ctaHref?: string
  /** Small trust/benefit strip under the CTA. */
  bullets?: string[]
  footnote?: string
}

/** Placeholder the send path swaps for a real coupon box, or removes entirely. */
export const COUPON_SLOT = "<!--COUPON_SLOT-->"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Renders the coupon box for a coupon that has been verified to exist.
 * Never call this with an invented code — a dead code in a campaign costs more
 * trust than the discount buys.
 */
export function renderCouponBlock(code: string, note: string, theme: BrandTheme): string {
  return `<tr><td style="padding:18px 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${theme.accent};border-radius:10px;background:#fffbeb;">
        <tr><td align="center" style="padding:16px;">
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#92400e;letter-spacing:1px;text-transform:uppercase;">Your code</div>
          <div style="font-family:'Courier New',monospace;font-size:26px;font-weight:bold;color:${theme.primary};letter-spacing:3px;padding-top:4px;">${esc(code)}</div>
          ${note ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#92400e;padding-top:6px;">${esc(note)}</div>` : ""}
        </td></tr>
      </table></td></tr>`
}

/**
 * Fills or removes the coupon slot. With no code the slot disappears entirely,
 * so a campaign without a discount reads as a clean message rather than an
 * empty box.
 */
export function applyCoupon(
  html: string,
  coupon: { code: string; note?: string } | null,
  theme: BrandTheme = THEMES.brand,
): string {
  if (!coupon?.code) return html.replace(COUPON_SLOT, "")
  return html.replace(COUPON_SLOT, renderCouponBlock(coupon.code, coupon.note ?? "", theme))
}

/** Builds a complete, client-safe promotional email. */
export function renderEmail(o: BlockOptions): string {
  const href = o.ctaHref || `${SITE}/products`
  const bullets = (o.bullets ?? [])
    .map(
      (b) =>
        `<td align="center" style="padding:0 6px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#475569;">${esc(b)}</td>`,
    )
    .join("")

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(o.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.subhead || o.headline)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(15,23,42,0.08);">

    <tr><td style="background:${o.theme.primary};padding:28px 24px;text-align:center;">
      ${o.eyebrow ? `<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${o.theme.accent};font-weight:bold;margin-bottom:8px;">${esc(o.eyebrow)}</div>` : ""}
      <h1 style="margin:0;font-family:Arial,sans-serif;font-size:26px;line-height:32px;color:#ffffff;font-weight:bold;">${esc(o.headline)}</h1>
      ${o.subhead ? `<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#ffffffcc;">${esc(o.subhead)}</p>` : ""}
    </td></tr>

    <tr><td style="padding:26px 26px 8px;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:${o.theme.ink};">
      <p style="margin:0 0 14px;">Hi {{name}},</p>
      <p style="margin:0;">${o.body}</p>
    </td></tr>

    ${COUPON_SLOT}

    <tr><td align="center" style="padding:24px 26px 6px;">
      <a href="${href}" style="display:inline-block;background:${o.theme.primary};color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 34px;border-radius:8px;">${esc(o.ctaLabel)}</a>
    </td></tr>

    ${bullets ? `<tr><td style="padding:18px 16px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bullets}</tr></table></td></tr>` : ""}

    ${o.footnote ? `<tr><td style="padding:14px 26px 0;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;text-align:center;">${esc(o.footnote)}</td></tr>` : ""}

    <tr><td style="padding:22px 26px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
        <tr><td align="center" style="padding-top:16px;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#94a3b8;">
          Sara Mobiles &amp; Electronics<br>
          <a href="${SITE}/store-locator" style="color:#64748b;text-decoration:underline;">Find a store</a> &nbsp;·&nbsp;
          <a href="${SITE}/track" style="color:#64748b;text-decoration:underline;">Track an order</a> &nbsp;·&nbsp;
          <a href="${SITE}/contact" style="color:#64748b;text-decoration:underline;">Contact us</a>
          <br><br>
          You are receiving this because you shopped with us or opted in.<br>
          <a href="${SITE}/api/unsubscribe?token={{unsubscribeToken}}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> ·
          <a href="${SITE}/account/preferences" style="color:#94a3b8;text-decoration:underline;">Email preferences</a>
        </td></tr>
      </table>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`
}
