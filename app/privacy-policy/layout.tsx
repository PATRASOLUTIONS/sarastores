import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Privacy Policy | ${companyName}`,
    description: `Read the privacy policy of ${companyName}. Learn how we collect, use, and protect your personal information when you use our services.`,
    pageUrl: `${origin}/privacy-policy`,
    origin,
    companyName,
  })
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
