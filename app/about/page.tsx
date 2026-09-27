"use client"

import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Handshake,
  Headphones,
  HeartHandshake,
  Layers,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wrench,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useSettingsData } from "@/hooks/useSettingsData"
import { useBrandImages } from "@/hooks/useBrandImages"

const PROMISES = [
  { icon: HeartHandshake, title: "Customer First", detail: "Always" },
  { icon: Layers, title: "Wide Range", detail: "Top Global Brands" },
  { icon: Wrench, title: "Expert Guidance", detail: "In-Store & Online" },
  { icon: Handshake, title: "Seamless Service", detail: "Before & After Purchase" },
]

const VALUES = [
  {
    icon: HeartHandshake,
    title: "Customer First",
    body: "Every decision starts with the person buying. Honest advice, fair prices and a straight answer — even when it costs us the sale.",
  },
  {
    icon: ShieldCheck,
    title: "Integrity",
    body: "Brand-authorised stock, full manufacturer warranty and a GST invoice on every order. No grey imports, no shortcuts.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    body: "We bring the latest technology to Karnataka early, and we make sure our teams know how to explain it in plain language.",
  },
  {
    icon: Users,
    title: "Community",
    body: "We hire locally, service locally and grow with the neighbourhoods our stores sit in. Karnataka is not a market to us — it is home.",
  },
]

/** Phases rather than invented dates: swap in the confirmed history when available. */
const JOURNEY = [
  { marker: "The beginning", label: "A single store opens, selling and servicing electronics in Karnataka." },
  { marker: "Growing roots", label: "More neighbourhood stores, each staffed and serviced by our own people." },
  { marker: "Going multi-brand", label: "Authorised dealership across the leading global appliance and mobile brands." },
  { marker: "Service in-house", label: "Our own delivery and installation engineers, instead of third-party contractors." },
  { marker: "Statewide", label: "Coverage extended across Karnataka, with after-sales reaching well beyond our showrooms." },
  { marker: "Online + in store", label: "The storefront goes live, so you can buy online and collect from the store nearby." },
  { marker: "Today", label: "One of Karnataka's leading multi-brand technology retail chains." },
]

const TRUST = [
  { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
  { icon: CreditCard, title: "Easy EMI Options", subtitle: "All Major Banks" },
  { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
  { icon: RefreshCw, title: "Hassle-Free Returns", subtitle: "Easy & Secure" },
  { icon: Headphones, title: "Expert Support", subtitle: "" },
]

export default function AboutPage() {
  const { data } = useSettingsData()
  const { storefront, lifestyle, landmark } = useBrandImages()

  const years = data?.statYears || "25+"
  const stores = data?.statStores || "85+"
  const customers = data?.statCustomers || "2,00,000+"
  const phone = data?.storePhone || "1800 123 7272"

  const stats = [
    { value: stores, label: "Stores Across Karnataka" },
    { value: customers, label: "Happy Customers" },
    { value: `${years} Years`, label: "Of Trust & Growth" },
    { value: "Karnataka's Leading", label: "Multi-Brand Retail Chain" },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex-grow">
        <div className="section-container space-y-8 py-4">
          <nav className="flex items-center gap-2 text-[12px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-700">About SARA</span>
          </nav>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <section
            className="grid items-center gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#E9F1FB] to-[#F7FBFF] px-6 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:px-10"
            aria-labelledby="about-hero-heading"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">About SARA</p>
              <h1
                id="about-hero-heading"
                className="mt-3 font-heading text-[30px] font-extrabold leading-[1.1] text-[#0F2557] md:text-[42px]"
              >
                Your Trusted
                <br />
                Technology Partner
              </h1>
              <p className="mt-3 text-base font-semibold text-[#1560BD]">For a Brighter, Smarter Tomorrow</p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
                From a single store to one of Karnataka&apos;s leading multi-brand technology retailers, SARA has
                grown on one simple idea — everyone deserves honest advice, genuine products and service that
                stays with them long after the sale.
              </p>
              <Link
                href="#our-journey"
                className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#1560BD] px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Our Journey
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative hidden lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storefront} alt="A SARA store" className="aspect-[516/320] w-full rounded-xl object-cover" />
            </div>
          </section>

          {/* ── Stats ────────────────────────────────────────────── */}
          <section className="rounded-2xl bg-[#EAF2FC]" aria-label="SARA at a glance">
            <ul className="grid grid-cols-2 divide-y divide-white/70 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-white">
              {stats.map(({ value, label }) => (
                <li key={label} className="px-5 py-6 text-center">
                  <p className="font-heading text-xl font-extrabold text-[#0F2557] md:text-2xl">{value}</p>
                  <p className="mt-1 text-[12px] leading-tight text-slate-600">{label}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Our Story ────────────────────────────────────────── */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.6fr)]" aria-labelledby="our-story">
            <div>
              <h2 id="our-story" className="font-heading text-2xl font-bold text-[#0F2557]">
                Our Story
              </h2>
              <p className="mt-2 text-base font-semibold text-[#1560BD]">A Journey Built on Trust</p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                We started as a neighbourhood electronics store, where the person who sold you a television was
                the same person who came to install it. As we grew across Karnataka, we refused to give that up.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Today SARA is a multi-brand retail chain with delivery, installation and after-sales handled by
                our own teams — not a marketplace seller, not a contractor. That is the whole difference.
              </p>
              <Link
                href="#our-journey"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#1560BD] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Our Milestones
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative self-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lifestyle}
                alt="A family shopping for technology together"
                className="aspect-[364/249] w-full rounded-xl object-cover"
              />
            </div>

            <ul className="grid grid-cols-2 gap-5 self-center lg:grid-cols-1">
              {PROMISES.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold leading-tight text-[#0F2557]">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Our Values ───────────────────────────────────────── */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]" aria-labelledby="our-values">
            <div>
              <h2 id="our-values" className="font-heading text-2xl font-bold text-[#0F2557]">
                Our Values
              </h2>
              <p className="mt-2 text-base font-semibold text-[#1560BD]">What Drives Us</p>
              <Sparkles className="mt-4 h-8 w-8 text-[#1560BD]/40" strokeWidth={1.2} />
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {VALUES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-3.5 font-heading text-base font-bold text-[#0F2557]">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Journey ──────────────────────────────────────────── */}
          <section id="our-journey" className="scroll-mt-24" aria-labelledby="journey-heading">
            <h2 id="journey-heading" className="font-heading text-2xl font-bold text-[#0F2557]">
              Our Journey
            </h2>
            <p className="mt-2 text-base font-semibold text-[#1560BD]">Key Milestones Over the Years</p>

            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map(({ marker, label }, i) => (
                <li key={marker} className="relative rounded-xl border border-gray-200 bg-white p-5">
                  <span className="absolute -top-3 left-5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#1560BD] px-2 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="mt-1.5 font-heading text-[14px] font-bold text-[#0F2557]">{marker}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{label}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Statement band ───────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F2557] to-[#071634] px-6 py-10 sm:px-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={landmark}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-3/5 object-cover opacity-80 sm:block"
            />
            <div className="relative z-10 max-w-xl text-white">
              <h2 className="font-heading text-2xl font-bold leading-tight sm:text-[30px]">
                Building a Brighter Karnataka, Together.
              </h2>
              <p className="mt-3 text-sm text-white/80">
                More technology. More happiness. More possibilities.
              </p>
              <Link
                href="/store-locator"
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#0F2557]"
              >
                Visit a Store Near You
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* ── Trust strip ──────────────────────────────────────── */}
          <section aria-label="Why shop at SARA">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TRUST.map(({ icon: Icon, title, subtitle }) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight text-gray-900">{title}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{subtitle || phone}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
