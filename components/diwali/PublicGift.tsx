'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { GIFTS, indiaDate } from '@/lib/diwali/rules'
import MarkdownContent from '@/components/ui/MarkdownContent'
import GiftRegistration from '@/components/diwali/GiftRegistration'
import RegistrationCelebration from '@/components/diwali/RegistrationCelebration'

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
  const [referringStore, setReferringStore] = useState('')
  const [email, setEmail] = useState('')
  const t = (english: string, kannada: string) => language === 'kn' ? kannada : english
  const loadStatus = async () => { const response = await api<{ items: Status[] }>('/api/diwali/status'); setStatuses(response.items); setVerified(true) }
  useEffect(() => {
    let active = true
    const refreshConfig = () => {
      if (document.visibilityState === 'hidden') return
      api<Config>('/api/diwali/config').then(value => { if (active) setConfig(value) }).catch(error => { if (active) setError(error.message) })
    }
    setRequestId(crypto.randomUUID())
    if (mode === 'register') setReferringStore((new URLSearchParams(window.location.search).get('store') || '').slice(0, 40))
    refreshConfig()
    window.addEventListener('focus', refreshConfig)
    const timer = window.setInterval(refreshConfig, 60_000)
    if (mode === 'status' || mode === 'confirmation') loadStatus().catch(() => {})
    return () => { active = false; window.removeEventListener('focus', refreshConfig); window.clearInterval(timer) }
  }, [mode])
  useEffect(() => {
    if (error && mode === 'register') document.getElementById('gift-registration-error')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [error, mode])
  async function task(work: () => Promise<void>) { setBusy(true); setError(''); try { await work() } catch (error) { setError(error instanceof Error ? error.message : 'Please try again') } finally { setBusy(false) } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verified) { setError(t('Verify your mobile number before submitting registration.', 'ನೋಂದಣಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.')); return }
    const data = new FormData(event.currentTarget)
    await task(async () => {
      const claim = await api<Status>('/api/diwali/register', { requestId, name: data.get('name'), email, address: data.get('address'), city: data.get('city'), district: data.get('district'), pincode: data.get('pincode'), storeCode: data.get('storeCode'), invoice: data.get('invoice'), enteredValue: Number(amount), language, accuracy: data.get('accuracy') === 'on', whatsappConsent: data.get('consent') === 'on', consentVersion: config?.consentVersion })
      setResult(claim)
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
        {mode === 'register' && !result && <GiftRegistration config={config} language={language} onLanguage={setLanguage} email={email} onEmail={setEmail} mobile={mobile} onMobile={value => { setMobile(value); setChallenge(''); setOtp(''); setVerified(false) }} challenge={challenge} otp={otp} onOtp={setOtp} verified={verified} busy={busy} onChangeMobile={() => { setVerified(false); setChallenge(''); setOtp('') }} onSendCode={() => task(async () => { const response = await api<{ challenge: string }>('/api/diwali/otp/send', { mobile, email, language, purpose: 'register' }); setChallenge(response.challenge) })} onVerifyCode={() => task(async () => { await api('/api/diwali/otp/verify', { challenge, otp }); setVerified(true) })} amount={amount} onAmount={setAmount} onSubmit={submit} onReset={() => { setEmail(''); setAmount(''); setMobile(''); setChallenge(''); setOtp(''); setVerified(false); setLanguage('en'); setError(''); setRequestId(crypto.randomUUID()) }} open={open} today={now} error={error} initialStoreCode={referringStore} />}
        {result && <RegistrationCelebration key={result.reference} language={language}>{statusCards([result])}<Link className="inline-block font-semibold text-red-800 underline" href="/diwali-gift/status">{t('Check status', 'ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ')}</Link></RegistrationCelebration>}
        {(mode === 'status' || mode === 'confirmation') && <section className="mx-auto max-w-2xl space-y-6 rounded-3xl bg-white p-6 sm:p-8"><Gift className="h-10 w-10 text-red-800" /><h1 className="text-3xl font-bold">{t('Your gift status', 'ನಿಮ್ಮ ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ')}</h1>{verified ? <>{statuses.length ? statusCards(statuses) : <p>{t('No registrations found for this verified mobile.', 'ಈ ಮೊಬೈಲ್‌ಗೆ ಯಾವುದೇ ನೋಂದಣಿ ಕಂಡುಬಂದಿಲ್ಲ.')}</p>}<button className={button} disabled={busy} onClick={() => task(loadStatus)}>{t('Refresh status', 'ಸ್ಥಿತಿಯನ್ನು ನವೀಕರಿಸಿ')}</button></> : <><p>{t('Verify the mobile used for registration to view your claims.', 'ನೋಂದಣಿಗೆ ಬಳಸಿದ ಮೊಬೈಲ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.')}</p><label className="block">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')}<input className={field} type="tel" value={mobile} onChange={event => { setMobile(event.target.value); setChallenge('') }} maxLength={10} inputMode="numeric" /></label><button className={button} disabled={busy || !/^[6-9]\d{9}$/.test(mobile)} onClick={() => task(async () => { const response = await api<{ challenge: string }>('/api/diwali/otp/send', { mobile, language, purpose: 'status' }); setChallenge(response.challenge) })}>{t('Send verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್ ಕಳುಹಿಸಿ')}</button>{challenge && <><label className="block">{t('Verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್')}<input className={field} value={otp} onChange={event => setOtp(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label><button className={button} disabled={busy || !/^\d{6}$/.test(otp)} onClick={() => task(async () => { await api('/api/diwali/otp/verify', { challenge, otp }); await loadStatus() })}>{t('View status', 'ಸ್ಥಿತಿಯನ್ನು ನೋಡಿ')}</button></>}</>}</section>}
      </>}
      {mode !== 'register' && <footer className="mt-10 flex flex-wrap gap-5 border-t border-stone-200 pt-6 text-sm text-stone-600"><Link href="/diwali-gift/terms">{t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು')}</Link><Link href="/diwali-gift/privacy">{t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</Link><a href="tel:+919071002220">+91 90710 02220</a></footer>}
    </div>
  </div>
}
