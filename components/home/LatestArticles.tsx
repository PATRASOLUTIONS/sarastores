"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, BookOpen, Clock } from "lucide-react"

interface ArticleCard {
  slug: string
  title: string
  excerpt: string
  coverImage: string
  category: string
  readingMinutes: number
}

/** "LATEST ARTICLES" on the homepage — organic entry point into the funnel. */
export default function LatestArticles() {
  const [articles, setArticles] = useState<ArticleCard[]>([])

  useEffect(() => {
    let cancelled = false
    fetch("/api/articles?limit=3")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.articles)) setArticles(data.articles)
      })
      .catch(() => {
        /* section hides itself when empty */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (articles.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary-subtle px-3 py-1 text-xs font-semibold text-brand-primary">
            <BookOpen className="h-3.5 w-3.5" />
            Buying guides
          </span>
          <h2 className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            Not sure which one to buy?
          </h2>
          <p className="mt-1 max-w-lg text-sm text-gray-600">
            Practical advice from the team that sells and services these products every day.
          </p>
        </div>
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
        >
          All guides
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/blog/${article.slug}`}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 transition-shadow hover:shadow-md"
            >
              {article.coverImage && (
                <div className="relative h-36 w-full">
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
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{article.excerpt}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readingMinutes} min read
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
