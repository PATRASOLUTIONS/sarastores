import {
  AirVent,
  Armchair,
  Cable,
  Camera,
  CookingPot,
  Fan,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  Microwave,
  Monitor,
  Refrigerator,
  ShoppingBag,
  Smartphone,
  Speaker,
  Tv,
  Utensils,
  WashingMachine,
  Watch,
  Wind,
} from "lucide-react"

export type CategoryIcon = typeof ShoppingBag

/**
 * Keyword → icon. Order matters: narrower terms are listed first so
 * "air cooler" doesn't fall through to the air-conditioner rule.
 */
const RULES: Array<[RegExp, CategoryIcon]> = [
  [/air\s*cool/i, Fan],
  [/air\s*condition|\bac\b|\bacs\b/i, AirVent],
  [/dish\s*wash/i, Utensils],
  [/washing\s*machine|washer|dryer/i, WashingMachine],
  [/fridge|refrigerat|freezer/i, Refrigerator],
  [/micro\s*wave|\boven\b|built\s*in/i, Microwave],
  [/chimney|\bhob\b|cook\s*top|kitchen|cook/i, CookingPot],
  [/\btv\b|televis|panel|oled|qled|\bled\b/i, Tv],
  [/monitor|display|projector/i, Monitor],
  [/mobile|phone|tablet/i, Smartphone],
  [/laptop|computer|\bpc\b|desktop/i, Laptop],
  [/head\s*phone|ear\s*phone|ear\s*bud/i, Headphones],
  [/speaker|audio|sound\s*bar|home\s*theat/i, Speaker],
  [/watch|wearable|fitness\s*band/i, Watch],
  [/camera|\bdslr\b/i, Camera],
  [/gaming|console/i, Gamepad2],
  [/accessor|cable|charger|adapter/i, Cable],
  [/purifier|vacuum|geyser|heater/i, Wind],
  [/\bfan\b/i, Fan],
  [/furniture|sofa|mattress/i, Armchair],
  [/appliance/i, Home],
]

/** Vector icon for a category or sub-category label; never returns undefined. */
export function categoryIcon(label?: string): CategoryIcon {
  const value = String(label || "")
  for (const [pattern, icon] of RULES) {
    if (pattern.test(value)) return icon
  }
  return ShoppingBag
}
