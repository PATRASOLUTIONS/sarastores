import { NextResponse } from 'next/server'
import { addLicenseKeys, getAllLicenseKeys, revokeLicenseKey } from '@/lib/software-service'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const softwareId = searchParams.get('softwareId')
    const status = searchParams.get('status')
    const customerEmail = searchParams.get('customerEmail')
    
    const filter: any = {}
    if (softwareId) filter.softwareId = softwareId
    if (status) filter.status = status
    if (customerEmail) filter.customerEmail = customerEmail
    
    const keys = await getAllLicenseKeys(filter)

    // Enrich keys with order/customer info when assignedTo is missing
    const { db } = await connectToDatabase()
    const ordersCollection = db.collection('orders')

    const enriched = await Promise.all(keys.map(async (k: any) => {
      // normalize id
      const out: any = { ...k, _id: k._id.toString() }

      // If assignedTo already present, ensure expiresAt is a string
      if (out.assignedTo) {
        if (out.expiresAt && out.expiresAt instanceof Date) out.expiresAt = out.expiresAt.toISOString()
        return out
      }

      // Try to populate from order if orderId or email is present
      const orderId = k.orderId || k.assignedTo?.orderId
      let order: any = null

      if (orderId) {
        try {
          if (ObjectId.isValid(orderId)) {
            order = await ordersCollection.findOne({ _id: new ObjectId(orderId) })
          }
        } catch (e) {
          // ignore
        }

        if (!order) {
          // try fallback shapes
          order = await ordersCollection.findOne({ id: orderId } as any) || await ordersCollection.findOne({ _id: orderId } as any)
        }
      }

      // If order found, extract customer email/name and createdAt
      if (order) {
        const customerEmail = order.customer?.email || order.shippingAddress?.email || k.email || null
        const customerName = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || null
        const orderNumber = order._id ? (order._id.toString ? order._id.toString() : order._id) : (order.id || orderId)

        out.assignedTo = out.assignedTo || {
          customerName,
          customerEmail,
          orderNumber
        }

        // compute expiresAt from order.createdAt + validity
        try {
          const createdRaw = order.createdAt || order.createdAt?.$date || order.createdAt
          const createdDate = createdRaw && createdRaw.$date ? new Date(createdRaw.$date) : new Date(createdRaw)
          let validityDays = null
          if (k.validityDays) validityDays = k.validityDays
          else if (k.validityYears) validityDays = k.validityYears * 365
          else if (k.validity) {
            // sometimes validity stored as string like '1 Year'
            const m = String(k.validity).match(/(\d+)/)
            if (m) validityDays = parseInt(m[1]) * 365
          }

          if (createdDate && validityDays) {
            const exp = new Date(createdDate)
            exp.setDate(exp.getDate() + Number(validityDays))
            out.expiresAt = exp.toISOString()
          }
        } catch (e) {
          // ignore date parse issues
        }
      }

      // fallback: ensure expiresAt is string if present
      if (out.expiresAt && out.expiresAt instanceof Date) out.expiresAt = out.expiresAt.toISOString()

      return out
    }))

    return NextResponse.json({
      success: true,
      keys: enriched
    })
  } catch (error) {
    console.error('Error fetching license keys:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch license keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { softwareId, keys } = body
    
    if (!softwareId || !keys || !Array.isArray(keys)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate maxDevices for each key
    const validatedKeys = keys.map(key => ({
      ...key,
      maxDevices: Math.max(1, parseInt(key.maxDevices) || 1) // Ensure at least 1 device
    }))
    
    const count = await addLicenseKeys(softwareId, validatedKeys)
    
    return NextResponse.json({
      success: true,
      message: `${count} license keys added successfully`
    })
  } catch (error: any) {
    console.error('Error adding license keys:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add license keys' },
      { status: 500 }
    )
  }
}

// Handle PATCH /api/software/license-keys (for revoking)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { keyId, action, reason } = body
    
    if (action === 'revoke') {
      // Require admin password for revoke operation
      const providedPassword = body.password
      const revokePassword = process.env.REVOKE_PASSWORD

      if (!revokePassword) {
        console.error('REVOKE_PASSWORD not configured in environment')
        return NextResponse.json({ success: false, error: 'Server not configured for revoke operation' }, { status: 500 })
      }

      if (!providedPassword || providedPassword !== revokePassword) {
        return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 })
      }

      const success = await revokeLicenseKey(keyId, reason || 'Revoked by admin')

      if (!success) {
        return NextResponse.json(
          { success: false, error: 'License key not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'License key revoked successfully'
      })
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating license key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update license key' },
      { status: 500 }
    )
  }
}

// Export DELETE handler for the root route
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Key ID is required' },
    { status: 400 }
  )
}
