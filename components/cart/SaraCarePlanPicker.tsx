"use client"

import type { SaraCareYears } from "@/lib/sara-care-types"

export default function SaraCarePlanPicker({ options, value, onChange, disabled = false, label }: {
  options: Array<{ years: SaraCareYears; price: number }>
  value: SaraCareYears | null
  onChange: (years: SaraCareYears | null) => void
  disabled?: boolean
  label: string
}) {
  return <div role="group" aria-label={label}>
    <p className="mb-1.5 text-xs font-semibold text-[#0F2557]">Choose protection duration</p>
    <div className="flex flex-wrap gap-1.5">
      {([1, 2, 3] as SaraCareYears[]).map(years => {
        const option = options.find(option => option.years === years)
        const selected = value === years
        return <button key={years} type="button" disabled={disabled || !option} aria-pressed={selected}
          aria-label={`${years} ${years === 1 ? "year" : "years"} Sara Care${option ? `, ₹${option.price} per device` : ", unavailable"}`}
          onClick={() => onChange(years)}
          className={`min-w-[64px] flex-1 rounded-md border px-2 py-2 text-center text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[#1560BD] bg-[#1560BD] text-white" : "border-blue-200 bg-white text-[#0F2557] hover:border-[#1560BD]"}`}>
          <span className="block font-semibold">{years} {years === 1 ? "year" : "years"}</span>
          <span className="mt-1 block text-[10px] leading-4">{option ? `₹${option.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Unavailable"}</span>
        </button>
      })}
    </div>
    <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => onChange(null)}
      className={`mt-2 min-h-8 w-full rounded-md border px-2 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${value === null ? "border-[#1560BD] bg-blue-50 font-semibold text-[#1560BD]" : "border-gray-200 bg-white text-gray-600"}`}>No Sara Care</button>
    <p className="mt-1 text-[10px] leading-4 text-gray-500">Prices per device, including GST. Available durations depend on the product.</p>
  </div>
}
