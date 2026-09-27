import { Metadata } from 'next'
import { getOriginFromHeaders, getSiteSettings, getCompanyName, buildPageMetadata } from '@/lib/seo-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  const settings = await getSiteSettings()
  const companyName = getCompanyName(settings)

  return buildPageMetadata({
    title: `Cancellation Policy | ${companyName}`,
    description: `Understand the cancellation and return policy at ${companyName}. Learn about order cancellation, refund timelines, and return procedures.`,
    pageUrl: `${origin}/cancellation-policy`,
    origin,
    companyName,
  })
}

export default function CancellationPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
