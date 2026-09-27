/**
 * ProductJsonLdServer — Server-rendered Product + Breadcrumb JSON-LD.
 * This component fetches product data server-side and emits structured
 * data that is guaranteed to be in the initial HTML (no JS required).
 */

import { connectToDatabase } from "@/lib/mongodb"
import { cleanProductName, cleanProductDescription } from "@/utils/cleanProductName"

async function getProduct(slug: string) {
  try {
    const { db } = await connectToDatabase()
    let product = null
    // Try slug first, then ObjectId, then string id
    product = await db.collection('products').findOne({ slug })
    if (!product) {
      try {
        const { ObjectId } = await import('mongodb')
        product = await db.collection('products').findOne({ _id: new ObjectId(slug) })
      } catch {
        product = await db.collection('products').findOne({ id: slug })
      }
    }
    return product
  } catch {
    return null
  }
}

export async function ProductJsonLdServer({ slug, origin }: { slug: string; origin: string }) {
  const product = await getProduct(slug)
  if (!product) return null

  const cleanedName = cleanProductName(product.name)
  const cleanedDescription = cleanProductDescription(product.description)

  const allImages = [
    product.image,
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.specification_images) ? product.specification_images : []),
  ].filter((img: string, idx: number, arr: string[]) => img && arr.indexOf(img) === idx)

  const imageUrl = product.image
    ? (product.image.startsWith('http') ? product.image : `${origin}${product.image.startsWith('/') ? '' : '/'}${product.image}`)
    : `${origin}/og-image.jpg`

  const price = product.price || 0
  const mrp = product.mrp || product.originalPrice || 0

  const pageUrl = `${origin}/product/${product.slug || slug}`

  const data: Record<string, any> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": cleanedName,
    "image": allImages.length > 0 ? allImages : [imageUrl],
    "description": cleanedDescription || `Shop ${cleanedName} online at best prices`,
    "sku": product.sku || product.id,
    "mpn": product.sku || undefined,
    "gtin": product.gtin || product.ean || undefined,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Brand"
    },
    "category": product.category || undefined,
    "offers": {
      "@type": "Offer",
      "url": pageUrl,
      "priceCurrency": "INR",
      "price": price,
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "Sara Electronics"
      },
      // Google shows shipping and returns annotations in Shopping and free
      // listings only when these are declared; without them the result is
      // eligible but visibly thinner than competitors'.
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": product.free_delivery || price >= 499 ? 0 : 99,
          "currency": "INR"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 3,
            "maxValue": 8,
            "unitCode": "DAY"
          }
        }
      },
      // Mirrors the published policy: replacement only, reported within 48 h.
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "IN",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 2,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      }
    }
  }

  // Add aggregate rating if reviews exist
  const reviewData = product.reviews
  if (reviewData && typeof reviewData.average === 'number' && reviewData.average > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": reviewData.average,
      "reviewCount": reviewData.count || 1,
      "bestRating": 5,
      "worstRating": 1
    }
  }

  // Clean undefined values
  const cleanData = JSON.parse(JSON.stringify(data))

  // Build breadcrumb items
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: origin },
    { "@type": "ListItem", position: 2, name: "Products", item: `${origin}/products` },
    { "@type": "ListItem", position: 3, name: cleanedName, item: pageUrl },
  ]

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  )
}
