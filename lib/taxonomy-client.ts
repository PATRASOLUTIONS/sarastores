import { fetchWithCache } from "@/utils/cache"
import { normalizeTaxonomyDivisions, type TaxonomyDivision } from "./product-taxonomy"

/**
 * The division tree, fetched once and shared by every consumer on the page.
 *
 * `/api/taxonomy` is a full aggregation over the product collection, and the
 * header menu that needs it is mounted on every route — measured at seventeen
 * identical requests for a single homepage view, because each remount of the
 * header issued its own. Routing through the cache collapses those into one:
 * `fetchWithCache` holds an in-flight promise per key, so simultaneous callers
 * share a response rather than racing, and later mounts read from memory.
 *
 * Ten minutes, longer than the five-minute default, because the tree only
 * changes when somebody reclassifies the catalogue.
 */
const TTL = 10 * 60 * 1000

export function fetchTaxonomy(): Promise<TaxonomyDivision[]> {
  return fetchWithCache(
    "taxonomy:v3",
    async () => {
      const response = await fetch("/api/taxonomy?v=3")
      if (!response.ok) throw new Error(`Taxonomy request failed (${response.status})`)
      return response.json()
    },
    // The normaliser doubles as the cache's parser, so a payload persisted by
    // an earlier deploy is coerced into the current shape when it is read back
    // rather than reaching a component that no longer understands it.
    { parse: normalizeTaxonomyDivisions },
    TTL,
  )
}
