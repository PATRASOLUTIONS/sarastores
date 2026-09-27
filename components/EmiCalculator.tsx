"use client"

import { useMemo, useState } from "react"
import { Calculator, CreditCard, Info, Sparkles, X } from "lucide-react"
import {
  formatInr,
  getAvailableIssuers,
  getAvailableTenures,
  getEmiPlans,
  getLowestEmiPlan,
  isEmiAvailable,
  type EmiPlan,
} from "@/lib/emi"
import { getBorderColor } from "@/types/razorpay"
import { analytics } from "@/lib/analytics"

const INSTRUMENT_LABELS: Record<EmiPlan["instrument"], string> = {
  "credit-card": "Credit Card",
  "debit-card": "Debit Card",
  cardless: "Cardless",
  bnpl: "Pay Later",
}

export function EmiFromBadge({ price }: { price: number }) {
  const lowest = useMemo(() => getLowestEmiPlan(price), [price])
  if (!lowest) return null

  return (
    <span className="text-sm text-gray-700">
      EMI from{" "}
      <span className="font-semibold text-brand-primary">
        {formatInr(lowest.monthlyAmount)}/month
      </span>
    </span>
  )
}

export default function EmiCalculator({
  price,
  productName,
  productId,
}: {
  price: number
  productName?: string
  productId?: string
}) {
  const [open, setOpen] = useState(false)
  const [tenureFilter, setTenureFilter] = useState<number | "all">("all")
  const [issuerFilter, setIssuerFilter] = useState<string>("all")

  const plans = useMemo(() => getEmiPlans(price), [price])
  const lowest = plans[0] ?? null
  const tenures = useMemo(() => getAvailableTenures(plans), [plans])
  const issuers = useMemo(() => getAvailableIssuers(plans), [plans])

  const visiblePlans = useMemo(
    () =>
      plans.filter(
        (plan) =>
          (tenureFilter === "all" || plan.tenureMonths === tenureFilter) &&
          (issuerFilter === "all" || plan.issuerName === issuerFilter),
      ),
    [plans, tenureFilter, issuerFilter],
  )

  if (!isEmiAvailable(price) || !lowest) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              EMI from {formatInr(lowest.monthlyAmount)}/month
            </p>
            <p className="text-xs text-gray-600">
              {lowest.isNoCost ? "No Cost EMI available" : `${lowest.tenureMonths} months`} · Credit
              card, debit card &amp; cardless options
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            analytics.viewEmiOptions({
              itemId: productId || "",
              itemName: productName || "",
              price,
            })
          }}
          className="rounded-lg border border-brand-primary bg-white px-3 py-1.5 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
        >
          View EMI &amp; bank offers
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="EMI and bank offers"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Calculator className="h-5 w-5 text-brand-primary" />
                  EMI &amp; bank offers
                </h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  {productName ? `${productName} · ` : ""}Order value {formatInr(price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 border-b border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Tenure</span>
                <select
                  value={tenureFilter}
                  onChange={(event) =>
                    setTenureFilter(event.target.value === "all" ? "all" : Number(event.target.value))
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="all">All</option>
                  {tenures.map((tenure) => (
                    <option key={tenure} value={tenure}>
                      {tenure} months
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Bank</span>
                <select
                  value={issuerFilter}
                  onChange={(event) => {
                    setIssuerFilter(event.target.value)
                    const plan = plans.find((p) => p.issuerName === event.target.value)
                    if (plan) {
                      analytics.selectEmiPlan({
                        bank: plan.issuerName,
                        tenureMonths: plan.tenureMonths,
                        monthlyAmount: plan.monthlyAmount,
                        noCost: plan.isNoCost,
                      })
                    }
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="all">All banks</option>
                  {issuers.map((issuer) => (
                    <option key={issuer.name} value={issuer.name}>
                      {issuer.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {visiblePlans.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-600">
                  No EMI plan matches this combination. Try a different tenure or bank.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                        <th scope="col" className="py-2 pr-3 font-medium">Bank</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Tenure</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Monthly</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Interest</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Total</th>
                        <th scope="col" className="py-2 font-medium">Offer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlans.map((plan) => (
                        <tr
                          key={`${plan.issuerName}-${plan.tenureMonths}`}
                          className={`border-b border-l-2 border-gray-100 ${getBorderColor(plan.issuerCode)}`}
                        >
                          <td className="py-3 pr-3">
                            <span className="block font-medium text-gray-900">{plan.issuerName}</span>
                            <span className="text-xs text-gray-500">
                              {INSTRUMENT_LABELS[plan.instrument]}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-gray-700">{plan.tenureMonths} mo</td>
                          <td className="py-3 pr-3 font-semibold text-gray-900">
                            {formatInr(plan.monthlyAmount)}
                          </td>
                          <td className="py-3 pr-3 text-gray-700">
                            {plan.isNoCost ? (
                              <span className="font-medium text-green-700">Nil</span>
                            ) : (
                              <>
                                {plan.interestRate}%
                                <span className="block text-xs text-gray-500">
                                  {formatInr(plan.totalInterest)}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-gray-700">{formatInr(plan.totalPayable)}</td>
                          <td className="py-3">
                            <div className="flex flex-col gap-1">
                              {plan.isNoCost && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                  <Sparkles className="h-3 w-3" />
                                  No Cost EMI
                                </span>
                              )}
                              {plan.instantDiscount > 0 && (
                                <span className="text-xs text-gray-600">
                                  {formatInr(plan.instantDiscount)} instant discount
                                </span>
                              )}
                              {plan.cashback > 0 && (
                                <span className="text-xs text-gray-600">
                                  Up to {formatInr(plan.cashback)} cashback
                                </span>
                              )}
                              {!plan.isNoCost && plan.processingFee > 0 && (
                                <span className="text-xs text-gray-500">
                                  + {formatInr(plan.processingFee)} processing fee
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 border-t border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                EMI amounts are indicative and calculated on a reducing-balance basis. Final tenures,
                interest and offer eligibility are confirmed by your bank during payment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
