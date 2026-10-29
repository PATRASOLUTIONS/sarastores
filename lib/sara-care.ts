import { type ClientSession, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { cartLineKey, type CartLineIdentity } from "@/lib/cart-line"
import { SaraCareConfigSchema, emptySaraCareConfig, saraCareProductId, saraCareSku,
  type SaraCareConfig, type SaraCareRule, type SaraCareYears, type SaraCareSnapshot, type SaraCareOffer } from "@/lib/sara-care-types"

export type StoredSaraCareConfig = SaraCareConfig & { _id: string; revision: string; updatedAt: Date }
type CareProduct = { _id?: ObjectId | string; id?: string; name?: string; title?: string; sku?: string;
  price?: number | string; mrp?: number | string; division?: string; categoryGroupName?: string;
  category?: string; subCategory?: string; segment?: string; type?: string; serviceKind?: string; active?: boolean;
  raw?: Record<string, unknown> }
export type CareParent = CartLineIdentity & { quantity: number; saraCareSelection?: SaraCareYears | null }
export class SaraCareSelectionError extends Error {}
export async function loadSaraCareConfig(session?: ClientSession): Promise<SaraCareConfig & { revision: string }> {
  const stored = await (await getCollection<StoredSaraCareConfig>("sara_care_config")).findOne({ _id: "settings" }, { session })
  if (!stored) return { ...emptySaraCareConfig, revision: "unconfigured" }
  const parsed = SaraCareConfigSchema.safeParse(stored)
  if (!parsed.success) throw new Error("Sara Care configuration is invalid")
  return { ...parsed.data, revision: stored.revision }
}
const key = (value: unknown) => String(value || "").trim().toLowerCase()
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
export function priceSaraCare(config: SaraCareConfig & { revision: string }, product: CareProduct, parentLineKey: string, years: SaraCareYears) {
  const rule = resolveSaraCareRule(config, product)
  const rate = rule?.rates.find(rate => rate.years === years && rate.enabled)
  if (!rule || !rate) return null
  const basisAmount = Number(rule.basis === "mrp" ? product.mrp : product.price)
  if (!Number.isFinite(basisAmount) || basisAmount <= 0) return null
  const price = Math.round((basisAmount * rate.percentage / 100 + Number.EPSILON) * 100) / 100
  if (price <= 0) return null
  const snapshot: SaraCareSnapshot = { parentLineKey, durationYears: years,
    parentProductId: product.id || String(product._id), parentSku: product.sku || null,
    parentName: String(product.name || product.title || "Product"), basis: rule.basis, basisAmount,
    percentage: rate.percentage, ruleId: rule.id, revision: config.revision,
    terms: config.terms, coverageStarts: config.coverageStarts, taxRate: config.taxRate }
  return { price, snapshot }
}
export async function quoteSaraCare(parents: CareParent[], session?: ClientSession) {
  const config = await loadSaraCareConfig(session)
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
    "raw.Division": 1, "raw.Category/Group Name": 1, "raw.Segment": 1 } }).toArray()
  for (const parent of parents) {
    const id = parent.id || parent.productId
    const product = products.find(product => product.id === id || String(product._id) === id)
    if (!product || product.active !== true || product.serviceKind === "sara-care") continue
    const rule = resolveSaraCareRule(config, product)
    if (!rule) continue
    const parentLineKey = cartLineKey(parent)
    const options = rule.rates.filter(rate => rate.enabled).flatMap(rate => {
      const quote = priceSaraCare(config, product, parentLineKey, rate.years)
      return quote ? [{ years: rate.years, percentage: rate.percentage, price: quote.price }] : []
    })
    if (!options.some(option => option.years === rule.defaultYears)) continue
    const defaultQuote = priceSaraCare(config, product, parentLineKey, rule.defaultYears)!
    offers.push({ parentLineKey, defaultYears: rule.defaultYears, options, terms: config.terms,
      basis: defaultQuote.snapshot.basis, basisAmount: defaultQuote.snapshot.basisAmount,
      coverageStarts: config.coverageStarts, taxRate: config.taxRate })
    const years = parent.saraCareSelection === undefined ? rule.defaultYears : parent.saraCareSelection
    if (years === null) continue
    const quote = priceSaraCare(config, product, parentLineKey, years)
    if (!quote) throw new SaraCareSelectionError("Your selected Sara Care duration is unavailable. Remove it or select another duration.")
    items.push({ id: saraCareProductId(years), sku: saraCareSku(years),
      name: `Sara Care — ${years} ${years === 1 ? "Year" : "Years"} — ${quote.snapshot.parentName}`,
      quantity: parent.quantity, price: quote.price, image: "/images/sara-care.svg", type: "service",
      color: null, size: null, saraCare: quote.snapshot })
  }
  return { offers, items }
}
