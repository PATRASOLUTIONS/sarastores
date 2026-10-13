import type { ObjectId } from 'mongodb'
import { z } from 'zod'
import { productCardResponseSchema } from './product-card-response'

const fields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).transform(value =>
    value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  ).pipe(z.string().min(1).max(120)),
  banner: z.string().max(7 * 1024 * 1024).refine(value => !value || /^\/(?!\/)/.test(value) ||
    /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(value) ||
    (/^https?:\/\//i.test(value) && z.string().url().safeParse(value).success), 'Invalid banner image'),
  productIds: z.array(z.string().trim().min(1).max(100)).max(500)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate products are not allowed'),
  isActive: z.boolean(),
}
export const CreateCampaignPageSchema = z.object({
  ...fields, banner: fields.banner.default(''), productIds: fields.productIds.default([]),
  isActive: fields.isActive.default(true),
}).strict()
export const UpdateCampaignPageSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0)

export interface CampaignPageDocument {
  _id: ObjectId
  name: string
  slug: string
  banner?: string | null
  productIds?: string[]
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}
export const campaignPageResponseSchema = z.object({
  id: z.string().min(1), name: z.string(), slug: z.string(),
  banner: z.string().nullish().transform(value => value ?? ''),
  productIds: z.array(z.string()).optional().default([]),
  isActive: z.boolean(),
})
export const campaignPageListResponseSchema = z.object({ success: z.literal(true), campaigns: z.array(campaignPageResponseSchema) })
export type CampaignPageResponse = z.infer<typeof campaignPageResponseSchema>
export const publicCampaignPageResponseSchema = z.object({
  success: z.literal(true),
  campaign: campaignPageResponseSchema.omit({ productIds: true }).extend({
    products: z.array(productCardResponseSchema),
  }),
})
export type PublicCampaignPage = z.infer<typeof publicCampaignPageResponseSchema>['campaign']
