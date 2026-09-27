import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireAdmin } from '@/lib/auth'
import { getCollection, createObjectId } from '@/lib/db-service'
import { sendEmail } from '@/lib/email'
import { emailTemplates } from '@/lib/emailTemplates'

/**
 * POST /api/orders/[id]/assign-license
 * 
 * Manually assign a license key to an order
 * 
 * Finds an available license from the software_licenses collection,
 * assigns it to the customer, updates the order, and sends an activation email.
 * 
 * Body:
 * {
 *   softwareId: string,    // Software product ID
 *   validity: number,      // License validity in days
 *   maxDevices: number     // Max devices for license
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id: orderId } = await params
    console.log(`🔑 Manual license assignment requested for order: ${orderId}`)
    const body = await request.json()
    const { softwareId, validity, validityYears, maxDevices, quantity } = body
    // Normalize quantity and support validity supplied either as days or as years
    const assignQuantity = Number(quantity || 1)
    const requestedValidityDays = Number(validity || 0)
    const requestedValidityYears = Number(validityYears || 0)

    // Validate input
    if (!softwareId || !validity || !maxDevices) {
      return NextResponse.json(
        { error: 'softwareId, validity, and maxDevices are required' },
        { status: 400 }
      )
    }

    const ordersCollection = await getCollection('orders')
    // Use `license_keys` collection for license storage as requested
    const licenseKeysCollection = await getCollection('license_keys')
    const softwareProductsCollection = await getCollection('software_products')

    // Get order details - try multiple lookup strategies to handle different id shapes
    let order = null
    const orFilters: any[] = []

    // If orderId looks like a valid ObjectId, include that search
    try {
      if (ObjectId.isValid(orderId)) {
        orFilters.push({ _id: new ObjectId(orderId) })
      }
    } catch (e) {
      // ignore
    }

    // Also try matching _id as string or a plain `id` field (some installs use custom string ids)
    orFilters.push({ _id: orderId } as any)
    orFilters.push({ id: orderId })
    orFilters.push({ orderId: orderId })
    // Some databases may have _id stored as a plain object like { "$oid": "..." } (imports/exports).
    // Add filters to match that shape as well.
    orFilters.push({ '_id.$oid': orderId })

    try {
      order = await ordersCollection.findOne({ $or: orFilters })
      console.log(`🔍 Order lookup filters:`, orFilters)
      console.log(`🔍 Fetched order for ID ${orderId}:`, order)
    } catch (lookupErr) {
      console.error('Error while looking up order:', lookupErr)
    }

    if (!order) {
      console.error(`❌ Order not found: ${orderId}`)
      return NextResponse.json({
        error: 'Order not found',
        details: `No order found with ID: ${orderId}`
      }, { status: 404 })
    }

    console.log(`✅ Order found: ${orderId} (using ${order._id ? '_id' : 'id'} field)`)

    // allow additional assignments; we will append keys to order.licenseKeys

    // Get customer email
    const customerEmail = order.customer?.email || order.shippingAddress?.email
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'No customer email found in order' },
        { status: 400 }
      )
    }

    // Get software product details
    let softwareProduct
    try {
      softwareProduct = await softwareProductsCollection.findOne({
        _id: createObjectId(softwareId)
      })
    } catch (e) {
      return NextResponse.json({ error: 'Invalid softwareId format' }, { status: 400 })
    }

    if (!softwareProduct) {
      return NextResponse.json(
        { error: 'Software product not found' },
        { status: 404 }
      )
    }

    // Build query to find an available license key that matches requested constraints
    // We require:
    // - same softwareId
    // - license is unassigned (assigned: false) OR email is null OR status === 'available'
    // - if validity provided, match either validityDays or validityYears
    // - if maxDevices provided, ensure license.maxDevices >= requested maxDevices
    const licenseQuery: any = { softwareId: new ObjectId(softwareId) }

    const availabilityOr: any[] = [{ assigned: false }, { email: null }, { status: 'available' }]
    const andClauses: any[] = [{ $or: availabilityOr }]

    if (requestedValidityDays || requestedValidityYears) {
      const byDays = requestedValidityDays || (requestedValidityYears ? requestedValidityYears * 365 : 0)
      const validityYearsRound = Math.round(byDays / 365)
      andClauses.push({ $or: [{ validityDays: byDays }, { validityYears: validityYearsRound }] })
    }

    if (maxDevices) {
      // Prefer licenses that support at least the requested maxDevices
      andClauses.push({ maxDevices: { $gte: maxDevices } })
    }

    if (andClauses.length > 0) {
      licenseQuery.$and = andClauses
    }

    // Find N matching licenses
    const cursor = licenseKeysCollection.find(licenseQuery).limit(assignQuantity)
    const available = await cursor.toArray()

    if (!Array.isArray(available) || available.length === 0) {
      return NextResponse.json(
        {
          error: 'No available license key found',
          details: `No unassigned license found for software ${softwareProduct.name} matching the requested validity/maxDevices`
        },
        { status: 404 }
      )
    }

    const assignedAt = new Date()
    const assignedKeys: string[] = []

    // assign each license
    for (const lic of available) {
      try {
        await licenseKeysCollection.updateOne(
          { _id: lic._id },
          {
            $set: {
              assigned: true,
              status: 'assigned',
              email: customerEmail,
              orderId: order._id || orderId,
              assignedAt: assignedAt,
              updatedAt: new Date()
            }
          }
        )
        assignedKeys.push(lic.key)
      } catch (e) {
        console.warn('Failed to assign license key', lic._id, e)
      }
    }

    if (assignedKeys.length === 0) {
      return NextResponse.json({ error: 'Failed to assign any license keys' }, { status: 500 })
    }

    // Update order: push license keys array, set single licenseKey for backward compatibility,
    // mark order as delivered and add a timeline entry describing the assignment.
    try {
      const setFields: any = { updatedAt: new Date(), licenseAssignedAt: assignedAt }
      const pushTimelineEntry = { date: assignedAt.toISOString(), status: 'Delivered', description: `Assigned ${assignedKeys.length} license(s)` }

      if (!order.licenseKeys || !Array.isArray(order.licenseKeys) || order.licenseKeys.length === 0) {
        setFields.licenseKey = assignedKeys[0]
        setFields.licenseKeys = assignedKeys
      } else {
        // merge existing keys with newly assigned ones
        setFields.licenseKeys = (order.licenseKeys || []).concat(assignedKeys)
      }

      // Also set status to delivered to indicate licenses have been provided
      setFields.status = 'delivered'

      // perform set and push in two operations to avoid strict typings issues
      await ordersCollection.updateOne({ _id: order._id }, { $set: setFields })
      try {
        await ordersCollection.updateOne({ _id: order._id }, { $push: { timeline: pushTimelineEntry } })
      } catch (pushErr) {
        // non-fatal if timeline push fails
        console.warn('Failed to push timeline entry', pushErr)
      }
    } catch (e) {
      console.warn('Failed to update order with assigned keys', e)
    }

    console.log(`✅ License(s) manually assigned: ${assignedKeys.join(', ')} for order ${orderId}`)

    // Send email per assigned key
    const customerName = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Valued Customer'
    const results: any[] = []
    for (const key of assignedKeys) {
      try {
        const emailData = {
          customerName,
          orderNumber: orderId,
          softwareName: softwareProduct.name,
          licenseKey: key,
          validity: validity ? String(validity) : '',
          maxDevice: maxDevices,
          companyName: 'Sara Mobiles and Electronics '
        }

        await sendEmail({
          to: customerEmail,
          subject: emailTemplates.SOFTWARE_ACTIVATION_KEY.subject
            .replace('#{softwareName}', softwareProduct.name)
            .replace('#{orderNumber}', orderId),
          html: emailTemplates.SOFTWARE_ACTIVATION_KEY.html(emailData)
        })

        results.push({ key, sent: true })
      } catch (emailError) {
        console.error('❌ Failed to send activation key email for key', key, emailError)
        results.push({ key, sent: false, error: String(emailError) })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'License key(s) assigned',
      data: { licenseKeys: assignedKeys, results }
    })

  } catch (error) {
    console.error('❌ Error assigning license:', error)
    return NextResponse.json(
      {
        error: 'Failed to assign license',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
