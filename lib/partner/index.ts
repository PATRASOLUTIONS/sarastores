/**
 * Partner Module Index
 * 
 * Exports all partner-related functionality
 */

// Types
export * from './types';

// Services
export { partnerService } from './service';
export { walletService } from './wallet';

// Orders Service
export {
  createPartnerOrder,
  getPartnerOrderById,
  listPartnerOrders,
  cancelPartnerOrder,
  updateOrderStatus,
  getPartnerOrderStats,
  type CreateOrderInput,
} from './orders';

// API Keys
export {
  generatePartnerAPIKey,
  validateAPIKey,
  findAPIKeyByHash,
  revokeAPIKey,
  listPartnerAPIKeys,
  updateAPIKeyTier,
  hasPermission,
} from './api-keys';

// Rate Limiting
export {
  checkPartnerRateLimit,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  getEndpointRateLimit,
  resetPartnerRateLimit,
  ENDPOINT_RATE_LIMITS,
} from './rate-limit';

// Authentication
export {
  authenticatePartnerRequest,
  checkPartnerPermission,
  permissionDeniedResponse,
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
  withPartnerAuth,
  getCorsHeaders,
  handleOptionsRequest,
  OPTIONS,
  type PartnerAuthContext,
  type PartnerAuthRequest,
} from './auth';
