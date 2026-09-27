"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Home, LifeBuoy, RotateCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled error:", error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-brand-surface px-4 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary-light">
          <AlertTriangle className="h-7 w-7 text-brand-primary" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-brand-text-primary md:text-3xl">
          Something went wrong at our end
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary md:text-base">
          This page didn&apos;t load properly. Nothing you did caused it, and your cart and account
          are untouched. Try again — if it keeps happening, our team can help.
        </p>

        {error.digest && (
          <p className="mt-4 text-xs text-brand-text-tertiary">
            Reference code <span className="font-mono">{error.digest}</span> — quote this if you
            contact us.
          </p>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={() => reset()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover sm:w-auto"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-border bg-white px-6 py-2.5 text-sm font-semibold text-brand-text-primary transition-colors hover:border-brand-border-hover sm:w-auto"
          >
            <Home className="h-4 w-4" />
            Go to homepage
          </Link>

          <Link
            href="/contact"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-border bg-white px-6 py-2.5 text-sm font-semibold text-brand-text-primary transition-colors hover:border-brand-border-hover sm:w-auto"
          >
            <LifeBuoy className="h-4 w-4" />
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
