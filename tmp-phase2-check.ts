import { scoreCustomer, segmentFor } from "./lib/retention/segmentation"
import { addMonths, warrantyMonthsFor, daysBetween } from "./lib/retention/rules"

const now = new Date("2026-08-07")
const d = (days: number) => new Date(now.getTime() - days * 864e5)

const cases = [
  { n: "new small buyer 10d", lastOrderAt: d(10), orderCount: 1, lifetimeSpend: 8000 },
  { n: "big spender 20d", lastOrderAt: d(20), orderCount: 2, lifetimeSpend: 150000 },
  { n: "frequent 15d", lastOrderAt: d(15), orderCount: 12, lifetimeSpend: 90000 },
  { n: "quiet 120d", lastOrderAt: d(120), orderCount: 3, lifetimeSpend: 60000 },
  { n: "quiet 300d", lastOrderAt: d(300), orderCount: 4, lifetimeSpend: 70000 },
  { n: "gone 500d", lastOrderAt: d(500), orderCount: 5, lifetimeSpend: 80000 },
  { n: "never ordered", lastOrderAt: null, orderCount: 0, lifetimeSpend: 0 },
]

console.log("--- RFM segmentation ---")
for (const c of cases) {
  const s = scoreCustomer({ ...c, now })
  console.log(`${c.n.padEnd(22)} R${s.recency} F${s.frequency} M${s.monetary} -> ${segmentFor(s)}`)
}

console.log("--- warranty + date maths ---")
console.log(
  "AC:", warrantyMonthsFor("Air Conditioners"),
  "WashingMachines:", warrantyMonthsFor("Washing Machines"),
  "unknown:", warrantyMonthsFor(null),
)
const bought = new Date("2025-01-31")
console.log("31-Jan-2025 +12mo =", addMonths(bought, 12).toDateString())
console.log("31-Jan-2025 +1mo  =", addMonths(bought, 1).toDateString(), "<- clamped")
console.log("daysBetween(1Jan26, 7Aug26) =", daysBetween(new Date("2026-01-01"), now))
