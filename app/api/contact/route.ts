import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { withRateLimit } from "@/lib/rate-limit"
import { getCollection } from "@/lib/db-service"

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export const POST = withRateLimit(async (req: Request) => {
  const { name, email, subject, message } = await req.json()

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
  }

  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message)

  // Email to admin
  const adminMail = process.env.CONTACT_ADMIN_EMAIL
  const adminSubject = `New Contact Form Submission: ${safeSubject}`
  const adminHtml = `
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px #0001;font-family:Arial,sans-serif;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:28px;font-weight:bold;">📩 New Contact Form Submission</h1>
        <p style="margin:10px 0 0 0;font-size:16px;opacity:0.9;">You have received a new message from the website contact form.</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#1e40af;margin-top:0;font-size:22px;">Contact Details</h2>
        <table style="width:100%;font-size:16px;margin-bottom:24px;">
          <tr><td style="font-weight:bold;width:120px;">Name:</td><td>${safeName}</td></tr>
          <tr><td style="font-weight:bold;">Email:</td><td>${safeEmail}</td></tr>
          <tr><td style="font-weight:bold;">Subject:</td><td>${safeSubject}</td></tr>
        </table>
        <h3 style="color:#1e40af;font-size:18px;margin-bottom:8px;">Message</h3>
        <div style="background:#f8fafc;padding:18px 20px;border-radius:6px;font-size:16px;">${safeMessage}</div>
      </div>
      <div style="background:#f4f4f4;color:#888;text-align:center;padding:18px 0;font-size:13px;">This message was sent from your website contact form.</div>
    </div>
  `

  // Email to customer
  const customerSubject = "Thank you for contacting us!"
  const customerHtml = `
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px #0001;font-family:Arial,sans-serif;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:28px;font-weight:bold;">Thank You for Contacting Us!</h1>
        <p style="margin:10px 0 0 0;font-size:16px;opacity:0.9;">Hi ${safeName}, we've received your message and our team will get back to you soon.</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#1e40af;margin-top:0;font-size:22px;">Your Message</h2>
        <div style="background:#f8fafc;padding:18px 20px;border-radius:6px;font-size:16px;margin-bottom:24px;">${safeMessage}</div>
        <p style="font-size:16px;">We appreciate you reaching out to us. If you have any urgent queries, feel free to reply to this email.</p>
      </div>
      <div style="background:#f4f4f4;color:#888;text-align:center;padding:18px 0;font-size:13px;">This is an automated confirmation. Our team will respond as soon as possible.</div>
    </div>
  `

  // Stored before sending: an SMTP outage must never lose the enquiry.
  let stored = false
  try {
    const inquiries = await getCollection("contact_inquiries")
    await inquiries.insertOne({
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 160),
      subject: String(subject).slice(0, 200),
      message: String(message).slice(0, 5000),
      source: "contact_form",
      status: "new",
      createdAt: new Date(),
    })
    stored = true
  } catch (error) {
    console.error("[contact] failed to persist enquiry:", error)
  }

  const adminResult = await sendEmail({ to: adminMail || "admin@example.com", subject: adminSubject, html: adminHtml })
  const customerResult = await sendEmail({ to: email, subject: customerSubject, html: customerHtml })

  if (adminResult.success && customerResult.success) {
    return NextResponse.json({ success: true })
  }
  // The enquiry is safe in the database, so this is not a customer-facing failure.
  if (stored) {
    return NextResponse.json({ success: true, emailDelivered: false })
  }
  return NextResponse.json({ success: false, error: "Failed to submit your message" }, { status: 500 })
}, { maxRequests: 5, windowMs: 60000 })
