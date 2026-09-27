import { type NextRequest, NextResponse } from "next/server"
import { getAll, create, COLLECTIONS, findOne, update } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { generateProductSlug } from "@/utils/slug"
import { isAdmin } from "@/lib/auth"

interface ProductFilter {
  category?: string
  featured?: boolean
  sku?: string
  $or?: Record<string, string>[]
  active?: boolean
}

interface ProductRecord {
  id?: string
  mrp?: number | string
  raw?: Record<string, unknown>
  slug?: string
  name?: string
  description?: string
  [key: string]: unknown
}

// Get all products
export async function GET(request: NextRequest) {
  try {
    try {
      await connectToDatabase()
    } catch (dbError) {
      console.error("[API Products GET] DB connection failed:", dbError)
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const featured = searchParams.get("featured")
    const limit = searchParams.get("limit")
    const sku = searchParams.get("sku")
    const charDesc = searchParams.get("char_desc")

    const filter: ProductFilter = {}
    // Deactivated products are not public. Only staff may opt into seeing them.
    const includeInactive = searchParams.get("include_inactive") === "true"
      ? await isAdmin()
      : false

    if (category && category !== "") {
      filter.category = category
    }

    if (featured === "true") {
      filter.featured = true
    }

    if (sku && sku !== "") {
      filter.sku = sku
    }

    if (charDesc && charDesc !== "") {
      filter.$or = [
        { "raw.CHAR DESC": charDesc },
        { "raw.CHARDESC": charDesc },
        { "raw.CHAR_DESC": charDesc }
      ]
    }

    if (!includeInactive) {
      filter.active = true
    }

    const limitNum = limit ? Number.parseInt(limit) : 0
    const options: { limit?: number; projection?: Record<string, 1> } = {}
    if (limitNum > 0) options.limit = limitNum

    // `fields=card` serves listing pages: every field a product card renders and
    // nothing else. Omitting `raw`, `description` and `technical_details` cuts the
    // payload by roughly an order of magnitude on a full-catalogue fetch.
    if (searchParams.get("fields") === "card") {
      options.projection = {
        slug: 1, name: 1, price: 1, mrp: 1, image: 1, stock: 1,
        category: 1, subCategory: 1, brand: 1,
        manufacturerName: 1, manufacturer_name: 1,
        rating: 1, reviews: 1, discount: 1, originalPrice: 1,
        sku: 1, active: 1, featured: 1, trusted: 1, specification_images: 1,
        // Nested keys keep the MRP fallback below working without the whole blob.
        "raw.MRP": 1, "raw.mrp": 1, "raw.M.R.P": 1,
      }
    }

    const products = await getAll(COLLECTIONS.PRODUCTS, filter, options)

    const productsWithMrp = (products || []).map((prod: ProductRecord) => {
      try {
        const p = { ...prod }
        if (p.mrp === undefined || p.mrp === null || p.mrp === "") {
          const raw = (p.raw || {}) as Record<string, string>
          const candidate = raw["MRP"] ?? raw["mrp"] ?? raw["M.R.P"] ?? raw["M R P"]
          if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
            const n = Number(String(candidate).replace(/[^0-9.-]+/g, ""))
            if (Number.isFinite(n)) p.mrp = n
          }
        }
        if (!p.slug && p.name) {
          p.slug = generateProductSlug(p.name)
        }
        return p
      } catch {
        return prod
      }
    })

    let filteredProducts = productsWithMrp
    if (search) {
      const searchLower = search.toLowerCase()
      filteredProducts = productsWithMrp.filter(
        (product: ProductRecord) =>
          product.name?.toLowerCase().includes(searchLower) ||
          (product.description && String(product.description).toLowerCase().includes(searchLower)),
      )
    }

    return NextResponse.json(filteredProducts, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error("[API Products GET] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to get products from database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Create a new product
export async function POST(request: NextRequest) {
  try {
    try {
      await connectToDatabase()
    } catch (dbError) {
      console.error("[API Products POST] Database connection failed:", dbError)
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: 500 },
      )
    }

    const url = new URL(request.url)
    const replace = url.searchParams.get("replace") === "true"

    const body = await request.json()
    const {
      name,
      description,
      price,
      stock,
      mrp,
      category,
      featured,
      image,
      images = [],
      sku,
      manufacturer,
      manufacturerName,
      color,
      subCategory,
      capacity,
      features,
      groupName,
      itemCategory,
      ean,
      active = true,
      source,
      raw,
    } = body

    if (!name || !description || price === undefined || stock === undefined) {
      console.error("[API Products POST] Validation failed - Missing required fields")
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 })
    }

    const normalizedImages: string[] = Array.isArray(images) ? images.filter(Boolean).slice(0, 5) : []
    if (normalizedImages.length === 0 && image) {
      normalizedImages.push(image)
    }

    const canonicalManufacturerName = manufacturerName || manufacturer || undefined

    const canonicalFromBody = extractCanonicalProductMetadata({
      itemno: sku,
      Name: name,
      Description: description,
      "Category/Group Name": groupName || category,
      "sub-category/PROD DESC": subCategory,
      "CHAR DESC": raw?.["CHAR DESC"] || raw?.["CHARDESC"] || body?.char_desc || features,
      "Manufacturer Name": canonicalManufacturerName,
      ...(raw || {}),
    })

    const syncedRaw = buildSchemaSynchronizedRaw(raw || {}, canonicalFromBody)

    const newProduct = {
      name,
      slug: generateProductSlug(name),
      description,
      price: Number.parseFloat(price),
      mrp: mrp !== undefined && mrp !== null ? Number.parseFloat(String(mrp)) : Number.parseFloat(price),
      image: normalizedImages[0] || "/placeholder.svg?height=300&width=300",
      images: normalizedImages,
      stock: Number.parseInt(String(stock)),
      category: category || "uncategorized",
      featured: !!featured,
      sku: canonicalFromBody.itemno || sku,
      itemno: canonicalFromBody.itemno || sku,
      manufacturerName: canonicalManufacturerName,
      manufacturer_name: canonicalManufacturerName,
      color,
      capacity,
      features,
      groupName: canonicalFromBody.categoryGroupName || groupName,
      itemCategory,
      ean,
      subCategory: canonicalFromBody.subCategoryProdDesc || subCategory,
      char_desc: canonicalFromBody.charDesc || undefined,
      active: !!active,
      source,
      raw: syncedRaw,
    }

    const canonicalSku = canonicalFromBody.itemno || sku
    if (canonicalSku) {
      const existing = await findOne(COLLECTIONS.PRODUCTS, { itemno: canonicalSku })

      if (existing && !replace) {
        return NextResponse.json(
          {
            error: "Duplicate SKU",
            message: "A product with this SKU already exists. Confirm replacement to overwrite the existing product.",
            duplicate: true,
            existingId: existing.id,
          },
          { status: 409 },
        )
      }

      if (existing && replace) {
        const updated = await update(COLLECTIONS.PRODUCTS, existing.id, newProduct)
        return NextResponse.json({ success: true, product: updated, replaced: true })
      }
    }

    const product = await create(COLLECTIONS.PRODUCTS, newProduct)
    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error("[API Products POST] Error creating product:", error)
    return NextResponse.json(
      {
        error: "Failed to create product in database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
