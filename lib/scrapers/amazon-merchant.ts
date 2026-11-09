import * as cheerio from "cheerio"
import { fetchHtml, findLdType, clean, toPrice } from "./http"
import { emptyProduct, ScraperError } from "./types"
import { enrichMerchantFacts } from "./merchant-facts"

/** Read-only Amazon adapter for the enrichment workflow; ASIN is never a GTIN/MPN. */
export async function scrapeAmazonMerchant(url: string) {
  const { html, finalUrl } = await fetchHtml(url)
  const $ = cheerio.load(html), ld = findLdType(html, "Product")
  const product = emptyProduct("amazon", finalUrl)
  product.sap.name = clean($("#productTitle").text()) || clean(ld?.name)
  if (!product.sap.name) throw new ScraperError("Amazon did not expose a product page. Use an exact manufacturer/supplier link.", 422)
  product.externalId = finalUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] || null
  product.sap.brand = typeof ld?.brand === "string" ? clean(ld.brand) : clean(ld?.brand?.name)
  $("#productOverview_feature_div tr").each((_, row) => {
    const cells = $(row).find("td")
    if (/^brand$/i.test(clean(cells.first().text()))) product.sap.brand ||= clean(cells.last().text())
  })
  product.sap.price = toPrice($("#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen").first().text()) || toPrice(ld?.offers?.price)
  product.mrp = toPrice($("#corePrice_feature_div .a-text-price .a-offscreen").first().text())
  product.features = $("#feature-bullets li .a-list-item").map((_, item) => clean($(item).text())).get().filter(Boolean).slice(0, 30)
  product.description = clean($("#productDescription").text()) || clean(ld?.description) || product.features.join(" ")
  const image = $("#landingImage").attr("data-old-hires") || $("#landingImage").attr("src")
  const images = [image, ...[ld?.image].flat()].filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value))
  product.images = [...new Set(images)].slice(0, 12)
  const result = enrichMerchantFacts(product, html)
  if (!result.merchantFacts?.currency && /₹|INR/.test($("#corePrice_feature_div, #corePriceDisplay_desktop_feature_div").text())) result.merchantFacts!.currency = "INR"
  return result
}
