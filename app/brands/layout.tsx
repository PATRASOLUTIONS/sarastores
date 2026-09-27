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

export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers()
  const origin = getOrigin(hdrs)

  try {
    const settings = await getSettings()
    const companyName = settings?.companyName || settings?.storeName || settings?.siteName || 'Sara Electronics'
    const title = `All Brands | ${companyName}`
    const description = `Explore our collection of trusted brands. Shop genuine products with warranty from top brands at ${companyName}.`
    const pageUrl = `${origin}/brands`

    return {
      title,
      description,
      metadataBase: new URL(origin),
      alternates: { canonical: pageUrl },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: companyName,
        locale: 'en_IN',
        type: 'website',
      },
      twitter: { card: 'summary_large_image', title, description },
      robots: { index: true, follow: true },
    }
  } catch {
    return { title: 'Brands', description: 'Browse all brands.' }
  }
}

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
