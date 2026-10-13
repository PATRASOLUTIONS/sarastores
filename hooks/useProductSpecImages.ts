// Utility to fetch up to 5 specification_images for a product by SKU
import useSWR from "swr"
import { productCardResponseSchema } from "@/lib/product-card-response"

const imagesSchema = productCardResponseSchema.pick({ specification_images: true })

async function fetchImages(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Product specification images could not be loaded")
  const data: unknown = await response.json()
  if (data === null) return null
  return imagesSchema.parse(Array.isArray(data) ? data[0] : data)
}

export function useProductSpecImages(sku?: string): string[] {
  const { data } = useSWR(
    sku ? `/api/products/specifications/${encodeURIComponent(sku)}` : null,
    fetchImages,
    { onError: error => console.error("[Product specification images] Load failed:", error) },
  )
  let specImages: string[] = []
  if (data) {
    const imgs = data.specification_images
    if (Array.isArray(imgs)) {
      specImages = imgs.slice(0, 5)
    } else if (typeof imgs === "string" && imgs) {
      specImages = [imgs]
    }
  }
  return specImages
}
