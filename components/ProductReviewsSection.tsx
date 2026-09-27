"use client"

import { useState, useMemo } from "react"
import { Star, ThumbsUp, ThumbsDown, CheckCircle2, ChevronDown, Camera, User, Search } from "lucide-react"
import WriteReviewForm from "@/components/WriteReviewForm"

interface ReviewAuthor {
  name?: string
  avatar?: string
  location?: string
}

interface ProductInfo {
  id: string
  name: string
  image: string
}

interface CustomerReview {
  id: string | number
  name: string
  avatar?: string
  rating: number
  date: string
  title: string
  content: string
  verified?: boolean
  helpful?: number
  images?: string[]
  product?: ProductInfo
}

interface ProductReviewsSectionProps {
  productId: string
  productName: string
  productImage: string
  /** Reviews seeded from the product record. Field names vary by source. */
  seedReviews?: Array<{
    title?: string
    rating?: number | string
    body?: string
    text?: string
    content?: string
    author?: string
    name?: string
    date?: string
  }> | null
  /** Aggregate stats from the product. */
  average?: number
  count?: number
  /** Drop the outer card chrome when rendered inside a panel that already has it. */
  embedded?: boolean
}

const SENTIMENT_BUCKETS = [
  { key: 5, label: "Excellent" },
  { key: 4, label: "Very Good" },
  { key: 3, label: "Good" },
  { key: 2, label: "Fair" },
  { key: 1, label: "Poor" },
]

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return d
  }
}

export default function ProductReviewsSection({
  productId,
  productName,
  productImage,
  seedReviews,
  average,
  count,
  embedded = false,
}: ProductReviewsSectionProps) {
  const [activeFilter, setActiveFilter] = useState<number | "all" | "photo">("all")
  const [sortBy, setSortBy] = useState<"recent" | "helpful" | "highest" | "lowest">("recent")
  const [search, setSearch] = useState("")
  const [helpfulMap, setHelpfulMap] = useState<Record<string, 0 | 1 | -1>>({})
  const [writeOpen, setWriteOpen] = useState(false)

  // Normalize seed reviews from the product_specifications collection
  const seed = useMemo<CustomerReview[]>(() => {
    if (!Array.isArray(seedReviews)) return []
    return seedReviews.map((r, i) => {
      const ratingNum =
        typeof r.rating === "number"
          ? r.rating
          : parseFloat(String(r.rating || "0").match(/(\d+\.?\d*)/)?.[1] || "0")
      const rawTitle = r.title || ""
      const cleanTitle = rawTitle.replace(/^\d+\.?\d*\s*out of \d+\s*stars?\s*/i, "").trim()
      return {
        id: `seed-${i}`,
        name: r.author || r.name || "Verified Buyer",
        rating: ratingNum || 5,
        date: r.date || new Date().toISOString(),
        title: cleanTitle || "Customer review",
        content: r.body || r.text || r.content || "",
        verified: true,
        helpful: 0,
        product: { id: productId, name: productName, image: productImage },
      }
    })
  }, [seedReviews, productId, productName, productImage])

  // Compute aggregate
  const stats = useMemo(() => {
    const all = seed
    const total = count || all.length
    const avg = average ?? (all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0)
    const histogram: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of all) {
      const k = Math.min(5, Math.max(1, Math.round(r.rating)))
      histogram[k] = (histogram[k] || 0) + 1
    }
    return { total, avg, histogram }
  }, [seed, average, count])

  const filtered = useMemo<CustomerReview[]>(() => {
    let list = [...seed]
    if (activeFilter === "photo") {
      list = list.filter((r) => Array.isArray(r.images) && r.images.length > 0)
    } else if (typeof activeFilter === "number") {
      list = list.filter((r) => Math.round(r.rating) === activeFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q),
      )
    }
    switch (sortBy) {
      case "highest":
        list.sort((a, b) => b.rating - a.rating)
        break
      case "lowest":
        list.sort((a, b) => a.rating - b.rating)
        break
      case "helpful":
        list.sort((a, b) => (helpfulMap[b.id] ? b.helpful! + 1 : b.helpful || 0) - (helpfulMap[a.id] ? a.helpful! + 1 : a.helpful || 0))
        break
      default:
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return list
  }, [seed, activeFilter, sortBy, search, helpfulMap])

  const toggleHelpful = (id: string, dir: 1 | -1) => {
    setHelpfulMap((prev) => ({ ...prev, [id]: prev[id] === dir ? 0 : dir }))
  }

  const renderedStars = (rating: number, size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
    return (
      <div className="inline-flex items-center" role="img" aria-label={`${rating} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const fillPct = Math.min(1, Math.max(0, rating - i))
          return (
            <span key={i} className="relative inline-block">
              <Star className={`${sizeClass} text-gray-300`} fill="currentColor" stroke="none" />
              {fillPct > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPct * 100}%` }}
                >
                  <Star className={`${sizeClass} text-amber-500`} fill="currentColor" stroke="none" />
                </span>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  // Top-rated review (5★ most helpful)
  const topPositive = useMemo(
    () => [...seed].sort((a, b) => b.rating - a.rating || (b.helpful || 0) - (a.helpful || 0))[0],
    [seed],
  )

  // Sentiment (mood) — Amazon's "Customers say" gauge
  const sentiment = useMemo(() => {
    if (!seed.length) return null
    const positive = seed.filter((r) => r.rating >= 4).length
    const critical = seed.filter((r) => r.rating <= 2).length
    const positivePct = Math.round((positive / seed.length) * 100)
    const criticalPct = Math.round((critical / seed.length) * 100)
    let label = "Mixed opinions"
    if (positivePct >= 75) label = "Customers love it"
    else if (positivePct >= 50) label = "Mostly positive"
    else if (positivePct < 30) label = "Customers are critical"
    return { positivePct, criticalPct, label }
  }, [seed])

  return (
    <section
      id="reviews"
      className={
        embedded
          ? "scroll-mt-24"
          : "scroll-mt-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8"
      }
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Customer Reviews</h2>
          <div className="mt-2 flex items-center gap-3">
            {renderedStars(stats.avg || 0, "md")}
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{(stats.avg || 0).toFixed(1)}</span>
            <span className="text-sm text-gray-500">· {stats.total.toLocaleString("en-IN")} ratings</span>
          </div>
          {sentiment && (
            <div className="mt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Customers say</span>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-semibold">{sentiment.label}</span>{" "}
                <span className="text-gray-500">
                  — {sentiment.positivePct}% positive, {sentiment.criticalPct}% critical
                </span>
              </p>
              <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-gray-200 overflow-hidden flex">
                <span
                  className="h-full bg-emerald-500"
                  style={{ width: `${sentiment.positivePct}%` }}
                  aria-hidden
                />
                <span className="h-full bg-amber-400" style={{ width: `${Math.max(0, 100 - sentiment.positivePct - sentiment.criticalPct)}%` }} aria-hidden />
                <span
                  className="h-full bg-rose-500"
                  style={{ width: `${sentiment.criticalPct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWriteOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary-subtle transition-colors"
        >
          <User className="h-4 w-4" />
          Write a review
        </button>
      </div>

      <WriteReviewForm
        productId={productId}
        productName={productName}
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
      />

      {/* Histogram */}
      {seed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 pb-6 border-b border-gray-100">
          <div className="space-y-2">
            {SENTIMENT_BUCKETS.map((b) => {
              const count = stats.histogram[b.key] || 0
              const pct = seed.length ? Math.round((count / seed.length) * 100) : 0
              return (
                <button
                  key={b.key}
                  onClick={() => setActiveFilter((cur) => (cur === b.key ? "all" : b.key))}
                  className={`group w-full flex items-center gap-3 text-left rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors ${
                    activeFilter === b.key ? "bg-brand-primary-subtle ring-1 ring-brand-primary/20" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-gray-700 w-16">{b.key} star</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 group-hover:from-amber-500 group-hover:to-amber-600 transition-colors"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums w-20 text-right">
                    {pct}% &nbsp;<span className="text-gray-400">({count})</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Review this product</h3>
            <p className="text-sm text-gray-600">Share your thoughts with other customers</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setWriteOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors"
              >
                <Star className="h-4 w-4" />
                Write a customer review
              </button>
              <button
                type="button"
                onClick={() => setWriteOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary-subtle transition-colors"
              >
                <Camera className="h-4 w-4" />
                Share a photo
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed pt-2">
              By submitting, you agree to our review guidelines. Reviews are not edited for content, but may be moderated.
            </p>
          </div>
        </div>
      )}

      {/* Filters / Search / Sort */}
      {seed.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: "all", label: `All (${seed.length})` },
                { k: 5, label: "5★" },
                { k: 4, label: "4★" },
                { k: 3, label: "3★" },
                { k: 2, label: "2★" },
                { k: 1, label: "1★" },
                { k: "photo", label: "With photo" },
              ] as const
            ).map((chip) => {
              const isActive = activeFilter === chip.k
              return (
                <button
                  key={String(chip.k)}
                  onClick={() => setActiveFilter(chip.k as typeof activeFilter)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-brand-primary/40 hover:text-brand-primary"
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
          <div className="flex-1 flex items-center gap-2 md:justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviews"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-brand-primary/40 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none cursor-pointer"
              >
                <option value="recent">Most recent</option>
                <option value="helpful">Most helpful</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Top positive review highlight */}
      {topPositive && topPositive.rating >= 4 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Top Review</span>
            {renderedStars(topPositive.rating, "sm")}
            <span className="text-xs font-semibold text-amber-700">{topPositive.rating.toFixed(1)}</span>
          </div>
          <h4 className="font-bold text-gray-900 mb-1">{topPositive.title}</h4>
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{topPositive.content}</p>
          <div className="mt-2 text-xs text-gray-500">
            — {topPositive.name}, <span className="text-gray-400">{formatDate(topPositive.date)}</span>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {filtered.map((r) => (
            <article key={r.id} className="py-5 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-primary-hover flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {r.name?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{r.name}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {renderedStars(r.rating, "sm")}
                    <span className="text-xs text-gray-500">{formatDate(r.date)}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-gray-900">{r.title}</h4>
                  <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{r.content}</p>
                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {r.images.map((img, i) => (
                        <a
                          key={i}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-16 h-16 rounded-md overflow-hidden border border-gray-200 hover:border-brand-primary"
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span>Helpful?</span>
                    <button
                      onClick={() => toggleHelpful(String(r.id), 1)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                        helpfulMap[r.id] === 1
                          ? "border-brand-primary bg-brand-primary-subtle text-brand-primary"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Yes <span className="tabular-nums">{(r.helpful || 0) + (helpfulMap[r.id] === 1 ? 1 : 0)}</span>
                    </button>
                    <button
                      onClick={() => toggleHelpful(String(r.id), -1)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                        helpfulMap[r.id] === -1
                          ? "border-rose-500 bg-rose-50 text-rose-600"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      No
                    </button>
                    <span className="mx-1">·</span>
                    <button className="hover:text-brand-primary">Report</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : seed.length > 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No reviews match your filters.</div>
      ) : (
        <div id="write-review-anchor" className="py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Star className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No reviews yet</h3>
          <p className="text-sm text-gray-500 mb-4">Be the first to share your experience with this product.</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors"
          >
            Write a review
          </button>
        </div>
      )}

      {filtered.length >= 5 && (
        <div className="pt-6 mt-2 border-t border-gray-100 flex justify-center">
          <button className="text-sm font-semibold text-brand-primary hover:text-brand-primary-hover">
            See more reviews →
          </button>
        </div>
      )}
    </section>
  )
}
