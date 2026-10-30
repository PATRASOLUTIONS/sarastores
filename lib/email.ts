import type Mail from "nodemailer/lib/mailer"
import { getEmailTransport } from "@/lib/smtp"
import { generateInvoicePDF as renderInvoicePDF } from "@/lib/invoice-pdf"
import { escapeHtml } from "@/lib/html"
export { escapeHtml } from "@/lib/html"

interface OrderEmailInput {
  id: string
  items: Array<{ name: string; quantity: number; price: number; image?: string | null }>
  customer: {
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  subtotal: number
  tax: number
  shipping: number
  total: number
  paymentMethod: string
  paymentDetails?: { status?: string }
}

interface InvoiceEmailInput extends OrderEmailInput {
  createdAt: string | Date
  status: string
  taxAmount: number
}

/** Public storefront origin used in customer emails. */
export function storefrontOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  try {
    const url = new URL(configured)
    if (url.protocol === "https:" && (url.hostname === "sarastores.com" || url.hostname.endsWith(".sarastores.com"))) {
      return url.origin
    }
  } catch {
    // Fall through to the live store.
  }
  return "https://sarastores.com"
}

export function saraMailFrom(): string {
  const raw = process.env.EMAIL_FROM || "noreply@sarastores.com"
  const address = raw.match(/<([^>]+)>/)?.[1] || raw.trim()
  return `Sara Stores <${address}>`
}

/** Transactional password-reset email. Not a marketing message. */
export function buildPasswordResetEmail(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl)
  const year = new Date().getFullYear()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Reset your Sara Stores password</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Reset your Sara Stores password. This link expires in 1 hour.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr><td style="background:#0F2557;padding:28px 32px;text-align:center;">
      <div style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#FF6A2C;font-weight:bold;">Sara Stores</div>
      <h1 style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:26px;line-height:32px;color:#ffffff;">Reset your password</h1>
    </td></tr>
    <tr><td style="padding:32px;font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
      <p style="margin:0 0 14px;">Hello,</p>
      <p style="margin:0 0 14px;">We received a request to reset the password for your Sara Stores account. The button below opens a secure page on sarastores.com. The link expires in 1 hour.</p>
      <p style="margin:0;">If you did not ask for this, you can ignore this email. Your password will stay the same.</p>
    </td></tr>
    <tr><td align="center" style="padding:4px 32px 8px;">
      <a href="${safeUrl}" style="display:inline-block;background:#0F2557;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:8px;">Reset password</a>
    </td></tr>
    <tr><td style="padding:18px 32px 8px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#64748b;">
      Or copy this link into your browser:<br>
      <a href="${safeUrl}" style="color:#1560BD;word-break:break-all;">${safeUrl}</a>
    </td></tr>
    <tr><td style="padding:8px 32px 28px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#92400e;">
      For your security, this link can be used once and expires in 1 hour.
    </td></tr>
    <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;">
      Sara Stores<br>
      <a href="https://sarastores.com/" style="color:#64748b;text-decoration:none;">sarastores.com</a><br><br>
      © ${year} Sara Stores. All rights reserved.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

/**
 * Derive a readable plain-text part from an HTML email.
 *
 * Every message must carry a text alternative: HTML-only mail is scored as
 * spam by most filters, and it is all a screen reader or a text client has to
 * work with. Generating it here means no template can forget one.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Drop anything that is not content.
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Keep link targets, which are otherwise lost entirely.
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
      const label = text.replace(/<[^>]+>/g, "").trim()
      return label && !label.includes(href) ? `${label} (${href})` : href
    })
    // Structural tags become line breaks so the result is not one long line.
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<li\b[^>]*>/gi, "  - ")
    .replace(/<[^>]+>/g, "")
    // Unescape the entities the templates introduced.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse the whitespace the markup left behind.
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Inject preheader text — the preview line inboxes show next to the subject.
 * Without it they fall back to whatever markup comes first, which is usually
 * "View this email in your browser" or nothing at all.
 */
export function withPreheader(html: string, preheader: string): string {
  if (!preheader) return html
  const block =
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;` +
    `mso-hide:all;font-size:1px;line-height:1px;color:transparent;">` +
    `${escapeHtml(preheader)}` +
    // Padding stops the client from pulling body copy into the preview.
    `${"&#8203;&nbsp;".repeat(40)}</div>`
  return /<body[^>]*>/i.test(html)
    ? html.replace(/(<body[^>]*>)/i, `$1${block}`)
    : block + html
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  preheader,
  attachments,
  listUnsubscribe,
}: {
  to: string
  subject: string
  html: string
  /** Overrides the text part. Generated from `html` when omitted. */
  text?: string
  /** Inbox preview line. */
  preheader?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  /**
   * Unsubscribe URL for non-transactional mail. Gmail and Outlook expect the
   * header on bulk mail and penalise senders that omit it; transactional mail
   * (receipts, password resets) must leave it unset.
   */
  listUnsubscribe?: string
}) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[EMAIL_SEND_ATTEMPT] Preparing to send email:`)
      console.log(`  Subject: ${subject}`)
      console.log(`  HTML size: ${html.length} characters`)
      console.log(`  Attachments: ${attachments ? attachments.length : 0}`)
    }
    
    const body = preheader ? withPreheader(html, preheader) : html

    const mailOptions: Mail.Options = {
      from: saraMailFrom(),
      to,
      subject,
      html: body,
      text: text ?? htmlToPlainText(body),
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments
    }

    if (listUnsubscribe) {
      mailOptions.headers = {
        "List-Unsubscribe": `<${listUnsubscribe}>`,
        // Declares one-click support, which Gmail requires from bulk senders.
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    }

    const result = await getEmailTransport().sendMail(mailOptions)
    
    return { success: true, result }
  } catch (error) {
    console.error(`[EMAIL_SEND_ERROR] Failed to send email:`)
    console.error(`[EMAIL_ERROR_DETAILS]`, error instanceof Error ? error.message : String(error))
    if (process.env.NODE_ENV === "development") {
      console.error(`[EMAIL_ERROR_STACK]`, error)
      console.error(`[EMAIL_CONFIG_CHECK]`)
      console.error(`  SMTP_HOST: ${process.env.SMTP_HOST ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_PORT: ${process.env.SMTP_PORT ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_USER: ${process.env.SMTP_USER ? 'set' : 'NOT SET'}`)
      console.error(`  SMTP_PASS: ${process.env.SMTP_PASS ? 'set' : 'NOT SET'}`)
      console.error(`  EMAIL_FROM: ${process.env.EMAIL_FROM ? 'set' : 'NOT SET'}`)
    }
    
    return { success: false, error }
  }
}

export function getRegistrationEmailTemplate(name: string) {
  const safeName = escapeHtml(name)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>Welcome to Sara Mobiles and Electronics </title>
      <style>
        :root {
          color-scheme: light only;
          supported-color-schemes: light;
        }
        body {
          color-scheme: light only !important;
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; font-weight: bold;">🎉 Welcome to Sara Mobiles and Electronics !</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your shopping journey begins here</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 24px;">Hello ${safeName}! 👋</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Thank you for joining the Sara Mobiles and Electronics  family! Your account has been successfully created and you're now ready to explore our amazing collection of products.
          </p>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">🚀 What you can do now:</h3>
            <ul style="margin: 15px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">🛍️ Browse our wide selection of premium products</li>
              <li style="margin-bottom: 8px;">❤️ Add your favorite items to wishlist</li>
              <li style="margin-bottom: 8px;">🛒 Add products to cart and checkout securely</li>
              <li style="margin-bottom: 8px;">📦 Track your orders in real-time</li>
              <li style="margin-bottom: 8px;">🎁 Enjoy exclusive offers and discounts</li>
              <li style="margin-bottom: 8px;">⭐ Rate and review products</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}" 
               style="background: linear-gradient(135deg, #1e40af, #3b82f6); 
                      color: white; 
                      padding: 15px 35px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block; 
                      font-weight: bold; 
                      font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                      transition: all 0.3s ease;">
              🛍️ Start Shopping Now
            </a>
          </div>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="color: #0277bd; margin-top: 0;">💡 Pro Tips:</h4>
            <p style="margin: 10px 0; font-size: 14px;">
              • Sign in before adding items to cart for a seamless experience<br>
              • Check out our daily deals and special offers<br>
              • Follow us on social media for the latest updates
            </p>
          </div>
          
          <p style="font-size: 16px; margin: 25px 0;">
            If you have any questions or need assistance, our friendly support team is here to help. Just reply to this email or contact us through our website.
          </p>
          
          <p style="font-size: 16px; margin: 25px 0 0 0;">
            Happy Shopping! 🛒<br>
            <strong>The Sara Mobiles and Electronics  Team</strong>
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            This email was sent to ${safeName} because you created an account on Sara Mobiles and Electronics .<br>
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function getOrderConfirmationEmailTemplate(order: OrderEmailInput) {
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <img src="${escapeHtml(String(item.image || ''))}" alt="${escapeHtml(item.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
    </tr>
  `,
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>Order Confirmation - ${order.id}</title>
      <style>
        :root {
          color-scheme: light only;
          supported-color-schemes: light;
        }
        body {
          color-scheme: light only !important;
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${order.id}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #059669;">Thank you for your order, ${escapeHtml(order.customer.firstName)}!</h2>
          <p>Your order has been confirmed and will be processed shortly.</p>
          
          <h3>Order Details:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 10px; text-align: left;">Image</th>
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Summary:</h3>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Subtotal:</span>
              <span>₹${order.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Tax (18% GST):</span>
              <span>₹${order.tax.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
              <span>Shipping:</span>
              <span>₹${order.shipping.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; font-size: 18px; border-top: 2px solid #059669; padding-top: 10px;">
              <span>Total:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
          
          <h3>Shipping Address:</h3>
          <div style="background: white; padding: 15px; border-radius: 5px;">
            <p>${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}<br>
            ${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zipCode)}<br>
            ${escapeHtml(order.customer.country)}</p>
          </div>
          
          <p style="margin-top: 30px;">We'll send you another email when your order ships.</p>
          <p>Thank you for shopping with Sara Mobiles and Electronics !</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function getVendorOrderNotificationTemplate(order: OrderEmailInput) {
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
    </tr>
  `,
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>New Order Received - ${order.id}</title>
      <style>
        :root {
          color-scheme: light only;
          supported-color-schemes: light;
        }
        body {
          color-scheme: light only !important;
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">New Order Received!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Order #${order.id}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc2626;">Order Details:</h2>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Customer Information:</h3>
            <p><strong>Name:</strong> ${escapeHtml(order.customer.firstName)} ${escapeHtml(order.customer.lastName)}<br>
            <strong>Email:</strong> ${escapeHtml(order.customer.email)}<br>
            <strong>Phone:</strong> ${escapeHtml(order.customer.phone || "Not provided")}</p>
            
            <h3>Shipping Address:</h3>
            <p>${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zipCode)}<br>
            ${escapeHtml(order.customer.country)}</p>
          </div>
          
          <h3>Items Ordered:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Summary:</h3>
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; font-size: 18px;">
              <span>Total Amount:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Payment Status:</strong> ${order.paymentDetails?.status || "Completed"}</p>
          </div>
          
          <p style="color: #dc2626; font-weight: bold;">Please process this order as soon as possible.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Tax invoice for an order, as a PDF buffer.
 *
 * The implementation lives in lib/invoice-pdf.ts; this wrapper adapts the
 * order shape used by the email templates.
 */
export function generateInvoicePDF(order: InvoiceEmailInput): Buffer {
  return renderInvoicePDF({
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    customer: order.customer,
    subtotal: order.subtotal,
    // Both field names exist on this type; taxAmount is the invoice-facing one.
    taxAmount: order.taxAmount ?? order.tax,
    shipping: order.shipping,
    total: order.total,
    paymentMethod: order.paymentMethod,
  })
}
