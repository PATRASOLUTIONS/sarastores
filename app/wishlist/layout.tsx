import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/wishlist", title: brand => `Your Wishlist | ${brand}`,
  description: "View the products saved to your personal wishlist.", noIndex: true,
})

export default function WishlistLayout({ children }: { children: ReactNode }) {
  return children
}
