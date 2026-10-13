import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { 
  bulkAddLicenses, 
  getAvailableLicenseCount,
  getLicensesByEmail,
  revokeLicense,
  type SoftwareLicense,
} from '@/lib/license-service'
import { getCollection, normalizeId } from '@/lib/db-service'
import { ObjectId, type Filter } from 'mongodb'
import { z } from 'zod'

const LicenseUploadSchema = z.object({
  softwareId: z.string().refine(value => ObjectId.isValid(value), "Invalid software ID"),
  keys: z.array(z.string().trim().min(1).max(1000)).min(1).max(5000),
}).strict()

/**
 * GET /api/software-licenses
 * Query params:
 * - softwareId: Filter by software product
 * - email: Filter by customer email
 * - assigned: Filter by assignment status (true/false)
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const searchParams = request.nextUrl.searchParams
    const softwareId = searchParams.get('softwareId')
    const email = searchParams.get('email')
    const assigned = searchParams.get('assigned')
    const countOnly = searchParams.get('countOnly') === 'true'

    if (softwareId && !ObjectId.isValid(softwareId)) return NextResponse.json({ error: 'Invalid software ID' }, { status: 400 })
    if (assigned !== null && assigned !== 'true' && assigned !== 'false') {
      return NextResponse.json({ error: 'Invalid assigned filter' }, { status: 400 })
    }
    const collection = await getCollection<SoftwareLicense>('software_licenses')

    // Build query
    const query: Filter<SoftwareLicense> = {}
    
    if (softwareId) {
      query.softwareId = { $in: [new ObjectId(softwareId), softwareId] }
    }
    
    if (email) {
      query.email = email
    }
    
    if (assigned !== null && assigned !== undefined) {
      query.assigned = assigned === 'true'
    }

    // Return count only if requested
    if (countOnly) {
      const count = await collection.countDocuments(query)
      return NextResponse.json({ count })
    }

    // Return full license list
    const licenses = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    // Convert ObjectId to string for JSON serialization
    const serializedLicenses = licenses.map(license => ({
      ...normalizeId(license),
      softwareId: license.softwareId.toString(),
      orderId: license.orderId ? license.orderId.toString() : null
    }))

    return NextResponse.json(serializedLicenses)
  } catch (error) {
    console.error('Error fetching licenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch licenses' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/software-licenses
 * Body:
 * {
 *   softwareId: string,
 *   keys: string[]  // Array of license keys to add
 * }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = LicenseUploadSchema.safeParse(await request.json().catch(error => {
      console.warn('Invalid license upload JSON:', error)
      return null
    }))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid license upload' }, { status: 400 })
    const insertedCount = await bulkAddLicenses(parsed.data.softwareId, [...new Set(parsed.data.keys)])

    return NextResponse.json({
      success: true,
      message: `${insertedCount} license key(s) added successfully`,
      insertedCount
    })
  } catch (error) {
    console.error('Error adding licenses:', error)
    return NextResponse.json(
      { error: 'Failed to add licenses' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/software-licenses?licenseId={id}
 * Revoke/unassign a license
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const searchParams = request.nextUrl.searchParams
    const licenseId = searchParams.get('licenseId')

    if (!licenseId || !ObjectId.isValid(licenseId)) {
      return NextResponse.json(
        { error: 'licenseId is required' },
        { status: 400 }
      )
    }

    const success = await revokeLicense(licenseId)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'License revoked successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'License not found or already revoked' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error revoking license:', error)
    return NextResponse.json(
      { error: 'Failed to revoke license' },
      { status: 500 }
    )
  }
}
