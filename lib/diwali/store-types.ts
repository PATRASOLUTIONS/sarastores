import { z } from 'zod'

export const CampaignDirectoryStoreSchema = z.object({
  id: z.string(), code: z.string(), name: z.string(), active: z.boolean(),
})
export const CampaignAccountSchema = z.object({
  id: z.string(), name: z.string(), email: z.string(), active: z.boolean(), ready: z.boolean(), admin: z.boolean(),
})
export const CampaignSetupSchema = z.object({ stores: z.array(CampaignDirectoryStoreSchema), accounts: z.array(CampaignAccountSchema) })
export type CampaignAccount = z.infer<typeof CampaignAccountSchema>
export type CampaignDirectoryStore = z.infer<typeof CampaignDirectoryStoreSchema>
export const DiwaliStoreLinksSchema = z.object({ stores: z.array(z.object({
  id: z.string(), code: z.string(), name: z.string(), active: z.boolean(), inCampaign: z.boolean(),
  url: z.string().url(), opens: z.number().nonnegative(), registrations: z.number().nonnegative(), lastOpenedAt: z.string().nullable(),
})) })
export type DiwaliStoreLink = z.infer<typeof DiwaliStoreLinksSchema>['stores'][number]
