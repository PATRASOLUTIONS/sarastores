import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Terms & Conditions | ${companyName}`,
    description: `Review the terms and conditions for using ${companyName}. Understand our policies on orders, returns, warranties, and service agreements.`,
    pageUrl: `${origin}/terms-and-conditions`,
    origin,
    companyName,
  })
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
