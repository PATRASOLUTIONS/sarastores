/**
 * SEO Components
 * 
 * Comprehensive SEO utilities for the e-commerce platform including:
 * - Metadata generation
 * - JSON-LD structured data
 * - Open Graph tags
 * - Twitter cards
 */

import { Metadata } from 'next';

// ============================================
// Types
// ============================================

interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  twitter: string;
  locale: string;
}

interface ProductSEO {
  name: string;
  description: string;
  price: number;
  currency?: string;
  image: string;
  images?: string[];
  sku: string;
  brand?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Discontinued';
  url: string;
}

interface CategorySEO {
  name: string;
  description: string;
  image?: string;
  url: string;
  productCount?: number;
}

interface ArticleSEO {
  title: string;
  description: string;
  image?: string;
  url: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface OrganizationSEO {
  name: string;
  url: string;
  logo: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  socialLinks?: string[];
}

// ============================================
// Default Configuration
// ============================================

export const siteConfig: SiteConfig = {
  name: 'Sara Electronics',
  description: 'Your one-stop shop for electronics, appliances, and more. Quality products at competitive prices with fast delivery across India.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://sarastores.com',
  ogImage: '/og',
  twitter: '@saraelectronics',
  locale: 'en_IN',
};

// ============================================
// Metadata Generators
// ============================================

/**
 * Generate base metadata for pages
 */
export function generateMetadata({
  title,
  description,
  image,
  url,
  noIndex = false,
}: {
  title: string;
  description: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = title === siteConfig.name 
    ? title 
    : `${title} | ${siteConfig.name}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: url || siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: image || siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: siteConfig.locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image || siteConfig.ogImage],
      site: siteConfig.twitter,
    },
    robots: noIndex 
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/**
 * Generate metadata for product pages
 */
export function generateProductMetadata(product: ProductSEO): Metadata {
  const title = `${product.name} - Buy Online`;
  const description = product.description.slice(0, 155) + '...';
  
  return {
    title: `${title} | ${siteConfig.name}`,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: product.url,
    },
    openGraph: {
      title,
      description,
      url: product.url,
      siteName: siteConfig.name,
      images: product.images?.map(img => ({
        url: img,
        width: 800,
        height: 800,
        alt: product.name,
      })) || [{ url: product.image, width: 800, height: 800, alt: product.name }],
      locale: siteConfig.locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [product.image],
    },
    other: {
      'product:price:amount': product.price.toString(),
      'product:price:currency': product.currency || 'INR',
      'product:availability': product.availability || 'InStock',
      'product:brand': product.brand || '',
    },
  };
}

/**
 * Generate metadata for category pages
 */
export function generateCategoryMetadata(category: CategorySEO): Metadata {
  const title = `${category.name} - Shop Online`;
  const description = category.description || 
    `Browse our collection of ${category.name}. ${category.productCount ? `${category.productCount}+ products` : 'Wide selection'} with great prices and fast delivery.`;

  return generateMetadata({
    title,
    description,
    image: category.image,
    url: category.url,
  });
}

// ============================================
// JSON-LD Structured Data Generators
// ============================================

/**
 * Generate Product JSON-LD
 */
export function generateProductJsonLd(product: ProductSEO): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images || [product.image],
    sku: product.sku,
    brand: product.brand ? {
      '@type': 'Brand',
      name: product.brand,
    } : undefined,
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: product.url,
      priceCurrency: product.currency || 'INR',
      price: product.price,
      availability: `https://schema.org/${product.availability || 'InStock'}`,
      seller: {
        '@type': 'Organization',
        name: siteConfig.name,
      },
    },
    aggregateRating: product.rating && product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
  };
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate Organization JSON-LD
 */
export function generateOrganizationJsonLd(org: OrganizationSEO): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo,
    description: org.description,
    email: org.email,
    telephone: org.phone,
    address: org.address ? {
      '@type': 'PostalAddress',
      streetAddress: org.address.street,
      addressLocality: org.address.city,
      addressRegion: org.address.state,
      postalCode: org.address.postalCode,
      addressCountry: org.address.country,
    } : undefined,
    sameAs: org.socialLinks,
  };
}

/**
 * Generate WebSite JSON-LD (for sitelinks searchbox)
 */
export function generateWebsiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteConfig.url}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate FAQ JSON-LD
 */
export function generateFAQJsonLd(faqs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate LocalBusiness JSON-LD
 */
export function generateLocalBusinessJsonLd(business: {
  name: string;
  description: string;
  url: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  geo?: { lat: number; lng: number };
  openingHours?: string[];
  priceRange?: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description,
    url: business.url,
    telephone: business.phone,
    email: business.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      addressRegion: business.address.state,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    geo: business.geo ? {
      '@type': 'GeoCoordinates',
      latitude: business.geo.lat,
      longitude: business.geo.lng,
    } : undefined,
    openingHours: business.openingHours,
    priceRange: business.priceRange,
  };
}

// ============================================
// React Components for JSON-LD
// ============================================

/**
 * JsonLd Component for embedding structured data
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * ProductJsonLd Component
 */
export function ProductJsonLd({ product }: { product: ProductSEO }) {
  return <JsonLd data={generateProductJsonLd(product)} />;
}

/**
 * BreadcrumbJsonLd Component
 */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  return <JsonLd data={generateBreadcrumbJsonLd(items)} />;
}

/**
 * OrganizationJsonLd Component
 */
export function OrganizationJsonLd({ org }: { org: OrganizationSEO }) {
  return <JsonLd data={generateOrganizationJsonLd(org)} />;
}

/**
 * WebsiteJsonLd Component
 */
export function WebsiteJsonLd() {
  return <JsonLd data={generateWebsiteJsonLd()} />;
}

/**
 * FAQJsonLd Component
 */
export function FAQJsonLd({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  return <JsonLd data={generateFAQJsonLd(faqs)} />;
}

/**
 * LocalBusinessJsonLd Component
 */
export function LocalBusinessJsonLd({
  business,
}: {
  business: {
    name: string;
    description: string;
    url: string;
    phone: string;
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    geo?: { lat: number; lng: number };
    openingHours?: string[];
    priceRange?: string;
    image?: string;
  };
}) {
  return <JsonLd data={generateLocalBusinessJsonLd(business)} />;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate canonical URL
 */
export function getCanonicalUrl(path: string): string {
  return `${siteConfig.url}${path}`;
}

/**
 * Generate product URL
 */
export function getProductUrl(slug: string): string {
  return `${siteConfig.url}/product/${slug}`;
}

/**
 * Generate category URL
 */
export function getCategoryUrl(slug: string): string {
  return `${siteConfig.url}/category/${slug}`;
}

/**
 * Truncate text for meta descriptions
 */
export function truncateForMeta(text: string, maxLength: number = 155): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Strip HTML tags for meta descriptions
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export default {
  siteConfig,
  generateMetadata,
  generateProductMetadata,
  generateCategoryMetadata,
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
  generateFAQJsonLd,
  generateLocalBusinessJsonLd,
  JsonLd,
  ProductJsonLd,
  BreadcrumbJsonLd,
  OrganizationJsonLd,
  WebsiteJsonLd,
  FAQJsonLd,
  LocalBusinessJsonLd,
  getCanonicalUrl,
  getProductUrl,
  getCategoryUrl,
  truncateForMeta,
  stripHtml,
};
