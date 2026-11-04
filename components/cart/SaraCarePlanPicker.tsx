"use client"

import { useId } from "react"
import { Check } from "lucide-react"
import { formatSaraCarePrice, saraCareDurationLabel, type SaraCareYears } from "@/lib/sara-care-types"

export default function SaraCarePlanPicker({ options, value, onChange, disabled = false, label }: {
  options: Array<{ years: SaraCareYears; price: number }>
  value: SaraCareYears | null
  onChange: (years: SaraCareYears | null) => void
  disabled?: boolean
  label: string
}) {
  const id = useId()
  const preferred = [1, 2, 3, 0.5]
  const rank = (years: number) => preferred.includes(years) ? preferred.indexOf(years) : preferred.length + years
  return <fieldset disabled={disabled} aria-label={label} className="min-w-0">
    <legend className="mb-1.5 text-[11px] font-medium text-gray-500">Choose your protection plan</legend>
    <div className="flex flex-wrap gap-1.5">{[...options].sort((a, b) => rank(a.years) - rank(b.years)).map(option => {
      const checked = value === option.years
      return <label key={option.years} className={`relative min-w-[76px] flex-1 basis-[76px] cursor-pointer rounded-md border px-2 py-1.5 transition-colors ${checked ? 'border-[#1560BD] bg-blue-50 shadow-[inset_0_0_0_1px_#1560BD]' : 'border-gray-200 bg-white hover:border-gray-400'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input type="radio" name={`${id}-duration`} value={option.years} checked={checked} onChange={() => onChange(option.years)} className="peer sr-only" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1560BD]" />
        <span className="flex items-center justify-between gap-1 text-xs font-semibold"><span className="min-w-0 break-words">{saraCareDurationLabel(option.years)}</span>{checked && <Check size={12} className="shrink-0 text-[#1560BD]" aria-hidden="true" />}</span>
        <span className="mt-0.5 block break-words text-[11px] font-medium tabular-nums">{formatSaraCarePrice(option.price)}</span>
      </label>
    })}</div>
  </fieldset>
}
