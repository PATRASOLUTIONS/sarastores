'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Check, Download, Shield, Clock, Users, SlidersHorizontal, X, ChevronDown, Search } from 'lucide-react'
import * as Slider from '@radix-ui/react-slider'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BrandMarquee from '@/components/BrandMarquee'
import SubCategoriesMarquee from '@/components/SubCategoriesMarquee'
import HeroSection from '@/components/HeroSection'

interface SoftwareProduct {
  _id: string
  name: string
  description: string
  shortDescription: string
  category: string
  image: string
  features: string[]
  systemRequirements: {
    os: string[]
    processor: string
    ram: string
    storage: string
  }
  pricing: {
    pack1: number
    pack2: number
    pack3: number
    pack4: number
    pack5: number
  }
  validityPeriods: {
    oneYear: number
    twoYear: number
    threeYear: number
    fourYear: number
    fiveYear: number
  }
  status: string
  totalKeysAvailable: number
}

export default function SoftwarePage() {
  const [products, setProducts] = useState<SoftwareProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<SoftwareProduct | null>(null)
  const [packSize, setPackSize] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [validityYears, setValidityYears] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [selectedIntegrationVariant, setSelectedIntegrationVariant] = useState<any | null>(null)

  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedPackSizes, setSelectedPackSizes] = useState<string[]>([])
  const [selectedValidityYears, setSelectedValidityYears] = useState<string[]>([])
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({
    price: true,
    categories: true,
    packSizes: true,
    validityYears: true,
  })

  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    fetchProducts()
  }, [])

  // Auto-select first available pack size and validity period when product is selected
  useEffect(() => {
    if (selectedProduct) {
      // Find first available pack size
      const firstAvailablePack = [1, 2, 3, 4, 5].find(size => {
        const packPrice = selectedProduct.pricing[`pack${size}` as keyof typeof selectedProduct.pricing]
        return packPrice && packPrice > 0
      })
      if (firstAvailablePack) {
        setPackSize(firstAvailablePack as 1 | 2 | 3 | 4 | 5)
      }

      // Find first available validity period
      const firstAvailableValidity = [1, 2, 3, 4, 5].find(years => {
        const validityKey = years === 1 ? 'oneYear' : 
                           years === 2 ? 'twoYear' : 
                           years === 3 ? 'threeYear' : 
                           years === 4 ? 'fourYear' : 'fiveYear'
        const validityPrice = selectedProduct.validityPeriods[validityKey as keyof typeof selectedProduct.validityPeriods]
        
        // Edge case: oneYear can be 0 (free), for others must be > 0
        if (validityPrice === undefined || validityPrice === null) return false
        if (years === 1) return true // oneYear can be 0
        return validityPrice > 0
      })
      if (firstAvailableValidity) {
        setValidityYears(firstAvailableValidity as 1 | 2 | 3 | 4 | 5)
      }
    }
  }, [selectedProduct])

  // When an integration (KGen) product is selected, pre-select its first variant for the integration modal
  useEffect(() => {
    if (selectedProduct && (selectedProduct as any).isKGen) {
      const variants = (selectedProduct as any).kgenVariants || []
      setSelectedIntegrationVariant(variants.length > 0 ? variants[0] : null)
    } else {
      setSelectedIntegrationVariant(null)
    }
  }, [selectedProduct])

  const fetchProducts = async () => {
    // Fetch internal and external products robustly and merge them so KGen items always appear when available.
    let internalProducts: SoftwareProduct[] = []
    try {
      const response = await fetch('/api/software?status=active')
      const data = await response.json().catch(() => null)
      if (data && data.success) internalProducts = data.products || []
      else if (Array.isArray(data)) internalProducts = data as any
    } catch (error) {
      console.error('Error fetching internal software list:', error)
      // continue; we still want to try loading external products
    }

    // Attempt to fetch KGen / eXlr8 products via the server proxy and map into our product shape.
    let mappedKGen: SoftwareProduct[] = []
    try {
      const kres = await fetch('/api/integrations/exlr8/products?limit=50')
      if (kres.ok) {
        const kdata = await kres.json().catch(() => null)
        // normalize list shapes
        let klist: any[] = []
        if (Array.isArray(kdata)) klist = kdata
        else if (Array.isArray(kdata.data)) klist = kdata.data
        else if (Array.isArray(kdata.products)) klist = kdata.products
        else if (Array.isArray(kdata.items)) klist = kdata.items

        mappedKGen = klist.map((it: any) => {
          const id = it.productID || it.productId || it.id || String(it._id) || ''
          const name = it.productDisplayName || it.productName || it.productDisplayName || ('KGen Product ' + id)
          const image = Array.isArray(it.attachments) && it.attachments.length > 0 ? it.attachments[0] : '/placeholder.png'
          const categories = Array.isArray(it.categories) ? it.categories : []
          const categoryName = categories[0]?.categoryName || 'KGen'
          const variants = Array.isArray(it.variants) ? it.variants : []
          const totalStock = variants.reduce((s: number, v: any) => s + (Number(v.stock) || 0), 0)

          // Map variant pricing into pack1 (primary price) and keep full variant list in kgenVariants
          const primaryPrice = Number(variants[0]?.price ?? variants[0]?.mrp ?? 0)

          return {
            _id: `kgen:${id}`,
            name,
            description: it.descriptionText || it.description || '',
            shortDescription: (it.descriptionText && String(it.descriptionText).slice(0, 160)) || it.description || '',
            category: categoryName,
            image,
            features: [] as string[],
            systemRequirements: { os: [], processor: '', ram: '', storage: '' },
            pricing: { pack1: primaryPrice, pack2: 0, pack3: 0, pack4: 0, pack5: 0 },
            validityPeriods: { oneYear: 0, twoYear: 0, threeYear: 0, fourYear: 0, fiveYear: 0 },
            status: 'active',
            totalKeysAvailable: totalStock,
            // integration metadata
            isKGen: true as const,
            provider: 'exlr8',
            kgenRaw: it,
            kgenVariants: variants,
          } as any
        })
      } else {
        console.warn('KGen products proxy returned non-ok status', kres.status)
      }
    } catch (err) {
      console.warn('Failed to load KGen products proxy:', err)
    }

    // Merge internal + KGen products, with KGen appended so they're visible in the product grid
    try {
      setProducts([...(internalProducts || []), ...(mappedKGen || [])])
    } catch (e) {
      console.error('Failed to merge products:', e)
      setProducts(internalProducts || [])
    } finally {
      setLoading(false)
    }
  }

  // Filter helper functions
  const toggleFilter = (filterType: string) => {
    setOpenFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }))
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const togglePackSize = (packSize: string) => {
    setSelectedPackSizes(prev =>
      prev.includes(packSize)
        ? prev.filter(p => p !== packSize)
        : [...prev, packSize]
    )
  }

  const toggleValidityYear = (year: string) => {
    setSelectedValidityYears(prev =>
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year]
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setPriceRange([0, 200000])
    setSelectedCategories([])
    setSelectedPackSizes([])
    setSelectedValidityYears([])
  }

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // Get unique values for filters
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))]
    return cats.map(cat => ({ id: cat, name: cat }))
  }, [products])

  const availablePackSizes = useMemo(() => {
    return [1, 2, 3, 4, 5]
  }, [])

  const availableValidityYears = useMemo(() => {
    return [1, 2, 3, 4, 5]
  }, [])

  const calculatePrice = (product: SoftwareProduct) => {
    const packPrices = {
      1: product.pricing.pack1,
      2: product.pricing.pack2,
      3: product.pricing.pack3,
      4: product.pricing.pack4,
      5: product.pricing.pack5,
    }

    const validityMultipliers = {
      1: product.validityPeriods.oneYear,
      2: product.validityPeriods.twoYear,
      3: product.validityPeriods.threeYear,
      4: product.validityPeriods.fourYear,
      5: product.validityPeriods.fiveYear,
    }

    const basePrice = packPrices[packSize]
    const validityPrice = validityMultipliers[validityYears]

    return basePrice + validityPrice
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        if (!product.name.toLowerCase().includes(searchLower) &&
            !product.shortDescription.toLowerCase().includes(searchLower) &&
            !product.description.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) {
        return false
      }

      // Price filter - check all pricing combinations
      const productPrices = []
      for (let pack = 1; pack <= 5; pack++) {
        for (let year = 1; year <= 5; year++) {
          const basePrice = product.pricing[`pack${pack}` as keyof typeof product.pricing]
          const validityPrice = product.validityPeriods[`${year}Year` as keyof typeof product.validityPeriods]
          productPrices.push(basePrice + validityPrice)
        }
      }

      const minPrice = Math.min(...productPrices)
      const maxPrice = Math.max(...productPrices)

      if (minPrice > priceRange[1] || maxPrice < priceRange[0]) {
        return false
      }

      // Pack size filter - check if product has the selected pack sizes with non-zero pricing
      if (selectedPackSizes.length > 0) {
        const hasSelectedPack = selectedPackSizes.some(size => {
          const packPrice = product.pricing[`pack${size}` as keyof typeof product.pricing]
          return packPrice > 0
        })
        if (!hasSelectedPack) {
          return false
        }
      }

      // Validity year filter - check if product has the selected validity periods
      if (selectedValidityYears.length > 0) {
        const hasSelectedValidity = selectedValidityYears.some(year => {
          const validityKey = year === '1' ? 'oneYear' : 
                             year === '2' ? 'twoYear' : 
                             year === '3' ? 'threeYear' : 
                             year === '4' ? 'fourYear' : 'fiveYear'
          const validityPrice = product.validityPeriods[validityKey as keyof typeof product.validityPeriods]
          
          // Edge case: if oneYear = 0, still show it (could be free/promotional)
          // For other years, only show if pricing > 0
          if (validityPrice === undefined || validityPrice === null) return false
          if (year === '1') return true // oneYear can be 0 (free)
          return validityPrice > 0
        })
        if (!hasSelectedValidity) {
          return false
        }
      }

      return true
    })
  }, [products, searchTerm, selectedCategories, priceRange, selectedPackSizes, selectedValidityYears, availablePackSizes, availableValidityYears])

  const addToCart = (product: SoftwareProduct, variant?: any) => {
    if (!user) {
      toast.error('Please login to add items to cart')
      if (typeof window !== 'undefined') {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
      }
      return
    }
    // Support KGen integration items which provide variants.
    let cartItem: any
    if ((product as any).isKGen) {
      if (!variant) {
        toast.error('Please select a variant for this product')
        return
      }
      cartItem = {
        id: `${product._id}::${variant.variantID}`,
        name: `${product.name} - ${variant.variantDisplayName || variant.variantName}`,
        image: product.image,
        packSize: 1,
        validityYears: 1,
        maxDevices: 1,
        validity: '1 Year',
        price: Number(variant.price || variant.mrp || 0),
        quantity: 1,
        type: 'software' as const,
        source: 'kgen',
        provider: (product as any).provider || 'exlr8',
        kgenProductId: (product as any).kgenRaw?.productID || null,
        kgenVariantId: variant.variantID,
      }
    } else {
      const price = calculatePrice(product)
      cartItem = {
        id: product._id,
        name: product.name,
        image: product.image,
        packSize,
        validityYears,
        maxDevices: packSize, // Using packSize as maxDevices since it represents the number of licenses
        validity: `${validityYears} ${validityYears === 1 ? 'Year' : 'Years'}`, // Formatting validity as a string
        price,
        quantity: 1,
        type: 'software' as const,
        color: null,
        size: null,
      }
    }

    try {
      // Get existing cart
      const existingCart = JSON.parse(localStorage.getItem(`cart_${user.id}`) || '[]')
      
      // Check if item already exists in cart
      const existingItemIndex = existingCart.findIndex((item: any) => item.id === cartItem.id)
      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        existingCart[existingItemIndex].quantity += 1
      } else {
        // Add new item
        existingCart.push(cartItem)
      }
      
      // Save to localStorage
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(existingCart))
      
      // Show success message
      toast.success(`${product.name} added to cart!`)
      
      // Dispatch event to update cart count in header
      window.dispatchEvent(new Event('cart-updated'))
    } catch (error) {
      console.error('Error adding to cart:', error)
      toast.error('Failed to add item to cart. Please try again.')
    } finally {
      // Close the modal and clear any selected integration variant
      setSelectedProduct(null)
      setSelectedIntegrationVariant(null)
    }
  }

  const handleSelectProduct = (product: SoftwareProduct) => {
    // When selecting a KGen/exlr8 product, attach kgen ids to the selectedProduct
    if ((product as any).isKGen) {
      const kgenProductId = (product as any).kgenRaw?.productID || (product as any).kgenRaw?.productId || null
      const variants = (product as any).kgenVariants || []
      const firstVariant = variants.length > 0 ? variants[0] : null
      const kgenVariantId = firstVariant ? (firstVariant.variantID || firstVariant.id || null) : null

      // Pre-select the first integration variant so the modal shows a selected option
      setSelectedIntegrationVariant(firstVariant)

      // Store enhanced product object so downstream flows (modals, add-to-cart) can read kgen ids directly
      setSelectedProduct({ ...(product as any), kgenProductId, kgenVariantId } as any)
      return
    }

    // Default internal products
    setSelectedProduct(product)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <BrandMarquee />
      <SubCategoriesMarquee />
      <HeroSection />
      
      <div className="min-h-screen bg-gray-50">
       

      {/* Features Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-brand-primary" />
              <div>
                <div className="font-semibold">Instant Delivery</div>
                <div className="text-sm text-gray-600">Keys sent via email</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-semibold">100% Genuine</div>
                <div className="text-sm text-gray-600">Official licenses</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-purple-600" />
              <div>
                <div className="font-semibold">Flexible Validity</div>
                <div className="text-sm text-gray-600">1-5 year options</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-orange-600" />
              <div>
                <div className="font-semibold">Multi-User Packs</div>
                <div className="text-sm text-gray-600">1-5 licenses</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Software Products</h1>
            <p className="text-gray-600 mt-1">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary-hover transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        <div className="flex gap-6">
          {/* Filter Sidebar */}
          <aside
            className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-64 flex-shrink-0`}
          >
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  Filters
                </h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Filters */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* Search */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Software
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search software..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Price Range</h3>
                    <button
                      onClick={() => toggleFilter('price')}
                      className="p-1 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openFilters.price ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                  {openFilters.price && (
                    <div className="px-2">
                      <Slider.Root
                        className="relative flex items-center select-none touch-none h-5 mb-4"
                        value={priceRange}
                        max={200000}
                        step={1000}
                        minStepsBetweenThumbs={1}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                      >
                        <Slider.Track className="bg-gray-200 relative grow rounded-full h-[3px]">
                          <Slider.Range className="absolute bg-brand-primary rounded-full h-full" />
                        </Slider.Track>
                        <Slider.Thumb
                          className="block w-5 h-5 bg-white border-2 border-blue-600 rounded-full hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Min price"
                        />
                        <Slider.Thumb
                          className="block w-5 h-5 bg-white border-2 border-blue-600 rounded-full hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Max price"
                        />
                      </Slider.Root>

                      <div className="flex justify-between items-center gap-4 mt-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Min Price</label>
                          <input
                            type="number"
                            value={priceRange[0]}
                            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                            min={0}
                            max={priceRange[1]}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Max Price</label>
                          <input
                            type="number"
                            value={priceRange[1]}
                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                            min={priceRange[0]}
                            max={200000}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Categories</h3>
                    <button
                      onClick={() => toggleFilter('categories')}
                      className="p-1 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.categories ? '' : '-rotate-90'}`} />
                    </button>
                  </div>
                  {openFilters.categories && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {categories.map((category) => {
                        const count = products.filter((p) => p.category === category.id).length
                        return (
                          <label
                            key={category.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category.id)}
                              onChange={() => toggleCategory(category.id)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-sm text-gray-700 flex-1">
                              {capitalizeFirstLetter(category.name)}
                            </span>
                            <span className="text-xs text-gray-500">({count})</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Pack Sizes */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">License Packs</h3>
                    <button
                      onClick={() => toggleFilter('packSizes')}
                      className="p-1 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.packSizes ? '' : '-rotate-90'}`} />
                    </button>
                  </div>
                  {openFilters.packSizes && (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                      {availablePackSizes.map((size) => (
                        <label key={size} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedPackSizes.includes(size.toString())}
                            onChange={() => togglePackSize(size.toString())}
                          />
                          <span>{size} License{size > 1 ? 's' : ''}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Validity Years */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Validity Period</h3>
                    <button
                      onClick={() => toggleFilter('validityYears')}
                      className="p-1 hover:bg-gray-100 rounded-md"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.validityYears ? '' : '-rotate-90'}`} />
                    </button>
                  </div>
                  {openFilters.validityYears && (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                      {availableValidityYears.map((year) => (
                        <label key={year} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedValidityYears.includes(year.toString())}
                            onChange={() => toggleValidityYear(year.toString())}
                          />
                          <span>{year} Year{year > 1 ? 's' : ''}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Clear Filters Button */}
              <button
                onClick={clearFilters}
                className="mt-4 w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-600 text-lg mb-4">No software products match your filters.</p>
                <button
                  onClick={clearFilters}
                  className="text-brand-primary hover:text-brand-primary-hover underline"
                >
                  Clear filters to see all products
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    <div className="relative h-48 bg-gradient-to-br from-brand-primary to-brand-primary-hover">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-semibold text-brand-primary">
                        {product.totalKeysAvailable} keys available
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="text-sm text-gray-600 mb-2">{product.category}</div>
                      <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {product.shortDescription}
                      </p>

                      <div className="mb-4">
                        <div className="text-sm font-semibold mb-2">Key Features:</div>
                        <ul className="space-y-1">
                          {product.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-sm text-gray-600">Starting from</div>
                            <div className="text-2xl font-bold text-brand-primary">
                              ₹{product.pricing.pack1.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectProduct(product)}
                          className="w-full bg-brand-accent text-white py-3 rounded-lg font-semibold hover:bg-brand-accent-hover transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="w-5 h-5" />
                          Select Options
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

                

      {/* Product Selection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedProduct.shortDescription}</p>
                </div>
                <button
                  onClick={() => { setSelectedProduct(null); setSelectedIntegrationVariant(null) }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Integration product modal */}
              {(selectedProduct as any).isKGen ? (
                <div>
                  <div className="mb-4">
                    <img src={(selectedProduct as any).image} alt={selectedProduct.name} className="w-full h-48 object-cover rounded" />
                  </div>

                  <div className="mb-4">
                    <h3 className="font-semibold">Variants</h3>
                    <div className="mt-2 grid gap-3">
                      {((selectedProduct as any).kgenVariants || []).map((v: any) => (
                        <label key={v.variantID} className={`p-3 border rounded flex items-center justify-between cursor-pointer ${selectedIntegrationVariant?.variantID === v.variantID ? 'border-brand-primary bg-brand-primary-subtle' : 'border-gray-200'}`}>
                          <div>
                            <div className="font-semibold">{v.variantDisplayName || v.variantName}</div>
                            <div className="text-sm text-gray-600">Price: ₹{Number(v.price).toLocaleString('en-IN')} • MRP: ₹{Number(v.mrp).toLocaleString('en-IN')}</div>
                            <div className="text-xs text-gray-500">Stock: {v.stock}</div>
                          </div>
                          <input
                            type="radio"
                            name="kgen-variant"
                            checked={selectedIntegrationVariant?.variantID === v.variantID}
                            onChange={() => setSelectedIntegrationVariant(v)}
                          />
                        </label>
                      ))}
                      {((selectedProduct as any).kgenVariants || []).length === 0 && (
                        <div className="text-sm text-gray-600">No variants available.</div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold">Redemption Instructions</h3>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{(selectedProduct as any).kgenRaw?.redemptionInstructions || 'Follow instructions provided by the partner.'}</p>
                  </div>

                  <div className="mb-4 bg-white rounded-lg p-4 border">
                    <h3 className="font-semibold">Terms & Conditions</h3>
                    <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{(selectedProduct as any).kgenRaw?.termsAndConditions || ''}</p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setSelectedProduct(null); setSelectedIntegrationVariant(null) }} className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                    <button
                      onClick={() => addToCart(selectedProduct, selectedIntegrationVariant)}
                      disabled={!selectedIntegrationVariant}
                      className="flex-1 py-3 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ) : (
                // Default internal product modal (unchanged)
                <>
                  {/* Pack Size Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-3">Number of Licenses</label>
                    <div className="grid grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5].map((size) => {
                        const packPrice = selectedProduct.pricing[`pack${size}` as keyof typeof selectedProduct.pricing]
                        if (!packPrice || packPrice <= 0) return null
                        return (
                          <button key={size} onClick={() => setPackSize(size as any)} className={`py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${packSize === size ? 'border-brand-primary bg-brand-primary-subtle text-brand-primary' : 'border-gray-200 hover:border-gray-300'}`}>{size}</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Validity Period Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-3">Validity Period</label>
                    <div className="grid grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5].map((years) => {
                        const validityKey = years === 1 ? 'oneYear' : years === 2 ? 'twoYear' : years === 3 ? 'threeYear' : years === 4 ? 'fourYear' : 'fiveYear'
                        const validityPrice = selectedProduct.validityPeriods[validityKey as keyof typeof selectedProduct.validityPeriods]
                        if (validityPrice === undefined || validityPrice === null) return null
                        if (years !== 1 && validityPrice <= 0) return null
                        return (
                          <button key={years} onClick={() => setValidityYears(years as any)} className={`py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${validityYears === years ? 'border-green-600 bg-green-50 text-green-600' : 'border-gray-200 hover:border-gray-300'}`}>{years}Y</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-2"><span className="text-gray-600">Pack Size:</span><span className="font-semibold">{packSize} License(s)</span></div>
                    <div className="flex items-center justify-between mb-2"><span className="text-gray-600">Validity:</span><span className="font-semibold">{validityYears} Year(s)</span></div>
                    <div className="border-t pt-2 mt-2"><div className="flex items-center justify-between"><span className="text-lg font-bold">Total Price:</span><span className="text-2xl font-bold text-brand-primary">₹{calculatePrice(selectedProduct).toLocaleString('en-IN')}</span></div></div>
                  </div>

                  {/* Features */}
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">What's Included:</h3>
                    <ul className="space-y-2">
                      {selectedProduct.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2"><Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" /> <span className="text-gray-700">{feature}</span></li>
                      ))}
                    </ul>
                  </div>

                  {/* System Requirements */}
                  <div className="mb-6 bg-brand-primary-subtle rounded-lg p-4">
                    <h3 className="font-semibold mb-2">System Requirements:</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div><strong>OS:</strong> {selectedProduct.systemRequirements.os.join(', ')}</div>
                      <div><strong>Processor:</strong> {selectedProduct.systemRequirements.processor}</div>
                      <div><strong>RAM:</strong> {selectedProduct.systemRequirements.ram}</div>
                      <div><strong>Storage:</strong> {selectedProduct.systemRequirements.storage}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedProduct(null)} className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={() => addToCart(selectedProduct)} className="flex-1 py-3 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent-hover transition-colors flex items-center justify-center gap-2"><ShoppingCart className="w-5 h-5" /> Add to Cart</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
      </div>

      <Footer />
    </>
  )
}
