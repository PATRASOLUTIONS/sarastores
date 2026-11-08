import * as cheerio from "cheerio"
import { jsonLdNodes, clean, dataRecord } from "./http"
import type { ScrapedProduct } from "./types"
import { validMerchantGtin } from "@/lib/google-merchant-products"
import { merchantDescription } from "@/lib/merchant-product-content"
import { formatProductName } from "@/lib/product-name-format"

export interface ScrapedMerchantFacts {
  primaryImages?: string[]
  gtin: string | null; mpn: string | null; model: string | null
  currency: string | null; availability: "in_stock" | "out_of_stock" | null
  condition: "new" | "used" | "refurbished" | null
  evidence: { field: string; value: string; location: string; url: string }[]
  issues: string[]
}

/** Collect labelled identifiers for the primary product only. Never guess from SKU/model/digits. */
export function enrichMerchantFacts(product: ScrapedProduct, html: string): ScrapedProduct {
  const $ = cheerio.load(html)
  const products = jsonLdNodes(html).filter(node => [node["@type"]].flat().some(type => type === "Product"))
  const identity = (value: unknown) => clean(value).toLowerCase().replace(/\s+/g, " ")
  const primary = products.filter(node => identity(node.name) === identity(product.sap.name))
  const ld = primary.length === 1 ? primary[0] : products.length === 1 ? products[0] : null
  if (!product.description && typeof ld?.description === "string") product.description = ld.description
  if (!product.sap.brand) product.sap.brand = typeof ld?.brand === "string" ? ld.brand : clean(ld?.brand?.name)
  const evidence: ScrapedMerchantFacts["evidence"] = []
  const issues: string[] = []
  const add = (field: string, value: unknown, location: string) => {
    if (typeof value !== "string" || !value.trim()) return
    evidence.push({ field, value: clean(value), location, url: product.sourceUrl })
  }
  for (const key of ["gtin", "gtin8", "gtin12", "gtin13", "gtin14"]) add("gtin", ld?.[key], `Product JSON-LD.${key}`)
  add("mpn", ld?.mpn, "Product JSON-LD.mpn")
  add("model", ld?.model, "Product JSON-LD.model")
  // Visible, labelled specification rows supplement site-specific payload parsers.
  $("table tr").each((_, row) => {
    const cells = $(row).find("th,td")
    const key = clean(cells.first().text()), value = clean(cells.last().text())
    if (cells.length >= 2 && key && value && key !== value && key.length < 100 && value.length <= 10000) {
      product.technicalDetails[key] ||= value
    }
  })
  for (const [key, value] of Object.entries(product.technicalDetails)) {
    const label = key.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "ean", "eannumber", "upc", "barcode"].includes(label)) add("gtin", value, `Specification: ${key}`)
    if (["mpn", "manufacturerpartnumber", "manufacturerspartnumber"].includes(label)) add("mpn", value, `Specification: ${key}`)
    if (["model", "modelnumber", "modelname", "modelid"].includes(label)) add("model", value, `Specification: ${key}`)
  }
  for (const [field, attribute] of [["gtin", "data-flix-ean"], ["mpn", "data-flix-mpn"]]) {
    const elements = $(`[${attribute}]`)
    if (elements.length === 1) add(field, elements.first().attr(attribute), `Page attribute: ${attribute}`)
  }
  const values = (field: string) => [...new Set(evidence.filter(item => item.field === field).map(item => item.value))]
  const gtins = values("gtin"), mpns = values("mpn")
  let gtin: string | null = null, mpn: string | null = null
  if (gtins.length > 1) issues.push("Conflicting GTIN values on source page; verify exact variant.")
  else if (gtins.length === 1) {
    if (validMerchantGtin(gtins[0])) gtin = gtins[0]
    else issues.push("Source GTIN fails checksum/length validation; original evidence retained.")
  }
  if (mpns.length > 1) issues.push("Conflicting manufacturer MPN values on source page.")
  else if (mpns.length === 1 && mpns[0].length <= 70 && !/[\u0000-\u001f]/.test(mpns[0])) mpn = mpns[0]
  else if (mpns.length) issues.push("Source MPN is invalid or too long.")
  if (!gtin && !mpn) issues.push("No valid manufacturer GTIN/MPN exposed by this page.")
  const offer = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers
  const availability = clean(offer?.availability)
  let stock: ScrapedMerchantFacts["availability"] = /(?:^|\/)InStock$/i.test(availability) ? "in_stock"
    : /(?:^|\/)(?:OutOfStock|Discontinued|SoldOut)$/i.test(availability) ? "out_of_stock" : null
  if (!stock && /currently unavailable|out of stock|sold out/i.test($("#availability, [itemprop='availability']").text())) stock = "out_of_stock"
  const currency = clean(dataRecord(offer).priceCurrency) || clean($("meta[itemprop='priceCurrency'],meta[property='product:price:currency']").first().attr("content")) || null
  const condition = clean(dataRecord(offer).itemCondition || ld?.itemCondition)
  const itemCondition: ScrapedMerchantFacts["condition"] = /(?:^|\/)NewCondition$/i.test(condition) ? "new"
    : /(?:^|\/)UsedCondition$/i.test(condition) ? "used" : /(?:^|\/)RefurbishedCondition$/i.test(condition) ? "refurbished" : null
  product.sap.name = formatProductName(product.sap.name)
  product.description = merchantDescription(product.description)
  const primaryImages = [ld?.image].flat().map(value => typeof value === "string" ? value : dataRecord(value).url)
    .filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value))
  product.merchantFacts = { gtin, mpn, model: values("model")[0] || product.sap.charDesc || null,
    primaryImages: [...new Set(primaryImages)].slice(0, 12), currency, availability: stock, condition: itemCondition, evidence, issues }
  return product
}
