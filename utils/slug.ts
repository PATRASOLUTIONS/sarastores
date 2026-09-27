/**
 * Generate a URL-friendly slug from a product name.
 * e.g. "Samsung 55\" Crystal UHD 4K Smart TV" -> "samsung-55-crystal-uhd-4k-smart-tv"
 */
export function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
    .slice(0, 120)                  // cap length
}

/**
 * Get the best URL identifier for a product.
 * Prefers slug, falls back to id.
 */
export function getProductUrlId(product: { slug?: string; id?: string; _id?: any }): string {
  return product.slug || product.id || String(product._id || '')
}
