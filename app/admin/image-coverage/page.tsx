"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ImageOff, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { IMAGE_ROLE_LABELS, type ImageRole } from "@/lib/product-images"

interface AuditedProduct {
  id: string
  sku: string | null
  slug: string | null
  name: string
  category: string | null
  total: number
  missingRequired: ImageRole[]
  missingOptional: ImageRole[]
  score: number
  compliant: boolean
}

interface Report {
  summary: {
    products: number
    compliant: number
    averageScore: number
    missingByRole: Record<string, number>
    withNoImages: number
  }
  products: AuditedProduct[]
}

export default function ImageCoveragePage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/admin/image-coverage?limit=200")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setReport(data)
      })
      .catch(() => {
        /* surfaced by the empty state */
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Auditing product images…
      </p>
    )
  }

  if (!report) {
    return <p className="p-6 text-sm text-gray-600">Could not load the image coverage report.</p>
  }

  const { summary, products } = report
  const compliancePct = summary.products
    ? Math.round((summary.compliant / summary.products) * 100)
    : 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Image coverage</h1>
        <p className="mt-1 text-sm text-gray-600">
          Products measured against the image standard: primary, front, rear, side and lifestyle are
          required; dimensions, feature, video and 360° are optional.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{summary.products}</p>
          <p className="text-xs text-gray-600">Active products</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-green-600">{compliancePct}%</p>
          <p className="text-xs text-gray-600">Meet the standard</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold text-gray-900">{summary.averageScore}</p>
          <p className="text-xs text-gray-600">Average score / 100</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-2xl font-bold text-red-600">
            <ImageOff className="h-5 w-5" />
            {summary.withNoImages}
          </p>
          <p className="text-xs text-gray-600">With no usable image</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Products missing each role</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(summary.missingByRole).map(([role, count]) => (
            <li key={role} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-sm text-gray-700">
                {IMAGE_ROLE_LABELS[role as ImageRole] || role}
              </span>
              <span className="text-sm font-semibold text-gray-900">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <h2 className="flex items-center gap-2 border-b border-gray-200 p-4 font-semibold text-gray-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Worklist — lowest scoring first ({products.length})
        </h2>

        {products.length === 0 ? (
          <p className="p-4 text-sm text-gray-600">Every active product meets the standard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="p-4 font-medium">Product</th>
                  <th scope="col" className="p-4 font-medium">SKU</th>
                  <th scope="col" className="p-4 font-medium">Assets</th>
                  <th scope="col" className="p-4 font-medium">Missing</th>
                  <th scope="col" className="p-4 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="max-w-xs p-4">
                      <Link
                        href={`/product/${product.slug || product.id}`}
                        className="line-clamp-2 font-medium text-gray-900 hover:text-brand-primary hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.category && (
                        <span className="mt-0.5 block text-xs text-gray-500">{product.category}</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600">{product.sku || "—"}</td>
                    <td className="p-4 text-gray-600">{product.total}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {product.missingRequired.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                          >
                            {role}
                          </span>
                        ))}
                        {product.missingOptional.map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-semibold ${
                          product.score >= 80
                            ? "text-green-600"
                            : product.score >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {product.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
