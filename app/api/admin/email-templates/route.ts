import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { db } = await connectToDatabase()
    const templates = await db.collection('email_templates').find({}).limit(100).toArray()
    const mapped = templates.map((t: any) => ({ id: String(t._id), ...t }))
    return NextResponse.json(mapped)
  } catch (err) {
    console.error('GET /api/admin/email-templates error', err)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await req.json()
    const { db } = await connectToDatabase()
    const now = new Date()
    const doc = { ...body, createdAt: now, updatedAt: now }
    const res = await db.collection('email_templates').insertOne(doc)
    const created = await db.collection('email_templates').findOne({ _id: res.insertedId })
    return NextResponse.json({ id: String(res.insertedId), ...created })
  } catch (err) {
    console.error('POST /api/admin/email-templates error', err)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
