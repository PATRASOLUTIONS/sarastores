"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Search, ShoppingCart, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import ProductReviews from "@/components/ProductReviews"
import AdvertisementCarousel from "@/components/AdvertisementCarousel"
import AddToCartButton from "@/components/AddToCartButton"
import { useCart } from "@/hooks/useCart"
import HeroSection from "@/components/HeroSection"
import CategoryProductCard from "@/components/CategoryProductCard"
import * as Slider from '@radix-ui/react-slider';
import { normalizeProductForSchema } from "@/lib/product-schema"

interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  manufacturer?: string
  manufacturerName?: string
  color?: string
  capacity?: string
  images?: string[]
  sku?: string
  type?: string
  raw?: any
}

interface Category {
  id: string
  name: string
  description: string
  image: string
}

const capitalizeFirstLetter = (string: string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const getCanonicalMeta = (product: any) => normalizeProductForSchema(product)
const getProductType = (product: any) => String(product?.type || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductBrand = (product: any) => String(getCanonicalMeta(product).manufacturerName || "")
const getProductCharDesc = (product: any) => String(getCanonicalMeta(product).charDesc || "")
const getProductSubCategory = (product: any) => String(product?.subCategory || getCanonicalMeta(product).subCategoryProdDesc || "")

export default function SubCategoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [subCategoryName, setSubCategoryName] = useState<string>("")
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const { cart } = useCart()
  const subCategoryParam = params.name as string

  // Filter state variables
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [descriptionFilter, setDescriptionFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [selectedCharDesc, setSelectedCharDesc] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [types, setTypes] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [charDescs, setCharDescs] = useState<string[]>([])

  const [openFilters, setOpenFilters] = useState({
    types: true,
    brands: true,
    price: true,
    charDesc: true
  })

  useEffect(() => {
    if (subCategoryParam) {
      // Decode URL parameter: replace hyphens with spaces
      const decodedName = decodeURIComponent(subCategoryParam).replace(/-/g, ' ')
      setSubCategoryName(decodedName)
      fetchSubCategoryData(decodedName)
    }
  }, [subCategoryParam])

  const fetchSubCategoryData = async (subCatName: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all products and categories
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories")
      ])

      if (!productsResponse.ok) {
        throw new Error("Failed to fetch products")
      }

      const allProducts = await productsResponse.json()
      const allCategories = await categoriesResponse.json()
      setCategories(allCategories)

      // Filter products by canonical sub-category value
      const filteredProducts = allProducts.filter((product: Product) => {
        const subCategory = getProductSubCategory(product)
        return subCategory && subCategory.toLowerCase() === subCatName.toLowerCase()
      })

      setProducts(filteredProducts)

      // Extract unique values for filters
      const uniqueTypes = [...new Set(filteredProducts.map((p: Product) => getProductType(p)).filter(Boolean))]
      const uniqueBrands = [...new Set(filteredProducts.map((p: Product) => getProductBrand(p)).filter(Boolean))]
      const uniqueCharDescs = [...new Set(filteredProducts.map((p: Product) => getProductCharDesc(p)).filter(Boolean))]

      setTypes(uniqueTypes as string[])
      setBrands(uniqueBrands as string[])
      setCharDescs(uniqueCharDescs as string[])

      // Set price range based on products
      if (filteredProducts.length > 0) {
        const prices = filteredProducts.map((p: Product) => p.price)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        setPriceRange([minPrice, maxPrice])
      }

    } catch (err) {
      console.error("Error fetching sub-category data:", err)
      setError(err instanceof Error ? err.message : "Failed to load sub-category")
    } finally {
      setIsLoading(false)
    }
  }

  // Get filtered character descriptions based on other filters
  const getFilteredCharDescs = () => {
    const filtered = new Set<string>()
    
    products.forEach((product) => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = 
        selectedTypes.length === 0 ||
        selectedTypes.includes(getProductType(product))
      
      const matchesPrice = 
        product.price >= priceRange[0] && 
        product.price <= priceRange[1]
      
      const matchesBrand = 
        selectedBrands.length === 0 ||
        selectedBrands.includes(getProductBrand(product))
      
      const matchesDescription = 
        !descriptionFilter ||
        product.description.toLowerCase().includes(descriptionFilter.toLowerCase())
      
      if (matchesSearch && matchesType && matchesPrice && matchesBrand && matchesDescription) {
        const charDesc = getProductCharDesc(product)
        if (charDesc) {
          filtered.add(charDesc)
        }
      }
    })
    
    return Array.from(filtered)
  }

  // Filter products based on search term and other filters
  const filteredProducts = products.filter((product: any) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(getProductType(product))
    
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]
    
    const matchesBrand = selectedBrands.length === 0 || 
              selectedBrands.includes(getProductBrand(product))
    
    const matchesCharDesc = selectedCharDesc.length === 0 || 
                 selectedCharDesc.includes(getProductCharDesc(product))
    
    const matchesDescription = !descriptionFilter || 
                              product.description.toLowerCase().includes(descriptionFilter.toLowerCase())

    return matchesSearch && matchesType && matchesPrice && matchesBrand && matchesCharDesc && matchesDescription
  })

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedTypes, priceRange, selectedBrands, selectedCharDesc, descriptionFilter, searchTerm, charDescs])

  // Update character descriptions and brands when filters change
  useEffect(() => {
    // Get filtered character descriptions
    const filteredCharDescs = getFilteredCharDescs()
    setCharDescs(filteredCharDescs)
    
    // Remove any selected character descriptions that are no longer in the filtered list
    setSelectedCharDesc(prev => 
      prev.filter(desc => filteredCharDescs.includes(desc))
    )
    
    // Update available brands based on current filters (except brand filter itself)
    const filteredBrands = new Set<string>()
    
    products.forEach((product) => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = 
        selectedTypes.length === 0 ||
        selectedTypes.includes(getProductType(product))
      
      const matchesPrice = 
        product.price >= priceRange[0] && 
        product.price <= priceRange[1]
      
      const matchesDescription = 
        !descriptionFilter ||
        product.description.toLowerCase().includes(descriptionFilter.toLowerCase())
      
      if (matchesSearch && matchesType && matchesPrice && matchesDescription) {
        const brand = getProductBrand(product)
        if (brand) {
          filteredBrands.add(brand)
        }
      }
    })
    
    // Update brands list while preserving the original order
    const newBrands = Array.from(filteredBrands)
    setBrands(prevBrands => {
      // Maintain the original order of brands that still exist in the filtered set
      return prevBrands.filter(brand => filteredBrands.has(brand))
        // Add any new brands that weren't in the original list (shouldn't happen, but just in case)
        .concat(Array.from(filteredBrands).filter(brand => !prevBrands.includes(brand)))
    })
    
    // Remove any selected brands that are no longer in the filtered list
    setSelectedBrands(prev => 
      prev.filter(brand => filteredBrands.has(brand))
    )
    
  }, [products, searchTerm, selectedTypes, priceRange, descriptionFilter]) // Removed selectedBrands from dependencies to prevent loop

  const toggleFilter = (filterName: keyof typeof openFilters) => {
    setOpenFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }))
  }

  const handleTypeChange = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleBrandChange = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    )
  }

  const handleCharDescChange = (charDesc: string) => {
    setSelectedCharDesc(prev =>
      prev.includes(charDesc) ? prev.filter(c => c !== charDesc) : [...prev, charDesc]
    )
  }

  const clearAllFilters = () => {
    setSelectedTypes([])
    setSelectedBrands([])
    setSelectedCharDesc([])
    setPriceRange([0, 200000])
    setDescriptionFilter("")
    setSearchTerm("")
  }

  const activeFiltersCount = selectedTypes.length + selectedBrands.length + selectedCharDesc.length + 
                            (descriptionFilter ? 1 : 0)

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sub-category...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Go Home
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <HeroSection />

        {/* Breadcrumb and Header Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {/* Breadcrumb */}
                <nav className="text-sm mb-2">
                  <Link href="/" className="text-blue-600 hover:text-blue-800">Home</Link>
                  <span className="mx-2 text-gray-400">/</span>
                  <Link href="/" className="text-blue-600 hover:text-blue-800">Products</Link>
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-700 font-medium">{subCategoryName}</span>
                </nav>
                
                {/* Category Title and Count */}
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{subCategoryName}</h1>
                  <span className="text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                  </span>
                </div>
              </div>

              {/* Cart Button - Commented out for now */}
              {/* <Link
                href="/cart"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden sm:inline">Cart</span>
                <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-sm font-semibold">
                  {cart.length}
                </span>
              </Link> */}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="flex gap-6">
            <aside
              className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-80 flex-shrink-0 slide-in-from-right`}
            >
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
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
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <Slider.Range className="absolute bg-blue-600 rounded-full h-full" />
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
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-gray-500">Min Price (₹)</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                              <input
                                type="number"
                                value={priceRange[0]}
                                onChange={(e) => {
                                  const newMin = Math.min(Number(e.target.value), priceRange[1] - 1000);
                                  setPriceRange([newMin, priceRange[1]]);
                                }}
                                className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min={0}
                                max={priceRange[1] - 1000}
                                style={{ minWidth: '120px' }}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-gray-500">Max Price (₹)</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                              <input
                                type="number"
                                value={priceRange[1]}
                                onChange={(e) => {
                                  const newMax = Math.max(Number(e.target.value), priceRange[0] + 1000);
                                  setPriceRange([priceRange[0], newMax]);
                                }}
                                className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min={priceRange[0] + 1000}
                                max={200000}
                                style={{ minWidth: '120px' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Types/Subcategories */}
                  {types.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold">Sub Categories</h3>
                        <button
                          onClick={() => toggleFilter('types')}
                          className="p-1 hover:bg-gray-100 rounded-md"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.types ? '' : '-rotate-90'}`} />
                        </button>
                      </div>
                      {openFilters.types && (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                          {types.map((type) => (
                            <label key={type} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedTypes.includes(type)}
                                onChange={() => handleTypeChange(type)}
                              />
                              <span>{capitalizeFirstLetter(type)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Brands */}
                  {brands.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Brands</h3>
                        <button
                          onClick={() => toggleFilter('brands')}
                          className="p-1 hover:bg-gray-100 rounded-md"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.brands ? '' : '-rotate-90'}`} />
                        </button>
                      </div>
                      {openFilters.brands && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {brands.map((brand) => (
                            <label key={brand} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={selectedBrands.includes(brand)}
                                onChange={() => handleBrandChange(brand)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-gray-700">{capitalizeFirstLetter(brand)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Product Description */}
                  {/* <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Description
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter by description..."
                        value={descriptionFilter}
                        onChange={(e) => setDescriptionFilter(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div> */}

                  {/* Character Description */}
                  {charDescs.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold">Character Description</h3>
                        <button
                          onClick={() => toggleFilter('charDesc')}
                          className="p-1 hover:bg-gray-100 rounded-md"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.charDesc ? '' : '-rotate-90'}`} />
                        </button>
                      </div>
                      {openFilters.charDesc && (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                          {charDescs.map((charDesc) => (
                            <label key={charDesc} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedCharDesc.includes(charDesc)}
                                onChange={() => handleCharDescChange(charDesc)}
                              />
                              <span>{capitalizeFirstLetter(charDesc)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Clear Filters Button */}
                <button
                  onClick={clearAllFilters}
                  className="mt-4 w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            </aside>

            {/* Products Section */}
            <div className="flex-1">
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <span className="flex items-center font-medium">
                    <SlidersHorizontal className="h-5 w-5 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        {activeFiltersCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Active Filters Display */}
              {activeFiltersCount > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Active Filters:</span>
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                      >
                        {type}
                        <button
                          onClick={() => handleTypeChange(type)}
                          className="ml-2 hover:text-blue-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {selectedBrands.map((brand) => (
                      <span
                        key={brand}
                        className="inline-flex items-center bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full"
                      >
                        {brand}
                        <button
                          onClick={() => handleBrandChange(brand)}
                          className="ml-2 hover:text-green-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {selectedCharDesc.map((charDesc) => (
                      <span
                        key={charDesc}
                        className="inline-flex items-center bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full"
                      >
                        {charDesc}
                        <button
                          onClick={() => handleCharDescChange(charDesc)}
                          className="ml-2 hover:text-purple-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Grid */}
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                  {currentProducts.map((product) => (
                    <CategoryProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <div className="text-gray-400 mb-4">
                    <Search className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No products found</h3>
                  <p className="text-gray-600 mb-4">
                    Try adjusting your filters or search terms
                  </p>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <div className="flex gap-1">
                      {[...Array(totalPages)].map((_, index) => {
                        const pageNumber = index + 1
                        if (
                          pageNumber === 1 ||
                          pageNumber === totalPages ||
                          (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`px-4 py-2 rounded-lg ${
                                currentPage === pageNumber
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          )
                        } else if (
                          pageNumber === currentPage - 2 ||
                          pageNumber === currentPage + 2
                        ) {
                          return <span key={pageNumber} className="px-2">...</span>
                        }
                        return null
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
