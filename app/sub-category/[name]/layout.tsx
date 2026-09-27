import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { headers } from 'next/headers'

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

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const hdrs = await headers()
  const origin = getOrigin(hdrs)
  const decodedName = decodeURIComponent(name).replace(/-/g, ' ')
  const displayName = decodedName
    .split(/\s+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  try {
    const settings = await getSettings()
    const companyName = settings?.companyName || settings?.storeName || settings?.siteName || 'Sara Electronics'
    const title = `${displayName} | ${companyName}`
    const description = `Shop ${displayName} online at best prices. Wide selection with fast delivery at ${companyName}.`
    const pageUrl = `${origin}/sub-category/${name}`

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
        title: `${displayName} - Shop Online`,
        description,
        url: pageUrl,
        siteName: companyName,
        locale: 'en_IN',
        type: 'website',
      },
      twitter: { card: 'summary_large_image', title, description },
      robots: { index: true, follow: true, 'max-image-preview': 'large' },
    }
  } catch {
    return {
      title: displayName,
      description: `Shop ${displayName} online.`,
    }
  }
}

export default function SubCategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
