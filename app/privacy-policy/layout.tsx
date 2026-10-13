import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Privacy Notice | ${companyName}`,
    description: `How ${companyName} collects, uses, shares and protects personal data under India's Digital Personal Data Protection Act, 2023.`,
    pageUrl: `${origin}/privacy-policy`,
    origin,
    companyName,
  })
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
