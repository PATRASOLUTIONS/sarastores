import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { headers } from 'next/headers'
import { CategoryJsonLdServer } from './CategoryJsonLdServer'

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

async function getCategory(id: string) {
  try {
    const { db } = await connectToDatabase()
    const { ObjectId } = await import('mongodb')

    if (ObjectId.isValid(id)) {
      const byObjectId = await db.collection('categories').findOne({ _id: new ObjectId(id) })
      if (byObjectId) return byObjectId
    }

    const byId = await db.collection('categories').findOne({ id })
    if (byId) return byId

    // The route also accepts a display name, optionally hyphenated.
    const name = decodeURIComponent(id).replace(/-/g, ' ')
    return await db
      .collection('categories')
      .findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const hdrs = await headers()
  const origin = getOrigin(hdrs)

  try {
    const [category, settings] = await Promise.all([getCategory(id), getSettings()])

    if (!category) {
      return { title: 'Category Not Found', description: 'The requested category could not be found.' }
    }

    const companyName = settings?.companyName || settings?.siteName || 'Sara Electronics'
    const catName = category.name
      ? category.name.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      : 'Category'
    const title = `${catName} | ${companyName}`
    const description = category.description || `Shop ${catName} online at best prices. Wide range of ${catName.toLowerCase()} with fast delivery at ${companyName}.`
    const pageUrl = `${origin}/category/${id}`
    const imageUrl = category.image
      ? (category.image.startsWith('http') ? category.image : `${origin}${category.image.startsWith('/') ? '' : '/'}${category.image}`)
      : `${origin}/og-image.jpg`

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
        title: `${catName} - Shop Online`,
        description,
        url: pageUrl,
        siteName: companyName,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: catName }],
        locale: 'en_IN',
        type: 'website',
      },
      twitter: { card: 'summary_large_image', title, description, images: [imageUrl] },
      robots: { index: true, follow: true, 'max-image-preview': 'large' },
    }
  } catch {
    return { title: 'Category', description: 'Browse category products.' }
  }
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const hdrs = await headers()
  const origin = getOrigin(hdrs)

  // Decode the category name from the URL param
  const decodedName = decodeURIComponent(id).replace(/-/g, ' ')

  return (
    <>
      <CategoryJsonLdServer categoryName={decodedName} origin={origin} />
      {children}
    </>
  )
}
