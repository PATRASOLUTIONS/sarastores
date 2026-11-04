import { z } from 'zod'

export type ScheduledBanner = { active?: boolean; startsAt?: string | null; expiresAt?: string | null; weekdays?: number[] | null; scope?: string; order?: number }
export const BANNER_UPDATE_KEY = 'sara:listing-banners:updated'
export const BANNER_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const isoTime = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString())
export const BannerScheduleFields = {
  startsAt: isoTime.nullable().optional().default(null),
  expiresAt: isoTime.nullable().optional().default(null),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one weekday or choose Every day.').max(7)
    .refine(days => new Set(days).size === days.length, 'Weekdays must be unique.').nullable().optional().default(null),
}
export const BannerScheduleSchema = z.object(BannerScheduleFields).superRefine((schedule, context) => {
  if (schedule.startsAt && schedule.expiresAt && Date.parse(schedule.startsAt) >= Date.parse(schedule.expiresAt)) {
    context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Visibility end must be after visibility start.' })
  }
})
const INDIA_OFFSET = 330 * 60_000
const DAY = 24 * 60 * 60_000
export function bannerVisibilityStatus(banner: ScheduledBanner, now = Date.now()) {
  if (banner.active !== true) return 'Off — hidden'
  if (banner.expiresAt && !(Date.parse(banner.expiresAt) > now)) return 'Expired — hidden'
  if (banner.startsAt && !(Date.parse(banner.startsAt) <= now)) return 'Scheduled — not started'
  if (banner.weekdays && !banner.weekdays.includes(new Date(now + INDIA_OFFSET).getUTCDay())) return 'Not scheduled for today — hidden'
  return 'Eligible'
}

export function bannerIsVisible(banner: ScheduledBanner, now = Date.now()) {
  return bannerVisibilityStatus(banner, now) === 'Eligible'
}

export function nextBannerTransition(banners: ScheduledBanner[], now = Date.now()) {
  const times: number[] = []
  for (const banner of banners) {
    if (!banner.active || banner.expiresAt && Date.parse(banner.expiresAt) <= now) continue
    for (const value of [banner.startsAt, banner.expiresAt]) {
      const time = Date.parse(value || '')
      if (time > now) times.push(time)
    }
    if (banner.weekdays && banner.weekdays.length < 7) times.push((Math.floor((now + INDIA_OFFSET) / DAY) + 1) * DAY - INDIA_OFFSET)
  }
  return times.length ? Math.min(...times) : null
}

export function bannerScheduleSummary(banner: ScheduledBanner) {
  const days = !banner.weekdays || banner.weekdays.length === 7 ? 'Every day' : [...banner.weekdays].sort((a, b) => a - b).map(day => BANNER_WEEKDAYS[day]).join(', ')
  const format = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  return `${days} · Starts: ${banner.startsAt ? `${format(banner.startsAt)} IST` : 'Immediately'} · ${banner.expiresAt ? `Deadline: ${format(banner.expiresAt)} IST` : 'Deadline: Never'}`
}

export function selectVisibleBanners<T extends ScheduledBanner>(banners: T[], scope = '', now = Date.now()): T[] {
  const active = banners.filter(banner => bannerIsVisible(banner, now)).sort((a, b) => (a.order || 0) - (b.order || 0))
  const key = scope.trim().toLowerCase()
  const scoped = key ? active.filter(banner => (banner.scope || '').trim().toLowerCase() === key) : []
  return scoped.length ? scoped : active.filter(banner => !(banner.scope || '').trim())
}

export function deadlineIndiaInput(iso?: string | null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  return new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 16)
}

export function deadlineFromIndiaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid deadline date and time.')
  const date = new Date(`${value}:00+05:30`)
  if (!Number.isFinite(date.getTime()) || deadlineIndiaInput(date.toISOString()) !== value) throw new Error('Enter a valid deadline date and time.')
  return date.toISOString()
}
