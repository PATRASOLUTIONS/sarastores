"use client"

import Link from "next/link"
import Image from "next/image"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useCart } from "@/hooks/useCart"
import { useCartUI } from "@/contexts/CartUIContext"
import { ShoppingCart, Menu, X, Search, User, Heart, MapPin, ChevronDown, TrendingUp, Clock, Package, Zap, Gift, Download, HelpCircle, Phone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useProductSpecImages } from '@/hooks/useProductSpecImages'
import { motion, AnimatePresence } from 'framer-motion'
import { cssEasings, durations, scaleFade } from '@/lib/animations'
import { useScrollState } from '@/hooks/useAnimations'
import DeliverToPincode from '@/components/DeliverToPincode'
import MegaMenu from '@/components/MegaMenu'
import { useSettingsData } from '@/hooks/useSettingsData'
import CategoryGlyph from '@/components/CategoryGlyph'

interface Category {
  id: string
  name: string
  icon?: string
  isEnabled?: boolean
}

// Curated trending searches shown when the search box is empty
const TRENDING_SEARCHES = [
  "iPhone",
  "Smart TV",
  "Washing Machine",
  "Air Conditioner",
  "Refrigerator",
  "Laptop",
  "Dishwasher",
]

const RECENT_SEARCHES_KEY = "recentSearches"

export default function Header() {
  const { cart } = useCart()
  const { openCart } = useCartUI()
  const { data: siteSettings } = useSettingsData()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const router = useRouter()
  const { user, logout, isAdmin, isVendor } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const { isScrolled, scrollY } = useScrollState(10)
  const [cartItemCount, setCartItemCount] = useState(0)
  const [cartBounce, setCartBounce] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string }>({ id: "", name: "All" })
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [trendingTerms, setTrendingTerms] = useState<string[]>(TRENDING_SEARCHES)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  // Load real trending terms from popular/featured products (falls back to curated list)
  useEffect(() => {
    let ignore = false
    const loadTrending = async () => {
      try {
        const fetchArr = async (url: string) => {
          const res = await fetch(url)
          if (!res.ok) return [] as any[]
          const data = await res.json()
          return Array.isArray(data) ? data : (data.products || [])
        }
        let arr = await fetchArr("/api/products?featured=true&limit=12")
        if (arr.length < 4) arr = await fetchArr("/api/products?limit=12")

        const terms: string[] = []
        const seen = new Set<string>()
        for (const p of arr) {
          const brand = (p?.brand || p?.manufacturer || "").toString().trim()
          const candidate = brand || (p?.name || "").toString().split(" ").slice(0, 2).join(" ").trim()
          const key = candidate.toLowerCase()
          if (candidate && !seen.has(key)) {
            seen.add(key)
            terms.push(candidate)
          }
          if (terms.length >= 7) break
        }
        if (!ignore && terms.length >= 4) setTrendingTerms(terms)
      } catch {
        // keep curated fallback
      }
    }
    loadTrending()
    return () => { ignore = true }
  }, [])

  // Reset keyboard highlight whenever the suggestion list changes
  useEffect(() => {
    setActiveIndex(-1)
  }, [searchSuggestions, searchQuery])

  const saveRecentSearch = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setRecentSearches((prev) => {
      const next = [t, ...prev.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 6)
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // ignore
    }
  }, [])

  const runSearch = useCallback((term: string) => {
    const t = term.trim()
    setSearchQuery(t)
    saveRecentSearch(t)
    const params = new URLSearchParams()
    if (t) params.set("search", t)
    if (selectedCategory.id) params.set("category", selectedCategory.id)
    const qs = params.toString()
    router.push(qs ? `/products?${qs}` : "/products")
    setShowSuggestions(false)
    setSearchSuggestions([])
  }, [router, saveRecentSearch, selectedCategory.id])

  // Close menus on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
        setIsAccountMenuOpen(false)
        setShowSuggestions(false)
        setIsCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Helper: robustly extract SKU from product object
  const extractSku = (p: any) => {
    return (
      p.sku || p.SKU || p.raw?.SKU || p.raw?.sku || p.raw?.['SKU'] || p.raw?.['Prod SKU'] || p.raw?.['PROD SKU'] || ''
    )
  }

  // Subcomponent for suggestion row — uses hook to prefer spec images by SKU
  function SuggestionRow({ product, isActive }: { product: any; isActive?: boolean }) {
    const sku = extractSku(product)
    const specImages = useProductSpecImages(sku)
    const imageSrc = (specImages && specImages.length > 0 && specImages[0]) || product.image || '/placeholder.png'

    return (
      <div
        key={product.id}
        id={`suggestion-${product.id}`}
        role="option"
        aria-selected={isActive ? 'true' : 'false'}
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-gray-100 last:border-b-0 group ${isActive ? 'bg-brand-primary-subtle' : 'hover:bg-blue-50'}`}
        onClick={() => {
          setShowSuggestions(false)
          router.push(`/product/${product.slug || product.id}`)
        }}
      >
        <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors">
          <img
            src={imageSrc}
            alt={product.name}
            className="w-10 h-10 object-contain"
            onError={(e) => {
              ; (e.target as HTMLImageElement).src = '/placeholder.png'
            }}
          />
        </div>
        <div className="flex-1">
          <span className={`text-sm font-medium transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-800 group-hover:text-blue-600'}`}>{product.name}</span>
        </div>
        <Search className={`h-4 w-4 transition-colors ${isActive ? 'text-brand-primary' : 'text-gray-400 group-hover:text-blue-500'}`} />
      </div>
    )
  }

  const cartItemsCount = cart?.reduce((total, item) => total + (item.quantity || 0), 0) || 0

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories")
        if (response.ok) {
          const data = await response.json()
          // Filter only enabled categories (isEnabled !== false)
          const enabledCategories = data.filter((cat: Category) => cat.isEnabled !== false)
          setCategories(enabledCategories)
        }
      } catch (error) {
        console.error("Error fetching categories:", error)
      }
    }
    fetchCategories()
  }, [])

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault()
    // Open the Amazon-style side cart so the user can review/quantities
    // and proceed to buy without losing their place on the page. A
    // separate "View full cart" link inside the sidebar takes them to
    // /cart for the full checkout experience.
    openCart()
  }

  const handleAccountClick = () => {
    if (user) {
      setIsAccountMenuOpen(!isAccountMenuOpen)
    } else {
      router.push("/login")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = searchQuery.trim()
    if (term) saveRecentSearch(term)
    const params = new URLSearchParams()
    if (term) params.set("search", term)
    if (selectedCategory.id) params.set("category", selectedCategory.id)
    const qs = params.toString()
    router.push(qs ? `/products?${qs}` : "/products")

    // Clear UI state after navigating
    setShowSuggestions(false)
    setSearchSuggestions([])
    setIsCategoryDropdownOpen(false)
  }

  // Keyboard navigation through live product suggestions
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = searchSuggestions.length
    if (e.key === "ArrowDown") {
      if (count === 0) return
      e.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((i) => (i + 1) % count)
    } else if (e.key === "ArrowUp") {
      if (count === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1))
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && searchSuggestions[activeIndex]) {
        e.preventDefault()
        const product = searchSuggestions[activeIndex]
        setShowSuggestions(false)
        setSearchSuggestions([])
        router.push(`/product/${product.slug || product.id}`)
      }
      // otherwise let the form submit (handleSearch) run normally
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/products?category=${categoryId}`)
  }

  const getDashboardLink = () => {
    // Check if user has dashboard access (for admin role)
    const dashboardAccess = (user as any)?.dashboardAccess

    if (isAdmin && dashboardAccess !== false) return "/admin"
    if (isVendor) return "/vendor/dashboard"
    return "/dashboard"
  }

  const handleLogout = () => {
    logout()
    setIsAccountMenuOpen(false)
    setIsMenuOpen(false)
  }

  // Cart badge bounce animation when count changes
  const prevCartCount = useRef(cartItemsCount)
  useEffect(() => {
    if (cartItemsCount !== prevCartCount.current && cartItemsCount > 0) {
      setCartBounce(true)
      const timer = setTimeout(() => setCartBounce(false), 300)
      prevCartCount.current = cartItemsCount
      return () => clearTimeout(timer)
    }
    prevCartCount.current = cartItemsCount
  }, [cartItemsCount])

  // Fetch products for suggestions — debounced & using server-side search
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      setIsSearching(false)
      return
    }
    let ignore = false
    setIsSearching(true)

    // Debounce: wait 300ms before fetching
    const debounceTimer = setTimeout(async () => {
      try {
        // Use server-side search param + limit to avoid fetching entire catalog
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery.trim())}&limit=6`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (!ignore) {
          setSearchSuggestions(Array.isArray(data) ? data.slice(0, 6) : [])
          setShowSuggestions(true)
        }
      } catch {
        if (!ignore) {
          setSearchSuggestions([])
          setShowSuggestions(false)
        }
      } finally {
        if (!ignore) setIsSearching(false)
      }
    }, 300)

    return () => {
      ignore = true
      clearTimeout(debounceTimer)
    }
  }, [searchQuery])

  // Hide suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMenuOpen])

  // Initialize search value from sessionStorage and listen for cross-component updates
  useEffect(() => {
    try {
      const s = sessionStorage.getItem('searchQuery') || ''
      if (s && !searchQuery) setSearchQuery(s)
    } catch (e) {
      // ignore
    }

    const listener = (ev: Event) => {
      const det = (ev as CustomEvent).detail as string
      setSearchQuery(det || '')
    }
    window.addEventListener('search:update', listener as EventListener)
    return () => window.removeEventListener('search:update', listener as EventListener)
  }, [])

  // Broadcast searchQuery changes so other pages/components can keep header in sync
  useEffect(() => {
    try {
      sessionStorage.setItem('searchQuery', searchQuery)
    } catch (e) {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('search:update', { detail: searchQuery }))
  }, [searchQuery])

  const supportPhone = siteSettings?.storePhone || "1800 123 7272"

  return (
    <>
    <motion.header
      className="sticky top-0 z-50 bg-white"
      initial={false}
      animate={{
        boxShadow: isScrolled
          ? '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)'
          : '0 0 0 0 rgba(0,0,0,0)',
        backdropFilter: isScrolled ? 'blur(12px)' : 'blur(0px)',
        backgroundColor: isScrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,1)',
      }}
      transition={{ duration: durations.normal, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Announcement bar */}
      <div className="hidden bg-[#1560BD] text-white md:block">
        <div className="section-container flex items-center justify-between gap-4 py-1.5 text-[11px]">
          <p className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span className="font-bold">SARA Super Sunday</span>
            <span className="text-white/40">|</span>
            <span className="text-white/90">Biggest Deals. Brighter Days.</span>
          </p>
          <div className="flex items-center gap-5 text-white/90">
            <Link href="/#download-app" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <Download className="h-3.5 w-3.5" />
              Download App
            </Link>
            <Link href="/store-locator" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <MapPin className="h-3.5 w-3.5" />
              Find a Store
            </Link>
            <Link href="/faq" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <HelpCircle className="h-3.5 w-3.5" />
              Help
            </Link>
            <a
              href={`tel:${supportPhone.replace(/\s/g, "")}`}
              className="flex items-center gap-1.5 font-semibold transition-colors hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" />
              {supportPhone} <span className="font-normal text-white/70">(Toll Free)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Top Navigation (desktop) */}


      <div className="section-container py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Mobile Menu Button - LEFT side */}
          <button
            className="md:hidden text-gray-800 p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors touch-manipulation"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <div className="w-6 h-6 relative flex flex-col justify-center items-center">
              <motion.span
                className="block w-5 h-[2px] bg-gray-800 rounded-full absolute"
                animate={isMenuOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.span
                className="block w-5 h-[2px] bg-gray-800 rounded-full absolute"
                animate={isMenuOpen ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block w-5 h-[2px] bg-gray-800 rounded-full absolute"
                animate={isMenuOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </button>

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-3" aria-label="Sara Mobiles and Electronics - Home">
            <div className="text-lg md:text-2xl font-heading font-bold">
              <Image src="/sara-logo.png" alt="SARA" width={374} height={100} className="h-9 md:h-12 w-auto object-contain" priority />
            </div>
          </Link>

          {/* Search with live suggestions - Hidden on mobile (Amazon-style) */}
          <div className="hidden md:flex flex-1 max-w-3xl mx-auto relative" ref={searchBoxRef}>
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative flex items-stretch h-11 rounded-lg overflow-visible bg-white ring-1 ring-gray-300 shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-accent focus-within:shadow-md">
                {/* Category selector (left) — hidden to match the approved header */}
                <div className="relative hidden flex-shrink-0" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen((v) => !v)}
                    className="h-full flex items-center gap-1 px-3 rounded-l-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border-r border-gray-300 transition-colors focus:outline-none whitespace-nowrap"
                    aria-haspopup="listbox"
                    aria-expanded={isCategoryDropdownOpen}
                    aria-label="Select search category"
                  >
                    <span className="max-w-[96px] truncate">{selectedCategory.name}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <motion.ul
                        className="absolute left-0 top-full mt-2 w-56 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl z-[60] py-1"
                        role="listbox"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: durations.normal, ease: [0.16, 1, 0.3, 1] }}
                        style={{ transformOrigin: 'top left' }}
                      >
                        <li>
                          <button
                            type="button"
                            onClick={() => { setSelectedCategory({ id: "", name: "All" }); setIsCategoryDropdownOpen(false) }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-brand-primary-subtle transition-colors ${selectedCategory.id === "" ? 'text-brand-primary font-semibold bg-brand-primary-subtle' : 'text-gray-700'}`}
                            role="option"
                            aria-selected={selectedCategory.id === ""}
                          >
                            All Categories
                          </button>
                        </li>
                        {categories.map((category) => (
                          <li key={category.id}>
                            <button
                              type="button"
                              onClick={() => { setSelectedCategory({ id: category.id, name: category.name }); setIsCategoryDropdownOpen(false) }}
                              className={`w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm hover:bg-brand-primary-subtle transition-colors ${selectedCategory.id === category.id ? 'text-brand-primary font-semibold bg-brand-primary-subtle' : 'text-gray-700'}`}
                              role="option"
                              aria-selected={selectedCategory.id === category.id}
                            >
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                                <CategoryGlyph
                                  label={category.name}
                                  className="h-4 w-4 text-gray-500"
                                  strokeWidth={1.7}
                                />
                              </span>
                              <span className="truncate">{category.name}</span>
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input (middle) */}
                <input
                  type="text"
                  placeholder="Search for products, brands and more..."
                  className="flex-1 min-w-0 px-4 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    setShowSuggestions(true)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                  aria-label="Search products"
                  role="combobox"
                  aria-expanded={showSuggestions}
                  aria-controls="search-suggestions-list"
                  aria-activedescendant={activeIndex >= 0 && searchSuggestions[activeIndex] ? `suggestion-${searchSuggestions[activeIndex].id}` : undefined}
                />

                {/* Search button (right) */}
                <button
                  type="submit"
                  className="flex-shrink-0 flex items-center justify-center px-5 rounded-r-lg bg-brand-accent hover:bg-brand-accent-hover text-white transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/60"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>
            </form>
            {/* Suggestions Dropdown & Loader */}
            <AnimatePresence>
            {showSuggestions && (
              <motion.div
                className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: durations.normal, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'top center' }}
              >
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <p className="text-gray-500 text-sm">Searching...</p>
                  </div>
                ) : searchSuggestions.length > 0 ? (
                  <>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Suggested Products</p>
                    </div>
                    <div id="search-suggestions-list" role="listbox">
                      {searchSuggestions.map((product, idx) => (
                        <SuggestionRow key={product.id} product={product} isActive={idx === activeIndex} />
                      ))}
                    </div>
                  </>
                ) : searchQuery.trim() ? (
                  <div className="px-6 py-8 text-center">
                    <div className="text-gray-400 mb-2">
                      <Search className="h-12 w-12 mx-auto opacity-50" />
                    </div>
                    <p className="text-gray-600 font-medium">No results found</p>
                    <p className="text-gray-400 text-sm mt-1">Try searching with different keywords</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                      <div className="px-2 pb-2">
                        <div className="flex items-center justify-between px-2 py-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <Clock className="h-3.5 w-3.5" /> Recent
                          </p>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-xs font-medium text-gray-400 hover:text-brand-primary transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => runSearch(term)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                          >
                            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="flex-1 text-sm text-gray-700 truncate">{term}</span>
                            <Search className="h-4 w-4 text-gray-300 group-hover:text-brand-primary transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Trending searches */}
                    <div className="px-4 pt-2 pb-1 border-t border-gray-100">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        <TrendingUp className="h-3.5 w-3.5 text-brand-accent" /> Trending Now
                      </p>
                      <div className="flex flex-wrap gap-2 pb-2">
                        {trendingTerms.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => runSearch(term)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 hover:bg-brand-primary-subtle hover:border-brand-primary/40 hover:text-brand-primary transition-colors"
                          >
                            <TrendingUp className="h-3.5 w-3.5 opacity-60" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3 md:gap-5 flex-shrink-0">
            {/* Deliver-to pincode - reference places this beside the account menu */}
            <div className="order-1 hidden lg:block">
              <DeliverToPincode variant="light" />
            </div>

            {/* Wishlist - Hidden on mobile */}
            <Link
              href="/dashboard/wishlist"
              className="order-3 hidden md:inline-flex items-center gap-2 p-2.5 rounded-lg hover:bg-brand-primary-subtle text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 transition-colors group"
            >
              <Heart className="h-5 w-5 group-hover:text-brand-primary transition-colors" />
              <span className="hidden xl:inline text-sm font-medium">Wishlist</span>
            </Link>

            {/* Cart */}
            <motion.button
              onClick={handleCartClick}
              className="order-4 relative flex items-center gap-2 p-2.5 min-h-[44px] rounded-lg hover:bg-brand-primary-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-gray-800 transition-colors touch-manipulation group"
              aria-label="View shopping cart"
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 group-hover:text-brand-primary transition-colors" />
                <AnimatePresence>
                  {cartItemsCount > 0 && (
                    <motion.span
                      key={cartItemsCount}
                      className="absolute -top-2 -right-2 bg-brand-accent text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold ring-2 ring-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: cartBounce ? 1.2 : 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      {cartItemsCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="hidden xl:inline text-sm font-medium">Cart</span>
            </motion.button>

            {/* Account/Login */}
            <div className="relative order-2">
              <button
                onClick={handleAccountClick}
                className="flex items-center gap-2 p-2.5 min-h-[44px] rounded-lg hover:bg-brand-primary-subtle text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 transition-colors touch-manipulation group"
                aria-label="Account menu"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="true"
              >
                <User className="h-5 w-5 md:h-6 md:w-6 group-hover:text-brand-primary transition-colors" />
                <span className="hidden lg:flex items-center gap-0.5 text-sm font-semibold text-gray-800">
                  <span className="max-w-[104px] truncate">
                    {user && user.name ? `Hi, ${user.name.split(" ")[0]}` : "My Account"}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              <AnimatePresence>
              {isAccountMenuOpen && user && (
                <motion.div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border"
                  role="menu"
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: durations.normal, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'top right' }}
                >
                  <div className="px-4 py-2 text-sm text-gray-500 border-b" role="none">
                    <span className="font-medium block max-w-full truncate" title={user.email}>{user.email}</span>
                    {isAdmin && <span className="block text-xs text-blue-600 font-medium">Administrator</span>}
                    {isVendor && <span className="block text-xs text-green-600 font-medium">Vendor</span>}
                  </div>
                  <Link
                    href={getDashboardLink()}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    {isAdmin && (user as any)?.dashboardAccess !== false ? "Admin Dashboard" : isVendor ? "Vendor Dashboard" : "Dashboard"}
                  </Link>
                  <Link
                    href="/dashboard/orders"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    Orders
                  </Link>
                  <Link
                    href="/dashboard/wishlist"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    Wishlist
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button removed - now on LEFT side of header */}
          </div>
        </div>


        {/* Mobile Search Bar (Amazon-style) */}
        <div className="md:hidden mt-2 pb-1">
          <form onSubmit={handleSearch}>
            <div className="relative flex items-stretch rounded-lg overflow-hidden ring-1 ring-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-accent transition-all">
              <div className="pl-3 flex items-center text-gray-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search for products, brands and more..."
                className="w-full pl-2 pr-3 py-3 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 text-sm touch-manipulation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              <button
                type="submit"
                className="text-white px-5 py-3 min-h-[44px] transition-all flex items-center bg-brand-accent hover:bg-brand-accent-hover touch-manipulation"
                aria-label="Search"
              >
                <Search className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </form>
        </div>

      </div>

      <MegaMenu />
    </motion.header>

    {/* Mobile Slide Drawer Menu */}
    <AnimatePresence>
      {isMenuOpen && (
        <>
          {/* Dark overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            className="fixed top-0 left-0 h-full w-[80vw] max-w-[320px] bg-brand-primary-hover z-[70] md:hidden flex flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <Link href="/" onClick={() => setIsMenuOpen(false)} aria-label="Home">
                <Image src="/sara-logo.png" alt="SARA" width={374} height={100} className="h-9 w-auto object-contain brightness-0 invert" />
              </Link>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable nav content */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {/* Quick Links */}
              <div className="flex flex-col space-y-1 pb-4 border-b border-white/10">
                {[
                  { href: '/', label: 'Home', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                  { href: '/products', label: 'Products', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> },
                  { href: '/about', label: 'About Us', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
                  { href: '/contact', label: 'Contact', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> },
                  { href: '/track', label: 'Track Order', icon: <Package className="h-5 w-5" /> },
                  { href: '/store-locator', label: 'Store Locator', icon: <MapPin className="h-5 w-5" /> },
                ].map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={item.href}
                      className="group text-white/80 hover:text-white font-medium py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200 flex items-center gap-3"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="text-white/50 group-hover:text-brand-primary transition-colors">{item.icon}</span>
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Categories */}
              <div className="py-4 border-b border-white/10">
                <p className="text-xs font-semibold text-white/40 uppercase mb-2 px-3 tracking-wider">Categories</p>
                {categories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * (index + 5), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button
                      onClick={() => {
                        handleCategoryClick(category.id)
                        setIsMenuOpen(false)
                      }}
                      className="w-full text-left text-white/80 hover:text-white font-medium flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200"
                    >
                      <CategoryGlyph label={category.name} className="h-5 w-5 flex-shrink-0" strokeWidth={1.7} />
                      <span>{category.name}</span>
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Account Section */}
              {user ? (
                <motion.div
                  className="pt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <div className="font-semibold text-brand-primary py-3 px-3 bg-white/5 rounded-lg mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {user.name} {isAdmin && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Admin</span>} {isVendor && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Vendor</span>}
                  </div>
                  <Link
                    href={getDashboardLink()}
                    className="text-white/80 hover:text-white font-medium py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200 flex items-center gap-3"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <svg className="h-5 w-5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    {isAdmin && (user as any)?.dashboardAccess !== false ? "Admin Dashboard" : isVendor ? "Vendor Dashboard" : "Dashboard"}
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-white/80 hover:text-white font-medium py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200 flex items-center gap-3"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="h-5 w-5 text-white/50" />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/orders"
                    className="text-white/80 hover:text-white font-medium py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200 flex items-center gap-3"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <svg className="h-5 w-5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                    Orders
                  </Link>
                  <Link
                    href="/dashboard/wishlist"
                    className="text-white/80 hover:text-white font-medium py-3 px-3 rounded-lg hover:bg-brand-primary/15 transition-all duration-200 flex items-center gap-3"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Heart className="h-5 w-5 text-white/50" />
                    Wishlist
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left text-red-400 hover:text-red-300 font-medium py-3 px-3 rounded-lg hover:bg-red-500/10 transition-all duration-200 flex items-center gap-3 mt-2"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  className="flex flex-col space-y-3 pt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <Link
                    href="/login"
                    className="text-white font-semibold text-center py-3 border border-white/20 rounded-lg hover:border-brand-primary hover:bg-brand-primary/15 transition-all duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="bg-brand-accent text-white hover:bg-brand-accent-hover font-semibold text-center py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Create Account
                  </Link>
                </motion.div>
              )}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}
