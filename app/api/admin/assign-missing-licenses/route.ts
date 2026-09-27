import { NextRequest, NextResponse } from 'next/server'
import { assignMissingLicenses } from '@/scripts/assign-missing-licenses'
import { checkAdminAuthorization } from '@/lib/auth'

/**
 * POST /api/admin/assign-missing-licenses
 * 
 * Retroactively assign license keys to orders that don't have them
 * 
 * Body (optional):
 * {
 *   daysBack: number  // Default: 30
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuthorization();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}))
    const daysBack = body.daysBack || 30

    console.log(`🔑 Starting retroactive license assignment via API`)
    console.log(`📅 Processing orders from the last ${daysBack} days`)

    // Run the assignment process
    const stats = await assignMissingLicenses(daysBack)

    // Return results
    return NextResponse.json({
      success: true,
      message: 'License assignment process completed',
      stats: {
        totalOrders: stats.totalOrders,
        ordersProcessed: stats.ordersProcessed,
        licensesAssigned: stats.licensesAssigned,
        emailsSent: stats.emailsSent,
        ordersMarkedDelivered: stats.ordersMarkedDelivered,
        errorsCount: stats.errors.length,
        errors: stats.errors
      }
    })

  } catch (error) {
    console.error('❌ Error in license assignment API:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to assign licenses',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/assign-missing-licenses
 * 
 * Check how many orders need license assignment (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('daysBack') || '30')

    const { connectDB } = await import('@/lib/db')
    const db = await connectDB()
    const ordersCollection = db.collection('orders')

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - daysBack)

    // Count orders needing licenses
    const ordersQuery: any = {
      'items.type': 'software',
      status: { $in: ['paid', 'confirmed', 'processing'] },
      $or: [
        { licenseKey: { $exists: false } },
        { licenseKey: null },
        { licenseKey: '' }
      ],
      createdAt: { $gte: dateThreshold }
    }

    const count = await ordersCollection.countDocuments(ordersQuery)

    return NextResponse.json({
      success: true,
      daysBack,
      ordersNeedingLicenses: count,
      message: count > 0 
        ? `${count} order(s) need license assignment` 
        : 'All orders have licenses assigned'
    })

  } catch (error) {
    console.error('❌ Error checking orders:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check orders',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
