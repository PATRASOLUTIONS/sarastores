import { z } from "zod"
import { catalogProductResponseSchema } from "@/utils/catalog"

const text = z.string().nullish()
const banner = z.object({ url: z.string(), alt: z.string(), link: text })
const category = z.object({ url: z.string(), title: z.string(), description: z.string(), link: text })
const reason = z.object({ icon: z.string(), title: z.string(), description: z.string() })

export const brandLandingResponseSchema = z.object({
  name: z.string().min(1),
  slug: z.string(),
  enabled: z.boolean().nullish(),
  isEnabled: z.boolean().nullish(),
  active: z.boolean().nullish(),
  landingPageEnabled: z.boolean().nullish(),
  logo: text,
  tagline: text,
  description: text,
  trustBadgeBg: text,
  banners: z.array(banner).nullish(),
  categories: z.array(category).nullish(),
  features: z.array(z.object({ icon: z.string(), text: z.string(), color: z.string() })).nullish(),
  trustBadges: z.array(z.object({ icon: z.string(), iconColor: z.string(), bgColor: z.string(), title: z.string(), subtitle: z.string() })).nullish(),
  heroContent: z.object({
    title: text, titleStyle: text, subtitle: text, description: text,
    ctaText: text, ctaLink: text, ctaColor: text, secondaryCta: text,
  }).nullish(),
  productsSection: z.object({
    badge: text, badgeColor: text, heading: text, subtitle: text, manufacturerFilter: text,
    maxProducts: z.number().int().positive().nullish(), ctaText: text, ctaLink: text,
  }).nullish(),
  categorySection: z.object({ badge: text, badgeColor: text, heading: text, subtitle: text }).nullish(),
  whyChoose: z.object({ title: text, heading: text, subtitle: text, reasons: z.array(reason).nullish() }).nullish(),
  leadFormEnabled: z.boolean().nullish(),
  leadFormSource: text,
}).transform(brand => {
  const name = brand.name
  const shopLink = `/products?brand=${encodeURIComponent(name)}`
  return {
    ...brand,
    logo: brand.logo ?? "",
    tagline: brand.tagline ?? "",
    description: brand.description ?? "",
    banners: brand.banners ?? [],
    categories: brand.categories ?? [],
    features: brand.features ?? [],
    trustBadges: brand.trustBadges ?? [],
    heroContent: {
      title: brand.heroContent?.title ?? name.toUpperCase(),
      titleStyle: brand.heroContent?.titleStyle ?? undefined,
      subtitle: brand.heroContent?.subtitle ?? brand.tagline ?? "",
      description: brand.heroContent?.description ?? (brand.description || `Shop genuine ${name} products at SARA.`),
      ctaText: brand.heroContent?.ctaText ?? `Shop ${name} Products`,
      ctaLink: brand.heroContent?.ctaLink ?? shopLink,
      ctaColor: brand.heroContent?.ctaColor ?? "from-[#1560BD] to-[#0F2557]",
      secondaryCta: brand.heroContent?.secondaryCta ?? "",
    },
    productsSection: {
      badge: brand.productsSection?.badge ?? "Featured Products",
      badgeColor: brand.productsSection?.badgeColor ?? "bg-blue-50 text-blue-600",
      heading: brand.productsSection?.heading ?? `Shop ${name} Products`,
      subtitle: brand.productsSection?.subtitle ?? "",
      manufacturerFilter: brand.productsSection?.manufacturerFilter ?? name.toLowerCase(),
      maxProducts: brand.productsSection?.maxProducts ?? 12,
      ctaText: brand.productsSection?.ctaText ?? `View All ${name} Products`,
      ctaLink: brand.productsSection?.ctaLink ?? shopLink,
    },
    categorySection: {
      badge: brand.categorySection?.badge ?? "Explore Categories",
      badgeColor: brand.categorySection?.badgeColor ?? "bg-blue-50 text-blue-600",
      heading: brand.categorySection?.heading ?? `${name} Product Categories`,
      subtitle: brand.categorySection?.subtitle ?? "",
    },
    whyChoose: {
      title: brand.whyChoose?.title ?? `Why Choose ${name}`,
      heading: brand.whyChoose?.heading ?? `Why Choose ${name}?`,
      subtitle: brand.whyChoose?.subtitle ?? "",
      reasons: brand.whyChoose?.reasons ?? [],
    },
    leadFormEnabled: brand.leadFormEnabled === true,
  }
})
export type BrandLanding = z.infer<typeof brandLandingResponseSchema>
export const brandEditorResponseSchema = brandLandingResponseSchema.innerType().extend({
  _id: z.string().min(1),
  accentColor: text,
  accentColorFrom: text,
  accentColorTo: text,
  heroBgFrom: text,
  heroBgTo: text,
}).transform(raw => {
  const brand = brandLandingResponseSchema.parse(raw)
  return {
    ...brand,
    _id: raw._id,
    enabled: raw.enabled ?? true,
    accentColor: raw.accentColor ?? "blue",
    accentColorFrom: raw.accentColorFrom ?? "from-blue-600",
    accentColorTo: raw.accentColorTo ?? "to-blue-500",
    heroBgFrom: raw.heroBgFrom ?? "from-black/60",
    heroBgTo: raw.heroBgTo ?? "to-transparent",
    trustBadgeBg: raw.trustBadgeBg ?? "from-blue-900 via-blue-800 to-blue-900",
    leadFormSource: raw.leadFormSource ?? `${raw.name} Brand Page`,
    banners: brand.banners.map(value => ({ ...value, link: value.link ?? undefined })),
    categories: brand.categories.map(value => ({ ...value, link: value.link ?? undefined })),
  }
})
export const brandEditorListSchema = z.object({ success: z.literal(true), brands: z.array(brandEditorResponseSchema) })
export const brandLandingEnvelopeSchema = z.object({ success: z.literal(true), brand: brandLandingResponseSchema })
export const brandProductResponseSchema = catalogProductResponseSchema.extend({ manufacturer: text })
export const brandProductListResponseSchema = z.array(brandProductResponseSchema)
export type BrandProduct = z.infer<typeof brandProductResponseSchema>
