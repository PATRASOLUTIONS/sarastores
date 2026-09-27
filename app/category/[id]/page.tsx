"use client"

import { useState, useEffect } from "react"
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
import { formatPrice } from "@/utils/formatPrice";
import { normalizeProductForSchema } from "@/lib/product-schema"
import { PRODUCT_SORT_OPTIONS, sortProducts, type ProductSortKey } from "@/lib/product-sort"
import {
  buildFacets,
  countActiveFacets,
  matchesFacets,
  toggleFacetValue,
  type FacetSelection,
} from "@/lib/product-facets"
import SpecFacets from "@/components/SpecFacets"

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
}

interface Category {
  id: string
  name: string
  description: string
  image: string
}

// Add this helper function near the top of the file, after the interfaces
const capitalizeFirstLetter = (string: string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const getCanonicalMeta = (product: any) => normalizeProductForSchema(product)
const getProductType = (product: any) => String(product?.type || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductBrand = (product: any) => String(getCanonicalMeta(product).manufacturerName || "")
const getProductCharDesc = (product: any) => String(getCanonicalMeta(product).charDesc || "")

export default function CategoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const { cart } = useCart()
  // Decode URL: replace hyphens with spaces and decode URI
  const categoryName = decodeURIComponent(params.id as string).replace(/-/g, ' ')

  // Filter state variables
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [descriptionFilter, setDescriptionFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [selectedCharDesc, setSelectedCharDesc] = useState<string[]>([])
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({})
  const [sortBy, setSortBy] = useState<ProductSortKey>("relevance")
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
    if (categoryName) {
      fetchCategoryData()
    }
  }, [categoryName])

  const fetchCategoryData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all categories first to find by name
      const categoriesResponse = await fetch("/api/categories")
      if (!categoriesResponse.ok) {
        throw new Error("Failed to fetch categories")
      }
      const allCategories: Category[] = await categoriesResponse.json()

      // The route param may be a category id or a (possibly hyphenated) name.
      const rawParam = decodeURIComponent(params.id as string)
      const categoryData = allCategories.find(
        (cat) =>
          cat.id === rawParam ||
          cat.name.toLowerCase() === categoryName.toLowerCase() ||
          cat.name.toLowerCase() === rawParam.toLowerCase(),
      )

      if (!categoryData) {
        throw new Error("Category not found")
      }
      setCategory(categoryData)
      setCategories(allCategories)

      // Filter server-side so the page pulls one category instead of the whole catalogue.
      const productsResponse = await fetch(
        `/api/products?category=${encodeURIComponent(categoryData.name)}`,
      )
      if (!productsResponse.ok) throw new Error("Failed to fetch products")
      const scoped: Product[] = await productsResponse.json()

      const categoryKey = categoryData.name.trim().toLowerCase()
      let categoryProducts = Array.isArray(scoped) ? scoped : []

      if (categoryProducts.length === 0) {
        // Legacy rows may hold the category id, or only a groupName.
        const allResponse = await fetch("/api/products")
        const allProducts: Product[] = allResponse.ok ? await allResponse.json() : []
        categoryProducts = (Array.isArray(allProducts) ? allProducts : []).filter((product: any) => {
          const own = String(product?.category ?? "").trim().toLowerCase()
          const group = String(product?.groupName ?? "").trim().toLowerCase()
          return own === categoryKey || group === categoryKey || own === categoryData.id
        })
      }

      setProducts(categoryProducts)

      // Extract unique filter values from category products only
      const uniqueTypes = Array.from(
        new Set(categoryProducts.map((p: any) => getProductType(p)).filter(Boolean))
      )
      setTypes(uniqueTypes)

      const uniqueBrands = Array.from(
        new Set(categoryProducts.map((p) => getProductBrand(p)).filter(Boolean))
      ) as string[]
      setBrands(uniqueBrands)

      const uniqueCharDescs = Array.from(
        new Set(categoryProducts.map((p: any) => getProductCharDesc(p)).filter(Boolean))
      )
      setCharDescs(uniqueCharDescs)

      // Set price range based on category products
      if (categoryProducts.length > 0) {
        const prices = categoryProducts.map((p) => p.price)
        setPriceRange([Math.min(...prices), Math.max(...prices)])
      }
    } catch (err) {
      console.error("Error fetching category data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Filter products based on search term and other filters
  const nonFacetMatches = products.filter((product: any) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(getProductType(product))

    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]

    const matchesBrand =
      selectedBrands.length === 0 ||
      selectedBrands.includes(getProductBrand(product))

    const matchesDescription =
      descriptionFilter === "" ||
      product.description.toLowerCase().includes(descriptionFilter.toLowerCase())

    const matchesCharDesc =
      selectedCharDesc.length === 0 ||
      selectedCharDesc.includes(getProductCharDesc(product))

    return (
      matchesSearch &&
      matchesType &&
      matchesPrice &&
      matchesBrand &&
      matchesDescription &&
      matchesCharDesc
    )
  })

  // Facets are built before the facet filter is applied, so selecting "55 inch"
  // doesn't make every other size disappear from the sidebar.
  const facets = buildFacets(nonFacetMatches)
  const filteredProducts = nonFacetMatches.filter((product: any) =>
    matchesFacets(product, facetSelection),
  )

  const sortedProducts = sortProducts(filteredProducts, sortBy)

  // Filter toggle functions
  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const toggleCharDesc = (charDesc: string) => {
    setSelectedCharDesc((prev) =>
      prev.includes(charDesc) ? prev.filter((c) => c !== charDesc) : [...prev, charDesc]
    )
  }

  const toggleFacet = (key: string, value: string) => {
    setFacetSelection((prev) => toggleFacetValue(prev, key, value))
  }

  const clearFilters = () => {
    setSelectedTypes([])
    setSelectedBrands([])
    setSelectedCharDesc([])
    setFacetSelection({})
    setPriceRange([0, 200000])
    setSearchTerm("")
    setDescriptionFilter("")
  }

  // Pagination and utility functions
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedTypes, selectedBrands, selectedCharDesc, priceRange, descriptionFilter, facetSelection])

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProducts = sortedProducts.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  type FilterKeys = 'types' | 'brands' | 'price' | 'charDesc';

  const toggleFilter = (filterName: FilterKeys) => {
    setOpenFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  // Navigate to product details
  const navigateToProduct = (productId: string) => {
    router.push(`/product/${productId}`)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow flex justify-center items-center" id="main-content">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800" role="status" aria-label="Loading"></div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow flex justify-center items-center" id="main-content">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Category Not Found</h1>
            <p className="text-gray-600 mb-6">{error || "The requested category could not be found."}</p>
            <Link href="/products">
              <button className="bg-blue-800 text-white px-6 py-2 rounded-lg hover:bg-blue-900 transition-colors">
                Browse All Products
              </button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* Category SEO: BreadcrumbList + ItemList JSON-LD (server-safe) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://bytewise.shop" },
              { "@type": "ListItem", position: 2, name: "Products", item: "https://bytewise.shop/products" },
              { "@type": "ListItem", position: 3, name: capitalizeFirstLetter(category?.name || "Category") },
            ],
          }),
        }}
      />
      {filteredProducts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: capitalizeFirstLetter(category?.name || "Products"),
              numberOfItems: filteredProducts.length,
              itemListElement: filteredProducts.slice(0, 50).map((p: any, idx: number) => ({
                "@type": "ListItem",
                position: idx + 1,
                url: `https://bytewise.shop/product/${p.id || p._id}`,
                name: p.name,
              })),
            }),
          }}
        />
      )}
      <main className="flex-grow" id="main-content">
        {/* Hero Banner with Category Info */}
        {/* <div className="bg-blue-800 text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-4">
              <button
                onClick={() => router.back()}
                className="flex items-center text-blue-100 hover:text-white mr-4 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back
              </button>
            </div>
            <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
            <p className="text-blue-100 max-w-2xl text-lg">
              {category.description || `Explore our ${category.name.toLowerCase()} collection.`}
            </p>
            <div className="mt-4 text-blue-200">
              <span className="text-sm">
                {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found
              </span>
            </div>
          </div>
        </div> */}

        {/* Category Image Banner */}
        {/* {category.image && (
          <div className="relative h-64 overflow-hidden">
            <img
              src={category.image || "/placeholder.svg"}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          </div>
        )} */}

        {/* Advertisement Carousel */}
        {/* <div className="container mx-auto px-4 py-8">
          <AdvertisementCarousel />
        </div> */}

        <HeroSection />
      

        <div className="container mx-auto px-4 py-8">
          <div className="flex gap-6">
            <aside
              className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-64 flex-shrink-0 slide-in-from-right`}
            >
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" />
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label="Close filters"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Scrollable Filters */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  {/* Search */}
                  <div className="relative">
                    <label htmlFor="category-search" className="block text-sm font-medium text-gray-700 mb-2">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="category-search"
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
                        className="p-1 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`${openFilters.price ? 'Collapse' : 'Expand'} price range filter`}
                        aria-expanded={openFilters.price}
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
                          <div className="flex-1">
                            <label htmlFor="min-price" className="text-xs text-gray-500">Min Price (₹)</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                              <input
                                id="min-price"
                                type="number"
                                value={priceRange[0]}
                                onChange={(e) => {
                                  const newMin = Math.min(Number(e.target.value), priceRange[1] - 1000);
                                  setPriceRange([newMin, priceRange[1]]);
                                }}
                                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded-md"
                                min={0}
                                max={priceRange[1] - 1000}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <label htmlFor="max-price" className="text-xs text-gray-500">Max Price (₹)</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                              <input
                                id="max-price"
                                type="number"
                                value={priceRange[1]}
                                onChange={(e) => {
                                  const newMax = Math.max(Number(e.target.value), priceRange[0] + 1000);
                                  setPriceRange([priceRange[0], newMax]);
                                }}
                                className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded-md"
                                min={priceRange[0] + 1000}
                                max={200000}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Types/Subcategories */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Sub Categories</h3>
                      <button
                        onClick={() => toggleFilter('types')}
                        className="p-1 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`${openFilters.types ? 'Collapse' : 'Expand'} sub-categories filter`}
                        aria-expanded={openFilters.types}
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
                              onChange={() => toggleType(type)}
                            />
                            <span>{capitalizeFirstLetter(type)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Brands */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Brands</h3>
                      <button
                        onClick={() => toggleFilter('brands')}
                        className="p-1 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`${openFilters.brands ? 'Collapse' : 'Expand'} brands filter`}
                        aria-expanded={openFilters.brands}
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
                              onChange={() => toggleBrand(brand)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{capitalizeFirstLetter(brand)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Spec facets, derived from the products in this result set */}
                  <SpecFacets facets={facets} selection={facetSelection} onToggle={toggleFacet} />

                  {/* Product Description */}
                  <div className="relative">
                    <label htmlFor="description-filter" className="block text-sm font-medium text-gray-700 mb-2">
                      Product Description
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="description-filter"
                        type="text"
                        placeholder="Filter by description..."
                        value={descriptionFilter}
                        onChange={(e) => setDescriptionFilter(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Character Description */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Character Description</h3>
                      <button
                        onClick={() => toggleFilter('charDesc')}
                        className="p-1 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`${openFilters.charDesc ? 'Collapse' : 'Expand'} character description filter`}
                        aria-expanded={openFilters.charDesc}
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
                              onChange={() => toggleCharDesc(charDesc)}
                            />
                            <span>{capitalizeFirstLetter(charDesc)}</span>
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

            <div className="flex-1">
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden mb-4 flex justify-between items-center">
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Show Filters
                </button>
                <Link href="/cart">
                  <button className="flex items-center px-4 py-2 bg-blue-800 text-white rounded-md hover:bg-blue-900 transition-colors">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    <span>Cart ({cart.length})</span>
                  </button>
                </Link>
              </div>

              {/* Results Header */}
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{capitalizeFirstLetter(category?.name || "Category")}</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredProducts.length)} of{" "}
                    {filteredProducts.length} products
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="hidden text-gray-600 sm:inline">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as ProductSortKey)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                      aria-label="Sort products"
                    >
                      {PRODUCT_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="hidden lg:block">
                    <Link href="/cart">
                      <button className="flex items-center px-4 py-2 bg-blue-800 text-white rounded-md hover:bg-blue-900 transition-colors">
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        <span>Cart ({cart.length})</span>
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Breadcrumb */}
              <nav className="flex mb-6 text-sm" aria-label="Breadcrumb">
                <Link href="/" className="text-blue-600 hover:text-blue-800">
                  Home
                </Link>
                <span className="mx-2 text-gray-500">/</span>
                <Link href="/products" className="text-blue-600 hover:text-blue-800">
                  Products
                </Link>
                <span className="mx-2 text-gray-500">/</span>
                <span className="text-gray-700">{capitalizeFirstLetter(category?.name || "")}</span>
              </nav>

              {/* Active Filters */}
              {(selectedTypes.length > 0 || selectedBrands.length > 0 || selectedCharDesc.length > 0 || countActiveFacets(facetSelection) > 0) && (
                <div className="mb-4 flex flex-wrap gap-2">
                      {selectedTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {capitalizeFirstLetter(type)}
                      <button onClick={() => toggleType(type)} className="hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-label={`Remove ${type} filter`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {selectedBrands.map((brand) => (
                    <span
                      key={brand}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {capitalizeFirstLetter(brand)}
                      <button onClick={() => toggleBrand(brand)} className="hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded" aria-label={`Remove ${brand} filter`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {selectedCharDesc.map((charDesc) => (
                    <span
                      key={charDesc}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                    >
                      {capitalizeFirstLetter(charDesc)}
                      <button onClick={() => toggleCharDesc(charDesc)} className="hover:text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded" aria-label={`Remove ${charDesc} filter`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {Object.entries(facetSelection).flatMap(([key, values]) =>
                    values.map((value) => (
                      <span
                        key={`${key}-${value}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                      >
                        {value}
                        <button onClick={() => toggleFacet(key, value)} className="hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded" aria-label={`Remove ${value} filter`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )),
                  )}
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
                <div className="text-center py-12">
                  <div className="mb-4">
                    <div className="w-24 h-24 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <Search className="h-12 w-12 text-gray-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {searchTerm || selectedTypes.length > 0 || selectedBrands.length > 0 || selectedCharDesc.length > 0 ? "No products found" : "No products in this category"}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm || selectedTypes.length > 0 || selectedBrands.length > 0 || selectedCharDesc.length > 0
                      ? `No products match your current filters in ${capitalizeFirstLetter(category?.name || '')}.`
                      : `There are currently no products in the ${capitalizeFirstLetter(category?.name || '')} category.`}
                  </p>
                  {(searchTerm || selectedTypes.length > 0 || selectedBrands.length > 0 || selectedCharDesc.length > 0) ? (
                    <button
                      onClick={clearFilters}
                      className="bg-blue-800 text-white px-6 py-2 rounded-lg hover:bg-blue-900 transition-colors mr-4"
                    >
                      Clear Filters
                    </button>
                  ) : null}
                  <Link href="/products">
                    <button className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                      Browse All Products
                    </button>
                  </Link>
                </div>
              )}

              {/* Pagination */}
              {filteredProducts.length > 0 && (
                <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* Items per page selector */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="items-per-page" className="text-sm text-gray-600">Show:</label>
                    <select
                      id="items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>

                  {/* Pagination buttons */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          currentPage === 1
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      {/* Page numbers */}
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNumber
                          if (totalPages <= 5) {
                            pageNumber = i + 1
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i
                          } else {
                            pageNumber = currentPage - 2 + i
                          }

                          return (
                            <button
                              key={pageNumber}
                              onClick={() => handlePageChange(pageNumber)}
                              aria-label={`Page ${pageNumber}`}
                              aria-current={currentPage === pageNumber ? "page" : undefined}
                              className={`px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                currentPage === pageNumber
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          currentPage === totalPages
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  {/* Page info */}
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}

              {/* Customer Reviews Section */}
              {/* {filteredProducts.length > 0 && (
                <div className="mt-16 mb-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-4">What Our Customers Say</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                      Read reviews from our satisfied customers about their shopping experience with us.
                    </p>
                  </div>
                  <ProductReviews />
                </div>
              )} */}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
