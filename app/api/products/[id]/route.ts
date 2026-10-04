import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { COLLECTIONS } from "@/lib/db-service"
import { ObjectId, type Document } from "mongodb"
import { handleApiError } from "@/lib/api-error"
import { isAdmin } from "@/lib/auth"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { withProductDisplay } from "@/lib/product-presenter"
import { generateProductSlug } from "@/utils/slug"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const fieldsParam = url.searchParams.get('fields')
    const includeInactive = url.searchParams.get('include_inactive') === 'true'
      ? await isAdmin()
      : false
    let fields: string[] | null = null
    if (fieldsParam) {
      fields = fieldsParam.split(',').map(f => f.trim()).filter(Boolean)
    }

    // If fields are specified, build a projection for MongoDB
    let projection: any = undefined
    if (fields && fields.length > 0) {
      projection = {}
      for (const f of fields) projection[f] = 1
      // Always include _id for normalization
      projection._id = 1
    }

    // Use a custom getByIdWithProjection if projection is needed
    let product: any
    if (projection) {
      const collection = await dbService.getCollection<Document & {
        _id: ObjectId | string
      }>(COLLECTIONS.PRODUCTS)
      // Try slug first, then ObjectId, then string _id, then id field
      let doc = null
      doc = await collection.findOne({ slug: id }, { projection })
      if (!doc) try { doc = await collection.findOne({ _id: new ObjectId(id) }, { projection }) } catch { /* not a valid ObjectId — fall through to string _id lookup */ }
      if (!doc) doc = await collection.findOne({ _id: id }, { projection })
      if (!doc) doc = await collection.findOne({ id: id }, { projection })
      product = dbService.normalizeId(doc)
    } else {
      // Try slug first, then fall back to getById (ObjectId/string _id/id)
      const collection = await dbService.getCollection(COLLECTIONS.PRODUCTS)
      let doc = await collection.findOne({ slug: id })
      if (!doc) {
        product = await dbService.getById(COLLECTIONS.PRODUCTS, id)
      } else {
        product = dbService.normalizeId(doc)
      }
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // If the product is inactive, hide it from public consumers unless explicitly requested
    if (!includeInactive && product.active === false) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    let normalizedBase: any
    if (product._id) {
      const { _id, ...rest } = product as any
      normalizedBase = { id: _id.toString?.() ?? String(_id), ...rest }
    } else {
      normalizedBase = { ...product }
      if (!normalizedBase.id && normalizedBase._id) {
        normalizedBase.id = String(normalizedBase._id)
        delete normalizedBase._id
      }
    }

    // Only build images/image if not a minimal fetch
    let images = []
    let image = undefined
    if (!fields || fields.includes('images') || fields.includes('image')) {
      images = Array.isArray(normalizedBase.images)
        ? normalizedBase.images.filter(Boolean).slice(0, 5)
        : normalizedBase.image
          ? [normalizedBase.image]
          : []
      image = images[0] || normalizedBase.image
    }

    const normalized = { ...normalizedBase }
    if (!fields || fields.includes('images')) normalized.images = images
    if (!fields || fields.includes('image')) normalized.image = image
    // Ensure slug exists — generate from name if missing
    if (!normalized.slug && normalized.name) {
      normalized.slug = generateProductSlug(normalized.name)
    }

    if (url.searchParams.get("display") === "1") {
      return NextResponse.json(withProductDisplay(normalized))
    }

    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const data = await request.json()
    const updateFields: any = { ...data, updatedAt: new Date() }

    // Regenerate slug if name changes
    if (data.name) {
      updateFields.slug = generateProductSlug(data.name)
    }

    const canonical = extractCanonicalProductMetadata({
      ...(updateFields.raw || {}),
      itemno: updateFields.sku,
      Name: updateFields.name,
      Description: updateFields.description,
      "Category/Group Name": updateFields.groupName || updateFields.category,
      "sub-category/PROD DESC": updateFields.subCategory || updateFields.prod_desc,
      "CHAR DESC": updateFields.char_desc || updateFields.characteristics,
      "Manufacturer Name": updateFields.manufacturerName || updateFields.manufacturer_name,
    })

    if (canonical.itemno) updateFields.sku = canonical.itemno
    if (canonical.subCategoryProdDesc) {
      updateFields.subCategory = canonical.subCategoryProdDesc
      updateFields.prod_desc = canonical.subCategoryProdDesc
    }
    if (canonical.charDesc) {
      updateFields.char_desc = canonical.charDesc
      updateFields.characteristics = canonical.charDesc
    }
    if (canonical.categoryGroupName) {
      updateFields.groupName = canonical.categoryGroupName
    }
    if (canonical.manufacturerName) {
      updateFields.manufacturerName = canonical.manufacturerName
      updateFields.manufacturer_name = canonical.manufacturerName
    }
    updateFields.raw = buildSchemaSynchronizedRaw(updateFields.raw || {}, canonical)

    // Normalize MRP if provided
    if (updateFields.mrp !== undefined && updateFields.mrp !== null) {
      const mrpNum = Number(updateFields.mrp)
      updateFields.mrp = Number.isFinite(mrpNum) ? mrpNum : 0
    }

    // Normalize images if provided
    if (Array.isArray(updateFields.images)) {
      updateFields.images = updateFields.images.filter(Boolean).slice(0, 5)
      updateFields.image = updateFields.images[0] || updateFields.image
    } else if (updateFields.image && !updateFields.images) {
      updateFields.images = [updateFields.image]
    }

    const collection = await dbService.getCollection(COLLECTIONS.PRODUCTS)

    // Try slug first, then ObjectId, then string _id
    const filterCandidates: any[] = [{ slug: id }]
    try {
      filterCandidates.push({ _id: new ObjectId(id) })
    } catch { /* not a valid ObjectId — skip this filter candidate */ }
    filterCandidates.push({ _id: id })

    let matched = 0
    let matchedFilter: any = null
    for (const f of filterCandidates) {
      const res = await collection.updateOne(f, { $set: updateFields })
      matched += res.matchedCount
      if (res.matchedCount > 0) { matchedFilter = f; break }
    }

    if (matched === 0) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // Return updated doc
    const updated = await collection.findOne(matchedFilter)
    if (!updated) return NextResponse.json({ error: 'Failed to fetch updated product' }, { status: 500 })

    const { _id, ...rest } = updated as any
    const respImages = Array.isArray(rest.images) ? rest.images.filter(Boolean).slice(0, 5) : rest.image ? [rest.image] : []
    const respImage = respImages[0] || rest.image || null
    const normalizedProduct = { id: _id?.toString?.() ?? String(_id), ...rest, images: respImages, image: respImage }

    return NextResponse.json(normalizedProduct)
  } catch (err) {
    console.error('Error in PATCH /api/products/[id]:', err)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    if (process.env.NODE_ENV === "development") console.log("PUT request received for product ID:", id)

    // Parse the request body
    const data = await request.json()
    if (process.env.NODE_ENV === "development") console.log("Request data:", data)

    // Regenerate slug if name changes
    if (data.name) {
      data.slug = generateProductSlug(data.name)
    }

    const canonical = extractCanonicalProductMetadata({
      ...(data.raw || {}),
      itemno: data.sku,
      Name: data.name,
      Description: data.description,
      "Category/Group Name": data.groupName || data.category,
      "sub-category/PROD DESC": data.subCategory || data.prod_desc,
      "CHAR DESC": data.char_desc || data.characteristics,
      "Manufacturer Name": data.manufacturerName || data.manufacturer_name,
    })

    if (canonical.itemno) data.sku = canonical.itemno
    if (canonical.subCategoryProdDesc) {
      data.subCategory = canonical.subCategoryProdDesc
      data.prod_desc = canonical.subCategoryProdDesc
    }
    if (canonical.charDesc) {
      data.char_desc = canonical.charDesc
      data.characteristics = canonical.charDesc
    }
    if (canonical.categoryGroupName) {
      data.groupName = canonical.categoryGroupName
    }
    if (canonical.manufacturerName) {
      data.manufacturerName = canonical.manufacturerName
      data.manufacturer_name = canonical.manufacturerName
    }
    data.raw = buildSchemaSynchronizedRaw(data.raw || {}, canonical)

    // Normalize images on input
    if (Array.isArray(data.images) && data.images.length > 0) {
      data.images = data.images.filter(Boolean).slice(0, 5)
      data.image = data.images[0] || data.image
    } else if (data.image) {
      data.images = [data.image]
    } else {
      data.images = []
    }

    // Normalize MRP if provided in the put payload
    if (data.mrp !== undefined && data.mrp !== null) {
      const mrpNum = Number(data.mrp)
      data.mrp = Number.isFinite(mrpNum) ? mrpNum : 0
    }

    // Use dbService.getCollection to ensure we connect to the correct database ("e-commerce-bytewise")
    const collection = await dbService.getCollection(COLLECTIONS.PRODUCTS)

    // Try slug first, then ObjectId, then string _id
    const candidateFilters: any[] = [{ slug: id }]
    let asObjectId: ObjectId | null = null
    try {
      asObjectId = new ObjectId(id)
      candidateFilters.push({ _id: asObjectId })
    } catch {
      asObjectId = null
    }
    candidateFilters.push({ _id: id }) // handle string _id

    let matched = 0
    let matchedFilter: any = null
    for (const filter of candidateFilters) {
      const res = await collection.updateOne(filter, { $set: { ...data, updatedAt: new Date() } })
      matched += res.matchedCount
      if (res.matchedCount > 0) { matchedFilter = filter; break }
    }

    if (matched === 0) {
      // Still no match: return 404
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Fetch updated document using the filter that matched
    const updated = await collection.findOne(matchedFilter)
    if (!updated) {
      return NextResponse.json({ error: "Failed to retrieve updated product" }, { status: 500 })
    }

    // Normalize response: ensure images[0] is the primary image
    const { _id, ...rest } = updated as any
    const respImages = Array.isArray(rest.images)
      ? rest.images.filter(Boolean).slice(0, 5)
      : rest.image
        ? [rest.image]
        : []
    const respImage = respImages[0] || rest.image || null
    const normalizedProduct = { id: _id?.toString?.() ?? String(_id), ...rest, images: respImages, image: respImage }

    return NextResponse.json(normalizedProduct)
  } catch (error) {
    console.error("Error updating product:", error)
    return handleApiError(error, "Failed to update product")
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    // Try slug first, then fall back to remove by id
    const collection = await dbService.getCollection(COLLECTIONS.PRODUCTS)
    let doc = await collection.findOne({ slug: id })
    if (doc) {
      await collection.deleteOne({ slug: id })
    } else {
      await dbService.remove(COLLECTIONS.PRODUCTS, id)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
