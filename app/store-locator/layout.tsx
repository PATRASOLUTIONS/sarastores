import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Store Locator | ${companyName}`,
    description: `Find ${companyName} stores near you. Locate our showrooms and service centers for in-person product experience and support.`,
    pageUrl: `${origin}/store-locator`,
    origin,
    companyName,
  })
}

export default function StoreLocatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
