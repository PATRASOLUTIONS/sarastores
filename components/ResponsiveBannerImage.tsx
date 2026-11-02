"use client"

import Image from "next/image"
import { useState } from "react"
import { canOptimizeImage } from "@/lib/image-sources.mjs"

/** Retains the uploaded image's natural proportions without a loading overlay. */
export default function ResponsiveBannerImage({
  src, alt, width = 1600, height = 900, sizes, className, decorative = false,
}: {
  src?: string; alt: string; width?: number; height?: number; sizes: string;
  className?: string; decorative?: boolean;
}) {
  const source = src?.trim() || "/placeholder.svg"
  const [failedSource, setFailedSource] = useState<string>()
  const current = failedSource === source ? "/placeholder.svg" : source
  return <Image src={current} alt={alt} width={width} height={height} sizes={sizes}
    style={{ aspectRatio: "auto" }}
    className={className} aria-hidden={decorative || undefined}
    unoptimized={!canOptimizeImage(current)}
    onError={() => { if (current !== "/placeholder.svg") setFailedSource(source) }} />
}
