import { catalogueBrand } from "@/lib/product-metadata-sheet"
import { getProductCommerceAttributes } from "@/lib/product-attributes"
import { productImageUrls, isUsableImageUrl } from "@/lib/product-images"
import { isProductUnavailable } from "@/lib/product-availability"
import { purchaseStock } from "@/lib/purchase-validation"
import { qualityText } from "@/lib/catalogue-quality-data"
import { cleanProductName } from "@/utils/cleanProductName"
import { formatProductName } from "@/lib/product-name-format"
import { merchantDescription, hasMerchantRetailerReference } from "@/lib/merchant-product-content"
import { purchaseAvailabilityError } from "@/lib/purchase-validation"
import { getCatalogMRP } from "@/lib/product-display"

export interface MerchantProductInput {
  offerId: string; contentLanguage: "en"; feedLabel: string;
  productAttributes: {
    title: string; description: string; link: string; imageLink: string; additionalImageLinks: string[];
    availability: "IN_STOCK" | "OUT_OF_STOCK"; condition: "NEW"; brand: string;
    price: { amountMicros: string; currencyCode: "INR" };
    gtins?: string[]; mpn?: string; identifierExists: boolean;
  }
}
export interface MerchantPreviewItem {
  id: string; offerId: string; title: string; price: number; stock: number;
  errors: string[]; input: MerchantProductInput | null;
  fields: { description: string; brand: string; gtin: string; mpn: string; imageLink: string; identifierExists: boolean }
}
export function validMerchantGtin(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false
  const digits = value.slice(0, -1).split("").reverse()
  const sum = digits.reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3), 0)
  return (10 - sum % 10) % 10 === Number(value.at(-1))
}
export function merchantOfferId(product: Record<string, unknown>): string {
  return qualityText(product.sku) || qualityText(product.slug) || String(product._id ?? product.id ?? "")
}
export function merchantPreviewItem(product: Record<string, unknown>, origin: string, feedLabel: string, allowOutOfStock = false): MerchantPreviewItem {
  const id = String(product._id ?? product.id ?? "")
  // Match the existing XML offer ID convention. Never substitute SKU for a manufacturer MPN.
  const slug = qualityText(product.slug) || id
  const offerId = merchantOfferId(product)
  const title = formatProductName(cleanProductName(qualityText(product.name)))
  const attributes = getProductCommerceAttributes(product)
  const description = merchantDescription(attributes.seoDescription || product.description)
  const brand = catalogueBrand(product)
  const price = Number(product.price)
  const stock = purchaseStock(product) || 0
  const errors: string[] = []
  const images = productImageUrls([product.image, product.images]).filter(isUsableImageUrl).flatMap(image => {
    try {
      const url = new URL(image, origin)
      return url.protocol === "https:" && !url.username && !url.password && !url.pathname.startsWith("/api/") ? [url.href] : []
    } catch { return [] }
  })
  const stockValue = product.stock ?? product.quantity
  const knownStock = (typeof stockValue === "number" || typeof stockValue === "string") && String(stockValue).trim() !== "" && Number.isSafeInteger(Number(stockValue)) && Number(stockValue) >= 0
  if (!knownStock || product.active !== true || (allowOutOfStock ? purchaseAvailabilityError(product) : isProductUnavailable(product) || stock <= 0)) {
    errors.push(allowOutOfStock ? "Only active products with known, nonnegative stock can be exported." : "Only active, purchasable products with known positive stock can be submitted.")
  }
  if (!offerId || offerId.length > 50 || /[\u0000-\u001f\u007f]/.test(offerId)) errors.push("A stable product ID of at most 50 characters is required.")
  if (!title || title.length > 150) errors.push("A product title of 1–150 characters is required.")
  if (!description || description.length > 5000) errors.push("A product description of 1–5,000 characters is required.")
  if (hasMerchantRetailerReference(description)) errors.push("Review retailer references in the description before submitting.")
  if (!brand) errors.push("The product brand is missing.")
  if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(Math.round(price * 1000000))) errors.push("A valid positive INR selling price is required.")
  const mrp = getCatalogMRP(product)
  if (mrp && price > mrp) errors.push("The selling price exceeds the recorded MRP. Verify both amounts before submitting.")
  if (!images.length) errors.push("A crawlable HTTPS product image in the product image/images fields is required.")
  const gtin = attributes.gtin
  const mpn = attributes.mpn
  if (gtin && !validMerchantGtin(gtin)) errors.push("The GTIN has an invalid length or checksum.")
  if (mpn && (mpn === offerId || mpn.length > 70)) errors.push("Verify the genuine manufacturer MPN; an internal item ID is not accepted as MPN.")
  // An explicit operator assertion is required; missing fields do not establish absence of identifiers.
  const identifiersAbsent = product.identifierExists === false && !gtin && !mpn
  if (!gtin && !mpn && !identifiersAbsent) errors.push("Supply a genuine GTIN/MPN, or explicitly verify that no manufacturer identifiers exist.")
  if (product.condition != null && String(product.condition).toLowerCase() !== "new") errors.push("This initial integration supports new products only.")
  const input: MerchantProductInput = { offerId, contentLanguage: "en", feedLabel, productAttributes: {
    title, description, link: `${origin}/product/${encodeURIComponent(slug)}`, imageLink: images[0] || "",
    additionalImageLinks: images.slice(1, 11), availability: stock > 0 && product.inStock !== false ? "IN_STOCK" : "OUT_OF_STOCK", condition: "NEW", brand,
    price: { amountMicros: String(Math.round(price * 1000000)), currencyCode: "INR" },
    ...(gtin ? { gtins: [gtin] } : {}), ...(mpn ? { mpn } : {}), identifierExists: !identifiersAbsent,
  } }
  return { id, offerId, title, price: Number.isFinite(price) ? price : 0, stock, errors, input: errors.length ? null : input,
    fields: { description: description.slice(0, 5000), brand, gtin: gtin || "", mpn: mpn || "", imageLink: images[0] || "", identifierExists: !identifiersAbsent } }
}
