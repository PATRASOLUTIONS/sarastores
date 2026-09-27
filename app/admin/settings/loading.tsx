export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded mt-2 animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-gray-200 rounded-lg animate-pulse" />
              <div>
                <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-100 rounded mt-1 animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, j) => (
                <div key={j}>
                  <div className="h-4 w-24 bg-gray-100 rounded mb-2 animate-pulse" />
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
