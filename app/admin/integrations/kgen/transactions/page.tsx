"use client"

import { apiFetch } from "@/lib/api-client"
import { IntegrationError, readErrorMessage } from "../integration-error"
import React, { useEffect, useState } from 'react'

type Txn = {
  txnID: string
  dpID?: string
  txnType?: string
  currency?: string
  amount?: number
  balanceBefore?: number
  balanceAfter?: number
  sourceSystem?: string
  activity?: string
  referenceID?: string
  referenceType?: string
  metadata?: any
  createdAt?: string
  updatedAt?: string
}

export default function KGenTransactionsPage() {
  const [transactions, setTransactions] = useState<Txn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(15)
  const [txnType, setTxnType] = useState<string>('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const buildUrl = (cursor?: string) => {
    const params = new URLSearchParams()
    if (txnType) params.set('txnType', txnType)
    if (limit) params.set('limit', String(limit))
    if (cursor) params.set('nextCursor', cursor)
    return `/api/integrations/exlr8/wallet/transactions?${params.toString()}`
  }

  const fetchTransactions = async (opts: { append?: boolean;
 cursor?: string } = {}) => {
    const { append = false, cursor } = opts
    setLoading(true)
    setError(null)
    try {
      const url = buildUrl(cursor)
      const res = await apiFetch(url)
      if (!res.ok) {
        throw new Error(await readErrorMessage(res))
      }
      const data = await res.json()
      const txns: Txn[] = Array.isArray(data.transactions) ? data.transactions : []
      const pagination = data.paginationInfo || data.meta || null
      const next = pagination?.nextCursor || pagination?.next_cursor || null
      const more = !!(pagination?.hasMore || pagination?.has_more)

      setNextCursor(next)
      setHasMore(more)

      setTransactions(prev => (append ? prev.concat(txns) : txns))
    } catch (err: any) {
      console.error('Failed to fetch transactions', err)
      setError(err?.message || 'Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // initial fetch (reset list)
    fetchTransactions({ append: false })
  }, [txnType, limit])

  const loadMore = () => {
    if (!nextCursor) return
    fetchTransactions({ append: true, cursor: nextCursor })
  }

  const refresh = () => {
    setNextCursor(null)
    setHasMore(false)
    fetchTransactions({ append: false })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied')
    } catch (e) {
      console.warn('copy failed', e)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href="/admin/integrations/kgen" className="text-sm px-3 py-2 bg-gray-100 rounded">Back to KGen</a>
          <h1 className="text-2xl font-semibold">KGen — Wallet Transactions</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={txnType} onChange={e=>setTxnType(e.target.value)} className="px-2 py-2 border rounded text-sm">
            <option value="">All types</option>
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
          </select>
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="px-2 py-2 border rounded text-sm">
            {[15,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={refresh} className="px-3 py-2 bg-gray-100 rounded text-sm">Refresh</button>
        </div>
      </div>

      {loading && transactions.length === 0 && (
        <div className="py-12 text-center text-gray-500">Loading transactions...</div>
      )}

      {error && <IntegrationError message={error} />}

      <div className="bg-white border rounded shadow p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="p-2">Time</th>
              <th className="p-2">Txn ID</th>
              <th className="p-2">Type</th>
              <th className="p-2">Activity</th>
              <th className="p-2">Reference</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Balance Before</th>
              <th className="p-2">Balance After</th>
              <th className="p-2">Source</th>
              <th className="p-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr key={t.txnID || i} className="border-t align-top">
                <td className="p-2 align-top text-xs text-gray-600">{t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}</td>
                <td className="p-2 align-top font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span>{(t.txnID || '').slice(0, 20)}{(t.txnID || '').length > 20 ? '…' : ''}</span>
                    {t.txnID && <button onClick={()=>copy(t.txnID)} className="text-xs text-blue-600">Copy</button>}
                  </div>
                </td>
                <td className="p-2 align-top">{t.txnType || '-'}</td>
                <td className="p-2 align-top">{t.activity || '-'}</td>
                <td className="p-2 align-top font-mono text-xs">{t.referenceID || '-'}</td>
                <td className="p-2 align-top">{t.amount != null ? `${t.currency || 'INR'} ${Number(t.amount).toLocaleString('en-IN')}` : '-'}</td>
                <td className="p-2 align-top">{t.balanceBefore != null ? `${Number(t.balanceBefore).toLocaleString('en-IN')}` : '-'}</td>
                <td className="p-2 align-top">{t.balanceAfter != null ? `${Number(t.balanceAfter).toLocaleString('en-IN')}` : '-'}</td>
                <td className="p-2 align-top">{t.sourceSystem || '-'}</td>
                <td className="p-2 align-top">{t.metadata?.comment || '-'}</td>
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
        <div className="text-sm text-gray-600">Showing {transactions.length} transactions{hasMore ? ' (partial)' : ''}</div>
      </div>
    </div>
  )
}
