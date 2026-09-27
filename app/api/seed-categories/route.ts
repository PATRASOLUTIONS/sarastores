import { NextResponse } from "next/server"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"
import { checkAdminAuthorization } from "@/lib/auth"

// Sample categories data
const sampleCategories = [
  {
    name: "Electronics",
    image: "/placeholder.svg?height=400&width=400&text=Electronics",
    description: "Latest gadgets and electronic devices for your tech needs",
  },
  {
    name: "Clothing",
    image: "/placeholder.svg?height=400&width=400&text=Clothing",
    description: "Trendy fashion items for all seasons and occasions",
  },
  {
    name: "Home & Kitchen",
    image: "/placeholder.svg?height=400&width=400&text=Home+%26+Kitchen",
    description: "Everything you need to make your house a home",
  },
  {
    name: "Beauty",
    image: "/placeholder.svg?height=400&width=400&text=Beauty",
    description: "Premium beauty and personal care products",
  },
  {
    name: "Sports",
    image: "/placeholder.svg?height=400&width=400&text=Sports",
    description: "Equipment and apparel for all your sporting activities",
  },
  {
    name: "Books",
    image: "/placeholder.svg?height=400&width=400&text=Books",
    description: "Discover your next favorite read from our collection",
  },
]

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if categories already exist
    const existingCategories = await getAll(COLLECTIONS.CATEGORIES)

    if (Array.isArray(existingCategories) && existingCategories.length > 0) {
      return NextResponse.json({
        message: "Categories already exist",
        count: existingCategories.length,
        categories: existingCategories,
      })
    }

    // If no categories exist, create them
    const createdCategories = []

    for (const category of sampleCategories) {
      const result = await create(COLLECTIONS.CATEGORIES, category)
      if (result) {
        createdCategories.push(result)
      }
    }

    return NextResponse.json({
      message: "Categories seeded successfully",
      count: createdCategories.length,
      categories: createdCategories,
    })
  } catch (error) {
    console.error("Error seeding categories:", error)
    return NextResponse.json({ error: "Failed to seed categories" }, { status: 500 })
  }
}
