import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/login', title: brand => `Login | ${brand}`,
  description: 'Sign in to your SARA account to manage your orders and saved items.',
  noIndex: true,
})

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
