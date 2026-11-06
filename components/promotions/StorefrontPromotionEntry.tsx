"use client"

import { usePathname } from "next/navigation"
import { useStorefrontPromotions } from "@/hooks/useStorefrontPromotions"
import { PromotionPopup } from "@/components/promotions/PromotionExperience"
import { isPromotionEntryPath } from "@/lib/storefront-promotion-types"

function ShoppingInvitation() {
  const { products } = useStorefrontPromotions()
  return <PromotionPopup products={products} />
}

export default function StorefrontPromotionEntry() {
  const pathname = usePathname()
  const shopping = isPromotionEntryPath(pathname)
  return shopping ? <ShoppingInvitation /> : null
}
