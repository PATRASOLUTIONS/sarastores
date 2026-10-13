"use client"

import { Check, GitCompareArrows } from "lucide-react"
import { toast } from "react-hot-toast"
import { useCompare } from "@/hooks/useCompare"

export default function CompareProductButton({ productId, name }: { productId: string; name: string }) {
  const { compareIds, addToCompare, removeFromCompare, isInCompare } = useCompare()
  const selected = isInCompare(productId)

  return <button
    type="button"
    aria-label={`${selected ? "Remove" : "Add"} ${name} ${selected ? "from" : "to"} comparison`}
    aria-pressed={selected}
    onClick={(event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!productId.trim() || productId.trim().length >= 100) {
        toast.error("This product cannot be added to comparison")
        return
      }
      if (selected) {
        removeFromCompare(productId)
        toast.success("Removed from comparison")
      } else if (compareIds.length >= 6) {
        toast.error("You can compare up to 6 products. Remove one to add another.")
      } else {
        addToCompare(productId)
        toast.success("Added to comparison")
      }
    }}
    className={`mt-2 flex min-h-8 w-full items-center justify-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
      selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-500 hover:text-blue-600"
    }`}
  >
    {selected ? <Check size={14} aria-hidden="true" /> : <GitCompareArrows size={14} aria-hidden="true" />}
    {selected ? "Added to Compare" : "Compare"}
  </button>
}
