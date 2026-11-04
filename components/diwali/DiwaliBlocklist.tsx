'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/api-client'
import { BlocklistInputSchema, type DiwaliBlocklistEntry } from '@/lib/diwali/blocklist-types'

type Result = { items: DiwaliBlocklistEntry[]; total: number; page: number }
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100'
const button = 'rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50'
const card = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'
async function read(url: string): Promise<Result> {
  const response = await apiFetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not load the customer blocklist.')
  return data
}
export default function DiwaliBlocklist() {
  const [email, setEmail] = useState(''), [mobile, setMobile] = useState(''), [reason, setReason] = useState('')
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState('')
  const url = `/api/admin/diwali/blocklist?${new URLSearchParams({ search: query, status, page: String(page) })}`
  const { data, error, isLoading, mutate } = useSWR<Result>(url, read, { revalidateOnFocus: true })
  async function write(json: unknown, method: 'POST' | 'PUT') {
    const response = await apiFetch('/api/admin/diwali/blocklist', { method, json })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || 'Could not save the blocklist.')
  }
  async function add(event: FormEvent) {
    event.preventDefault(); setFormError('')
    const parsed = BlocklistInputSchema.safeParse({ email: email.trim(), mobile, reason })
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return }
    setBusy(true)
    try {
      await write(parsed.data, 'POST'); setEmail(''); setMobile(''); setReason('')
      await mutate(); toast.success('Customer details blocked for Diwali participation.')
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save the blocklist.') }
    finally { setBusy(false) }
  }
  async function change(entry: DiwaliBlocklistEntry) {
    setBusy(true)
    try {
      await write({ id: entry.id, active: !entry.active, version: entry.version }, 'PUT')
      await mutate(); toast.success(entry.active ? 'Blocklist entry deactivated.' : 'Customer details blocked again.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update the entry.') }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <Link href="/admin/diwali" className="text-sm font-semibold text-red-800 underline">← Diwali dashboard</Link>
    <div className="my-5"><h1 className="text-2xl font-bold text-red-900">Diwali customer blocklist</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">Block an email address, a mobile number, or both. A match to either stops new Diwali registrations and gift approval, packing and dispatch. Regular purchases and existing records remain available.</p>
    </div>
    <form onSubmit={add} className={`${card} mb-6`}>
      <h2 className="mb-4 text-lg font-semibold">Block customer details</h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Email address<input className={input} type="email" value={email} maxLength={255} onChange={event => setEmail(event.target.value)} placeholder="customer@example.com" /></label>
        <label className="space-y-1 text-sm font-medium">Mobile number<input className={input} type="tel" value={mobile} maxLength={40} onChange={event => setMobile(event.target.value)} placeholder="10 digits or +91 mobile number" /></label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">Reason <span className="text-red-700">*</span><textarea className={input} required minLength={3} maxLength={500} rows={2} value={reason} onChange={event => setReason(event.target.value)} placeholder="Internal reason for blocking this customer" /><span className="block text-xs font-normal text-gray-500">The reason is visible only to full administrators.</span></label>
      </fieldset>
      {formError && <p role="alert" className="mt-3 text-sm text-red-800">{formError}</p>}
      <button className={`${button} mt-4`} disabled={busy}>{busy ? 'Saving…' : 'Add to blocklist'}</button>
    </form>
    <section className={card} aria-label="Blocklist entries">
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}>
        <label className="min-w-48 flex-1 space-y-1 text-sm font-medium">Search<input className={input} value={search} maxLength={150} onChange={event => setSearch(event.target.value)} placeholder="Email, mobile or reason" /></label>
        <label className="space-y-1 text-sm font-medium">Status<select className={input} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All entries</option><option value="active">Blocked</option><option value="inactive">Unblocked</option></select></label>
        <button className={button}>Search</button>
      </form>
      {error && <p role="alert" className="mb-3 text-sm text-red-800">{error.message} <button onClick={() => void mutate()} className="underline">Retry</button></p>}
      {isLoading ? <p className="py-6 text-gray-500" role="status">Loading blocklist…</p> : !error && <>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr>{['Customer details', 'Reason', 'Status', 'Last updated', 'Action'].map(label => <th key={label} className="border-b p-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{data?.items.map(entry => <tr key={entry.id} className="border-b last:border-0">
            <td className="p-3"><p className="break-all font-medium">{entry.email || 'No email'}</p><p className="mt-1 text-gray-500">{entry.mobile || 'No mobile'}</p></td>
            <td className="max-w-sm break-words p-3">{entry.reason}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.active ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>{entry.active ? 'Blocked' : 'Unblocked'}</span></td>
            <td className="p-3 text-gray-500">{new Date(entry.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            <td className="p-3"><button type="button" disabled={busy} onClick={() => void change(entry)} className="rounded-lg border px-3 py-2 font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">{entry.active ? 'Unblock' : 'Block again'}</button></td>
          </tr>)}</tbody></table></div>
        {!data?.items.length && <p className="py-6 text-center text-gray-500">No blocklist entries match these filters.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{data?.total || 0} entries · Page {page}</p><div className="flex gap-2"><button className={button} disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className={button} disabled={busy || page * 30 >= (data?.total || 0)} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </>}
      <p className="mt-4 text-xs text-gray-500">Unblocking one entry does not override another active entry matching the same email or mobile.</p>
    </section>
  </main>
}
