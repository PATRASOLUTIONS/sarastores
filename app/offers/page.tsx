import ProductsPage from "../products/page"
import { pageMetadata } from "@/lib/seo-page"

export const dynamic = "force-dynamic"

export const generateMetadata = pageMetadata({
  path: "/offers", title: brand => `Offers & Savings | ${brand}`,
  description: "Explore savings, coupon offers and available payment options on electronics and appliances. Bank and EMI eligibility is confirmed at checkout.",
})

export default function OffersPage() {
  return <ProductsPage />
}
