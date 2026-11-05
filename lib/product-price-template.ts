import { normalizeProductForSchema } from "@/lib/product-schema"
import type { AdminProductResponse } from "@/lib/admin-products-client"

export function buildActiveProductPriceSheet(products: AdminProductResponse[]) {
  const activeProducts = products.filter(product => product.active === true)
  if (!activeProducts.length) throw new Error("There are no customer-visible products to download")
  const seen = new Set<string>()
  return activeProducts.map(product => {
    const itemno = normalizeProductForSchema(product).itemno
    if (!itemno) throw new Error(`Product ${product.name || product.id} has no item number; correct it in Products before exporting`)
    if (seen.has(itemno)) throw new Error(`Multiple active products use itemno ${itemno}; reconcile them before exporting`)
    seen.add(itemno)
    return { itemno, mrp: product.mrp ?? "", price: product.price ?? "" }
  })
}
