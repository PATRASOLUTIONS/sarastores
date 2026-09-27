/**
 * Product image standard ("IMAGE STANDARDISATION" in the BRD).
 *
 * The BRD asks every product for a front, rear, side, lifestyle, dimensions and
 * feature image, a video and a 360 view where available, with a white
 * background on the primary shot. Background colour can't be judged without
 * pixel analysis, so this module covers what is machine-checkable: which roles
 * are present, whether the URLs are usable, and how far a product is from the
 * standard.
 */

export const IMAGE_ROLES = [
  "primary",
  "front",
  "rear",
  "side",
  "lifestyle",
  "dimensions",
  "feature",
  "video",
  "threesixty",
] as const

export type ImageRole = (typeof IMAGE_ROLES)[number]

export const IMAGE_ROLE_LABELS: Record<ImageRole, string> = {
  primary: "Primary (white background)",
  front: "Front",
  rear: "Rear",
  side: "Side",
  lifestyle: "Lifestyle / in-use",
  dimensions: "Dimensions diagram",
  feature: "Feature callout",
  video: "Video",
  threesixty: "360° view",
}

/** Roles a product must have before it is considered launch-ready. */
export const REQUIRED_ROLES: ImageRole[] = ["primary", "front", "rear", "side", "lifestyle"]

/** Nice to have; counted towards the score but never blocking. */
export const OPTIONAL_ROLES: ImageRole[] = ["dimensions", "feature", "video", "threesixty"]

/** Filename fragments that map an existing asset onto a role. */
const ROLE_HINTS: Record<ImageRole, string[]> = {
  primary: ["primary", "main", "hero", "_1.", "-1."],
  front: ["front", "_f.", "-f."],
  rear: ["rear", "back", "_b.", "-b."],
  side: ["side", "left", "right", "profile"],
  lifestyle: ["lifestyle", "inuse", "in-use", "room", "scene", "ambient"],
  dimensions: ["dimension", "size", "spec", "measure"],
  feature: ["feature", "callout", "detail", "closeup", "close-up"],
  video: [".mp4", ".webm", ".mov", "youtube", "vimeo"],
  threesixty: ["360", "spin", "rotate"],
}

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "transparent-pixel",
  "no-image",
  "noimage",
  "default.",
  "modern-laptop-workspace",
]

export function isUsableImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  const url = value.trim().toLowerCase()
  if (!url) return false
  if (PLACEHOLDER_MARKERS.some((marker) => url.includes(marker))) return false
  // Base64 payloads bloat every response that touches the product.
  if (url.startsWith("data:")) return false
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")
}

/** Every distinct, usable asset URL on a product document. */
export function collectProductImages(product: any): string[] {
  const candidates = [
    product?.image,
    ...(Array.isArray(product?.images) ? product.images : []),
    ...(Array.isArray(product?.specification_images) ? product.specification_images : []),
    product?.video,
    ...(Array.isArray(product?.videos) ? product.videos : []),
  ]

  return Array.from(new Set(candidates.filter(isUsableImageUrl)))
}

function roleFor(url: string): ImageRole | null {
  const lower = url.toLowerCase()
  for (const role of IMAGE_ROLES) {
    if (ROLE_HINTS[role].some((hint) => lower.includes(hint))) return role
  }
  return null
}

export interface ImageAudit {
  total: number
  /** Role → the first asset that satisfies it. */
  byRole: Partial<Record<ImageRole, string>>
  missingRequired: ImageRole[]
  missingOptional: ImageRole[]
  /** Assets that could not be attributed to a role. */
  unclassified: string[]
  /** 0–100, weighted so required roles dominate. */
  score: number
  compliant: boolean
}

/**
 * Audit one product against the standard.
 *
 * Explicit `imageRoles` on the document wins; otherwise roles are inferred from
 * filenames, and the first usable asset is assumed to be the primary.
 */
export function auditProductImages(product: any): ImageAudit {
  const images = collectProductImages(product)
  const byRole: Partial<Record<ImageRole, string>> = {}

  const explicit = product?.imageRoles
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    for (const role of IMAGE_ROLES) {
      const value = explicit[role]
      if (isUsableImageUrl(value)) byRole[role] = value
    }
  }

  const unclassified: string[] = []
  for (const url of images) {
    const role = roleFor(url)
    if (role && !byRole[role]) byRole[role] = url
    else if (!role) unclassified.push(url)
  }

  // A product with any usable asset has a primary, even if nothing is named for it.
  if (!byRole.primary && images.length > 0) byRole.primary = images[0]

  const missingRequired = REQUIRED_ROLES.filter((role) => !byRole[role])
  const missingOptional = OPTIONAL_ROLES.filter((role) => !byRole[role])

  const requiredMet = REQUIRED_ROLES.length - missingRequired.length
  const optionalMet = OPTIONAL_ROLES.length - missingOptional.length
  const score = Math.round(
    (requiredMet / REQUIRED_ROLES.length) * 80 + (optionalMet / OPTIONAL_ROLES.length) * 20,
  )

  return {
    total: images.length,
    byRole,
    missingRequired,
    missingOptional,
    unclassified,
    score,
    compliant: missingRequired.length === 0,
  }
}

export interface ImageCoverageSummary {
  products: number
  compliant: number
  averageScore: number
  /** How many products are missing each required role. */
  missingByRole: Record<string, number>
  withNoImages: number
}

export function summariseImageCoverage(products: any[]): ImageCoverageSummary {
  const missingByRole: Record<string, number> = {}
  for (const role of [...REQUIRED_ROLES, ...OPTIONAL_ROLES]) missingByRole[role] = 0

  let compliant = 0
  let scoreTotal = 0
  let withNoImages = 0

  for (const product of products) {
    const audit = auditProductImages(product)
    if (audit.compliant) compliant += 1
    if (audit.total === 0) withNoImages += 1
    scoreTotal += audit.score

    for (const role of [...audit.missingRequired, ...audit.missingOptional]) {
      missingByRole[role] = (missingByRole[role] || 0) + 1
    }
  }

  return {
    products: products.length,
    compliant,
    averageScore: products.length ? Math.round(scoreTotal / products.length) : 0,
    missingByRole,
    withNoImages,
  }
}
