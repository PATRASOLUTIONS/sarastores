import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/cart', title: brand => `Your Cart | ${brand}`,
  description: 'Review your cart items and proceed to checkout. Cart contents are private to your shopping session.',
  noIndex: true,
})

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
