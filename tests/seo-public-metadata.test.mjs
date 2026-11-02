import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { sourceLoader } from "./source-loader.mjs"

const origin = "https://www.sarastores.com"
const buildPageMetadata = sourceLoader().load("lib/seo-metadata.ts").buildPageMetadata
const seo = { buildPageMetadata, getOriginFromHeaders: async () => origin,
  getSiteSettings: async () => ({}), getCompanyName: () => "Sara" }
const missing = () => { throw new Error("NOT_FOUND") }

test("indexable async catalogue routes do not stream their primary content behind loading shells", () => {
  const root = path.resolve(import.meta.dirname, "..")
  for (const route of ["product/[slug]", "products", "category/[id]", "brands/[slug]", "software", "lg", "offers", "store-locator"]) {
    assert.equal(fs.existsSync(path.join(root, "app", route, "loading.tsx")), false,
      `${route} must expose primary server HTML without a script-revealed loading shell`)
  }
})

function storeFixtureLoader(documents) {
  return sourceLoader({
    "@/lib/seo-metadata": seo,
    "@/lib/db-service": { getCollection: async () => ({ find: query => {
      assert.equal(query.isActive, true)
      return { sort() { return this }, toArray: async () => documents }
    } }) },
  })
}

const location = { _id: "fixture-store", shopName: "Fixture Store", city: "Fixture City",
  locationDescription: "Fixture street", isActive: true }

function legacyArticleLoader(records) {
  const cursor = { sort() { return this }, limit() { return this }, toArray: async () => records }
  return sourceLoader({
    "@/lib/db-service": { normalizeId: row => ({ ...row, id: String(row._id) }),
      getCollection: async () => ({ find: () => cursor, findOne: async query => records.find(row => row.slug === query.slug) || null }) },
  }).load("lib/articles.ts")
}

test("legacy article strings and dates cannot crash public categories or hide good published rows", async () => {
  const rows = [
    { _id: "valid", slug: "valid-guide", title: "Actual Guide Title", category: "Appliances", publishedAt: "2026-11-01T00:00:00Z", content: "<p>Actual content</p>" },
    { _id: "legacy", slug: "legacy-guide", title: "Legacy Guide Title", category: { bad: "legacy" }, publishedAt: "not-a-date", createdAt: "invalid", updatedAt: "invalid", coverImage: { url: "/fixture.webp" }, content: null },
  ]
  const before = JSON.stringify(rows)
  const articles = legacyArticleLoader(rows)
  const result = await articles.listArticles()
  assert.equal(result.length, 2)
  assert.equal(result[0].title, "Actual Guide Title")
  assert.equal(result[0].publishedAt, "2026-11-01T00:00:00.000Z")
  assert.equal(result[1].title, "Legacy Guide Title")
  assert.equal(result[1].category, "Buying Guides")
  assert.equal(result[1].publishedAt, null)
  assert.equal(result[1].createdAt, null)
  assert.equal(result[1].updatedAt, null)
  assert.equal(result[1].coverImage, "")
  assert.equal((await articles.getArticleCategories()).length, 2)
  assert.equal(JSON.stringify(rows), before)
})

test("malformed required article identity stays repairable by staff but is excluded from public listing/detail", async () => {
  const articles = legacyArticleLoader([
    { _id: "valid", slug: "valid-guide", title: "Real Guide Title" },
    { _id: "bad-title", slug: "bad-title", title: { bad: "legacy" } },
    { _id: "bad-slug", slug: { bad: "legacy" }, title: "Real Existing Title" },
  ])
  const published = await articles.listArticles()
  assert.equal(published.length, 1)
  assert.equal(published[0].title, "Real Guide Title")
  assert.equal(await articles.getArticleBySlug("bad-title"), null)
  const repairable = await articles.listArticles({ includeDrafts: true })
  assert.equal(repairable.length, 3)
  assert.equal(repairable[1].title, "")
  assert.equal(repairable[2].slug, "")
  assert.equal((await articles.getArticleBySlug("bad-title", { includeDrafts: true })).id, "bad-title")
})

test("store normalization omits missing hours while preserving recorded hours", async () => {
  const stores = storeFixtureLoader([location, { ...location, _id: "recorded", shopTiming: "Mo-Fr 10:00-18:00" }]).load("lib/store-locations.ts")
  const [unknown, recorded] = await stores.getAllStoreLocations()
  assert.equal(unknown.hours, "")
  assert.equal(stores.buildStoreJsonLd(unknown, origin).openingHours, undefined)
  assert.equal(recorded.hours, "Mo-Fr 10:00-18:00")
  assert.equal(stores.buildStoreJsonLd(recorded, origin).openingHours, recorded.hours)
})

test("store schema excludes nonfinite and out-of-range coordinates from raw and direct inputs", async () => {
  for (const [latitude, longitude] of [[Infinity, 77], [NaN, 77], [91, 77], [-91, 77], [12, Infinity], [12, NaN], [12, 181], [12, -181]]) {
    const stores = storeFixtureLoader([{ ...location, latitude, longitude }]).load("lib/store-locations.ts")
    const [normalized] = await stores.getAllStoreLocations()
    assert.equal(stores.buildStoreJsonLd(normalized, origin).geo, undefined)
    assert.equal(stores.buildStoreJsonLd({ ...normalized, latitude, longitude }, origin).geo, undefined)
  }
  const stores = storeFixtureLoader([{ ...location, latitude: 90, longitude: -180 }]).load("lib/store-locations.ts")
  const [normalized] = await stores.getAllStoreLocations()
  assert.equal(stores.buildStoreJsonLd(normalized, origin).geo.latitude, 90)
  assert.equal(stores.buildStoreJsonLd(normalized, origin).geo.longitude, -180)
})

test("store city/detail pages show honest missing-hours guidance and metadata", async () => {
  const React = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  const normalized = (await storeFixtureLoader([location]).load("lib/store-locations.ts").getAllStoreLocations())[0]
  const loader = sourceLoader({
    "@/lib/seo-metadata": seo,
    "@/lib/store-locations": { getStoresByCity: async () => [normalized], getStore: async () => normalized,
      getStoreCities: async () => [], getAllStoreLocations: async () => [normalized],
      buildStoreJsonLd: storeFixtureLoader([location]).load("lib/store-locations.ts").buildStoreJsonLd },
    "next/navigation": { notFound: missing },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/components/Header": () => null, "@/components/Footer": () => null, "./StoreActions": () => null,
  })
  for (const path of ["app/stores/[city]/page.tsx", "app/stores/[city]/[store]/page.tsx"]) {
    const page = loader.load(path)
    const props = { params: Promise.resolve({ city: "fixture-city", store: "fixture-store" }) }
    const metadata = await page.generateMetadata(props)
    const html = renderToStaticMarkup(await page.default(props))
    assert.match(html, /Contact the store for opening hours/)
    assert.doesNotMatch(html, /9:00 AM - 9:00 PM/)
    assert.doesNotMatch(metadata.description, /Opening hours: \./)
    assert.match(metadata.description, /[Cc]ontact the stores? for opening hours/)
  }
})

test("global opening-hours schema expands weekday ranges and omits malformed specifications", () => {
  const builder = sourceLoader().load("lib/jsonld-store.ts").buildLocalBusinessJsonLd
  const valid = builder({ origin, settings: { openingHours: ["Mo-Sa 09:00-21:00", "Tuesday-Thursday,Saturday 10:00-18:00"] } })
  assert.deepEqual(Array.from(valid.openingHoursSpecification[0].dayOfWeek), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => `https://schema.org/${day}`))
  assert.deepEqual(Array.from(valid.openingHoursSpecification[1].dayOfWeek), ["Tuesday", "Wednesday", "Thursday", "Saturday"].map(day => `https://schema.org/${day}`))
  assert.equal(valid.openingHoursSpecification[0].opens, "09:00")
  for (const text of ["By appointment", "Mo-Fr 25:00-18:00", "Mo-Fr 09:60-18:00", "Mo-Fr 09:00-18:99", "Holiday 09:00-18:00"]) {
    const invalid = builder({ origin, settings: { openingHours: [text] } })
    assert.equal(invalid.openingHoursSpecification, undefined)
    assert.deepEqual(Array.from(invalid.openingHours), [text])
  }
})

test("article legacy headings render safely below one page h1 and schema uses encoded canonical", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const React = await import("react")
  const { load } = await import("cheerio")
  const article = { _id: "fixture-article", slug: "guide & tips?", title: "Fixture Buying Guide",
    excerpt: "An isolated guide fixture.", content: '<h1 class="body-heading">Intro <em>section</em></h1><h2>Existing section</h2><p>Safe &amp; useful</p><script>throw new Error("never execute")</script><img src="/fixture.webp" onerror="alert(1)">',
    category: "Buying Guides", author: "Fixture Author", status: "published", tags: [], relatedProductIds: [] }
  const before = JSON.stringify(article)
  const cursor = { sort() { return this }, limit() { return this }, toArray: async () => [article] }
  const loader = sourceLoader({
    "@/lib/seo-metadata": seo,
    "@/lib/db-service": { normalizeId: row => ({ ...row, id: String(row._id) }),
      getCollection: async () => ({ findOne: async query => query.slug === article.slug ? article : null, find: () => cursor }) },
    "next/navigation": { notFound: missing },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/image": props => React.createElement("img", props),
    "@/components/Header": () => null, "@/components/Footer": () => null,
    "./ArticleProductRail": () => null,
  })
  const page = loader.load("app/blog/[slug]/page.tsx")
  const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: article.slug }) })
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }))
  const $ = load(html)
  assert.equal($("h1").length, 1)
  assert.equal($("h1").text(), article.title)
  assert.equal($("h2.body-heading").text(), "Intro section")
  assert.equal($("h2.body-heading em").text(), "section")
  assert.equal($("h2").length, 2)
  assert.equal($("img").attr("onerror"), undefined)
  assert.equal($("script:not([type='application/ld+json'])").length, 0)
  const schema = JSON.parse($("script[type='application/ld+json']").text())
  assert.equal(schema.mainEntityOfPage["@id"], `${origin}/blog/guide%20%26%20tips%3F`)
  assert.equal(schema.mainEntityOfPage["@id"], metadata.alternates.canonical)
  assert.equal(JSON.stringify(article), before)
})

test("shared category lookup excludes disabled records returned by ID, slug or name", async () => {
  for (const match of ["id", "slug", "name"]) {
    const hidden = { _id: "hidden", id: "hidden", name: "Hidden", slug: "hidden", isEnabled: false }
    const lookup = sourceLoader({
      react: { cache: fn => fn },
      "@/lib/db-service": { COLLECTIONS: { CATEGORIES: "categories" }, normalizeId: row => ({ ...row, id: String(row._id) }),
        getById: async () => match === "id" ? hidden : null,
        getCollection: async () => ({ findOne: async query => {
          assert.equal(query.isEnabled.$ne, false)
          return (match === "slug" && query.slug) || (match === "name" && query.name) ? hidden : null
        } }) },
    }).load("lib/seo-category.ts").getSeoCategory
    assert.equal(await lookup("hidden"), null)
  }
})

test("Sara Care has page-specific canonical and sharing metadata", async () => {
  const page = sourceLoader({ "@/lib/seo-metadata": seo }).load("app/sara-care/layout.tsx")
  const metadata = await page.generateMetadata()
  assert.equal(metadata.alternates.canonical, `${origin}/sara-care`)
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical)
  assert.match(metadata.title, /Sara Care/)
  assert.match(metadata.description, /eligible devices/)
  assert.equal(metadata.robots.index, true)
})

test("personal and redirect utility routes have noindex metadata rather than homepage metadata", async () => {
  for (const path of ["wishlist", "search", "error"]) {
    const metadata = await sourceLoader({ "@/lib/seo-metadata": seo }).load(`app/${path}/layout.tsx`).generateMetadata()
    assert.equal(metadata.alternates.canonical, `${origin}/${path}`)
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical)
    assert.equal(metadata.robots.index, false)
    assert.equal(metadata.robots.follow, false)
  }
})

function subcategoryLoader(record) {
  return sourceLoader({
    react: { cache: fn => fn }, "next/navigation": { notFound: missing },
    "@/lib/seo-metadata": seo,
    "@/lib/db-service": { getCollection: async () => ({ findOne: async query => {
      assert.equal(query.active.$ne, false)
      if (!record || record.active === false) return null
      const matches = query.$or.some(condition => condition.slug === record.slug ||
        condition.name && new RegExp(condition.name.$regex, condition.name.$options).test(record.name))
      return matches ? record : null
    } }) },
  }).load("app/sub-category/[name]/layout.tsx")
}

test("subcategory metadata resolves exact hyphenated names and aliases to the stored canonical name", async () => {
  const page = subcategoryLoader({ name: "Wi-Fi Routers", slug: "wifi-routers", active: true })
  for (const name of ["Wi-Fi%20Routers", "wifi-routers"]) {
    const metadata = await page.generateMetadata({ params: Promise.resolve({ name }) })
    assert.equal(metadata.alternates.canonical, `${origin}/sub-category/Wi-Fi%20Routers`)
    assert.equal(metadata.robots.index, true)
  }
})

test("missing and disabled subcategories fail metadata and layout before children render", async () => {
  for (const record of [null, { name: "Hidden category", slug: "hidden-category", active: false }]) {
    const page = subcategoryLoader(record)
    const props = { params: Promise.resolve({ name: "hidden-category" }), children: "PRIVATE_FIXTURE" }
    await assert.rejects(page.generateMetadata(props), /NOT_FOUND/)
    await assert.rejects(page.default(props), /NOT_FOUND/)
  }
})

test("Super Sunday alias uses the active campaign canonical and rejects inactive campaigns", async () => {
  let active = true
  const page = sourceLoader({
    react: { cache: fn => fn }, "next/navigation": { notFound: missing },
    "@/lib/seo-metadata": seo,
    "@/lib/db-service": { getCollection: async () => ({ findOne: async query => {
      assert.equal(query.slug, "super-sunday")
      assert.equal(query.isActive, true)
      return active ? { name: "Super Sunday", slug: "super-sunday" } : null
    } }) },
  }).load("app/super-sunday/layout.tsx")
  const metadata = await page.generateMetadata()
  assert.equal(metadata.alternates.canonical, `${origin}/campaign/super-sunday`)
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical)
  active = false
  await assert.rejects(page.generateMetadata(), /NOT_FOUND/)
  await assert.rejects(page.default({ children: "HIDDEN_FIXTURE" }), /NOT_FOUND/)
})
