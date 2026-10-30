import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import type { Document } from "mongodb"
import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { normalizeProductForSchema } from "@/lib/product-schema"
import { stockCodeKey, stockItemAliases, stockItemCode, type StockCatalogueProduct } from "@/lib/stock-item-code"
import { STORE_STOCK_COLLECTION, type StoreStockRow } from "@/lib/store-stock"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"

export const maxDuration = 300

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const [products, stock] = await Promise.all([
      (await getCollection<StockCatalogueProduct & Document>(COLLECTIONS.PRODUCTS)).find({}, { projection: {
        sku: 1, itemno: 1, itemNo: 1, name: 1, division: 1, segment: 1, brand: 1,
        price: 1, mrp: 1, stock: 1, active: 1, raw: 1,
      } }).toArray(),
      (await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)).find({}, {
        projection: { sku: 1, storeCode: 1, quantity: 1 },
      }).sort({ sku: 1, storeCode: 1 }).toArray(),
    ])
    const itemNumbers = new Map<string, string>()
    const aliasNumbers = new Map<string, Set<string>>()
    const data = products.map(product => {
      const canonical = normalizeProductForSchema(product)
      const itemno = stockItemAliases({ ...product, sku: undefined })[0] || canonical.itemno
      const stockCode = stockItemCode(product)
      if (stockCode && itemno) {
        const key = stockCodeKey(stockCode)
        if (itemNumbers.has(key) && itemNumbers.get(key) !== itemno) throw new Error(`Stock SKU ${stockCode} belongs to multiple item numbers; correct the catalogue before exporting`)
        itemNumbers.set(key, itemno)
      }
      if (itemno) for (const alias of stockItemAliases(product)) {
        const key = stockCodeKey(alias)
        const numbers = aliasNumbers.get(key) ?? new Set<string>()
        numbers.add(itemno)
        aliasNumbers.set(key, numbers)
      }
      return {
        itemno,
        name: canonical.name,
        division: canonical.division,
        segment: canonical.segment,
        brand: canonical.brandName,
        price: product.price ?? 0,
        mrp: product.mrp ?? product.raw?.MRP ?? product.raw?.["M.R.P"] ?? product.raw?.Mrp ?? 0,
        "overall stock": product.stock ?? 0,
        status: product.active === false ? "Inactive" : "Active",
      }
    })
    const storeData = stock.flatMap(row => {
      const key = stockCodeKey(row.sku)
      const aliases = aliasNumbers.get(key)
      const itemno = itemNumbers.get(key) ?? (aliases?.size === 1 ? [...aliases][0] : undefined)
      return itemno ? [{ itemno, stock: row.quantity, storecode: row.storeCode }] : []
    })
    const summary = XLSX.utils.json_to_sheet(data, {
      header: ["itemno", "name", "division", "segment", "brand", "price", "mrp", "overall stock", "status"],
    })
    const stores = XLSX.utils.json_to_sheet(storeData, { header: ["itemno", "stock", "storecode"] })
    summary["!cols"] = [22, 50, 22, 22, 22, 14, 14, 18, 14].map(wch => ({ wch }))
    stores["!cols"] = [22, 14, 18].map(wch => ({ wch }))
    summary["!autofilter"] = { ref: summary["!ref"]! }
    stores["!autofilter"] = { ref: stores["!ref"]! }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summary, "Products")
    XLSX.utils.book_append_sheet(workbook, stores, "Store Stock")
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="products-export-${timestamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleApiError(error, "Failed to export products")
  }
}
