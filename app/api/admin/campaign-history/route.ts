import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { db } = await connectToDatabase()
    const history = await db
      .collection('campaign_history')
      .find({})
      .sort({ sentAt: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json(history)
  } catch (err) {
    console.error('Failed to fetch campaign history', err)
    return NextResponse.json([], { status: 500 })
  }
}
