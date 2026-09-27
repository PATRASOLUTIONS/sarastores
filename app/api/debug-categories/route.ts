import { NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    // Try to get categories from the database
    const categories = await dbService.getAll(COLLECTIONS.CATEGORIES)

    // If we got here, the database connection is working
    return NextResponse.json({
      success: true,
      message: "Categories API is working",
      categories: categories,
      count: categories.length,
      source: "database",
    })
  } catch (dbError) {
    console.error("Database error:", dbError)

    // Try to get categories from localStorage as fallback
    try {
      if (typeof window !== "undefined") {
        const storedCategories = localStorage.getItem("categories")
        if (storedCategories) {
          const parsedCategories = JSON.parse(storedCategories)
          return NextResponse.json({
            success: true,
            message: "Categories API is using localStorage fallback",
            categories: parsedCategories,
            count: parsedCategories.length,
            source: "localStorage",
          })
        }
      }

      // If we got here, both database and localStorage failed
      return NextResponse.json(
        {
          success: false,
          message: "Failed to get categories from both database and localStorage",
          error: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 },
      )
    } catch (localStorageError) {
      // Both database and localStorage failed
      return NextResponse.json(
        {
          success: false,
          message: "Failed to get categories",
          dbError: dbError instanceof Error ? dbError.message : String(dbError),
          localStorageError: localStorageError instanceof Error ? localStorageError.message : String(localStorageError),
        },
        { status: 500 },
      )
    }
  }
}
