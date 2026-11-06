"use client"

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import Link from "next/link"
import MetalCoin from "@/components/promotions/MetalCoin"
import type { PromotionProduct } from "@/lib/storefront-promotion-types"
import { giftTermsHref, PRODUCT_GIFT_CELEBRATION_MS } from "@/lib/product-promotion-display"

export function FallingGiftCoins() {
  return <div className="sara-coin-shower pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {Array.from({ length: 24 }, (_, index) => <span key={index} className="absolute -top-20" style={{
      left: `${(index * 37 + 3) % 100}%`, width: `${28 + (index % 4) * 9}px`,
      "--fall-duration": `${3.2 + (index % 5) * .3}s`, "--fall-delay": `${-(index % 7) * .45}s`,
      "--fall-drift": `${index % 2 ? 65 : -65}px`,
    } as CSSProperties}><MetalCoin tone={index % 2 ? "gold" : "silver"} className="h-auto w-full drop-shadow-md" /></span>)}
    <style>{`
      .sara-coin-shower > span { animation: sara-metal-fall var(--fall-duration) linear var(--fall-delay) infinite; }
      @keyframes sara-metal-fall {
        from { transform: translate3d(0, -80px, 0) rotate(0deg); }
        to { transform: translate3d(var(--fall-drift), calc(100dvh + 100px), 0) rotate(420deg); }
      }
      @media (prefers-reduced-motion: reduce) { .sara-coin-shower { display: none; } }
    `}</style>
  </div>
}

export default function ProductGiftCelebration({ product, onClose, restoreFocus, children }: {
  product: PromotionProduct; onClose: () => void; restoreFocus: () => void; children: ReactNode;
}) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  // Quote refreshes do not reset the five-second dismissal timer.
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), PRODUCT_GIFT_CELEBRATION_MS)
    return () => window.clearTimeout(timer)
  }, [product.id])

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#fff7e5]/95"><FallingGiftCoins /></Dialog.Overlay>
      <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus() }}
        className="fixed left-1/2 top-1/2 z-[61] max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-amber-100 bg-white p-5 shadow-2xl outline-none sm:p-8">
        <Dialog.Close aria-label="Close gift animation" className="absolute right-3 top-3 rounded-full p-2 text-gray-500 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-600"><X className="h-5 w-5" /></Dialog.Close>
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-amber-700">A little more with your purchase</p>
        <Dialog.Title className="mt-2 pr-3 text-center text-xl font-bold text-gray-900 sm:text-2xl">Your product &amp; eligible gifts</Dialog.Title>
        <p className="mb-5 mt-3 text-center text-sm font-semibold text-gray-700">{product.name}</p>
        {children}
        <div className="mt-5 flex items-center justify-between gap-3 text-xs">
          <Link href={giftTermsHref(product.id)} onClick={onClose} className="font-semibold text-[#1560BD] underline">Gift Terms*</Link>
          <span className="text-gray-500">Closes automatically in 5 seconds</span>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
