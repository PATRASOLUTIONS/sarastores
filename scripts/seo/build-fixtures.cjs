// Read-only in-memory build inputs. No persistent database is created.
const taxonomy = Object.freeze({
  categories: [{ _id: "seo-build-category", name: "Synthetic Phones", slug: "synthetic-phones", isEnabled: true }],
  sub_categories: [{ _id: "seo-build-sub-category", name: "Synthetic Smartphones", active: true }],
  products: [{ _id: "seo-build-product", slug: "synthetic-phone", name: "Synthetic Phone", description: "A synthetic phone for isolated SEO verification.",
    sku: "SEO-BUILD-PHONE", price: 12000, mrp: 15000, stock: 5, active: true, image: "/placeholder.svg", category: "Synthetic Phones", subCategory: "Synthetic Smartphones", brand: "Synthetic Brand" },
    ...["Bosch", "Haier", "LG", "TCL"].map((brand, index) => ({ _id: `seo-build-${brand.toLowerCase()}`, slug: `synthetic-${brand.toLowerCase()}`,
      name: `Synthetic ${brand} Appliance`, sku: `SEO-BUILD-${brand}`, description: "Synthetic appliance for isolated public-page verification.",
      price: 12000 + index * 1000, mrp: 18000, stock: 5, active: true, image: "/placeholder.svg", category: "Appliances", brand }))],
  brands: [{ _id: "seo-build-brand", slug: "synthetic-brand", name: "Synthetic Brand", enabled: true, landingPageEnabled: true }],
  reviews: [],
  product_specifications: [],
  campaign_pages: ["synthetic-campaign", "super-sunday"].map(slug => ({ _id: `seo-build-${slug}`, slug, name: slug === "super-sunday" ? "Synthetic Super Sunday" : "Synthetic Campaign",
    isActive: true, productIds: ["seo-build-product"] })),
  settings: [],
  sara_care_config: [],
  articles: [{ _id: "seo-build-article", slug: "synthetic-guide", title: "Synthetic Buying Guide", excerpt: "An isolated buying guide for SEO verification.",
    content: "<h1>Guide details</h1><p>Synthetic article content for isolated verification of public metadata, schema and heading structure.</p>", status: "published", author: "Synthetic Author" }],
  store_locations: [{ _id: "seo-build-store", shopName: "Synthetic Store", city: "Synthetic City", state: "Synthetic State", pincode: "000000",
    locationDescription: "Synthetic address for isolated SEO verification", mobileNo: "0000000000", shopTiming: "Fixture hours", isActive: true, locationType: "store" }],
  software_products: [{ _id: "seo-build-software", name: "Synthetic Software", description: "Synthetic software for isolated SEO verification.",
    status: "active", category: "Software", image: "/placeholder.svg", pricing: { pack1: 1000 }, totalKeysAvailable: 5 }],
})

function fixtureDatabase(deny) {
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every(item => matches(record, item))
    if (key === "$or") return value.some(item => matches(record, item))
    if (key.startsWith("$")) return deny()
    const actual = key.split(".").reduce((item, field) => item?.[field], record)
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value).every(([operator, operand]) => {
        if (operator === "$ne") return actual !== operand
        if (operator === "$in") return operand.some(item => String(item) === String(actual))
        if (operator === "$nin") return !operand.some(item => String(item) === String(actual))
        if (operator === "$exists") return (actual !== undefined) === operand
        if (operator === "$type") return typeof actual === operand
        if (operator === "$regex") return new RegExp(operand, value.$options || "").test(String(actual || ""))
        if (operator === "$options") return true
        return deny()
      })
    }
    return value === null ? actual == null : actual === value
  })
  // Async getCollection() returns these objects through Promise resolution;
  // they must not be mistaken for thenables with a prohibited `then()` call.
  const readOnly = (target) => new Proxy(target, {
    get: (object, key) => key === "then" ? undefined : Object.hasOwn(object, key) ? object[key] : deny,
  })
  return readOnly({
    collection(name) {
      if (!Object.hasOwn(taxonomy, name)) return deny()
      return readOnly({
        find(filter = {}) {
          let rows = structuredClone(taxonomy[name]).filter(record => matches(record, filter))
          const cursor = {
            sort() { return cursor },
            project() { return cursor },
            skip(count) { rows = rows.slice(count); return cursor },
            limit(count) { rows = rows.slice(0, count); return cursor },
            async toArray() { return structuredClone(rows) },
          }
          return readOnly(cursor)
        },
        async findOne(filter = {}) { return structuredClone(taxonomy[name].find(record => matches(record, filter)) || null) },
        async countDocuments(filter = {}) { return taxonomy[name].filter(record => matches(record, filter)).length },
        aggregate(pipeline) {
          if (!["reviews", "articles"].includes(name) || pipeline.some(stage => "$out" in stage || "$merge" in stage)) return deny()
          return readOnly({ async toArray() { return [] } })
        },
      })
    },
  })
}

module.exports = { fixtureDatabase, fixtureCollectionNames: Object.keys(taxonomy) }
