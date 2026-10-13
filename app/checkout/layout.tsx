import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/checkout', title: brand => `Checkout | ${brand}`,
  description: 'Complete your purchase securely. Delivery, payment and order details are private to your session.',
  noIndex: true,
})

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
