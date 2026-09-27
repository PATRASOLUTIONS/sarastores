import type { Metadata } from "next"
import Link from "next/link"
import { MapPin, Store as StoreIcon } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getStoreCities } from "@/lib/store-locations"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Sara Electronics Store Locator — Find an Electronics Store Near You",
  description:
    "Browse Sara Electronics stores by city. Get addresses, phone numbers, opening hours and directions for every showroom.",
  alternates: { canonical: "/stores" },
}

export default async function StoresIndexPage() {
  const cities = await getStoreCities()
  const totalStores = cities.reduce((sum, city) => sum + city.storeCount, 0)

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

      <main className="container mx-auto flex-grow px-4 py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-brand-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Stores</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Sara Electronics stores</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          {totalStores > 0
            ? `${totalStores} stores across ${cities.length} ${cities.length === 1 ? "city" : "cities"}. `
            : ""}
          Pick your city to see addresses, opening hours, phone numbers and directions.
        </p>

        {cities.length === 0 ? (
          <p className="mt-10 rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
            Store information is not available right now. Please try again shortly or use the{" "}
            <Link href="/store-locator" className="font-medium text-brand-primary hover:underline">
              store locator map
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <li key={city.citySlug}>
                <Link
                  href={`/stores/${city.citySlug}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-brand-primary" />
                    <span className="font-semibold text-gray-900">{city.city}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <StoreIcon className="h-4 w-4" />
                    {city.storeCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 text-sm text-gray-600">
          Prefer a map?{" "}
          <Link href="/store-locator" className="font-medium text-brand-primary hover:underline">
            Open the interactive store locator
          </Link>
          .
        </p>
      </main>

      <Footer />
    </div>
  )
}
