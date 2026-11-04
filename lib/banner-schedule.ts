export type ScheduledBanner = { active?: boolean; expiresAt?: string | null; scope?: string; order?: number }
export const BANNER_UPDATE_KEY = 'sara:listing-banners:updated'

export function bannerIsVisible(banner: ScheduledBanner, now = Date.now()) {
  return banner.active === true && (!banner.expiresAt || Date.parse(banner.expiresAt) > now)
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
