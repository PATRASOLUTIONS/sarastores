import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { getEmailTemplate, getEmailSubject, emailTemplateDataSchemas } from '@/lib/emailTemplates'

const notificationSchema = z.object({
  to: z.string().email(),
  templateId: z.enum([
    'ORDER_PENDING',
    'ORDER_PROCESSING',
    'ORDER_SHIPPED',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'SOFTWARE_LICENSE_KEYS',
    'SOFTWARE_ACTIVATION_KEY',
    'CART_ABANDONMENT',
  ]),
  data: z.unknown(),
})

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = notificationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid notification request' }, { status: 400 })
    }
    const { to, templateId } = parsed.data
    const templateData = emailTemplateDataSchemas[templateId].safeParse(parsed.data.data)
    if (!templateData.success) {
      return NextResponse.json({ error: 'Invalid email template data' }, { status: 400 })
    }
    const data = templateData.data
    const orderNumber = "orderNumber" in data ? data.orderNumber : ""

    if (process.env.NODE_ENV === "development") console.log('Email request received:', { templateId })

    const result = await sendEmail({
      to,
      subject: getEmailSubject(templateId, orderNumber),
      html: getEmailTemplate(templateId, data),
    })
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email sending failed:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}