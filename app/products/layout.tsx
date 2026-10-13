import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/products',
  title: brand => `Product Offers & Savings | ${brand}`,
  description: brand => `Explore electronics and appliance offers at ${brand}. Compare catalog savings, check available bank terms, or browse all products.`,
})

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
