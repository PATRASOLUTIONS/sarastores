"use client"

import CategoryGlyph from "@/components/CategoryGlyph"

export type TileItem = { label: string; image?: string }

const isUrl = (value?: string) => !!value && /^(https?:)?\/\/|^\//.test(value)

export default function SubCategoryTiles({
  items,
  selected,
  onToggle,
}: {
  items: TileItem[]
  selected: string[]
  onToggle: (label: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Shop by sub-category"
    >
      {items.map(({ label, image }) => {
        const active = selected.includes(label)
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label)}
            aria-pressed={active}
            className={`flex w-[104px] flex-shrink-0 flex-col items-center gap-1.5 rounded-lg border bg-white px-2 py-2.5 transition-all hover:shadow-sm ${
              active ? "border-[#1560BD] ring-1 ring-[#1560BD]" : "border-gray-200"
            }`}
          >
            <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded bg-gray-50 text-black">
              {isUrl(image) ? (
                // Sub-category artwork comes from many hosts; a plain img avoids loader config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" aria-hidden className="h-full w-full object-contain p-1" />
              ) : (
                <CategoryGlyph label={label} className="h-6 w-6" />
              )}
            </span>
            <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-gray-700">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
