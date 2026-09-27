/**
 * Input Validation Schemas
 * 
 * Zod-based validation schemas for all user inputs
 * to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';

// ============================================
// Common Validators
// ============================================

// Indian phone number (10 digits starting with 6-9)
export const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, 'Invalid phone number. Must be 10 digits starting with 6-9');

// Indian pincode (6 digits)
export const pincodeSchema = z.string()
  .regex(/^\d{6}$/, 'Invalid pincode. Must be 6 digits');

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email too long');

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

// ============================================
// Authentication Schemas
// ============================================

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  name: nameSchema,
  // Not collected at signup; the checkout form captures it.
  phone: phoneSchema.optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ForgotPasswordSchema = z.object({
  email: emailSchema,
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

export const UpdateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  avatar: urlSchema.optional(),
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

// ============================================
// Order Schemas
// ============================================

export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
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

// ============================================
// Review Schemas
// ============================================

export const ReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  orderId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().min(20, 'Review must be at least 20 characters').max(2000),
  images: z.array(urlSchema).max(5).optional(),
  pros: z.array(z.string().max(100)).max(5).optional(),
  cons: z.array(z.string().max(100)).max(5).optional(),
  isVerifiedPurchase: z.boolean().default(false),
});

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
