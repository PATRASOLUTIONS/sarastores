'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Gift, ShieldCheck, Truck } from 'lucide-react'
import { GIFTS, giftForRupees } from '@/lib/diwali/rules'

type Config = { enabled: boolean; campaignStart: string; campaignEnd: string; registrationStart: string; registrationEnd: string; stores: { code: string; name: string }[]; termsEn: string; termsKn: string; privacyEn: string; privacyKn: string; consentVersion: string }
type Status = { reference: string; status: string; fulfilment: string | null; gift: string | null; dueAt?: string; courier?: string; awb?: string; trackingUrl?: string; deliveredAt?: string }
const field = 'mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:bg-stone-100'
const button = 'rounded-xl bg-red-800 px-6 py-3 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50'
const deliveryLabels: Record<string, string> = { pending: 'ಪ್ಯಾಕಿಂಗ್ ಬಾಕಿ', packed: 'ಪ್ಯಾಕ್ ಮಾಡಲಾಗಿದೆ', dispatched: 'ರವಾನಿಸಲಾಗಿದೆ', delivered: 'ವಿತರಿಸಲಾಗಿದೆ', exception: 'ವಿತರಣಾ ಸಮಸ್ಯೆ — SARA ಅನ್ನು ಸಂಪರ್ಕಿಸಿ' }
async function api<T>(url: string, input?: unknown): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || 'Please try again')
  return value
}
export default function PublicGift({ mode = 'register' }: { mode?: 'register' | 'status' | 'terms' | 'privacy' | 'confirmation' }) {
  const [language, setLanguage] = useState<'en' | 'kn'>('en')
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [mobile, setMobile] = useState(''), [challenge, setChallenge] = useState(''), [otp, setOtp] = useState(''), [verified, setVerified] = useState(false)
  const [amount, setAmount] = useState(''), [result, setResult] = useState<Status | null>(null), [statuses, setStatuses] = useState<Status[]>([])
  const [requestId, setRequestId] = useState('')
  const t = (english: string, kannada: string) => language === 'kn' ? kannada : english
  const loadStatus = async () => { const response = await api<{ items: Status[] }>('/api/diwali/status'); setStatuses(response.items); setVerified(true) }
  useEffect(() => {
    setRequestId(crypto.randomUUID())
    api<Config>('/api/diwali/config').then(setConfig).catch(error => setError(error.message))
    if (mode === 'status' || mode === 'confirmation') loadStatus().catch(() => {})
  }, [mode])
  async function task(work: () => Promise<void>) { setBusy(true); setError(''); try { await work() } catch (error) { setError(error instanceof Error ? error.message : 'Please try again') } finally { setBusy(false) } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await task(async () => {
      const claim = await api<Status>('/api/diwali/register', { requestId, name: data.get('name'), address: data.get('address'), city: data.get('city'), district: data.get('district'), pincode: data.get('pincode'), storeCode: data.get('storeCode'), invoice: data.get('invoice'), enteredValue: Number(amount), language, accuracy: data.get('accuracy') === 'on', whatsappConsent: data.get('consent') === 'on', consentVersion: config?.consentVersion })
      setResult(claim)
    })
  }
  const preview = giftForRupees(Number(amount))
  const now = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
  const open = !!config?.enabled && now >= config.registrationStart && now <= config.registrationEnd
  const statusCards = (items: Status[]) => items.map(claim => <article key={claim.reference} className="rounded-2xl border border-stone-200 bg-white p-6">
    <p className="text-sm text-stone-500">{t('Registration reference', 'ನೋಂದಣಿ ಸಂಖ್ಯೆ')}</p><p className="break-all text-lg font-bold">{claim.reference}</p>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt>{t('Verification', 'ಪರಿಶೀಲನೆ')}</dt><dd className="font-semibold">{claim.status === 'pending' ? t('Pending SARA verification', 'SARA ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ') : claim.status === 'approved' ? t('Approved', 'ಅನುಮೋದಿಸಲಾಗಿದೆ') : t('Rejected — contact SARA support', 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ — SARA ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ')}</dd></div>
      {claim.gift && <div><dt>{t('Approved gift', 'ಅನುಮೋದಿತ ಉಡುಗೊರೆ')}</dt><dd className="font-semibold">{language === 'kn' ? GIFTS.find(gift => gift.label === claim.gift)?.kannada : claim.gift}</dd></div>}
      {claim.fulfilment && <div><dt>{t('Delivery status', 'ವಿತರಣೆಯ ಸ್ಥಿತಿ')}</dt><dd className="font-semibold">{t(claim.fulfilment, deliveryLabels[claim.fulfilment] || claim.fulfilment)}</dd></div>}
      {claim.dueAt && <div><dt>{t('Delivery due', 'ವಿತರಣೆಯ ಕೊನೆಯ ದಿನ')}</dt><dd>{new Date(claim.dueAt).toLocaleDateString(language === 'kn' ? 'kn-IN' : 'en-IN', { timeZone: 'Asia/Kolkata' })}</dd></div>}
      {claim.awb && <div><dt>{t('Courier and tracking', 'ಕೊರಿಯರ್ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್')}</dt><dd>{claim.courier} · {claim.awb}</dd></div>}
    </dl>{claim.trackingUrl?.startsWith('https://') && <a className="mt-4 inline-block font-semibold text-red-800 underline" href={claim.trackingUrl} target="_blank" rel="noopener noreferrer">{t('Track delivery', 'ವಿತರಣೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ')}</a>}
  </article>)
  return <div className="min-h-screen bg-[#fffaf2] text-stone-900" lang={language}>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><Link href="/diwali-gift" className="text-sm font-bold tracking-widest text-red-800">SARA · DIWALI DHAMAKA 2026</Link><div className="flex gap-2" aria-label="Language"><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={`rounded-full border px-4 py-2 ${language === 'en' ? 'bg-red-800 text-white' : 'bg-white'}`}>English</button><button type="button" aria-pressed={language === 'kn'} onClick={() => setLanguage('kn')} className={`rounded-full border px-4 py-2 ${language === 'kn' ? 'bg-red-800 text-white' : 'bg-white'}`}>ಕನ್ನಡ</button></div></div>
      <nav className="mb-6 flex flex-wrap gap-5 text-sm font-medium"><Link href="/diwali-gift">{t('Register', 'ನೋಂದಣಿ')}</Link><Link href="/diwali-gift/status">{t('Check gift status', 'ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</Link><a href="tel:+919071002220">{t('Help', 'ಸಹಾಯ')}: +91 90710 02220</a></nav>
      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</div>}
      {!config ? <p role="status">{t('Loading campaign…', 'ಮಾಹಿತಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…')}</p> : mode === 'terms' || mode === 'privacy' ? <section className="rounded-2xl bg-white p-6 sm:p-10"><h1 className="mb-5 text-3xl font-bold">{mode === 'terms' ? t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು') : t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</h1><p className="whitespace-pre-wrap leading-7">{(mode === 'terms' ? language === 'en' ? config.termsEn : config.termsKn : language === 'en' ? config.privacyEn : config.privacyKn) || t('Registration will open after SARA publishes the approved notice.', 'SARA ಅನುಮೋದಿತ ಸೂಚನೆಯನ್ನು ಪ್ರಕಟಿಸಿದ ನಂತರ ನೋಂದಣಿ ತೆರೆಯುತ್ತದೆ.')}</p></section> : <>
        {mode === 'register' && !result && <><div className="overflow-hidden rounded-3xl bg-red-900"><Image src="/images/diwali-2026.webp" alt="SARA Diwali Dhamaka campaign" width={1600} height={620} priority className="h-auto w-full" /></div><div className="my-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-800">{t('Celebrate with SARA', 'SARA ಜೊತೆಗೆ ಸಂಭ್ರಮಿಸಿ')}</p><h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t('Your purchase. Your Diwali gift.', 'ನಿಮ್ಮ ಖರೀದಿ. ನಿಮ್ಮ ದೀಪಾವಳಿ ಉಡುಗೊರೆ.')}</h1><p className="mt-5 leading-7 text-stone-600">{t('Register your qualifying invoice for a Silver or Gold gift. SARA will verify your invoice before confirming eligibility.', 'ಬೆಳ್ಳಿ ಅಥವಾ ಚಿನ್ನದ ಉಡುಗೊರೆಗಾಗಿ ನಿಮ್ಮ ಅರ್ಹ ಬಿಲ್ ಅನ್ನು ನೋಂದಾಯಿಸಿ. ಅರ್ಹತೆಯನ್ನು ದೃಢೀಕರಿಸುವ ಮೊದಲು SARA ನಿಮ್ಮ ಬಿಲ್ ಅನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.')}</p>
          <p className="mt-4 font-semibold">{config.campaignStart} – {config.campaignEnd}</p><p className="mt-2 text-sm">{t('Minimum eligible purchase ₹15,000. Whole-rupee invoice values only.', 'ಕನಿಷ್ಠ ಅರ್ಹ ಖರೀದಿ ₹15,000. ಪೂರ್ಣ ರೂಪಾಯಿ ಬಿಲ್ ಮೊತ್ತಗಳು ಮಾತ್ರ.')}</p>
          <div className="mt-6 space-y-3">{GIFTS.map(gift => <div key={gift.code} className="flex items-center justify-between rounded-xl border border-amber-200 bg-white p-4"><span className="text-sm">₹{gift.min.toLocaleString('en-IN')}{gift.max ? ` – ₹${gift.max.toLocaleString('en-IN')}` : '+'}</span><span className="font-semibold text-red-800">{language === 'kn' ? gift.kannada : gift.label}</span></div>)}</div>
          <div className="mt-6 space-y-4 text-sm text-stone-600"><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0" />{t('Manual invoice verification by SARA', 'SARA ಮೂಲಕ ಬಿಲ್ ಪರಿಶೀಲನೆ')}</p><p className="flex gap-3"><Truck className="h-5 w-5 shrink-0" />{t('Delivery within 7 working days after approval', 'ಅನುಮೋದನೆಯ ನಂತರ 7 ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ವಿತರಣೆ')}</p></div></section>
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-bold">{t('Register your gift', 'ನಿಮ್ಮ ಉಡುಗೊರೆಯನ್ನು ನೋಂದಾಯಿಸಿ')}</h2>
          {!open ? <p className="mt-6 rounded-xl bg-amber-50 p-4">{t('Registration is currently closed. Please contact SARA for assistance.', 'ನೋಂದಣಿ ಪ್ರಸ್ತುತ ಮುಚ್ಚಲಾಗಿದೆ. ಸಹಾಯಕ್ಕಾಗಿ SARA ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.')}</p> : <><div className="mt-6 rounded-xl bg-stone-50 p-4">{verified ? <p className="flex items-center gap-2 font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" />{mobile} · {t('Mobile verified', 'ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ')}</p> : <><label className="text-sm font-medium">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')}<input className={field} value={mobile} onChange={event => { setMobile(event.target.value); setChallenge('') }} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" /></label><button type="button" className={`${button} mt-3`} disabled={busy || !/^[6-9]\d{9}$/.test(mobile)} onClick={() => task(async () => { const response = await api<{ challenge: string }>('/api/diwali/otp/send', { mobile, language, purpose: 'register' }); setChallenge(response.challenge) })}>{t('Send verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್ ಕಳುಹಿಸಿ')}</button>{challenge && <div className="mt-4"><label className="text-sm">{t('Six-digit code sent on WhatsApp', 'WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿದ ಆರು ಅಂಕಿಯ ಕೋಡ್')}<input className={field} value={otp} onChange={event => setOtp(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label><button type="button" className={`${button} mt-3`} disabled={busy || !/^\d{6}$/.test(otp)} onClick={() => task(async () => { await api('/api/diwali/otp/verify', { challenge, otp }); setVerified(true) })}>{t('Verify mobile', 'ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಿ')}</button></div>}</>}</div>
          <form onSubmit={submit} className="mt-6 space-y-5"><fieldset disabled={!verified || busy} className="space-y-5">
            <label className="block text-sm font-medium">{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')}<input name="name" className={field} required minLength={2} maxLength={150} autoComplete="name" /></label>
            <label className="block text-sm font-medium">{t('Complete delivery address', 'ಸಂಪೂರ್ಣ ವಿತರಣಾ ವಿಳಾಸ')}<textarea name="address" className={field} required minLength={10} maxLength={800} autoComplete="street-address" rows={3} /></label>
            <div className="grid gap-4 sm:grid-cols-2">{[['city', t('City', 'ನಗರ')], ['district', t('District', 'ಜಿಲ್ಲೆ')]].map(([name, label]) => <label key={name} className="text-sm font-medium">{label}<input name={name} className={field} required minLength={2} maxLength={100} /></label>)}</div>
            <label className="block text-sm font-medium">{t('PIN code', 'ಪಿನ್ ಕೋಡ್')}<input name="pincode" className={field} required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="postal-code" /></label>
            <label className="block text-sm font-medium">{t('Invoice store', 'ಬಿಲ್‌ನ ಅಂಗಡಿ')}<select name="storeCode" aria-label={t('Invoice store', 'ಬಿಲ್‌ನ ಅಂಗಡಿ')} className={field} required defaultValue=""><option value="">{t('Select the store on your invoice', 'ನಿಮ್ಮ ಬಿಲ್‌ನ ಅಂಗಡಿಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ')}</option>{config.stores.map(store => <option key={store.code} value={store.code}>{store.name} · {store.code}</option>)}</select></label>
            <label className="block text-sm font-medium">{t('Invoice number', 'ಬಿಲ್ ಸಂಖ್ಯೆ')}<input name="invoice" className={field} required maxLength={100} /></label>
            <label className="block text-sm font-medium">{t('Invoice value in rupees', 'ರೂಪಾಯಿಗಳಲ್ಲಿ ಬಿಲ್ ಮೊತ್ತ')}<input type="number" className={field} required min={15000} max={100000000} step={1} value={amount} onChange={event => setAmount(event.target.value)} /></label>
            {preview && <div className="rounded-xl bg-amber-50 p-4 text-sm"><p className="font-semibold">{t('Indicative gift', 'ಅಂದಾಜು ಉಡುಗೊರೆ')}: {language === 'kn' ? preview.kannada : preview.label}</p><p className="mt-1">{t('Subject to manual invoice verification. This is not approval.', 'ಬಿಲ್ ಪರಿಶೀಲನೆಗೆ ಒಳಪಟ್ಟಿದೆ. ಇದು ಅನುಮೋದನೆಯಲ್ಲ.')}</p></div>}
            <label className="flex gap-3 text-sm"><input type="checkbox" name="accuracy" required className="mt-1 h-4 w-4 shrink-0" />{t('I confirm my details and invoice are genuine.', 'ನನ್ನ ವಿವರಗಳು ಮತ್ತು ಬಿಲ್ ನಿಜವೆಂದು ನಾನು ದೃಢೀಕರಿಸುತ್ತೇನೆ.')}</label>
            <label className="flex gap-3 text-sm"><input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0" />{t('I agree to receive WhatsApp updates about my registration and gift delivery.', 'ನನ್ನ ನೋಂದಣಿ ಮತ್ತು ಉಡುಗೊರೆ ವಿತರಣೆ ಕುರಿತು WhatsApp ಸಂದೇಶಗಳನ್ನು ಸ್ವೀಕರಿಸಲು ನಾನು ಒಪ್ಪುತ್ತೇನೆ.')}</label>
            <p className="text-xs leading-6 text-stone-500">{t('Please review the campaign terms and privacy notice below. Aadhaar is not required.', 'ಕೆಳಗಿನ ನಿಯಮಗಳು ಮತ್ತು ಗೌಪ್ಯತೆ ಸೂಚನೆಯನ್ನು ಪರಿಶೀಲಿಸಿ. ಆಧಾರ್ ಅಗತ್ಯವಿಲ್ಲ.')}</p>
            <button className={`${button} w-full`} disabled={busy || !verified}>{busy ? t('Submitting…', 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…') : t('Submit registration', 'ನೋಂದಣಿ ಸಲ್ಲಿಸಿ')}</button>
          </fieldset></form></>}
          </section></div></>}
        {result && <section className="mx-auto max-w-2xl space-y-5 py-10"><CheckCircle2 className="h-12 w-12 text-green-700" /><h1 className="text-3xl font-bold">{t('Registration received', 'ನೋಂದಣಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ')}</h1><p>{t('Save your reference. Your gift will be confirmed after SARA verifies your invoice.', 'ನಿಮ್ಮ ನೋಂದಣಿ ಸಂಖ್ಯೆಯನ್ನು ಉಳಿಸಿ. SARA ಬಿಲ್ ಪರಿಶೀಲಿಸಿದ ನಂತರ ಉಡುಗೊರೆಯನ್ನು ದೃಢೀಕರಿಸಲಾಗುತ್ತದೆ.')}</p>{statusCards([result])}<Link className="inline-block font-semibold text-red-800 underline" href="/diwali-gift/status">{t('Check status', 'ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ')}</Link></section>}
        {(mode === 'status' || mode === 'confirmation') && <section className="mx-auto max-w-2xl space-y-6 rounded-3xl bg-white p-6 sm:p-8"><Gift className="h-10 w-10 text-red-800" /><h1 className="text-3xl font-bold">{t('Your gift status', 'ನಿಮ್ಮ ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</h1>{verified ? <>{statuses.length ? statusCards(statuses) : <p>{t('No registrations found for this verified mobile.', 'ಈ ಮೊಬೈಲ್‌ಗೆ ಯಾವುದೇ ನೋಂದಣಿ ಕಂಡುಬಂದಿಲ್ಲ.')}</p>}<button className={button} disabled={busy} onClick={() => task(loadStatus)}>{t('Refresh status', 'ಸ್ಥಿತಿಯನ್ನು ನವೀಕರಿಸಿ')}</button></> : <><p>{t('Verify the mobile used for registration to view your claims.', 'ನೋಂದಣಿಗೆ ಬಳಸಿದ ಮೊಬೈಲ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.')}</p><label className="block">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')}<input className={field} type="tel" value={mobile} onChange={event => { setMobile(event.target.value); setChallenge('') }} maxLength={10} inputMode="numeric" /></label><button className={button} disabled={busy || !/^[6-9]\d{9}$/.test(mobile)} onClick={() => task(async () => { const response = await api<{ challenge: string }>('/api/diwali/otp/send', { mobile, language, purpose: 'status' }); setChallenge(response.challenge) })}>{t('Send verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್ ಕಳುಹಿಸಿ')}</button>{challenge && <><label className="block">{t('Verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್')}<input className={field} value={otp} onChange={event => setOtp(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label><button className={button} disabled={busy || !/^\d{6}$/.test(otp)} onClick={() => task(async () => { await api('/api/diwali/otp/verify', { challenge, otp }); await loadStatus() })}>{t('View status', 'ಸ್ಥಿತಿಯನ್ನು ನೋಡಿ')}</button></>}</>}</section>}
      </>}
      <footer className="mt-10 flex flex-wrap gap-5 border-t border-stone-200 pt-6 text-sm text-stone-600"><Link href="/diwali-gift/terms">{t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು')}</Link><Link href="/diwali-gift/privacy">{t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</Link><a href="tel:+919071002220">+91 90710 02220</a></footer>
    </div>
  </div>
}
