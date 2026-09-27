import { NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import { requireUser } from "@/lib/auth"
import { sendEmail } from '@/lib/email'

// Simplified, well-structured handler that is quantity-aware.
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const body = await request.json()
    const { orderId, userId, items } = body || {}

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'orderId and items[] are required' }, { status: 400 })
    }

    const externalCollection: any = await getCollection('external_orders')
    const ordersCollection: any = await getCollection('orders')

    const baseUrl = process.env.EXLR8_BASE_URL || 'https://stage-platform-exlr8.exlr8now.com'
    const clientId = process.env.EXLR8_CLIENT_ID
    const clientSecret = process.env.EXLR8_CLIENT_SECRET
    const dpId = process.env.EXLR8_DP_ID || process.env.EXLR8_DP || null

    const hasUpstreamConfig = !!(clientId && clientSecret && dpId)
    console.log('exlr8 config', { hasUpstreamConfig, dpId: Boolean(dpId), clientId: Boolean(clientId) })

    const queueDocBase: any = {
      provider: 'exlr8',
      orderId,
      userId: userId || null,
      items,
      status: 'attempting',
      attempts: 0,
      response: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    if (!hasUpstreamConfig) {
      const qd = { ...queueDocBase, status: 'queued', response: { error: 'upstream configuration missing, queued locally' } }
      const ins = await externalCollection.insertOne(qd)
      const queueId = ins.insertedId.toString()
      try {
        await ordersCollection.updateOne({ _id: createObjectId(orderId) }, { $set: { updatedAt: new Date(), status: 'queued_for_external' }, $push: { timeline: { $each: [{ date: new Date().toISOString(), status: 'Queued (no upstream config)', description: `No upstream configuration; queued as ${queueId}` }] }, externalQueue: { $each: [{ queueId, provider: 'exlr8', status: 'queued', createdAt: new Date() }] } } })
      } catch (e) { console.warn('orders update after no-config queue failed', e) }
      return NextResponse.json({ success: true, queued: true, queueId, reason: 'no_upstream_config' })
    }

    const upstreamUrl = baseUrl.replace(/\/$/, '') + '/v1/orders/b2b/direct-checkout'
    const headers: any = { 'Content-Type': 'application/json' }
    if (clientId) headers['x-client-id'] = clientId
    if (clientSecret) headers['x-client-secret'] = clientSecret

    // Normalize items: productID, variantID, quantity
    const normalized = (items || []).map((it: any) => ({
      productID: it.kgenProductId || it.productId || it.productID || null,
      variantID: it.kgenVariantId || it.variantId || it.variantID || null,
      quantity: Number(it.quantity || 1),
      raw: it,
    }))

    // Expand normalized items into per-unit requests (one call per quantity unit)
    const unitRequests: Array<any> = []
    let seq = 1
    for (const n of normalized) {
      for (let i = 0; i < (n.quantity || 1); i++) {
        unitRequests.push({ productID: n.productID, variantID: n.variantID, externalRefID: `${orderId}-${seq}`, raw: n.raw })
        seq++
      }
    }

    const results: any[] = []
    let placedCount = 0
    let queuedCount = 0

    for (let i = 0; i < unitRequests.length; i++) {
      const u = unitRequests[i]
      // build a payload that's tolerant: prefer variantID, otherwise use productID
      const payload: any = { dpID: dpId, externalRefID: u.externalRefID }
      if (u.variantID) payload.variantID = u.variantID
      else if (u.productID) payload.productID = u.productID
      try { console.log('exlr8 unit payload:', JSON.stringify(payload)) } catch (e) { /* serialization failure — non-critical */ }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      let unitRes: Response | null = null
      let rawText: string | null = null
      let data: any = null
      try {
        unitRes = await fetch(upstreamUrl, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal })
        rawText = await unitRes.text().catch(() => null)
        try { data = rawText ? JSON.parse(rawText) : null } catch (e) { data = null }
      } catch (upErr) {
        rawText = String(upErr)
        data = null
      } finally {
        clearTimeout(timeout)
      }

      console.log('exlr8 unit response status:', unitRes ? unitRes.status : 'network-error')
      console.log('exlr8 unit response body:', rawText || JSON.stringify(data))

      const unitQueueDoc: any = { ...queueDocBase, requestPayload: payload, response: { status: unitRes ? unitRes.status : null, data, raw: rawText }, unitSeq: i + 1 }

      if (unitRes && unitRes.ok) {
        unitQueueDoc.status = 'placed'
        unitQueueDoc.externalOrderId = data?.orderId || data?.id || data?.data?.orderId || data?.data?.id || data?.order?.id || null
        const ins = await externalCollection.insertOne(unitQueueDoc)
        const qid = ins.insertedId.toString()
        placedCount++
        try {
          await ordersCollection.updateOne({ _id: createObjectId(orderId) }, { $set: { updatedAt: new Date() }, $push: { timeline: { $each: [{ date: new Date().toISOString(), status: 'External order placed', description: `Placed to exlr8 (externalOrderId: ${unitQueueDoc.externalOrderId || 'n/a'})` }] }, externalQueue: { $each: [{ queueId: qid, provider: 'exlr8', externalOrderId: unitQueueDoc.externalOrderId || null, status: 'placed', createdAt: new Date() }] } } })
        } catch (e) { console.warn('orders update after unit place failed', e) }

        // Extract vouchers and email per-unit if present
        try {
          const v1 = data?.lineItems ? data.lineItems.flatMap((li: any) => li.vouchers || []) : []
          const v2 = data?.vouchers || []
          const v3 = data?.data?.lineItems ? data.data.lineItems.flatMap((li: any) => li.vouchers || []) : []
          const v4 = data?.data?.vouchers || []
          const vouchers = ([] as any[]).concat(v1, v2, v3, v4).filter(Boolean)
          if (Array.isArray(vouchers) && vouchers.length > 0) {
            try {
              // append vouchers to order.vouchers array
              await ordersCollection.updateOne({ _id: createObjectId(orderId) }, { $set: { updatedAt: new Date(), status: 'delivered' }, $push: { vouchers: { $each: vouchers }, timeline: { $each: [{ date: new Date().toISOString(), status: 'Delivered (external)', description: `Delivered by eXlr8 with ${vouchers.length} voucher(s)` }] } } })
            } catch (e) { console.warn('Failed to append vouchers on order', e) }

            try {
              const orderDoc = await ordersCollection.findOne({ _id: createObjectId(orderId) })
              const customerEmail = orderDoc?.customer?.email
              const customerName = orderDoc?.customer?.name || `${orderDoc?.customer?.firstName || ''} ${orderDoc?.customer?.lastName || ''}`.trim()
              if (customerEmail) {
                const voucherItemsHtml = vouchers.map((v: any) => {
                  const code = v.voucherCode || v.code || v.coupon || v.voucher || ''
                  const pin = v.voucherPin || v.pin || v.pinCode || ''
                  const expires = v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : (v.expiryDate ? new Date(v.expiryDate).toLocaleDateString() : '')
                  let html = '<div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e6eef6;margin-bottom:12px;">'
                  html += '<div style="font-family: monospace; font-size:18px; font-weight:700; color:#0f172a;">' + code + '</div>'
                  if (pin) html += '<div style="font-family: monospace; font-size:14px; color:#334155; margin-top:6px;">PIN: ' + pin + '</div>'
                  if (expires) html += '<div style="font-size:13px;color:#475569;margin-top:8px;">Expires: ' + expires + '</div>'
                  html += '</div>'
                  return html
                }).join('\n')
                const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Your Vouchers - Order #${orderId}</title></head><body style="font-family: Arial, Helvetica, sans-serif; background:#f4f7fb; padding:20px;"><div style="max-width:680px;margin:0 auto;"><div style="background:linear-gradient(90deg,#0ea5a4,#06b6d4);color:white;padding:28px;border-radius:10px;text-align:center;"><h1 style="margin:0;font-size:24px;">Your Vouchers are Ready 🎉</h1><p style="margin:8px 0 0 0;opacity:0.95">Order #${orderId}</p></div><div style="background:white;padding:22px;border-radius:8px;margin-top:16px;border:1px solid #e6eef6;"><p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Hi ${customerName || 'Customer'},</p><p style="margin:0 0 16px 0;color:#334155;">Thanks — your vouchers have been delivered. Use the codes below to redeem your purchase.</p>${voucherItemsHtml}<div style="margin-top:18px;padding-top:12px;border-top:1px dashed #e6eef6;color:#475569;font-size:14px;">If you need help redeeming, reply to this email or contact support at <strong>sales.systechdigital@gmail.com</strong>.</div></div><div style="text-align:center;margin-top:18px;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} Sara Mobiles and Electronics </div></div></body></html>`
                try { await sendEmail({ to: customerEmail, subject: `Your Vouchers — Order #${orderId}`, html }) } catch (mailErr) { console.warn('Failed to send voucher email', mailErr) }
              }
            } catch (emailErr) { console.warn('Voucher email handling failed', emailErr) }
          }
        } catch (e) { console.warn('Vouchers processing failed', e) }

        results.push({ unit: u.externalRefID, placed: true, externalOrderId: unitQueueDoc.externalOrderId })
      } else {
        // queue the failed unit
        unitQueueDoc.status = 'queued'
        const ins = await externalCollection.insertOne(unitQueueDoc)
        const qid = ins.insertedId.toString()
        queuedCount++
        try {
          await ordersCollection.updateOne({ _id: createObjectId(orderId) }, { $set: { updatedAt: new Date(), status: 'queued_for_external' }, $push: { timeline: { $each: [{ date: new Date().toISOString(), status: `Queued (upstream ${unitRes ? unitRes.status : 'network-error'})`, description: `Upstream responded ${unitRes ? unitRes.status : 'network-error'}; queued as ${qid}` }] }, externalQueue: { $each: [{ queueId: qid, provider: 'exlr8', status: 'queued', createdAt: new Date() }] } } })
        } catch (e) { console.warn('orders update after unit fallback queue failed', e) }
        results.push({ unit: u.externalRefID, placed: false, queueId: qid })
      }
    }

    return NextResponse.json({ success: true, placedCount, queuedCount, details: results })
  } catch (upErr) {
    // Network/timeout error -> queue
    console.warn('Upstream call failed, falling back to queue:', upErr)
    try {
      const externalCollection: any = await getCollection('external_orders')
      const ordersCollection: any = await getCollection('orders')
      const qbody = await request.json().catch(() => ({}))
      const qOrderId = qbody.orderId || null
      const qUserId = qbody.userId || null
      const qItems = qbody.items || []
      const queueDoc: any = { provider: 'exlr8', orderId: qOrderId, userId: qUserId, items: qItems, status: 'queued', response: { error: String(upErr) }, createdAt: new Date(), updatedAt: new Date() }
      const ins = await externalCollection.insertOne(queueDoc)
      const queueId = ins.insertedId.toString()
      try { await ordersCollection.updateOne({ _id: createObjectId(qOrderId) }, { $set: { updatedAt: new Date(), status: 'queued_for_external' }, $push: { timeline: { $each: [{ date: new Date().toISOString(), status: 'Queued (network)', description: `Network error contacting upstream; queued as ${queueId}` }] }, externalQueue: { $each: [{ queueId, provider: 'exlr8', status: 'queued', createdAt: new Date() }] } } }) } catch (e) { console.warn('orders update after network queue failed', e) }
      return NextResponse.json({ success: true, queued: true, queueId })
    } catch (e) {
      console.error('Failed to persist fallback queue', e)
      return NextResponse.json({ error: 'Failed to contact upstream and to queue locally' }, { status: 500 })
    }
  }
}
