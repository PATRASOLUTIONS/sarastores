import Link from "next/link"
import { Database, AlertCircle } from "lucide-react"

export default function MigratePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Legacy Database Migration</h1>
      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
        <div className="flex items-center mb-6 text-blue-600">
          <Database className="h-8 w-8 mr-3" />
          <h2 className="text-xl font-semibold">Migration unavailable</h2>
        </div>
        <div role="alert" className="flex gap-3 bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            The legacy localStorage importer never imported data. It is disabled rather than reporting a false
            success. No browser or database data has been changed. Use the supported product import tools instead.
          </p>
        </div>
        <Link href="/admin/products" className="text-blue-700 underline">Open product management</Link>
      </div>
    </div>
  )
}
