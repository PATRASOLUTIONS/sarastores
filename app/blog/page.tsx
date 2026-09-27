import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Clock, Tag } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getArticleCategories, listArticles } from "@/lib/articles"

export const revalidate = 900

export const metadata: Metadata = {
  title: "Buying Guides & Electronics Advice — Sara Electronics",
  description:
    "Expert buying guides, comparisons and advice on TVs, refrigerators, washing machines, air conditioners, mobiles and laptops. Pick the right product at the right price.",
  alternates: { canonical: "/blog" },
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const [articles, categories] = await Promise.all([
    listArticles({ category: category || null }),
    getArticleCategories(),
  ])

  const [featured, ...rest] = articles

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

      <main className="container mx-auto flex-grow px-4 py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-brand-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Buying guides</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Buying guides &amp; advice</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Honest, practical guidance on choosing electronics and home appliances — written by the
          team that sells and services them across 85+ stores.
        </p>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/blog"
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                !category
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              All
            </Link>
            {categories.map((entry) => (
              <Link
                key={entry.name}
                href={`/blog?category=${encodeURIComponent(entry.name)}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  category === entry.name
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {entry.name} ({entry.count})
              </Link>
            ))}
          </div>
        )}

        {articles.length === 0 ? (
          <p className="mt-10 rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
            No articles published yet. Check back shortly, or{" "}
            <Link href="/products" className="font-medium text-brand-primary hover:underline">
              browse products
            </Link>
            .
          </p>
        ) : (
          <>
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="mt-8 block overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md md:flex"
              >
                {featured.coverImage && (
                  <div className="relative h-56 w-full md:h-auto md:w-2/5">
                    <Image
                      src={featured.coverImage}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary-subtle px-2.5 py-1 text-xs font-medium text-brand-primary">
                    <Tag className="h-3 w-3" />
                    {featured.category}
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">{featured.title}</h2>
                  <p className="mt-2 text-gray-600">{featured.excerpt}</p>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    {featured.readingMinutes} min read
                  </p>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/blog/${article.slug}`}
                      className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                    >
                      {article.coverImage && (
                        <div className="relative h-40 w-full">
                          <Image
                            src={article.coverImage}
                            alt={article.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-xs font-medium text-brand-primary">{article.category}</span>
                        <h3 className="mt-1.5 line-clamp-2 font-semibold text-gray-900">{article.title}</h3>
                        <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-600">{article.excerpt}</p>
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {article.readingMinutes} min read
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
