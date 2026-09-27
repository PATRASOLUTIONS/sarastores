"use client"

import { useState } from "react"
import Link from "next/link"
import { Star, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Customer review submission ("REVIEWS" in the BRD).
 *
 * Mirrors the server-side `ReviewSchema` limits so the shopper sees validation
 * before the round trip. The verified-purchase badge is decided by the API from
 * order history, never claimed here.
 */

const MIN_TITLE = 5
const MIN_CONTENT = 20
const MAX_CONTENT = 2000

export default function WriteReviewForm({
  productId,
  productName,
  open,
  onClose,
  onSubmitted,
}: {
  productId: string
  productName?: string
  open: boolean
  onClose: () => void
  onSubmitted?: () => void
}) {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (rating < 1) return toast.error("Please choose a star rating")
    if (title.trim().length < MIN_TITLE) return toast.error(`Title must be at least ${MIN_TITLE} characters`)
    if (content.trim().length < MIN_CONTENT) {
      return toast.error(`Review must be at least ${MIN_CONTENT} characters`)
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim(),
          content: content.trim(),
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(data?.error || "Could not submit your review")
        return
      }

      toast.success("Thanks — your review has been posted")
      setRating(0)
      setTitle("")
      setContent("")
      onSubmitted?.()
      onClose()
    } catch {
      toast.error("Could not submit your review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Write a review"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Write a review</h2>
            {productName && <p className="mt-0.5 line-clamp-1 text-sm text-gray-600">{productName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="p-6">
            <p className="text-sm text-gray-700">
              Please sign in to review this product. Reviews are linked to your account so other
              shoppers can see which ones come from verified purchases.
            </p>
            <Link
              href={`/login?redirect=/product/${encodeURIComponent(productId)}`}
              className="mt-4 inline-block rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">Overall rating</legend>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    aria-pressed={rating === value}
                    className="rounded p-0.5"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        value <= (hoverRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="review-title" className="block text-sm font-medium text-gray-700">
                Headline
              </label>
              <input
                id="review-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                placeholder="Sum up your experience in a few words"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="review-content" className="block text-sm font-medium text-gray-700">
                Your review
              </label>
              <textarea
                id="review-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                maxLength={MAX_CONTENT}
                placeholder="What did you like or dislike? How did you use this product?"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                {content.trim().length}/{MAX_CONTENT} · minimum {MIN_CONTENT} characters
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Photo and video uploads are coming soon. Reviews may be moderated, but are not edited
              for content.
            </p>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Posting…" : "Post review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
