/**
 * The merchandising hierarchy: Division → Sub-Category → Segment.
 *
 * "Accessories" → "Mobile Accessories" → "Chargers & Adapters". The header
 * mega-menu renders division as the tab, sub-category as the column heading
 * and segment as the link underneath; the listing sidebar filters on the same
 * three fields.
 *
 * The tree is derived from the products themselves rather than stored as its
 * own collection, so classifying a product through the bulk upload or the
 * admin form is all it takes for the menu to follow. The cost is that the tree
 * has to be aggregated and cached — see app/api/taxonomy/route.ts.
 */

export interface TaxonomyRow {
  division?: string | null
  subCategory?: string | null
  segment?: string | null
  count?: number | null
}

export interface TaxonomySegment {
  name: string
  count: number
}

export interface TaxonomySubCategory {
  name: string
  count: number
  segments: TaxonomySegment[]
}

export interface TaxonomyDivision {
  name: string
  count: number
  subCategories: TaxonomySubCategory[]
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/**
 * Labels that stand for "not classified" rather than naming an aisle.
 *
 * A product filed under one of these has to be skipped at the division level,
 * because a tab reading "Uncategorized" in the site header is worse than the
 * product simply not appearing in the menu until somebody classifies it.
 */
const NON_AISLE = /^(uncategori[sz]ed|unclassified|none|n\/?a|other|others|misc(ellaneous)?|test\d*)$/i

/**
 * Fold rows into the tree.
 *
 * Labels are grouped case- and whitespace-insensitively because the values
 * arrive from spreadsheets typed by hand, where "Mobile Accessories" and
 * "mobile accessories" are the same aisle. The first spelling encountered wins
 * as the display label, and rows missing a level are skipped at that level
 * rather than inventing an "Other" bucket that would appear in the menu.
 */
export function buildTaxonomyTree(rows: TaxonomyRow[]): TaxonomyDivision[] {
  interface DivisionAcc {
    name: string
    count: number
    subCategories: Map<string, { name: string; count: number; segments: Map<string, TaxonomySegment> }>
  }

  const divisions = new Map<string, DivisionAcc>()

  for (const row of rows) {
    const divisionName = clean(row.division)
    if (!divisionName || NON_AISLE.test(divisionName)) continue

    const count = typeof row.count === "number" && Number.isFinite(row.count) ? row.count : 0
    const divisionKey = divisionName.toLowerCase()

    let division = divisions.get(divisionKey)
    if (!division) {
      division = { name: divisionName, count: 0, subCategories: new Map() }
      divisions.set(divisionKey, division)
    }
    division.count += count

    const subCategoryName = clean(row.subCategory)
    if (!subCategoryName) continue
    const subCategoryKey = subCategoryName.toLowerCase()

    let subCategory = division.subCategories.get(subCategoryKey)
    if (!subCategory) {
      subCategory = { name: subCategoryName, count: 0, segments: new Map() }
      division.subCategories.set(subCategoryKey, subCategory)
    }
    subCategory.count += count

    const segmentName = clean(row.segment)
    if (!segmentName) continue
    const segmentKey = segmentName.toLowerCase()

    const segment = subCategory.segments.get(segmentKey)
    if (segment) segment.count += count
    else subCategory.segments.set(segmentKey, { name: segmentName, count })
  }

  // Busiest first at every level, so the menu leads with what sells.
  const byCount = <T extends { count: number; name: string }>(a: T, b: T) =>
    b.count - a.count || a.name.localeCompare(b.name)

  return [...divisions.values()]
    .map(division => ({
      name: division.name,
      count: division.count,
      subCategories: [...division.subCategories.values()]
        .map(subCategory => ({
          name: subCategory.name,
          count: subCategory.count,
          segments: [...subCategory.segments.values()].sort(byCount),
        }))
        .sort(byCount),
    }))
    .sort(byCount)
}

/**
 * Coerce an untrusted /api/taxonomy payload into the tree.
 *
 * The menu renders in the site header, so a response in an unexpected shape
 * must not be able to throw — reading `.subCategories` off a payload that did
 * not have it took down every page on the site, the homepage included. A CDN
 * or browser cache can hold a response for up to an hour after a deploy, which
 * is exactly how a shape change reaches a browser running the new component.
 *
 * `categories` is accepted as the middle level for that reason: it is what
 * this endpoint called a sub-category before, so a cached response still
 * renders a usable menu instead of an empty one. Anything unrecognisable is
 * dropped rather than rendered as a blank row.
 */
export function normalizeTaxonomyDivisions(value: unknown): TaxonomyDivision[] {
  const asRecord = (entry: unknown): Record<string, unknown> =>
    entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}

  const asCount = (entry: unknown): number =>
    typeof entry === "number" && Number.isFinite(entry) ? entry : 0

  const asList = (entry: unknown): unknown[] => (Array.isArray(entry) ? entry : [])

  const named = <T>(entry: unknown, build: (record: Record<string, unknown>, name: string) => T): T | null => {
    const record = asRecord(entry)
    const name = clean(record.name)
    return name ? build(record, name) : null
  }

  return asList(asRecord(value).divisions ?? value).flatMap(entry =>
    named(entry, (division, name) => ({
      name,
      count: asCount(division.count),
      subCategories: asList(division.subCategories ?? division.categories).flatMap(subEntry =>
        named(subEntry, (subCategory, subName) => ({
          name: subName,
          count: asCount(subCategory.count),
          segments: asList(subCategory.segments).flatMap(segmentEntry =>
            named(segmentEntry, (segment, segmentName) => ({
              name: segmentName,
              count: asCount(segment.count),
            })) ?? [],
          ),
        })) ?? [],
      ),
    })) ?? [],
  )
}

/** Links carry the stored label; the listing matches it case-insensitively. */
export function taxonomyHref(division: string, subCategory?: string, segment?: string): string {
  const params = new URLSearchParams({ division })
  if (subCategory) params.set("subCategory", subCategory)
  if (segment) params.set("segment", segment)
  return `/products?${params.toString()}`
}
