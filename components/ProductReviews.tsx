"use client"

import { useState, useEffect, useRef } from "react"
import { Star, ChevronLeft, ChevronRight, User } from "lucide-react"

// Define the Review type
interface Review {
  id: string | number
  name: string
  avatar: string
  rating: number
  date: string
  title: string
  content: string
  verified: boolean
  product: {
    id: string
    name: string
    image: string
  }
}

interface ProductReviewsProps {
  productId?: string // Optional product ID to filter reviews
  title?: string // Optional custom title for the header
}

export default function ProductReviews({ productId, title = "Customer Reviews" }: ProductReviewsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reviewsContainerRef = useRef<HTMLDivElement>(null)
  const isMounted = useRef(true)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    isMounted.current = true

    // Load reviews from API
    const fetchReviews = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Construct URL with optional productId filter
        const url = productId ? `/api/reviews?productId=${encodeURIComponent(productId)}` : "/api/reviews"

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error("Failed to fetch reviews")
        }

        const data = await response.json()
        if (isMounted.current) {
          setReviews(data.filter((review: Review) => review.rating >= 3))
        }
      } catch (err) {
        console.error("Error loading reviews:", err)
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : "An unknown error occurred")
        }

        // Fallback to localStorage
        try {
          const storedReviews = localStorage.getItem("productReviews")
          if (storedReviews) {
            const allReviews = JSON.parse(storedReviews)
            // Filter reviews by productId if specified
            const filteredReviews = productId
              ? allReviews.filter((review: Review) => review.product.id === productId)
              : allReviews

            if (isMounted.current) {
              setReviews(filteredReviews.filter((review: Review) => review.rating >= 3))
            }
          }
        } catch (localError) {
          console.error("Error loading from localStorage:", localError)
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false)
        }
      }
    }

    fetchReviews()

    return () => {
      isMounted.current = false
      // Clear all timers on unmount
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    }
  }, [productId])

  const nextReview = () => {
    if (isAnimating || !isMounted.current || reviews.length <= 1) return

    setIsAnimating(true)
    setActiveIndex((prev) => (prev + 1) % reviews.length)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setIsAnimating(false)
      }
    }, 500)

    timersRef.current.push(timer)
  }

  const prevReview = () => {
    if (isAnimating || !isMounted.current || reviews.length <= 1) return

    setIsAnimating(true)
    setActiveIndex((prev) => (prev - 1 + reviews.length) % reviews.length)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setIsAnimating(false)
      }
    }, 500)

    timersRef.current.push(timer)
  }

  const goToReview = (index: number) => {
    if (isAnimating || !isMounted.current || index === activeIndex || reviews.length <= 1) return

    setIsAnimating(true)
    setActiveIndex(index)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setIsAnimating(false)
      }
    }, 500)

    timersRef.current.push(timer)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 bg-blue-800 text-white">
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="p-12 text-center">
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 bg-blue-800 text-white">
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* <div className="p-6 bg-blue-800 text-white">
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">No reviews available for this product yet.</p>
          <button className="mt-4 bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors inline-flex items-center">
            <User className="mr-2 h-5 w-5" />
            Be the First to Write a Review
          </button>
        </div> */}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 bg-blue-800 text-white">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <div className="flex items-center gap-0.5 mr-2" role="img" aria-label={`${(reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)} out of 5 stars`}>
              {[...Array(5)].map((_, i) => {
                const avg = Math.round(reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length)
                return (
                  <Star
                    key={i}
                    className="h-5 w-5"
                    fill={i < avg ? "#facc15" : "#e5e7eb"}
                    stroke={i < avg ? "#eab308" : "#d1d5db"}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                )
              })}
            </div>
            <span className="font-medium">
              {(reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)} out of 5
            </span>
          </div>
          <span className="text-gray-500">{reviews.length} reviews</span>
        </div>

        {/* Navigation buttons outside the card */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={prevReview}
            className="bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors z-10 disabled:opacity-50"
            aria-label="Previous review"
            disabled={isAnimating || reviews.length <= 1}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>

          <div className="text-sm text-gray-500">
            Review {activeIndex + 1} of {reviews.length}
          </div>

          <button
            onClick={nextReview}
            className="bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors z-10 disabled:opacity-50"
            aria-label="Next review"
            disabled={isAnimating || reviews.length <= 1}
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="relative">
          <div ref={reviewsContainerRef} className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {reviews.map((review) => (
                <div key={review.id} className="w-full flex-shrink-0">
                  <div className="border rounded-lg p-6 max-w-3xl mx-auto">
                    {/* Product information */}
                    <div className="flex items-center mb-4 pb-4 border-b">
                      <div className="w-16 h-16 rounded-md overflow-hidden mr-4">
                        <img
                          src={review.product.image || "/placeholder.svg"}
                          alt={review.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Purchased</p>
                        <h4 className="font-medium">{review.product.name}</h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                          <img
                            src={review.avatar || "/placeholder.svg"}
                            alt={review.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center">
                            <h3 className="font-semibold mr-2">{review.name}</h3>
                            {review.verified && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <div className="flex items-center mt-1">
                            <div className="flex items-center gap-0.5 mr-2" role="img" aria-label={`${review.rating} out of 5 stars`}>
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-4 w-4"
                                  fill={i < review.rating ? "#facc15" : "#e5e7eb"}
                                  stroke={i < review.rating ? "#eab308" : "#d1d5db"}
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                            <span className="text-gray-500 text-sm">
                              {new Date(review.date).toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold mb-2">{review.title}</h4>
                    <p className="text-gray-700 mb-4">{review.content}</p>

                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <div className="flex items-center">
                        <button className="flex items-center hover:text-blue-800">
                          <span>Helpful</span>
                        </button>
                        <span className="mx-2">•</span>
                        <button className="hover:text-blue-800">Report</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dots navigation */}
        <div className="flex justify-center mt-6 space-x-2">
          {reviews.map((_, index) => (
            <button
              key={index}
              onClick={() => goToReview(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                activeIndex === index ? "w-6 bg-blue-800" : "bg-gray-300"
              }`}
              aria-label={`Go to review ${index + 1}`}
              disabled={isAnimating}
            />
          ))}
        </div>

        {/* Write a review button */}
        <div className="mt-8 text-center">
          <button className="bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors inline-flex items-center">
            <User className="mr-2 h-5 w-5" />
            Write a Review
          </button>
        </div>
      </div>
    </div>
  )
}
