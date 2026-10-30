import { escapeHtml } from "@/lib/html"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"

export function verificationSiteOrigin(): string {
  const origin = getConfiguredSiteOrigin()
  if (origin) {
    const hostname = new URL(origin).hostname
    if (process.env.NODE_ENV !== "production" || !["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
      return origin
    }
  }
  return "https://sarastores.com"
}

export function verificationUrl(token: string, userId: string): string {
  const url = new URL("/api/auth/verify-email", verificationSiteOrigin())
  url.searchParams.set("token", token)
  url.searchParams.set("userId", userId)
  return url.toString()
}

/** Keep the verification URL visible even when a mail client hides button styling. */
export function buildVerificationEmail(name: string, url: string): { html: string; text: string } {
  const safeUrl = escapeHtml(url)
  const greeting = name.trim() || "there"
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:10px" cellpadding="0" cellspacing="0">
    <tr><td style="padding:30px">
      <h2 style="color:#111827;margin-top:0">Verify Your Email</h2>
      <p style="color:#374151;line-height:1.6">Hi ${escapeHtml(greeting)},</p>
      <p style="color:#374151;line-height:1.6">Confirm your email address to view your account and orders placed with this email.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
        <tr><td bgcolor="#2563eb" style="border-radius:8px;padding:14px 28px">
          <a href="${safeUrl}" style="color:#fff;text-decoration:underline;font-weight:bold;font-size:16px">Verify Email Address</a>
        </td></tr>
      </table>
      <p style="color:#374151;line-height:1.6">If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;overflow-wrap:anywhere"><a href="${safeUrl}" style="color:#1560BD;text-decoration:underline">${safeUrl}</a></p>
      <p style="color:#6b7280;font-size:13px">This link expires in 24 hours.</p>
      <p style="color:#6b7280;font-size:13px">If you did not request this email, you can safely ignore it.</p>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Hi ${greeting},\n\nConfirm your email address to view your account and orders placed with this email.\n\nVerify your email address by opening this link:\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not request this email, you can safely ignore it.`,
  }
}
