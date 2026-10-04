/**
 * Partner Selling System - Type Definitions
 * 
 * Core types for the B2B partner API ecosystem
 */

// ============================================
// Partner Types
// ============================================

export type PartnerTier = 'starter' | 'growth' | 'professional' | 'enterprise';
export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'terminated';
export type BusinessType = 'sole_proprietorship' | 'partnership' | 'llp' | 'pvt_ltd' | 'public_ltd';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface PartnerDocument {
  type: 'gstin_certificate' | 'pan_card' | 'business_registration' | 'address_proof';
  url: string;
  verified: boolean;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  website?: string;

  // Business details
  businessDetails: {
    gstin: string;
    pan: string;
    businessType: BusinessType;
    registeredAddress: Address;
  };

  // Contact person
  contactPerson?: {
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
  };

  // API access
  tier: PartnerTier;
  status: PartnerStatus;

  // Permissions
  permissions: {
    products: ('read')[];
    orders: ('read' | 'create')[];
    wallet: ('read' | 'request_payout')[];
  };

  // Wallet reference
  walletId: string;

  // Commission settings
  commissionRate: number; // Percentage (e.g., 12 = 12%)

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;

  // Verification
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;

  // Documents
  documents: PartnerDocument[];

  // Razorpay Integration
  razorpayIntegration?: {
    enabled: boolean;
    paymentMode: 'wallet' | 'direct';
    commissionPercent: number;
    allowedDomains: string[];
    // Per-environment credentials, stored encrypted. Write-only in admin UI.
    credentials?: {
      test?: {
        keyId?: string;
        keySecretEnc?: string; // base64 ciphertext
        keySecretIv?: string; // base64 iv
        keySecretTag?: string; // base64 auth tag (for GCM)
      };
      live?: {
        keyId?: string;
        keySecretEnc?: string;
        keySecretIv?: string;
        keySecretTag?: string;
      };
    };
    // Default environment to use for partner operations when ambiguous
    defaultEnvironment?: 'test' | 'live';
    webhookSecret?: string;
    razorpayAccountId?: string;
    razorpayAccountStatus?: 'pending' | 'active' | 'inactive';
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// ============================================
// API Key Types
// ============================================

export type APIKeyEnvironment = 'live' | 'test';
export type APIKeyStatus = 'active' | 'revoked' | 'expired';

export interface PartnerAPIKey {
  id: string;
  partnerId: string;
  name: string;
  hashedKey: string;
  encryptedKey?: string; // Encrypted full key for admin access
  encryptionIv?: string; // IV for decryption
  prefix: string; // First 20 chars for identification
  maskedKey?: string; // Full masked key for display/copy (e.g., sk_test_ptnr_abc123_****)
  environment: APIKeyEnvironment;
  tier: PartnerTier;
  permissions: Permission[];
  rateLimit: RateLimitConfig;
  status: APIKeyStatus;
  allowedDomains?: string[]; // Whitelisted domains that can use this API key
  allowedMethods?: string[]; // Whitelisted HTTP methods for this API key
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
}

export interface Permission {
  resource: 'products' | 'orders' | 'wallet' | 'razorpay' | '*';
  actions: ('read' | 'create' | 'update' | 'delete' | 'write')[];
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  burstLimit: number;
}

// ============================================
// Wallet Types
// ============================================

export type TransactionType = 'credit' | 'debit' | 'hold' | 'release';
export type TransactionCategory =
  | 'order_commission'
  | 'payout'
  | 'refund_adjustment'
  | 'bonus'
  | 'penalty'
  | 'refund_hold'
  | 'dispute_hold'
  | 'hold_release';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'active' | 'released';
export type PayoutStatus = 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'rejected';

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  isDefault: boolean;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface PartnerWallet {
  id: string;
  partnerId: string;

  balance: {
    available: number;
    pending: number;
    held: number;
  };

  currency: 'INR';

  bankAccounts: BankAccount[];
  defaultBankAccountId?: string;

  minimumPayout: number;

  autoPayout: {
    enabled: boolean;
    threshold: number;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  partnerId: string;

  type: TransactionType;
  category: TransactionCategory;
  environment?: 'live' | 'test'; // Transaction environment

  amount: number;
  balanceAfter: number;

  orderId?: string;
  payoutId?: string;
  paymentReference?: string; // UTR, transaction ID, etc.
  paymentMethod?: string; // UPI, NEFT, IMPS, etc.

  description: string;
  notes?: string;

  status: TransactionStatus;

  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
}

export interface Payout {
  id: string;
  partnerId: string;
  walletId: string;

  amount: number;
  bankAccountId: string;
  bankAccount: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
  };

  status: PayoutStatus;

  notes?: string;
  adminNotes?: string;

  transactionId?: string; // Bank transaction reference

  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  processedAt?: Date;
  completedAt?: Date;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
}

// ============================================
// Order Types
// ============================================

export type PartnerOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface PartnerOrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface PartnerOrder {
  id: string;
  orderId: string; // Our internal order ID
  partnerId: string;
  partnerOrderId?: string; // Partner's internal reference

  customer: {
    name: string;
    email: string;
    phone: string;
    address: Address;
  };

  items: PartnerOrderItem[];

  summary: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };

  paymentMethod: 'prepaid' | 'cod';

  status: PartnerOrderStatus;
  statusHistory: {
    status: PartnerOrderStatus;
    timestamp: Date;
    details?: Record<string, any>;
  }[];

  commission: {
    rate: number;
    amount: number;
    status: 'pending' | 'credited' | 'adjusted';
  };

  tracking?: {
    carrier: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDelivery?: Date;
  };

  notes?: string;

  paymentDetails?: {
    razorpayOrderId?: string;
    transactionId?: string;
    method?: string;
    amount?: number;
  };

  paymentVerification?: {
    verified: boolean;
    verifiedAt?: Date;
    verifiedBy?: string;
  };

  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
}

// ============================================
// API Response Types
// ============================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================
// Rate Limit Types
// ============================================

export interface PartnerRateLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  burstLimit: number;
  ordersPerDay: number;
  productFetchLimit: number;
}

export const PARTNER_TIER_LIMITS: Record<PartnerTier, PartnerRateLimits> = {
  starter: {
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    burstLimit: 10,
    ordersPerDay: 50,
    productFetchLimit: 500,
  },
  growth: {
    requestsPerMinute: 300,
    requestsPerDay: 10000,
    burstLimit: 50,
    ordersPerDay: 500,
    productFetchLimit: 5000,
  },
  professional: {
    requestsPerMinute: 1000,
    requestsPerDay: 100000,
    burstLimit: 100,
    ordersPerDay: 2000,
    productFetchLimit: 50000,
  },
  enterprise: {
    requestsPerMinute: 5000,
    requestsPerDay: 1000000,
    burstLimit: 500,
    ordersPerDay: 10000,
    productFetchLimit: -1, // Unlimited
  },
};

export const PARTNER_COMMISSION_RATES: Record<PartnerTier, number> = {
  starter: 15,
  growth: 12,
  professional: 10,
  enterprise: 8, // Custom rates usually applied
};

// ============================================
// Error Codes
// ============================================

export const PARTNER_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: { status: 401, message: 'Authentication required' },
  INVALID_API_KEY: { status: 401, message: 'Invalid or expired API key' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  PARTNER_SUSPENDED: { status: 403, message: 'Partner account is suspended' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  VALIDATION_ERROR: { status: 400, message: 'Invalid request parameters' },
  RATE_LIMITED: { status: 429, message: 'Rate limit exceeded' },
  INSUFFICIENT_BALANCE: { status: 400, message: 'Insufficient wallet balance' },
  PRODUCT_OUT_OF_STOCK: { status: 400, message: 'Product is out of stock' },
  ORDER_NOT_CANCELLABLE: { status: 400, message: 'Order cannot be cancelled' },
  PAYOUT_LIMIT_EXCEEDED: { status: 400, message: 'Payout amount exceeds limits' },
  MINIMUM_PAYOUT_NOT_MET: { status: 400, message: 'Minimum payout amount not met' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
} as const;

// ============================================
// Admin Filter Types
// ============================================

export interface PartnerFilterParams {
  page?: number;
  limit?: number;
  status?: PartnerStatus;
  tier?: PartnerTier;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'tier' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderFilterParams {
  page?: number;
  limit?: number;
  status?: PartnerOrderStatus;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  partnerReference?: string;
  sortBy?: 'createdAt' | 'totalAmount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilterParams {
  page?: number;
  limit?: number;
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// API Key Permissions Type
// ============================================

export interface PartnerAPIKeyPermissions {
  products?: { read?: boolean };
  orders?: { read?: boolean; create?: boolean; cancel?: boolean };
  wallet?: { read?: boolean; payout?: boolean; update?: boolean };
  webhooks?: { read?: boolean; manage?: boolean };
}
