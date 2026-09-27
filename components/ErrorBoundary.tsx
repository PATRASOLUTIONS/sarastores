"use client"

import type React from "react"

import { useEffect, useState } from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function ErrorBoundary({
  children,
  fallback = <div className="p-4 bg-red-50 text-red-700 rounded-md">Something went wrong. Please try again later.</div>,
}: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error("Error caught by ErrorBoundary:", error)
      setHasError(true)
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [])

  if (hasError) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
