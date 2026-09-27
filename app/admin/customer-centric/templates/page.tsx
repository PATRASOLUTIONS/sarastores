"use client"

import { apiFetch } from "@/lib/api-client"
import { useEffect, useState } from "react"
import { FileText, Loader2, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type DbTemplate = {
  id?: string
  name: string
  subject: string
  html: string
  image?: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<DbTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    loadTemplates()
    setMounted(true)
  }, [])

  async function loadTemplates() {
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/email-templates")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setTemplates(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function deleteTemplate(id?: string) {
    if (!id) return
    if (!confirm("Delete this template?")) return
    try {
      const res = await apiFetch(`/api/admin/email-templates/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Template deleted")
      await loadTemplates()
    } catch (e) {
      console.error(e)
      toast.error("Delete failed")
    }
  }

  async function seedDefaults() {
    if (!confirm("Load default templates? This will replace existing templates.")) return
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/email-templates/seed", { method: "POST" })
      if (!res.ok) throw new Error("Seed failed")
      await loadTemplates()
      toast.success("Default templates loaded")
    } catch (e) {
      console.error(e)
      toast.error("Failed to load defaults")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/admin/customer-centric"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-600" />
                Email Templates
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage reusable email templates for your campaigns
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={seedDefaults}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Load Defaults
              </button>
              <Link
                href="/admin/customer-centric"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Create Campaign
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No templates yet</h3>
            <p className="text-sm text-gray-500 mb-4">Load default templates or create your first one</p>
            <button
              onClick={seedDefaults}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Load Default Templates
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
              >
                {/* Preview */}
                <div className="h-44 overflow-hidden bg-gray-50 relative border-b border-gray-100">
                  {mounted ? (
                    <div
                      className="transform scale-[0.35] origin-top-left w-[286%] h-[286%]"
                      dangerouslySetInnerHTML={{ __html: t.html }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="h-10 w-10 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {(t.subject || "").replace(/\{\{name\}\}/g, "Customer")}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <Link
                      href="/admin/customer-centric"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Use in Campaign
                    </Link>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
