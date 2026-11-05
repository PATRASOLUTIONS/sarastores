'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { apiFetchJson } from '@/lib/api-client'
import type { CampaignConfig } from '@/lib/diwali/schemas'
import { CampaignSetupSchema } from '@/lib/diwali/store-types'
import { isRealDate } from '@/lib/diwali/rules'

type Setup = Pick<CampaignConfig, 'holidays' | 'stores' | 'staff'>
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-100'
const action = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
const load = (url: string) => apiFetchJson(url, {}, value => CampaignSetupSchema.parse(value))

export default function CampaignSetupFields({ config, onChange, errors, disabled }: {
  config: CampaignConfig; onChange: (value: Partial<Setup>) => void; errors: Record<string, string>; disabled: boolean;
}) {
  const [holiday, setHoliday] = useState(''), [code, setCode] = useState(''), [name, setName] = useState('')
  const [storeSearch, setStoreSearch] = useState(''), [accountSearch, setAccountSearch] = useState(''), [search, setSearch] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => setSearch(accountSearch), 300); return () => window.clearTimeout(timer) }, [accountSearch])
  const { data, error, isLoading, mutate } = useSWR(`/api/admin/diwali/setup?search=${encodeURIComponent(search)}`, load)
  const source = data?.stores || [], accounts = data?.accounts || []
  const sectionClass = (field: string) => `scroll-mt-24 space-y-3 rounded-xl border p-4 ${errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50/50'}`
  const errorFor = (field: string) => errors[field] && <p id={`diwali-${field}-error`} className="text-sm text-red-800">{errors[field]}</p>
  const filtered = config.stores.map((store, index) => ({ ...store, index })).filter(store => `${store.code} ${store.name}`.toLowerCase().includes(storeSearch.toLowerCase()))
  const addSource = () => {
    const valid = source.filter(store => store.active && store.code && store.code.length <= 40 && store.name && store.name.length <= 150 && store.code !== 'ONLINE')
    const next = [...config.stores]
    for (const store of valid) if (!next.some(item => item.code === store.code)) next.push({ code: store.code, name: store.name })
    onChange({ stores: next })
    const missing = source.filter(store => store.active && (!store.code || !store.name || store.code.length > 40 || store.name.length > 150))
    toast.success(`${next.length - config.stores.length} stores added. Save campaign settings to apply.`)
    if (missing.length) toast.error(`${missing.length} stores need a valid code/name in the store directory.`)
  }
  const updateStore = (index: number, value: Partial<Setup['stores'][number]>) => onChange({
    stores: config.stores.map((store, current) => current === index ? { ...store, ...value } : store),
    ...(value.code !== undefined ? { staff: config.staff.map(staff => ({ ...staff, stores: staff.stores.map(code => code === config.stores[index].code ? value.code! : code) })) } : {}),
  })
  const updateStaff = (index: number, value: Partial<Setup['staff'][number]>) => onChange({ staff: config.staff.map((staff, current) => current === index ? { ...staff, ...value, ...(value.role === 'full_access' ? { export: true, stores: [] } : {}) } : staff) })
  return <fieldset disabled={disabled} className="space-y-5">
    <section id="diwali-holidays-section" tabIndex={-1} className={sectionClass('holidays')}>
      <h3 className="font-semibold">Holidays</h3><p className="text-sm text-gray-600">Choose dates when gift delivery is not a working day. These dates are excluded from the seven-working-day deadline.</p>
      <div className="flex flex-wrap items-end gap-2"><label className="min-w-48 flex-1 text-sm">Holiday date<input className={`${input} mt-1`} type="date" value={holiday} aria-invalid={!!errors.holidays} onChange={event => setHoliday(event.target.value)} /></label><button type="button" className={action} disabled={!holiday} onClick={() => {
        if (!isRealDate(holiday)) return toast.error('Choose a valid holiday date.')
        if (config.holidays.includes(holiday)) return toast.error('This holiday is already listed.')
        onChange({ holidays: [...config.holidays, holiday].sort() }); setHoliday('')
      }}>Add holiday</button></div>
      <div className="flex flex-wrap gap-2">{config.holidays.map(value => <span key={value} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">{new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}<button type="button" aria-label={`Remove holiday ${value}`} onClick={() => onChange({ holidays: config.holidays.filter(day => day !== value) })} className="font-semibold text-red-800">×</button></span>)}</div>
      {!config.holidays.length && <p className="text-sm text-gray-500">No extra holidays. Only the selected working weekdays apply.</p>}{errorFor('holidays')}
    </section>
    <section id="diwali-stores-section" tabIndex={-1} className={sectionClass('stores')}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Campaign stores <span className="text-sm text-gray-500">({config.stores.length})</span></h3><Link href="/admin/diwali/diwali-store" className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white">Store links, QR codes &amp; scans →</Link></div>
      <p className="text-sm text-gray-600">Use your existing store directory instead of typing every branch. Customers choose these stores from their invoice.</p>
      {isLoading ? <p role="status" className="text-sm">Loading store directory…</p> : error ? <p role="alert" className="text-sm text-red-800">Store/account directory could not load. <button type="button" className="underline" onClick={() => void mutate()}>Retry</button></p> : <div className="flex flex-wrap items-center gap-3"><button type="button" className={action} onClick={addSource}>Add all active directory stores ({source.filter(store => store.active).length})</button><Link href="/admin/store-locations" className="text-sm text-red-800 underline">Manage store directory</Link></div>}
      <label className="block text-sm">Find campaign store<input className={`${input} mt-1`} value={storeSearch} onChange={event => setStoreSearch(event.target.value)} placeholder="Search name or code" /></label>
      <div className="max-h-80 overflow-auto rounded-lg border bg-white"><table className="w-full min-w-[480px] text-left text-sm"><thead className="sticky top-0 bg-gray-100"><tr><th className="p-2">Store code</th><th className="p-2">Store name</th><th className="p-2">Action</th></tr></thead><tbody>{filtered.map(store => <tr key={store.index} className="border-t"><td className="w-32 p-2"><input className={input} aria-label={`Store code ${store.index + 1}`} value={store.code} maxLength={40} onChange={event => updateStore(store.index, { code: event.target.value })} /></td><td className="p-2"><input className={input} aria-label={`Store name ${store.index + 1}`} value={store.name} maxLength={150} onChange={event => updateStore(store.index, { name: event.target.value })} /></td><td className="p-2"><button type="button" className="text-red-800 underline" onClick={() => {
        if (config.staff.some(staff => staff.stores.includes(store.code))) return toast.error('Remove this store from staff restrictions first.')
        onChange({ stores: config.stores.filter((_, index) => index !== store.index) })
      }}>Remove</button></td></tr>)}</tbody></table>{!config.stores.length && <p className="p-4 text-sm text-amber-800">Add your directory stores before opening registration.</p>}</div>
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Add a store manually</summary><div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><label>Store code<input className={`${input} mt-1`} value={code} maxLength={40} onChange={event => setCode(event.target.value)} /></label><label>Store name<input className={`${input} mt-1`} value={name} maxLength={150} onChange={event => setName(event.target.value)} /></label><button type="button" className={`${action} self-end`} onClick={() => {
        if (!code.trim() || !name.trim()) return toast.error('Enter the store code and name.')
        if (config.stores.some(store => store.code === code.trim())) return toast.error('This store code is already listed.')
        onChange({ stores: [...config.stores, { code: code.trim(), name: name.trim() }] }); setCode(''); setName('')
      }}>Add store</button></div></details>{errorFor('stores')}
    </section>
    <section id="diwali-staff-section" tabIndex={-1} className={sectionClass('staff')}>
      <h3 className="font-semibold">Staff access</h3><p className="text-sm text-gray-600">Choose an existing account, its campaign role, export permission and permitted stores. Accounts also need dashboard access and the Diwali page permission.</p>
      <label className="block text-sm">Find an account by name or email<input className={`${input} mt-1`} value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Type at least two characters; assigned/dashboard accounts appear by default" /></label>
      {config.staff.map((staff, index) => {
        const account = accounts.find(account => account.id === staff.userId)
        return <div key={index} className="space-y-3 rounded-xl border bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><label className="text-sm">Account<select className={`${input} mt-1`} value={staff.userId} onChange={event => updateStaff(index, { userId: event.target.value })}><option value="">Select an account</option>{!account && staff.userId && <option value={staff.userId}>Unavailable account · {staff.userId}</option>}{accounts.filter(account => !config.staff.some((item, other) => other !== index && item.userId === account.id)).map(account => <option key={account.id} value={account.id}>{account.name || account.email} · {account.email}</option>)}</select></label><label className="text-sm">Campaign role<select className={`${input} mt-1`} value={staff.role} onChange={event => updateStaff(index, { role: event.target.value as Setup['staff'][number]['role'] })}><option value="full_access">Full access</option><option value="verifier">Invoice verifier</option><option value="fulfilment">Gift fulfilment</option><option value="management">Reports / management</option></select></label><button type="button" className="self-end py-2 text-sm text-red-800 underline" onClick={() => onChange({ staff: config.staff.filter((_, current) => current !== index) })}>Remove</button></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={staff.role === 'full_access'} checked={staff.role === 'full_access' || staff.export} onChange={event => updateStaff(index, { export: event.target.checked })} />Allow CSV / Excel data export</label>
          {staff.userId && <p className={`text-sm ${account?.active && account.ready ? 'text-green-800' : 'text-amber-800'}`}>{account?.admin ? 'Administrator account already has full campaign access.' : account?.active && account.ready ? 'Dashboard and Diwali page access are ready.' : 'This account needs active status, dashboard access and the Diwali page grant before registration opens.'} <Link className="underline" href={`/admin/customers/${encodeURIComponent(staff.userId)}`}>Manage account access ↗</Link></p>}
          {staff.role === 'full_access' ? <p className="text-sm text-green-800">Full access to all Diwali features and stores, including approval, fulfilment, exports, deletion and campaign settings.</p> : <details><summary className="cursor-pointer text-sm font-semibold">Permitted stores: {staff.stores.length ? `${staff.stores.length} selected` : 'All campaign stores (including new stores)'}</summary><button type="button" className="mt-2 text-xs text-red-800 underline" onClick={() => updateStaff(index, { stores: [] })}>Allow all stores</button><div className="mt-2 grid max-h-40 gap-2 overflow-auto sm:grid-cols-2">{config.stores.map(store => <label key={store.code} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={!staff.stores.length || staff.stores.includes(store.code)} onChange={event => {
            const selected = staff.stores.length ? staff.stores : config.stores.map(item => item.code)
            const next = event.target.checked ? [...new Set([...selected, store.code])] : selected.filter(code => code !== store.code)
            if (!next.length) return toast.error('Keep at least one permitted store, or choose Allow all stores.')
            updateStaff(index, { stores: next.length === config.stores.length ? [] : next })
          }} />{store.name} · {store.code}</label>)}</div></details>}
        </div>
      })}
      <button type="button" className={action} onClick={() => onChange({ staff: [...config.staff, { userId: '', role: 'verifier', export: false, stores: [] }] })}>Add staff assignment</button>
      {!config.staff.length && <p className="text-sm text-gray-500">No extra staff assigned. Full administrators retain access.</p>}{errorFor('staff')}
    </section>
    <p className="text-sm font-semibold text-gray-600">Save campaign settings to apply holidays, stores and staff changes.</p>
  </fieldset>
}
