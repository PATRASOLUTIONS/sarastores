/**
 * Partner Service
 * 
 * Core partner management operations
 */

import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { 
  Partner, 
  PartnerTier, 
  PartnerStatus,
  PartnerDocument,
  Address,
  BusinessType,
  PARTNER_COMMISSION_RATES 
} from './types';
import { generatePartnerAPIKey, updateAPIKeyTier } from './api-keys';
import { createWallet } from './wallet';

const PARTNERS_COLLECTION = 'partners';

// ============================================
// Partner CRUD Operations
// ============================================

export interface CreatePartnerInput {
  name: string;
  email: string;
  phone: string;
  website?: string;
  businessDetails: {
    gstin: string;
    pan: string;
    businessType: BusinessType;
    registeredAddress: Address;
  };
  contactPerson?: {
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
  };
  tier?: PartnerTier;
  commissionRate?: number;
}

/**
 * Create a new partner
 */
export async function createPartner(input: CreatePartnerInput): Promise<{
  partner: Partner;
  apiKey: string;
}> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  // Check if email already exists
  const existing = await collection.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new Error('A partner with this email already exists');
  }
  
  // Create wallet first
  const partnerId = new ObjectId().toString();
  const wallet = await createWallet(partnerId);
  
  // Determine tier and commission rate
  const tier = input.tier || 'starter';
  const commissionRate = input.commissionRate || PARTNER_COMMISSION_RATES[tier];
  
  const partner: Partner = {
    id: partnerId,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    website: input.website,
    businessDetails: input.businessDetails,
    contactPerson: input.contactPerson,
    tier,
    status: 'pending', // Requires admin approval
    permissions: {
      products: ['read'],
      orders: ['read', 'create'],
      wallet: ['read', 'request_payout'],
    },
    walletId: wallet.id,
    commissionRate,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
    verified: false,
    documents: [],
  };
  
  // Insert partner
  await collection.insertOne({
    ...partner,
    _id: new ObjectId(partnerId),
  });
  
  // Generate API key
  const { key } = await generatePartnerAPIKey(
    partnerId,
    'Default API Key',
    'test', // Start with test environment
    tier
  );
  
  return { partner, apiKey: key };
}

/**
 * Get partner by ID
 */
export async function getPartnerById(partnerId: string): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  let partner = null;
  
  try {
    partner = await collection.findOne({ _id: new ObjectId(partnerId) });
  } catch (e) {
    partner = await collection.findOne({ id: partnerId });
  }
  
  if (!partner) {
    return null;
  }
  
  return normalizePartner(partner);
}

/**
 * Get partner by email
 */
export async function getPartnerByEmail(email: string): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  const partner = await collection.findOne({ email: email.toLowerCase() });
  
  if (!partner) {
    return null;
  }
  
  return normalizePartner(partner);
}

/**
 * List all partners with filters
 */
export async function listPartners(options?: {
  status?: PartnerStatus;
  tier?: PartnerTier;
  verified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ partners: Partner[]; total: number }> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const filter: any = {};
  
  if (options?.status) {
    filter.status = options.status;
  }
  
  if (options?.tier) {
    filter.tier = options.tier;
  }
  
  if (options?.verified !== undefined) {
    filter.verified = options.verified;
  }
  
  if (options?.search) {
    filter.$or = [
      { name: { $regex: options.search, $options: 'i' } },
      { email: { $regex: options.search, $options: 'i' } },
      { 'businessDetails.gstin': { $regex: options.search, $options: 'i' } },
    ];
  }
  
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;
  
  const [partners, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  
  return {
    partners: partners.map(normalizePartner),
    total,
  };
}

/**
 * Update partner details
 */
export async function updatePartner(
  partnerId: string,
  updates: Partial<Pick<Partner, 'name' | 'phone' | 'website' | 'businessDetails' | 'contactPerson' | 'commissionRate'>>
): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(partnerId) },
    { 
      $set: { 
        ...updates,
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return null;
  }
  
  return normalizePartner(result);
}

/**
 * Update partner status
 */
export async function updatePartnerStatus(
  partnerId: string,
  status: PartnerStatus,
  adminId?: string
): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };
  
  // If activating, set verified
  if (status === 'active') {
    updateData.verified = true;
    updateData.verifiedAt = new Date();
    if (adminId) {
      updateData.verifiedBy = adminId;
    }
  }
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(partnerId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return null;
  }
  
  // If activating, generate live API key
  if (status === 'active') {
    await generatePartnerAPIKey(
      partnerId,
      'Live API Key',
      'live',
      result.tier
    );
  }
  
  return normalizePartner(result);
}

/**
 * Update partner tier
 */
export async function updatePartnerTier(
  partnerId: string,
  tier: PartnerTier,
  customCommissionRate?: number
): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const commissionRate = customCommissionRate || PARTNER_COMMISSION_RATES[tier];
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(partnerId) },
    { 
      $set: { 
        tier,
        commissionRate,
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return null;
  }
  
  // Update API key tiers
  await updateAPIKeyTier(partnerId, tier);
  
  return normalizePartner(result);
}

/**
 * Add document to partner
 */
export async function addPartnerDocument(
  partnerId: string,
  document: Omit<PartnerDocument, 'uploadedAt'>
): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const doc: PartnerDocument = {
    ...document,
    uploadedAt: new Date(),
  };
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(partnerId) } as any,
    { 
      $push: { documents: doc },
      $set: { updatedAt: new Date() }
    } as any,
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return null;
  }
  
  return normalizePartner(result);
}

/**
 * Verify partner document
 */
export async function verifyPartnerDocument(
  partnerId: string,
  documentType: string,
  adminId: string
): Promise<Partner | null> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(partnerId), 'documents.type': documentType },
    { 
      $set: { 
        'documents.$.verified': true,
        'documents.$.verifiedAt': new Date(),
        'documents.$.verifiedBy': adminId,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    return null;
  }
  
  return normalizePartner(result);
}

/**
 * Get partner statistics
 */
export async function getPartnerStats(): Promise<{
  total: number;
  active: number;
  pending: number;
  suspended: number;
  byTier: Record<PartnerTier, number>;
}> {
  const collection = await getCollection(PARTNERS_COLLECTION);
  
  const [total, active, pending, suspended, tierCounts] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ status: 'active' }),
    collection.countDocuments({ status: 'pending' }),
    collection.countDocuments({ status: 'suspended' }),
    collection.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 } } }
    ]).toArray(),
  ]);
  
  const byTier: Record<PartnerTier, number> = {
    starter: 0,
    growth: 0,
    professional: 0,
    enterprise: 0,
  };
  
  for (const tc of tierCounts) {
    if (tc._id && byTier.hasOwnProperty(tc._id)) {
      byTier[tc._id as PartnerTier] = tc.count;
    }
  }
  
  return { total, active, pending, suspended, byTier };
}

/**
 * Normalize partner document from database
 */
function normalizePartner(doc: any): Partner {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    website: doc.website,
    businessDetails: doc.businessDetails,
    contactPerson: doc.contactPerson,
    tier: doc.tier,
    status: doc.status,
    permissions: doc.permissions,
    walletId: doc.walletId,
    commissionRate: doc.commissionRate,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    lastActiveAt: new Date(doc.lastActiveAt),
    verified: doc.verified,
    verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt) : undefined,
    verifiedBy: doc.verifiedBy,
    documents: doc.documents || [],
    razorpayIntegration: doc.razorpayIntegration || undefined,
  };
}

// Export partner service
export const partnerService = {
  createPartner,
  getPartnerById,
  getPartnerByEmail,
  listPartners,
  updatePartner,
  updatePartnerStatus,
  updatePartnerTier,
  addPartnerDocument,
  verifyPartnerDocument,
  getPartnerStats,
};
