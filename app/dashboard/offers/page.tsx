"use client"

import { useOffers } from "@/hooks/useOffers"
import Link from "next/link"
import { Tag, Calendar, Copy, Check, ArrowRight, BadgePercent } from "lucide-react"
import { useState } from "react"
import { toast } from "react-hot-toast"

const isValidDate = (value?: string) => !!value && !Number.isNaN(new Date(value).getTime())

const money = (value: number) => Number(value).toLocaleString("en-IN")

export default function OffersPage() {
  const { offers, isLoading } = useOffers()
  const [copiedCodes, setCopiedCodes] = useState<Set<string>>(new Set())

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCodes((prev) => new Set([...prev, code]))
    toast.success("Coupon code copied")

    setTimeout(() => {
      setCopiedCodes((prev) => {
        const next = new Set(prev)
        next.delete(code)
        return next
      })
    }, 2000)
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-5 py-3.5">
          <h1 className="font-heading text-[16px] font-bold text-[#0F2557]">My Offers</h1>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
              <div className="mb-3 h-4 w-1/2 rounded bg-gray-200" />
              <div className="mb-2 h-3 w-full rounded bg-gray-100" />
              <div className="mb-4 h-3 w-2/3 rounded bg-gray-100" />
              <div className="h-9 w-full rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="min-w-0">
          <h1 className="font-heading text-[16px] font-bold text-[#0F2557]">My Offers</h1>
          <p className="mt-0.5 text-[12px] text-slate-600">Coupons and deals you can use at checkout.</p>
        </div>
        <Link
          href="/offers"
          className="flex flex-shrink-0 items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
        >
          All Offers
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {offers.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F4F8FD] text-[#1560BD]">
            <Tag className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <h2 className="mt-3 font-heading text-[15px] font-bold text-[#0F2557]">No offers available yet</h2>
          <p className="mt-1 text-[12px] text-slate-600">Check back soon — member deals and coupons appear here.</p>
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1560BD] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0F2557]"
          >
            Start Shopping
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {offers.map((offer) => {
            const copied = offer.code ? copiedCodes.has(offer.code) : false
            return (
              <article
                key={offer.id}
                className="flex flex-col overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start gap-3 border-b border-gray-100 bg-[#F4F8FD] px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#1560BD]">
                    <BadgePercent className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-[14px] font-bold text-[#0F2557]">
                      {offer.title || offer.name || "Special offer"}
                    </h2>
                    {isValidDate(offer.endDate) && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
                        <Calendar className="h-3 w-3" />
                        Valid until {new Date(offer.endDate).toLocaleDateString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  {offer.description && (
                    <p className="text-[12px] leading-snug text-slate-600">{offer.description}</p>
                  )}

                  {Number(offer.discountValue) > 0 && (
                    <div>
                      <p className="text-[16px] font-bold text-[#E11D2E]">
                        {offer.discountType === "percentage" && `${offer.discountValue}% OFF`}
                        {offer.discountType === "fixed" && `₹${money(offer.discountValue)} OFF`}
                        {offer.discountType === "buyOneGetOne" && "Buy One Get One Free"}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                        {offer.minPurchase ? <p>Min. purchase ₹{money(offer.minPurchase)}</p> : null}
                        {offer.maxDiscount ? <p>Max. discount ₹{money(offer.maxDiscount)}</p> : null}
                      </div>
                    </div>
                  )}

                  {offer.code && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Coupon Code
                      </p>
                      <div className="flex items-stretch gap-2">
                        <code className="flex-1 truncate rounded-lg border border-dashed border-[#1560BD] bg-[#F4F8FD] px-3 py-2 font-mono text-[13px] font-semibold text-[#0F2557]">
                          {offer.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(offer.code)}
                          aria-label={copied ? "Code copied" : `Copy code ${offer.code}`}
                          className="flex min-w-[44px] items-center justify-center rounded-lg border border-gray-200 px-3 text-[#1560BD] transition-colors hover:bg-[#F4F8FD]"
                        >
                          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Link
                    href="/products"
                    className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-[#1560BD] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0F2557]"
                  >
                    Shop Now
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
