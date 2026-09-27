import type { Metadata } from "next"
import Link from "next/link"
import { CreditCard, RefreshCw, Percent, Tag, ShieldCheck, Truck } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BankOffersMarquee from "@/components/BankOffersMarquee"
import OfferShelf from "@/components/OfferShelf"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getOriginFromHeaders()
  return {
    title: "Offers & Savings | Sara Electronics",
    description:
      "No-cost EMI, bank card discounts and coupon offers on televisions, home appliances and mobiles at Sara Electronics.",
    alternates: { canonical: `${origin}/offers` },
  }
}

const SAVINGS = [
  {
    icon: CreditCard,
    title: "No-Cost EMI",
    body: "Split your purchase into equal monthly instalments with 0% interest on major credit and debit cards. Available on eligible products above ₹5,000.",
  },
  {
    icon: RefreshCw,
    title: "Free Installation & Demo",
    body: "Certified engineers install your television, refrigerator, washing machine or air conditioner and walk you through it, at no extra cost on eligible products.",
  },
  {
    icon: Percent,
    title: "Bank Card Discounts",
    body: "Instant discounts and cashback with partner bank cards. The applicable offer is shown at checkout before you pay.",
  },
  {
    icon: Tag,
    title: "Coupon Codes",
    body: "Apply a valid coupon in the cart to see the discount reflected in your order total straight away.",
  },
  {
    icon: ShieldCheck,
    title: "Authorised Warranty",
    body: "Every product carries full manufacturer warranty, with service handled through authorised service centres.",
  },
  {
    icon: Truck,
    title: "Free Delivery & Installation",
    body: "Free delivery above the order threshold shown at checkout, with installation by certified engineers where applicable.",
  },
]

export default function OffersPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen bg-gray-50">
        <section className="bg-gradient-to-br from-red-600 via-red-600 to-rose-700 text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Sara Electronics</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Offers &amp; Savings</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Every way to pay less at Sara — EMI, bank offers and coupons, explained in one place.
            </p>
            <Link
              href="/products"
              className="mt-7 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              Shop all products
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-4">
          <BankOffersMarquee />
        </section>

        <OfferShelf section="todays-deals" />
        <OfferShelf section="mega-sale" />
        <OfferShelf section="clearance" />
        <OfferShelf section="store-exclusive" />

        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAVINGS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border bg-white p-6 text-sm text-gray-600">
            <h2 className="text-base font-bold text-gray-900">Good to know</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Offers vary by product, brand and payment method, and can change without notice.</li>
              <li>The exact discount that applies to your order is always shown at checkout before payment.</li>
              <li>
                For help choosing an offer, <Link href="/contact" className="font-semibold text-red-600 hover:underline">contact our team</Link>{" "}
                or visit your nearest <Link href="/store-locator" className="font-semibold text-red-600 hover:underline">store</Link>.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
