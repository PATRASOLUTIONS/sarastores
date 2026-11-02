import type { CSSProperties } from "react"

export function imageDimension(value?: number | string): number | undefined {
  const parsed = typeof value === "number" ? value : value && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN
  return Number.isFinite(parsed) && Number(parsed) > 0 ? Number(parsed) : undefined
}

function widthSize(value: string): string | undefined {
  if (/^\d+(?:\.\d+)?$/.test(value)) return `${Number(value) * 4}px`
  const pixels = value.match(/^\[(\d+(?:\.\d+)?)px\]$/)
  if (pixels) return `${pixels[1]}px`
  if (value === "full" || value === "screen" || /^\[\d+%\]$/.test(value)) return "100vw"
  if (/^\d+\/\d+$/.test(value)) return `${Number(value.split("/")[0]) / Number(value.split("/")[1]) * 100}vw`
  return undefined
}

/** Only infer a source-set slot when CSS or native dimensions constrain the image. */
export function imageSizes({ sizes, className = "", width, style }: {
  sizes?: string; className?: string; width?: number | string; style?: CSSProperties;
}): string | undefined {
  if (sizes) return sizes
  if (typeof style?.width === "number" && style.width > 0) return `${style.width}px`
  if (typeof style?.width === "string" && /^\d+(?:\.\d+)?px$/.test(style.width)) return style.width
  if (style?.width && style.width !== "auto") return "100vw"
  const breakpoints: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 }
  const slots = new Map<number, string>()
  for (const token of className.split(/\s+/)) {
    const match = token.match(/^(?:(sm|md|lg|xl|2xl):)?w-(.+)$/)
    if (match) {
      const size = widthSize(match[2])
      if (size) slots.set(match[1] ? breakpoints[match[1]] : 0, size)
    }
  }
  if (slots.size) {
    const base = slots.get(0) || "100vw"
    return [...slots].filter(([point]) => point > 0).sort((a, b) => b[0] - a[0])
      .map(([point, size]) => `(min-width: ${point}px) ${size}`).concat(base).join(", ")
  }
  const nativeWidth = imageDimension(width)
  if (nativeWidth) return `${nativeWidth}px`
  // A fixed height also fixes width through the image's intrinsic aspect ratio.
  if (/(?:^|\s)(?:h-\d+(?:\.\d+)?|h-\[\d+(?:\.\d+)?px\])(?:\s|$)/.test(className) ||
      typeof style?.height === "number" || (typeof style?.height === "string" && /^\d+(?:\.\d+)?px$/.test(style.height))) return "100vw"
  // Natural-size/max-size-only images must retain their original pixel dimensions.
  return undefined
}
