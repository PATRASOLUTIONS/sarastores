import Link from "next/link"
import { safeJsonLd } from "@/lib/jsonld-safe"
import {
  Sparkles,
  CreditCard,
  Truck,
  ShieldCheck,
  Wrench,
  Repeat,
  Store,
  ArrowRight,
} from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import { COLLECTIONS, findMany } from "@/lib/db-service"
import { getPublicPageProducts } from "@/lib/public-page-data"
import { pageMetadata } from "@/lib/seo-page"
import { catalogCategoryListResponseSchema } from "@/lib/catalog-list-response"

/** Catalogue prices and stock move during a sale; five minutes is a fair trade. */
export const revalidate = 300

export const generateMetadata = pageMetadata({
  path: "/ganesh",
  title: (brand) => `Ganesh Chaturthi - Appliance & Electronics Picks | ${brand}`,
  description:
    "Explore Ganesh Chaturthi appliance and electronics picks. Browse current product prices, availability, payment options and delivery policies at SARA.",
})

/** Auspicious amounts people actually budget in shagun, not round marketing numbers. */
const SHAGUN_BANDS = [
  { label: "Under ₹2,100", min: 0, max: 2100, note: "Small gifting" },
  { label: "₹2,100 – ₹5,100", min: 2100, max: 5100, note: "Kitchen essentials" },
  { label: "₹5,100 – ₹11,000", min: 5100, max: 11000, note: "Everyday upgrades" },
  { label: "₹11,000 – ₹21,000", min: 11000, max: 21000, note: "Small appliances" },
  { label: "₹21,000 – ₹51,000", min: 21000, max: 51000, note: "Big appliances" },
  { label: "₹51,000 & above", min: 51000, max: 500000, note: "Premium picks" },
]

const FESTIVE_BENEFITS = [
  { icon: CreditCard, title: "Payment options", text: "Check eligible options before payment", href: "/emi" },
  { icon: Repeat, title: "Current offers", text: "See applicable terms and availability", href: "/offers" },
  { icon: Truck, title: "Delivery options", text: "Charges and service depend on your order", href: "/shipping-policy" },
  { icon: Wrench, title: "Installation", text: "Check product-specific arrangements", href: "/installation" },
  { icon: ShieldCheck, title: "Warranty information", text: "Review the cover for your chosen product", href: "/warranty" },
  { icon: Store, title: "Visit a store", text: "Check local stock with our team", href: "/store-locator" },
]

/** One source of truth: the accordion below and the FAQPage schema both read this. */
const FAQ = [
  {
    q: "Are Ganesh Chaturthi offers currently available?",
    a: "Festival promotions vary by campaign, product and date. Browse current catalogue prices and check the applicable offer terms before ordering.",
  },
  {
    q: "What are the Ganesh Chaturthi offers on appliances?",
    a: "Available promotions are shown with their applicable product and payment terms. Prices and stock can change; confirm the final order details before paying.",
  },
  {
    q: "Is buying appliances during Ganesh Chaturthi auspicious?",
    a: "Ganesh Chaturthi celebrates the remover of obstacles and the lord of new beginnings, so many families treat it as an auspicious time to bring home something new. Kitchen appliances, televisions and refrigerators are the most popular festival purchases.",
  },
  {
    q: "How do I check EMI eligibility?",
    a: "Payment options depend on the product, lender and your eligibility. Review the EMI information and any charges shown at checkout before selecting a payment option.",
  },
  {
    q: "Do you deliver and install during the festival period?",
    a: "Enter your pincode to check service for your area. Read the shipping and installation policies for charges, scheduling and product-specific arrangements; ask the store about collection availability.",
  },
]

async function getFestivalPicks() {
  // This loader applies the shared publicCatalogueFilter and normalizes legacy money/stock.
  const catalogue = (await getPublicPageProducts()).filter(product => product.price > 0 && product.stock > 0)
  const discounted = catalogue.filter(product => Number(product.mrp) >= product.price / 0.9)
    .sort((left, right) => (1 - right.price / Number(right.mrp)) - (1 - left.price / Number(left.mrp)))
  return (discounted.length >= 8 ? discounted : catalogue).slice(0, 12)
}

async function getCategories() {
  return catalogCategoryListResponseSchema.parse(await findMany(
    COLLECTIONS.CATEGORIES,
    { isEnabled: { $ne: false } },
    { projection: { name: 1, slug: 1, image: 1 }, limit: 10 },
  ))
}

export default async function GaneshPage() {
  const [picks, categories] = await Promise.all([getFestivalPicks(), getCategories()])

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      <Header />

      <main id="main-content" className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="themed-hero themed-glow relative overflow-hidden text-white">
          <div className="themed-toran" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 text-center md:py-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Browse current availability
            </p>
            <h1 className="mt-5 font-heading text-3xl font-extrabold leading-tight md:text-5xl lg:text-6xl">
              Ganesh Chaturthi Appliance &amp; Electronics Picks
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/90 md:text-lg">
              Welcome Bappa home with something new. Browse current televisions, refrigerators,
              washing machines, air conditioners and kitchen appliances. Check product prices,
              stock and applicable terms before ordering.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="#festival-picks"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-primary shadow-lg transition-transform hover:scale-[1.02]"
              >
                Shop festival offers
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/store-locator"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/70 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                <Store className="h-4 w-4" />
                Visit a store
              </Link>
            </div>
          </div>
        </section>

        {/* ── Benefits ─────────────────────────────────────────── */}
        <section className="border-b border-brand-border bg-brand-surface py-10">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {FESTIVE_BENEFITS.map(({ icon: Icon, title, text, href }) => (
                <Link key={title} href={href} className="rounded-xl bg-white p-4 shadow-sm">
                  <Icon className="h-6 w-6 text-brand-accent" aria-hidden="true" />
                  <p className="mt-3 text-sm font-bold text-brand-text-primary">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-text-secondary">{text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Shagun price bands ───────────────────────────────── */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
              Shop by budget
            </h2>
            <p className="mt-2 text-sm text-brand-text-secondary">
              Pick a shagun amount and see everything that fits it.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {SHAGUN_BANDS.map((band) => (
                <Link
                  key={band.label}
                  href={`/products?minPrice=${band.min}&maxPrice=${band.max}`}
                  className="group rounded-xl border border-brand-border bg-white p-4 text-center transition-all hover:border-brand-primary hover:shadow-md"
                >
                  <p className="text-sm font-bold text-brand-text-primary group-hover:text-brand-primary">
                    {band.label}
                  </p>
                  <p className="mt-1 text-xs text-brand-text-secondary">{band.note}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Categories ───────────────────────────────────────── */}
        {categories.length > 0 && (
          <section className="bg-brand-surface py-12">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
                Festival favourites by category
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug || category.id}`}
                    className="group flex flex-col items-center rounded-xl bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
                  >
                    {category.image ? (
                      // Category art is an arbitrary admin-supplied URL, so it cannot go
                      // through next/image — an un-allowlisted host throws and 500s the page.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={category.image}
                        alt={category.name}
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-brand-primary-light" />
                    )}
                    <p className="mt-3 text-sm font-semibold text-brand-text-primary group-hover:text-brand-primary">
                      {category.name}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Product picks ────────────────────────────────────── */}
        <section id="festival-picks" className="py-12">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
              Ganesh Chaturthi picks
            </h2>
            <p className="mt-2 text-sm text-brand-text-secondary">
              Browse current product prices and availability. Applicable payment terms are shown before payment.
            </p>
            {picks.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {picks.map((product) => (
                  <CategoryProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-brand-text-secondary">
                Festival deals are being finalised.{" "}
                <Link href="/products" className="font-semibold text-brand-primary underline">
                  Browse the full range
                </Link>
                .
              </p>
            )}
            <div className="mt-8 text-center">
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover"
              >
                See all offers
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Store CTA ────────────────────────────────────────── */}
        <section className="bg-brand-primary py-12 text-white">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <h2 className="text-2xl font-extrabold md:text-3xl">Prefer to see it in person?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
              Ganesh Chaturthi is a family occasion. Walk into your nearest store, see the product,
              talk to our team and check local product availability and collection arrangements.
            </p>
            <Link
              href="/stores"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-primary transition-transform hover:scale-[1.02]"
            >
              Find your nearest store
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-extrabold text-brand-text-primary md:text-3xl">
              Ganesh Chaturthi shopping — questions we get asked
            </h2>
            <div className="mt-6 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-brand-border bg-white p-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-brand-text-primary">
                    {item.q}
                    <span className="text-brand-accent transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Long-form SEO block ──────────────────────────────── */}
        <section className="border-t border-brand-border bg-brand-surface py-12">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-xl font-extrabold text-brand-text-primary md:text-2xl">
              Ganesh Chaturthi offers on electronics and home appliances
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-brand-text-secondary">
              <p>
                Ganesh Chaturthi marks the arrival of Ganpati — the remover of obstacles and the
                lord of new beginnings. It is one of the most auspicious moments in the Indian
                calendar to bring something new into the home, which is why appliance and
                electronics shopping peaks across the ten days from Chaturthi to Anant Chaturdashi.
              </p>
              <p>
                Browse our current catalogue of{" "}
                <Link href="/products" className="font-medium text-brand-primary underline">
                  televisions, refrigerators, washing machines, air conditioners and kitchen
                  appliances
                </Link>
                . Product pages show available pricing and specifications. Check the final order
                price and payment terms before committing. Enter your pincode to check service
                in your area, or contact a store about collection availability.
              </p>
              <h3 className="pt-2 text-base font-bold text-brand-text-primary">
                What to buy this Ganesh Chaturthi
              </h3>
              <p>
                Kitchen appliances lead the festival — modak and prasad preparation means mixer
                grinders, wet grinders, microwave ovens and induction cooktops are the most popular
                purchases. Families hosting visitors through the ten days upgrade televisions and
                refrigerators, while the tail of the monsoon makes it the right moment to buy a
                washing machine with a dryer function.
              </p>
              <h3 className="pt-2 text-base font-bold text-brand-text-primary">
                Festival payment options
              </h3>
              <p>
                Payment eligibility, charges and promotions depend on the product and provider. Review our{" "}
                <Link href="/emi" className="font-medium text-brand-primary underline">EMI information</Link>{" "}
                and the applicable checkout terms before paying. Current promotions are listed on the{" "}
                <Link href="/offers" className="font-medium text-brand-primary underline">offers page</Link>.
              </p>
              <h3 className="pt-2 text-base font-bold text-brand-text-primary">
                Buy online or in store
              </h3>
              <p>
                You can complete the whole purchase online, or reserve it and{" "}
                <Link href="/store-locator" className="font-medium text-brand-primary underline">
                  collect from your nearest store
                </Link>
                . Check our{" "}
                <Link href="/shipping-policy" className="font-medium text-brand-primary underline">shipping policy</Link>,{" "}
                <Link href="/installation" className="font-medium text-brand-primary underline">installation information</Link>{" "}
                and <Link href="/warranty" className="font-medium text-brand-primary underline">warranty information</Link>{" "}
                for applicable arrangements. Read our{" "}
                <Link href="/blog" className="font-medium text-brand-primary underline">
                  buying guides
                </Link>{" "}
                if you are still deciding, or{" "}
                <Link href="/contact" className="font-medium text-brand-primary underline">
                  talk to our team
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
