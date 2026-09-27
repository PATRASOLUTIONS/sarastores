import DOMPurify from "isomorphic-dompurify"
import { getCollection, normalizeId } from "@/lib/db-service"
import { estimateReadingMinutes, type Article } from "@/lib/article-types"

/**
 * Buying guides and articles ("CONTENT / BLOG" in the BRD).
 *
 * Articles are authored in the admin Tiptap editor, so `content` is HTML. It is
 * sanitised on write rather than on render — the render path uses
 * dangerouslySetInnerHTML, and sanitising once at the boundary means a stored
 * payload can never reach a browser unfiltered.
 */

export { ARTICLE_CATEGORIES, estimateReadingMinutes, slugifyArticle } from "@/lib/article-types"
export type { Article } from "@/lib/article-types"

export const ARTICLES_COLLECTION = "articles"

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div",
]

export function sanitizeArticleHtml(html: unknown): string {
  if (typeof html !== "string") return ""
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class", "style", "colspan", "rowspan"],
    // Block javascript:/data: URLs in href and src.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  })
}

function toArticle(doc: any): Article {
  const normalized = normalizeId(doc)
  return {
    id: normalized.id,
    slug: normalized.slug || "",
    title: normalized.title || "",
    excerpt: normalized.excerpt || "",
    content: normalized.content || "",
    coverImage: normalized.coverImage || "",
    category: normalized.category || "Buying Guides",
    tags: Array.isArray(normalized.tags) ? normalized.tags : [],
    author: normalized.author || "Sara Electronics",
    status: normalized.status === "draft" ? "draft" : "published",
    publishedAt: normalized.publishedAt ? new Date(normalized.publishedAt).toISOString() : null,
    seoTitle: normalized.seoTitle || null,
    seoDescription: normalized.seoDescription || null,
    relatedProductIds: Array.isArray(normalized.relatedProductIds) ? normalized.relatedProductIds : [],
    readingMinutes: Number(normalized.readingMinutes) || estimateReadingMinutes(normalized.content || ""),
    createdAt: normalized.createdAt ? new Date(normalized.createdAt).toISOString() : null,
    updatedAt: normalized.updatedAt ? new Date(normalized.updatedAt).toISOString() : null,
  }
}

const PUBLISHED_FILTER = { status: { $ne: "draft" } }

export async function listArticles(options: {
  category?: string | null
  tag?: string | null
  limit?: number
  includeDrafts?: boolean
} = {}): Promise<Article[]> {
  try {
    const collection = await getCollection(ARTICLES_COLLECTION)
    const filter: Record<string, unknown> = options.includeDrafts ? {} : { ...PUBLISHED_FILTER }
    if (options.category) filter.category = options.category
    if (options.tag) filter.tags = options.tag

    let query = collection.find(filter).sort({ publishedAt: -1, createdAt: -1 })
    if (options.limit && options.limit > 0) query = query.limit(options.limit)

    return (await query.toArray()).map(toArticle)
  } catch {
    // A missing collection must not break the storefront.
    return []
  }
}

export async function getArticleBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {},
): Promise<Article | null> {
  try {
    const collection = await getCollection(ARTICLES_COLLECTION)
    const filter: Record<string, unknown> = options.includeDrafts
      ? { slug }
      : { slug, ...PUBLISHED_FILTER }
    const doc = await collection.findOne(filter)
    return doc ? toArticle(doc) : null
  } catch {
    return null
  }
}

/** Same-category articles, excluding the one being read. */
export async function getRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const siblings = await listArticles({ category: article.category, limit: limit + 1 })
  return siblings.filter((candidate) => candidate.slug !== article.slug).slice(0, limit)
}

export async function getArticleCategories(): Promise<{ name: string; count: number }[]> {
  const articles = await listArticles()
  const counts = new Map<string, number>()
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) || 0) + 1)
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

export function buildArticleJsonLd(article: Article, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    ...(article.coverImage ? { image: article.coverImage } : {}),
    author: { "@type": "Organization", name: article.author },
    publisher: {
      "@type": "Organization",
      name: "Sara Electronics",
      url: origin,
    },
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${origin}/blog/${article.slug}`,
    },
  }
}
