// Database seeding script for MongoDB
const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Refusing to run.")
  process.exit(1)
}

const sampleProducts = [
  {
    name: "iPhone 15 Pro",
    description: "Latest iPhone with A17 Pro chip and titanium design",
    price: 134900,
    image: "/placeholder.svg?height=300&width=300",
    stock: 50,
    category: "electronics",
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    description: "Premium Android smartphone with S Pen",
    price: 129999,
    image: "/placeholder.svg?height=300&width=300",
    stock: 30,
    category: "electronics",
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "MacBook Air M3",
    description: "Lightweight laptop with M3 chip",
    price: 114900,
    image: "/placeholder.svg?height=300&width=300",
    stock: 25,
    category: "electronics",
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Sony WH-1000XM5",
    description: "Premium noise-canceling headphones",
    price: 29990,
    image: "/placeholder.svg?height=300&width=300",
    stock: 100,
    category: "electronics",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Nike Air Max 270",
    description: "Comfortable running shoes",
    price: 12995,
    image: "/placeholder.svg?height=300&width=300",
    stock: 75,
    category: "clothing",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const sampleCategories = [
  {
    name: "Electronics",
    description: "Latest gadgets and electronic devices",
    image: "/placeholder.svg?height=200&width=200",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Clothing",
    description: "Fashion and apparel for all occasions",
    image: "/placeholder.svg?height=200&width=200",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Home & Kitchen",
    description: "Everything for your home and kitchen needs",
    image: "/placeholder.svg?height=200&width=200",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Books",
    description: "Books for learning and entertainment",
    image: "/placeholder.svg?height=200&width=200",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

async function seedDatabase() {
  let client

  try {
    if (process.env.NODE_ENV === "development") console.log("Connecting to MongoDB...")
    client = new MongoClient(MONGODB_URI)
    await client.connect()

    const db = client.db("ecommerce")

    // Clear existing data
    if (process.env.NODE_ENV === "development") console.log("Clearing existing data...")
    await db.collection("products").deleteMany({})
    await db.collection("categories").deleteMany({})

    // Insert sample products
    if (process.env.NODE_ENV === "development") console.log("Inserting sample products...")
    const productResult = await db.collection("products").insertMany(sampleProducts)
    if (process.env.NODE_ENV === "development") console.log(`Inserted ${productResult.insertedCount} products`)

    // Insert sample categories
    if (process.env.NODE_ENV === "development") console.log("Inserting sample categories...")
    const categoryResult = await db.collection("categories").insertMany(sampleCategories)
    if (process.env.NODE_ENV === "development") console.log(`Inserted ${categoryResult.insertedCount} categories`)

    // Create indexes
    if (process.env.NODE_ENV === "development") console.log("Creating indexes...")
    await db.collection("products").createIndex({ name: "text", description: "text" })
    await db.collection("products").createIndex({ category: 1 })
    await db.collection("products").createIndex({ featured: 1 })
    await db.collection("users").createIndex({ email: 1 }, { unique: true })
    await db.collection("orders").createIndex({ userId: 1 })
    await db.collection("orders").createIndex({ createdAt: -1 })

    if (process.env.NODE_ENV === "development") console.log("Database seeded successfully!")
  } catch (error) {
    console.error("Error seeding database:", error)
  } finally {
    if (client) {
      await client.close()
    }
  }
}

seedDatabase()
