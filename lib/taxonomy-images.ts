import { TAXONOMY_IMAGES } from "./taxonomy-images.generated"

/**
 * The photo for a division or sub-category label.
 *
 * The generated map is keyed on the catalogue's own spellings, which are typed
 * by hand into spreadsheets and arrive as "REFRIGERATOR", "Refrigerators" and
 * "refrigerator" for the same aisle. Looking the label up literally would
 * therefore miss most of the time, so comparison is on letters and digits
 * alone — the same rule the metadata sheet uses for its column headers.
 */
const normalise = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]/g, "")

const BY_KEY: Map<string, string> = new Map(
  Object.entries(TAXONOMY_IMAGES).map(([label, file]) => [normalise(label), file]),
)

/**
 * Keyword fallbacks for a label that has no photo of its own.
 *
 * A newly created aisle has no image until the fetch script next runs, and a
 * sub-category can be too thin to have produced one at all — "TV 58"" has a
 * single product whose vendor serves a 1.7 KB placeholder. Matching on a
 * keyword keeps those tiles illustrated with the right *kind* of thing rather
 * than falling through to a grey box. Narrower terms first, so "air cooler"
 * does not match the air-conditioner rule.
 */
const KEYWORD_FALLBACKS: Array<[RegExp, string]> = [
  [/aircool/, "air-cooler"],
  [/aircondition/, "air-conditioners"],
  [/dishwash/, "dishwasher"],
  [/wash|washer/, "washing-machine"],
  [/freezer/, "freezer"],
  [/fridge|refrigerat/, "refrigerator"],
  [/tv|televis|panel|oled|qled|led/, "smart-televisions"],
  [/mobile|phone|tablet/, "mobile"],
  [/builtin|oven|microwave|chimney|hob|cook|kitchen/, "home-kitchen"],
  [/accessor|cable|charger/, "accessories"],
  [/appliance/, "home-appliances"],
]

/** `undefined` rather than a placeholder path, so callers choose how to degrade. */
export function taxonomyImage(label: string | null | undefined): string | undefined {
  const key = normalise(String(label || ""))
  if (!key) return undefined

  const exact = BY_KEY.get(key)
  if (exact) return exact

  for (const [pattern, name] of KEYWORD_FALLBACKS) {
    if (!pattern.test(key)) continue
    const match = BY_KEY.get(normalise(name))
    if (match) return match
  }

  return undefined
}
