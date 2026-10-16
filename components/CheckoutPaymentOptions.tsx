"use client"

import Image from "next/image"
import { Package, Store } from "lucide-react"
import { PAYMENT_PROVIDER_LABELS, type PaymentProvider } from "@/types/payment-gateways"

export type CheckoutPaymentChoice = PaymentProvider | "cash-on-delivery" | "instore"

const PROVIDER_LOGOS: Record<PaymentProvider, { src: string; width: number; height: number }> = {
  pinelabs: { src: "/payment-gateways/pinelabs.svg", width: 168, height: 58 },
  razorpay: { src: "/payment-gateways/razorpay.svg", width: 316, height: 67 },
  paytm: { src: "/payment-gateways/paytm.svg", width: 180, height: 55 },
}

export function PaymentProviderLogo({ provider, className = "h-8 w-28 object-contain object-left" }: {
  provider: PaymentProvider
  className?: string
}) {
  return <Image {...PROVIDER_LOGOS[provider]} alt={PAYMENT_PROVIDER_LABELS[provider]} className={className} />
}

const OFFLINE_OPTIONS = [
  { id: "cash-on-delivery", label: "Cash on Delivery", description: "Pay when your order is delivered.", icon: Package },
  { id: "instore", label: "In-store Purchase", description: "Verify your purchase with a SARA store.", icon: Store },
] as const

export default function CheckoutPaymentOptions({ providers, codEnabled, selected, onChange }: {
  providers: PaymentProvider[]
  codEnabled: boolean
  selected: CheckoutPaymentChoice | null
  onChange: (choice: CheckoutPaymentChoice) => void
}) {
  const optionClass = (checked: boolean) =>
    `flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-[#1560BD]/40 ${
      checked ? "border-[#1560BD] bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-400"
    }`

  return (
    <fieldset aria-label="Payment options" className="grid gap-2.5">
      {providers.map(provider => (
        <label key={provider} className={optionClass(selected === provider)}>
          <input type="radio" name="paymentChoice" value={provider} checked={selected === provider}
            onChange={() => onChange(provider)} className="h-4 w-4 shrink-0 accent-[#1560BD]" />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
            <PaymentProviderLogo provider={provider} />
            <span className="text-xs text-slate-600">
              <strong className="block text-sm font-semibold text-slate-900">{PAYMENT_PROVIDER_LABELS[provider]}</strong>
              Choose your payment option securely at the gateway.
            </span>
          </span>
        </label>
      ))}
      {OFFLINE_OPTIONS.filter(option => option.id !== "cash-on-delivery" || codEnabled).map(({ id, label, description, icon: Icon }) => (
        <label key={id} className={optionClass(selected === id)}>
          <input type="radio" name="paymentChoice" value={id} checked={selected === id}
            onChange={() => onChange(id)} className="h-4 w-4 shrink-0 accent-[#1560BD]" />
          <Icon size={22} className="shrink-0 text-slate-600" aria-hidden="true" />
          <span className="text-xs text-slate-600">
            <strong className="block text-sm font-semibold text-slate-900">{label}</strong>
            {description}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
