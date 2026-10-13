export default function Loading() {
  return (
    <div role="status" aria-label="Loading product offers" className="min-h-screen bg-white">
      <div className="section-container py-4">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-100" />
        <div className="mb-4 h-[200px] animate-pulse rounded-lg bg-blue-100" />
        <div className="mb-4 h-11 animate-pulse rounded bg-gray-100" />
        <div className="lg:ml-[211px]">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[108px] animate-pulse rounded bg-blue-50" />)}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="aspect-[4/3] w-full animate-pulse bg-gray-100" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                  <div className="flex justify-between pt-2">
                    <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
