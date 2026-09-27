import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `About Us | ${companyName}`,
    description: `Learn about ${companyName} — our story, values, and commitment to bringing you quality products at the best prices with reliable service across India.`,
    pageUrl: `${origin}/about`,
    origin,
    companyName,
  })
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
