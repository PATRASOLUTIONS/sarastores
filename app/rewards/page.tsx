import type { Metadata } from "next"
import { safeJsonLd } from "@/lib/jsonld-safe"
import Link from "next/link"
import { Coins, ShoppingBag, Wallet, ShieldCheck, RefreshCw, CreditCard, Wrench, TrendingDown, ArrowRight, Sparkles } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import RewardsClub from "@/components/home/RewardsClub"
import RewardsBalance from "@/components/RewardsBalance"

export const metadata: Metadata = {
  title: "Sara Rewards Club — earn Sara Coins on every order",
  description:
    "Earn Sara Coins on every delivered order and redeem them against future purchases, with Silver, Gold and Platinum tiers earning at higher rates. Create a free account to start earning.",
  alternates: { canonical: "/rewards" },
  openGraph: {
    title: "Sara Rewards Club",
    description:
      "Earn Sara Coins on everything you buy and redeem them on future orders. Create a free account to start earning.",
    type: "website",
  },
}

const REWARDS_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "When does the Sara Rewards Club launch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Sara Rewards Club is currently in development and will launch soon. Create a free Sara account to be among the first to join when it opens.",
      },
    },
    {
      "@type": "Question",
      name: "How will I earn Sara Coins?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Once the programme launches, you will earn Sara Coins automatically on every completed order, with higher membership tiers earning at a higher rate. Final earn rates will be confirmed at launch.",
      },
    },
    {
      "@type": "Question",
      name: "How will I redeem Sara Coins?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "After launch, you will be able to apply your available Sara Coins at checkout for an instant discount on your order.",
      },
    },
    {
      "@type": "Question",
      name: "Will it cost anything to join?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Membership will be completely free. Gold and Platinum tiers will unlock automatically based on your yearly spend.",
      },
    },
  ],
}

const howItWorks = [
  { icon: ShoppingBag, title: "Shop anything", text: "Buy any product, online or in-store, at Sara Electronics." },
  { icon: Coins, title: "Earn Sara Coins", text: "A share of the value comes back to you as Coins, based on your tier." },
  { icon: Wallet, title: "Redeem at checkout", text: "Spend your Coins against a future order for an instant discount." },
]

// Mix of services live today and benefits planned for the Rewards Club launch.
const services = [
  { icon: CreditCard, title: "No-cost EMI", text: "Split any big purchase into 0% interest instalments. Available today." },
  { icon: Wrench, title: "Free installation", text: "Certified engineers set everything up at your home. Available today." },
  { icon: RefreshCw, title: "Store pickup", text: "Reserve online and collect from any of our 85+ stores. Available today." },
  { icon: ShieldCheck, title: "Purchase protection", text: "Damage cover on eligible orders. Planned for launch." },
  { icon: TrendingDown, title: "Price-drop protection", text: "If the price falls soon after you buy, we make up the difference. Planned for launch." },
  { icon: ShieldCheck, title: "Extended warranty", text: "Additional warranty cover for top-tier members. Planned for launch." },
]

const faqs = REWARDS_FAQ.mainEntity.map((q) => ({ q: q.name, a: q.acceptedAnswer.text }))

export default function RewardsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#EEF2F7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(REWARDS_FAQ) }} />
      <Header />

      <main className="flex-grow">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0B1220] text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ backgroundImage: "url('/patterns/reward-grid.svg')", backgroundSize: "48px 48px" }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="section-container relative py-14 text-center md:py-20">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Now live
            </span>
            <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
              Every purchase pays you back with{" "}
              <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">Sara Coins</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/70 md:text-base">
              Earn Sara Coins on every delivered order and redeem them straight off your next
              purchase. Higher tiers earn faster.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-7 py-3.5 text-sm font-bold text-[#3a2606] shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.03]"
              >
                Create a free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Start shopping
              </Link>
            </div>
          </div>
        </section>

        <RewardsBalance />

        <div className="section-container space-y-10 py-10 md:space-y-14 md:py-14">
          {/* How it works */}
          <section aria-labelledby="how-heading">
            <div className="mb-6 text-center">
              <h2 id="how-heading" className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
                How Sara Coins work
              </h2>
              <p className="mt-2 text-sm text-brand-text-secondary">Three simple steps. No fine print.</p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {howItWorks.map((step, i) => (
                <li key={step.title} className="relative rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
                  <span className="absolute right-4 top-4 text-5xl font-black text-brand-primary-light">{i + 1}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-primary-light text-brand-primary">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-brand-text-primary">{step.title}</h3>
                  <p className="mt-1 text-sm text-brand-text-secondary">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Tiers */}
          <RewardsClub />

          {/* Value-added services */}
          <section aria-labelledby="services-heading">
            <div className="mb-6 text-center">
              <h2 id="services-heading" className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
                More than points — real protection
              </h2>
              <p className="mt-2 text-sm text-brand-text-secondary">
                Every Sara order comes wrapped in services that keep customers coming back.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div key={s.title} className="flex gap-4 rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-primary-light text-brand-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-brand-text-primary">{s.title}</h3>
                    <p className="mt-0.5 text-xs text-brand-text-secondary">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ — native details for a JS-free, accessible accordion */}
          <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
            <div className="mb-6 text-center">
              <h2 id="faq-heading" className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
                Questions, answered
              </h2>
            </div>
            <div className="space-y-3">
              {faqs.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-brand-border bg-white p-4 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-brand-text-primary">
                    {item.q}
                    <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-brand-primary-light text-brand-primary transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-brand-primary to-indigo-600 px-6 py-10 text-center text-white md:px-10">
            <h2 className="text-2xl font-extrabold md:text-3xl">Be first in line when we launch</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
              Create your free Sara account in under a minute, and we&apos;ll let you know the moment
              the Rewards Club opens.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-brand-primary shadow-lg transition-transform hover:scale-[1.03]"
            >
              Create my free account <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
