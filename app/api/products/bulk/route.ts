import { NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId, createObjectId, COLLECTIONS } from "@/lib/db-service"
import { isAdmin } from "@/lib/auth"

const getCorsHeaders = (_req?: NextRequest) => {
  // Public catalogue lookup. No credentials are accepted, so a wildcard origin
  // is safe — reflecting the caller's origin alongside
  // `Allow-Credentials: true` would let any site read authenticated responses.
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

export async function POST(request: NextRequest) {
  try {
    // Safely parse JSON body — handle empty or invalid JSON gracefully
    let body: any = null
    try {
      // Read raw text first to detect empty bodies
      const raw = await request.text()
      if (!raw || raw.trim().length === 0) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400, headers: getCorsHeaders(request) })
      }
      body = JSON.parse(raw)
    } catch (parseErr) {
      console.error("/api/products/bulk parse error:", parseErr)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const ids = Array.isArray(body?.ids) ? body.ids : []
    // Deactivated products are not public. Only staff may opt into seeing them.
    const wantsInactive = body?.include_inactive === true || body?.include_inactive === 'true'
    const includeInactive = wantsInactive ? await isAdmin() : false
    const compareMode = body?.compare === true // For compare page, minimize response size
    if (ids.length === 0) return NextResponse.json([], { status: 200, headers: getCorsHeaders(request) })

    // Helper: fail-fast wrapper for promises that may hang (DB/network)
    const withTimeout = async <T>(p: Promise<T>, ms = 10000): Promise<T> => {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
      ])
    }

    const collection = await withTimeout(getCollection(COLLECTIONS.PRODUCTS), 10000)

    const orFilters: any[] = []
    for (const id of ids) {
      try {
        const objId = createObjectId(String(id))
        orFilters.push({ _id: objId })
      } catch (e) {
        // not an ObjectId, try string lookups below
      }
      orFilters.push({ _id: String(id) })
      orFilters.push({ id: String(id) })
    }

    const orQuery = orFilters.length === 1 ? orFilters[0] : { $or: orFilters }
    const finalQuery = includeInactive ? orQuery : { $and: [orQuery, { active: true }] }
    
    // For compare mode, project only essential fields to minimize response size and avoid 431 errors
    if (compareMode) {
      const docs = await withTimeout(
        collection
          .find(finalQuery)
          .project({
            _id: 1,
            id: 1,
            name: 1,
            sku: 1,
            SKU: 1,
            price: 1,
            mrp: 1,
            stock: 1,
            category: 1,
            manufacturerName: 1,
            description: 1,
            images: 1,
            technical_details: 1,
          })
          .toArray(),
        10000,
      )
      const normalized = normalizeId(docs)
      return NextResponse.json(normalized, { status: 200, headers: getCorsHeaders(request) })
    }

    const docs = await withTimeout(collection.find(finalQuery).toArray(), 10000)
    const normalized = normalizeId(docs)
    return NextResponse.json(normalized, { status: 200, headers: getCorsHeaders(request) })
  } catch (err) {
    console.error("/api/products/bulk error", err)
    const isTimeout = err && (err as Error).message === 'timeout'
    if (isTimeout) {
      return NextResponse.json({ error: "Request timed out while fetching products" }, { status: 504, headers: getCorsHeaders() })
    }
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500, headers: getCorsHeaders() })
  }
}

// Provide a friendly response for accidental GETs to this endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({ error: "Method GET not allowed. Use POST with JSON body { ids: [...] }" }, { status: 405, headers: getCorsHeaders(request) })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) })
}
