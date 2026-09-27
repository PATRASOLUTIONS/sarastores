import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, Mail, MapPin, Phone } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import StoreActions from "./StoreActions"
import { buildStoreJsonLd, getAllStoreLocations, getStore } from "@/lib/store-locations"
import { safeJsonLd } from "@/lib/jsonld-safe"

export const revalidate = 3600

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

export async function generateStaticParams() {
  const stores = await getAllStoreLocations()
  return stores.map((store) => ({ city: store.citySlug, store: store.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; store: string }>
}): Promise<Metadata> {
  const { city, store: storeSlug } = await params
  const store = await getStore(city, storeSlug)
  if (!store) return { title: "Store not found" }

  return {
    title: `${store.name} — Sara Electronics ${store.city}`,
    description: `Visit ${store.name} in ${store.city}. ${store.address} Open ${store.hours}. Mobiles, TVs, refrigerators, washing machines and appliances with easy EMI.`,
    alternates: { canonical: `/stores/${store.citySlug}/${store.slug}` },
  }
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ city: string; store: string }>
}) {
  const { city, store: storeSlug } = await params
  const store = await getStore(city, storeSlug)

  if (!store) notFound()

  const jsonLd = buildStoreJsonLd(store, getOrigin())
  const directionsUrl =
    store.mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name} ${store.address}`)}`

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <main className="container mx-auto flex-grow px-4 py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-brand-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/stores" className="hover:text-brand-primary">
            Stores
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/stores/${store.citySlug}`} className="hover:text-brand-primary">
            {store.city}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{store.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{store.name}</h1>
            <p className="mt-1 text-gray-600">Sara Electronics · {store.city}</p>

            <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-6">
              {store.address && (
                <p className="flex items-start gap-3 text-gray-700">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                  <span>
                    {store.address}
                    {store.pincode && !store.address.includes(store.pincode) ? ` — ${store.pincode}` : ""}
                  </span>
                </p>
              )}

              <p className="flex items-center gap-3 text-gray-700">
                <Clock className="h-5 w-5 shrink-0 text-brand-primary" />
                {store.hours}
              </p>

              {store.phone && (
                <p className="flex items-center gap-3 text-gray-700">
                  <Phone className="h-5 w-5 shrink-0 text-brand-primary" />
                  <a href={`tel:${store.phone}`} className="hover:text-brand-primary">
                    {store.phone}
                  </a>
                </p>
              )}

              {store.email && (
                <p className="flex items-center gap-3 text-gray-700">
                  <Mail className="h-5 w-5 shrink-0 text-brand-primary" />
                  <a href={`mailto:${store.email}`} className="hover:text-brand-primary">
                    {store.email}
                  </a>
                </p>
              )}
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                What you can buy at {store.name}
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 sm:grid-cols-3">
                {[
                  "Mobiles & tablets",
                  "Televisions",
                  "Refrigerators",
                  "Washing machines",
                  "Air conditioners",
                  "Kitchen appliances",
                  "Laptops",
                  "Audio & soundbars",
                  "Small appliances",
                ].map((item) => (
                  <li key={item} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Services at this store</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>· Brand-authorised, 100% genuine products with manufacturer warranty</li>
                <li>· No-cost EMI and card/cardless finance options</li>
                <li>· Home delivery and installation across {store.city}</li>
                <li>· After-sales and service support</li>
              </ul>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 lg:sticky lg:top-24">
              <StoreActions
                storeId={store.id}
                storeName={store.name}
                city={store.city}
                phone={store.phone}
                directionsUrl={directionsUrl}
              />

              <Link
                href="/offers"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                View store offers
              </Link>

              <Link
                href="/products"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Shop online
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
