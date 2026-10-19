import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { sendEmail, escapeHtml } from '@/lib/email'
import { PROMO_TEMPLATES } from '@/lib/promoTemplates'
import { CAMPAIGN_TEMPLATES } from '@/lib/marketing/campaigns'
import { applyCoupon, withEmailUnsubscribe, unsubscribeUrl } from '@/lib/marketing/email-layout'
import { buildAudience, type Recipient } from '@/lib/marketing/segments'
import { issueUnsubscribeToken } from '@/lib/customer-profile'
import { ObjectId } from 'mongodb'
import { checkAdminAuthorization } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { z } from 'zod'
import type { CampaignProgressEvent } from '@/lib/marketing/campaign-response'

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 30000

const recipientSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().optional(),
})
const campaignRequestSchema = z.object({
  templateId: z.string().min(1),
  subject: z.string().optional(),
  html: z.string().optional(),
  attachImage: z.boolean().optional(),
  userIds: z.array(z.string()).optional(),
  customUsers: z.array(recipientSchema).optional(),
  segment: z.string().default('all'),
  couponCode: z.string().optional(),
})

interface EmailTemplate {
  id?: string
  name: string
  subject: string
  html: string
  image?: string
}

interface CampaignCoupon {
  code: string
  isActive?: boolean
  active?: boolean
  discountValue?: number | string
  value?: number | string
  discountType?: string
  type?: string
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Admin access required' }, { status: 401 })
    }

    let input: unknown
    try {
      input = await req.json()
    } catch (error) {
      console.error('Invalid campaign JSON', error)
      return NextResponse.json({ error: 'Invalid campaign request' }, { status: 400 })
    }
    const parsed = campaignRequestSchema.safeParse(input)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid campaign request' }, { status: 400 })
    }
    const body = parsed.data
    const { templateId, subject: customSubject, html: customHtml, attachImage, userIds, customUsers, segment, couponCode } = body || {}

    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 })

    const { db } = await connectToDatabase()

    // A campaign may carry a discount, but only one that actually exists and is live.
    let coupon: { code: string; note?: string } | null = null
    if (couponCode) {
      const doc = await db.collection<CampaignCoupon>('coupons').findOne({ code: String(couponCode).toUpperCase().trim() })
      if (!doc) return NextResponse.json({ error: `Coupon "${couponCode}" does not exist` }, { status: 400 })
      if (doc.isActive === false || doc.active === false) {
        return NextResponse.json({ error: `Coupon "${couponCode}" is not active` }, { status: 400 })
      }
      const value = doc.discountValue ?? doc.value
      const isPct = (doc.discountType ?? doc.type) === 'percentage'
      coupon = { code: doc.code, note: isPct ? `${value}% off your order` : `₹${Number(value).toLocaleString('en-IN')} off your order` }
    }

    // Determine target recipients
    const audience = await buildAudience()
    const contactable = audience.filter(recipient => recipient.email && recipient.consent.email)
    const targetUsers: Recipient[] = []
    if (customUsers?.length) {
      const byEmail = new Map(contactable.map(recipient => [recipient.email.trim().toLowerCase(), recipient]))
      const imported = customUsers.map(recipient => byEmail.get(recipient.email.toLowerCase()))
      const rejected = imported.filter(recipient => !recipient).length
      if (rejected) {
        return NextResponse.json({ error: `${rejected} imported addresses have no stored email opt-in. No campaign was sent.` }, { status: 400 })
      }
      for (const recipient of imported) {
        if (recipient) targetUsers.push(recipient)
      }
    }
    if (!customUsers?.length || userIds?.length) {
      const requestedIds = Array.isArray(userIds) && userIds.length > 0 ? new Set(userIds.map(String)) : null
      targetUsers.push(...contactable.filter(recipient => !requestedIds || requestedIds.has(recipient.id)))
    }

    let subjectTemplate = customSubject
    let htmlTemplate = customHtml

    let template: EmailTemplate | null | undefined = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId) || PROMO_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      template = await db.collection<EmailTemplate>('email_templates').findOne({ id: templateId })
    }
    if (!template && ObjectId.isValid(templateId)) {
      template = await db.collection<EmailTemplate>('email_templates').findOne({ _id: new ObjectId(templateId) })
    }

    if (template) {
      if (!subjectTemplate) subjectTemplate = template.subject
      if (!htmlTemplate) htmlTemplate = template.html
    }

    if (!subjectTemplate || !htmlTemplate) {
      return NextResponse.json({ error: 'Template subject/html missing' }, { status: 400 })
    }

    // Prepare image attachment if requested and template provides image
    let attachment: { filename: string; content: Buffer; contentType?: string } | null = null
    if (attachImage && template?.image) {
      try {
        const imageUrl = template.image
        const resolvedUrl = imageUrl.startsWith('http') ? imageUrl : `${process.env.NEXTAUTH_URL || ''}${imageUrl}`
        const imgRes = await fetch(resolvedUrl)
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer()
          const buf = Buffer.from(arrayBuf)
          const contentType = imgRes.headers.get('content-type') || undefined
          const filename = imageUrl.split('/').pop() || 'image.jpg'
          attachment = { filename, content: buf, contentType }
        } else {
          console.warn('Failed to fetch template image for attachment', { status: imgRes.status })
        }
      } catch (e) {
        console.warn('Failed to fetch template image for attachment', e)
      }
    }

    // Build recipient list with personalized content
    const recipients: { userId: string; to: string; subject: string; html: string }[] = []
    const seenEmails = new Set<string>()
    for (const u of targetUsers) {
      const to = u.email
      if (!to || seenEmails.has(to.toLowerCase())) continue
      seenEmails.add(to.toLowerCase())

      const displayName = u.name || 'Customer'
      const subj = subjectTemplate.replace(/{{\s*name\s*}}/gi, () => displayName)
      const bodyHtml = applyCoupon(htmlTemplate, coupon)
        .replace(/{{\s*name\s*}}/gi, () => escapeHtml(displayName))
      recipients.push({ userId: u.id, to, subject: subj, html: bodyHtml })
    }

    const totalRecipients = recipients.length
    const totalBatches = Math.ceil(totalRecipients / BATCH_SIZE)

    // Use streaming response for real-time progress updates
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let sent = 0
        let failed = 0

        const sendProgress = (data: CampaignProgressEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        sendProgress({
          type: 'start',
          totalRecipients,
          totalBatches,
          batchSize: BATCH_SIZE,
        })

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE
          const end = Math.min(start + BATCH_SIZE, totalRecipients)
          const batch = recipients.slice(start, end)

          sendProgress({
            type: 'batch_start',
            batch: batchIndex + 1,
            totalBatches,
            emailsInBatch: batch.length,
            sentSoFar: sent,
            failedSoFar: failed,
          })

          for (const item of batch) {
            try {
              const token = await issueUnsubscribeToken(item.userId, 'email')
              const sendOpts: Parameters<typeof sendEmail>[0] = {
                to: item.to, subject: item.subject, html: withEmailUnsubscribe(item.html, token),
                // Bulk mail: mailbox providers expect a header-level opt-out,
                // and penalise senders that only bury it in the body.
                listUnsubscribe: unsubscribeUrl(token),
              }
              if (attachment) sendOpts.attachments = [attachment]

              const result = await sendEmail(sendOpts)
              if (result.success) sent++
              else failed++
            } catch (err) {
              console.error('Failed sending campaign email to', item.to, err)
              failed++
            }
          }

          sendProgress({
            type: 'batch_complete',
            batch: batchIndex + 1,
            totalBatches,
            sent,
            failed,
            processed: sent + failed,
            totalRecipients,
          })

          // Delay between batches to avoid spam filters (skip after last batch)
          if (batchIndex < totalBatches - 1) {
            sendProgress({
              type: 'batch_delay',
              batch: batchIndex + 1,
              totalBatches,
              delaySeconds: BATCH_DELAY_MS / 1000,
              nextBatch: batchIndex + 2,
            })
            await delay(BATCH_DELAY_MS)
          }
        }

        // Save campaign history
        try {
          await db.collection('campaign_history').insertOne({
            templateId,
            templateName: template?.name || 'Unknown',
            subject: subjectTemplate,
            recipientCount: totalRecipients,
            sent,
            failed,
            segment,
            sentAt: new Date(),
            sentBy: auth.userId,
          })
        } catch (e) {
          console.warn('Failed to save campaign history', e)
        }

        sendProgress({
          type: 'complete',
          sent,
          failed,
          totalRecipients,
        })

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    return handleApiError(err, 'Failed to send campaign')
  }
}
