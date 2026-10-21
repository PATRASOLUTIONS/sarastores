import { pageMetadata } from '@/lib/seo-page'

export const generateMetadata = pageMetadata({
  path: '/products',
  title: brand => `All Products | ${brand}`,
  description: brand => `Browse electronics and appliances at ${brand}. Filter by division, brand and price, or open a division for its own page.`,
})

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
