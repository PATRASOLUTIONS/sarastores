import { NextResponse } from "next/server"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"

// Extract unique sub-categories from products sub-category field
export async function GET() {
  try {
    if (process.env.NODE_ENV === "development") console.log("Extracting sub-categories from products...")

    // Fetch all products
    const products = await getAll(COLLECTIONS.PRODUCTS, {}, { limit: 0 })
    
    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        subCategories: [],
        message: "No products found in database",
      })
    }

    // Extract unique sub-category values
    const subCategorySet = new Set<string>()
    
    products.forEach((product: any) => {
      // Check sub-category field (can be subCategory or sub-category)
      const subCat = product.subCategory || product["sub-category"] || product.subcategory
      if (subCat && typeof subCat === 'string') {
        const trimmed = subCat.trim()
        if (trimmed) {
          subCategorySet.add(trimmed)
        }
      }
    })

    // Convert to array and sort
    const uniqueSubCategories = Array.from(subCategorySet).sort()

    if (process.env.NODE_ENV === "development") {
      console.log(`Found ${uniqueSubCategories.length} unique sub-categories from ${products.length} products`)
      console.log("Sample sub-categories:", uniqueSubCategories.slice(0, 5))
    }

    return NextResponse.json({
      success: true,
      subCategories: uniqueSubCategories,
      count: uniqueSubCategories.length,
      totalProducts: products.length,
    })
  } catch (error) {
    console.error("Error extracting sub-categories:", error)
    return NextResponse.json(
      {
        error: "Failed to extract sub-categories from products",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Import extracted sub-categories into sub_categories collection
export async function POST() {
  try {
    if (process.env.NODE_ENV === "development") console.log("Importing sub-categories from products...")

    // Fetch all products
    const products = await getAll(COLLECTIONS.PRODUCTS, {}, { limit: 0 })
    
    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No products found in database",
      }, { status: 400 })
    }

    // Extract unique sub-category values
    const subCategorySet = new Set<string>()
    
    products.forEach((product: any) => {
      // Check sub-category field (can be subCategory or sub-category)
      const subCat = product.subCategory || product["sub-category"] || product.subcategory
      if (subCat && typeof subCat === 'string') {
        const trimmed = subCat.trim()
        if (trimmed) {
          subCategorySet.add(trimmed)
        }
      }
    })

    const uniqueSubCategories = Array.from(subCategorySet).sort()

    // Get existing sub-categories to avoid duplicates
    const existingSubCategories = await getAll(COLLECTIONS.SUB_CATEGORIES)
    const existingNames = new Set(existingSubCategories.map((sub: any) => sub.name.toLowerCase()))

    // Create new sub-categories
    let createdCount = 0
    let skippedCount = 0

    for (const subCategoryName of uniqueSubCategories) {
      if (existingNames.has(subCategoryName.toLowerCase())) {
        skippedCount++
        continue
      }

      try {
        await create(COLLECTIONS.SUB_CATEGORIES, {
          name: subCategoryName,
          // Left blank on purpose: the UI derives a vector icon from the name
          // unless a real image URL is uploaded.
          image: "",
          active: true,
        })
        createdCount++
      } catch (error) {
        console.error(`Failed to create sub-category: ${subCategoryName}`, error)
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`Import complete: ${createdCount} created, ${skippedCount} skipped (already exist)`)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${createdCount} sub-categories`,
      created: createdCount,
      skipped: skippedCount,
      total: uniqueSubCategories.length,
    })
  } catch (error) {
    console.error("Error importing sub-categories:", error)
    return NextResponse.json(
      {
        error: "Failed to import sub-categories",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
