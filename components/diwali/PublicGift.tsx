'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { GIFTS, indiaDate } from '@/lib/diwali/rules'
import MarkdownContent from '@/components/ui/MarkdownContent'
import GiftRegistration from '@/components/diwali/GiftRegistration'
import RegistrationCelebration from '@/components/diwali/RegistrationCelebration'

type Config = { enabled: boolean; campaignStart: string; campaignEnd: string; registrationStart: string; registrationEnd: string; stores: { code: string; name: string }[]; termsEn: string; termsKn: string; privacyEn: string; privacyKn: string; consentVersion: string }
type Status = { reference: string; status: string; fulfilment: string | null; gift: string | null; dueAt?: string; courier?: string; awb?: string; trackingUrl?: string; deliveredAt?: string; whatsappStatus?: string }
const field = 'mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:bg-stone-100'
const button = 'rounded-xl bg-red-800 px-6 py-3 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50'
const SUBMITTED_KEY = 'sara-diwali-2026-registration-submitted'
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
  const [referringStore, setReferringStore] = useState('')
  const [email, setEmail] = useState('')
  const [checkingRegistration, setCheckingRegistration] = useState(mode === 'register')
  const [previouslySubmitted, setPreviouslySubmitted] = useState(false)
  const t = (english: string, kannada: string) => language === 'kn' ? kannada : english
  const rememberSubmission = useCallback(() => {
    setPreviouslySubmitted(true)
    // A presentation hint only. The server enforces uniqueness by mobile/email.
    try { window.localStorage.setItem(SUBMITTED_KEY, 'true') } catch { /* Status lookup still restores verified submissions. */ }
  }, [])
  const registerAnotherCustomer = () => {
    try { window.localStorage.removeItem(SUBMITTED_KEY) } catch { /* The current page can still reset. */ }
    setPreviouslySubmitted(false); setResult(null); setVerified(false); setMobile(''); setEmail(''); setAmount(''); setChallenge(''); setOtp(''); setError(''); setRequestId(crypto.randomUUID())
  }
  const loadStatus = useCallback(async () => {
    const response = await api<{ items: Status[] }>('/api/diwali/status')
    setStatuses(response.items)
    if (mode !== 'register' || response.items.length) setVerified(true)
    if (mode === 'register' && response.items[0]) { setResult(response.items[0]); rememberSubmission() }
  }, [mode, rememberSubmission])
  useEffect(() => {
    let active = true
    const refreshConfig = () => {
      if (document.visibilityState === 'hidden') return
      api<Config>('/api/diwali/config').then(value => { if (active) setConfig(value) }).catch(error => { if (active) setError(error.message) })
    }
    setRequestId(crypto.randomUUID())
    if (mode === 'register') {
      try { setPreviouslySubmitted(window.localStorage.getItem(SUBMITTED_KEY) === 'true') } catch { /* Storage may be unavailable. */ }
    }
    if (mode === 'register') setReferringStore((new URLSearchParams(window.location.search).get('store') || '').slice(0, 40))
    refreshConfig()
    window.addEventListener('focus', refreshConfig)
    const timer = window.setInterval(refreshConfig, 60_000)
    if (mode === 'register' || mode === 'status' || mode === 'confirmation') {
      loadStatus().catch(() => {}).finally(() => { if (active) setCheckingRegistration(false) })
    }
    return () => { active = false; window.removeEventListener('focus', refreshConfig); window.clearInterval(timer) }
  }, [mode, loadStatus])
  useEffect(() => {
    if (error && mode === 'register') document.getElementById('gift-registration-error')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [error, mode])
  async function task(work: () => Promise<void>) { setBusy(true); setError(''); try { await work() } catch (error) { setError(error instanceof Error ? error.message : 'Please try again') } finally { setBusy(false) } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || result || previouslySubmitted || checkingRegistration) return
    if (!verified) { setError(t('Verify your details before submitting registration.', 'ನೋಂದಣಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.')); return }
    const data = new FormData(event.currentTarget)
    await task(async () => {
      const claim = await api<Status>('/api/diwali/register', { requestId, name: data.get('name'), mobile, email, address: data.get('address'), city: data.get('city'), state: data.get('state'), pincode: data.get('pincode'), storeCode: data.get('storeCode'), invoice: data.get('invoice'), enteredValue: Number(amount), language, accuracy: data.get('accuracy') === 'on', whatsappConsent: data.get('consent') === 'on', consentVersion: config?.consentVersion })
      setResult(claim)
      rememberSubmission()
    })
  }
  const now = indiaDate(new Date())
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
  return <div className={`min-h-screen text-stone-900 ${mode === 'register' ? 'bg-[#f5f6f8]' : 'bg-[#fffaf2]'}`} lang={language}>
    <div className={`mx-auto px-4 ${mode === 'register' ? 'max-w-[1180px] py-4 sm:py-6' : 'max-w-6xl py-8 sm:px-6'}`}>
      {mode !== 'register' && <><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><Link href="/diwali-gift" className="text-sm font-bold tracking-widest text-red-800">SARA · DIWALI DHAMAKA 2026</Link><div className="flex gap-2" aria-label="Language"><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={`rounded-full border px-4 py-2 ${language === 'en' ? 'bg-red-800 text-white' : 'bg-white'}`}>English</button><button type="button" aria-pressed={language === 'kn'} onClick={() => setLanguage('kn')} className={`rounded-full border px-4 py-2 ${language === 'kn' ? 'bg-red-800 text-white' : 'bg-white'}`}>ಕನ್ನಡ</button></div></div>
      <nav className="mb-6 flex flex-wrap gap-5 text-sm font-medium"><Link href="/diwali-gift">{t('Register', 'ನೋಂದಣಿ')}</Link><Link href="/diwali-gift/status">{t('Check gift status', 'ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</Link><a href="tel:+919071002220">{t('Help', 'ಸಹಾಯ')}: +91 90710 02220</a></nav></>}
      {error && (mode !== 'register' || !config || result) && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</div>}
      {!config ? <p role="status">{t('Loading campaign…', 'ಮಾಹಿತಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…')}</p> : mode === 'terms' || mode === 'privacy' ? <section className="rounded-2xl bg-white p-6 sm:p-10"><h1 className="mb-5 text-3xl font-bold">{mode === 'terms' ? t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು') : t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</h1><MarkdownContent content={(mode === 'terms' ? language === 'en' ? config.termsEn : config.termsKn : language === 'en' ? config.privacyEn : config.privacyKn) || t('Registration will open after SARA publishes the approved notice.', 'SARA ಅನುಮೋದಿತ ಸೂಚನೆಯನ್ನು ಪ್ರಕಟಿಸಿದ ನಂತರ ನೋಂದಣಿ ತೆರೆಯುತ್ತದೆ.')} /></section> : <>
        {mode === 'register' && checkingRegistration && !result && <p role="status">{t('Checking your registration...', 'ನಿಮ್ಮ ನೋಂದಣಿಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...')}</p>}
        {mode === 'register' && !checkingRegistration && previouslySubmitted && !result && <section className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-green-200 bg-white p-6"><h1 className="text-2xl font-bold text-green-800">{t('Your registration is already submitted.', 'ನಿಮ್ಮ ನೋಂದಣಿ ಈಗಾಗಲೇ ಸಲ್ಲಿಸಲಾಗಿದೆ.')}</h1><p>{t('You do not need to fill in this form again. Verify your mobile on the status page to view your registration.', 'ಈ ಫಾರ್ಮ್ ಅನ್ನು ಮತ್ತೆ ಭರ್ತಿ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ. ನೋಂದಣಿಯನ್ನು ನೋಡಲು ಸ್ಥಿತಿ ಪುಟದಲ್ಲಿ ನಿಮ್ಮ ಮೊಬೈಲ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.')}</p><Link href="/diwali-gift/status" className="inline-block font-semibold text-red-800 underline">{t('Check gift status', 'ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</Link><button type="button" className="block text-sm text-stone-600 underline" onClick={registerAnotherCustomer}>{t('Register a different customer', 'ಬೇರೆ ಗ್ರಾಹಕರ ನೋಂದಣಿ')}</button></section>}
        {mode === 'register' && !checkingRegistration && !previouslySubmitted && !result && <GiftRegistration config={config} language={language} onLanguage={setLanguage} email={email} onEmail={value => { setEmail(value); setVerified(false); setError('') }} mobile={mobile} onMobile={value => { setMobile(value); setVerified(false); setError('') }} verified={verified} busy={busy} onVerify={() => task(async () => { const response = await api<{ available: boolean }>('/api/diwali/registration-check', { mobile, email }); setVerified(response.available) })} amount={amount} onAmount={setAmount} onSubmit={submit} onReset={() => { setEmail(''); setAmount(''); setMobile(''); setChallenge(''); setOtp(''); setVerified(false); setLanguage('en'); setError(''); setRequestId(crypto.randomUUID()) }} open={open} today={now} error={error} initialStoreCode={referringStore} />}
        {result && <RegistrationCelebration key={result.reference} language={language}>{statusCards([result])}{result.whatsappStatus && ['accepted', 'sent', 'delivered', 'read'].includes(result.whatsappStatus) && <p role="status" className="text-sm font-semibold text-green-800">{t('Your registration confirmation has been sent on WhatsApp.', 'ನಿಮ್ಮ ನೋಂದಣಿ ದೃಢೀಕರಣವನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಲಾಗಿದೆ.')}</p>}<Link className="inline-block font-semibold text-red-800 underline" href="/diwali-gift/status">{t('Check status', 'ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ')}</Link></RegistrationCelebration>}
        {(mode === 'status' || mode === 'confirmation') && <section className="mx-auto max-w-2xl space-y-6 rounded-3xl bg-white p-6 sm:p-8"><Gift className="h-10 w-10 text-red-800" /><h1 className="text-3xl font-bold">{t('Your gift status', 'ನಿಮ್ಮ ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</h1>{verified ? <>{statuses.length ? statusCards(statuses) : <p>{t('No registrations found for this verified mobile.', 'ಈ ಮೊಬೈಲ್‌ಗೆ ಯಾವುದೇ ನೋಂದಣಿ ಕಂಡುಬಂದಿಲ್ಲ.')}</p>}<button className={button} disabled={busy} onClick={() => task(loadStatus)}>{t('Refresh status', 'ಸ್ಥಿತಿಯನ್ನು ನವೀಕರಿಸಿ')}</button></> : <><p>{t('Verify the mobile used for registration to view your claims.', 'ನೋಂದಣಿಗೆ ಬಳಸಿದ ಮೊಬೈಲ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.')}</p><label className="block">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')}<input className={field} type="tel" value={mobile} onChange={event => { setMobile(event.target.value); setChallenge('') }} maxLength={10} inputMode="numeric" /></label><button className={button} disabled={busy || !/^[6-9]\d{9}$/.test(mobile)} onClick={() => task(async () => { const response = await api<{ challenge: string }>('/api/diwali/otp/send', { mobile, language, purpose: 'status' }); setChallenge(response.challenge) })}>{t('Send verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್ ಕಳುಹಿಸಿ')}</button>{challenge && <><label className="block">{t('Verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್')}<input className={field} value={otp} onChange={event => setOtp(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label><button className={button} disabled={busy || !/^\d{6}$/.test(otp)} onClick={() => task(async () => { await api('/api/diwali/otp/verify', { challenge, otp }); await loadStatus() })}>{t('View status', 'ಸ್ಥಿತಿಯನ್ನು ನೋಡಿ')}</button></>}</>}</section>}
      </>}
      {mode !== 'register' && <footer className="mt-10 flex flex-wrap gap-5 border-t border-stone-200 pt-6 text-sm text-stone-600"><Link href="/diwali-gift/terms">{t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು')}</Link><Link href="/diwali-gift/privacy">{t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</Link><a href="tel:+919071002220">+91 90710 02220</a></footer>}
    </div>
  </div>
}
