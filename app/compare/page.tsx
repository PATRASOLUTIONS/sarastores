"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from '@/components/Header'
import { useCompare } from "@/hooks/useCompare"
import { useCart } from "@/hooks/useCart"
import { cleanProductName } from "@/utils/cleanProductName"
import { ShoppingCart, X } from "lucide-react"
import { formatPrice } from "@/utils/formatPrice"
import { toast } from "react-hot-toast"

export default function ComparePage() {
  const { compareIds, removeFromCompare, clearCompare, addToCompare } = useCompare()
    // Prevent adding more than 6 products to compare
    useEffect(() => {
      if (compareIds && compareIds.length > 6) {
        toast.error('You can compare a maximum of 6 products.');
      }
    }, [compareIds]);
  const { addToCart } = useCart()
  const [products, setProducts] = useState<any[]>([])
  const [specs, setSpecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProductsAndSpecs = async () => {
      setLoading(true)
      setError(null)
      try {
        if (!compareIds || compareIds.length === 0) {
          setProducts([])
          setSpecs([])
          setLoading(false)
          return
        }
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        // Fetch product objects
        const res = await fetch(`${base}/api/products/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: compareIds, compare: true })
        })
        if (!res.ok) throw new Error("Failed to fetch products")
        const data = await res.json()
        const prods = Array.isArray(data) ? data : (data.items || [])
        setProducts(prods)
        // Fetch product_specification for each SKU
        const specResults = await Promise.all(
          prods.map(async (p: any) => {
            const sku = p.sku || p.SKU
            if (!sku) return null
            try {
              const specRes = await fetch(`${base}/api/products/specifications/${encodeURIComponent(sku)}`)
              if (!specRes.ok) return null
              const specData = await specRes.json()
              // Prefer technical_details if present, else the whole object
              return specData?.technical_details || specData
            } catch {
              return null
            }
          })
        )
        setSpecs(specResults)
      } catch (e: any) {
        setError(e.message || "Unknown error")
      }
      setLoading(false)
    }
    fetchProductsAndSpecs()
  }, [compareIds])

  // Build a master list of all unique spec keys from product_specification (API)
  const allSpecKeys = useMemo(() => {
    const keys = new Set<string>()
    specs.forEach((spec: any) => {
      if (spec && typeof spec === 'object') {
        Object.keys(spec).forEach(k => keys.add(k))
      }
    })
    return Array.from(keys)
  }, [specs])

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen pb-16">
      <Header />
      <div className="mb-8 sticky top-20 z-20 bg-white/80 backdrop-blur p-6 rounded-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-blue-100">
        <div>
          <nav className="text-sm text-blue-500 mb-1">
            <Link href="/products" className="hover:underline">Products</Link>
            <span className="mx-2">/</span>
            <span className="text-blue-700 font-semibold">Compare</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900 drop-shadow-sm">Product Comparison</h1>
          <p className="text-base text-blue-700 mt-2">Compare technical specifications of selected products side-by-side.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/products" className="px-4 py-2 bg-white border border-blue-200 rounded-lg text-base font-medium text-blue-700 hover:bg-blue-50 shadow-sm transition">Back to products</Link>
          <button onClick={() => { clearCompare(); toast.success('Compare cleared') }} className="px-4 py-2 bg-blue-100 rounded-lg text-base font-medium text-blue-700 hover:bg-blue-200 transition">Clear</button>
        </div>
      </div>
      {error && <div className="text-red-600 mb-4 text-center font-semibold">{error}</div>}
      {loading && <div className="text-center py-10 text-blue-700 text-lg font-semibold animate-pulse">Loading...</div>}
      {(!compareIds || compareIds.length === 0) && (!products || products.length === 0) && (!specs || specs.length === 0) && (
        <div className="text-center py-24">
          <p className="text-blue-700 text-lg font-semibold">No products selected for comparison.</p>
          <Link href="/products" className="inline-block mt-6 px-6 py-3 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-primary-hover transition">Browse products</Link>
        </div>
      )}
      {products && products.length > 0 && (
        <div className="overflow-x-auto">
          <div className=" mx-auto max-w-[98vw] backdrop-blur-sm">
            <table className="min-w-full rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <th className="p-4 border-b text-left w-56 text-blue-900 text-lg font-bold tracking-wide">Specification</th>
                  {products.map((p: any, idx: number) => {
                    let firstImage = null;
                    const spec = specs[idx];
                    if (spec) {
                      if (Array.isArray(spec.specification_images) && spec.specification_images.length > 0) {
                        firstImage = spec.specification_images[0];
                      } else if (Array.isArray(spec.images) && spec.images.length > 0) {
                        firstImage = spec.images[0];
                      }
                    }
                    if (!firstImage && Array.isArray(p.images) && p.images.length > 0) {
                      firstImage = p.images[0];
                    }
                    if (!firstImage && p.image) {
                      firstImage = p.image;
                    }
                    if (!firstImage) {
                      firstImage = "/placeholder.svg?height=80&width=80&text=No+Image";
                    }
                    return (
                      <th key={p.id || p._id || idx} className="p-4 border-b text-left min-w-[220px] align-top">
                        <div className="flex flex-col items-center gap-2 w-full max-w-[200px] mx-auto">
                          <img src={firstImage} alt={cleanProductName(p.name)} className="h-20 w-20 object-contain rounded-xl border-2 border-blue-200 bg-white shadow" />
                          <div className="flex flex-col items-center w-full">
                            <span
                              className="font-semibold text-base text-blue-900 leading-tight drop-shadow-sm text-center w-full line-clamp-3"
                              style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '3.6em' }}
                              title={cleanProductName(p.name)}
                            >
                              {cleanProductName(p.name)}
                            </span>
                            {p.name && p.name.length > 60 && (
                              <button
                                className="text-xs text-blue-600 underline mt-1 hover:text-blue-800 focus:outline-none"
                                onClick={() => window.alert(cleanProductName(p.name))}
                              >
                                View more
                              </button>
                            )}
                            <span className="text-blue-700 font-bold text-base text-center">{formatPrice(p.price)}</span>
                            <div className="flex gap-2 mt-1 justify-center w-full">
                              <button onClick={() => { removeFromCompare(p.id || p._id); toast.success('Removed from compare') }} className="p-2 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 hover:shadow transition" title="Remove from compare"><X className="h-4 w-4" /></button>
                              <button onClick={() => { addToCart({ id: p.id || p._id, name: cleanProductName(p.name), price: p.price, image: firstImage, quantity: 1 } as any); toast.success('Added to cart') }} className="px-3 py-2 bg-brand-accent text-white rounded-lg shadow hover:bg-brand-accent-hover transition flex items-center gap-1" title="Add to cart"><ShoppingCart className="h-4 w-4" />Add</button>
                            </div>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allSpecKeys
                  .filter((specKey) => {
                    const lower = specKey.toLowerCase();
                    return (
                      lower !== 'reviews' &&
                      lower !== 'review' &&
                      lower !== 'customer reviews' &&
                      lower !== 'best sellers rank' &&
                      lower !== 'bestsellersrank' &&
                      lower !== 'packer'
                    );
                  })
                  .map((specKey, rowIdx) => (
                    <tr key={specKey} className={rowIdx % 2 === 0 ? "bg-blue-50/40 hover:bg-blue-100/60" : "bg-white hover:bg-blue-50/60"}>
                      <td className="p-4 font-semibold text-blue-900 bg-blue-50/60 border-r border-blue-100 w-56 text-base tracking-tight">{specKey}</td>
                      {specs.map((spec: any, idx: number) => (
                        <td key={products[idx]?.id || products[idx]?._id || idx} className="p-4 text-blue-900 text-base text-center align-middle">
                          {spec && spec[specKey] ? (
                            <span className="whitespace-pre-line break-words">{spec[specKey]}</span>
                          ) : (
                            <span className="text-blue-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
