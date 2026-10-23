"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle, MapPin, MessageCircle, PhoneCall, Receipt, Store, X } from "lucide-react"
import { formatDistance, useNearbyStores } from "@/hooks/useNearbyStores"
import { STORE_PAYMENT_PLATFORMS, StorePaymentTransactionSchema, type StorePaymentPlatform } from "@/types/store-payment"

export interface PayAtStoreChoice {
  id: string
  name: string
}

/** Which store the shopper will pay. Pickup orders pay where they collect. */
export function PayAtStoreStorePicker({ isPickup, pickupStore, deliveryPincode, deliveryCity, value, onChange }: {
  isPickup: boolean
  pickupStore: PayAtStoreChoice | null
  deliveryPincode: string
  deliveryCity: string
  value: PayAtStoreChoice | null
  onChange: (store: PayAtStoreChoice | null) => void
}) {
  const { stores, loading, error, retry, nearestId } = useNearbyStores(deliveryPincode, deliveryCity)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (isPickup) {
      if (value?.id !== pickupStore?.id) onChange(pickupStore)
      return
    }
    if (!value && nearestId) {
      const nearest = stores.find(store => store.id === nearestId)
      if (nearest) onChange({ id: nearest.id, name: nearest.name })
    }
  }, [isPickup, pickupStore, value, nearestId, stores, onChange])

  if (isPickup) {
    return <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {pickupStore ? <>You will pay <strong>{pickupStore.name}</strong>, the store you are collecting from.</>
        : "Choose a pickup store in Delivery Options to pay at that store."}
    </p>
  }

  const visible = showAll ? stores : stores.slice(0, 4)
  return <div className="mt-3 rounded-lg border border-slate-200 p-3">
    <p className="mb-2 text-sm font-semibold text-slate-900">Choose the store you want to pay</p>
    {loading ? <p className="text-sm text-slate-600">Loading stores…</p>
      : error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={retry}>Retry</button></p>
        : stores.length === 0 ? <p className="text-sm text-slate-600">No store can take payments right now.</p>
          : <>
            <ul className="grid gap-2">
              {visible.map(store => (
                <li key={store.id}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs ${value?.id === store.id ? "border-[#1560BD] bg-blue-50/60" : "border-slate-200 hover:border-slate-400"}`}>
                    <input type="radio" name="payAtStore" className="mt-0.5 accent-[#1560BD]" checked={value?.id === store.id}
                      onChange={() => onChange({ id: store.id, name: store.name })} />
                    <span className="min-w-0">
                      <strong className="block text-sm text-slate-900">{store.name}</strong>
                      <span className="text-slate-600">{store.city}{store.distance !== null && ` · ${formatDistance(store.distance)}`}</span>
                      {store.id === nearestId && <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-green-700"><MapPin size={10} />Nearest</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {stores.length > 4 && <button type="button" onClick={() => setShowAll(value => !value)} className="mt-2 text-xs font-semibold text-[#1560BD] underline">
              {showAll ? "Show fewer stores" : `Show all ${stores.length} stores`}
            </button>}
          </>}
  </div>
}

export function PayAtStoreDialog({ storeName, orderReference, amount, customerPhone, storeNotified, submitting, onSubmit, onClose }: {
  storeName: string
  orderReference: string
  amount: number
  customerPhone: string
  storeNotified: boolean
  submitting: boolean
  onSubmit: (platform: StorePaymentPlatform, transactionId: string) => void
  onClose: () => void
}) {
  const [platform, setPlatform] = useState<StorePaymentPlatform | "">("")
  const [transactionId, setTransactionId] = useState("")
  const [error, setError] = useState("")

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = StorePaymentTransactionSchema.safeParse({ platform, transactionId })
    if (!parsed.success) {
      setError(platform ? parsed.error.issues[0]?.message || "Check the transaction details" : "Choose the platform you paid with")
      return
    }
    setError("")
    onSubmit(parsed.data.platform, parsed.data.transactionId)
  }

  const steps = [
    { icon: Store, text: <><strong>{storeName}</strong> has received your order <strong>{orderReference}</strong>.</> },
    { icon: PhoneCall, text: <>A store manager will call you{customerPhone ? <> on <strong>{customerPhone}</strong></> : null}.</> },
    { icon: MessageCircle, text: <>They will send a payment link to your WhatsApp. Pay <strong>₹{amount.toLocaleString("en-IN")}</strong>.</> },
    { icon: Receipt, text: <>Enter the platform you paid with and the transaction ID below to place your order.</> },
  ]

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pay-at-store-title">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="pay-at-store-title" className="font-heading text-lg font-bold text-[#0F2557]">Pay at store</h2>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-3">
          {steps.map(({ icon: Icon, text }, index) => (
            <li key={index} className="flex gap-3 text-sm text-slate-700">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1560BD]"><Icon size={15} /></span>
              <span className="pt-1">{text}</span>
            </li>
          ))}
        </ol>
        {!storeNotified && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          We could not reach the store automatically. Please call the store and quote order {orderReference}.
        </p>}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label htmlFor="store-payment-platform" className="mb-1 block text-sm font-medium text-slate-800">Paid via</label>
            <select id="store-payment-platform" value={platform} disabled={submitting}
              onChange={event => setPlatform(event.target.value as StorePaymentPlatform | "")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Choose platform / gateway</option>
              {STORE_PAYMENT_PLATFORMS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="store-payment-txn" className="mb-1 block text-sm font-medium text-slate-800">Transaction ID</label>
            <input id="store-payment-txn" value={transactionId} disabled={submitting} maxLength={80} autoComplete="off"
              onChange={event => setTransactionId(event.target.value)} placeholder="e.g. T2410231234567890"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0054F0] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Placing order..." : <><CheckCircle size={16} />Submit &amp; place order</>}
          </button>
          <p className="text-center text-xs text-slate-500">Your order stays pending until the store confirms your payment.</p>
        </form>
      </div>
    </div>
  )
}
