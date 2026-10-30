import { type ClientSession, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { cartLineKey, type CartLineIdentity } from "@/lib/cart-line"
import { SaraCareConfigSchema, emptySaraCareConfig, saraCareProductId, saraCareSku,
  saraCareDurationLabel, normalizeCareItemno, SaraCareMasterPlanSchema, type SaraCareMasterRow,
  type SaraCareConfig, type SaraCareRule, type SaraCareYears, type SaraCareSnapshot, type SaraCareOffer } from "@/lib/sara-care-types"

export type StoredSaraCareConfig = SaraCareConfig & { _id: string; revision: string; updatedAt: Date }
type CareProduct = { _id?: ObjectId | string; id?: string; name?: string; title?: string; sku?: string;
  price?: number | string; mrp?: number | string; division?: string; categoryGroupName?: string;
  category?: string; subCategory?: string; segment?: string; type?: string; serviceKind?: string; active?: boolean;
  itemno?: string | number; itemNo?: string | number; raw?: Record<string, unknown> }
export type SaraCarePricingConfig = SaraCareConfig & { revision: string; master?: Map<string, SaraCareMasterRow> }
export type StoredSaraCareMaster = SaraCareMasterRow & { importId: string }
export type CareParent = CartLineIdentity & { quantity: number; saraCareSelection?: SaraCareYears | null }
export class SaraCareSelectionError extends Error {}
export async function loadSaraCareConfig(session?: ClientSession): Promise<SaraCareConfig & { revision: string }> {
  const stored = await (await getCollection<StoredSaraCareConfig>("sara_care_config")).findOne({ _id: "settings" }, { session })
  if (!stored) return { ...emptySaraCareConfig, revision: "unconfigured" }
  // Old group-based rules never make products eligible without an uploaded master row.
  const parsed = SaraCareConfigSchema.safeParse({ ...stored, rules: [], enabled: !!stored.importId && stored.enabled })
  if (!parsed.success) throw new Error("Sara Care configuration is invalid")
  return { ...parsed.data, revision: stored.revision }
}
const key = (value: unknown) => String(value || "").trim().toLowerCase()
const itemCodes = (product: CareProduct) => [...new Set([product.itemno, product.itemNo, product.sku,
  product.raw?.itemno, product.raw?.["Item No."], product.raw?.["Item No"], product.raw?.["ITEM NO"]]
  .map(normalizeCareItemno).filter(Boolean))]
export async function loadSaraCarePricing(config: SaraCarePricingConfig, products: CareProduct[], session?: ClientSession): Promise<SaraCarePricingConfig> {
  const codes = [...new Set(products.flatMap(itemCodes))]
  if (!config.enabled || !config.importId || !codes.length) return { ...config, master: new Map() }
  const rows = await (await getCollection<StoredSaraCareMaster>("sara_care_master")).find({ importId: config.importId, itemno: { $in: codes } }, { session }).toArray()
  return { ...config, master: new Map(rows.map(row => [row.itemno, { ...row,
    plans: row.plans.map(plan => SaraCareMasterPlanSchema.parse(plan)) }])) }
}
function masterRow(config: SaraCarePricingConfig, product: CareProduct) {
  if (!config.enabled || product.type === "software" || product.type === "service" || product.serviceKind === "sara-care") return null
  const matches = itemCodes(product).flatMap(code => config.master?.get(code) ? [config.master.get(code)!] : [])
  // Conflicting aliases must never select another product's protection silently.
  return matches.length === 1 ? matches[0] : null
}
export function resolveSaraCareRule(config: SaraCareConfig, product: CareProduct): SaraCareRule | null {
  if (!config.enabled || product.type === "software" || product.serviceKind === "sara-care") return null
  const division = key(product.division || product.raw?.Division)
  const category = key(product.categoryGroupName || product.category || product.subCategory || product.raw?.["Category/Group Name"])
  const segment = key(product.segment || product.raw?.Segment)
  const ranks = { product: 4, segment: 3, category: 2, division: 1 }
  const matching = config.rules.filter(rule => rule.scope === "product"
    ? [product.id, product._id?.toString()].some(id => id === rule.productId)
    : key(rule.division) === division && (rule.scope === "division" || key(rule.category) === category) &&
      (rule.scope !== "segment" || key(rule.segment) === segment)).sort((a, b) => ranks[b.scope] - ranks[a.scope])
  return matching[0] && !matching[0].excluded ? matching[0] : null
}
export function priceSaraCare(config: SaraCarePricingConfig, product: CareProduct, parentLineKey: string, years: SaraCareYears) {
  const row = masterRow(config, product)
  const plan = row?.plans.find(plan => plan.years === years)
  if (!row || !plan) return null
  const basis = config.pricingMode === "value" ? "price" : config.basis
  const basisAmount = Number(basis === "mrp" ? product.mrp : product.price)
  if (!Number.isFinite(basisAmount) || basisAmount <= 0) return null
  const price = Math.round((config.pricingMode === "value" ? plan.value || 0 : basisAmount * (plan.percentage || 0) / 100) + Number.EPSILON)
  if (!Number.isFinite(price) || price <= 0) return null
  const snapshot: SaraCareSnapshot = { parentLineKey, durationYears: years,
    parentProductId: product.id || String(product._id), parentSku: product.sku || null,
    parentName: String(product.name || product.title || "Product"), basis, basisAmount,
    percentage: plan.percentage || price / basisAmount * 100, ruleId: row.itemno, revision: config.revision,
    planCode: plan.code, pricingMode: config.pricingMode,
    terms: config.terms, coverageStarts: config.coverageStarts, taxRate: config.taxRate }
  return { price, snapshot }
}
export async function quoteSaraCare(parents: CareParent[], session?: ClientSession) {
  let config: SaraCarePricingConfig = await loadSaraCareConfig(session)
  const offers: SaraCareOffer[] = []
  const items: Array<{ id: string; sku: string; name: string; quantity: number; price: number; image: string;
    type: "service"; color: null; size: null; saraCare: SaraCareSnapshot }> = []
  if (!config.enabled || !parents.length) return { offers, items }
  const ids = [...new Set(parents.map(parent => parent.id || parent.productId).filter((id): id is string => !!id))]
  const products = await (await getCollection<CareProduct>("products")).find({ $or: [
    { _id: { $in: ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
    { _id: { $in: ids } }, { id: { $in: ids } },
  ] }, { session, projection: { _id: 1, id: 1, name: 1, title: 1, sku: 1, price: 1, mrp: 1,
    division: 1, categoryGroupName: 1, category: 1, subCategory: 1, segment: 1, type: 1, serviceKind: 1, active: 1,
    itemno: 1, itemNo: 1, raw: 1 } }).toArray()
  config = await loadSaraCarePricing(config, products, session)
  for (const parent of parents) {
    const id = parent.id || parent.productId
    const product = products.find(product => product.id === id || String(product._id) === id)
    if (!product || product.active !== true || product.serviceKind === "sara-care") continue
    const row = masterRow(config, product)
    if (!row?.plans.length) continue
    const parentLineKey = cartLineKey(parent)
    const options = row.plans.flatMap(plan => {
      const quote = priceSaraCare(config, product, parentLineKey, plan.years)
      return quote ? [{ years: plan.years, percentage: quote.snapshot.percentage, price: quote.price }] : []
    })
    if (!options.length) continue
    const defaultYears = options.find(option => option.years === 1)?.years ?? options[0].years
    const defaultQuote = priceSaraCare(config, product, parentLineKey, defaultYears)!
    offers.push({ parentLineKey, defaultYears, options, terms: config.terms,
      basis: defaultQuote.snapshot.basis, basisAmount: defaultQuote.snapshot.basisAmount,
      coverageStarts: config.coverageStarts, taxRate: config.taxRate, pricingMode: config.pricingMode })
    const years = parent.saraCareSelection === undefined ? defaultYears : parent.saraCareSelection
    if (years === null) continue
    const quote = priceSaraCare(config, product, parentLineKey, years)
    // A replacement master can remove a previously chosen duration. Drop its service line.
    if (!quote) continue
    items.push({ id: saraCareProductId(years), sku: quote.snapshot.planCode || saraCareSku(years),
      name: `Sara Care — ${saraCareDurationLabel(years)} — ${quote.snapshot.parentName}`,
      quantity: parent.quantity, price: quote.price, image: "/images/sara-care.svg", type: "service",
      color: null, size: null, saraCare: quote.snapshot })
  }
  return { offers, items }
}
