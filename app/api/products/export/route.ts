import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import * as XLSX from "xlsx";
import { normalizeProductForSchema } from "@/lib/product-schema";

export async function GET() {
  const { db } = await connectToDatabase();
  const [products, categories, subCategories] = await Promise.all([
    db.collection("products").find({}).toArray(),
    db.collection("categories").find({}).toArray(),
    db.collection("sub-categories").find({}).toArray()
  ]);

  // Build lookup maps
  const categoryMap = new Map();
  categories.forEach((cat: any) => {
    categoryMap.set(String(cat._id), cat.name);
    categoryMap.set(String(cat.id), cat.name);
  });

  const subCategoryMap = new Map();
  subCategories.forEach((sub: any) => {
    subCategoryMap.set(String(sub._id), sub.name);
    subCategoryMap.set(String(sub.id), sub.name);
  });

  const data: any[] = [];
  const seenSkus = new Set<string>();

  for (const product of products) {
    const raw = product.raw || {};
    const canonical = normalizeProductForSchema(product);

    // 1. Resolve canonical itemno
    let itemno = canonical.itemno || product.sku;

    // Validate SKU
    if (typeof itemno === 'string') itemno = itemno.trim();
    if (!itemno) continue; // Skip products without itemno

    const skuKey = String(itemno).toLowerCase();

    // Deduplication check
    if (seenSkus.has(skuKey)) continue;
    seenSkus.add(skuKey);

    // 2. Resolve MRP
    let mrp = product.mrp;
    if (mrp === undefined || mrp === null) {
      mrp = raw["MRP"] || raw["M.R.P"] || raw["Mrp"];
    }

    // 3. Prepare the row with the requested columns including Active/Inactive status
    const row: Record<string, any> = {
      "itemno": itemno,
      "Name": canonical.name || product.name || "",
      "Active/Inactive": product.active === false ? "Inactive" : "Active",
      "Description": canonical.description || product.description || "",
      "MRP": mrp ?? 0,
      "Selling Price/MOP": product.price ?? 0,
      "Category/Group Name": canonical.categoryGroupName || categoryMap.get(String(product.category)) || product.category || "",
      "sub-category/PROD DESC": canonical.subCategoryProdDesc || subCategoryMap.get(String(product.subCategory)) || product.subCategory || "",
      "CHAR DESC": canonical.charDesc || product.char_desc || "",
      "Manufacturer Name": canonical.manufacturerName || product.manufacturer_name || product.manufacturerName || "",
      // "Item Description": raw["Item Description"] || ""
    };

    data.push(row);
  }

  // Create worksheet and workbook
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");

  // Write workbook to buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // Return as Excel file
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products-export-${new Date().toISOString().slice(0, 19)}.xlsx"`
    }
  });
}

