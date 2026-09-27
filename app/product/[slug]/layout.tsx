// 'use server'

import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { getOriginFromHeaders } from '@/lib/seo-metadata'
import { cleanProductName, cleanProductDescription } from '@/utils/cleanProductName'
import { ProductJsonLdServer } from './ProductJsonLdServer'

// Helper to format price in INR
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

// Helper to get product with specification images and full details
async function getProductWithSpecs(slug: string) {
  try {
    const { db } = await connectToDatabase()

    // Get product from products collection — try slug first, then ObjectId, then string id
    let product = null
    product = await db.collection('products').findOne({ slug })
    if (!product) {
      try {
        const { ObjectId } = await import('mongodb')
        product = await db.collection('products').findOne({ _id: new ObjectId(slug) })
      } catch {
        product = await db.collection('products').findOne({ id: slug })
      }
    }

    if (!product) return null

    // Get specification images and additional details from product_specifications collection using SKU
    if (product.sku) {
      const specs = await db.collection('product_specifications').findOne({ sku: product.sku })
      if (specs) {
        if (Array.isArray(specs.specification_images) && specs.specification_images.length > 0) {
          product.specification_images = specs.specification_images
        }
        // Merge MRP from specs if not present in product
        if (!product.mrp && specs.mrp) {
          product.mrp = specs.mrp
        }
      }
    }

    return product
  } catch (error) {
    console.error('Error fetching product for metadata:', error)
    return null
  }
}

// Helper to get settings
async function getSettings() {
  try {
    const { db } = await connectToDatabase()
    return await db.collection('settings').findOne({})
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  // Absolute URLs matter here — WhatsApp and other crawlers ignore relative ones.
  const origin = await getOriginFromHeaders()

  try {
    const [product, settings] = await Promise.all([
      getProductWithSpecs(slug),
      getSettings(),
    ])

    if (!product) {
      return {
        title: 'Product Not Found',
        description: 'The requested product could not be found.',
      }
    }

    const companyName = settings?.companyName || settings?.siteName || 'Sara Electronics'
    // Use cleaned product name (removes "Amazon.in:" etc.) for clean sharing
    const title = cleanProductName(product.name)
    const fullTitle = `${title}${companyName ? ` | ${companyName}` : ''}`

    // Get price info for description
    const price = product.price || 0
    const mrp = product.mrp || product.originalPrice || 0
    const hasDiscount = mrp > price && price > 0
    const discountPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0
    
    // Format price string for description
    const priceStr = price > 0 ? formatPrice(price) : ''
    const mrpStr = hasDiscount ? formatPrice(mrp) : ''
    
    // Build a rich description with price info (like Amazon/Flipkart)
    const baseDesc = product.description
      ? String(product.description).replace(/<[^>]*>/g, '').trim()
      : ''
    
    // Short description for social sharing with price
    let shortDesc = ''
    if (priceStr) {
      if (hasDiscount) {
        shortDesc = `${priceStr} (${discountPercent}% off) - `
      } else {
        shortDesc = `${priceStr} - `
      }
    }
    shortDesc += baseDesc.slice(0, 120).trim()
    if (baseDesc.length > 120) shortDesc += '...'
    if (!shortDesc) shortDesc = `Shop ${product.name} online at best prices.`

    // Priority for social sharing images: Main Product Image -> Images[0] -> Specification Image
    const rawImage =
      product.image ||
      (product.images?.length > 0 && product.images[0]) ||
      (product.specification_images?.length > 0 && product.specification_images[0])

    // Ensure image URL is absolute
    const imageUrl = rawImage
      ? (rawImage.startsWith('http') ? rawImage : `${origin}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`)
      : `${origin}/og-image.jpg`

    const pageUrl = `${origin}/product/${product.slug || slug}`

    // Determine stock availability
    const stock = product.stock ?? 0
    const availability = stock > 0 ? 'instock' : 'outofstock'
    const schemaAvailability = stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'

    // Build keywords from product name, category, and brand
    const keywords = [
      product.name,
      product.category,
      product.brand,
      product.sku,
      'buy online',
      'best price',
      'India',
      companyName,
    ].filter(Boolean).join(', ')

    // Complete metadata for SEO and social sharing
    return {
      title: fullTitle,
      description: shortDesc,
      keywords: keywords,
      metadataBase: new URL(origin),
      alternates: {
        canonical: pageUrl,
        languages: {
          "en-IN": pageUrl,
          "x-default": pageUrl,
        },
      },
      // Open Graph - comprehensive product metadata
      openGraph: {
        title: title,
        description: shortDesc,
        url: pageUrl,
        siteName: companyName,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: product.name,
            type: 'image/jpeg',
          },
        ],
        locale: 'en_IN',
        type: 'website',
      },
      // Twitter Card
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: shortDesc,
        images: [imageUrl],
        creator: settings?.twitterHandle || undefined,
        site: settings?.twitterHandle || undefined,
      },
      // Additional meta tags for product pages
      other: {
        // Product-specific Open Graph tags (for e-commerce)
        'product:price:amount': price > 0 ? String(price) : undefined,
        'product:price:currency': 'INR',
        'product:availability': availability,
        'product:condition': 'new',
        'product:retailer_item_id': product.sku || slug,
        'product:brand': product.brand || companyName,
        'product:category': product.category || undefined,
        // Original price for discount display
        ...(hasDiscount && { 'product:original_price:amount': String(mrp) }),
        ...(hasDiscount && { 'product:original_price:currency': 'INR' }),
        // Additional SEO tags
        'og:price:amount': price > 0 ? String(price) : undefined,
        'og:price:currency': 'INR',
        'og:availability': availability,
        // WhatsApp specific
        'og:updated_time': new Date().toISOString(),
        // Schema.org hints
        'product:sku': product.sku || undefined,
      },
      // Robots directives
      robots: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
      // Verification and other
      ...(settings?.googleSiteVerification && {
        verification: {
          google: settings.googleSiteVerification,
        },
      }),
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Product',
      description: 'View product details',
    }
  }
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const origin = await getOriginFromHeaders()

  return (
    <>
      <ProductJsonLdServer slug={slug} origin={origin} />
      {children}
    </>
  )
}
