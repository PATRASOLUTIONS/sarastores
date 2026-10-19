"use client"
import { getErrorMessage } from "@/lib/utils"


import { apiFetchJson } from "@/lib/api-client"
import { useEffect, useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { z } from "zod"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { Copy, RefreshCw, X } from "lucide-react"

const externalOrderSchema = z.object({
  id: z.string().min(1), queueId: z.string().nullish(), provider: z.string().nullish(),
  orderId: z.string().nullish(), userId: z.string().nullish(), status: z.string().nullish(),
  externalOrderId: z.string().nullish(), createdAt: z.string().nullish(), updatedAt: z.string().nullish(),
  response: z.unknown().optional(),
}).passthrough()
type ExternalOrder = z.infer<typeof externalOrderSchema>
const queueListSchema = z.object({
  success: z.literal(true), items: z.array(externalOrderSchema), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), limit: z.number().int().positive(),
})
const queueMutationSchema = z.object({ success: z.literal(true), item: externalOrderSchema, message: z.string().min(1) })

export default function ExternalOrdersPage() {
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()
  const [items, setItems] = useState<ExternalOrder[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<ExternalOrder | null>(null)
  const actionLock = useSubmitLock()
  const [actionPending, setActionPending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page])

  const fetchPage = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await apiFetchJson(`/api/admin/external-orders?limit=${limit}&page=${page}`,
        { signal: AbortSignal.timeout(12_000) }, value => queueListSchema.parse(value))
      setItems(data.items)
      setHasMore(data.page * data.limit < data.total)
    } catch (err) {
      console.error(err)
      const message = getErrorMessage(err, 'Failed to load external orders')
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async (id: string) => {
    if (!confirm('Check whether this fulfillment is still queued? Provider placement is never automatically retried.')) return
    if (!actionLock.acquire()) return
    setActionPending(true)
    try {
      const data = await apiFetchJson(`/api/admin/external-orders/${encodeURIComponent(id)}/retry`,
        { method: 'POST', signal: AbortSignal.timeout(12_000) }, value => queueMutationSchema.parse(value))
      if (data.item.id !== id || data.item.status !== "queued") throw new Error("Queue acknowledgement did not match")
      toast.success(data.message)
      await fetchPage()
    } catch (err) {
      console.error(err)
      toast.error(getErrorMessage(err, 'Retry failed'))
    } finally {
      actionLock.release()
      setActionPending(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this queued external order? This will mark it cancelled and prevent further attempts.')) return
    if (!actionLock.acquire()) return
    setActionPending(true)
    try {
      const data = await apiFetchJson(`/api/admin/external-orders/${encodeURIComponent(id)}/cancel`,
        { method: 'POST', signal: AbortSignal.timeout(12_000) }, value => queueMutationSchema.parse(value))
      if (data.item.id !== id || data.item.status !== "cancelled") throw new Error("Cancellation acknowledgement did not match")
      toast.success(data.message)
      await fetchPage()
    } catch (err) {
      console.error(err)
      toast.error(getErrorMessage(err, 'Cancel failed'))
    } finally {
      actionLock.release()
      setActionPending(false)
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
          <Link href="/admin/orders" className="px-3 py-2 rounded bg-gray-100">Back to Orders</Link>
          <button onClick={() => fetchPage()} className="px-3 py-2 rounded bg-white border flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {isLoading && <p role="status" className="text-sm text-gray-600 mb-3">Loading queue...</p>}
        {loadError && <p role="alert" className="text-sm text-red-700 mb-3">{loadError}</p>}
        <p className="text-xs text-gray-500 mb-3">Only undispatched queue entries can be cancelled. Provider attempts and uncertain outcomes require reconciliation; cancellation does not refund the customer order.</p>
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
                <tr key={it.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-mono text-xs">{it.queueId || it.id}</td>
                  <td>{it.provider}</td>
                  <td className="font-medium">{it.status}</td>
                  <td className="font-mono text-xs">{it.externalOrderId || '—'}</td>
                  <td className="font-mono text-xs">{it.orderId || '—'}</td>
                  <td className="text-xs text-gray-600">{it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(it) }} className="px-2 py-1 bg-white border rounded text-xs">View</button>
                      <button onClick={async () => {
                        try {
                          if (!navigator.clipboard) throw new Error("Clipboard is unavailable")
                          await navigator.clipboard.writeText(it.queueId || it.id)
                          toast.success('Copied')
                        } catch (error) { toast.error(getErrorMessage(error, "Copy failed")) }
                      }} className="px-2 py-1 bg-white border rounded text-xs flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button>
                      <button disabled={actionPending || it.status !== "queued"} onClick={() => handleRetry(it.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"><RefreshCw className="h-3 w-3" />Check queue</button>
                      <button disabled={actionPending || !["queued", "cancelled"].includes(it.status || "")} onClick={() => handleCancel(it.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"><X className="h-3 w-3" />Cancel</button>
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
