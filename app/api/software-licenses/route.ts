import { NextRequest, NextResponse } from 'next/server'
import { 
  bulkAddLicenses, 
  getAvailableLicenseCount,
  getLicensesByEmail,
  revokeLicense 
} from '@/lib/license-service'
import { connectDB } from '@/lib/db'
import { ObjectId } from 'mongodb'

/**
 * GET /api/software-licenses
 * Query params:
 * - softwareId: Filter by software product
 * - email: Filter by customer email
 * - assigned: Filter by assignment status (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const softwareId = searchParams.get('softwareId')
    const email = searchParams.get('email')
    const assigned = searchParams.get('assigned')
    const countOnly = searchParams.get('countOnly') === 'true'

    const db = await connectDB()
    const collection = db.collection('software_licenses')

    // Build query
    const query: any = {}
    
    if (softwareId) {
      query.softwareId = new ObjectId(softwareId)
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
      ...license,
      _id: license._id.toString(),
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
  try {
    const body = await request.json()
    const { softwareId, keys } = body

    if (!softwareId || !keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: 'softwareId and keys array are required' },
        { status: 400 }
      )
    }

    // Validate that all keys are non-empty strings
    const validKeys = keys.filter(key => typeof key === 'string' && key.trim().length > 0)
    
    if (validKeys.length === 0) {
      return NextResponse.json(
        { error: 'No valid license keys provided' },
        { status: 400 }
      )
    }

    const insertedCount = await bulkAddLicenses(softwareId, validKeys)

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
  try {
    const searchParams = request.nextUrl.searchParams
    const licenseId = searchParams.get('licenseId')

    if (!licenseId) {
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
