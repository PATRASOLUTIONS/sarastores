"use client"

import Link from "next/link"

export default function CatalogueListingError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[65vh] items-center justify-center bg-white px-6">
      <div role="alert" className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[#0f2557]">Products are temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">We could not load the current catalogue or offers. Please try again.</p>
        <div className="mt-6 flex items-center justify-center gap-5">
          <button type="button" onClick={reset} className="rounded-lg bg-[#1560bd] px-5 py-3 text-sm font-semibold text-white">Try again</button>
          <Link href="/" className="text-sm font-semibold text-[#1560bd] underline">Back to home</Link>
        </div>
      </div>
    </main>
  )
}
