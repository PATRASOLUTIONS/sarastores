"use client"

import { CreditCard, Tag } from "lucide-react"
import { isEmiOffer, type LiveRazorpayOffer } from "@/lib/razorpay-offers"

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`

export default function RazorpayOffers({ offers, loading, error, retry, mode = "offers", onSelect }: {
  offers: LiveRazorpayOffer[]; loading: boolean; error: unknown; retry: () => void;
  mode?: "offers" | "emi" | "rail"; onSelect?: (tab: "offers" | "emi") => void;
}) {
  const visible = mode === "emi" ? offers.filter(isEmiOffer) : mode === "offers" ? offers.filter(offer => !isEmiOffer(offer)) : offers
  if (loading) return <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm">Checking Razorpay {mode === "emi" ? "EMI options" : "bank offers"}...</p>
  if (error) return <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Razorpay {mode === "emi" ? "EMI offers" : "bank offers"} are currently unavailable. <button type="button" className="font-semibold underline" onClick={retry}>Retry bank offers</button></p>
  if (!visible.length) return mode === "rail" ? null : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No current Razorpay {mode === "emi" ? "EMI offers" : "bank offers"} meet this product&apos;s value. Final card eligibility and available payment plans are checked at Razorpay checkout.</p>
  return <section aria-label={mode === "emi" ? "Razorpay EMI offers" : "Razorpay bank offers"}>
    <div className={`grid gap-3 sm:grid-cols-2 ${mode === "rail" ? "lg:grid-cols-5" : ""}`}>
      {(mode === "rail" ? visible.slice(0, 5) : visible).map(offer => {
        const emi = isEmiOffer(offer)
        const Icon = emi ? CreditCard : Tag
        return <article key={offer.id} className="min-w-0 rounded-lg border border-[#dce6f4] bg-white p-4">
          <span className="inline-flex items-center gap-2 rounded bg-[#e8f1fc] px-2 py-1 text-xs font-bold text-[#1560bd]"><Icon size={16} />{offer.bank === "BANK" ? "Razorpay" : offer.bank}</span>
          <h3 className="mt-3 text-sm font-bold text-[#0f2557]">{offer.name}</h3>
          {mode !== "rail" && <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-600">{offer.description}</p>}
          {offer.discount_amount != null && <p className="mt-1 text-xs">{money(offer.discount_amount)} discount</p>}
          {offer.discount_percentage != null && <p className="mt-1 text-xs">{offer.discount_percentage}% discount{offer.max_discount != null ? `, up to ${money(offer.max_discount)}` : ""}</p>}
          {offer.min_amount != null && <p className="mt-1 text-xs text-slate-500">Minimum order {money(offer.min_amount)}</p>}
          {mode !== "rail" && <p className="mt-2 text-xs text-slate-500">Payment method: {offer.payment_method}{offer.ends_at ? ` · Ends ${new Date(offer.ends_at * 1000).toLocaleDateString("en-IN")}` : ""}</p>}
          {onSelect && <button type="button" onClick={() => onSelect(emi ? "emi" : "offers")} className="mt-3 text-xs font-semibold text-[#1560bd]">{emi ? "View EMI Details" : "View Offer Details"} &rarr;</button>}
        </article>
      })}
    </div>
    {mode !== "rail" && <p className="mt-4 text-xs leading-relaxed text-slate-500">Offers supplied by Razorpay. Eligibility, interest, processing fees and final discounts are confirmed by your bank during checkout. EMI offers are not a guarantee of no-cost instalments.</p>}
  </section>
}
