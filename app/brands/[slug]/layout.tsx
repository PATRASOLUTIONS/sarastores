import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { headers } from 'next/headers'
import { BrandJsonLdServer } from './BrandJsonLdServer'

function getOrigin(hdrs: Headers): string {
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  return host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'))
}

async function getSettings() {
  try {
    const { db } = await connectToDatabase()
    return await db.collection('settings').findOne({})
  } catch {
    return null
  }
}

async function getBrand(slug: string) {
  try {
    const { db } = await connectToDatabase()
    // Records use `enabled`, `isEnabled` or `active` depending on when they were created.
    return await db.collection('brands').findOne({
      slug,
      enabled: { $ne: false },
      isEnabled: { $ne: false },
      active: { $ne: false },
    })
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const hdrs = await headers()
  const origin = getOrigin(hdrs)

  try {
    const [brand, settings] = await Promise.all([getBrand(slug), getSettings()])

    if (!brand) {
      return {
        title: 'Brand Not Found',
        description: 'The requested brand page could not be found.',
      }
    }

    const companyName = settings?.companyName || settings?.siteName || 'Sara Electronics'
    const title = `${brand.name} Products | ${companyName}`
    const description = brand.description || brand.tagline || `Shop ${brand.name} products online at best prices. Genuine products with warranty.`
    const pageUrl = `${origin}/brands/${slug}`

    // Brand logo as OG image
    const imageUrl = brand.logo
      ? (brand.logo.startsWith('http') ? brand.logo : `${origin}${brand.logo.startsWith('/') ? '' : '/'}${brand.logo}`)
      : (brand.banners?.[0]?.url || `${origin}/og-image.jpg`)

    return {
      title,
      description,
      metadataBase: new URL(origin),
      alternates: {
        canonical: pageUrl,
        languages: {
          "en-IN": pageUrl,
          "x-default": pageUrl,
        },
      },
      openGraph: {
        title: `${brand.name} Products`,
        description,
        url: pageUrl,
        siteName: companyName,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: `${brand.name} - ${companyName}` }],
        locale: 'en_IN',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${brand.name} Products`,
        description,
        images: [imageUrl],
      },
      robots: { index: true, follow: true, 'max-image-preview': 'large' },
    }
  } catch {
    return { title: 'Brand', description: 'Shop brand products online.' }
  }
}

export default async function BrandSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const hdrs = await headers()
  const origin = getOrigin(hdrs)

  return (
    <>
      <BrandJsonLdServer slug={slug} origin={origin} />
      {children}
    </>
  )
}
