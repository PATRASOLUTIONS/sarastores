"use client"

import Link from "next/link"
import Image from "next/image"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useSettingsData } from "@/hooks/useSettingsData"
import { CalendarClock, Download, Mail, MapPin, Phone, Store, Users } from "lucide-react"

const FACTS = [
  { icon: CalendarClock, value: "25+ years", label: "Serving customers since 2010" },
  { icon: Store, value: "85+ stores", label: "Across Karnataka" },
  { icon: Users, value: "2,00,000+", label: "Customers served" },
  { icon: MapPin, value: "Bengaluru", label: "Head office" },
]

const ASSETS = [
  { href: "/sara-logo.png", label: "Primary logo", note: "PNG, transparent background" },
  { href: "/icons/icon-512.png", label: "App icon", note: "PNG, 512×512" },
  { href: "/brand-guidelines", label: "Brand guidelines", note: "Colour, typography and usage rules" },
]

export default function PressPage() {
  const { data } = useSettingsData()
  const email = data?.storeEmail || "sales.systechdigital@gmail.com"
  const phone = data?.storePhone || "1800 123 7272"
  const companyName = data?.storeName || "SARA Mobiles & Electronics"
  const legalName = data?.legalName || companyName

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-grow">
        <section className="bg-gradient-to-br from-brand-hero-from via-brand-hero-via to-brand-hero-to text-white">
          <div className="section-container py-16 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Press &amp; Media</p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight md:text-5xl">
              Media enquiries &amp; brand assets
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300">
              Everything a journalist, analyst or partner needs to write about {companyName} — company
              facts, approved logos and a direct line to our team.
            </p>
          </div>
        </section>

        <section className="section-container py-14 md:py-16">
          <h2 className="heading-2">At a glance</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
                <Icon className="h-6 w-6 text-brand-accent" strokeWidth={1.5} />
                <p className="mt-4 font-heading text-xl font-bold text-brand-text-primary">{value}</p>
                <p className="mt-1 text-sm text-brand-text-secondary">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-brand-surface py-14 md:py-16">
          <div className="section-container grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="heading-2">Company boilerplate</h2>
              <p className="mt-4 text-sm leading-relaxed text-brand-text-secondary">
                {legalName} is a Karnataka-based electronics and home appliance retailer operating a
                network of neighbourhood stores alongside an online storefront at saraelectronics.in.
                The company sells mobiles, televisions, large and small appliances and computing
                products from leading brands, backed by in-house delivery, installation and after-sales
                service.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-brand-text-secondary">
                Use this paragraph verbatim in articles and listings. For interviews, product imagery or
                store visits, contact the team below.
              </p>
            </div>

            <div className="rounded-3xl border border-brand-border bg-white p-6 shadow-sm md:p-8">
              <h2 className="heading-3">Media contact</h2>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary-light text-brand-primary">
                    <Mail className="h-4 w-4" />
                  </span>
                  <a href={`mailto:${email}`} className="text-brand-text-primary hover:underline">
                    {email}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary-light text-brand-primary">
                    <Phone className="h-4 w-4" />
                  </span>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-brand-text-primary hover:underline">
                    {phone}
                  </a>
                </li>
              </ul>
              <Link
                href="/contact"
                className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
              >
                Send an enquiry
              </Link>
            </div>
          </div>
        </section>

        <section className="section-container py-14 md:py-16">
          <h2 className="heading-2">Brand assets</h2>
          <p className="mt-2 max-w-2xl text-brand-text-secondary">
            Please use the logo as supplied — do not recolour, stretch or add effects.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="flex items-center justify-center rounded-2xl border border-brand-border bg-white p-10 lg:col-span-1">
              <Image src="/sara-logo.png" alt="SARA logo" width={374} height={100} className="h-14 w-auto" />
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              {ASSETS.map(({ href, label, note }) => (
                <li key={href}>
                  <a
                    href={href}
                    download={href.endsWith(".png") ? "" : undefined}
                    className="flex h-full items-start gap-3 rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <Download className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-accent" />
                    <span>
                      <span className="block font-heading text-sm font-bold text-brand-text-primary">{label}</span>
                      <span className="mt-1 block text-xs text-brand-text-secondary">{note}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
