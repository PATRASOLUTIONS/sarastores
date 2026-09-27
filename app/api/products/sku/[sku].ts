import type { NextApiRequest, NextApiResponse } from "next"
import { connectToDatabase } from "@/lib/mongodb"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sku } = req.query

  if (typeof sku !== "string") {
    return res.status(400).json({ error: "Invalid SKU" })
  }

  if (req.method === "GET") {
    try {
      const { db } = await connectToDatabase()
      const productsCollection = db.collection("products")
      
      // Find product by SKU
      const product = await productsCollection.findOne({ sku: sku })
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" })
      }
      
      return res.status(200).json(product)
    } catch (error) {
      console.error("Error fetching product by SKU:", error)
      return res.status(500).json({ error: "Failed to fetch product" })
    }
  } else {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}