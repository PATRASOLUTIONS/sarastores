export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Bar Skeleton */}
      <div className="w-full h-14 bg-white shadow-sm">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <main className="flex-grow">
        {/* Hero Skeleton */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-10">
            <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-5 w-80 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden border">
                <div className="w-full h-64 bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer Skeleton */}
      <div className="w-full bg-white border-t">
        <div className="container mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
