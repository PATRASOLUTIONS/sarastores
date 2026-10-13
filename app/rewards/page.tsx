import { pageMetadata } from "@/lib/seo-page"
import { safeJsonLd } from "@/lib/jsonld-safe"
import Link from "next/link"
import { Coins, ArrowRight } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import RewardsClub from "@/components/home/RewardsClub"
import RewardsBalance from "@/components/RewardsBalance"
import { SPEND_PER_COIN_INR, POINT_VALUE_INR, REDEMPTION_STEP, MAX_REDEMPTION_RATIO, POINT_LIFETIME_DAYS } from "@/lib/loyalty"

export const generateMetadata = pageMetadata({
  path: "/rewards", title: brand => `Sara Coins & Membership Rewards | ${brand}`,
  description: "Earn 1 Sara Coin for every ₹1,000 in cumulative delivered purchases. Learn how coins add up, check your balance and redeem rewards at checkout.",
})

const faqs = [
  { q: "How do I earn Sara Coins?", a: `Every ₹${SPEND_PER_COIN_INR.toLocaleString("en-IN")} in cumulative delivered/completed order spending earns 1 Sara Coin. You do not need to spend it in a single order. All members earn at the same rate.` },
  { q: "Do small orders count?", a: "Yes. Two completed ₹600 orders total ₹1,200: you earn 1 coin, and ₹200 carries towards your next coin. ₹1,898 in eligible spending earns 1 coin, with ₹102 left to spend for the next." },
  { q: "When will my coins appear?", a: "Coins appear once your order is marked delivered or completed. Pending, processing and shipped orders do not earn coins yet. Past eligible orders are recalculated using the same ₹1,000 = 1 coin rule." },
  { q: "What happens if I cancel or return an order?", a: "Cancelled, returned and refunded orders do not count as eligible spending. Your earned coins are recalculated from the remaining eligible orders. Coins redeemed on a cancelled or refunded order are restored." },
  { q: "How can I redeem my coins?", a: `Each coin is worth ₹${POINT_VALUE_INR}. Redeem coins in lots of ${REDEMPTION_STEP} at checkout (100 coins = ₹25). Coins can cover up to ${Math.round(MAX_REDEMPTION_RATIO * 100)}% of an order, subject to your available balance.` },
  { q: "Do coins expire?", a: `Earned coins expire ${POINT_LIFETIME_DAYS} days after the eligible order earns them. Your membership view shows coins expiring within the next 30 days.` },
  { q: "How do I join and check my coins?", a: "Membership is free and included with your Sara account. Open My Membership in your dashboard to view your available coins, earning progress and coin activity." },
]
const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }

export default function RewardsPage() {
  return <div className="flex min-h-screen flex-col bg-[#f3f7fc]"><Header /><main className="flex-grow">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />
    <section className="bg-[#0f2557] text-white"><div className="section-container py-12 text-center md:py-16">
      <Coins className="mx-auto h-12 w-12 text-amber-300" /><h1 className="mt-4 text-3xl font-extrabold md:text-5xl">Your purchases earn Sara Coins</h1>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">Earn 1 coin for every ₹1,000 in cumulative delivered/completed spending. Small orders add up. No tier multiplier, no membership fee.</p>
      <Link href="/dashboard/membership" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-bold text-[#0f2557]">View My Membership <ArrowRight size={18} /></Link>
    </div></section>
    <RewardsBalance />
    <div className="section-container space-y-8 pb-12"><section id="how-heading" className="scroll-mt-8"><RewardsClub /></section>
      <section className="mx-auto max-w-3xl"><h2 className="mb-5 text-center text-2xl font-bold text-[#0f2557]">Sara Coins explained</h2>
        <div className="space-y-3">{faqs.map(({ q, a }) => <details key={q} className="rounded-xl border border-[#dce6f4] bg-white p-5">
          <summary className="cursor-pointer text-sm font-bold text-[#0f2557]">{q}</summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p></details>)}</div>
      </section>
      <section className="rounded-xl bg-white p-6 text-center"><h2 className="text-xl font-bold text-[#0f2557]">Start earning with your next purchase</h2>
        <p className="mt-2 text-sm text-slate-600">Sign in before ordering so eligible purchases belong to your account.</p><Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1560bd] px-6 py-3 font-semibold text-white">Start Shopping <ArrowRight size={16} /></Link></section>
    </div>
  </main><Footer /></div>
}
