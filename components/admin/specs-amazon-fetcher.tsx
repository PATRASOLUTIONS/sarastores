"use client"

import type React from "react"

import { useState } from "react"

export function SpecsAmazonFetcher() {
  const [sku, setSku] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!sku || !url) {
      setError("Please enter both SKU and URL.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/scrape-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, url }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch/insert")
      }
      setMessage("Fetched and saved successfully.")
      setSku("")
      setUrl("")
    } catch (err: any) {
      setError(err?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border p-4 bg-background text-foreground">
      <h3 className="text-lg font-semibold mb-3">Fetch Amazon Specifications</h3>
      <form onSubmit={onFetch} className="flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="text-sm font-medium">SKU Number</label>
          <input
            className="border rounded px-3 py-2"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Enter SKU (e.g., 68e3...)"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium">Amazon Product URL</label>
          <input
            className="border rounded px-3 py-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.in/..."
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Fetch & Save"}
          </button>
          {message && <span className="text-green-600 text-sm">{message}</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Note: This keeps your existing Excel export workflow intact. Use this form to directly save specs to the
          database for a single SKU.
        </p>
      </form>
    </div>
  )
}
