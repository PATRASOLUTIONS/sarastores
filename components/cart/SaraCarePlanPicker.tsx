"use client"

import { useId } from "react"
import { formatSaraCarePrice, saraCareDurationLabel, type SaraCareYears } from "@/lib/sara-care-types"

export default function SaraCarePlanPicker({ options, value, onChange, disabled = false, label }: {
  options: Array<{ years: SaraCareYears; price: number }>
  value: SaraCareYears | null
  onChange: (years: SaraCareYears | null) => void
  disabled?: boolean
  label: string
}) {
  const id = useId()
  return <div className="min-w-0">
    <label htmlFor={id} className="sr-only">{label}</label>
    <select id={id} value={value ?? ""} disabled={disabled} onChange={event => onChange(Number(event.target.value))}
      className="h-10 w-full rounded-xl border border-[#d2d2d7] bg-white px-3 text-xs font-medium text-[#1d1d1f] outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:opacity-50">
      {value === null && <option value="" disabled>Choose a duration</option>}
      {options.map(option => <option key={option.years} value={option.years}>{saraCareDurationLabel(option.years)} - {formatSaraCarePrice(option.price)} per device</option>)}
    </select>
  </div>
}
