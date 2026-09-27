/**
 * Partner API Key Management
 * 
 * Handles generation, validation, and management of partner API keys
 */

import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { 
  PartnerAPIKey, 
  PartnerTier, 
  APIKeyEnvironment, 
  Permission,
  RateLimitConfig,
  PARTNER_TIER_LIMITS 
} from './types';

const API_KEYS_COLLECTION = 'partner_api_keys';

// Encryption key — MUST be provided via environment. No insecure default.
const ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET || process.env.PARTNER_API_KEY_SECRET || '';
const ALGORITHM = 'aes-256-cbc';

/**
 * Derive a stable 32-byte key from the configured secret. Throws when the
 * secret is missing so we never silently encrypt with a guessable key.
 */
function getKeyBuffer(): Buffer {
  if (!ENCRYPTION_SECRET || ENCRYPTION_SECRET.length < 16) {
    throw new Error('API_KEY_ENCRYPTION_SECRET is not configured; refusing to handle partner keys.');
  }
  // SHA-256 always yields exactly 32 bytes regardless of secret length.
  return createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

/**
 * Encrypt API key for storage
 */
function encryptKey(key: string): { encrypted: string; iv: string } {
  const keyBuffer = getKeyBuffer();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

/**
 * Decrypt API key from storage
 */
function decryptKey(encrypted: string, ivHex: string): string {
  try {
    const keyBuffer = getKeyBuffer();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[API Keys] Decryption error:', error);
    return '';
  }
}

/**
 * Generate a new API key for a partner
 */
export async function generatePartnerAPIKey(
  partnerId: string,
  name: string,
  environment: APIKeyEnvironment,
  tier: PartnerTier
): Promise<{ key: string; apiKey: PartnerAPIKey }> {
  const prefix = `sk_${environment}_ptnr_`;
  const partnerIdShort = partnerId.slice(0, 6);
  const secret = randomBytes(32).toString('base64url');
  const fullKey = `${prefix}${partnerIdShort}_${secret}`;
  const hashedKey = createHash('sha256').update(fullKey).digest('hex');
  
  // Encrypt the full key for admin retrieval
  const { encrypted: encryptedKey, iv: encryptionIv } = encryptKey(fullKey);
  
  const apiKey: PartnerAPIKey = {
    id: new ObjectId().toString(),
    partnerId,
    name,
    hashedKey,
    encryptedKey, // Store encrypted version for admin access
    encryptionIv, // IV for decryption
    prefix: fullKey.slice(0, 20),
    environment,
    tier,
    permissions: getDefaultPermissions(),
    rateLimit: getRateLimits(tier),
    status: 'active',
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };
  
  // Store in database
  const collection = await getCollection(API_KEYS_COLLECTION);
  await collection.insertOne({
    ...apiKey,
    _id: new ObjectId(apiKey.id),
  });
  
  // Return full key only once - never stored in plain text
  return { key: fullKey, apiKey };
}

/**
 * Validate an API key and return the key data if valid
 */
export async function validateAPIKey(apiKey: string): Promise<PartnerAPIKey | null> {
  // Validate format
  if (!apiKey.startsWith('sk_live_ptnr_') && !apiKey.startsWith('sk_test_ptnr_')) {
    return null;
  }
  
  // Hash the key
  const hashedKey = createHash('sha256').update(apiKey).digest('hex');
  
  // Find in database
  const collection = await getCollection(API_KEYS_COLLECTION);
  const storedKey = await collection.findOne({ hashedKey });
  
  if (!storedKey) {
    return null;
  }
  
  // Check status
  if (storedKey.status !== 'active') {
    return null;
  }
  
  // Check expiration
  if (storedKey.expiresAt && new Date(storedKey.expiresAt) < new Date()) {
    return null;
  }
  
  // Update last used timestamp
  await collection.updateOne(
    { _id: storedKey._id },
    { $set: { lastUsedAt: new Date() } }
  );
  
  return {
    id: storedKey._id.toString(),
    partnerId: storedKey.partnerId,
    name: storedKey.name,
    hashedKey: storedKey.hashedKey,
    prefix: storedKey.prefix,
    environment: storedKey.environment,
    tier: storedKey.tier,
    permissions: storedKey.permissions || getDefaultPermissions(), // Fallback to defaults if missing
    rateLimit: storedKey.rateLimit || getRateLimits(storedKey.tier || 'free'), // Fallback to tier-based limits
    status: storedKey.status,
    allowedDomains: storedKey.allowedDomains || [],
    allowedMethods: storedKey.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    createdAt: new Date(storedKey.createdAt),
    lastUsedAt: new Date(storedKey.lastUsedAt),
    expiresAt: storedKey.expiresAt ? new Date(storedKey.expiresAt) : undefined,
  };
}

/**
 * Find API key by its hashed value
 */
export async function findAPIKeyByHash(hashedKey: string): Promise<PartnerAPIKey | null> {
  const collection = await getCollection(API_KEYS_COLLECTION);
  const storedKey = await collection.findOne({ hashedKey });
  
  if (!storedKey) {
    return null;
  }
  
  return {
    id: storedKey._id.toString(),
    partnerId: storedKey.partnerId,
    name: storedKey.name,
    hashedKey: storedKey.hashedKey,
    prefix: storedKey.prefix,
    environment: storedKey.environment,
    tier: storedKey.tier,
    permissions: storedKey.permissions || getDefaultPermissions(), // Fallback to defaults if missing
    rateLimit: storedKey.rateLimit || getRateLimits(storedKey.tier || 'free'), // Fallback to tier-based limits
    status: storedKey.status,
    allowedDomains: storedKey.allowedDomains || [],
    allowedMethods: storedKey.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    createdAt: new Date(storedKey.createdAt),
    lastUsedAt: new Date(storedKey.lastUsedAt),
    expiresAt: storedKey.expiresAt ? new Date(storedKey.expiresAt) : undefined,
  };
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string): Promise<boolean> {
  const collection = await getCollection(API_KEYS_COLLECTION);
  const result = await collection.updateOne(
    { _id: new ObjectId(keyId) },
    { 
      $set: { 
        status: 'revoked',
        revokedAt: new Date()
      } 
    }
  );
  return result.modifiedCount > 0;
}

/**
 * List API keys for a partner
 */
export async function listPartnerAPIKeys(partnerId: string): Promise<PartnerAPIKey[]> {
  const collection = await getCollection(API_KEYS_COLLECTION);
  const keys = await collection.find({ partnerId }).toArray();
  
  return keys.map(key => ({
    id: key._id.toString(),
    partnerId: key.partnerId,
    name: key.name,
    hashedKey: key.hashedKey,
    encryptedKey: key.encryptedKey,
    encryptionIv: key.encryptionIv,
    prefix: key.prefix,
    environment: key.environment,
    tier: key.tier,
    permissions: key.permissions || getDefaultPermissions(), // Fallback to defaults if missing
    rateLimit: key.rateLimit || getRateLimits(key.tier || 'free'), // Fallback to tier-based limits
    status: key.status,
    createdAt: new Date(key.createdAt),
    lastUsedAt: new Date(key.lastUsedAt),
    expiresAt: key.expiresAt ? new Date(key.expiresAt) : undefined,
  }));
}

/**
 * Update API key tier (when partner tier changes)
 */
export async function updateAPIKeyTier(partnerId: string, newTier: PartnerTier): Promise<void> {
  const collection = await getCollection(API_KEYS_COLLECTION);
  await collection.updateMany(
    { partnerId, status: 'active' },
    { 
      $set: { 
        tier: newTier,
        rateLimit: getRateLimits(newTier),
        updatedAt: new Date()
      } 
    }
  );
}

/**
 * Get default permissions for partner API keys
 */
function getDefaultPermissions(): Permission[] {
  return [
    { resource: 'products', actions: ['read'] },
    { resource: 'orders', actions: ['read', 'create', 'write'] },
    { resource: 'wallet', actions: ['read', 'write'] },
    { resource: 'razorpay', actions: ['read', 'create', 'write'] },
  ];
}

/**
 * Get rate limits based on tier
 */
function getRateLimits(tier: PartnerTier): RateLimitConfig {
  const limits = PARTNER_TIER_LIMITS[tier];
  return {
    requestsPerMinute: limits.requestsPerMinute,
    requestsPerDay: limits.requestsPerDay,
    burstLimit: limits.burstLimit,
  };
}

/**
 * Check if API key has permission for an action
 */
export function hasPermission(
  apiKey: PartnerAPIKey,
  resource: string,
  action: string
): boolean {
  // Safety check: if apiKey is null/undefined, deny access
  if (!apiKey) {
    console.error('[Partner API] API key is null or undefined');
    return false;
  }
  
  // Safety check: if permissions are undefined or empty, deny access
  if (!apiKey.permissions || !Array.isArray(apiKey.permissions)) {
    console.error('[Partner API] API key has no permissions defined:', apiKey.id);
    return false;
  }
  
  for (const permission of apiKey.permissions) {
    if (permission.resource === '*' || permission.resource === resource) {
      if (permission.actions.includes(action as any)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Decrypt a stored API key (for admin viewing)
 */
export function decryptAPIKey(encryptedKey: string, iv: string): string {
  return decryptKey(encryptedKey, iv);
}
