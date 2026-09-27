export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 max-w-[1400px]">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-3 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-3 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
          {/* Gallery skeleton */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-4">
                <div className="hidden md:flex flex-col gap-2 w-16">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 w-14 bg-gray-100 rounded-md animate-pulse" />
                  ))}
                </div>
                <div className="flex-1 aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>

          {/* Info skeleton */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-14 bg-gray-100 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-2">
              <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-3 w-full bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Buy box skeleton */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-gray-100" />
              <div className="p-5 space-y-3">
                <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 w-full bg-gray-50 rounded-xl animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-11 w-full bg-gray-200 rounded-xl animate-pulse" />
                <div className="h-11 w-full bg-gray-200 rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-full bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
