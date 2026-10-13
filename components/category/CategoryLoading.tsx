import Header from "@/components/Header"
import Footer from "@/components/Footer"
import HeroSection from "@/components/HeroSection"

export default function CategoryLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-grow" aria-busy="true">
        <HeroSection />
        <div className="container mx-auto px-4 py-8" role="status" aria-label="Loading category products">
          <div className="flex gap-6" aria-hidden="true">
            <aside className="hidden h-[calc(100vh-6rem)] w-64 flex-shrink-0 animate-pulse rounded-lg bg-gray-100 lg:block" />
            <div className="min-w-0 flex-1">
              <div className="mb-6 h-10 animate-pulse rounded bg-gray-100 lg:hidden" />
              <div className="mb-6 h-16 animate-pulse rounded bg-gray-100" />
              <div className="mb-6 h-5 w-48 animate-pulse rounded bg-gray-100" />
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl border border-gray-100">
                    <div className="h-40 animate-pulse bg-gray-100 sm:h-44 md:h-52" />
                    <div className="space-y-3 p-4">
                      <div className="h-10 animate-pulse rounded bg-gray-100" />
                      <div className="h-6 w-24 animate-pulse rounded bg-gray-100" />
                      <div className="h-10 animate-pulse rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
