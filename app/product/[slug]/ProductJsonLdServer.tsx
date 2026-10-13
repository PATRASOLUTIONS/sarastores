import { getSeoProduct } from "@/lib/seo-product"
import { absoluteSeoImage, getCompanyName, getSiteSettings } from "@/lib/seo-metadata"
import { getShippingSettings } from "@/lib/order-pricing"
import { safeJsonLd } from "@/lib/jsonld-safe"

export async function ProductJsonLdServer({ slug, origin }: { slug: string; origin: string }) {
  const [product, settings, shipping] = await Promise.all([
    getSeoProduct(slug), getSiteSettings(), getShippingSettings(),
  ])
  if (!product) return null
  const pageUrl = `${origin}/product/${encodeURIComponent(product.slug)}`
  const companyName = getCompanyName(settings)
  const images = product.images.map(image => absoluteSeoImage(image, origin)).filter(Boolean)
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(images.length && { image: images }),
    description: product.description || `Explore ${product.name} at ${companyName}.`,
    sku: product.sku || product.id,
    ...(product.attributes.mpn && { mpn: product.attributes.mpn }),
    ...(product.attributes.gtin && { gtin: product.attributes.gtin }),
    ...(product.brand && { brand: { "@type": "Brand", name: product.brand } }),
    ...(product.category && { category: product.category }),
    ...(product.price && { offers: {
      "@type": "Offer", url: pageUrl, priceCurrency: "INR", price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", "@id": `${origin}#organization`, name: companyName },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: product.price < shipping.freeShippingThreshold ? shipping.shippingFee : 0, currency: "INR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 7, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy", applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 2, merchantReturnLink: `${origin}/returns`,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    } }),
    ...(product.rating && { aggregateRating: {
      "@type": "AggregateRating", ratingValue: product.rating.average,
      reviewCount: product.rating.count, bestRating: 5, worstRating: 1,
    } }),
  }
  const breadcrumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Products", item: `${origin}/products` },
      { "@type": "ListItem", position: 3, name: product.name, item: pageUrl },
    ],
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }} />
  </>
}
