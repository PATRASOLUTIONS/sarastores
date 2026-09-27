import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { CAMPAIGN_TEMPLATES } from '@/lib/marketing/campaigns'
import { applyCoupon } from '@/lib/marketing/email-layout'
import { requireAdmin } from '@/lib/auth'

export async function POST() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { db } = await connectToDatabase()
    const now = new Date()
    const docs = CAMPAIGN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      segments: t.segments,
      occasion: t.occasion ?? null,
      subject: t.subject,
      preheader: t.preheader,
      // Seeded without a coupon; the admin attaches a real one at send time.
      html: applyCoupon(t.html, null),
      whatsapp: t.whatsapp,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    }))
    // Only the built-in set is replaced; anything the admin authored is preserved.
    await db.collection('email_templates').deleteMany({ builtIn: true })
    const res = await db.collection('email_templates').insertMany(docs)
    return NextResponse.json({ inserted: res.insertedCount })
  } catch (err) {
    console.error('POST /api/admin/email-templates/seed error', err)
    return NextResponse.json({ error: 'Failed to seed templates' }, { status: 500 })
  }
}
