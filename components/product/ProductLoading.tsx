import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function ProductLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="min-h-[1100px] flex-grow" aria-busy="true">
        <div className="section-container space-y-5 py-4">
          <p role="status" className="sr-only">Loading product details...</p>
          <div className="h-4 w-64 animate-pulse rounded bg-gray-100" aria-hidden="true" />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,.85fr)_minmax(0,.9fr)]" aria-hidden="true">
            <div className="flex gap-3">
              <div className="hidden h-[58px] w-[58px] flex-shrink-0 animate-pulse rounded bg-gray-100 sm:block" />
              <div className="aspect-square flex-1 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
            </div>
            <div className="space-y-5">
              <div className="h-7 w-3/4 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
              <div className="h-12 animate-pulse rounded bg-gray-100" />
              <div className="h-40 animate-pulse rounded bg-gray-50" />
            </div>
            <div className="h-[430px] animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
