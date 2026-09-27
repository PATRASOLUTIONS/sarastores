import { MetadataRoute } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { getAllStoreLocations } from '@/lib/store-locations'
import { getArticleCategories, listArticles } from '@/lib/articles'

// Revalidate sitemap every hour
export const revalidate = 3600

// Helper to get the site origin
function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getOrigin()
  const now = new Date()

  // ── Static pages ────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: origin,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${origin}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${origin}/brands`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${origin}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${origin}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${origin}/careers`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${origin}/press`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    ...[
      '/returns',
      '/shipping-policy',
      '/warranty',
      '/installation',
      '/emi',
      '/business-enquiries',
      '/corporate-information',
      '/disclaimer',
      '/sitemap',
    ].map((path) => ({
      url: `${origin}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    {
      url: `${origin}/privacy-policy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/terms-and-conditions`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/cancellation-policy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/complaints`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${origin}/store-locator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${origin}/stores`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${origin}/offers`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${origin}/ganesh`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${origin}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // ── Dynamic pages from database ──────────────────────────────
  let productEntries: MetadataRoute.Sitemap = []
  let categoryEntries: MetadataRoute.Sitemap = []
  let subCategoryEntries: MetadataRoute.Sitemap = []
  let brandEntries: MetadataRoute.Sitemap = []
  let storeEntries: MetadataRoute.Sitemap = []
  let campaignEntries: MetadataRoute.Sitemap = []
  let articleEntries: MetadataRoute.Sitemap = []

  try {
    const { db } = await connectToDatabase()

    // Products — only active ones
    const products = await db
      .collection('products')
      .find(
        { active: true },
        {
          projection: { _id: 1, slug: 1, updatedAt: 1, createdAt: 1, image: 1, images: 1 },
        }
      )
      .toArray()

    productEntries = products.map((p) => {
      // Image sitemap entries are how product photography gets discovered by
      // Google Images; data URIs and relative paths are not valid there.
      const images = [p.image, ...(Array.isArray(p.images) ? p.images : [])]
        .filter(
          (src): src is string =>
            typeof src === 'string' && (src.startsWith('https://') || src.startsWith('http://')),
        )
        .slice(0, 5)

      return {
        url: `${origin}/product/${p.slug || p._id.toString()}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : p.createdAt ? new Date(p.createdAt) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        ...(images.length > 0 ? { images } : {}),
      }
    })

    // Categories — only enabled ones
    const categories = await db
      .collection('categories')
      .find(
        { isEnabled: { $ne: false } },
        { projection: { _id: 1, slug: 1, name: 1, updatedAt: 1 } }
      )
      .toArray()

    categoryEntries = categories.map((c) => ({
      url: `${origin}/category/${c.slug || c._id.toString()}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    // Sub-categories (from sub_categories collection)
    try {
      const subCategories = await db
        .collection('sub_categories')
        .find(
          {},
          { projection: { _id: 1, name: 1, slug: 1, updatedAt: 1 } }
        )
        .toArray()

      subCategoryEntries = subCategories.map((sc: any) => ({
        url: `${origin}/sub-category/${sc.slug || encodeURIComponent(sc.name || sc._id.toString())}`,
        lastModified: sc.updatedAt ? new Date(sc.updatedAt) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    } catch {
      // sub_categories collection may not exist
    }

    // Brands — only enabled ones
    const brands = await db
      .collection('brands')
      .find(
        { enabled: true },
        { projection: { slug: 1, updatedAt: 1 } }
      )
      .toArray()

    brandEntries = brands.map((b) => ({
      url: `${origin}/brands/${b.slug}`,
      lastModified: b.updatedAt ? new Date(b.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    // Store pages — one per city plus one per showroom, for local SEO
    try {
      const stores = await getAllStoreLocations()
      const citySlugs = new Set(stores.map((s) => s.citySlug))

      storeEntries = [
        ...Array.from(citySlugs, (citySlug) => ({
          url: `${origin}/stores/${citySlug}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
        ...stores.map((s) => ({
          url: `${origin}/stores/${s.citySlug}/${s.slug}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
      ]
    } catch {
      // store_locations collection may not exist
    }

    // Campaign landing pages
    try {
      const campaigns = await db
        .collection('campaign_pages')
        .find({ isActive: { $ne: false } }, { projection: { slug: 1, updatedAt: 1 } })
        .toArray()

      campaignEntries = campaigns
        .filter((c: any) => !!c.slug)
        .map((c: any) => ({
          url: `${origin}/campaign/${c.slug}`,
          lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
          changeFrequency: 'daily' as const,
          priority: 0.6,
        }))
    } catch {
      // campaign_pages collection may not exist
    }

    // Buying guides plus one landing page per article category
    try {
      const [articles, categories] = await Promise.all([listArticles(), getArticleCategories()])

      articleEntries = [
        ...articles.map((a) => ({
          url: `${origin}/blog/${a.slug}`,
          lastModified: a.updatedAt ? new Date(a.updatedAt) : now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
        ...categories.map((c) => ({
          url: `${origin}/blog?category=${encodeURIComponent(c.name)}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        })),
      ]
    } catch {
      // articles collection may not exist
    }
  } catch (error) {
    console.error('Sitemap: Error fetching dynamic routes from DB:', error)
    // Return static pages only if DB fails
  }

  return [
    ...staticPages,
    ...productEntries,
    ...categoryEntries,
    ...subCategoryEntries,
    ...brandEntries,
    ...storeEntries,
    ...campaignEntries,
    ...articleEntries,
  ]
}
