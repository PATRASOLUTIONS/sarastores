'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/api-client'
import { NotificationSettingsSchema, type NotificationSettings, type RegistrationEmail } from '@/lib/diwali/notification-types'

type Data = { settings: NotificationSettings; pending: number; smtp: { ready: boolean; error: string }; emails: RegistrationEmail[] }
const endpoint = '/api/admin/diwali/notifications'
const button = 'rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50'
async function read(url: string): Promise<Data> {
  const response = await apiFetch(url), data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not load email notifications.')
  return data
}
export default function DiwaliEmailNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Data>(endpoint, read, { refreshInterval: 15_000 })
  const [enabled, setEnabled] = useState(false), [recipients, setRecipients] = useState(''), [busy, setBusy] = useState(false), [formError, setFormError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (data && !loaded) { setEnabled(data.settings.enabled); setRecipients(data.settings.recipients.join('\n')); setLoaded(true) } }, [data, loaded])
  async function save(event: FormEvent) {
    event.preventDefault(); setFormError('')
    const parsed = NotificationSettingsSchema.safeParse({ enabled, recipients: recipients.split(/[,;\n]+/).map(value => value.trim()).filter(Boolean) })
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return }
    setBusy(true)
    try {
      const response = await apiFetch(endpoint, { method: 'PUT', json: parsed.data }), result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save notification settings.')
      setRecipients(parsed.data.recipients.join('\n')); await mutate(); toast.success('Registration email settings saved.')
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save notification settings.') }
    finally { setBusy(false) }
  }
  async function sendPending() {
    setBusy(true)
    try {
      const response = await apiFetch(endpoint, { method: 'POST' }), result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not process pending emails.')
      toast.success('Pending emails scheduled. Delivery status will refresh automatically.'); await mutate()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not process pending emails.') }
    finally { setBusy(false) }
  }
  const labels = { queued: 'Pending', sending: 'Sending', accepted: 'Accepted by mail server', failed: 'Not sent / rejected', unknown: 'Needs delivery review', suppressed: 'Cancelled' }
  return <main className="mx-auto max-w-5xl p-4 sm:p-6">
    <Link href="/admin/diwali" className="text-sm font-semibold text-red-800 underline">← Diwali dashboard</Link>
    <h1 className="mt-5 text-2xl font-bold text-red-900">Registration email notifications</h1>
    <p className="mt-2 text-sm text-gray-600">Email selected employees after a customer successfully submits the Diwali registration form. Each email includes the reference, customer contact, invoice, store and a link to review the registration.</p>
    {isLoading ? <p className="mt-6" role="status">Loading settings…</p> : error ? <p role="alert" className="mt-6 text-red-800">{error.message}</p> : data && <>
      <form onSubmit={save} className="my-6 space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <p className={`text-sm ${data.smtp.ready ? 'text-green-800' : 'text-red-800'}`} role="status">{data.smtp.ready ? 'SMTP settings are present. Actual delivery is recorded below.' : data.smtp.error}</p>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={busy} />Enable employee email notifications</label>
        <label className="block space-y-2 text-sm font-medium">Employee email addresses<textarea className="w-full rounded-lg border p-3 text-sm outline-none focus:border-red-700" rows={5} maxLength={3000} value={recipients} onChange={event => setRecipients(event.target.value)} disabled={busy} placeholder="employee@sarastores.com" /><span className="block text-xs font-normal text-gray-500">One email per line, or separated by commas. Up to 10 recipients. Each employee receives a separate email.</span></label>
        {formError && <p role="alert" className="text-sm text-red-800">{formError}</p>}
        <button className={button} disabled={busy}>{busy ? 'Saving…' : 'Save email notifications'}</button>
        <p className="text-xs text-gray-500">Applies to new form registrations after saving. Customer registration stays successful if email delivery fails. Employees need existing Diwali dashboard access to open the review link.</p>
      </form>
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent notification status</h2><button className={button} onClick={() => void sendPending()} disabled={busy || !data.settings.enabled || !data.smtp.ready || !data.pending}>Send pending emails ({data.pending})</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead><tr>{['Registration', 'Employee email', 'Status', 'Created (IST)'].map(label => <th className="border-b p-2" key={label}>{label}</th>)}</tr></thead><tbody>{data.emails.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.reference}</td><td className="break-all p-2">{row.recipient}</td><td className="p-2">{labels[row.status]}</td><td className="p-2">{new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>)}</tbody></table></div>
        {!data.emails.length && <p className="py-5 text-sm text-gray-500">No registration emails yet.</p>}
        <p className="mt-4 text-xs text-gray-500">Mail-server acceptance does not confirm inbox delivery. Review rejected or uncertain emails with your mail provider; uncertain messages are not automatically resent.</p>
      </section>
    </>}
  </main>
}
