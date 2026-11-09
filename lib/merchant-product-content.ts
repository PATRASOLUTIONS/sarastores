import { qualityText } from "@/lib/catalogue-quality-data"

/** Remove copied retailer calls to action, preserving the product facts between them. */
export function merchantDescription(value: unknown): string {
  return qualityText(value)
    .replace(/\bBuy\b[^.!?]*\bonline at best price[^.!?]*[.!?]?\s*/gi, "")
    .replace(/\bCompare\b[^.!?]*\b(?:shop|buy) at (?:Flipkart|Amazon|Croma|Reliance Digital)[^.!?]*[.!?]?\s*/gi, "")
    .replace(/\s+/g, " ").trim()
}

export function hasMerchantRetailerReference(value: string): boolean {
  return /flipkart|croma|reliance digital|amazon\.(?:in|com)|\b(?:shop|buy|sold|available|order)\b[^.!?]{0,60}\b(?:at|on|from)\s+amazon\b/i.test(value)
}
