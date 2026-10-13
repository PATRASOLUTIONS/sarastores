import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/html'
import { ComplaintEmailSchema } from '@/lib/validation'
import type { ComplaintStatus } from '@/lib/complaintTypes'

type ComplaintEmail = z.infer<typeof ComplaintEmailSchema>
type ComplaintEmailData = ComplaintEmail['data']
type ComplaintEmailTemplate = ComplaintEmail['templateId']

export const complaintStatusTemplate: Record<ComplaintStatus, ComplaintEmailTemplate> = {
  pending: 'COMPLAINT_SUBMITTED',
  processing: 'COMPLAINT_PROCESSING',
  refund_initiated: 'COMPLAINT_REFUND_INITIATED',
  no_refund: 'COMPLAINT_NO_REFUND',
  resolved: 'COMPLAINT_RESOLVED',
  revoked: 'COMPLAINT_REVOKED',
}

export async function sendComplaintEmail(input: ComplaintEmail) {
  const { to, templateId, data } = ComplaintEmailSchema.parse(input)
  await sendComplaintNotification({
    to,
    subject: getComplaintEmailSubject(templateId, data.complaintId),
    html: getComplaintEmailTemplate(templateId, {
      complaintId: escapeHtml(data.complaintId),
      customerName: escapeHtml(data.customerName),
      orderNumber: escapeHtml(data.orderNumber || 'Not applicable'),
      subject: escapeHtml(data.subject),
      adminNote: escapeHtml(data.adminNote),
    }),
  })
}

export async function sendComplaintNotification(input: Parameters<typeof sendEmail>[0]) {
  const outcome = await sendEmail(input)
  if (!outcome.success) throw new Error('Complaint notification could not be sent')
  const accepted = z.array(z.union([z.string(), z.object({ address: z.string() })]))
    .safeParse(outcome.result?.accepted)
  if (!accepted.success || !accepted.data.some(recipient => (
    typeof recipient === 'string' ? recipient : recipient.address
  )?.toLowerCase() === input.to.toLowerCase())) {
    throw new Error('Complaint notification recipient was not accepted')
  }
}

function getComplaintEmailSubject(templateId: ComplaintEmailTemplate, complaintId: string): string {
  const subjects: Record<string, string> = {
    COMPLAINT_SUBMITTED: `Complaint Received - Reference #${complaintId.slice(-8)}`,
    COMPLAINT_PROCESSING: `Complaint #${complaintId.slice(-8)} - Now Processing`,
    COMPLAINT_REFUND_INITIATED: `Refund Initiated - Complaint #${complaintId.slice(-8)}`,
    COMPLAINT_NO_REFUND: `Complaint Update - #${complaintId.slice(-8)}`,
    COMPLAINT_RESOLVED: `Complaint Resolved - #${complaintId.slice(-8)} ✅`,
    COMPLAINT_REVOKED: `Complaint Revoked - #${complaintId.slice(-8)}`,
  }
  return subjects[templateId] || `Complaint Update - #${complaintId.slice(-8)}`
}

function getComplaintEmailTemplate(templateId: ComplaintEmailTemplate, data: ComplaintEmailData): string {
  // Basic template structure - you can expand these
  const baseStyle = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
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
    <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">${getTemplateTitle(templateId)}</h1>
      </div>
      <div style="padding: 40px 30px; background: white;">
        <p>Hello <strong>${data.customerName}</strong>,</p>
        ${getTemplateContent(templateId, data)}
        <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Need assistance?</p>
          <p style="margin: 5px 0 0 0; color: #3b82f6; font-weight: 600;">
            📧 info@saramobiles.com | 📞 +91 78920 51553
          </p>
        </div>
        <p style="margin-top: 20px;">Best regards,<br><strong>The Sara Mobiles and Electronics Support Team</strong></p>
      </div>
      <div style="background: #1f2937; color: #9ca3af; padding: 25px 30px; text-align: center;">
        <p style="margin: 0; font-size: 12px;">© ${new Date().getFullYear()} Sara Mobiles and Electronics . All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `
  return baseStyle
}

function getTemplateTitle(templateId: ComplaintEmailTemplate): string {
  const titles: Record<string, string> = {
    COMPLAINT_SUBMITTED: '📝 Complaint Received',
    COMPLAINT_PROCESSING: '⚙️ Complaint Being Processed',
    COMPLAINT_REFUND_INITIATED: '💳 Refund Initiated',
    COMPLAINT_NO_REFUND: 'ℹ️ Complaint Update',
    COMPLAINT_RESOLVED: '✅ Complaint Resolved',
    COMPLAINT_REVOKED: '🔄 Complaint Revoked',
  }
  return titles[templateId] || 'Complaint Update'
}

function getTemplateContent(templateId: ComplaintEmailTemplate, data: ComplaintEmailData): string {
  const contents: Record<string, string> = {
    COMPLAINT_SUBMITTED: `
      <p>Thank you for contacting us. We've received your complaint and our team will review it shortly.</p>
      <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Complaint Details</h3>
        <p><strong>Reference ID:</strong> #${data.complaintId.slice(-8)}</p>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
      </div>
      <p>Our support team will review your complaint within 24-48 hours.</p>
    `,
    COMPLAINT_PROCESSING: `
      <p>Your complaint <strong>#${data.complaintId.slice(-8)}</strong> is now being processed by our support team.</p>
      ${data.adminNote ? `<div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Note:</strong> ${data.adminNote}</p></div>` : ''}
      <p>We're actively working on resolving your issue and will keep you updated.</p>
    `,
    COMPLAINT_REFUND_INITIATED: `
      <p>Good news! We've initiated a refund for your complaint <strong>#${data.complaintId.slice(-8)}</strong>.</p>
      <div style="background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Refund Information</h3>
        <p>• Refund will be processed to your original payment method</p>
        <p>• Processing time: 7-8 business days</p>
        <p>• You'll receive a confirmation once complete</p>
      </div>
      ${data.adminNote ? `<p><strong>Additional info:</strong> ${data.adminNote}</p>` : ''}
    `,
    COMPLAINT_NO_REFUND: `
      <p>We've reviewed your complaint <strong>#${data.complaintId.slice(-8)}</strong>.</p>
      <p>After careful review, we're unable to process a refund. However, we'd like to discuss alternative solutions.</p>
      ${data.adminNote ? `<div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Explanation:</strong> ${data.adminNote}</p></div>` : ''}
      <p>Please contact our support team to explore other options.</p>
    `,
    COMPLAINT_RESOLVED: `
      <p>Great news! Your complaint <strong>#${data.complaintId.slice(-8)}</strong> has been successfully resolved.</p>
      ${data.adminNote ? `<div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Resolution:</strong> ${data.adminNote}</p></div>` : ''}
      <p>Thank you for your patience. If you have any feedback, we'd love to hear from you.</p>
    `,
    COMPLAINT_REVOKED: `
      <p>Your complaint <strong>#${data.complaintId.slice(-8)}</strong> has been revoked.</p>
      ${data.adminNote ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Reason:</strong> ${data.adminNote}</p></div>` : ''}
      <p>If you have any questions, please contact our support team.</p>
    `,
  }
  return contents[templateId] || `<p>Your complaint status has been updated.</p>`
}
