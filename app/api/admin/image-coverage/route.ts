import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { auditProductImages, summariseImageCoverage } from "@/lib/product-images"

/**
 * Image-standard coverage report for merchandising.
 *
 * Answers "which products are not launch-ready?" so the catalogue team has a
 * worklist instead of a vague instruction.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const params = request.nextUrl.searchParams
    const limit = Math.min(Number(params.get("limit")) || 100, 500)
    const onlyNonCompliant = params.get("nonCompliant") !== "false"

    const collection = await getCollection("products")
    const docs = await collection
      .find(
        { active: true },
        {
          projection: {
            name: 1,
            sku: 1,
            slug: 1,
            category: 1,
            image: 1,
            images: 1,
            specification_images: 1,
            imageRoles: 1,
            video: 1,
            videos: 1,
          },
        },
      )
      .toArray()

    const products = normalizeId(docs)
    const summary = summariseImageCoverage(products)

    const audited = products
      .map((product: any) => ({
        id: product.id,
        sku: product.sku || null,
        slug: product.slug || null,
        name: product.name || "",
        category: product.category || null,
        ...auditProductImages(product),
      }))
      .filter((entry: any) => (onlyNonCompliant ? !entry.compliant : true))
      // Worst first, so the worklist is already prioritised.
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, limit)

    return NextResponse.json({ success: true, summary, products: audited })
  } catch (error) {
    return handleApiError(error, "Failed to build the image coverage report")
  }
}
