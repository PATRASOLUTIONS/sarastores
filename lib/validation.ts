/**
 * Input Validation Schemas
 * 
 * Zod-based validation schemas for all user inputs
 * to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';
import { SaraCareInputFields } from '@/lib/sara-care-types';
import { checkoutCity } from './checkout-region';
import { isDpdpComplaint } from './complaintTypes';
import { indianStates } from './indiaData';
import { accountEmailSchema, registrationEmailSchema, registrationNameSchema } from './registration-validation';

// ============================================
// Common Validators
// ============================================

// Indian phone number (10 digits starting with 6-9)
export const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, 'Invalid phone number. Must be 10 digits starting with 6-9');

// Indian pincode (6 digits)
export const pincodeSchema = z.string()
  .regex(/^\d{6}$/, 'Invalid pincode. Must be 6 digits');

export const DeliveryLocationRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), consent: z.literal(true), adult: z.literal(true), version: z.string().max(100) }).strict(),
  z.object({ action: z.literal('resolve'), receipt: z.string().uuid(), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict(),
  z.object({ action: z.literal('withdraw'), receipt: z.string().uuid() }).strict(),
]);

export const PincodeModeSchema = z.enum(['blocked', 'allowed', 'both', 'all']);
export const PincodeListTypeSchema = z.enum(['allowed', 'blocked']);
export const PincodeEntrySchema = z.object({
  pincode: pincodeSchema,
  name: z.string().trim().max(200).default(''),
  state: z.string().trim().max(100).default(''),
}).strict();
const StoredPincodeSchema = z.object({
  pincode: z.string(),
  name: z.string().optional(),
  state: z.string().optional(),
  addedAt: z.string().optional(),
});
export const PincodeRestrictionsResponseSchema = z.object({
  mode: PincodeModeSchema.optional().default('blocked'),
  blockedPincodes: z.array(z.union([z.string(), StoredPincodeSchema])).optional().default([]),
  allowedPincodes: z.array(z.union([z.string(), StoredPincodeSchema])).optional().default([]),
});
export const PincodeMutationSchema = PincodeEntrySchema.extend({ listType: PincodeListTypeSchema });
export const PincodeModeMutationSchema = z.object({ mode: PincodeModeSchema }).strict();
export const DeletePincodeSchema = z.union([
  z.object({ pincode: pincodeSchema, listType: PincodeListTypeSchema }).strict(),
  z.object({ pincodes: z.array(pincodeSchema).min(1).max(20000), listType: PincodeListTypeSchema }).strict(),
  z.object({ clear: z.literal(true), listType: PincodeListTypeSchema }).strict(),
]);

export const InStoreOrderShortcutListSchema = z.array(z.object({
  paymentMethod: z.string().nullish(),
  paymentDetails: z.object({ verifiedEmail: z.string().nullish() }).nullish(),
}));

export const AdminCustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.string().optional(),
  phone: z.string().nullish().transform(value => value ?? undefined),
  address: z.string().nullish().transform(value => value ?? undefined),
  createdAt: z.string(),
});
const AdminCustomerListSchema = z.array(AdminCustomerSchema);
export const AdminCustomersResponseSchema = z.union([
  z.object({ items: AdminCustomerListSchema, total: z.number().int().nonnegative() }),
  AdminCustomerListSchema.transform(items => ({ items, total: items.length })),
]);
export const CustomerOrderSummarySchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullish(),
  total: z.number().finite().nonnegative(),
  status: z.string(),
  createdAt: z.string(),
});
export const CustomerOrderSummaryListSchema = z.array(CustomerOrderSummarySchema);

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email too long');

export const OrderNotificationSettingsSchema = z.object({
  enabled: z.boolean(),
  email: z.union([z.literal(""), emailSchema]).transform(value => value.toLowerCase()),
  additionalEmails: z.array(emailSchema.transform(value => value.toLowerCase()))
    .max(10, "Add at most 10 additional recipients").default([]),
}).strict().refine(value => !value.enabled || !!value.email, {
  message: "Enter a recipient email before enabling notifications",
  path: ["email"],
}).transform(value => ({
  ...value,
  additionalEmails: [...new Set(value.additionalEmails)].filter(email => email !== value.email),
}));

// Strong password
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Simple password (for optional requirements)
export const simplePasswordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password too long');

// Name validation
export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// URL validation
export const urlSchema = z.string()
  .url('Invalid URL')
  .max(2048, 'URL too long');

// Price validation
export const priceSchema = z.number()
  .positive('Price must be positive')
  .max(10000000, 'Price too high');

// Quantity validation
export const quantitySchema = z.number()
  .int('Quantity must be a whole number')
  .positive('Quantity must be positive')
  .max(1000, 'Maximum quantity exceeded');

export const CartQuantitySchema = z.union([
  z.number(), z.string().trim().regex(/^[1-9]\d*$/, 'Quantity must be a positive whole number').transform(Number),
]).pipe(quantitySchema);

const spinNumber = z.union([z.number(), z.string().trim().min(1)])
  .transform(Number).pipe(z.number().finite());
const spinDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid date');
const spinTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const SpinPrizeFieldsSchema = z.object({
  prizeName: z.string().trim().min(1).max(150),
  emoji: z.string().max(50).optional(),
  productImage: z.string().max(2000000).nullable().optional(),
  total: spinNumber.pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  isActive: z.boolean().optional(),
  dateRanges: z.array(z.object({ startDate: spinDate, endDate: spinDate }).strict()
    .refine(value => value.startDate <= value.endDate, 'Date range is reversed')).max(100).optional(),
  timeSlots: z.array(z.object({ startTime: spinTime, endTime: spinTime }).strict()
    .refine(value => value.startTime <= value.endTime, 'Time range is reversed')).max(100).optional(),
  weightMultiplier: spinNumber.pipe(z.number().positive()).optional(),
});
export const SpinPrizeCreateSchema = SpinPrizeFieldsSchema.extend({
  campaignId: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
}).strict();
export const SpinPrizeUpdateSchema = SpinPrizeFieldsSchema.partial().extend({
  prizeName: SpinPrizeFieldsSchema.shape.prizeName,
  campaignId: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
}).strict().refine(value => Object.keys(value).some(key => key !== 'prizeName' && key !== 'campaignId'), 'No fields to update');

export const PartnerOrderItemsSchema = z.array(z.object({
  productId: z.string().trim().min(1).max(100),
  quantity: quantitySchema,
})).min(1).max(100).superRefine((items, context) => {
  if (new Set(items.map(item => item.productId)).size !== items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate products must be combined into one item' });
  }
});
const partnerOrderReference = z.string().trim().min(1).max(100);
const partnerPaymentDetails = z.object({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
  transactionId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  method: z.string().max(40).optional(),
  paymentMethod: z.string().max(40).optional(),
  amount: priceSchema.optional(),
});
const partnerAddressFields = z.object({
  line1: z.string().trim().min(1).max(300),
  line2: z.string().trim().max(300).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: pincodeSchema.optional(),
  postalCode: pincodeSchema.optional(),
  country: z.string().trim().min(1).max(100).default('India'),
}).transform((address, context) => {
  const pincode = address.pincode || address.postalCode;
  if (!pincode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A valid pincode is required' });
    return z.NEVER;
  }
  return { ...address, pincode };
});
const partnerAddress = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  const parts = value.split(',').map(part => part.trim());
  if (parts.length < 3) return value;
  return {
    line1: value, city: parts[parts.length - 3], state: parts[parts.length - 2],
    pincode: parts[parts.length - 1].match(/\d{6}/)?.[0], country: 'India',
  };
}, partnerAddressFields);
const partnerCustomer = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  phone: z.string().trim().regex(/^\+?\d{10,15}$/),
  address: partnerAddress,
});
export const PartnerOrderCreateSchema = z.object({
  items: PartnerOrderItemsSchema,
  customer: partnerCustomer.optional(),
  customerDetails: partnerCustomer.optional(),
  partnerOrderId: partnerOrderReference.optional(),
  externalOrderId: partnerOrderReference.optional(),
  paymentMethod: z.string().max(40).optional(),
  paymentDetails: partnerPaymentDetails.optional(),
  notes: z.string().max(2000).optional(),
}).transform((body, context) => {
  const customer = body.customer || body.customerDetails;
  const method = (body.paymentMethod || body.paymentDetails?.paymentMethod || '').toLowerCase();
  const paymentMethod: 'prepaid' | 'cod' | undefined = method === 'razorpay' || method === 'stripe' || method === 'prepaid' ? 'prepaid'
    : method === 'cash' || method === 'cod' ? 'cod' : undefined;
  if (!customer || !paymentMethod || (paymentMethod === 'prepaid' && !body.paymentDetails)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid customer, paymentMethod and prepaid payment details are required' });
    return z.NEVER;
  }
  return {
    items: body.items, customer, paymentMethod, notes: body.notes,
    partnerOrderId: body.partnerOrderId || body.externalOrderId,
    paymentDetails: body.paymentDetails,
  };
});
export const PartnerPaymentCreateSchema = z.object({
  orderId: partnerOrderReference,
  items: PartnerOrderItemsSchema,
  amount: priceSchema.optional(),
  currency: z.literal('INR').default('INR'),
  receipt: z.string().trim().min(1).max(40).optional(),
  notes: z.record(z.string().max(256)).refine(notes => Object.keys(notes).length <= 12, 'Too many notes').optional(),
});
export const PartnerPaymentVerifySchema = z.object({
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});
export const PartnerOrderStatusSchema = z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']);
export const PartnerOrderListQuerySchema = z.object({
  status: PartnerOrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const PartnerOrderCancelSchema = z.object({ reason: z.string().trim().max(2000).optional() });
export const PartnerManualPaymentVerificationSchema = z.object({ verifiedBy: z.string().max(100).optional() });
export const ExternalOrderWebhookSchema = z.object({
  queueId: z.string().trim().min(1).max(150).optional(),
  externalOrderId: z.string().trim().min(1).max(150).optional(),
  orderId: z.string().trim().min(1).max(150).optional(),
  status: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{0,79}$/).default('updated'),
  message: z.string().max(2000).optional(),
  payload: z.unknown().optional(),
}).refine(body => Boolean(body.queueId || body.externalOrderId || body.orderId), 'An external order identifier is required');

const settingsText = z.string().nullish();
const settingsStatistic = z.union([z.string(), z.number().finite().transform(String)]).nullish();
const settingsNumeric = z.union([z.number(), z.string().trim().regex(/^(?:\d+(?:\.\d+)?|\.\d+)$/).transform(Number)]);
const settingsAmount = settingsNumeric.pipe(z.number().finite().nonnegative()).nullish();
export const StoreSettingsFieldsSchema = z.object({
  storeName: settingsText,
  legalName: settingsText,
  statYears: settingsStatistic,
  statStores: settingsStatistic,
  statCustomers: settingsStatistic,
  storeEmail: settingsText,
  storePhone: settingsText,
  storeAddress: settingsText,
  storeDescription: settingsText,
  brandLogo: settingsText,
  signature: settingsText,
  storefrontImage: settingsText,
  lifestyleImage: settingsText,
  landmarkImage: settingsText,
  primaryColor: settingsText,
  favicon: settingsText,
  currency: settingsText,
  taxRate: settingsNumeric.pipe(z.number().finite().min(0).max(100)).nullish(),
  gstNumber: settingsText,
  panNumber: settingsText,
  shippingFee: settingsAmount,
  freeShippingThreshold: settingsAmount,
  codAvailable: z.boolean().nullish(),
  estimatedDeliveryDays: settingsNumeric.pipe(z.number().finite().int().nonnegative()).nullish(),
  websiteUrl: settingsText,
  facebookUrl: settingsText,
  instagramUrl: settingsText,
  twitterUrl: settingsText,
  youtubeUrl: settingsText,
  whatsappNumber: settingsText,
  metaTitle: settingsText,
  metaDescription: settingsText,
});
export const StoreSettingsSchema = StoreSettingsFieldsSchema.passthrough().superRefine((settings, context) => {
  for (const key of Object.keys(settings)) {
    if (key.startsWith("$") || key.includes(".")) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Invalid settings field name" });
    }
  }
});
export type StoreSettings = z.infer<typeof StoreSettingsSchema>;
export type StoreSettingsFields = z.infer<typeof StoreSettingsFieldsSchema>;

export const PartnerTierSchema = z.enum(['starter', 'growth', 'professional', 'enterprise']);
export const PartnerStatusSchema = z.enum(['pending', 'active', 'suspended', 'terminated']);
export const PartnerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: PartnerStatusSchema.optional(),
  tier: PartnerTierSchema.optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['createdAt', 'name', 'tier', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export const RegisterPartnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: emailSchema,
  phone: z.string().trim().min(1).max(32),
  website: urlSchema.optional(),
  businessDetails: z.object({
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN format'),
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
    businessType: z.enum(['sole_proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd']),
    registeredAddress: z.object({
      line1: z.string().trim().min(1),
      line2: z.string().optional(),
      city: z.string().trim().min(1),
      state: z.string().trim().min(1),
      pincode: pincodeSchema,
      country: z.string().trim().min(1),
    }),
  }),
  contactPerson: z.object({
    name: z.string().trim().min(1),
    email: emailSchema.optional(),
    phone: z.string().min(1).max(32).optional(),
    designation: z.string().optional(),
  }).optional(),
  tier: PartnerTierSchema.default('starter'),
});
export const CreateAdminPartnerSchema = RegisterPartnerSchema.extend({
  name: z.string().trim().min(1).max(200).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  commissionRate: z.number().finite().min(0).max(100).optional(),
}).transform((value, context) => {
  const name = value.name ?? value.companyName;
  if (!name) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'name is required' });
    return z.NEVER;
  }
  return { ...value, name };
});
const partnerDomain = z.string().max(253).refine(value =>
  value === '*' || /^localhost(?::\d+)?$/.test(value) ||
  /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value),
  'Invalid domain format'
);
const partnerRazorpayCredentials = z.object({
  keyId: z.string().trim().optional(),
  keySecret: z.string().trim().optional(),
});
export const PartnerRazorpayUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  paymentMode: z.enum(['wallet', 'direct']).optional(),
  commissionPercent: z.number().finite().min(0).max(100).optional(),
  allowedDomains: z.array(partnerDomain).max(100).optional(),
  razorpayAccountId: z.string().nullish(),
  defaultEnvironment: z.enum(['test', 'live']).optional(),
  credentials: z.object({
    test: partnerRazorpayCredentials.optional(),
    live: partnerRazorpayCredentials.optional(),
  }).optional(),
});
export const UpdateAdminPartnerSchema = RegisterPartnerSchema.pick({
  name: true, phone: true, website: true,
}).partial().extend({
  status: PartnerStatusSchema.optional(),
  tier: PartnerTierSchema.optional(),
  commissionRate: z.number().finite().min(0).max(100).optional(),
  businessDetails: RegisterPartnerSchema.shape.businessDetails.partial().optional(),
  gstin: RegisterPartnerSchema.shape.businessDetails.shape.gstin.optional(),
  pan: RegisterPartnerSchema.shape.businessDetails.shape.pan.optional(),
  businessType: RegisterPartnerSchema.shape.businessDetails.shape.businessType.optional(),
  registeredAddress: RegisterPartnerSchema.shape.businessDetails.shape.registeredAddress.optional(),
  contactPerson: RegisterPartnerSchema.shape.contactPerson.unwrap().partial().optional(),
});
export const SpinOtpRequestSchema = z.object({
  phone: z.string().transform(value => value.replace(/\D/g, "").slice(-10)).pipe(phoneSchema),
  email: emailSchema.transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(200),
  senderNumber: z.string().trim().optional(),
  campaignId: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
});
export const SpinOtpDeliveryResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().min(1),
  expiresIn: z.number().int().positive(),
  delivery: z.object({ email: z.boolean(), whatsapp: z.boolean() })
    .refine(value => value.email || value.whatsapp, "No channel accepted the OTP"),
});
export const SpinPrizeListResponseSchema = z.object({
  inventory: z.array(z.object({
    prizeName: z.string().min(1),
    emoji: z.string().nullish().transform(value => value || "🎁"),
    productImage: z.string().nullish().transform(value => value ?? ""),
    isActive: z.boolean().default(true),
  })),
});

const licenseKeyIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid license identifier');
export const AddLicenseKeysSchema = z.object({
  softwareId: licenseKeyIdSchema,
  keys: z.array(z.object({
    key: z.string().trim().min(1),
    validityYears: z.coerce.number().int().min(1).max(5),
    maxDevices: z.coerce.number().int().min(1).default(1),
  })).min(1),
});
export const RevokeLicenseKeySchema = z.object({
  keyId: licenseKeyIdSchema,
  action: z.literal('revoke'),
  reason: z.string().trim().min(1).optional(),
  password: z.string().min(1),
});
export const LicenseKeyFilterSchema = z.object({
  softwareId: licenseKeyIdSchema.optional(),
  status: z.enum(['available', 'assigned', 'expired', 'revoked']).optional(),
  customerEmail: emailSchema.optional(),
});

// ============================================
// Authentication Schemas
// ============================================

export const LoginSchema = z.object({
  email: accountEmailSchema,
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

export const RegisterSchema = z.object({
  email: registrationEmailSchema,
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string(),
  name: registrationNameSchema,
  /** The web registration form requests an immediate cookie session. */
  startSession: z.boolean().optional().default(false),
  // Not collected at signup; the checkout form captures it.
  phone: phoneSchema.optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
  // Separate from acceptTerms: DPDP Section 6(1) consent must be "informed",
  // which means acknowledging the privacy notice is its own affirmative act.
  acceptPrivacyNotice: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm you have read the privacy notice' }),
  }),
  /**
   * Marketing consent is optional and defaults to false. Making it a condition
   * of registration would make the consent neither free nor unconditional,
   * which Section 6(1) forbids.
   */
  marketingEmail: z.boolean().optional().default(false),
  marketingWhatsapp: z.boolean().optional().default(false),
  marketingSms: z.boolean().optional().default(false),
  /** Echoed back so the consent record names the exact notice shown. */
  noticeVersion: z.string().max(50).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ForgotPasswordSchema = z.object({
  email: accountEmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// ============================================
// User Profile Schemas
// ============================================

export const dateOfBirthSchema = z.string().refine(value => {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10);
}, 'Enter a valid date of birth');

export const UpdateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  avatar: z.string().max(200000).refine(value =>
    /^\/api\/avatars\/(?:[1-9]|1\d|20)$/.test(value) ||
    /^data:image\/webp;base64,UklGR[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    (value.startsWith('https://') && urlSchema.safeParse(value).success),
    'Choose a profile avatar or upload a photo').optional(),
});

export const AccountProfileSchema = UpdateProfileSchema.pick({ name: true, dateOfBirth: true, avatar: true }).extend({
  phone: z.union([z.literal(''), phoneSchema]).optional(),
});

// Marketing consent. Every field is optional so a customer can toggle one channel
// without the request implying anything about the others.
export const UpdateConsentSchema = z.object({
  email: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  sms: z.boolean().optional(),
}).refine(
  (value) => Object.values(value).some((v) => typeof v === 'boolean'),
  { message: 'At least one channel must be provided' },
);

export const UnsubscribeSchema = z.object({
  token: z.string().min(20, 'Invalid token').max(200, 'Invalid token'),
  channel: z.enum(['email', 'whatsapp', 'sms', 'all']).default('all'),
});

export const AddressSchema = z.object({
  type: z.enum(['home', 'work', 'other']).default('home'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: phoneSchema,
  address: z.string().min(10, 'Address must be at least 10 characters').max(200),
  apartment: z.string().max(100).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2, 'City is required').max(50),
  state: z.string().min(2, 'State is required').max(50),
  pincode: pincodeSchema,
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

export const CheckoutFirstNameSchema = z.string().trim().min(1, 'First name is required')
  .pipe(registrationNameSchema).pipe(z.string().max(50, 'First name must be 50 characters or fewer'));
export const CheckoutLastNameSchema = z.string().trim().min(1, 'Last name is required')
  .pipe(registrationNameSchema).pipe(z.string().max(50, 'Last name must be 50 characters or fewer'));
export const CheckoutContactSchema = z.object({
  firstName: CheckoutFirstNameSchema,
  lastName: CheckoutLastNameSchema,
  email: registrationEmailSchema,
  phone: z.string().trim().min(1, 'Phone number is required').pipe(phoneSchema),
});

export const SavedDeliveryAddressSchema = AddressSchema.pick({
  type: true, firstName: true, lastName: true, phone: true, address: true,
  city: true, state: true, pincode: true, country: true,
}).extend({
  firstName: CheckoutFirstNameSchema,
  address: z.string().trim().min(10, 'Address must be at least 10 characters').max(200),
  // Existing saved addresses may omit a surname; checkout contact validation
  // asks the shopper to supply it before using the address for a new order.
  lastName: z.union([z.literal(''), CheckoutLastNameSchema]).default(''),
  phone: z.string().trim().pipe(phoneSchema),
  pincode: z.string().trim().pipe(pincodeSchema),
  city: z.string().trim().min(2, 'City is required').max(50).transform(value => checkoutCity(value) || value),
  state: z.string().trim()
    .transform(value => indianStates.find(state => state.toLowerCase() === value.toLowerCase()) || value)
    .refine(value => indianStates.includes(value), 'Choose a valid Indian state or union territory'),
  country: z.literal('India').default('India'),
});

export type SavedDeliveryAddress = z.infer<typeof SavedDeliveryAddressSchema> & { id: string };

// ============================================
// Product Schemas
// ============================================

export const ProductVariantSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().min(1).max(50),
  price: priceSchema,
  compareAtPrice: priceSchema.optional(),
  quantity: quantitySchema,
  attributes: z.record(z.string()).optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters').max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional(),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  shortDescription: z.string().max(500).optional(),
  sku: z.string().min(1).max(50),
  price: priceSchema,
  compareAtPrice: priceSchema.optional(),
  costPrice: priceSchema.optional(),
  categoryId: z.string().min(1, 'Category is required'),
  subCategoryId: z.string().optional(),
  brand: z.string().max(100).optional(),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
  images: z.array(urlSchema).min(1, 'At least one image is required').max(10),
  quantity: quantitySchema,
  lowStockThreshold: z.number().int().min(0).default(10),
  trackInventory: z.boolean().default(true),
  variants: z.array(ProductVariantSchema).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  specifications: z.record(z.string()).optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const DirectProductUpdateSchema = UpdateProductSchema.pick({
  name: true, price: true, description: true, sku: true, status: true,
  brand: true, tags: true, specifications: true, slug: true,
}).extend({
  comparePrice: priceSchema.optional(),
  stock: z.number().int().min(0).max(10000000).optional(),
  maxPurchaseQuantity: quantitySchema.optional(),
  category: z.string().max(200).optional(),
  subcategory: z.string().max(200).optional(),
  images: z.array(urlSchema).max(5).optional(),
  hsnCode: z.string().max(100).optional(),
  warranty: z.string().max(1000).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'No valid fields provided');

export const SeedDatabaseRequestSchema = z.object({
  apply: z.boolean().default(false),
}).strict();

export const SeedCatalogueSchema = z.array(z.record(
  z.union([z.string().max(100000), z.number().finite(), z.boolean(), z.null()]),
).superRefine((row, context) => {
  for (const field of ['In Stock', 'MRP']) {
    const value = row[field];
    if (value === undefined || value === null || value === '') continue;
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(number) || number < 0 || number > 10000000 || (field === 'In Stock' && !Number.isInteger(number))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Invalid ${field} in seed catalogue` });
    }
  }
})).min(1).max(5000);

export const SpecificationUpdateSchema = z.object({
  name: z.string().max(500),
  mrp: z.number().finite().min(0).max(10000000).nullable(),
  description: z.string().max(100000),
  overview: z.string().max(100000),
  technical_details: z.record(z.string().max(10000)),
  from_manufacturer: z.string().max(500000),
  specification_images: z.array(urlSchema).max(100),
  product_id: z.string().max(200).nullable(),
  locked: z.boolean(),
  category: z.string().max(200),
  subCategory: z.string().max(200),
  included_components: z.array(z.string().max(1000)).max(100),
  features: z.array(z.string().max(10000)).max(100),
  reviews: z.array(z.object({
    rating: z.number().min(0).max(5).nullable(),
    title: z.string().max(1000),
    text: z.string().max(10000),
  })).max(100),
  isSynced: z.boolean(),
  prod_desc: z.string().max(500),
  group_name: z.string().max(500),
  char_desc: z.string().max(500),
  manufacturer_name: z.string().max(500),
}).partial().strict().refine(value => Object.keys(value).length > 0, 'Provide a specification update');

// ============================================
// Order Schemas
// ============================================

export const OrderItemSchema = z.object({
  ...SaraCareInputFields,
  productId: z.string().trim().min(1, 'Product ID is required').max(200),
  variantId: z.string().optional(),
  quantity: quantitySchema,
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Cart cannot be empty'),
  shippingAddressId: z.string().optional(),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  sameAsBilling: z.boolean().default(true),
  paymentMethod: z.enum(['razorpay', 'cod', 'upi', 'netbanking', 'wallet']),
  couponCode: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  giftMessage: z.string().max(200).optional(),
  isGift: z.boolean().default(false),
}).refine(
  (data) => data.shippingAddressId || data.shippingAddress,
  { message: 'Shipping address is required', path: ['shippingAddress'] }
);

export const GuestCheckoutCustomerSchema = CheckoutContactSchema.extend({
  address: z.string().trim().min(10, 'Enter your full address').max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  zipCode: z.string().trim().pipe(pincodeSchema),
  country: z.string().trim().min(1, 'Country is required').max(100),
});

export const CheckoutCartSelectionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['preserve', 'include', 'wishlist']),
  items: z.array(z.object({
    ...SaraCareInputFields,
    id: z.string().min(1), name: z.string(), price: z.number().finite().nonnegative(),
    quantity: quantitySchema, image: z.string().default(''),
    color: z.string().nullable().default(null), size: z.string().nullable().default(null),
    type: z.enum(['hardware', 'software', 'service']).optional(),
  }).passthrough()).min(1).max(40),
  previousItems: z.array(z.object({ id: z.string().min(1), quantity: quantitySchema,
    ...SaraCareInputFields,
    sku: z.string().nullish(), variantId: z.string().nullish(), color: z.string().nullish(), size: z.string().nullish(),
    ram: z.string().nullish(), storage: z.string().nullish(), type: z.string().nullish(),
    kgenVariantId: z.string().nullish(), packSize: z.union([z.string(), z.number()]).nullish(),
    validityYears: z.union([z.string(), z.number()]).nullish(),
  })).max(80),
});

export const EmployeeCreationResponseSchema = z.object({
  success: z.literal(true),
  employeeId: z.string().min(1),
  userId: z.string().min(1),
  temporaryPassword: z.string().min(16).optional(),
});

export const EmployeeResponseSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string(),
  name: z.string(),
  email: z.string().email(),
  department: z.string().default(""),
  role: z.string().default("Staff"),
  status: z.enum(["active", "inactive"]).default("active"),
  dashboardAccess: z.boolean().default(false),
  allowedPages: z.array(z.string()).default([]),
  storeAccess: z.enum(["none", "selected", "all"]).default("none"),
  storeIds: z.array(z.string()).default([]),
  createdAt: z.union([z.string(), z.date()]).transform(value => value instanceof Date ? value.toISOString() : value),
  updatedAt: z.union([z.string(), z.date()]).transform(value => value instanceof Date ? value.toISOString() : value),
});
export const EmployeeListResponseSchema = z.array(EmployeeResponseSchema);

export const CreateLeadSchema = z.object({
  name: z.string().trim().min(3).max(100),
  phone: z.string().transform(value => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{10}$/)),
  pincode: z.string().trim().pipe(pincodeSchema),
  email: z.union([z.literal(""), emailSchema]).optional().default(""),
  category: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(200).optional().default("Shubham Lucky Draw"),
});

export const UpdateLeadSchema = CreateLeadSchema.partial().omit({ pincode: true }).extend({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid lead ID'),
  status: z.enum(["new", "contacted", "interested", "converted", "closed"]).optional(),
  city: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
}).strict().refine(value => Object.keys(value).length > 1, 'Provide a lead update');

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
    'returned',
  ]),
  notes: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(50).optional(),
});

export const AdminOrderUpdateSchema = UpdateOrderStatusSchema.extend({
  status: UpdateOrderStatusSchema.shape.status.optional(),
  trackingNumber: z.string().trim().min(1).max(100).optional(),
  cancellation: z.object({
    reason: z.string().trim().min(1).max(500),
    note: z.string().max(1000).optional(),
    date: z.string().datetime().optional(),
    refundStatus: z.literal('pending').optional(),
  }).strict().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Provide an order update')
  .refine(value => !value.cancellation || value.status === 'cancelled', 'Cancellation requires cancelled status');
export const BulkOrderUploadSchema = z.object({
  rows: z.array(UpdateOrderStatusSchema.pick({ status: true, trackingNumber: true }).extend({
    orderId: z.string().trim().min(1).max(100)
      .transform(value => /^[a-f\d]{24}$/i.test(value) ? value.toLowerCase() : value),
  }).strict()).min(1).max(100)
    .refine(rows => new Set(rows.map(row => row.orderId)).size === rows.length, "Order IDs must be unique"),
}).strict();
export const DebugCartRecoverySchema = z.object({ dryRun: z.boolean().default(true) }).strict();

// ============================================
// Review Schemas
// ============================================

export const StoreQrTypeSchema = z.enum(["google_maps", "whatsapp", "instagram"]);
export const StoreObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid store or QR ID")
  .transform(value => value.toLowerCase());
export const StoreHttpUrlSchema = z.string().trim().max(2048).url().refine(value => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "URL must use HTTP(S) without credentials");
export const CreateStoreQrSchema = z.object({
  storeId: StoreObjectIdSchema,
  storeName: z.string().trim().max(200).optional(),
  type: StoreQrTypeSchema,
  label: z.string().trim().max(200).default(""),
  targetUrl: StoreHttpUrlSchema,
}).strict();
export const UpdateStoreQrSchema = CreateStoreQrSchema.pick({ storeName: true, label: true, targetUrl: true })
  .partial().extend({ isActive: z.boolean().optional() }).strict()
  .refine(value => Object.keys(value).length > 0, "Provide a QR update");
export const BulkStoreQrSchema = z.object({
  storeIds: z.array(StoreObjectIdSchema).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length, "Store IDs must be unique"),
}).strict();
export const StoreQrAnalyticsQuerySchema = z.object({
  range: z.enum(["all", "7d", "30d", "90d", "1y"]).default("all"),
  storeId: StoreObjectIdSchema.optional(),
}).strict();
export const CreateStoreLocationSchema = z.object({
  locationType: z.enum(["store", "warehouse"]).optional(),
  shopName: z.string().trim().min(1).max(200),
  storeCode: z.string().trim().max(50, "Store code must be 50 characters or fewer").optional(),
  locationDescription: z.string().trim().max(2000).default(""),
  googleMapLocation: z.union([StoreHttpUrlSchema, z.literal("")]).default(""),
  mobileNo: z.string().trim().max(30).default(""),
  shopTiming: z.string().trim().max(200).default("9:00 AM - 9:00 PM"),
  shopImage: z.string().trim().max(2_000_000).default(""),
  emailId: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  isActive: z.boolean().default(true),
}).strict();
export const UpdateStoreLocationSchema = CreateStoreLocationSchema.partial().strict()
  .refine(value => Object.keys(value).length > 0, "Provide a store update");
export const BulkStoreLocationSchema = z.object({
  stores: z.array(CreateStoreLocationSchema).min(1).max(500)
    .refine(stores => new Set(stores.map(store => store.shopName)).size === stores.length, "Shop names must be unique in an upload")
    .refine(stores => {
      const codes = stores.flatMap(store => store.storeCode ? [store.storeCode] : [])
      return new Set(codes).size === codes.length
    }, "Store codes must be unique in an upload"),
}).strict();
export const PartnerProductAssignmentSchema = z.object({
  productId: z.string().trim().min(1).max(100).transform(value => /^[a-f\d]{24}$/i.test(value) ? value.toLowerCase() : value),
  enabled: z.boolean(),
  customPrice: z.number().finite().min(0).max(10_000_000).nullable().optional(),
  customCommission: z.number().finite().min(0).max(100).nullable().optional(),
}).strict();
export const PartnerProductAssignmentsSchema = z.object({
  products: z.array(PartnerProductAssignmentSchema).max(5000)
    .refine(products => new Set(products.map(product => product.productId)).size === products.length, "Product IDs must be unique"),
}).strict();
export const PosterSettingsWriteSchema = z.object({
  enabled: z.array(z.string().min(1).max(100)).max(100)
    .refine(slugs => new Set(slugs).size === slugs.length, "Poster selections must be unique"),
  links: z.record(z.object({
    href: z.string().trim().min(1).max(2048)
      .refine(value => value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(value), "Poster link must be a site-relative path"),
    feature: z.object({
      type: z.enum(["product", "category", "subcategory"]),
      id: z.string().trim().min(1).max(100),
    }).strict().optional(),
  }).strict()),
}).strict();

export const ReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  orderId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().trim().min(20, 'Review must be at least 20 characters').max(2000),
  images: z.array(urlSchema).max(5).optional(),
  pros: z.array(z.string().max(100)).max(5).optional(),
  cons: z.array(z.string().max(100)).max(5).optional(),
  isVerifiedPurchase: z.boolean().default(false),
});

export const UpdateReviewSchema = ReviewSchema.pick({
  rating: true, title: true, content: true, images: true, pros: true, cons: true,
}).partial().refine(value => Object.keys(value).length > 0, 'Provide at least one review field');

// ============================================
// Contact & Support Schemas
// ============================================

export const ContactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(20, 'Message must be at least 20 characters').max(2000),
  orderNumber: z.string().max(50).optional(),
  category: z.enum([
    'general',
    'order',
    'product',
    'shipping',
    'returns',
    'payment',
    'technical',
    'feedback',
    'other',
  ]).default('general'),
});

export const ContactInquirySchema = ContactFormSchema.pick({ name: true, email: true }).extend({
  name: z.string().trim().min(1, 'Please enter your name').max(100),
  email: z.string().trim().toLowerCase().pipe(emailSchema),
  phone: z.string().transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10}$/, 'Please enter a 10-digit phone number')),
  company: z.string().trim().max(150).optional(),
  enquiryType: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  message: z.string().trim().max(5000).optional(),
  consent: z.boolean().optional(),
  source: z.enum(['contact_page']).optional(),
}).superRefine((data, context) => {
  if (data.source !== 'contact_page') return;
  for (const field of ['company', 'enquiryType', 'city', 'message'] as const) {
    if (!data[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Please fill in all required fields' });
  }
  if (data.consent !== true) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['consent'], message: 'Please accept the Terms & Conditions and Privacy Policy' });
  }
});

export const AccountEnquirySchema = ContactFormSchema.pick({ subject: true, message: true, category: true, orderNumber: true }).extend({
  phone: phoneSchema,
});

export const ComplaintSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  type: z.enum([
    'product_quality',
    'wrong_product',
    'missing_item',
    'damaged',
    'late_delivery',
    'billing',
    'other',
  ]),
  description: z.string().min(20).max(2000),
  images: z.array(urlSchema).max(5).optional(),
  preferredResolution: z.enum([
    'refund',
    'replacement',
    'repair',
    'credit',
    'other',
  ]).optional(),
});

export const ComplaintStatusSchema = z.enum([
  'pending', 'processing', 'refund_initiated', 'no_refund', 'resolved', 'revoked',
]);

export const UpdateComplaintSchema = z.object({
  status: ComplaintStatusSchema,
  adminNote: z.string().trim().max(5000).optional(),
}).strict();

export const ComplaintEmailSchema = z.object({
  to: z.string().trim().pipe(emailSchema),
  templateId: z.enum([
    'COMPLAINT_SUBMITTED', 'COMPLAINT_PROCESSING', 'COMPLAINT_REFUND_INITIATED',
    'COMPLAINT_NO_REFUND', 'COMPLAINT_RESOLVED', 'COMPLAINT_REVOKED',
  ]),
  data: z.object({
    complaintId: z.string().min(1).max(100),
    customerName: z.string().min(1).max(100),
    orderNumber: z.string().max(100).nullish(),
    subject: z.string().min(1).max(250),
    adminNote: z.string().max(5000).optional(),
  }),
}).strict();

export const CreateComplaintSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  email: z.string().trim().pipe(emailSchema),
  phone: z.string().trim().max(30).optional(),
  orderNumber: z.string().trim().max(100).optional(),
  complaintType: z.enum([
    'defective', 'breakage', 'return', 'enquiry', 'wrong_item', 'missing_item', 'other',
    'data_access', 'data_correction', 'data_erasure', 'consent_withdrawal', 'data_privacy_other',
  ]),
  subject: z.string().trim().min(1).max(250),
  description: z.string().trim().min(1).max(10000),
  productName: z.string().trim().max(250).optional(),
  images: z.array(z.string().max(7 * 1024 * 1024)
    .regex(/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Invalid image'))
    .max(5).default([]),
}).strict().superRefine((data, context) => {
  if (!isDpdpComplaint(data.complaintType)) {
    for (const field of ['phone', 'orderNumber', 'productName'] as const) {
      if (!data[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'All fields are required' });
    }
  }
  if (['breakage', 'return', 'defective'].includes(data.complaintType) && !data.images.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['images'], message: 'Images are required for this complaint type' });
  }
  if (data.images.reduce((size, image) => size + image.length, 0) > 12 * 1024 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['images'], message: 'Combined images are too large; use fewer or smaller images' });
  }
});

// ============================================
// Cart & Wishlist Schemas
// ============================================

export const AddToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: quantitySchema.default(1),
});

export const UpdateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export const AddToWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
});

// ============================================
// Coupon Schemas
// ============================================

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(50),
});

export const CreateCouponSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().positive(),
  minOrderValue: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().default(true),
  applicableCategories: z.array(z.string()).optional(),
  applicableProducts: z.array(z.string()).optional(),
  excludedProducts: z.array(z.string()).optional(),
});

// ============================================
// Search & Filter Schemas
// ============================================

export const SearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum([
    'relevance',
    'price_asc',
    'price_desc',
    'newest',
    'rating',
    'popularity',
  ]).default('relevance'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  inStock: z.coerce.boolean().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  attributes: z.record(z.string()).optional(),
});

// ============================================
// Newsletter Schema
// ============================================

export const NewsletterSubscribeSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  preferences: z.object({
    promotions: z.boolean().default(true),
    newProducts: z.boolean().default(true),
    weeklyDigest: z.boolean().default(false),
  }).optional(),
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate data against a schema and return typed result
 */
export function validateInput<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error.errors };
}

/**
 * Format Zod errors for API responses
 */
export function formatValidationErrors(errors: z.ZodError['errors']): Array<{
  field: string;
  message: string;
}> {
  return errors.map((error) => ({
    field: error.path.join('.'),
    message: error.message,
  }));
}

/**
 * Create a validation middleware for API routes
 */
export function createValidator<T extends z.ZodTypeAny>(schema: T) {
  return (data: unknown): z.infer<T> => {
    return schema.parse(data);
  };
}

// Export type helpers
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type ReviewInput = z.infer<typeof ReviewSchema>;
export type ContactFormInput = z.infer<typeof ContactFormSchema>;
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
