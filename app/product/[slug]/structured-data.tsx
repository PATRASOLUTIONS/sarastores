import React from "react";
import Script from "next/script";
import { cleanProductName, cleanProductDescription } from "@/utils/cleanProductName";
import { safeJsonLd } from "@/lib/jsonld-safe";

export function ProductJsonLd({ product, companyName, pageUrl, imageUrl }: { product: any, companyName: string, pageUrl: string, imageUrl: string }) {
  if (!product) return null;

  // Clean product name and description
  const cleanedName = cleanProductName(product.name);
  const cleanedDescription = cleanProductDescription(product.description);

  // Collect all product images
  const allImages = [
    imageUrl,
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.specification_images) ? product.specification_images : []),
  ].filter((img, idx, arr) => img && arr.indexOf(img) === idx); // Remove duplicates and falsy values

  // Calculate discount info
  const price = product.price || 0;
  const mrp = product.mrp || product.originalPrice || 0;
  const hasDiscount = mrp > price && price > 0;

  // Build review data if available
  const reviewData = product.reviews;
  const hasReviews = reviewData && (
    (typeof reviewData.average === 'number' && reviewData.average > 0) ||
    (typeof reviewData.count === 'number' && reviewData.count > 0)
  );

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
      "name": product.brand || companyName || "Brand"
    },
    "category": product.category || undefined,
    "offers": {
      "@type": "Offer",
      "url": pageUrl,
      "priceCurrency": "INR",
      "price": price,
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": companyName || "Sara Electronics"
      },
      ...(hasDiscount && {
        "priceSpecification": {
          "@type": "PriceSpecification",
          "price": price,
          "priceCurrency": "INR",
          "valueAddedTaxIncluded": true
        }
      })
    }
  };

  // Add aggregate rating if reviews are available
  if (hasReviews) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": reviewData.average || 4.0,
      "reviewCount": reviewData.count || 1,
      "bestRating": 5,
      "worstRating": 1
    };
  }

  // Add individual reviews if available
  if (Array.isArray(reviewData?.top) && reviewData.top.length > 0) {
    data.review = reviewData.top.slice(0, 5).map((r: any) => ({
      "@type": "Review",
      "author": r.author ? { "@type": "Person", "name": r.author } : undefined,
      "datePublished": r.date || r.createdAt || undefined,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": r.rating || 5,
        "bestRating": 5,
        "worstRating": 1
      },
      "name": r.title || "Review",
      "reviewBody": r.body || r.title || ""
    }));
  }

  // Clean up undefined values
  const cleanData = JSON.parse(JSON.stringify(data));

  return (
    <Script
      id={`product-jsonld-${product.id || product.sku || 'main'}`}
      type="application/ld+json"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(cleanData) }}
    />
  );
}
