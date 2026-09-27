export default function Loading() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
      </div>

      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  )
}
