import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Contact Us | ${companyName}`,
    description: `Get in touch with ${companyName}. Reach out for product inquiries, order support, bulk orders, or feedback. We're here to help.`,
    pageUrl: `${origin}/contact`,
    origin,
    companyName,
  })
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
