/**
 * Clean product name by removing unwanted prefixes like "Amazon.in:", category suffixes, etc.
 * This ensures clean display across the application and in SEO/social sharing.
 */

// Patterns to remove from product names
const UNWANTED_PATTERNS = [
  // Prefixes
  /^Amazon\.in:\s*/i,
  /^Amazon\.in\s*[-:]\s*/i,
  /^Amazon\s*[-:]\s*/i,
  /^Flipkart\.com:\s*/i,
  /^Flipkart\s*[-:]\s*/i,
  // Suffixes - Amazon.in variations
  /:\s*Amazon\.in\s*$/i,
  /\s*-\s*Amazon\.in\s*$/i,
  /\s*\|\s*Amazon\.in\s*$/i,
  /\s*Amazon\.in\s*$/i,
  // Suffixes - Flipkart variations
  /:\s*Flipkart\.com\s*$/i,
  /\s*-\s*Flipkart\.com\s*$/i,
  /\s*\|\s*Flipkart\.com\s*$/i,
  // Category suffixes
  /:\s*Home\s*&\s*Kitchen\s*$/i,
  /:\s*Electronics\s*$/i,
  /:\s*Computers\s*&\s*Accessories\s*$/i,
  /:\s*Home\s*Improvement\s*$/i,
  /:\s*Sports,\s*Fitness\s*&\s*Outdoors\s*$/i,
  /:\s*Beauty\s*$/i,
  /:\s*Health\s*&\s*Personal\s*Care\s*$/i,
  /:\s*Clothing\s*&\s*Accessories\s*$/i,
  /:\s*Toys\s*&\s*Games\s*$/i,
  /:\s*Office\s*Products\s*$/i,
  /:\s*Garden\s*&\s*Outdoors\s*$/i,
  /:\s*Musical\s*Instruments\s*$/i,
  /:\s*Pet\s*Supplies\s*$/i,
  /:\s*Baby\s*Products\s*$/i,
  /:\s*Grocery\s*&\s*Gourmet\s*Foods\s*$/i,
  /:\s*Industrial\s*&\s*Scientific\s*$/i,
  /:\s*Large\s*Appliances\s*$/i,
  /:\s*Small\s*Appliances\s*$/i,
];

/**
 * Cleans a product name by removing marketplace prefixes and category suffixes
 * @param name - The raw product name
 * @returns Cleaned product name
 */
export function cleanProductName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  
  let cleaned = name.trim();
  
  // Apply all patterns - run multiple passes to catch nested patterns
  let prevCleaned = '';
  while (prevCleaned !== cleaned) {
    prevCleaned = cleaned;
    for (const pattern of UNWANTED_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleaned.trim();
  }
  
  // Clean up any double spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Cleans a product description by removing marketplace references
 * @param description - The raw product description
 * @returns Cleaned product description
 */
export function cleanProductDescription(description: string | null | undefined): string {
  if (!description || typeof description !== 'string') return '';

  let cleaned = description.trim();

  // Remove Amazon.in and Flipkart.com references from description
  cleaned = cleaned.replace(/Amazon\.in/gi, '');
  cleaned = cleaned.replace(/Flipkart\.com/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

const MARKETPLACE_NOISE = /(amazon|flipkart)\.in|home\s*&\s*kitchen|home\s+and\s+kitchen|see more product details|product description|free delivery by|emi from|amazon\.com|amazon prime|prime delivery/i

/**
 * Pick a sub-category label from any of the legacy fields the catalog uses.
 */
function pickSubCategory(p: any): string {
  if (!p) return ""
  return (
    p.subCategory ||
    p.sub_category ||
    p.subcategory ||
    p.prod_desc ||
    p.subCategoryProdDesc ||
    p.groupName ||
    p.category ||
    ""
  )
}

/**
 * Pick a brand label. Prefer the explicit manufacturer / brand field;
 * fall back to the first word of the cleaned name (e.g. "Bosch" out of
 * "Bosch KGN56LB42I...").
 */
function pickBrand(p: any, cleanNameStr: string): string {
  if (p) {
    const explicit =
      p.manufacturerName ||
      p.manufacturer_name ||
      p.brand ||
      (Array.isArray(p.brands) ? p.brands[0] : "")
    if (explicit && typeof explicit === "string") {
      return explicit.trim()
    }
  }
  if (cleanNameStr) {
    const m = cleanNameStr.match(/^([A-Z][A-Za-z&]+)\b/)
    if (m) return m[1]
  }
  return ""
}

/**
 * Generate a fallback product description from name + sub-category +
 * brand. Used when the DB has an empty or low-quality description so the
 * storefront never shows a blank or duplicated-name "Product Description"
 * block.
 *
 * Mirrors the logic in `scripts/backfill-descriptions.js` so the
 * server-rendered HTML always has *something* useful, even for products
 * the script has not yet touched.
 */
export function generateProductDescription(product: {
  name?: string | null
  subCategory?: string | null
  sub_category?: string | null
  subcategory?: string | null
  category?: string | null
  groupName?: string | null
  manufacturerName?: string | null
  manufacturer_name?: string | null
  brand?: string | null
  char_desc?: string | null
  characteristics?: string | null
} | null | undefined): string {
  if (!product) return ""
  const rawName = (product.name || "").toString().trim()
  const cleanedName = cleanProductName(rawName)
  const subCategory = pickSubCategory(product).toString().trim()
  const brand = pickBrand(product, cleanedName)
  const charDesc = (
    product.char_desc ||
    product.characteristics ||
    ""
  )
    .toString()
    .trim()

  if (!cleanedName && !rawName) return ""

  const lead = cleanedName || rawName
  const cat = subCategory ? subCategory.toLowerCase() : "product"
  const sentences: string[] = [`${lead}.`]

  if (brand && subCategory) {
    sentences.push(
      `A ${cat} from ${brand} designed to bring reliable performance and modern styling to your home.`
    )
  } else if (subCategory) {
    sentences.push(
      `A modern ${cat} built to bring reliable performance and everyday convenience to your home.`
    )
  } else if (brand) {
    sentences.push(
      `Brought to you by ${brand} — engineered for everyday reliability and modern styling.`
    )
  }

  if (
    charDesc &&
    charDesc.length > 30 &&
    !MARKETPLACE_NOISE.test(charDesc) &&
    charDesc.toLowerCase() !== (cleanedName || rawName).toLowerCase()
  ) {
    sentences.push(charDesc.replace(/\s+/g, " "))
  }

  sentences.push(
    "Free delivery across India, easy 7-day returns, secure checkout — backed by Sara Electronics."
  )

  return sentences.join(" ")
}

/**
 * Returns a usable product description: the cleaned DB value when it
 * looks meaningful, otherwise a generated fallback built from the
 * product's name/category/brand. Use this anywhere the UI would
 * otherwise risk showing a blank or name-as-description block.
 */
export function ensureProductDescription(
  product: Parameters<typeof generateProductDescription>[0] & { description?: string | null }
): string {
  const cleaned = cleanProductDescription(product?.description)
  const cleanedName = cleanProductName(product?.name)

  // Treat these as "no real description" cases:
  //  - empty / whitespace only
  //  - contains marketplace boilerplate
  //  - just a copy of the product name
  const isJunk =
    !cleaned ||
    MARKETPLACE_NOISE.test(cleaned) ||
    (cleanedName.length > 20 && cleaned.trim().toLowerCase() === cleanedName.toLowerCase())

  if (!isJunk) return cleaned
  return generateProductDescription(product)
}

export default cleanProductName;
