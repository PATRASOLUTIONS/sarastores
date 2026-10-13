import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuthorization } from '@/lib/auth'
import { getCollection } from '@/lib/db-service'
import { encrypt } from '@/lib/encryption'
import { PartnerRazorpayUpdateSchema } from '@/lib/validation'
import { publicRazorpayIntegration, type RazorpayIntegration } from '@/lib/partner/razorpay-integration'
import type { Partner } from '@/lib/partner/types'
import { ObjectId, type Filter } from 'mongodb'
import { randomBytes } from 'node:crypto'

type Context = { params: Promise<{ partnerId: string }> }

function partnerFilter(id: string): Filter<Partner> {
  return ObjectId.isValid(id) ? { $or: [{ _id: new ObjectId(id) }, { id }] } : { id }
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await checkAdminAuthorization()
  if (!auth.authorized) return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: 401 }
  )
  try {
    const { partnerId } = await params
    const collection = await getCollection<Partner>('partners')
    const partner = await collection.findOne(partnerFilter(partnerId))
    if (!partner) return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } }, { status: 404 }
    )
    return NextResponse.json({ success: true, data: { razorpayIntegration: publicRazorpayIntegration(partner.razorpayIntegration) } })
  } catch (error) {
    console.error('[Razorpay Integration GET] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch integration settings' } }, { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await checkAdminAuthorization()
  if (!auth.authorized) return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: 401 }
  )
  try {
    const parsed = PartnerRazorpayUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid integration settings', details: parsed.error.flatten() } }, { status: 400 }
    )
    const { partnerId } = await params
    const collection = await getCollection<Partner>('partners')
    const partner = await collection.findOne(partnerFilter(partnerId))
    if (!partner) return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } }, { status: 404 }
    )
    const body = parsed.data
    const existing = partner.razorpayIntegration
    const credentials: NonNullable<RazorpayIntegration['credentials']> = {
      test: existing?.credentials?.test ? { ...existing.credentials.test } : undefined,
      live: existing?.credentials?.live ? { ...existing.credentials.live } : undefined,
    }
    for (const environment of ['test', 'live'] as const) {
      const input = body.credentials?.[environment]
      if (!input) continue
      const credential: NonNullable<NonNullable<RazorpayIntegration['credentials']>['test']> = { ...credentials[environment] }
      if (input.keyId) credential.keyId = input.keyId
      if (input.keySecret) {
        // Encryption must succeed before any database write can report success.
        const encrypted = encrypt(input.keySecret)
        credential.keySecretEnc = encrypted.ciphertext
        credential.keySecretIv = encrypted.iv
        credential.keySecretTag = encrypted.tag
      }
      credentials[environment] = credential
    }
    const integration: RazorpayIntegration = {
      enabled: body.enabled ?? existing?.enabled ?? false,
      paymentMode: body.paymentMode ?? existing?.paymentMode ?? 'wallet',
      commissionPercent: body.commissionPercent ?? existing?.commissionPercent ?? 0,
      allowedDomains: body.allowedDomains ?? existing?.allowedDomains ?? [],
      credentials,
      defaultEnvironment: body.defaultEnvironment ?? existing?.defaultEnvironment ?? 'test',
      webhookSecret: existing?.webhookSecret,
      razorpayAccountId: body.razorpayAccountId === null ? undefined : body.razorpayAccountId ?? existing?.razorpayAccountId,
      razorpayAccountStatus: existing?.razorpayAccountStatus ?? 'pending',
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    if (integration.enabled && !integration.webhookSecret) integration.webhookSecret = randomBytes(32).toString('hex')
    const result = await collection.updateOne({ _id: partner._id }, {
      $set: { razorpayIntegration: integration, updatedAt: new Date() },
    })
    if (!result.matchedCount) return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Partner no longer exists' } }, { status: 404 }
    )
    return NextResponse.json({
      success: true,
      message: 'Razorpay integration settings updated successfully',
      data: { razorpayIntegration: publicRazorpayIntegration(integration) },
    })
  } catch (error) {
    console.error('[Razorpay Integration PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update integration settings' } }, { status: 500 }
    )
  }
}
