import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/register', title: brand => `Create Account | ${brand}`,
  description: 'Create your SARA customer account to manage orders, preferences and saved products.',
  noIndex: true,
})

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
