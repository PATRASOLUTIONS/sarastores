import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Clock, Tag } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ArticleProductRail from "./ArticleProductRail"
import {
  buildArticleJsonLd,
  getArticleBySlug,
  getRelatedArticles,
  listArticles,
} from "@/lib/articles"

export const revalidate = 900

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

export async function generateStaticParams() {
  const articles = await listArticles({ limit: 50 })
  return articles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: "Article not found" }

  return {
    title: article.seoTitle || `${article.title} — Sara Electronics`,
    description: article.seoDescription || article.excerpt,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt,
      ...(article.coverImage ? { images: [article.coverImage] } : {}),
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) notFound()

  const related = await getRelatedArticles(article)
  const jsonLd = buildArticleJsonLd(article, getOrigin())

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container mx-auto flex-grow px-4 py-10">
        <article className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
            <Link href="/" className="hover:text-brand-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-brand-primary">
              Buying guides
            </Link>
            <span className="mx-2">/</span>
            <span className="line-clamp-1 inline text-gray-900">{article.title}</span>
          </nav>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary-subtle px-2.5 py-1 text-xs font-medium text-brand-primary">
            <Tag className="h-3 w-3" />
            {article.category}
          </span>

          <h1 className="mt-3 text-2xl font-bold text-gray-900 md:text-4xl">{article.title}</h1>

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>{article.author}</span>
            {article.publishedAt && (
              <time dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {article.readingMinutes} min read
            </span>
          </p>

          {article.coverImage && (
            <div className="relative mt-6 h-64 w-full overflow-hidden rounded-2xl md:h-96">
              <Image
                src={article.coverImage}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <p className="mt-6 text-lg text-gray-700">{article.excerpt}</p>

          {/* Sanitised on write in lib/articles.ts, never on render. */}
          <div
            className="prose prose-slate mt-6 max-w-none prose-headings:font-bold prose-a:text-brand-primary"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {article.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2 border-t border-gray-200 pt-6">
              {article.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:border-gray-400"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        {article.relatedProductIds.length > 0 && (
          <div className="mx-auto mt-10 max-w-5xl">
            <ArticleProductRail productIds={article.relatedProductIds} />
          </div>
        )}

        {related.length > 0 && (
          <section className="mx-auto mt-12 max-w-5xl">
            <h2 className="text-lg font-semibold text-gray-900">More {article.category} guides</h2>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/blog/${entry.slug}`}
                    className="block h-full rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <h3 className="line-clamp-2 font-semibold text-gray-900">{entry.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{entry.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
