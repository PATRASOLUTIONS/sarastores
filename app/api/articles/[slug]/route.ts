import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { requireAdmin, checkAdminAuthorization } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import {
  ARTICLES_COLLECTION,
  ARTICLE_CATEGORIES,
  estimateReadingMinutes,
  getArticleBySlug,
  sanitizeArticleHtml,
  slugifyArticle,
} from "@/lib/articles"

const UpdateArticleSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  slug: z.string().max(90).optional(),
  excerpt: z.string().min(20).max(400).optional(),
  content: z.string().min(50).optional(),
  coverImage: z.string().max(2000).optional(),
  category: z.enum(ARTICLE_CATEGORIES).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  author: z.string().max(80).optional(),
  status: z.enum(["draft", "published"]).optional(),
  seoTitle: z.string().max(160).nullish(),
  seoDescription: z.string().max(320).nullish(),
  relatedProductIds: z.array(z.string().max(64)).max(12).optional(),
})

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const includeDrafts = (await checkAdminAuthorization()).authorized

    const article = await getArticleBySlug(slug, { includeDrafts })
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    return NextResponse.json({ success: true, article })
  } catch (error) {
    return handleApiError(error, "Failed to fetch article")
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { slug } = await context.params
    const parsed = UpdateArticleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const collection = await getCollection(ARTICLES_COLLECTION)
    const existing = await collection.findOne({ slug })
    if (!existing) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    const input = parsed.data
    const update: Record<string, unknown> = { updatedAt: new Date() }

    for (const key of ["title", "excerpt", "coverImage", "category", "tags", "author", "seoTitle", "seoDescription", "relatedProductIds"] as const) {
      if (input[key] !== undefined) update[key] = input[key]
    }

    if (input.content !== undefined) {
      const content = sanitizeArticleHtml(input.content)
      update.content = content
      update.readingMinutes = estimateReadingMinutes(content)
    }

    if (input.slug !== undefined) {
      const nextSlug = slugifyArticle(input.slug)
      if (!nextSlug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
      if (nextSlug !== slug && (await collection.findOne({ slug: nextSlug }))) {
        return NextResponse.json({ error: `An article with the slug '${nextSlug}' already exists` }, { status: 409 })
      }
      update.slug = nextSlug
    }

    if (input.status !== undefined) {
      update.status = input.status
      // Stamp the publish date the first time it goes live.
      if (input.status === "published" && !existing.publishedAt) update.publishedAt = new Date()
    }

    await collection.updateOne({ _id: existing._id }, { $set: update })
    const updated = await getArticleBySlug(String(update.slug || slug), { includeDrafts: true })

    return NextResponse.json({ success: true, article: updated })
  } catch (error) {
    return handleApiError(error, "Failed to update article")
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { slug } = await context.params
    const collection = await getCollection(ARTICLES_COLLECTION)
    const result = await collection.deleteOne({ slug })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to delete article")
  }
}
