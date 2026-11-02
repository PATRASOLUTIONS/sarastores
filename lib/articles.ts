import DOMPurify from "isomorphic-dompurify"
import { getCollection, normalizeId } from "@/lib/db-service"
import { estimateReadingMinutes, type Article } from "@/lib/article-types"
import { absoluteSeoImage } from "@/lib/seo-metadata"
import type { Document } from "mongodb"
import { load } from "cheerio"

/**
 * Buying guides and articles ("CONTENT / BLOG" in the BRD).
 *
 * Articles are authored in the admin Tiptap editor, so `content` is HTML. It is
 * sanitised on write. The public render helper also sanitises legacy content
 * and makes authored title headings body sections without changing stored data.
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

/** The page owns its h1; retain authored headings as body sections without DB writes. */
export function renderArticleHtml(html: unknown): string {
  const $ = load(sanitizeArticleHtml(html), undefined, false)
  $("h1").each((_, heading) => {
    const sectionHeading = $("<h2></h2>")
    const attributes = $(heading).attr()
    if (attributes) sectionHeading.attr(attributes)
    sectionHeading.append($(heading).contents())
    $(heading).replaceWith(sectionHeading)
  })
  return $.html()
}

function articleText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function articleDate(value: unknown): string | null {
  if (value == null || value === "" || !(typeof value === "string" || typeof value === "number" || Object.prototype.toString.call(value) === "[object Date]")) return null
  const date = new Date(value as string | number)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function articleImage(value: unknown): string {
  const source = articleText(value).trim()
  if (!source || /[\u0000-\u001f\u007f]/.test(source)) return ""
  if (source.startsWith("/") && !source.startsWith("//")) return source
  try {
    const url = new URL(source)
    return url.protocol === "https:" && !url.username && !url.password ? source : ""
  } catch { return "" }
}

function publicArticle(article: Article): boolean {
  return Boolean(article.title.trim() && article.slug.trim())
}

function toArticle(doc: Document): Article {
  const normalized = normalizeId(doc)
  const content = articleText(normalized.content)
  const readingMinutes = Number(normalized.readingMinutes)
  return {
    id: articleText(normalized.id),
    slug: articleText(normalized.slug),
    title: articleText(normalized.title),
    excerpt: articleText(normalized.excerpt),
    content,
    coverImage: articleImage(normalized.coverImage),
    category: articleText(normalized.category, "Buying Guides") || "Buying Guides",
    tags: Array.isArray(normalized.tags) ? normalized.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
    author: articleText(normalized.author, "Sara Electronics") || "Sara Electronics",
    status: normalized.status === "draft" ? "draft" : "published",
    publishedAt: articleDate(normalized.publishedAt),
    seoTitle: articleText(normalized.seoTitle) || null,
    seoDescription: articleText(normalized.seoDescription) || null,
    relatedProductIds: Array.isArray(normalized.relatedProductIds) ? normalized.relatedProductIds.filter((id: unknown): id is string => typeof id === "string") : [],
    readingMinutes: Number.isFinite(readingMinutes) && readingMinutes > 0 ? readingMinutes : estimateReadingMinutes(content),
    createdAt: articleDate(normalized.createdAt),
    updatedAt: articleDate(normalized.updatedAt),
  }
}

const PUBLISHED_FILTER = { status: { $ne: "draft" } }

export async function listArticles(options: {
  category?: string | null
  tag?: string | null
  limit?: number
  includeDrafts?: boolean
  strict?: boolean
} = {}): Promise<Article[]> {
  try {
    const collection = await getCollection(ARTICLES_COLLECTION)
    const filter: Record<string, unknown> = options.includeDrafts ? {} : { ...PUBLISHED_FILTER }
    if (options.category) filter.category = options.category
    if (options.tag) filter.tags = options.tag

    let query = collection.find(filter).sort({ publishedAt: -1, createdAt: -1 })
    if (options.limit && options.limit > 0) query = query.limit(options.limit)

    const articles = (await query.toArray()).map(toArticle)
    return options.includeDrafts ? articles : articles.filter(publicArticle)
  } catch (error) {
    if (options.strict) throw error
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
    const article = doc ? toArticle(doc) : null
    return article && (options.includeDrafts || publicArticle(article)) ? article : null
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
    ...(article.coverImage ? { image: absoluteSeoImage(article.coverImage, origin) } : {}),
    author: { "@type": "Organization", name: article.author },
    publisher: {
      "@type": "Organization",
      "@id": `${origin}#organization`,
      url: origin,
    },
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${origin}/blog/${encodeURIComponent(article.slug)}`,
    },
  }
}
