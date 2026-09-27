"use client"

import Link from "next/link"
import { Award, BadgeCheck, Building2, MapPin, ShieldCheck, Truck, Users, Wrench } from "lucide-react"

/**
 * Brand story, milestones and credentials for the About page.
 *
 * The BRD asks About Us to work as a conversion asset rather than a corporate
 * profile. Every claim below is one the storefront already makes publicly —
 * nothing new is asserted. `MILESTONES` is the hook for the business to add
 * dated history once those facts are confirmed.
 */

const MILESTONES = [
  {
    icon: Building2,
    value: "85+",
    label: "Retail stores",
    detail: "Showrooms across Karnataka, each stocked, staffed and serviced by our own teams.",
  },
  {
    icon: Users,
    value: "2M+",
    label: "Customers served",
    detail: "Households and businesses that have bought from Sara online or in store.",
  },
  {
    icon: MapPin,
    value: "90+",
    label: "Cities reached",
    detail: "Delivery and after-sales coverage well beyond our showroom footprint.",
  },
  {
    icon: Truck,
    value: "5000+",
    label: "Partner network",
    detail: "Distribution, logistics and service partners working alongside us.",
  },
]

const CREDENTIALS = [
  {
    icon: BadgeCheck,
    title: "Brand-authorised dealer",
    body: "We buy direct from manufacturers and their national distributors. Every unit we sell is sourced through the official channel.",
  },
  {
    icon: ShieldCheck,
    title: "Full manufacturer warranty",
    body: "Products carry the complete brand warranty, serviced through authorised service centres — not a store-level substitute.",
  },
  {
    icon: Wrench,
    title: "Certified installation & service",
    body: "Installation and after-sales support are handled by trained engineers, coordinated through the store nearest to you.",
  },
  {
    icon: Award,
    title: "GST-compliant invoicing",
    body: "Every order is invoiced with GST, so the purchase is valid for warranty claims, insurance and business accounting.",
  },
]

export default function CompanyStory() {
  return (
    <>
      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full bg-brand-primary-subtle px-4 py-2 text-sm font-semibold text-brand-primary">
              Our story
            </span>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Built on shop floors, not just servers
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Sara started as an electronics retailer and still runs like one. We stock what we sell,
              our staff demonstrate it, and our engineers install and service it. The website exists
              to make that easier to reach — not to replace it.
            </p>
            <p className="mt-4 text-gray-600">
              That is why you can check a pincode before you buy, collect from the store down the
              road instead of waiting for a courier, and call a person at that store if something
              goes wrong.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-5 lg:grid-cols-4">
            {MILESTONES.map(({ icon: Icon, value, label, detail }) => (
              <div key={label} className="rounded-2xl border border-gray-200 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary-subtle">
                  <Icon className="h-6 w-6 text-brand-primary" />
                </div>
                <p className="mt-4 text-2xl font-extrabold text-gray-900 md:text-3xl">{value}</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{label}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-primary ring-1 ring-gray-200">
              Credentials
            </span>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">
              What you are actually buying
            </h2>
            <p className="mt-4 text-gray-600">
              The things that separate an authorised retailer from a grey-market seller.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2">
            {CREDENTIALS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary-subtle">
                  <Icon className="h-5 w-5 text-brand-primary" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Find your nearest Sara store</h2>
              <p className="mt-2 text-gray-600">
                See the product in person, ask questions, and take it home the same day.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-3">
              <Link
                href="/stores"
                className="rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Browse stores
              </Link>
              <Link
                href="/store-locator"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Open the map
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
