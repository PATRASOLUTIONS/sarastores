"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, ShoppingCart, Trash2, ExternalLink, Star } from "lucide-react"
import { useProductSpecImages } from "@/hooks/useProductSpecImages"
import { useWishlist } from "@/hooks/useWishlist"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"

export default function WishlistPage() {
  const { wishlist, isLoading, removeFromWishlist } = useWishlist()
  const { addToCart } = useCart()
  const { user } = useAuth()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const handleRemoveFromWishlist = async (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id))
    try {
      await removeFromWishlist(id)
    } finally {
      setRemovingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const handleAddToCart = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      color: null,
      size: null,
    })
    toast.success(`${product.name} added to cart`)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 bg-gray-50 border-b">
        <h2 className="text-xl font-semibold">My Wishlist</h2>
      </div>

      <div className="p-6">
       

        {wishlist.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
              <Heart className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Your wishlist is empty</h3>
            <p className="text-gray-600 mb-6">Save items you like to your wishlist and they'll appear here.</p>
            <Link href="/products">
              <button className="px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover transition-colors active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
                Explore Products
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((product) => (
              <WishlistCard
                key={product.id}
                product={product}
                removingIds={removingIds}
                onRemove={() => handleRemoveFromWishlist(product.id)}
                onAddToCart={() => handleAddToCart(product)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WishlistCard({
  product,
  removingIds,
  onRemove,
  onAddToCart,
}: {
  product: any
  removingIds: Set<string>
  onRemove: () => void
  onAddToCart: () => void
}) {
  const specImages = useProductSpecImages(product.sku || product.SKU || product.skuNo)
  const imageSrc =
    (specImages && specImages.length > 0 && specImages[0]) || product.image || "/placeholder.svg?height=300&width=300"
  const [isImageLoading, setIsImageLoading] = useState(true)

  return (
    <div className="group relative h-full flex flex-col border border-border rounded-2xl overflow-hidden bg-gradient-to-b from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
      {/* Saved Badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm border">
        <Heart className="h-4 w-4 text-red-500" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Saved</span>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        disabled={removingIds.has(product.id)}
        className="absolute top-3 right-3 z-20 p-2.5 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-red-950/50 transition-all duration-200 disabled:opacity-50"
        aria-label="Remove from wishlist"
      >
        {removingIds.has(product.id) ? (
          <div className="h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4 text-red-600" />
        )}
      </button>

      {/* Image Container */}
      <div className="relative w-full aspect-square bg-gray-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
        <Link href={`/product/${product.slug || product.id}`} className="absolute inset-0 z-10" aria-label={`Open ${product.name}`}>
          <div className="w-full h-full relative">
            {isImageLoading && <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 animate-pulse" />}
            <img
              src={imageSrc || "/placeholder.svg"}
              alt={product.name}
              onLoad={() => setIsImageLoading(false)}
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=300&width=300"
                setIsImageLoading(false)
              }}
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            />
            {/* Image overlay: subtle gradient for text readability */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10 dark:to-black/20 opacity-70" />

            {/* Price chip on image */}
            <div className="absolute left-3 bottom-3 z-20 bg-white/95 dark:bg-slate-900/85 border px-3 py-1 rounded-lg text-sm font-semibold text-foreground shadow-sm">
              ₹{product.price.toLocaleString("en-IN")}
            </div>

            {/* Discount pill */}
            {product.discount && (
              <div className="absolute right-3 top-3 z-20 bg-red-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                -{product.discount}%
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Content Container */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Title */}
        <Link href={`/product/${product.slug || product.id}`}>
          <h3 className="font-semibold text-sm line-clamp-2 text-foreground hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Description */}
        {product.description && <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>}

        {/* Rating (if available) */}
        {product.rating && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">({product.reviews || 0})</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAddToCart}
              className="flex items-center gap-2 px-3 py-2 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent-hover focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:ring-offset-2 transition-all duration-200 active:scale-95 text-sm shadow-sm"
            >
              <ShoppingCart className="h-4 w-4 text-white" />
              <span className="hidden sm:inline">Add to cart</span>
            </button>

            <Link href={`/product/${product.slug || product.id}`} className="flex-shrink-0">
              <button
                className="p-2.5 bg-white/95 text-gray-700 border border-border rounded-lg hover:bg-brand-primary-subtle hover:text-brand-primary transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:ring-offset-2"
                aria-label="View product details"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
