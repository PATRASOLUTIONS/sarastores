import { z } from 'zod'
import { DiwaliEmailSchema } from './blocklist-types'

export const NotificationSettingsSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(DiwaliEmailSchema).max(10).refine(values => new Set(values).size === values.length, 'Each employee email should appear only once.'),
}).strict().refine(value => !value.enabled || value.recipients.length > 0, 'Add at least one employee email before enabling notifications.')
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>
export type RegistrationEmail = { id: string; reference: string; recipient: string; status: 'queued' | 'sending' | 'accepted' | 'failed' | 'unknown'; attempts: number; createdAt: string; acceptedAt?: string }
