import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getCollection } from "@/lib/db-service"
import { extractCanonicalProductMetadata } from "@/lib/product-schema"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sheetId, preview } = body

        if (!sheetId) {
            return NextResponse.json({ error: "Sheet ID or URL is required" }, { status: 400 })
        }

        let url = ""
        // Handle full URLs
        if (sheetId.startsWith("http")) {
            if (sheetId.includes("/pub") || sheetId.includes("output=csv")) {
                // It's likely a published link
                url = sheetId
                if (!url.includes("output=csv")) {
                    // append output=csv if it's a pub link
                    url += url.includes("?") ? "&output=csv" : "?output=csv"
                }
            } else if (sheetId.includes("/spreadsheets/d/")) {
                // Extract ID from standard URL
                const matches = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/)
                if (matches && matches[1]) {
                    url = `https://docs.google.com/spreadsheets/d/${matches[1]}/export?format=csv`
                } else {
                    return NextResponse.json({ error: "Invalid Google Sheet URL format" }, { status: 400 })
                }
            } else {
                return NextResponse.json({ error: "Unknown Google Sheet URL format" }, { status: 400 })
            }
        } else {
            // Assume it's a raw ID
            // Heuristic: If it starts with 2PACX, it's a publish ID. Else, standard ID.
            // But we can't easily construct the pub URL from just the ID without the /e/ part usually. 
            // Safest is to try the standard export URL first.
            url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
        }

        console.log("Fetching Google Sheet from:", url)

        const sheetResponse = await fetch(url)

        if (!sheetResponse.ok) {
            if (sheetResponse.status === 404) {
                return NextResponse.json({ error: "Sheet not found. ensure 'Publish to web' is enabled and you are using the correct Link/ID." }, { status: 404 })
            }
            return NextResponse.json({ error: "Failed to fetch Google Sheet. Check permissions and ID." }, { status: sheetResponse.status })
        }

        const buffer = await sheetResponse.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet)

        if (!data || data.length === 0) {
            return NextResponse.json({ error: "Google Sheet is empty or could not be parsed" }, { status: 400 })
        }

        const collection = await getCollection("products")

        // ------------------------------------------------------------------
        // PREVIEW MODE
        // ------------------------------------------------------------------
        if (preview) {
            const updates: any[] = []
            const skusToFind = new Set<string>()
            const rowsBySku: Record<string, any> = {}

            // 1. Gather SKUs from sheet
            for (const row of data as any[]) {
                const itemno = extractCanonicalProductMetadata(row).itemno
                const price = row.price || row.Price || row.PRICE

                if (itemno) {
                    const skuStr = String(itemno).trim()
                    skusToFind.add(skuStr)
                    // Keep latest row for this SKU
                    rowsBySku[skuStr] = {
                        newPrice: price,
                        rawRequest: row
                    }
                }
            }

            // 2. Fetch existing products
            const products = await collection.find({ itemno: { $in: Array.from(skusToFind) } }).toArray()
            const productsBySku = new Map(products.map(p => [p.itemno || p.sku, p]))

            // 3. Build Preview Data
            for (const sku of Array.from(skusToFind)) {
                const rowData = rowsBySku[sku]
                const product = productsBySku.get(sku)

                let newPriceNum = 0
                let status = "pending"
                let errorReason = ""

                // Validate Price
                if (rowData.newPrice === undefined || rowData.newPrice === null || rowData.newPrice === "") {
                    status = "error"
                    errorReason = "Missing price"
                } else {
                    newPriceNum = typeof rowData.newPrice === "number" ? rowData.newPrice : parseFloat(String(rowData.newPrice).replace(/[₹,\s]/g, ""))
                    if (isNaN(newPriceNum)) {
                        status = "error"
                        errorReason = `Invalid price: ${rowData.newPrice}`
                    }
                }

                if (!product) {
                    status = "error"
                    errorReason = status === "error" ? errorReason + ", Product not found" : "Product not found"
                } else if (product.mrp !== undefined && product.mrp !== null && newPriceNum > product.mrp) {
                    status = "error"
                    errorReason = "Price > MRP"
                }

                updates.push({
                    sku,
                    name: product ? product.name : "Unknown Product",
                    mrp: product ? product.mrp : null,
                    oldPrice: product ? product.price : null,
                    newPrice: newPriceNum,
                    status: status === "error" ? "error" : "valid",
                    error: errorReason
                })
            }

            return NextResponse.json({ preview: true, updates })
        }

        // ------------------------------------------------------------------
        // UPDATE MODE (Execute)
        // ------------------------------------------------------------------
        let success = 0
        let failed = 0
        const errors: string[] = []

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i]
            const rowNum = i + 2 // 1-indexed + header

            try {
                // Get itemno and price from row
                const itemno = extractCanonicalProductMetadata(row).itemno
                const price = row.price || row.Price || row.PRICE

                if (!itemno) {
                    failed++
                    errors.push(`Row ${rowNum}: Missing itemno`)
                    continue
                }

                if (price === undefined || price === null || price === "") {
                    failed++
                    errors.push(`Row ${rowNum}: Missing price for itemno ${itemno}`)
                    continue
                }

                // Convert price to number
                const priceNum = typeof price === "number" ? price : parseFloat(String(price).replace(/[₹,\s]/g, ""))

                if (isNaN(priceNum)) {
                    failed++
                    errors.push(`Row ${rowNum}: Invalid price "${price}" for itemno ${itemno}`)
                    continue
                }

                // Update product by SKU (itemno)
                const result = await collection.findOneAndUpdate(
                    { itemno: String(itemno) },
                    {
                        $set: {
                            price: priceNum,
                            updatedAt: new Date()
                        }
                    },
                    { returnDocument: "after" }
                )

                if (!result) {
                    failed++
                    errors.push(`Row ${rowNum}: Product not found for itemno ${itemno}`)
                    continue
                }

                success++
            } catch (error) {
                failed++
                const errorMsg = error instanceof Error ? error.message : "Unknown error"
                errors.push(`Row ${rowNum}: ${errorMsg}`)
                console.error(`Error processing row ${rowNum}:`, error)
            }
        }

        console.log(`Google Sheet Sync completed: ${success} success, ${failed} failed`)

        return NextResponse.json({
            success,
            failed,
            errors,
            message: `Updated ${success} products, ${failed} failed`,
        })

    } catch (error) {
        console.error("Error in Google Sheet sync:", error)
        return NextResponse.json(
            {
                error: "Failed to process Google Sheet sync",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
