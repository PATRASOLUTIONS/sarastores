"use client"

import { apiFetch } from "@/lib/api-client"
import { IntegrationError, readErrorMessage } from "../integration-error"
import React, { useEffect, useState } from 'react'

type LineItem = {
  variantID?: string
  productID?: string
  quantity?: number
  mrp?: number
  price?: number
  totalMRP?: number
  totalPrice?: number
  variantName?: string
  productName?: string
  attachments?: string[]
  vouchers?: any[]
  fulfillmentStatus?: string
}

type ExOrder = {
  orderID?: string
  externalRefID?: string
  dpUserEmail?: string
  dpUserName?: string
  dpID?: string
  totalOrderMRP?: number
  totalAmount?: number
  status?: string
  fulfillmentStatus?: string
  createdAt?: string
  lineItems?: LineItem[]
}

export default function KGenOrdersPage() {
  const [orders, setOrders] = useState<ExOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(15)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const buildUrl = (cursor?: string) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (cursor) params.set('nextCursor', cursor)
    return `/api/integrations/exlr8/orders?${params.toString()}`
  }

  const fetchOrders = async (opts: { append?: boolean;
 cursor?: string } = {}) => {
    const { append = false, cursor } = opts
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(buildUrl(cursor))
      if (!res.ok) {
        throw new Error(await readErrorMessage(res))
      }
      const data = await res.json()
      const list: ExOrder[] = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : [])
      const pagination = data.paginationInfo || data.meta || null
      const next = pagination?.nextCursor || pagination?.next_cursor || null
      const more = !!(pagination?.hasMore || pagination?.has_more)

      setNextCursor(next)
      setHasMore(more)

      setOrders(prev => append ? prev.concat(list) : list)
    } catch (err: any) {
      console.error('Failed to fetch exlr8 orders', err)
      setError(err?.message || 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders({ append: false }) }, [limit])

  const loadMore = () => { if (!nextCursor) return; fetchOrders({ append: true, cursor: nextCursor }) }
  const refresh = () => { setNextCursor(null); setHasMore(false); fetchOrders({ append: false }) }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href="/admin/integrations/kgen" className="text-sm px-3 py-2 bg-gray-100 rounded">Back to KGen</a>
          <h1 className="text-2xl font-semibold">KGen — Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="px-2 py-2 border rounded text-sm">
            {[15,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={refresh} className="px-3 py-2 bg-gray-100 rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && orders.length === 0 && (
        <div className="py-12 text-center text-gray-500">Loading orders...</div>
      )}

      {error && <IntegrationError message={error} />}

      <div className="bg-white border rounded shadow p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="p-2">Time</th>
              <th className="p-2">Order ID</th>
              <th className="p-2">External Ref</th>
              <th className="p-2">Buyer</th>
              <th className="p-2">Items</th>
              <th className="p-2">Total</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.orderID || i} className="border-t align-top">
                <td className="p-2 align-top text-xs text-gray-600">{o.createdAt ? new Date(o.createdAt).toLocaleString() : '-'}</td>
                <td className="p-2 align-top font-mono text-xs">{o.orderID || '-'}</td>
                <td className="p-2 align-top font-mono text-xs">{o.externalRefID || '-'}</td>
                <td className="p-2 align-top">{o.dpUserName || o.dpUserEmail || '-'}</td>
                <td className="p-2 align-top">{Array.isArray(o.lineItems) ? o.lineItems.length : '-'}</td>
                <td className="p-2 align-top">{o.totalAmount != null ? `₹${Number(o.totalAmount).toLocaleString('en-IN')}` : '-'}</td>
                <td className="p-2 align-top">{o.status || o.fulfillmentStatus || '-'}</td>
              </tr>
            ))}
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
        <div className="text-sm text-gray-600">Showing {orders.length} orders{hasMore ? ' (partial)' : ''}</div>
      </div>
    </div>
  )
}
