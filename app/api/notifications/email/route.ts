import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { getEmailTemplate, getEmailSubject, type EmailData } from '@/lib/emailTemplates'

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
  data: z.object({
    orderNumber: z.string().trim().min(1).max(100),
    customerName: z.string().trim().min(1).max(160),
  }).passthrough(),
})

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = notificationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid notification request' }, { status: 400 })
    }
    const { to, templateId, data } = parsed.data

    if (process.env.NODE_ENV === "development") console.log('Email request received:', { to, templateId, orderNumber: data?.orderNumber })

    const result = await sendEmail({
      to,
      subject: getEmailSubject(templateId, data.orderNumber),
      html: getEmailTemplate(templateId, data as unknown as EmailData),
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