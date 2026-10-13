import { NextRequest, NextResponse } from 'next/server'
import { ObjectId, MongoServerError, type Filter } from 'mongodb'
import { requireAdmin } from '@/lib/auth'
import { getPartnerById } from '@/lib/partner/service'
import { getCollection } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import { PartnerProductAssignmentsSchema } from '@/lib/validation'
import { partnerCatalogSnapshot, type PartnerCatalogDocument } from '@/lib/partner/catalogue'
import type { PartnerProductAssignmentDocument } from '@/lib/partner/types'

type Context = { params: Promise<{ partnerId: string }> }
const COLLECTION = 'partner_products'
class AssignmentInputError extends Error {}
function assignmentFilter(partnerId: string, productId?: string): Filter<PartnerProductAssignmentDocument> {
  const ids = (id: string) => ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]
  return { partnerId: { $in: ids(partnerId) }, ...(productId ? { productId: { $in: ids(productId) } } : {}) }
}
function productFilter(ids: string[]): Filter<PartnerCatalogDocument> {
  return { $or: [
    { _id: { $in: ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
    { _id: { $in: ids } },
  ] }
}
function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: { code: status === 400 ? 'VALIDATION_ERROR' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', message } }, { status })
}

export async function GET(request: NextRequest, context: Context) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { partnerId } = await context.params
    if (!partnerId.trim() || partnerId.length > 100) return failure('Invalid partner ID', 400)
    const partner = await getPartnerById(partnerId)
    if (!partner) return failure('Partner not found', 404)
    const collection = await getCollection<PartnerProductAssignmentDocument>(COLLECTION)
    const assignments = await collection.find(assignmentFilter(partner.id)).toArray()
    const products = assignments.map(assignment => ({
      productId: assignment.productId.toString(), customPrice: assignment.customPrice,
      customCommission: assignment.customCommission, enabled: assignment.enabled !== false,
    }))
    const enabledIds = products.filter(product => product.enabled).map(product => product.productId)
    const catalog = await getCollection<PartnerCatalogDocument>('products')
    const details = enabledIds.length ? await catalog.find(productFilter(enabledIds)).toArray() : []
    return NextResponse.json({
      success: true,
      data: {
        partnerId: partner.id, products, total: products.length, enabledCount: enabledIds.length,
        enabledProductDetails: details.map(product => ({ ...partnerCatalogSnapshot(product), active: product.active !== false })),
      },
    })
  } catch (error) {
    console.error('[Admin Partner Products] Get error:', error)
    return failure('Failed to get product assignments', 500)
  }
}

export async function POST(request: NextRequest, context: Context) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { partnerId } = await context.params
    if (!partnerId.trim() || partnerId.length > 100) return failure('Invalid partner ID', 400)
    const parsed = PartnerProductAssignmentsSchema.safeParse(await request.json())
    if (!parsed.success) return failure(parsed.error.issues[0].message, 400)
    const partner = await getPartnerById(partnerId)
    if (!partner) return failure('Partner not found', 404)
    const collection = await getCollection<PartnerProductAssignmentDocument>(COLLECTION)
    const catalog = await getCollection<PartnerCatalogDocument>('products')
    const partners = await getCollection<{ _id?: ObjectId | string; id?: string; productAssignmentsRevision?: number; updatedAt?: Date }>('partners')
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const result = await session.withTransaction(async () => {
        const enabledIds = parsed.data.products.filter(product => product.enabled).map(product => product.productId)
        const available = enabledIds.length ? await catalog.find({ ...productFilter(enabledIds), active: true }, { session }).toArray() : []
        const found = new Set(available.map(product => product._id.toString()))
        if (enabledIds.some(id => !found.has(id))) throw new AssignmentInputError('Enabled products must exist and be active')
        const lock = await partners.updateOne({
          $or: [...(ObjectId.isValid(partner.id) ? [{ _id: new ObjectId(partner.id) }] : []), { _id: partner.id }, { id: partner.id }],
        }, { $inc: { productAssignmentsRevision: 1 }, $set: { updatedAt: new Date() } }, { session })
        if (!lock.matchedCount) throw new Error('Partner disappeared during assignment update')
        const operations = parsed.data.products.map(product => {
          const set: Partial<PartnerProductAssignmentDocument> = {
            partnerId: partner.id, productId: product.productId, enabled: product.enabled, updatedAt: new Date(),
          }
          const unset: { customPrice?: ''; customCommission?: '' } = {}
          for (const field of ['customPrice', 'customCommission'] as const) {
            if (product[field] === null) unset[field] = ''
            else if (product[field] !== undefined) set[field] = product[field]
          }
          return { updateOne: {
            filter: assignmentFilter(partner.id, product.productId),
            update: { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}), $setOnInsert: { createdAt: new Date() } },
            upsert: true,
          } }
        })
        if (operations.length) {
          const saved = await collection.bulkWrite(operations, { session, ordered: true })
          if (saved.matchedCount + saved.upsertedCount !== operations.length) throw new Error('Product assignment writes were not acknowledged')
        }
        const enabled = await collection.countDocuments({ ...assignmentFilter(partner.id), enabled: true }, { session })
        return { enabled }
      })
      if (!result) throw new Error('Product assignment transaction did not commit')
      return NextResponse.json({
        success: true, data: { partnerId: partner.id, updated: parsed.data.products.length, enabled: result.enabled },
        message: `Successfully updated ${parsed.data.products.length} product assignments`,
      })
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return failure('Invalid JSON body', 400)
    if (error instanceof AssignmentInputError) return failure(error.message, 400)
    if (error instanceof MongoServerError && error.code === 11000) return failure('Product assignment conflicted with another request; reload and retry', 409)
    console.error('[Admin Partner Products] Update error:', error)
    return failure('Failed to update product assignments', 500)
  }
}
