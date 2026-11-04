import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { giftForRupees } from '@/lib/diwali/rules'

type Props = {
  config: { registrationStart: string; registrationEnd: string; enabled: boolean; stores: { code: string; name: string }[] }
  language: 'en' | 'kn'; onLanguage: (value: 'en' | 'kn') => void
  mobile: string; onMobile: (value: string) => void; challenge: string; otp: string; onOtp: (value: string) => void
  verified: boolean; busy: boolean; onSendCode: () => void; onVerifyCode: () => void; onChangeMobile: () => void
  amount: string; onAmount: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onReset: () => void
  open: boolean; today: string; error: string
}
const input = 'mt-1.5 block w-full min-w-0 rounded-[9px] border border-[#d9dbe2] bg-white px-3 py-2.5 text-sm text-[#20212a] outline-none focus:border-[#b21a23] focus:ring-2 focus:ring-red-100 disabled:bg-gray-100'
const label = 'block text-xs font-semibold text-[#4c5260]'
const button = 'rounded-[10px] bg-[#990b12] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#78070d] disabled:cursor-not-allowed disabled:opacity-45'

export default function GiftRegistration(props: Props) {
  const { config, language, mobile, verified, busy, amount, open, today } = props
  const t = (english: string, kannada: string) => language === 'kn' ? kannada : english
  const gift = giftForRupees(Number(amount))
  return <>
    <div className="overflow-hidden rounded-[18px] bg-[#8b050b] shadow-[0_10px_35px_#29101518]">
      <Image src="/images/diwali-2026.webp" alt="SARA Diwali Dhamaka campaign" width={1600} height={625} priority className="block h-auto w-full" />
    </div>
    <section aria-labelledby="gift-registration-heading" className="mt-4 rounded-2xl border border-[#e8e8ed] bg-white p-4 shadow-[0_4px_18px_#11100008] sm:p-[22px]">
      <form onSubmit={props.onSubmit} onReset={props.onReset}>
        {props.error && <div id="gift-registration-error" role="alert" className="mb-4 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-900">{props.error}</div>}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#990b12]">{t('Customer registration', 'ಗ್ರಾಹಕರ ನೋಂದಣಿ')}</p><h1 id="gift-registration-heading" className="mt-1 text-[22px] font-bold text-[#20212a] sm:text-[27px]">{t('Register Your Diwali Gift', 'ನಿಮ್ಮ ದೀಪಾವಳಿ ಉಡುಗೊರೆಯನ್ನು ನೋಂದಾಯಿಸಿ')}</h1><p className="mt-1 text-sm text-[#697080]">{t('Purchase from ₹15,000. Register your invoice for an eligible Silver or Gold gift.', '₹15,000 ರಿಂದ ಖರೀದಿಸಿ. ಅರ್ಹ ಬೆಳ್ಳಿ ಅಥವಾ ಚಿನ್ನದ ಉಡುಗೊರೆಗಾಗಿ ನಿಮ್ಮ ಬಿಲ್ ನೋಂದಾಯಿಸಿ.')}</p></div>
          <label className={`${label} w-full sm:w-48`}>{t('Preferred WhatsApp language', 'ಆದ್ಯತೆಯ WhatsApp ಭಾಷೆ')}<select className={input} value={language} disabled={busy} onChange={event => props.onLanguage(event.target.value as 'en' | 'kn')}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option></select></label>
        </div>
        <p className="mt-2 text-xs text-[#697080]">{t('Registration dates (IST)', 'ನೋಂದಣಿ ದಿನಾಂಕಗಳು (IST)')}: {config.registrationStart} – {config.registrationEnd}</p>
        {!open ? <p role="status" className="mt-4 rounded-[10px] bg-[#fff5e8] px-3.5 py-3 text-sm text-[#865000]">{!config.enabled ? t('SARA has not enabled registration yet.', 'SARA ಇನ್ನೂ ನೋಂದಣಿಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿಲ್ಲ.') : today < config.registrationStart ? t(`Registration opens on ${config.registrationStart}.`, `ನೋಂದಣಿ ${config.registrationStart} ರಂದು ತೆರೆಯುತ್ತದೆ.`) : t(`Registration ended on ${config.registrationEnd}.`, `ನೋಂದಣಿ ${config.registrationEnd} ರಂದು ಮುಕ್ತಾಯಗೊಂಡಿದೆ.`)}</p> : <fieldset disabled={busy} className="mt-4 min-w-0">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className={label}>{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} *<input name="name" aria-label={t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} className={input} required minLength={2} maxLength={150} autoComplete="name" placeholder={t('Enter full name', 'ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ')} /></label>
            <div><label htmlFor="gift-mobile" className={label}>{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} *</label><div className="mt-1.5 flex items-center gap-2"><input id="gift-mobile" aria-label={t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} className={`${input} !mt-0 flex-1`} value={mobile} readOnly={verified} onChange={event => props.onMobile(event.target.value)} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder={t('10-digit mobile number', '10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} /><button type="button" className={`${button} shrink-0 !px-3 !text-xs`} disabled={busy || (!verified && !/^[6-9]\d{9}$/.test(mobile))} onClick={verified ? props.onChangeMobile : props.onSendCode}>{verified ? t('Change', 'ಬದಲಾಯಿಸಿ') : t('Send verification code', 'ಪರಿಶೀಲನೆ ಕೋಡ್ ಕಳುಹಿಸಿ')}</button></div>
              {verified ? <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#13845a]"><CheckCircle2 className="h-3.5 w-3.5" />{t('Mobile verified', 'ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ')}</p> : props.challenge ? <div className="mt-2"><label htmlFor="gift-otp" className={label}>{t('Six-digit code sent on WhatsApp', 'WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿದ ಆರು ಅಂಕಿಯ ಕೋಡ್')}</label><div className="mt-1.5 flex gap-2"><input id="gift-otp" aria-label={t('Six-digit code sent on WhatsApp', 'WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿದ ಆರು ಅಂಕಿಯ ಕೋಡ್')} className={`${input} !mt-0 flex-1`} value={props.otp} onChange={event => props.onOtp(event.target.value)} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /><button type="button" className={`${button} shrink-0 !px-3 !text-xs`} disabled={busy || !/^\d{6}$/.test(props.otp)} onClick={props.onVerifyCode}>{t('Verify mobile', 'ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಿ')}</button></div></div> : <p className="mt-1.5 text-xs text-[#697080]">{t('Fill in your details; verify this mobile before submitting.', 'ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ; ಸಲ್ಲಿಸುವ ಮೊದಲು ಈ ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಿ.')}</p>}
            </div>
            <label className={`${label} sm:col-span-2`}>{t('Complete delivery address', 'ಸಂಪೂರ್ಣ ವಿತರಣಾ ವಿಳಾಸ')} *<textarea name="address" aria-label={t('Complete delivery address', 'ಸಂಪೂರ್ಣ ವಿತರಣಾ ವಿಳಾಸ')} className={`${input} min-h-[74px] resize-y`} required minLength={10} maxLength={800} autoComplete="street-address" rows={2} placeholder={t('House / flat, street and area', 'ಮನೆ / ಫ್ಲಾಟ್, ರಸ್ತೆ ಮತ್ತು ಪ್ರದೇಶ')} /></label>
            {([['city', t('City', 'ನಗರ')], ['district', t('District', 'ಜಿಲ್ಲೆ')]] as const).map(([name, text]) => <label key={name} className={label}>{text} *<input name={name} aria-label={text} className={input} required minLength={2} maxLength={100} /></label>)}
            <label className={label}>{t('PIN code', 'ಪಿನ್ ಕೋಡ್')} *<input name="pincode" aria-label={t('PIN code', 'ಪಿನ್ ಕೋಡ್')} className={input} required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="postal-code" placeholder={t('6-digit PIN code', '6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್')} /></label>
            <label className={label}>{t('Invoice store', 'ಬಿಲ್‌ನ ಅಂಗಡಿ')} *<select name="storeCode" aria-label={t('Invoice store', 'ಬಿಲ್‌ನ ಅಂಗಡಿ')} className={input} required defaultValue=""><option value="">{t('Select the store on your invoice', 'ನಿಮ್ಮ ಬಿಲ್‌ನ ಅಂಗಡಿಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ')}</option>{config.stores.map(store => <option key={store.code} value={store.code}>{store.name} · {store.code}</option>)}</select></label>
            <label className={label}>{t('Invoice number', 'ಬಿಲ್ ಸಂಖ್ಯೆ')} *<input name="invoice" aria-label={t('Invoice number', 'ಬಿಲ್ ಸಂಖ್ಯೆ')} className={input} required maxLength={100} placeholder={t('Enter invoice number', 'ಬಿಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ')} /></label>
            <label className={label}>{t('Invoice value in rupees', 'ರೂಪಾಯಿಗಳಲ್ಲಿ ಬಿಲ್ ಮೊತ್ತ')} *<input type="number" aria-label={t('Invoice value in rupees', 'ರೂಪಾಯಿಗಳಲ್ಲಿ ಬಿಲ್ ಮೊತ್ತ')} className={input} required min={15000} max={100000000} step={1} value={amount} onChange={event => props.onAmount(event.target.value)} placeholder={t('Enter invoice value', 'ಬಿಲ್ ಮೊತ್ತ ನಮೂದಿಸಿ')} /></label>
          </div>
          <div className="mt-3.5 rounded-xl border border-[#f1d99c] bg-[#fff8e8] p-3.5"><p className="text-xs text-[#697080]">{t('Indicative gift eligibility', 'ಅಂದಾಜು ಉಡುಗೊರೆ ಅರ್ಹತೆ')}</p><p className="mt-1 text-lg font-bold text-[#8d5500]">{gift ? language === 'kn' ? gift.kannada : gift.label : t('Enter invoice value to calculate gift', 'ಉಡುಗೊರೆ ಲೆಕ್ಕಾಚಾರಕ್ಕಾಗಿ ಬಿಲ್ ಮೊತ್ತ ನಮೂದಿಸಿ')}</p><p className="mt-1 text-xs text-[#697080]">{t('Final eligibility is subject to manual verification by SARA.', 'ಅಂತಿಮ ಅರ್ಹತೆ SARA ಬಿಲ್ ಪರಿಶೀಲನೆಗೆ ಒಳಪಟ್ಟಿದೆ.')}</p></div>
          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#555]"><input type="checkbox" name="accuracy" required className="mt-0.5 h-4 w-4 shrink-0" />{t('I confirm my details and invoice are genuine.', 'ನನ್ನ ವಿವರಗಳು ಮತ್ತು ಬಿಲ್ ನಿಜವೆಂದು ನಾನು ದೃಢೀಕರಿಸುತ್ತೇನೆ.')}</label>
          <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#555]"><input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 shrink-0" />{t('I agree to receive WhatsApp updates about my registration and gift delivery.', 'ನನ್ನ ನೋಂದಣಿ ಮತ್ತು ಉಡುಗೊರೆ ವಿತರಣೆ ಕುರಿತು WhatsApp ಸಂದೇಶಗಳನ್ನು ಸ್ವೀಕರಿಸಲು ನಾನು ಒಪ್ಪುತ್ತೇನೆ.')}</label>
          <p className="mt-2 text-xs leading-5 text-[#697080]"><Link className="underline" href="/diwali-gift/terms">{t('Campaign terms', 'ಅಭಿಯಾನದ ನಿಯಮಗಳು')}</Link> · <Link className="underline" href="/diwali-gift/privacy">{t('Privacy notice', 'ಗೌಪ್ಯತೆ ಸೂಚನೆ')}</Link></p>
          <div className="mt-4 flex flex-wrap gap-2.5"><button type="submit" className={button} disabled={busy || !verified}>{busy ? t('Submitting…', 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…') : t('Submit registration', 'ನೋಂದಣಿ ಸಲ್ಲಿಸಿ')}</button><button type="reset" className="rounded-[10px] bg-[#f1f2f5] px-4 py-2.5 text-sm font-semibold text-[#303541] disabled:opacity-45" disabled={busy}>{t('Clear form', 'ಫಾರ್ಮ್ ತೆರವುಗೊಳಿಸಿ')}</button></div>
        </fieldset>}
      </form>
    </section>
  </>
}
