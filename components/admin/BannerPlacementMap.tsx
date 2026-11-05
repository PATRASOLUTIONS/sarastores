'use client'
import { useEffect, useState } from 'react'
import SiteImage from '@/components/SiteImage'
import { BANNER_PLACEMENTS, BANNER_PLACEMENT_LABELS, bannerIsPhotoOnly, useBannerClock, type BannerPlacement, type SiteBanner } from '@/hooks/useBanners'
import { BANNER_LOCATIONS, HOME_PROMOTION_PLACEMENTS } from '@/lib/banner-placements'
import { bannerVisibilityStatus, bannerScheduleSummary, selectVisibleBanners } from '@/lib/banner-schedule'
import { useMarketingContent } from '@/hooks/useMarketingContent'

function PlacementCard({ placement, banners, draftId, now, edit, add }: { placement: BannerPlacement; banners: SiteBanner[]; draftId?: string; now: number; edit: (banner: SiteBanner) => void; add: (placement: BannerPlacement) => void }) {
  const location = BANNER_LOCATIONS[placement]
  const [scope, setScope] = useState('')
  const edited = banners.find(banner => banner.id === draftId && banner.placement === placement)
  const editedScope = edited?.scope || ''
  const hasEdited = !!edited
  useEffect(() => { if (hasEdited) setScope(editedScope) }, [draftId, hasEdited, editedScope])
  const page = placement.startsWith('home-') ? 'home' : placement.startsWith('pdp-') ? 'product' : placement === 'brands-hero' ? 'brands' : placement === 'cart-promo' ? 'cart' : 'products'
  const marketing = useMarketingContent(page)
  const section = placement.startsWith('home-') ? placement === 'home-hero' || placement === 'home-duo' ? 'hero' : 'promotions' : placement === 'pdp-rail' ? 'rail' : placement === 'pdp-offer' ? '' : placement === 'cart-promo' ? 'recommendations' : placement === 'promo' ? 'promotions' : 'hero'
  const enabled = !section || ((placement === 'hero' || placement === 'promo') && !!scope) || marketing.enabled(section)
  const items = banners.filter(banner => banner.placement === placement).sort((a, b) => (a.order || 0) - (b.order || 0))
  const scopes = [...new Set(items.map(banner => (banner.scope || '').trim()).filter(Boolean))]
  const shared = HOME_PROMOTION_PLACEMENTS.includes(placement)
  const pool = shared ? HOME_PROMOTION_PLACEMENTS.flatMap(key => banners.filter(banner => banner.placement === key)) : items
  const limit = placement === 'promo' && scope ? 2 : location.limit
  const selected = selectVisibleBanners(pool, scope, now).slice(0, limit)
  const main = selectVisibleBanners(banners.filter(banner => banner.placement === 'home-hero'), '', now)[0]
  const sideHidden = placement === 'home-duo' && (selected.length < 2 || !!main && bannerIsPhotoOnly(main))
  const status = (banner: SiteBanner) => {
    const visibility = bannerVisibilityStatus(banner, now)
    if (visibility !== 'Eligible') return visibility
    if ((banner.scope || '').trim() && !location.scope) return 'Scoped incorrectly — clear scope'
    if (!enabled) return 'Page section is off'
    if (sideHidden) return selected.length < 2 ? 'Needs two side banners' : 'Hidden on photo-only main slides'
    if (!selected.some(item => item.id === banner.id)) return (banner.scope || '').trim().toLowerCase() !== scope.trim().toLowerCase() ? 'Select its audience to inspect' : 'Waiting for an earlier slot'
    return draftId === banner.id ? 'Unsaved section preview' : 'Selected for this section'
  }
  const href = (placement === 'hero' || placement === 'promo') && scope ? `/products?division=${encodeURIComponent(scope)}` : (placement === 'hero' || placement === 'promo') ? '/offers' : placement.startsWith('pdp-') && scope ? `/products?brand=${encodeURIComponent(scope)}` : location.href
  return <article className="rounded-2xl border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{location.page}</p><h3 className="mt-1 font-semibold text-gray-900">{location.section}</h3><p className="mt-1 text-xs text-gray-500">{BANNER_PLACEMENT_LABELS[placement]}</p></div><a href={href} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 underline">Open page ↗</a></div>
    <p className="my-3 text-xs leading-5 text-gray-600">{location.note}</p>
    {!enabled && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">This section is disabled in <a className="underline" href="/admin/marketing">Marketing</a>. Posters remain hidden until it is enabled.</p>}
    {marketing.error && <p className="text-xs text-red-700">Could not verify the page-section setting.</p>}
    {location.scope && <label className="mb-3 block text-xs font-medium text-gray-600">Inspect audience<select value={scope} onChange={event => setScope(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">Default / all audiences</option>{scopes.map(value => <option key={value}>{value}</option>)}</select></label>}
    <div className="space-y-2">{items.map(banner => <div key={banner.id} className={`flex items-start gap-3 rounded-xl border p-3 ${draftId === banner.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}>
      <button type="button" onClick={() => edit(banner)} aria-label={`Edit poster ${banner.title || banner.id}`} className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">{banner.image ? <SiteImage src={banner.image} alt={banner.title || 'Poster artwork'} className="h-full w-full object-contain" /> : <span className="text-xs text-gray-500">Text poster</span>}</button>
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{banner.title || 'Photo-only poster'}</p><p className="mt-1 text-xs text-gray-600">Order {banner.order || 0} · {banner.scope || 'All audiences'}</p><p className={`mt-1 text-xs font-medium ${status(banner).includes('hidden') ? 'text-red-700' : 'text-blue-800'}`}>{status(banner)}</p><p className="mt-1 text-xs text-gray-500">{bannerScheduleSummary(banner)}</p></div>
      <button type="button" onClick={() => edit(banner)} className="rounded-lg border px-2 py-1 text-xs">Edit</button>
    </div>)}{!items.length && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No posters assigned here.</p>}</div>
    <button type="button" onClick={() => add(placement)} className="mt-3 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800">Add poster to this section</button>
  </article>
}

export default function BannerPlacementMap({ banners, draftId, filter, edit, add }: { banners: SiteBanner[]; draftId?: string; filter: string; edit: (banner: SiteBanner) => void; add: (placement: BannerPlacement) => void }) {
  const now = useBannerClock(banners)
  return <section aria-labelledby="banner-page-map"><h2 id="banner-page-map" className="mb-2 text-lg font-bold">Where every poster appears</h2><p className="mb-4 text-sm text-gray-500">Click a poster to edit it. Changes appear in its section preview immediately; Save publishes them. Weekdays, date ranges and the section’s display limit decide which posters can show.</p><div className="grid gap-4 xl:grid-cols-2">{BANNER_PLACEMENTS.filter(placement => filter === 'all' || filter === 'home' && placement.startsWith('home-') || filter === placement).map(placement => <PlacementCard key={placement} placement={placement} banners={banners} draftId={draftId} now={now} edit={edit} add={add} />)}</div></section>
}
