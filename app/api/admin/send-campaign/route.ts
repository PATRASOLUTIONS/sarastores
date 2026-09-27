import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { sendEmail } from '@/lib/email'
import { PROMO_TEMPLATES } from '@/lib/promoTemplates'
import { CAMPAIGN_TEMPLATES } from '@/lib/marketing/campaigns'
import { applyCoupon } from '@/lib/marketing/email-layout'
import { buildAudience } from '@/lib/marketing/segments'
import { ObjectId } from 'mongodb'
import { checkAdminAuthorization } from '@/lib/auth'

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 30000

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Admin access required' }, { status: 401 })
    }

    const body = await req.json()
    const { templateId, subject: customSubject, html: customHtml, attachImage, userIds, customUsers, segment, couponCode } = body || {}

    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 })

    const { db } = await connectToDatabase()

    // A campaign may carry a discount, but only one that actually exists and is live.
    let coupon: { code: string; note?: string } | null = null
    if (couponCode) {
      const doc: any = await db.collection('coupons').findOne({ code: String(couponCode).toUpperCase().trim() })
      if (!doc) return NextResponse.json({ error: `Coupon "${couponCode}" does not exist` }, { status: 400 })
      if (doc.isActive === false || doc.active === false) {
        return NextResponse.json({ error: `Coupon "${couponCode}" is not active` }, { status: 400 })
      }
      const value = doc.discountValue ?? doc.value
      const isPct = (doc.discountType ?? doc.type) === 'percentage'
      coupon = { code: doc.code, note: isPct ? `${value}% off your order` : `₹${Number(value).toLocaleString('en-IN')} off your order` }
    }

    // Determine target recipients
    let targetUsers: any[] = []

    if (customUsers && Array.isArray(customUsers) && customUsers.length > 0) {
      targetUsers = customUsers
    } else {
      const audience = await buildAudience()
      const requestedIds = Array.isArray(userIds) && userIds.length > 0 ? new Set(userIds.map(String)) : null
      targetUsers = audience.filter((recipient) =>
        recipient.email && recipient.consent.email && (!requestedIds || requestedIds.has(recipient.id)),
      )
    }

    let subjectTemplate = customSubject
    let htmlTemplate = customHtml

    let template: any = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId) || PROMO_TEMPLATES.find((t) => t.id === templateId)
    if (!template) {
      template = await db.collection('email_templates').findOne({ id: templateId })
    }
    if (!template) {
      try {
        const fromDb = await db.collection('email_templates').findOne({ _id: new ObjectId(templateId) })
        if (fromDb) template = fromDb
      } catch (e) {
        // ignore invalid ObjectId or lookup failure
      }
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
    if (attachImage && template && (template as any).image) {
      try {
        const imageUrl = (template as any).image
        const resolvedUrl = imageUrl.startsWith('http') ? imageUrl : `${process.env.NEXTAUTH_URL || ''}${imageUrl}`
        const imgRes = await fetch(resolvedUrl)
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer()
          const buf = Buffer.from(arrayBuf)
          const contentType = imgRes.headers.get('content-type') || undefined
          const filename = imageUrl.split('/').pop() || 'image.jpg'
          attachment = { filename, content: buf, contentType }
        }
      } catch (e) {
        console.warn('Failed to fetch template image for attachment', e)
      }
    }

    // Build recipient list with personalized content
    const recipients: { to: string; subject: string; html: string }[] = []
    for (const u of targetUsers) {
      const to = u.email
      if (!to) continue

      const displayName = u.name || 'Customer'
      const subj = subjectTemplate.replace(/{{\s*name\s*}}/gi, displayName)
      const bodyHtml = applyCoupon(htmlTemplate, coupon)
        .replace(/{{\s*name\s*}}/gi, displayName)
        .replace(/{{\s*unsubscribeToken\s*}}/gi, String(u.unsubscribeToken || ''))
      recipients.push({ to, subject: subj, html: bodyHtml })
    }

    const totalRecipients = recipients.length
    const totalBatches = Math.ceil(totalRecipients / BATCH_SIZE)

    // Use streaming response for real-time progress updates
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let sent = 0
        let failed = 0

        const sendProgress = (data: object) => {
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
              const sendOpts: any = { to: item.to, subject: item.subject, html: item.html }
              if (attachment) sendOpts.attachments = [attachment]

              const result = await sendEmail(sendOpts)
              if (result && (result as any).success) sent++
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
            segment: body.segment || 'all',
            sentAt: new Date(),
            sentBy: body.sentBy || 'admin',
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
    console.error('send-campaign error', err)
    return NextResponse.json({ error: (err as any)?.message || 'Unknown error' }, { status: 500 })
  }
}
