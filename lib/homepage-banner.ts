import { getCollection } from '@/lib/db-service'
import { selectVisibleBanners, type ScheduledBanner } from '@/lib/banner-schedule'
import { absoluteSeoImage } from '@/lib/seo-metadata'

/** Match the homepage carousel's placement, scope, order and IST visibility rules. */
export async function getHomepageBannerImage(origin: string): Promise<string | null> {
  try {
    const [banners, hero] = await Promise.all([
      getCollection<ScheduledBanner & { image?: string }>('listing_banners').then(collection =>
        collection.find({ placement: 'home-hero', active: true }).sort({ order: 1, createdAt: 1 }).toArray()),
      getCollection('marketing_content').then(collection => collection.findOne({ page: 'home', section: 'hero' })),
    ])
    if (hero?.enabled === false) return null
    for (const banner of selectVisibleBanners(banners)) {
      const image = absoluteSeoImage(banner.image, origin)
      if (image && !/\.svg(?:[?#]|$)/i.test(image)) return image
    }
  } catch {
    console.warn('[SEO] Homepage banner unavailable; using fallback share image')
  }
  return null
}
