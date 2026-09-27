import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, MapPin, Phone } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getStoreCities, getStoresByCity } from "@/lib/store-locations"

export const revalidate = 3600

export async function generateStaticParams() {
  const cities = await getStoreCities()
  return cities.map((city) => ({ city: city.citySlug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}): Promise<Metadata> {
  const { city: citySlug } = await params
  const stores = await getStoresByCity(citySlug)
  if (stores.length === 0) return { title: "Store not found" }

  const cityName = stores[0].city
  return {
    title: `Electronics Store in ${cityName} — ${stores.length} Sara Electronics Showrooms`,
    description: `Find Sara Electronics stores in ${cityName}. Addresses, phone numbers, opening hours and directions for all ${stores.length} showrooms. Mobiles, TVs, refrigerators, washing machines and more.`,
    alternates: { canonical: `/stores/${citySlug}` },
  }
}

export default async function CityStoresPage({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  const { city: citySlug } = await params
  const stores = await getStoresByCity(citySlug)

  if (stores.length === 0) notFound()

  const cityName = stores[0].city

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

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
          <span className="text-gray-900">{cityName}</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Electronics stores in {cityName}
        </h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          {stores.length} Sara Electronics {stores.length === 1 ? "showroom" : "showrooms"} in{" "}
          {cityName}. Shop mobiles, televisions, refrigerators, washing machines and home appliances
          with brand warranty, easy EMI and installation support.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {stores.map((store) => (
            <li
              key={store.id}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                <Link href={`/stores/${store.citySlug}/${store.slug}`} className="hover:text-brand-primary">
                  {store.name}
                </Link>
              </h2>

              {store.address && (
                <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                  <span>{store.address}</span>
                </p>
              )}

              <p className="mt-1.5 flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4 shrink-0 text-brand-primary" />
                {store.hours}
              </p>

              {store.phone && (
                <p className="mt-1.5 flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4 shrink-0 text-brand-primary" />
                  <a href={`tel:${store.phone}`} className="hover:text-brand-primary">
                    {store.phone}
                  </a>
                </p>
              )}

              <Link
                href={`/stores/${store.citySlug}/${store.slug}`}
                className="mt-4 inline-block text-sm font-semibold text-brand-primary hover:underline"
              >
                View store details →
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-12 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Shop online, pick up in {cityName}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Order on saraelectronics.com and collect from your nearest {cityName} store, or get free
            delivery and installation at home.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Shop products
            </Link>
            <Link
              href="/offers"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View offers
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
