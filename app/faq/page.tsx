"use client"

import { useEffect, useState } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Search, ChevronDown, ChevronUp, ShoppingCart, CreditCard, Truck, Package, RotateCcw, Shield, User, Headphones, MapPin, Gift, Monitor, Tag, MessageSquare } from "lucide-react"
import { FAQ_CATEGORIES as FAQ_CONTENT, type FaqItem } from "@/lib/faq-data"

interface FAQItem {
  q: string
  a: string
}

interface FAQCategory {
  id: string
  label: string
  icon: any
  color: string
  items: FAQItem[]
}

// Presentation only; the copy itself lives in lib/faq-data.ts so the FAQPage
// schema in the layout cannot drift from what is rendered here.
const CATEGORY_STYLE: Record<string, { icon: any; color: string }> = {
  ordering: { icon: ShoppingCart, color: "from-blue-500 to-blue-600" },
  payment: { icon: CreditCard, color: "from-emerald-500 to-emerald-600" },
  shipping: { icon: Truck, color: "from-amber-500 to-amber-600" },
  tracking: { icon: Package, color: "from-violet-500 to-violet-600" },
  returns: { icon: RotateCcw, color: "from-rose-500 to-rose-600" },
  warranty: { icon: Shield, color: "from-cyan-500 to-cyan-600" },
  account: { icon: User, color: "from-indigo-500 to-indigo-600" },
  products: { icon: Monitor, color: "from-pink-500 to-pink-600" },
  store: { icon: MapPin, color: "from-orange-500 to-orange-600" },
  support: { icon: Headphones, color: "from-teal-500 to-teal-600" },
  promotions: { icon: Gift, color: "from-yellow-500 to-yellow-600" },
  software: { icon: Tag, color: "from-slate-500 to-slate-600" },
  privacy: { icon: Shield, color: "from-red-500 to-red-600" },
}

const FAQ_CATEGORIES: FAQCategory[] = FAQ_CONTENT.map((category) => ({
  ...category,
  icon: CATEGORY_STYLE[category.id]?.icon ?? MessageSquare,
  color: CATEGORY_STYLE[category.id]?.color ?? "from-gray-500 to-gray-600",
}))

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("ordering")
  const [openItems, setOpenItems] = useState<Record<string, number | null>>({})
  const [searchQuery, setSearchQuery] = useState("")

  // Deep links such as /faq#warranty come from the footer's Customer Service column.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && FAQ_CATEGORIES.some((c) => c.id === id)) setActiveCategory(id)
  }, [])

  const toggleItem = (catId: string, idx: number) => {
    setOpenItems((prev) => ({
      ...prev,
      [catId]: prev[catId] === idx ? null : idx,
    }))
  }

  const filteredCategories = searchQuery.trim()
    ? FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0)
    : FAQ_CATEGORIES

  const activeCat = FAQ_CATEGORIES.find((c) => c.id === activeCategory)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-grow">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white tracking-wide">Help Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Frequently Asked <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Questions</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Find answers to everything — from orders and payments to returns, warranties, and account issues.
            </p>
            {/* Search */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for any question..."
                className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
              />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-12" viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none"><path d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z" fill="white" /></svg>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              {/* Sidebar Categories */}
              <div className="lg:w-64 flex-shrink-0">
                <div className="lg:sticky lg:top-24 space-y-2">
                  {FAQ_CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    const isActive = activeCategory === cat.id
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setActiveCategory(cat.id); setSearchQuery("") }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${cat.color} ${isActive ? "shadow-md" : "opacity-70"}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm">{cat.label}</span>
                        <span className="ml-auto text-xs text-gray-400">{cat.items.length}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* FAQ Items */}
              <div className="flex-1 min-w-0">
                {searchQuery.trim() ? (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">
                      {filteredCategories.reduce((sum, c) => sum + c.items.length, 0)} results for &ldquo;{searchQuery}&rdquo;
                    </h2>
                    {filteredCategories.map((cat) => (
                      <div key={cat.id} className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{cat.label}</h3>
                        <div className="space-y-3">
                          {cat.items.map((item, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-200 transition-colors">
                              <button onClick={() => toggleItem(cat.id, idx)} className="w-full flex items-center justify-between px-6 py-4 text-left">
                                <span className="font-medium text-gray-900 pr-4">{item.q}</span>
                                {openItems[cat.id] === idx ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                              </button>
                              {openItems[cat.id] === idx && (
                                <div className="px-6 pb-4 text-gray-600 leading-relaxed border-t border-gray-100 pt-3">{item.a}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredCategories.length === 0 && (
                      <div className="text-center py-16">
                        <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">No results found. Try a different search term.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  activeCat && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${activeCat.color} shadow-md`}>
                          <activeCat.icon className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{activeCat.label}</h2>
                        <span className="text-sm text-gray-400 ml-1">({activeCat.items.length} questions)</span>
                      </div>
                      <div className="space-y-3">
                        {activeCat.items.map((item, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-200 transition-colors group">
                            <button onClick={() => toggleItem(activeCat.id, idx)} className="w-full flex items-center justify-between px-6 py-5 text-left">
                              <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors pr-4">{item.q}</span>
                              {openItems[activeCat.id] === idx ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                            </button>
                            {openItems[activeCat.id] === idx && (
                              <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">{item.a}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}

                {/* Still need help */}
                <div className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center border border-blue-100">
                  <Headphones className="h-10 w-10 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Still have questions?</h3>
                  <p className="text-gray-600 mb-6">Our support team is here to help. Reach out and we&apos;ll get back to you within 24 hours.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <a href="/complaints" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl">
                      Submit a Complaint
                    </a>
                    <a href="/contact" className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors">
                      Contact Us
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
