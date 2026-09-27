"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { Loader2, Plus, Edit2, Trash2, Link as LinkIcon, Image as ImageIcon, Search } from "lucide-react"

export default function CampaignPagesAdmin() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [products, setProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const lock = useSubmitLock()
  
  // Form State
  const [id, setId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [banner, setBanner] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  useEffect(() => {
    fetchCampaigns()
    fetchProducts()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch("/api/admin/campaign-pages")
      const data = await res.json()
      if (data.success) setCampaigns(data.campaigns)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await apiFetch("/api/products") // Fetches products for the selector
      const data = await res.json()
      // Adjusting based on standard api/products response formats
      const list = Array.isArray(data) ? data : (data.products || data.items || [])
      setProducts(list)
    } catch (e) {
      console.error("Failed to fetch products", e)
    }
  }

  const openForm = (campaign?: any) => {
    if (campaign) {
      setId(campaign._id)
      setName(campaign.name)
      setSlug(campaign.slug)
      setBanner(campaign.banner || "")
      setIsActive(campaign.isActive ?? true)
      setSelectedProductIds(campaign.productIds || [])
    } else {
      setId(null)
      setName("")
      setSlug("")
      setBanner("")
      setIsActive(true)
      setSelectedProductIds([])
    }
    setProductSearch("")
    setIsModalOpen(true)
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (!id) {
      // auto slugify
      setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setBanner(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setSaving(true)
    
    const payload = { name, slug, banner, isActive, productIds: selectedProductIds }
    const url = id ? `/api/admin/campaign-pages/${id}` : "/api/admin/campaign-pages"
    const method = id ? "PUT" : "POST"

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      
      if (data.success) {
        setIsModalOpen(false)
        fetchCampaigns()
      } else {
        alert(data.error || "Failed to save")
      }
    } catch (err) {
      alert("Error saving campaign")
    } finally {
      lock.release()
      setSaving(false)
    }
  }

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Are you sure you want to delete this custom page?")) return
    try {
      await apiFetch(`/api/admin/campaign-pages/${deleteId}`, { method: "DELETE" })
      fetchCampaigns()
    } catch (e) {
      alert("Error deleting campaign")
    }
  }

  const filteredProducts = products.filter(p => 
    (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) || 
    (p.sku || "").toLowerCase().includes(productSearch.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Landing Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Build dynamic campaign pages with banners and curated products</p>
        </div>
        <button
          onClick={() => openForm()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border text-center py-16 rounded shadow-sm">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No Custom Pages</h3>
          <p className="text-gray-500 mt-1 mb-4">You haven't built any campaign landing pages yet.</p>
          <button onClick={() => openForm()} className="text-blue-600 font-medium hover:underline">
            Create your first page
          </button>
        </div>
      ) : (
        <div className="bg-white border rounded shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Campaign</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Slug / URL</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-center">Status</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-center">Products</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-gray-100 rounded border overflow-hidden flex items-center justify-center flex-shrink-0">
                        {c.banner ? (
                          <img src={c.banner} alt="Banner" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900 line-clamp-1">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <a href={`/campaign/${c.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm transition-colors">
                      <LinkIcon className="w-3.5 h-3.5" />
                      /campaign/{c.slug}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {c.isActive ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {c.productIds?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openForm(c)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c._id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{id ? "Edit Campaign" : "New Campaign"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;
</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Campaign Name</label>
                  <input required type="text" value={name} onChange={e => handleNameChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Diwali Super Sale" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">URL Slug</label>
                  <div className="flex items-center">
                    <span className="bg-gray-100 border border-r-0 rounded-l-lg px-3 py-2 text-sm text-gray-500">/campaign/</span>
                    <input required type="text" value={slug} onChange={e => setSlug(e.target.value)} className="flex-1 border rounded-r-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="diwali-sale" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hero Banner Image</label>
                <div className="border border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                  {banner ? (
                    <div className="relative w-full max-h-[160px] overflow-hidden rounded mb-3 bg-gray-100 flex items-center justify-center">
                      <img src={banner} alt="Preview" className="object-contain max-h-[160px]" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                      <button type="button" onClick={() => setBanner("")} className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-md shadow hover:bg-red-50 hover:text-red-500 text-gray-600 backdrop-blur-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                  <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors">
                    <span>Upload Banner Image</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">Recommended: 1920x400px (JPG/PNG). Image will be stored securely.</p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                  <span className="text-sm font-semibold text-gray-700">Campaign Active status (Visible to customers)</span>
                </label>
              </div>

              <div>
                <div className="flex sm:items-center justify-between mb-2 flex-col sm:flex-row gap-2">
                  <label className="text-sm font-semibold text-gray-700">Curated Products ({selectedProductIds.length} selected)</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-full sm:w-64" />
                  </div>
                </div>
                
                <div className="border rounded-lg bg-gray-50 h-[240px] overflow-y-auto p-2">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-500">No products found</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredProducts.map(p => {
                        const idStr = p._id || p.id
                        const isSelected = selectedProductIds.includes(idStr)
                        return (
                          <div 
                            key={idStr}
                            onClick={() => toggleProduct(idStr)}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-white hover:border-gray-200'}`}
                          >
                            <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded border-gray-300 text-blue-600 flex-shrink-0 cursor-pointer" />
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
                              )}
                              <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </form>
            
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? "Saving..." : id ? "Update Campaign" : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
