"use client"

import { useState } from "react"
import Loader, { SkeletonCard, SkeletonList, SkeletonTable, PageLoader } from "@/components/Loader"

export default function LoadersDemo() {
  const [showPageLoader, setShowPageLoader] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {showPageLoader && <PageLoader text="Loading your experience..." />}

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Loader Components Demo
          </h1>
          <p className="text-gray-600" style={{ fontFamily: 'Roboto, sans-serif' }}>
            Professional loading indicators following Sara Mobiles and Electronics  brand guidelines
          </p>
        </div>

        {/* Main Loaders */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Main Loaders
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand Loader */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Brand Loader</h3>
              <Loader variant="brand" size="lg" text="Loading..." />
              <p className="text-sm text-gray-500 mt-4 text-center">
                Multi-ring with brand colors
              </p>
            </div>

            {/* Spinner */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Simple Spinner</h3>
              <Loader variant="spinner" size="lg" text="Please wait..." />
              <p className="text-sm text-gray-500 mt-4 text-center">
                Clean single-ring spinner
              </p>
            </div>

            {/* Dots */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Dots Loader</h3>
              <Loader variant="dots" size="lg" text="Loading data..." />
              <p className="text-sm text-gray-500 mt-4 text-center">
                Three bouncing dots
              </p>
            </div>

            {/* Pulse */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Pulse Loader</h3>
              <Loader variant="pulse" size="lg" text="Processing..." />
              <p className="text-sm text-gray-500 mt-4 text-center">
                Pulsing circle animation
              </p>
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Loader Sizes
          </h2>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <p className="text-sm font-medium mb-4">Small</p>
                <Loader variant="brand" size="sm" text="" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-4">Medium</p>
                <Loader variant="brand" size="md" text="" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-4">Large</p>
                <Loader variant="brand" size="lg" text="" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-4">Extra Large</p>
                <Loader variant="brand" size="xl" text="" />
              </div>
            </div>
          </div>
        </section>

        {/* Page Loader */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Page Loader
          </h2>

          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-6">
              Full-page loader with animated logo and progress bar
            </p>
            <button
              onClick={() => {
                setShowPageLoader(true)
                setTimeout(() => setShowPageLoader(false), 3000)
              }}
              className="px-6 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: '#2A7FFF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1E5FCC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2A7FFF'}
            >
              Show Page Loader (3s)
            </button>
          </div>
        </section>

        {/* Skeleton Loaders */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Skeleton Loaders
          </h2>

          {/* Skeleton Cards */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Skeleton Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Perfect for product grids, category cards, and content cards
            </p>
          </div>

          {/* Skeleton List */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Skeleton List</h3>
            <SkeletonList count={3} />
            <p className="text-sm text-gray-500 mt-4">
              Ideal for order lists, search results, and notifications
            </p>
          </div>

          {/* Skeleton Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Skeleton Table</h3>
            <SkeletonTable rows={5} cols={4} />
            <p className="text-sm text-gray-500 mt-4">
              Great for data tables, admin dashboards, and reports
            </p>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Usage Examples
          </h2>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Code Examples</h3>

            <div className="space-y-6">
              {/* Example 1 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Basic Usage:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  {`import Loader from '@/components/Loader'

<Loader variant="brand" size="md" text="Loading..." />`}
                </pre>
              </div>

              {/* Example 2 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Full-Screen Loader:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  {`<Loader 
  fullScreen 
  variant="brand" 
  text="Please wait..." 
/>`}
                </pre>
              </div>

              {/* Example 3 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Conditional Rendering:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  {`{loading ? (
  <Loader variant="brand" text="Loading products..." />
) : (
  <ProductList products={products} />
)}`}
                </pre>
              </div>

              {/* Example 4 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Skeleton Loaders:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  {`import { SkeletonCard } from '@/components/Loader'

{loading ? (
  <div className="grid grid-cols-3 gap-6">
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
) : (
  <ProductGrid />
)}`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Best Practices
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Do's */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-lg font-semibold mb-4 text-green-700">✅ Do's</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ Use skeleton loaders for better UX</li>
                <li>✓ Show loading text for operations &gt;2s</li>
                <li>✓ Match loader size to context</li>
                <li>✓ Use brand loader for standard operations</li>
                <li>✓ Handle loading states properly</li>
              </ul>
            </div>

            {/* Don'ts */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
              <h3 className="text-lg font-semibold mb-4 text-red-700">❌ Don'ts</h3>
              <ul className="space-y-2 text-gray-700">
                <li>✗ Don't use full-screen for small ops</li>
                <li>✗ Don't show loaders for &lt;300ms</li>
                <li>✗ Don't use multiple loaders together</li>
                <li>✗ Don't forget error states</li>
                <li>✗ Don't block UI unnecessarily</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Documentation Link */}
        <section className="text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">📖 Full Documentation</h3>
            <p className="text-gray-600 mb-4">
              For complete usage guide and implementation examples
            </p>
            <a
              href="/LOADER_USAGE_GUIDE.md"
              className="inline-block px-6 py-3 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: '#2A7FFF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1E5FCC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2A7FFF'}
            >
              View Usage Guide
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
