import { METADATA_TAXONOMY_SOURCE } from "@/lib/product-metadata-sheet"

/**
 * The first of `paths` that holds a non-blank string.
 *
 * `$ifNull` alone is not enough: it only skips a missing or null field, and an
 * imported product routinely carries `""` instead, which would short-circuit
 * the chain and hide a value a later field does have. Anything that is not a
 * string is treated as absent so a stray number cannot make `$trim` throw and
 * take the whole aggregation down.
 */
export function firstNonBlank(paths: string[]) {
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

/** Fields that name a product's maker, most trustworthy first. */
export const PRODUCT_BRAND_PATHS = [
  "$manufacturerName",
  "$manufacturer_name",
  "$brand",
  "$raw.Manufacturer Name",
  "$raw.Brand",
]

/** True when the product's `stock` reads as a number above zero. */
export const IN_STOCK_EXPRESSION = {
  $gt: [{ $convert: { input: "$stock", to: "double", onError: 0, onNull: 0 } }, 0],
}

/** Same uploaded-brand/legacy-warehouse policy as catalogueBrand, evaluated by MongoDB. */
export function catalogueBrandExpression() {
  const manufacturer = ["$manufacturerName", "$manufacturer_name", "$manufacturer", "$raw.Manufacturer Name", "$raw.Manufacturer"]
  const brand = ["$brand", "$raw.Brand"]
  return {
    $cond: [
      { $or: [
        { $eq: ["$taxonomySource", METADATA_TAXONOMY_SOURCE] },
        { $ne: [firstNonBlank(["$division", "$raw.Division"]), ""] },
      ] },
      firstNonBlank([...brand, ...manufacturer]),
      firstNonBlank([...manufacturer, ...brand]),
    ],
  }
}
