import { NextResponse } from 'next/server'
import { addLicenseKeys, getAllLicenseKeys, revokeLicenseKey } from '@/lib/software-service'
import { requireAdmin } from '@/lib/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId, type WithId } from 'mongodb'
import { normalizeId } from '@/lib/db-service'
import { handleApiError } from '@/lib/api-error'
import { AddLicenseKeysSchema, RevokeLicenseKeySchema, LicenseKeyFilterSchema } from '@/lib/validation'
import type { StoredLicenseKey } from '@/types/software'
import { timingSafeEqual } from 'crypto'

/** Constant-time secret comparison; differing lengths short-circuit safely. */
function secretsMatch(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

type OrderDate = Date | string | number
interface LicenseOrder {
  _id: ObjectId | string
  id?: string
  customer?: { email?: string; name?: string; firstName?: string; lastName?: string }
  shippingAddress?: { email?: string }
  createdAt?: OrderDate | { $date: OrderDate }
}

export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const softwareId = searchParams.get('softwareId')
    const status = searchParams.get('status')
    const customerEmail = searchParams.get('customerEmail')
    
    const parsed = LicenseKeyFilterSchema.safeParse({
      softwareId: softwareId ?? undefined,
      status: status ?? undefined,
      customerEmail: customerEmail ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid license key filter' }, { status: 400 })
    
    const keys = await getAllLicenseKeys(parsed.data)

    // Enrich keys with order/customer info when assignedTo is missing
    const { db } = await connectToDatabase()
    const ordersCollection = db.collection<LicenseOrder>('orders')

    const enriched = await Promise.all(keys.map(async (k) => {
      // normalize id
      const out: Omit<StoredLicenseKey, '_id'> & { id: string } = normalizeId(k)

      // If assignedTo already present, ensure expiresAt is a string
      if (out.assignedTo) {
        if (out.expiresAt && out.expiresAt instanceof Date) out.expiresAt = out.expiresAt.toISOString()
        return out
      }

      // Try to populate from order if orderId or email is present
      const orderId = k.orderId || k.assignedTo?.orderId
      let order: WithId<LicenseOrder> | null = null

      if (orderId) {
        if (ObjectId.isValid(orderId)) {
          order = await ordersCollection.findOne({ _id: new ObjectId(orderId) })
        }

        if (!order) {
          // try fallback shapes
          order = await ordersCollection.findOne({ id: orderId }) || await ordersCollection.findOne({ _id: orderId })
        }
      }

      // If order found, extract customer email/name and createdAt
      if (order) {
        const customerEmail = order.customer?.email || order.shippingAddress?.email || k.email || null
        const customerName = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || null
        const orderNumber = order._id.toString()

        out.assignedTo = out.assignedTo || {
          customerName,
          customerEmail,
          orderNumber
        }

        // compute expiresAt from order.createdAt + validity
        if (order.createdAt !== undefined) {
          const createdRaw = order.createdAt
          const createdDate = new Date(typeof createdRaw === 'object' && '$date' in createdRaw ? createdRaw.$date : createdRaw)
          let validityDays = null
          if (k.validityDays) validityDays = k.validityDays
          else if (k.validityYears) validityDays = k.validityYears * 365
          else if (k.validity) {
            // sometimes validity stored as string like '1 Year'
            const m = String(k.validity).match(/(\d+)/)
            if (m) validityDays = parseInt(m[1]) * 365
          }

          if (Number.isFinite(createdDate.getTime()) && validityDays && Number.isFinite(Number(validityDays))) {
            const exp = new Date(createdDate)
            exp.setDate(exp.getDate() + Number(validityDays))
            if (Number.isFinite(exp.getTime())) out.expiresAt = exp.toISOString()
            else console.warn('[License keys] Invalid legacy expiry')
          } else {
            console.warn('[License keys] Invalid or missing legacy validity/date')
          }
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
    return handleApiError(error, 'Failed to fetch license keys')
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = AddLicenseKeysSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid license key input' },
        { status: 400 }
      )
    }
    
    const count = await addLicenseKeys(parsed.data.softwareId, parsed.data.keys)
    
    return NextResponse.json({
      success: true,
      message: `${count} license keys added successfully`
    })
  } catch (error) {
    return handleApiError(error, 'Failed to add license keys')
  }
}

// Handle PATCH /api/software/license-keys (for revoking)
export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = RevokeLicenseKeySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid revoke input' }, { status: 400 })
    const { keyId, action, reason, password: providedPassword } = parsed.data
    
    if (action === 'revoke') {
      // Require admin password for revoke operation
      const revokePassword = process.env.REVOKE_PASSWORD

      if (!revokePassword) {
        console.error('REVOKE_PASSWORD not configured in environment')
        return NextResponse.json({ success: false, error: 'Server not configured for revoke operation' }, { status: 500 })
      }

      // Compared in constant time so response latency cannot be used to
      // recover the secret character by character, matching how lib/session.ts
      // and the eXlr8 webhook verify their secrets.
      if (!secretsMatch(providedPassword, revokePassword)) {
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
