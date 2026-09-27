/**
 * EMI / affordability engine.
 *
 * Pure arithmetic plus a local issuer configuration. This deliberately has no
 * network dependency so the product page can render an EMI ladder before the
 * Pine Labs Affordability Suite is connected (see
 * docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md, PL-02..PL-04). When Pine Labs is
 * live, replace `getEmiPlans()`'s data source — the returned shape is what the
 * UI consumes, so nothing else has to change.
 *
 * Final eligibility is always decided by the issuer during the transaction.
 */

export interface EmiIssuer {
  /** Stable key, also used for bank-offer colour lookup. */
  code: string
  name: string
  /** Annual reducing-balance interest rate, percent. */
  interestRate: number
  /** Tenures in months this issuer supports. */
  tenures: number[]
  /** Tenures the brand subsidises so the customer pays no interest. */
  noCostTenures: number[]
  /** Order value below which the issuer will not offer EMI. */
  minAmount: number
  /** One-line acquirer offer shown next to the plan. */
  offer?: string
  /** Instant discount applied on the order, capped by `maxInstantDiscount`. */
  instantDiscountPercent?: number
  maxInstantDiscount?: number
  /** Post-purchase cashback, not deducted from the payable amount. */
  cashback?: number
  /** Debit-card / cardless / BNPL rails are surfaced separately from credit. */
  instrument: "credit-card" | "debit-card" | "cardless" | "bnpl"
}

/** Order value below which no EMI option is shown at all. */
export const EMI_MIN_ORDER_VALUE = 3000

/** Processing fee charged by most issuers on a non-subsidised plan. */
export const EMI_PROCESSING_FEE = 199

export const EMI_ISSUERS: EmiIssuer[] = [
  {
    code: "HDFC",
    name: "HDFC Bank",
    interestRate: 13,
    tenures: [3, 6, 9, 12, 18, 24],
    noCostTenures: [3, 6, 9],
    minAmount: 5000,
    offer: "No Cost EMI up to 9 months",
    instantDiscountPercent: 5,
    maxInstantDiscount: 2000,
    instrument: "credit-card",
  },
  {
    code: "ICICI",
    name: "ICICI Bank",
    interestRate: 14,
    tenures: [3, 6, 9, 12, 18, 24],
    noCostTenures: [3, 6],
    minAmount: 5000,
    offer: "10% cashback up to ₹1,500",
    cashback: 1500,
    instrument: "credit-card",
  },
  {
    code: "AXIS",
    name: "Axis Bank",
    interestRate: 13.5,
    tenures: [3, 6, 9, 12, 18],
    noCostTenures: [3, 6],
    minAmount: 5000,
    offer: "₹1,500 instant discount",
    instantDiscountPercent: 4,
    maxInstantDiscount: 1500,
    instrument: "credit-card",
  },
  {
    code: "SBI",
    name: "SBI Card",
    interestRate: 15,
    tenures: [3, 6, 9, 12, 18, 24],
    noCostTenures: [3],
    minAmount: 5000,
    offer: "Special festive rate",
    instrument: "credit-card",
  },
  {
    code: "KOTAK",
    name: "Kotak Bank",
    interestRate: 14,
    tenures: [3, 6, 9, 12],
    noCostTenures: [3, 6],
    minAmount: 5000,
    offer: "No Cost EMI up to 6 months",
    instrument: "credit-card",
  },
  {
    code: "HDFC",
    name: "HDFC Debit Card EMI",
    interestRate: 15,
    tenures: [3, 6, 9, 12],
    noCostTenures: [3],
    minAmount: 8000,
    offer: "No credit card required",
    instrument: "debit-card",
  },
  {
    code: "BANK",
    name: "Cardless EMI",
    interestRate: 16,
    tenures: [3, 6, 9, 12],
    noCostTenures: [],
    minAmount: 5000,
    offer: "Instant approval, no card needed",
    instrument: "cardless",
  },
]

export interface EmiPlan {
  issuerCode: string
  issuerName: string
  instrument: EmiIssuer["instrument"]
  tenureMonths: number
  /** Rounded monthly instalment the customer pays. */
  monthlyAmount: number
  /** Total of all instalments. */
  totalPayable: number
  /** `totalPayable - principal`, zero on a no-cost plan. */
  totalInterest: number
  interestRate: number
  isNoCost: boolean
  processingFee: number
  offer?: string
  /** Instant discount the issuer applies at checkout, if any. */
  instantDiscount: number
  cashback: number
}

/**
 * Standard reducing-balance EMI:
 *   E = P·r·(1+r)^n / ((1+r)^n − 1), where r is the monthly rate.
 */
export function calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0
  if (annualRatePercent <= 0) return principal / tenureMonths

  const monthlyRate = annualRatePercent / 12 / 100
  const growth = Math.pow(1 + monthlyRate, tenureMonths)
  return (principal * monthlyRate * growth) / (growth - 1)
}

export function isEmiAvailable(price: number): boolean {
  return Number.isFinite(price) && price >= EMI_MIN_ORDER_VALUE
}

/**
 * Build every EMI plan available for an order value, cheapest instalment first.
 */
export function getEmiPlans(price: number, issuers: EmiIssuer[] = EMI_ISSUERS): EmiPlan[] {
  if (!isEmiAvailable(price)) return []

  const plans: EmiPlan[] = []

  for (const issuer of issuers) {
    if (price < issuer.minAmount) continue

    for (const tenureMonths of issuer.tenures) {
      const isNoCost = issuer.noCostTenures.includes(tenureMonths)
      const monthlyRaw = isNoCost
        ? price / tenureMonths
        : calculateEmi(price, issuer.interestRate, tenureMonths)
      const monthlyAmount = Math.round(monthlyRaw)
      const totalPayable = monthlyAmount * tenureMonths

      const instantDiscount = issuer.instantDiscountPercent
        ? Math.min(
            Math.round((price * issuer.instantDiscountPercent) / 100),
            issuer.maxInstantDiscount ?? Number.MAX_SAFE_INTEGER,
          )
        : 0

      plans.push({
        issuerCode: issuer.code,
        issuerName: issuer.name,
        instrument: issuer.instrument,
        tenureMonths,
        monthlyAmount,
        totalPayable,
        totalInterest: isNoCost ? 0 : Math.max(0, totalPayable - price),
        interestRate: isNoCost ? 0 : issuer.interestRate,
        isNoCost,
        processingFee: isNoCost ? 0 : EMI_PROCESSING_FEE,
        offer: issuer.offer,
        instantDiscount,
        cashback: issuer.cashback ?? 0,
      })
    }
  }

  return plans.sort((a, b) => a.monthlyAmount - b.monthlyAmount)
}

/**
 * The single plan advertised as "EMI from ₹X/month" — the lowest instalment
 * available, which in practice is the longest tenure on the cheapest rate.
 */
export function getLowestEmiPlan(price: number, issuers: EmiIssuer[] = EMI_ISSUERS): EmiPlan | null {
  return getEmiPlans(price, issuers)[0] ?? null
}

/** Group plans by tenure so the calculator can render one row per tenure. */
export function getPlansByTenure(plans: EmiPlan[]): Map<number, EmiPlan[]> {
  const grouped = new Map<number, EmiPlan[]>()
  for (const plan of plans) {
    const bucket = grouped.get(plan.tenureMonths)
    if (bucket) bucket.push(plan)
    else grouped.set(plan.tenureMonths, [plan])
  }
  return grouped
}

/** Distinct tenures offered across all issuers, ascending. */
export function getAvailableTenures(plans: EmiPlan[]): number[] {
  return Array.from(new Set(plans.map((p) => p.tenureMonths))).sort((a, b) => a - b)
}

/** Distinct issuers, keyed by name so debit/credit variants stay separate. */
export function getAvailableIssuers(plans: EmiPlan[]): { name: string; code: string }[] {
  const seen = new Map<string, string>()
  for (const plan of plans) {
    if (!seen.has(plan.issuerName)) seen.set(plan.issuerName, plan.issuerCode)
  }
  return Array.from(seen, ([name, code]) => ({ name, code }))
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}
