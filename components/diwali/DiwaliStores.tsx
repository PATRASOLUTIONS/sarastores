'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import { createStorePoster } from '@/lib/diwali/store-poster'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { apiFetchJson } from '@/lib/api-client'
import { escapeHtml } from '@/lib/html'
import { safeCsv } from '@/lib/diwali/rules'
import { DiwaliStoreLinksSchema, type DiwaliStoreLink } from '@/lib/diwali/store-types'

const button = 'rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50'
const load = (url: string) => apiFetchJson(url, {}, value => DiwaliStoreLinksSchema.parse(value))
function download(url: string, filename: string) {
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
}
const filename = (store: DiwaliStoreLink) => `diwali-${(store.code || store.id).replace(/[^a-z0-9_-]/gi, '_')}`

export default function DiwaliStores() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/diwali/stores', load, { refreshInterval: 60_000 })
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DiwaliStoreLink | null>(null), [image, setImage] = useState('')
  const stores = data?.stores || []
  const filtered = stores.filter(store => `${store.code} ${store.name}`.toLowerCase().includes(search.toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 20)), current = Math.min(page, pages)
  useEffect(() => {
    let cancelled = false; setImage('')
    if (selected) void createStorePoster(selected).then(value => { if (!cancelled) setImage(value) }).catch(() => { if (!cancelled) toast.error('Store poster could not be generated.') })
    return () => { cancelled = true }
  }, [selected])
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success('Store link copied') } catch { toast.error('Copy the link from the QR details window.') }
  }
  function exportLinks() {
    const fields = ['Store code', 'Store name', 'Registration link', 'QR / link opens', 'Registrations', 'Last opened']
    const csv = '\uFEFF' + [fields, ...stores.map(store => [store.code, store.name, store.url, store.opens, store.registrations, store.lastOpenedAt || ''])].map(row => row.map(safeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); download(url, 'diwali-store-links.csv'); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function printAll() {
    const popup = window.open('', '_blank')
    if (!popup) return toast.error('Allow pop-ups to print the store QR codes.')
    popup.opener = null; popup.document.write('<p>Preparing store QR codes...</p>'); setBusy(true)
    try {
      const cards: string[] = []
      for (const store of stores) {
        if (popup.closed) return
        cards.push( `<article><h2>${escapeHtml(store.name || 'Store')}</h2><p>${escapeHtml(store.code)}</p><img src="${await createStorePoster(store)}" alt="Diwali registration QR"><strong>Scan to register for your Diwali gift</strong><p class="url">${escapeHtml(store.url)}</p></article>`)
      }
      if (popup.closed) return
      popup.document.open(); popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Diwali store QR codes</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#7f1d1d;margin:0}.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm}article{border:1px solid #ddd;border-radius:8px;padding:2mm;text-align:center;break-inside:avoid}h2{font-size:14px;min-height:32px;margin:0}p{font-size:12px;margin:6px 0}img{display:block;width:100%;height:auto}strong{display:block;font-size:13px}.url{font-size:9px;word-break:break-all}</style></head><body><div class="cards">${cards.join('')}</div></body></html>`); popup.document.close()
      await Promise.all(Array.from(popup.document.images).map(item => item.decode()))
      popup.focus(); popup.print()
    } catch { popup.close(); toast.error('Store QR codes could not be prepared. Try again.') } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <Link className="text-sm font-semibold text-red-800 underline" href="/admin/diwali">← Diwali dashboard</Link>
    <div className="my-5 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-red-900">Diwali store links &amp; QR scans</h1><p className="mt-2 max-w-2xl text-sm text-gray-600">Each store has its own link and QR code. Scanning opens the customer registration page and selects that store when it is in the campaign.</p></div><Link href="/admin/diwali/settings" className={button}>Campaign settings</Link></div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Store links', stores.length], ['QR / link opens', stores.reduce((sum, store) => sum + store.opens, 0)], ['Registrations from links', stores.reduce((sum, store) => sum + store.registrations, 0)], ['Stores in campaign', stores.filter(store => store.inCampaign).length]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-red-900">{value}</p></div>)}</div>
    <p className="mb-4 text-sm text-gray-600">Opens count visits through a store QR code or link, including repeat visits. Direct visits to /diwali-gift are excluded. Registrations show customers who submitted after using that store link within seven days.</p>
    <div className="mb-4 flex flex-wrap gap-2"><button className={button} disabled={!stores.length || busy} onClick={() => void printAll()}>{busy ? 'Preparing QR codes...' : `Print all store posters (${stores.length})`}</button><button className={button} disabled={!stores.length} onClick={exportLinks}>Export all links &amp; counts</button><button className={button} disabled={isLoading} onClick={() => void mutate()}>Refresh counts</button><Link href="/admin/store-locations" className={button}>Manage store directory</Link></div>
    <label className="mb-4 block text-sm font-medium">Find store<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2" placeholder="Search store name or code" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
    {isLoading ? <p role="status">Loading store links...</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Could not load store links. Use Refresh counts to try again.</p> : <div className="overflow-auto rounded-xl border bg-white"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-gray-50"><tr>{['Store', 'Campaign', 'QR / link opens', 'Registrations', 'Last opened (IST)', 'Link & QR code'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{filtered.slice((current - 1) * 20, current * 20).map(store => <tr key={store.id} className="border-t"><td className="p-3"><p className="font-semibold">{store.name || 'Unnamed store'}</p><p className="text-xs text-gray-500">{store.code || 'Store code missing'}{!store.active && ' · Inactive directory store'}</p></td><td className="p-3"><span className={store.inCampaign ? 'text-green-800' : 'text-amber-800'}>{store.inCampaign ? 'Included' : 'Add in settings'}</span></td><td className="p-3 font-semibold">{store.opens}</td><td className="p-3">{store.registrations}</td><td className="p-3 text-xs">{store.lastOpenedAt ? new Date(store.lastOpenedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'No opens yet'}</td><td className="p-3"><div className="flex gap-2"><button className={button} onClick={() => void copy(store.url)}>Copy link</button><button className={button} onClick={() => setSelected(store)}>View QR</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="p-5 text-gray-500">{stores.length ? 'No stores match your search.' : 'Add stores in the store directory or campaign settings to generate links.'}</p>}</div>}
    <div className="mt-4 flex items-center justify-between gap-3 text-sm"><p>{filtered.length} stores · Page {current} of {pages}</p><div className="flex gap-2"><button className={button} disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button><button className={button} disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button></div></div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-md"><DialogTitle>{selected?.name || 'Store'} · {selected?.code}</DialogTitle><DialogDescription>Scan this QR code to open Diwali customer registration for this store.</DialogDescription>{image ? <Image src={image} alt={`Diwali registration QR for ${selected?.name}`} width={1199} height={1312} unoptimized className="mx-auto h-auto w-full max-w-sm" /> : <p role="status">Preparing QR code...</p>}<input readOnly aria-label="Store registration link" value={selected?.url || ''} className="w-full rounded-lg border p-2 text-xs" onFocus={event => event.target.select()} /><div className="flex flex-wrap gap-2"><button className={button} disabled={!image || !selected} onClick={() => { if (selected) download(image, `${filename(selected)}.png`) }}>Download store poster</button><button className={button} onClick={() => { if (selected) void copy(selected.url) }}>Copy link</button></div></DialogContent></Dialog>
  </main>
}
