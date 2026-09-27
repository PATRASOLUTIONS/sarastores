/**
 * Batch-runs the live scraper API against real product URLs and prints a
 * coverage table. Manual smoke test — not part of the app.
 *
 *   node scripts/test-scraper.mjs [flipkart|pai|lg]
 */
import axios from "axios"

const BASE = process.env.SCRAPER_TEST_BASE ?? "http://localhost:3005"
const EMAIL = process.env.SCRAPER_TEST_EMAIL
const PASSWORD = process.env.SCRAPER_TEST_PASSWORD

const URLS = {
  flipkart: [
    ["fk-fridge-1", "https://www.flipkart.com/samsung-183-l-direct-cool-single-door-4-star-refrigerator-base-drawer-digital-inverter-touch-defrost-2026-model/p/itmba7d59c288287?pid=RFRHJ4JJXJADZTGM"],
    ["fk-fridge-2", "https://www.flipkart.com/whirlpool-235-l-frost-free-triple-door-refrigerator-zeolite-technology-microblock-technology/p/itm5d0f65a152e99?pid=RFRHYFQ6GDUPGVQY"],
    ["fk-fridge-3", "https://www.flipkart.com/samsung-236-l-frost-free-double-door-3-star-refrigerator-convertible-digital-inverter-2026-model/p/itmf79d08a8d7a12?pid=RFRHJYT9YQCF5RAZ"],
    ["fk-wm-1", "https://www.flipkart.com/samsung-7-kg-5-star-ecobubble-soft-closing-door-digital-inverter-fully-automatic-top-load-washing-machine-grey/p/itmfad620b791ea9?pid=WMNGGUWZK6VEQPXD"],
    ["fk-wm-2", "https://www.flipkart.com/lg-7-kg-5-star-wind-jet-dry-collar-scrubber-rust-free-plastic-base-semi-automatic-top-load-washing-machine-grey-white/p/itmc9d497e9b58bb?pid=WMNG4VNTJAUVBCKN"],
  ],
  pai: [
    ["pai-fridge-1", "https://www.paiinternational.in/product-details/haier-190-litres-5-star-single-door-refrigerator-2/"],
    ["pai-fridge-2", "https://www.paiinternational.in/product-details/bosch-335-litres-3-star-triple-door-refrigerator-3/"],
    ["pai-fridge-3", "https://www.paiinternational.in/product-details/lg-251-litres-2-star-double-door-refrigerator-co-2/"],
    ["pai-wm-1", "https://www.paiinternational.in/product-details/samsung-8-kg-5-star-fully-automatic-top-load-washi/"],
    ["pai-wm-2", "https://www.paiinternational.in/product-details/ifb-65-kg-5-star-fully-automatic-front-load-wash-2/"],
  ],
  lg: [
    ["lg-fridge-1", "https://www.lg.com/in/refrigerators/double-door-refrigerators/gl-b382dpzx/"],
    ["lg-fridge-2", "https://www.lg.com/in/refrigerators/side-by-side-refrigerators/gl-x257amc3/"],
    ["lg-fridge-3", "https://www.lg.com/in/refrigerators/single-door-refrigerators/gl-d231apzu/"],
    ["lg-wm-1", "https://www.lg.com/in/laundry/front-loading-washing-machines/fhp1210z6o/"],
    ["lg-wm-2", "https://www.lg.com/in/laundry/top-loading-washing-machines/thd13swp/"],
  ],
  reliance: [
    ["rd-fridge-1", "https://www.reliancedigital.in/product/lg-574-l-3-star-convertible-french-door-refrigerator-prime-silver-gv-b23fflmb-mou0db-10056092"],
    ["rd-fridge-2", "https://www.reliancedigital.in/product/haier-190-l-3-star-single-door-refrigerator-hrd-2103bnsa-p-nickel-steel-mmw07w-9988271"],
    ["rd-fridge-3", "https://www.reliancedigital.in/product/samsung-396-l-2-star-5-in-1-convertible-frost-free-double-door-refrigerator-rt41hb6a4222hl-black-glass-mlz4yu-9929660"],
    ["rd-wm-1", "https://www.reliancedigital.in/product/samsung-7-kg-top-load-fully-automatic-washing-machine-wa70bg4441bytl-l95uso"],
    ["rd-wm-2", "https://www.reliancedigital.in/product/electrolux-9-kg-front-load-fully-automatic-washing-machine-1200-rpm-hygieniccare-ecoinverter-motor-quick-cycles-adjust-tempratures-ewf9024m3sb-mnx83r-10017148"],
  ],
  vijaysales: [
    ["vs-fridge-1", "https://www.vijaysales.com/p/254501/lg-251-litres-frost-free-double-door-refrigerator-smart-inverter-compressor-multi-air-flow-auto-smart-connect-glt2516wwpz-shiny-steel"],
    ["vs-fridge-2", "https://www.vijaysales.com/p/252416/bosch-210-litres-direct-cool-single-door-refrigerator-fast-cooling-low-noise-operation-cot20s41ei-silver"],
    ["vs-fridge-3", "https://www.vijaysales.com/p/252153/samsung-189l-5-star-direct-cool-single-door-refrigerator-digital-inverter-compressor-stabilizer-free-operation-toughened-glass-shelves-horizontal-curve-design-purple-finish-rr21h2h259r-hl"],
    ["vs-wm-1", "https://www.vijaysales.com/p/239638/bosch-10-kg-automatic-front-load-washing-machine-with-multiple-wash-programmes-1400-rpm-spin-speed-digital-countdown-indicator-multiple-water-protection-wga254zpin-dark-lake"],
    ["vs-wm-2", "https://www.vijaysales.com/p/205328/samsung-7-kg-5-star-fully-automatic-top-load-washing-machine-wa70bg4441by-lavender-grey"],
  ],
  bosch: [
    ["bosch-fridge-1", "https://www.bosch-home.in/en/product/fridges-freezers/fridgefreezers/free-standing-bottom-freezer/CST22U14PI"],
    ["bosch-fridge-2", "https://www.bosch-home.in/en/product/fridges-freezers/fridgefreezers/free-standing-bottom-freezer/KGN56LB42I"],
    ["bosch-fridge-3", "https://www.bosch-home.in/en/product/fridges-freezers/fridges/freestanding-fridges-with-freezer-section/CST22W33VI"],
    ["bosch-wm-1", "https://www.bosch-home.in/en/product/washer-dryer/washing-machines/front-loading-washing-machines/WGA254IRIN"],
    ["bosch-wm-2", "https://www.bosch-home.in/en/product/washer-dryer/washing-machines/front-loading-washing-machines/WAJ2826DIN"],
  ],
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set SCRAPER_TEST_EMAIL and SCRAPER_TEST_PASSWORD before running")
  }
  const res = await axios.post(
    `${BASE}/api/auth/login`,
    { email: EMAIL, password: PASSWORD },
    { validateStatus: () => true, timeout: 60000 },
  )
  const cookie = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")
  if (!cookie.includes("session=")) throw new Error(`login failed (${res.status}): ${JSON.stringify(res.data).slice(0, 300)}`)
  return cookie
}

const short = (s, n = 46) => (s ? String(s).replace(/\s+/g, " ").slice(0, n) : "—")

async function main() {
  const only = process.argv[2]
  const cookie = await login()
  console.log("logged in\n")

  for (const [source, list] of Object.entries(URLS)) {
    if (only && only !== source) continue
    console.log(`================ ${source.toUpperCase()} ================`)
    for (const [name, url] of list) {
      const started = Date.now()
      const res = await axios.post(
        `${BASE}/api/scrape`,
        { url },
        { headers: { Cookie: cookie }, validateStatus: () => true, timeout: 180000 },
      )
      const ms = Date.now() - started
      if (!res.data?.success) {
        console.log(`${name.padEnd(13)} FAIL ${res.status} ${JSON.stringify(res.data).slice(0, 200)} (${ms}ms)`)
        continue
      }
      const p = res.data.product
      const missing = []
      if (!p.sap.name) missing.push("name")
      if (!p.sap.brand) missing.push("brand")
      if (!p.sap.category) missing.push("category")
      if (!p.sap.subCategory) missing.push("subCategory")
      if (p.sap.price == null && source !== "lg") missing.push("price")
      if (p.mrp == null) missing.push("mrp")
      if (!p.images.length) missing.push("images")
      // Vijay Sales publishes no spec table anywhere on the site.
      if (!Object.keys(p.technicalDetails).length) missing.push("specs")
      if (!p.description) missing.push("description")
      if (!p.features.length) missing.push("features")

      console.log(
        `${name.padEnd(13)} ${missing.length ? "GAPS" : " OK "} ${String(ms).padStart(6)}ms  ` +
          `specs=${String(Object.keys(p.technicalDetails).length).padStart(3)} img=${String(p.images.length).padStart(2)} ` +
          `feat=${String(p.features.length).padStart(2)} rev=${String(p.reviews.length).padStart(2)} ` +
          `price=${String(p.sap.price ?? "—").padStart(9)} mrp=${String(p.mrp ?? "—").padStart(9)}`,
      )
      console.log(`              name: ${short(p.sap.name, 80)}`)
      console.log(`              tax : ${short(p.sap.brand, 14)} | ${short(p.sap.category, 26)} | ${short(p.sap.subCategory, 30)}`)
      console.log(`              sku : ${short(p.sap.sku, 30)}  charDesc: ${short(p.sap.charDesc, 20)}  extId: ${short(p.externalId, 24)}`)
      console.log(`              spec1: ${short(Object.entries(p.technicalDetails)[0]?.join(" = "), 70)}`)
      console.log(`              img1 : ${short(p.images[0], 90)}`)
      if (missing.length) console.log(`              MISSING: ${missing.join(", ")}`)
      console.log()
    }
  }
}

main().catch((e) => {
  console.error("harness error:", e.message)
  process.exit(1)
})
