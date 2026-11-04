import { createHash } from 'node:crypto'
import type { ClientSession, Document } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { normalizeBlocklistMobile } from './blocklist-types'
import { DiwaliError } from './http'

export const DUPLICATE_REGISTRATION_MESSAGE = 'This mobile number or email address already has a Diwali registration. Check your gift status or contact SARA support.'

function identities(mobile: string, email?: string) {
  return { mobile: normalizeBlocklistMobile(mobile), email: email?.trim().toLowerCase() || '' }
}

export async function assertNewDiwaliRegistration(mobile: string, email?: string, session?: ClientSession) {
  const identity = identities(mobile, email), matches: Document[] = []
  if (identity.mobile) matches.push({ mobile: identity.mobile })
  if (identity.email) matches.push({ email: { $regex: `^\\s*${identity.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } })
  if (!matches.length) return
  const existing = await (await getCollection('diwali_claims')).findOne({ $or: matches }, { projection: { _id: 1 }, ...(session ? { session } : {}) })
  if (existing) throw new DiwaliError(DUPLICATE_REGISTRATION_MESSAGE, 409)
}

/** Unique MongoDB _ids serialize simultaneous submissions without changing historical claims. */
export async function reserveDiwaliRegistrationIdentity(claimId: string, mobile: string, email: string | undefined, session: ClientSession) {
  const identity = identities(mobile, email)
  const collection = await getCollection<Document & { _id: string }>('diwali_registration_identities')
  for (const [kind, value] of Object.entries(identity)) {
    if (!value) continue
    const digest = createHash('sha256').update(value).digest('hex')
    await collection.insertOne({ _id: `2026:${kind}:${digest}`, claimId, createdAt: new Date() }, { session })
  }
}
