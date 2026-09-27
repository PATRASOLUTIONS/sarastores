// Utility to fetch up to 5 specification_images for a product by SKU
import useSWR from "swr"

export function useProductSpecImages(sku?: string): string[] {
  const { data } = useSWR(
    sku ? `/api/products/specifications/${encodeURIComponent(sku)}` : null,
    (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
  )
  let specImages: string[] = []
  if (data) {
    const imgs = (data as any)?.specification_images
    if (Array.isArray(imgs)) {
      specImages = imgs.slice(0, 5)
    } else if (typeof imgs === "string" && imgs) {
      specImages = [imgs]
    }
  }
  return specImages
}
