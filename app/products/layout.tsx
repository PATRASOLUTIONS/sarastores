import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { getCompanyName, getOriginFromHeaders } from '@/lib/seo-metadata'

async function getSettings() {
  try {
    const { db } = await connectToDatabase()
    return await db.collection('settings').findOne({})
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()

  try {
    const settings = await getSettings()
    const companyName = getCompanyName(settings)
    const title = `All Products | ${companyName}`
    const description = `Browse our complete product catalog. Find the best deals on electronics, appliances, and more at ${companyName}. Free delivery & warranty available.`
    const pageUrl = `${origin}/products`

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
    return { title: 'Products', description: 'Browse all products.' }
  }
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
