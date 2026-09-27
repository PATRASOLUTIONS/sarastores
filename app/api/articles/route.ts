import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { requireAdmin, checkAdminAuthorization } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import {
  ARTICLES_COLLECTION,
  ARTICLE_CATEGORIES,
  estimateReadingMinutes,
  listArticles,
  sanitizeArticleHtml,
  slugifyArticle,
} from "@/lib/articles"

const ArticleSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z.string().max(90).optional(),
  excerpt: z.string().min(20).max(400),
  content: z.string().min(50),
  coverImage: z.string().max(2000).optional(),
  category: z.enum(ARTICLE_CATEGORIES).default("Buying Guides"),
  tags: z.array(z.string().max(40)).max(12).optional(),
  author: z.string().max(80).optional(),
  status: z.enum(["draft", "published"]).default("published"),
  seoTitle: z.string().max(160).nullish(),
  seoDescription: z.string().max(320).nullish(),
  relatedProductIds: z.array(z.string().max(64)).max(12).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const limitParam = Number(params.get("limit"))

    // Drafts are only ever visible to staff.
    const wantsDrafts = params.get("includeDrafts") === "true"
    const includeDrafts = wantsDrafts && (await checkAdminAuthorization()).authorized

    const articles = await listArticles({
      category: params.get("category"),
      tag: params.get("tag"),
      limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : undefined,
      includeDrafts,
    })

    return NextResponse.json({ success: true, articles })
  } catch (error) {
    return handleApiError(error, "Failed to fetch articles")
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = ArticleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const input = parsed.data
    const slug = slugifyArticle(input.slug || input.title)
    if (!slug) {
      return NextResponse.json({ error: "Could not derive a slug from the title" }, { status: 400 })
    }

    const collection = await getCollection(ARTICLES_COLLECTION)
    if (await collection.findOne({ slug })) {
      return NextResponse.json({ error: `An article with the slug '${slug}' already exists` }, { status: 409 })
    }

    const content = sanitizeArticleHtml(input.content)
    const now = new Date()

    const article = {
      slug,
      title: input.title,
      excerpt: input.excerpt,
      content,
      coverImage: input.coverImage || "",
      category: input.category,
      tags: input.tags || [],
      author: input.author || "Sara Electronics",
      status: input.status,
      publishedAt: input.status === "published" ? now : null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      relatedProductIds: input.relatedProductIds || [],
      readingMinutes: estimateReadingMinutes(content),
      createdAt: now,
      updatedAt: now,
    }

    const result = await collection.insertOne(article)
    return NextResponse.json({ success: true, article: { ...article, id: result.insertedId.toString() } })
  } catch (error) {
    return handleApiError(error, "Failed to create article")
  }
}
