"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Plus, ShoppingCart } from "lucide-react"
import { toast } from "react-hot-toast"
import { useCart } from "@/hooks/useCart"
import { cleanProductName } from "@/utils/cleanProductName"
import { formatPrice } from "@/utils/formatPrice"

/**
 * "Frequently bought together" bundle ("CROSS-SELL / UPSELL" and
 * "BUNDLE SELLING" in the BRD).
 *
 * Companions are picked from the related products the product page already
 * loaded — cheaper items from the same catalogue neighbourhood, which is what
 * an accessory looks like without a dedicated accessory relationship on the
 * product model. Add a real `accessoryOf` field later and swap the source.
 */

interface BundleProduct {
  id: string
  name: string
  price: number
  image?: string
  slug?: string
  stock?: number
}

/** Companions must be genuine add-ons, not alternatives to the main product. */
const MAX_COMPANION_PRICE_RATIO = 0.6
const MAX_COMPANIONS = 2

export default function FrequentlyBoughtTogether({
  product,
  candidates,
}: {
  product: BundleProduct
  candidates: BundleProduct[]
}) {
  const companions = useMemo(
    () =>
      candidates
        .filter(
          (candidate) =>
            candidate.id !== product.id &&
            candidate.price > 0 &&
            candidate.price <= product.price * MAX_COMPANION_PRICE_RATIO &&
            (candidate.stock === undefined || candidate.stock > 0),
        )
        .sort((a, b) => b.price - a.price)
        .slice(0, MAX_COMPANIONS),
    [candidates, product.id, product.price],
  )

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const { addToCart } = useCart()

  const chosen = companions.filter((c) => selected[c.id] !== false)
  const bundleTotal = product.price + chosen.reduce((sum, item) => sum + item.price, 0)

  if (companions.length === 0) return null

  const handleAddBundle = async () => {
    setAdding(true)
    try {
      for (const item of [product, ...chosen]) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image || "/placeholder.svg",
          quantity: 1,
          color: null,
          size: null,
        })
      }
      toast.success(`Added ${chosen.length + 1} items to your cart`)
    } catch {
      toast.error("Could not add the bundle to your cart")
    } finally {
      setAdding(false)
    }
  }

  const renderTile = (item: BundleProduct, isMain: boolean) => (
    <div className="flex w-32 flex-col items-center text-center">
      <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Image
          src={item.image || "/placeholder.svg"}
          alt={cleanProductName(item.name)}
          fill
          sizes="96px"
          className="object-contain p-1"
        />
      </div>
      <Link
        href={`/product/${item.slug || item.id}`}
        className="mt-2 line-clamp-2 text-xs text-gray-700 hover:text-brand-primary hover:underline"
      >
        {cleanProductName(item.name)}
      </Link>
      <span className="mt-1 text-sm font-semibold text-gray-900">{formatPrice(item.price)}</span>
      {isMain ? (
        <span className="mt-1 text-[11px] font-medium text-brand-primary">This item</span>
      ) : (
        <label className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
          <input
            type="checkbox"
            checked={selected[item.id] !== false}
            onChange={(event) =>
              setSelected((prev) => ({ ...prev, [item.id]: event.target.checked }))
            }
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Include
        </label>
      )}
    </div>
  )

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-[15px] font-bold text-gray-900">Frequently bought together</h2>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-start gap-3">
          {renderTile(product, true)}
          {companions.map((companion) => (
            <div key={companion.id} className="flex items-start gap-3">
              <Plus className="mt-8 h-4 w-4 shrink-0 text-gray-400" />
              {renderTile(companion, false)}
            </div>
          ))}
        </div>

        <div className="lg:ml-auto lg:border-l lg:border-gray-100 lg:pl-6">
          <p className="text-sm text-gray-600">
            Total for {chosen.length + 1} {chosen.length === 0 ? "item" : "items"}
          </p>
          <p className="text-xl font-bold text-gray-900">{formatPrice(bundleTotal)}</p>
          <button
            type="button"
            onClick={handleAddBundle}
            disabled={adding}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ShoppingCart className="h-4 w-4" />
            {adding ? "Adding…" : "Add all to cart"}
          </button>
        </div>
      </div>
    </section>
  )
}
