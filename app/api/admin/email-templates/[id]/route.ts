import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json()
    const { db } = await connectToDatabase()
    const update = { ...body, updatedAt: new Date() }
    await db.collection('email_templates').updateOne({ _id: new ObjectId(id) }, { $set: update })
    const updated = await db.collection('email_templates').findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ id, ...updated })
  } catch (err) {
    console.error('PATCH /api/admin/email-templates/[id] error', err)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { db } = await connectToDatabase()
    await db.collection('email_templates').deleteOne({ _id: new ObjectId(id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/email-templates/[id] error', err)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
