'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

export default function RegistrationCelebration({ language, children }: { language: 'en' | 'kn'; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  const t = (english: string, kannada: string) => language === 'kn' ? kannada : english
  return <>
    <div className="diwali-coin-shower" aria-hidden="true">
      {Array.from({ length: 48 }, (_, index) => <span key={index} className={`diwali-falling-coin ${index % 2 ? 'diwali-silver-coin' : 'diwali-gold-coin'}`} style={{
        left: `${(index * 37 % 100)}%`, '--coin-delay': `${index % 12 * 0.16}s`, '--coin-duration': `${3.5 + index % 5 * 0.35}s`,
        '--coin-drift': `${(index % 2 ? -1 : 1) * (25 + index % 7 * 12)}px`, width: `${22 + index % 4 * 6}px`,
      } as CSSProperties}><span>✦</span></span>)}
    </div>
    <section className="relative mx-auto my-6 max-w-2xl space-y-5 rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm sm:p-10">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><CheckCircle2 className="h-10 w-10 text-green-700" aria-hidden="true" /></div>
      <h1 ref={heading} tabIndex={-1} className="scroll-mt-24 text-3xl font-bold text-red-900 outline-none sm:text-4xl">{t('Congratulations!', 'ಅಭಿನಂದನೆಗಳು!')}</h1>
      <p className="text-lg font-semibold" role="status">{t('Your Diwali gift registration was received successfully.', 'ನಿಮ್ಮ ದೀಪಾವಳಿ ಉಡುಗೊರೆ ನೋಂದಣಿ ಯಶಸ್ವಿಯಾಗಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.')}</p>
      <p className="text-sm leading-relaxed text-stone-600">{t('Save your reference below. Your gift will be confirmed after SARA verifies your invoice.', 'ಕೆಳಗಿನ ನೋಂದಣಿ ಸಂಖ್ಯೆಯನ್ನು ಉಳಿಸಿ. SARA ಬಿಲ್ ಪರಿಶೀಲಿಸಿದ ನಂತರ ನಿಮ್ಮ ಉಡುಗೊರೆಯನ್ನು ದೃಢೀಕರಿಸಲಾಗುತ್ತದೆ.')}</p>
      {children}
    </section>
    <style jsx global>{`
      .diwali-coin-shower { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 60; }
      .diwali-falling-coin { position: absolute; top: -60px; aspect-ratio: 1; border-radius: 50%; padding: 3px; box-shadow: 2px 3px 5px #0003; animation: diwali-coin-fall var(--coin-duration) var(--coin-delay) ease-in forwards; }
      .diwali-gold-coin { background: linear-gradient(135deg, #fff2a3, #e7aa19 45%, #916004); border: 2px solid #c38a10; color: #895800; }
      .diwali-silver-coin { background: linear-gradient(135deg, #fff, #cbd5e1 45%, #64748b); border: 2px solid #94a3b8; color: #475569; }
      .diwali-falling-coin > span { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; border: 1px solid currentColor; border-radius: 50%; font-size: 16px; }
      @keyframes diwali-coin-fall { 0% { transform: translate3d(0, -60px, 0) rotateY(0) rotate(0); opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translate3d(calc(var(--coin-drift)), calc(100dvh + 100px), 0) rotateY(720deg) rotate(320deg); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .diwali-coin-shower { display: none; } }
    `}</style>
  </>
}
