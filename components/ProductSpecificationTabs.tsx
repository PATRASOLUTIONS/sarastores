"use client"

import React, { JSX, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import useSWR from "swr"
import ProductReviewsSection from "./ProductReviewsSection"

// Helper to recursively render JSON with syntax highlighting and collapsible sections
function JSONViewer({ data }: { data: any }): JSX.Element {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({})

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderValue = (value: any, depth: number = 0): JSX.Element => {
    const indent = depth * 16

    if (value === null) {
      return <span className="text-gray-500">null</span>
    }
    if (typeof value === "boolean") {
      return <span className="text-purple-600">{String(value)}</span>
    }
    if (typeof value === "number") {
      return <span className="text-green-600">{value}</span>
    }
    if (typeof value === "string") {
      return <span className="text-red-600">&quot;{value}&quot;</span>
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-600">[]</span>
      const key = `array-${depth}-${Math.random()}`
      const isExp = expanded[key]
      return (
        <div>
          <button
            onClick={() => toggleExpand(key)}
            className="text-blue-600 hover:underline cursor-pointer mr-2"
          >
            {isExp ? "▼" : "▶"}
          </button>
          <span className="text-gray-600">[</span>
          {isExp && (
            <div>
              {value.map((item, idx) => (
                <div key={idx} style={{ marginLeft: `${indent + 16}px` }}>
                  {renderValue(item, depth + 1)}
                  {idx < value.length - 1 && <span className="text-gray-600">,</span>}
                </div>
              ))}
              <div style={{ marginLeft: `${indent}px` }}>
                <span className="text-gray-600">]</span>
              </div>
            </div>
          )}
        </div>
      )
    }
    if (typeof value === "object") {
      const keys = Object.keys(value)
      if (keys.length === 0) return <span className="text-gray-600">{"{}"}</span>
      const key = `obj-${depth}-${Math.random()}`
      const isExp = expanded[key]
      return (
        <div>
          <button
            onClick={() => toggleExpand(key)}
            className="text-blue-600 hover:underline cursor-pointer mr-2"
          >
            {isExp ? "▼" : "▶"}
          </button>
          <span className="text-gray-600">{"{}"}</span>
          {isExp && (
            <div>
              {keys.map((k, idx) => (
                <div key={k} style={{ marginLeft: `${indent + 16}px` }}>
                  <span className="text-blue-700 font-semibold">&quot;{k}&quot;</span>
                  <span className="text-gray-600">: </span>
                  {renderValue(value[k], depth + 1)}
                  {idx < keys.length - 1 && <span className="text-gray-600">,</span>}
                </div>
              ))}
              <div style={{ marginLeft: `${indent}px` }}>
                <span className="text-gray-600">{"{}"}</span>
              </div>
            </div>
          )}
        </div>
      )
    }
    return <span className="text-gray-600">{String(value)}</span>
  }

  return (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap break-words">
      {renderValue(data)}
    </pre>
  )
}

interface ProductSpecificationTabsProps {
  technicalDetails?: Record<string, any> | null
  fromManufacturer?: string | null
  specificationImages?: string[] | null
  productDescription?: string
  sku?: string
  reviews?: any[] | null
  /** Identity the embedded reviews panel needs to render and post. */
  productId?: string
  productName?: string
  productImage?: string
  reviewAverage?: number
  reviewCount?: number
  overview?: string | null
  includedComponents?: string[] | null
  features?: string[] | null
  mrp?: number | null
}

function extractManufacturerImages(
  technicalDetails?: Record<string, any> | null,
  specificationImages?: string[] | null,
): { images: string[]; dataUrl: string | null } {
  // Priority 1: use provided specificationImages prop
  if (Array.isArray(specificationImages) && specificationImages.length > 0) {
    return { images: specificationImages, dataUrl: null }
  }

  const td = technicalDetails || {}
  const candidateKeys = [
    "manufacturer_image_urls",
    "from_manufacturer_image_urls",
    "image_urls",
    "images",
    "manufacturer_images",
    "URL",
    "Url",
    "url",
  ]

  // Arrays directly in technical_details
  for (const key of candidateKeys) {
    const v = (td as any)[key]
    if (Array.isArray(v) && v.length > 0) {
      const urls = v.filter((u: any) => typeof u === "string" && u.startsWith("http"))
      if (urls.length > 0) return { images: urls, dataUrl: null }
    }
  }

  // Strings in technical_details: use regex to pull urls from any string field that contains http
  for (const key of candidateKeys) {
    const v = (td as any)[key]
    if (typeof v === "string" && v.includes("http")) {
      const urls = (v.match(/https?:\/\/[^\s",]+/g) || []).filter((s) => s.startsWith("http"))
      if (urls.length > 0) return { images: urls, dataUrl: null }
    }
  }

  // Single URL in technical_details that should be fetched (expects JSON of image URLs)
  const singleUrlKeys = [
    "manufacturer_images_url",
    "from_manufacturer_images_url",
    "spec_images_url",
    "images_url",
    "manufacturer_images_json",
  ]
  for (const key of singleUrlKeys) {
    const v = (td as any)[key]
    if (typeof v === "string" && v.startsWith("http")) {
      return { images: [], dataUrl: v }
    }
  }

  return { images: [], dataUrl: null }
}

function normalizeFetchedImages(data: unknown): string[] {
  if (!data) return []
  // If it's already an array of URLs
  if (Array.isArray(data)) {
    return data.filter((u) => typeof u === "string" && u.startsWith("http"))
  }
  // If it's an object like { images: [...] }
  if (typeof data === "object" && data !== null && "images" in (data as any)) {
    const arr = (data as any).images
    if (Array.isArray(arr)) {
      return arr.filter((u: any) => typeof u === "string" && u.startsWith("http"))
    }
  }
  // If it's a CSV string of URLs
  if (typeof data === "string") {
    if (data.includes(",")) {
      return data
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http"))
    }
    // If it's a single URL string, treat as one image
    if (data.startsWith("http")) return [data]
  }
  return []
}

// Helper to extract image URLs from a returned technical_details object (e.g., in product_specifications)
function extractUrlsFromTechnicalDetailsObj(technicalDetails?: Record<string, any> | null): string[] {
  if (!technicalDetails) return []
  const keys = ["URL", "Url", "url", "From Manufacturer URL", "Manufacturer URL"]
  for (const key of keys) {
    const v = (technicalDetails as any)[key]
    if (Array.isArray(v)) {
      const urls = v.filter((u: any) => typeof u === "string" && u.startsWith("http"))
      if (urls.length) return urls
    }
    if (typeof v === "string" && v.includes("http")) {
      const urls = (v.match(/https?:\/\/[^\s",]+/g) || []).filter((s) => s.startsWith("http"))
      if (urls.length) return urls
    }
  }
  // Fallback: scan all string values for http(s) URLs
  for (const [, value] of Object.entries(technicalDetails)) {
    if (typeof value === "string" && value.includes("http")) {
      const urls = (value.match(/https?:\/\/[^\s",]+/g) || []).filter((s) => s.startsWith("http"))
      if (urls.length) return urls
    }
  }
  return []
}

export default function ProductSpecificationTabs({
  technicalDetails,
  fromManufacturer,
  specificationImages,
  productDescription,
  sku,
  reviews,
  productId,
  productName,
  productImage,
  reviewAverage,
  reviewCount,
  overview,
  includedComponents,
  features,
  mrp,
}: ProductSpecificationTabsProps) {
  const { isAdmin } = useAuth()

  // Build tabs array conditionally - only show Reviews if reviews exist
  const baseTabs = [
    { id: "manufacturer", label: "FROM THE MANUFACTURER" },
    { id: "overview", label: "OVERVIEW" },
    { id: "specs", label: "DETAILS & SPECS" },
    { id: "included", label: "WHAT'S INCLUDED" },
  ]

  // Only add Reviews tab if reviews data exists
  let tabs = reviews && reviews.length > 0
    ? [...baseTabs, { id: "reviews", label: "REVIEWS" }]
    : baseTabs

  // Add admin-only tab if user is admin
  if (isAdmin) {
    tabs = [...tabs, { id: "admin", label: "ADMIN: API DATA" }]
  }

  const [activeTab, setActiveTab] = useState(tabs[0].id)

  const { images: extractedImages, dataUrl } = extractManufacturerImages(technicalDetails, specificationImages)

  const shouldFetch = !extractedImages.length && !!dataUrl
  const fetcher = (url: string) =>
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const text = await res.text()
        try {
          return JSON.parse(text)
        } catch {
          return text
        }
      })
      .catch(() => null)

  const { data: fetched, error: fetchError, isLoading: isFetching } = useSWR(shouldFetch ? dataUrl : null, fetcher)

  // If no images from props/technical_details, fetch product_specifications by SKU and extract technical_details.URL
  const shouldFetchBySku = !extractedImages.length && !dataUrl && !!sku
  const {
    data: fetchedBySku,
    error: skuFetchError,
    isLoading: isSkuFetching,
  } = useSWR(shouldFetchBySku ? `/api/products/specifications/${encodeURIComponent(sku!)}` : null, (url: string) =>
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null),
  )

  // Always fetch full SKU data for admins to view in admin tab
  const {
    data: adminFetchedBySku,
    error: adminSkuFetchError,
    isLoading: adminIsSkuFetching,
  } = useSWR(isAdmin && sku ? `/api/products/specifications/${encodeURIComponent(sku)}` : null, (url: string) =>
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null),
  )

  // Fetch COMPLETE JSON response from product_specifications collection for admins
  const {
    data: completeJsonResponse,
    error: completeJsonError,
    isLoading: completeJsonLoading,
  } = useSWR(isAdmin && sku ? `/api/products/specifications/${encodeURIComponent(sku)}/complete` : null, (url: string) =>
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null),
  )

  // Use adminFetchedBySku for display if available, otherwise use fetchedBySku
  const displayFetchedBySku = adminFetchedBySku || fetchedBySku

  // Prefer extracted images; if none, use dataUrl fetch; if still none, try SKU fetch technical_details.URL
  let manufacturerImages = extractedImages.length > 0 ? extractedImages : normalizeFetchedImages(fetched)

  if ((!manufacturerImages || manufacturerImages.length === 0) && fetchedBySku) {
    const td =
      (fetchedBySku as any)?.technical_details ||
      (fetchedBySku as any)?.data?.technical_details ||
      (Array.isArray(fetchedBySku) ? (fetchedBySku as any)[0]?.technical_details : undefined)
    const urlsFromTd = extractUrlsFromTechnicalDetailsObj(td)
    if (urlsFromTd.length > 0) {
      manufacturerImages = urlsFromTd
    } else {
      // Also normalize common shapes like { images: [...] }
      const maybeImages =
        (fetchedBySku as any)?.images ||
        (fetchedBySku as any)?.data?.images ||
        (Array.isArray(fetchedBySku) ? (fetchedBySku as any)[0]?.images : undefined)
      const normalized = normalizeFetchedImages(maybeImages)
      if (normalized.length > 0) {
        manufacturerImages = normalized
      }
    }
  }

  // Show loading/error if either fetch is pending/errored
  const anyLoading = (isFetching && !manufacturerImages?.length) || (isSkuFetching && !manufacturerImages?.length)
  const anyError = fetchError || skuFetchError

  // Prepare admin-only rows (ASIN from technical details and SKU prop)
  const adminRows: Array<[string, any]> = []
  if (isAdmin) {
    if (sku) adminRows.push(["SKU", sku])
    if (technicalDetails) {
      const asinKey = Object.keys(technicalDetails).find((k) =>
        k.replace(/[\s_]/g, "").toLowerCase() === "asin",
      )
      const asinValue = asinKey ? (technicalDetails as any)[asinKey] : undefined
      if (asinValue) adminRows.push(["ASIN", asinValue])
    }
  }

  const specEntries: Array<[string, any]> = technicalDetails
    ? [
      ...adminRows,
      ...Object.entries(technicalDetails).filter(([key]) => {
        const normalized = key.replace(/[\s_]/g, "").toLowerCase();
        return (
          normalized !== "url" &&
          normalized !== "source" &&
          normalized !== "sourceurl" &&
          normalized !== "asin" &&
          normalized !== "Customer Reviews" &&
          normalized !== "customerreviews" &&
          normalized !== "Best Sellers Rank" &&
          normalized !== "bestsellersrank" &&
          normalized !== "Date First Available" &&
          normalized !== "datefirstavailable" &&
          normalized !== "Included Components" &&
          normalized !== "includedcomponents" &&
          normalized !== "Special Feature" &&
          normalized !== "Special Features"
        );
      }),
    ]
    : []

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
      {/* Tab Headers */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 border-b overflow-x-auto snap-x">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-3 md:px-6 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap transition-colors snap-start ${activeTab === tab.id
              ? "bg-brand-primary text-white border-b-2 border-brand-primary"
              : "bg-white text-gray-700 hover:bg-brand-primary-subtle hover:text-brand-primary"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* FROM THE MANUFACTURER */}
        {activeTab === "manufacturer" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">From the Manufacturer</h2>
            {manufacturerImages && manufacturerImages.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {manufacturerImages.map((image, idx) => (
                  <img
                    key={idx}
                    src={
                      image || "/placeholder.svg?height=400&width=600&query=product%20specification%20image"
                    }
                    alt={`Product specification ${idx + 1}`}
                    className="w-full h-auto rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 text-center text-gray-400">
                <p>No specification images available.</p>
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Product Overview</h2>

            {/* MRP Display */}
            {/* {mrp && mrp > 0 && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4 inline-block">
                <span className="text-sm text-gray-500">MRP: </span>
                <span className="text-2xl font-bold text-gray-800">₹{mrp.toLocaleString("en-IN")}</span>
              </div>
            )} */}

            {/* Features List */}
            {features && features.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Key Features</h3>
                <ul className="space-y-2">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-2 h-2 mt-2 bg-red-500 rounded-full shrink-0"></span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overview/Description Text - Only show if features are not present */}
            {(!features || features.length === 0) && (overview || productDescription) ? (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{
                  (() => {
                    const text = overview || productDescription || "";
                    const idx = text.indexOf(": Amazon.in:");
                    return idx !== -1 ? text.slice(0, idx) : text;
                  })()
                }</p>
              </div>
            ) : !features?.length && (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">No overview information available for this product.</p>
              </div>
            )}
          </div>
        )}

        {/* DETAILS & SPECS */}
        {activeTab === "specs" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Technical Specifications</h2>
            {technicalDetails && Object.keys(technicalDetails).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
                  <tbody className="bg-white divide-y divide-gray-200">
                    {specEntries.map(([key, value], idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="px-3 py-3 md:px-6 md:py-4 text-xs md:text-sm font-semibold text-gray-900 w-1/3 align-top">
                          {String(key).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </td>
                        <td className="px-3 py-3 md:px-6 md:py-4 text-xs md:text-sm text-gray-700 align-top break-words">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">No technical specifications available for this product.</p>
              </div>
            )}
          </div>
        )}

        {/* WHAT'S INCLUDED */}
        {activeTab === "included" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">What's Included</h2>
            {/* Priority 1: Use includedComponents prop */}
            {includedComponents && includedComponents.length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-6">
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {includedComponents.map((item: string, idx: number) => (
                    <li key={idx} className="text-lg">
                      {item.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            ) : /* Priority 2: Fall back to Included Components in technicalDetails */
              technicalDetails?.["Included Components"] ? (
                <div className="bg-gray-50 rounded-lg p-6">
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {String(technicalDetails["Included Components"])
                      .split(",")
                      .map((item: string, idx: number) => (
                        <li key={idx} className="text-lg">
                          {item.trim()}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-500">No information available about what's included with this product.</p>
                </div>
              )}
          </div>
        )}

        {/* REVIEWS */}
        {activeTab === "reviews" && (
          <div className="bg-white rounded-lg p-6">
            <ProductReviewsSection
              embedded
              productId={productId ?? ""}
              productName={productName ?? ""}
              productImage={productImage ?? ""}
              seedReviews={reviews}
              average={reviewAverage}
              count={reviewCount}
            />
          </div>
        )}

        {/* ADMIN: COMPLETE API DATA */}
        {activeTab === "admin" && isAdmin && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Product Specifications (Complete API Response)</h2>
            {adminIsSkuFetching ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500 animate-pulse">Loading product specifications...</p>
              </div>
            ) : adminSkuFetchError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-red-700 font-semibold">Error loading product specifications</p>
                <p className="text-red-600 text-sm mt-2">{String(adminSkuFetchError)}</p>
              </div>
            ) : displayFetchedBySku ? (
              <div className="space-y-6">
                {/* Source URL Highlight */}
                {(displayFetchedBySku as any).source_url && (
                  <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4">
                    <p className="text-sm font-bold text-red-700 mb-2">PRODUCT SOURCE URL</p>
                    <a
                      href={(displayFetchedBySku as any).source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-800 hover:underline break-all text-base font-semibold"
                    >
                      {(displayFetchedBySku as any).source_url}
                    </a>
                  </div>
                )}

                {/* Source Information */}
                {((displayFetchedBySku as any).source || (displayFetchedBySku as any).source_url) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 text-orange-900">Source Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(displayFetchedBySku as any).source && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            navigator.clipboard.writeText((displayFetchedBySku as any).source)
                            alert("Source copied to clipboard!")
                          }}
                          className="rounded-lg border-2 border-orange-300 overflow-hidden hover:shadow-lg hover:border-orange-500 transition-all bg-white p-4 cursor-pointer group"
                        >
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              <p className="text-xs font-bold text-orange-600 mb-2 uppercase tracking-wider">Source</p>
                              <p className="text-sm text-orange-900 font-medium break-words group-hover:text-orange-700">{(displayFetchedBySku as any).source}</p>
                            </div>
                            <div className="mt-3 text-xs text-orange-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 16.5a2 2 0 11-4 0 2 2 0 014 0zM15 16.5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                <path d="M1.38 8.28a.75.75 0 00-.04 1.06l2.1 2.1a.75.75 0 001.04-.02l7.93-7.48a.75.75 0 10-1.06-1.06L3.42 8.3a.75.75 0 00-.04 1.06z"></path>
                              </svg>
                              Click to copy
                            </div>
                          </div>
                        </a>
                      )}
                      {(displayFetchedBySku as any).source_url && (
                        <a
                          href={(displayFetchedBySku as any).source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault()
                            navigator.clipboard.writeText((displayFetchedBySku as any).source_url)
                            alert("Source URL copied to clipboard!")
                            window.open((displayFetchedBySku as any).source_url, '_blank')
                          }}
                          className="rounded-lg border-2 border-orange-300 overflow-hidden hover:shadow-lg hover:border-orange-500 transition-all bg-white p-4 cursor-pointer group"
                        >
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              <p className="text-xs font-bold text-orange-600 mb-2 uppercase tracking-wider">Source URL</p>
                              <p className="text-sm text-orange-600 font-medium break-words group-hover:text-orange-800 line-clamp-2">{(displayFetchedBySku as any).source_url}</p>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-xs text-orange-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8 16.5a2 2 0 11-4 0 2 2 0 014 0zM15 16.5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                  <path d="M1.38 8.28a.75.75 0 00-.04 1.06l2.1 2.1a.75.75 0 001.04-.02l7.93-7.48a.75.75 0 10-1.06-1.06L3.42 8.3a.75.75 0 00-.04 1.06z"></path>
                                </svg>
                                Copy
                              </span>
                              <span className="text-xs text-orange-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open
                              </span>
                            </div>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4 text-blue-900">Basic Information</h3>
                  <div className="space-y-3">
                    {(displayFetchedBySku as any)._id && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-blue-700 w-32">Database ID:</span>
                        <span className="text-blue-900">{JSON.stringify((displayFetchedBySku as any)._id)}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).sku && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-blue-700 w-32">SKU:</span>
                        <span className="text-blue-900">{(displayFetchedBySku as any).sku}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).asin && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-blue-700 w-32">ASIN:</span>
                        <span className="text-blue-900">{(displayFetchedBySku as any).asin}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).product_id && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-blue-700 w-32">Product ID:</span>
                        <span className="text-blue-900">{JSON.stringify((displayFetchedBySku as any).product_id)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Details */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4 text-indigo-900">Product Details</h3>
                  <div className="space-y-3">
                    {(displayFetchedBySku as any).name && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Name:</span>
                        <span className="text-indigo-900">{(displayFetchedBySku as any).name}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).description && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Description:</span>
                        <span className="text-indigo-900">{(displayFetchedBySku as any).description}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).price && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Price:</span>
                        <span className="text-indigo-900">₹{(displayFetchedBySku as any).price}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).printedprice && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Printed Price:</span>
                        <span className="text-indigo-900">{(displayFetchedBySku as any).printedprice}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).mrp && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">MRP:</span>
                        <span className="text-indigo-900">₹{(displayFetchedBySku as any).mrp}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).printedmrp && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Printed MRP:</span>
                        <span className="text-indigo-900">{(displayFetchedBySku as any).printedmrp}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).source && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Source:</span>
                        <span className="text-indigo-900">{(displayFetchedBySku as any).source}</span>
                      </div>
                    )}
                    {(displayFetchedBySku as any).source_url && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Source URL:</span>
                        <a href={(displayFetchedBySku as any).source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                          {(displayFetchedBySku as any).source_url}
                        </a>
                      </div>
                    )}
                    {(displayFetchedBySku as any).updatedAt && (
                      <div className="flex gap-4">
                        <span className="font-semibold text-indigo-700 w-32">Updated At:</span>
                        <span className="text-indigo-900">{new Date((displayFetchedBySku as any).updatedAt?.$date || (displayFetchedBySku as any).updatedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bullet Points */}
                {(displayFetchedBySku as any).bullet_points && Array.isArray((displayFetchedBySku as any).bullet_points) && (displayFetchedBySku as any).bullet_points.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-3 text-green-900">Bullet Points ({(displayFetchedBySku as any).bullet_points.length})</h3>
                    <ul className="space-y-2">
                      {(displayFetchedBySku as any).bullet_points.map((point: string, idx: number) => (
                        <li key={idx} className="text-sm text-green-900 flex gap-3">
                          <span className="font-bold text-green-700 flex-shrink-0">{idx + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technical Details */}
                {(displayFetchedBySku as any).technical_details && typeof (displayFetchedBySku as any).technical_details === "object" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 text-slate-900">Technical Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries((displayFetchedBySku as any).technical_details).map(([key, value]: [string, any], idx: number) => (
                        <div key={idx} className="border-l-4 border-slate-400 pl-3 py-2">
                          <p className="text-xs font-semibold text-slate-700 uppercase">{key}</p>
                          <p className="text-sm text-slate-900 mt-1">
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specification Images */}
                {(displayFetchedBySku as any).specification_images && Array.isArray((displayFetchedBySku as any).specification_images) && (displayFetchedBySku as any).specification_images.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 text-purple-900">Specification Images ({(displayFetchedBySku as any).specification_images.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(displayFetchedBySku as any).specification_images.map((img: string, idx: number) => (
                        <a
                          key={idx}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-purple-200 overflow-hidden hover:shadow-lg transition-shadow"
                          title={`Image ${idx + 1}`}
                        >
                          <img
                            src={img}
                            alt={`Spec ${idx + 1}`}
                            className="w-full h-32 object-cover hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {(displayFetchedBySku as any).reviews && Array.isArray((displayFetchedBySku as any).reviews) && (displayFetchedBySku as any).reviews.filter((r: any) => {
                  let ratingNum = 5;
                  if (r.rating) {
                    const match = r.rating.toString().match(/(\d+\.?\d*)/);
                    if (match) ratingNum = parseFloat(match[1]);
                  }
                  return ratingNum > 2.0;
                }).length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                      <h3 className="text-lg font-bold mb-4 text-orange-900">Reviews ({(displayFetchedBySku as any).reviews.filter((r: any) => {
                        let ratingNum = 5;
                        if (r.rating) {
                          const match = r.rating.toString().match(/(\d+\.?\d*)/);
                          if (match) ratingNum = parseFloat(match[1]);
                        }
                        return ratingNum > 2.0;
                      }).length})</h3>
                      <div className="space-y-4">
                        {(displayFetchedBySku as any).reviews.filter((review: any) => {
                          let ratingNum = 5;
                          if (review.rating) {
                            const match = review.rating.toString().match(/(\d+\.?\d*)/);
                            if (match) ratingNum = parseFloat(match[1]);
                          }
                          return ratingNum > 2.0;
                        }).map((review: any, idx: number) => (
                          <div key={idx} className="bg-white rounded-lg p-4 border-l-4 border-orange-300">
                            <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                              <p className="font-semibold text-orange-900 flex-1">{review.title}</p>
                              <span className="text-xs text-orange-700 bg-orange-100 px-3 py-1 rounded-full">{review.rating}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-3">{review.content}</p>
                            <p className="text-xs text-gray-500 flex gap-2">
                              <span className="font-semibold">By:</span>
                              <span>{review.author || "Anonymous"}</span>
                              {review.date && (
                                <>
                                  <span>•</span>
                                  <span>{review.date}</span>
                                </>
                              )}
                            </p>
                            {review.images && Array.isArray(review.images) && review.images.length > 0 && (
                              <div className="mt-3 flex gap-2 overflow-x-auto">
                                {review.images.map((img: string, imgIdx: number) => (
                                  <a
                                    key={imgIdx}
                                    href={img}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                  >
                                    <img
                                      src={img}
                                      alt={`Review ${idx + 1} image ${imgIdx + 1}`}
                                      className="h-16 w-16 object-cover rounded border border-orange-200"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Additional Info */}
                {(displayFetchedBySku as any).additional_info && typeof (displayFetchedBySku as any).additional_info === "object" && Object.keys((displayFetchedBySku as any).additional_info).length > 0 && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 text-teal-900">Additional Information</h3>
                    <div className="space-y-3">
                      {Object.entries((displayFetchedBySku as any).additional_info).map(([key, value]: [string, any], idx: number) => (
                        <div key={idx} className="flex gap-4">
                          <span className="font-semibold text-teal-700 w-32">{key}:</span>
                          <span className="text-teal-900">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* From Manufacturer */}
                {(displayFetchedBySku as any).from_manufacturer && typeof (displayFetchedBySku as any).from_manufacturer === "string" && (displayFetchedBySku as any).from_manufacturer.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-3 text-yellow-900">From Manufacturer</h3>
                    <div className="text-sm text-yellow-900 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap break-words text-xs">{(displayFetchedBySku as any).from_manufacturer.substring(0, 500)}...</pre>
                    </div>
                  </div>
                )}

                {/* Complete JSON */}
                <div className="bg-gray-900 border-2 border-blue-500 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">Complete JSON Response from Collection</h3>
                      {completeJsonLoading && <p className="text-gray-400 text-xs mt-1">Loading complete data...</p>}
                      {completeJsonError && <p className="text-red-400 text-xs mt-1">Error loading data</p>}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(completeJsonResponse, null, 2))
                        alert("Complete JSON copied to clipboard!")
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-semibold"
                    >
                      Copy Full JSON
                    </button>
                  </div>
                  <div className="bg-gray-800 rounded p-4 border border-gray-700">
                    <textarea
                      readOnly
                      value={JSON.stringify(completeJsonResponse, null, 2)}
                      className="w-full h-96 bg-gray-950 text-gray-100 p-3 rounded font-mono text-xs border border-gray-600 resize-vertical"
                      spellCheck="false"
                    />
                  </div>
                  <p className="text-gray-400 text-xs mt-2">Total fields: {completeJsonResponse ? Object.keys(completeJsonResponse).length : 0}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">No product specifications data available for SKU: {sku}</p>
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  )
}
