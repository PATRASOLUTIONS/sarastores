import { z } from "zod"

export const GoogleBusinessAccountName = z.string().regex(/^accounts\/[A-Za-z0-9_][A-Za-z0-9_-]*$/)
export const GoogleBusinessLocationName = z.string().regex(/^locations\/[A-Za-z0-9_][A-Za-z0-9_-]*$/)
export const GoogleBusinessConnectionId = z.string().regex(/^[a-f0-9]{64}$/)
const publicUrl = z.string().refine(value => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password } catch { return false }
}).optional()

export const BusinessProfileAccountSchema = z.object({
  name: GoogleBusinessAccountName, accountName: z.string().optional(), type: z.string().optional(), role: z.string().optional(),
  verificationState: z.string().optional(), vettedState: z.string().optional(),
})
export const BusinessProfileLocationSchema = z.object({
  name: GoogleBusinessLocationName, title: z.string().optional(), storeCode: z.string().optional(), languageCode: z.string().optional(),
  storefrontAddress: z.object({ addressLines: z.array(z.string()).optional(), locality: z.string().optional(), administrativeArea: z.string().optional(),
    postalCode: z.string().optional(), regionCode: z.string().optional(), sublocality: z.string().optional() }).passthrough().optional(),
  phoneNumbers: z.object({ primaryPhone: z.string().optional(), additionalPhones: z.array(z.string()).optional() }).passthrough().optional(),
  websiteUri: publicUrl,
  latlng: z.object({ latitude: z.number(), longitude: z.number() }).passthrough().optional(),
  metadata: z.object({ mapsUri: publicUrl, newReviewUri: publicUrl, placeId: z.string().optional(), hasVoiceOfMerchant: z.boolean().optional(), duplicateLocation: z.string().optional() }).passthrough().optional(),
  profile: z.object({ description: z.string().optional() }).passthrough().optional(),
  categories: z.object({ primaryCategory: z.object({ name: z.string().optional(), displayName: z.string().optional() }).passthrough().optional(),
    additionalCategories: z.array(z.object({ name: z.string().optional(), displayName: z.string().optional() })).optional() }).passthrough().optional(),
  regularHours: z.object({ periods: z.array(z.object({ openDay: z.string().optional(), closeDay: z.string().optional(),
    openTime: z.object({ hours: z.number().optional(), minutes: z.number().optional() }).passthrough().optional(),
    closeTime: z.object({ hours: z.number().optional(), minutes: z.number().optional() }).passthrough().optional() })).optional() }).passthrough().optional(),
  specialHours: z.unknown().optional(), serviceArea: z.unknown().optional(),
  labels: z.array(z.string()).optional(), adWordsLocationExtensions: z.unknown().optional(),
  relationshipData: z.unknown().optional(), moreHours: z.array(z.unknown()).optional(), serviceItems: z.array(z.unknown()).optional(),
  openInfo: z.object({ status: z.string().optional(), canReopen: z.boolean().optional(), openingDate: z.unknown().optional() }).passthrough().optional(),
}).passthrough()
export const BusinessProfileReviewSchema = z.object({
  reviewId: z.string(), name: z.string().optional(), starRating: z.string().optional(), comment: z.string().optional(),
  createTime: z.string().optional(), updateTime: z.string().optional(),
  reviewer: z.object({ displayName: z.string().optional(), profilePhotoUrl: publicUrl, isAnonymous: z.boolean().optional() }).optional(),
  reviewReply: z.object({ comment: z.string().optional(), updateTime: z.string().optional() }).optional(),
})
export const BusinessProfileMediaSchema = z.object({
  name: z.string(), mediaFormat: z.string().optional(), googleUrl: publicUrl, thumbnailUrl: publicUrl,
  createTime: z.string().optional(), description: z.string().optional(),
  locationAssociation: z.object({ category: z.string().optional() }).optional(),
  attribution: z.object({ profileName: z.string().optional(), profilePhotoUrl: publicUrl }).optional(),
})
export const BusinessProfileAccountsResponse = z.object({ success: z.literal(true), accounts: z.array(BusinessProfileAccountSchema), nextPageToken: z.string().optional() })
export const BusinessProfileLocationsResponse = z.object({ success: z.literal(true), locations: z.array(BusinessProfileLocationSchema), nextPageToken: z.string().optional() })
export const BusinessProfileReviewsResponse = z.object({ success: z.literal(true), reviews: z.array(BusinessProfileReviewSchema),
  averageRating: z.number().optional(), totalReviewCount: z.number().optional(), nextPageToken: z.string().optional() })
export const BusinessProfileMediaResponse = z.object({ success: z.literal(true), mediaItems: z.array(BusinessProfileMediaSchema),
  totalMediaItemCount: z.number().optional(), nextPageToken: z.string().optional() })
export const BusinessProfileStatusResponse = z.object({ success: z.literal(true), configured: z.boolean(), missing: z.array(z.string()), redirectUri: z.string(),
  connections: z.array(z.object({ id: GoogleBusinessConnectionId, email: z.string(), name: z.string(), connectedAt: z.string(), status: z.enum(["connected", "reconnect_required"]) })) })
export type BusinessProfileLocation = z.infer<typeof BusinessProfileLocationSchema>
export type BusinessProfileAccount = z.infer<typeof BusinessProfileAccountSchema>
export type BusinessProfileReview = z.infer<typeof BusinessProfileReviewSchema>
export type BusinessProfileMedia = z.infer<typeof BusinessProfileMediaSchema>
export type BusinessProfileStatus = z.infer<typeof BusinessProfileStatusResponse>
