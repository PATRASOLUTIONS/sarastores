import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import * as XLSX from "xlsx";
import { normalizeProductForSchema } from "@/lib/product-schema";

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const [specs, categories, subCategories] = await Promise.all([
            db.collection("product_specifications").find({}).toArray(),
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

        const data: any[] = specs.map((spec) => {
            const canonical = normalizeProductForSchema(spec);
            return {
                "Category/Group Name": canonical.categoryGroupName || categoryMap.get(String(spec.category)) || spec.group_name || spec.category || "",
                "sub-category/PROD DESC": canonical.subCategoryProdDesc || subCategoryMap.get(String(spec.subCategory)) || spec.prod_desc || spec.subCategory || "",
                "CHAR DESC": canonical.charDesc || spec.char_desc || "",
                "itemno": canonical.itemno || spec.sku || "",
                "Name": canonical.name || spec.name || ""
            };
        });

        // Create worksheet and workbook
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Specifications");

        // Write workbook to buffer
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        // Return as Excel file
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="specifications-export-${new Date().toISOString().slice(0, 19)}.xlsx"`
            }
        });
    } catch (error) {
        console.error("Error exporting specifications:", error);
        return NextResponse.json(
            { error: "Failed to export specifications", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
