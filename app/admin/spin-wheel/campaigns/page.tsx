"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Plus,
  Trash2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Copy,
  Loader2,
  Trophy,
  Users,
  Ticket,
  BarChart3,
  ArrowLeft,
} from "lucide-react"
import toast from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

interface Campaign {
  id: string
  name: string
  slug: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  stats: {
    prizes: number
    participants: number
    totalCoupons: number
    usedCoupons: number
    unusedCoupons: number
  }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [cloneFrom, setCloneFrom] = useState("")

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch("/api/spin-wheel/admin/campaigns")
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (err) {
      toast.error("Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Enter a campaign name")
      return
    }
    setCreating(true)
    try {
      const res = await apiFetch("/api/spin-wheel/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          cloneFrom: cloneFrom || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const slug = data.campaign?.slug
        const url = slug ? `${window.location.origin}/spin/${slug}` : ""
        if (url) {
          navigator.clipboard.writeText(url)
          toast.success(
            <div>
              <p className="font-semibold">Campaign created!</p>
              <p className="text-xs mt-1 font-mono break-all">{url}</p>
              <p className="text-xs mt-1">URL copied to clipboard</p>
            </div>,
            { duration: 6000 }
          )
        } else {
          toast.success(data.message || "Campaign created!")
        }
        setShowCreateModal(false)
        setNewName("")
        setNewDesc("")
        setCloneFrom("")
        fetchCampaigns()
      } else {
        toast.error(data.error || "Failed to create campaign")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (slug: string, currentActive: boolean) => {
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/campaigns/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      if (res.ok) {
        toast.success(currentActive ? "Campaign deactivated" : "Campaign activated")
        fetchCampaigns()
      }
    } catch {
      toast.error("Failed to update campaign")
    }
  }

  const handleDelete = async (slug: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"? This will permanently delete all its prizes, participants, and coupons.`)) return
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/campaigns/${slug}`, { method: "DELETE" })
      if (res.ok) {
        toast.success(`Campaign "${name}" deleted`)
        fetchCampaigns()
      }
    } catch {
      toast.error("Failed to delete campaign")
    }
  }

  const copyUrl = (slug: string, store?: string) => {
    const base = `${window.location.origin}/spin/${slug}`
    const url = store ? `${base}?store=${encodeURIComponent(store)}` : base
    navigator.clipboard.writeText(url)
    toast.success("URL copied!")
  }

  const getOrigin = () => {
    if (typeof window !== "undefined") return window.location.origin
    return ""
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/spin-wheel" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Spin Wheel Campaigns</h1>
              <p className="text-gray-500 text-sm mt-1">Create and manage multiple spin wheel campaigns</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No campaigns yet</h3>
            <p className="text-gray-500 mb-6">Create your first spin wheel campaign to get started.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                      <p className="text-sm text-gray-500 font-mono">/spin/{c.slug}</p>
                    </div>
                    <button
                      onClick={() => handleToggleActive(c.slug, c.isActive)}
                      className={`p-1 rounded ${c.isActive ? "text-green-600" : "text-gray-400"}`}
                    >
                      {c.isActive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </div>

                  {c.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{c.description}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <Trophy className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{c.stats.prizes}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Prizes</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <Users className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{c.stats.participants}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Users</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <Ticket className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{c.stats.unusedCoupons}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Coupons</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t px-6 py-3 flex items-center gap-2">
                  <Link
                    href={`/admin/spin-wheel?campaign=${c.slug}`}
                    className="flex-1 text-center text-sm font-medium text-blue-600 hover:text-blue-800 py-1"
                  >
                    <BarChart3 className="h-4 w-4 inline mr-1" />
                    Manage
                  </Link>
                  <button
                    onClick={() => copyUrl(c.slug)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Copy public URL"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a
                    href={`/spin/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {c.slug !== "default" && (
                    <button
                      onClick={() => handleDelete(c.slug, c.name)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Delete campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">New Spin Wheel Campaign</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Diwali Sale 2026"
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Optional description"
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Clone From</label>
                    <select
                      value={cloneFrom}
                      onChange={(e) => setCloneFrom(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Default prizes (fresh start)</option>
                      {campaigns.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name} ({c.stats.unusedCoupons} coupons)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Copy prizes and unused coupon codes from an existing campaign
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewName("")
                    setNewDesc("")
                    setCloneFrom("")
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Campaign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
