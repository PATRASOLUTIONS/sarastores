import Link from "next/link"
import { safeJsonLd } from "@/lib/jsonld-safe"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Page Not Found",
            description: "The page you are looking for could not be found.",
            statusCode: 404,
          }),
        }}
      />
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-6">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link href="/">
          <button className="px-5 py-2.5 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary-hover transition-colors active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
            Go back home
          </button>
        </Link>
      </div>
    </div>
  )
}
