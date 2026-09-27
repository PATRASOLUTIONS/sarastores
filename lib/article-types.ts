/**
 * Article types and pure helpers.
 *
 * Kept separate from lib/articles.ts so client components (the admin editor)
 * can import categories and types without dragging the MongoDB driver and
 * DOMPurify into the browser bundle.
 */

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage: string
  category: string
  tags: string[]
  author: string
  status: "draft" | "published"
  publishedAt: string | null
  seoTitle: string | null
  seoDescription: string | null
  /** Products to merchandise alongside the article. */
  relatedProductIds: string[]
  readingMinutes: number
  createdAt: string | null
  updatedAt: string | null
}

/** Buying-guide categories, mirroring the storefront taxonomy. */
export const ARTICLE_CATEGORIES = [
  "Buying Guides",
  "Mobiles",
  "Televisions",
  "Refrigerators",
  "Washing Machines",
  "Air Conditioners",
  "Laptops",
  "Kitchen Appliances",
  "Comparisons",
  "Offers & Festivals",
] as const

export function slugifyArticle(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

/** ~200 words per minute, floored at 1. */
export function estimateReadingMinutes(html: string): number {
  const words = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
