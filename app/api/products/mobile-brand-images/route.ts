import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"

const MOBILE_BRANDS = [
  "Apple", "Benco", "Cellcor", "Giva", "Google", "Infinix", "Itel", "Karbonn",
  "OnePlus", "OPPO", "POCO", "realme", "Redmi", "Samsung", "Tecno", "Villaon", "Vivo",
] as const

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export async function GET() {
  try {
    const products = await getCollection("products")
    const facets = Object.fromEntries(MOBILE_BRANDS.map((name, index) => {
      const exact = `^${escapeRegex(name)}$`
      const startsWith = `^${escapeRegex(name)}(?:\\s|[-:])`
      return [`brand${index}`, [
        {
          $match: {
            $or: [
              { manufacturerName: { $regex: exact, $options: "i" } },
              { manufacturer_name: { $regex: exact, $options: "i" } },
              { brand: { $regex: exact, $options: "i" } },
              { name: { $regex: startsWith, $options: "i" } },
            ],
          },
        },
        {
          $set: {
            displayImage: {
              $cond: [
                { $and: [{ $eq: [{ $type: "$image" }, "string"] }, { $ne: ["$image", ""] }] },
                "$image",
                { $arrayElemAt: [{ $ifNull: ["$images", []] }, 0] },
              ],
            },
          },
        },
        { $match: { displayImage: { $type: "string", $ne: "" } } },
        {
          $addFields: {
            phoneMatch: {
              $regexMatch: {
                input: {
                  $concat: [
                    { $ifNull: ["$division", ""] }, " ",
                    { $ifNull: ["$category", ""] }, " ",
                    { $ifNull: ["$subCategory", ""] }, " ",
                    { $ifNull: ["$segment", ""] }, " ",
                    { $ifNull: ["$name", ""] },
                  ],
                },
                regex: "mobile|smartphone|iphone|phone|handset",
                options: "i",
              },
            },
          },
        },
        { $sort: { phoneMatch: -1, stock: -1, _id: 1 } },
        { $limit: 1 },
        { $project: { _id: 0, image: "$displayImage" } },
      ]]
    }))

    const [result] = await products.aggregate([
      {
        $match: {
          ...PUBLIC_PRODUCT_FILTER,
        },
      },
      { $facet: facets },
    ]).toArray()

    return NextResponse.json({
      brands: MOBILE_BRANDS.map((name, index) => ({
        name,
        image: result?.[`brand${index}`]?.[0]?.image || null,
      })),
    })
  } catch (error) {
    return handleApiError(error, "Mobile brand images could not be loaded")
  }
}
