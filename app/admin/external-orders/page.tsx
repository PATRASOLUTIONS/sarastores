"use client"

import { apiFetch } from "@/lib/api-client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { Copy, RefreshCw, X } from "lucide-react"

interface ExternalOrder {
  _id: string
  queueId?: string
  provider?: string
  orderId?: string
  userId?: string
  status?: string
  externalOrderId?: string
  createdAt?: string
  updatedAt?: string
  response?: any
}

export default function ExternalOrdersPage() {
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()
  const [items, setItems] = useState<ExternalOrder[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<ExternalOrder | null>(null)

  useEffect(() => {
    if (!user) return
    fetchPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page])

  const fetchPage = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch(`/api/admin/external-orders?limit=${limit}&page=${page}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items || [])
      setHasMore((data.items || []).length === limit)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load external orders')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async (id: string) => {
    if (!confirm('Retry this external order? This will re-attempt placement with the provider.')) return
    try {
      const res = await apiFetch(`/api/admin/external-orders/${id}/retry`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Retry failed')
      toast.success('Retry submitted')
      fetchPage()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Retry failed')
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this queued external order? This will mark it cancelled and prevent further attempts.')) return
    try {
      const res = await apiFetch(`/api/admin/external-orders/${id}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Cancel failed')
      toast.success('Cancelled')
      fetchPage()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Cancel failed')
    }
  }

  if (authLoading) return null

  if (!user || !canAccessAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">External Orders</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/orders">
            <button className="px-3 py-2 rounded bg-gray-100">Back to Orders</button>
          </Link>
          <button onClick={() => fetchPage()} className="px-3 py-2 rounded bg-white border flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">Queue ID</th>
                <th>Provider</th>
                <th>Status</th>
                <th>External Order</th>
                <th>Local Order</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-mono text-xs">{it.queueId || it._id}</td>
                  <td>{it.provider}</td>
                  <td className="font-medium">{it.status}</td>
                  <td className="font-mono text-xs">{it.externalOrderId || '—'}</td>
                  <td className="font-mono text-xs">{it.orderId || '—'}</td>
                  <td className="text-xs text-gray-600">{it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(it) }} className="px-2 py-1 bg-white border rounded text-xs">View</button>
                      <button onClick={() => { navigator.clipboard?.writeText(it.queueId || it._id || '') ;
 toast.success('Copied') }} className="px-2 py-1 bg-white border rounded text-xs flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button>
                      <button onClick={() => handleRetry(it._id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs flex items-center gap-1"><RefreshCw className="h-3 w-3" />Retry</button>
                      <button onClick={() => handleCancel(it._id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1"><X className="h-3 w-3" />Cancel</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-gray-600">Page {page}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1 border rounded bg-white">Prev</button>
            <button disabled={!hasMore} onClick={() => setPage(p => p+1)} className="px-3 py-1 border rounded bg-white">Next</button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-8">
          <div className="absolute inset-0 bg-black opacity-50" onClick={() => setSelected(null)}></div>
          <div className="relative z-10 bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">External Order Details</h3>
              <button onClick={() => setSelected(null)} className="text-sm text-gray-600">Close</button>
            </div>
            <div className="mt-4 text-xs font-mono bg-gray-50 p-3 rounded max-h-96 overflow-auto">
              <pre>{JSON.stringify(selected, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
