"use client"

import NextImage from "next/image"
import { useState, type ImgHTMLAttributes, type Ref } from "react"
import { canOptimizeImage } from "@/lib/image-sources.mjs"
import { imageDimension, imageSizes } from "@/lib/image-sizing"

type SiteImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src" | "srcSet"> & {
  alt: string; src?: string; ref?: Ref<HTMLImageElement>; unoptimized?: boolean; priority?: boolean;
}

/** Next images with native sizing and caller-owned error handling preserved. */
export default function SiteImage({
  src, width, height, sizes, className, style, onError, loading, fetchPriority,
  unoptimized = false, priority = false, ref, ...props
}: SiteImageProps) {
  const source = src?.trim() || "/placeholder.svg"
  const [replacement, setReplacement] = useState<{ source: string; src: string }>()
  const isReplacement = replacement?.source === source
  const current = replacement && isReplacement ? replacement.src : source
  const nativeWidth = imageDimension(width)
  const nativeHeight = imageDimension(height)
  const resolvedSizes = imageSizes({ sizes, className, width, style })
  const optimized = !unoptimized && !isReplacement && Boolean(resolvedSizes) && canOptimizeImage(current)
  return <NextImage {...props} ref={ref} src={current}
    width={nativeWidth || 1600} height={nativeHeight || 900}
    data-site-auto-width={nativeWidth === undefined ? "" : undefined}
    data-site-auto-height={nativeHeight === undefined ? "" : undefined}
    data-site-auto-ratio={nativeWidth === undefined || nativeHeight === undefined ? "" : undefined}
    sizes={resolvedSizes} className={className} style={style}
    unoptimized={!optimized}
    loading={loading || (priority || fetchPriority === "high" ? "eager" : "lazy")}
    fetchPriority={fetchPriority} priority={priority && loading !== "lazy"}
    onError={event => {
      // Recover from optimizer errors before a caller replaces the photo.
      if (optimized) {
        event.currentTarget.removeAttribute('srcset')
        setReplacement({ source, src: source })
        return
      }
      // A failed placeholder must not restart the same request repeatedly.
      if (!onError || isReplacement && current !== source) return
      const image = event.currentTarget
      const before = image.getAttribute("src")
      onError(event)
      const after = image.getAttribute("src")
      if (after && after !== before) {
        image.removeAttribute("srcset")
        setReplacement({ source, src: after })
      }
    }} />
}
