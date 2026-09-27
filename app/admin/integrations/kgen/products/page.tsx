"use client"

import { apiFetch } from "@/lib/api-client"
import { IntegrationError, readErrorMessage } from "../integration-error"
import React, { useEffect, useMemo, useState } from 'react'

type Variant = {
  variantID?: string
  variantName?: string
  variantDisplayName?: string
  mrp?: number
  price?: number
  margin?: number
  stock?: number
}

type Prod = {
  productID?: string
  productName?: string
  productDisplayName?: string
  descriptionText?: string
  attachments?: string[]
  categories?: Array<{ categoryName?: string }>
  variants?: Variant[]
  redemptionInstructions?: string
  termsAndConditions?: string
}

export default function KGenProductsPage() {
  const [items, setItems] = useState<Prod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [limit, setLimit] = useState<number>(15)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchProducts = async (opts: { append?: boolean;
 cursor?: string } = {}) => {
    const { append = false, cursor } = opts
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (limit) params.set('limit', String(limit))
      if (cursor) params.set('nextCursor', cursor)
      const url = `/api/integrations/exlr8/products?${params.toString()}`
      const res = await apiFetch(url)
      if (!res.ok) {
        throw new Error(await readErrorMessage(res))
      }
      const data = await res.json()
      const list: Prod[] = Array.isArray(data.products) ? data.products : (Array.isArray(data.data) ? data.data : [])
      const pagination = data.paginationInfo || data.meta || null
      const next = pagination?.nextCursor || pagination?.next_cursor || null
      const more = !!(pagination?.hasMore || pagination?.has_more)

      setNextCursor(next)
      setHasMore(more)
      setItems(prev => append ? prev.concat(list) : list)
    } catch (err: any) {
      console.error('Failed to fetch products', err)
      setError(err?.message || 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts({ append: false }) }, [limit])

  const loadMore = () => { if (!nextCursor) return; fetchProducts({ append: true, cursor: nextCursor }) }
  const refresh = () => { setNextCursor(null); setHasMore(false); fetchProducts({ append: false }) }

  const toggle = (id?: string) => setExpanded(prev => prev === id ? null : id || null)

  const faceValue = (p: Prod) => {
    const v = p.variants && p.variants[0]
    return v?.price ?? v?.mrp ?? '-'
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href="/admin/integrations/kgen" className="text-sm px-3 py-2 bg-gray-100 rounded">Back to KGen</a>
          <h1 className="text-2xl font-semibold">KGen — Products</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="px-2 py-2 border rounded text-sm">
            {[15,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={refresh} className="px-3 py-2 bg-gray-100 rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && items.length === 0 && <div className="py-12 text-center text-gray-500">Loading products...</div>}
      {error && <IntegrationError message={error} />}

      <div className="bg-white border rounded shadow p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="p-2">Product ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Categories</th>
              <th className="p-2">Variants</th>
              <th className="p-2">Price</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p,i) => {
              const id = p.productID || String(i)
              const cats = Array.isArray(p.categories) ? p.categories.map(c=>c.categoryName).filter(Boolean).join(' • ') : '-'
              const varCount = Array.isArray(p.variants) ? p.variants.length : 0
              return (
                <React.Fragment key={id}>
                  <tr className="border-t">
                    <td className="p-2 align-top font-mono text-xs">{p.productID || '-'}</td>
                    <td className="p-2 align-top">{p.productDisplayName || p.productName || '-'}</td>
                    <td className="p-2 align-top">{cats}</td>
                    <td className="p-2 align-top">{varCount}</td>
                    <td className="p-2 align-top">{typeof faceValue(p) === 'number' ? `₹${Number(faceValue(p)).toLocaleString('en-IN')}` : faceValue(p)}</td>
                    <td className="p-2 align-top">
                      <button onClick={()=>toggle(id)} className="px-2 py-1 bg-gray-100 rounded text-xs">Details</button>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={6} className="p-0">
                      <div style={{ display: expanded === id ? 'block' : 'none' }} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            {p.attachments && p.attachments[0] ? (
                              <img src={p.attachments[0]} alt={p.productDisplayName} className="w-full h-36 object-cover rounded" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                            ) : (
                              <div className="w-full h-36 bg-gray-100 rounded flex items-center justify-center text-gray-400">No image</div>
                            )}
                          </div>
                          <div className="md:col-span-2">
                            <h3 className="text-lg font-semibold">{p.productDisplayName || p.productName}</h3>
                            <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{p.descriptionText || '-'}</div>
                            <div className="mt-4">
                              <h4 className="font-semibold text-sm mb-2">Variants</h4>
                              {(!p.variants || p.variants.length === 0) ? (
                                <div className="text-sm text-gray-500">No variants</div>
                              ) : (
                                <div className="overflow-auto border rounded">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100 text-xs text-gray-600">
                                      <tr>
                                        <th className="p-2 text-left">Variant</th>
                                        <th className="p-2 text-left">Price</th>
                                        <th className="p-2 text-left">MRP</th>
                                        <th className="p-2 text-left">Stock</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.variants!.map((v, idx) => (
                                        <tr key={v.variantID || idx} className="border-t">
                                          <td className="p-2">{v.variantName || v.variantDisplayName || '-'}</td>
                                          <td className="p-2">{v.price != null ? `₹${Number(v.price).toLocaleString('en-IN')}` : '-'}</td>
                                          <td className="p-2">{v.mrp != null ? `₹${Number(v.mrp).toLocaleString('en-IN')}` : '-'}</td>
                                          <td className="p-2">{v.stock ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          {hasMore ? (
            <button onClick={loadMore} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded">Load more</button>
          ) : (
            <div className="text-sm text-gray-500">No more results</div>
          )}
        </div>
        <div className="text-sm text-gray-600">Showing {items.length} products{hasMore ? ' (partial)' : ''}</div>
      </div>
    </div>
  )
}
