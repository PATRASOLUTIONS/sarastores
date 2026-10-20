import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { buildTaxonomyTree, type TaxonomyRow } from "@/lib/product-taxonomy"

/**
 * The first of `paths` that holds a non-blank string.
 *
 * `$ifNull` alone is not enough: it only skips a missing or null field, and an
 * imported product routinely carries `""` instead, which would short-circuit
 * the chain and hide a value a later field does have. Anything that is not a
 * string is treated as absent so a stray number cannot make `$trim` throw and
 * take the whole menu down.
 */
function firstNonBlank(paths: string[]) {
  return {
    $let: {
      vars: {
        candidates: {
          $filter: {
            input: paths.map(path => ({
              $cond: [{ $eq: [{ $type: path }, "string"] }, { $trim: { input: path } }, ""],
            })),
            cond: { $ne: ["$$this", ""] },
          },
        },
      },
      in: { $ifNull: [{ $first: "$$candidates" }, ""] },
    },
  }
}

/**
 * The Division → Sub-Category → Segment tree, derived from the live catalogue.
 *
 * Public and read-only: it drives the header mega-menu and the listing
 * sidebar, and it only ever reports classification labels and counts for
 * products that are already on sale.
 *
 * The division level reads `division` and nothing else. It is the spreadsheet's
 * own first column and the header tabs must show exactly the values it holds,
 * so the warehouse's older top-level fields are deliberately *not* substituted
 * here — doing that put "PANEL" and "SMALL APPLIANCE" in the site header, which
 * are stock-control words rather than aisles a shopper would recognise. A
 * product with no division is skipped; it has nowhere to appear until the bulk
 * sheet classifies it.
 *
 * The two levels below it do fall back, because their older fields hold the
 * same idea under a different name and a classified division would otherwise
 * open onto an empty panel.
 */
export async function GET() {
  try {
    const collection = await getCollection(COLLECTIONS.PRODUCTS)

    // One grouped pass instead of shipping the catalogue to Node. Deactivated
    // stock must not create an aisle that leads to an empty listing.
    const rows = (await collection
      .aggregate([
        { $match: { active: { $ne: false } } },
        {
          $group: {
            _id: {
              division: firstNonBlank(["$division"]),
              // Imported stock only ever had the warehouse's PROD DESC, so
              // read the same chain the listing page reads — otherwise a
              // division whose products were never re-saved opens onto an
              // empty panel.
              subCategory: firstNonBlank([
                "$subCategory",
                "$prod_desc",
                "$raw.sub-category/PROD DESC",
                "$raw.PROD DESC",
              ]),
              segment: firstNonBlank(["$segment", "$characteristics", "$char_desc", "$raw.CHAR DESC"]),
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            division: "$_id.division",
            subCategory: "$_id.subCategory",
            segment: "$_id.segment",
            count: 1,
          },
        },
        { $match: { division: { $ne: "" } } },
      ])
      .toArray()) as TaxonomyRow[]

    const divisions = buildTaxonomyTree(rows)

    return NextResponse.json(
      { divisions },
      {
        headers: {
          // Classification changes when an operator uploads a sheet, not per
          // request. Serving a slightly stale menu beats aggregating the
          // catalogue on every page view.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    )
  } catch (error) {
    return handleApiError(error, "Failed to build the product taxonomy")
  }
}
