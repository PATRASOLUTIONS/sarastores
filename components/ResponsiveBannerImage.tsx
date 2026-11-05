"use client"

import SiteImage from '@/components/SiteImage'

/** Retains the uploaded image's natural proportions without a loading overlay. */
export default function ResponsiveBannerImage({
  src, alt, width = 1600, height = 900, sizes, className, decorative = false,
}: {
  src?: string; alt: string; width?: number; height?: number; sizes: string;
  className?: string; decorative?: boolean;
}) {
  const source = src?.trim() || "/placeholder.svg"
  return <SiteImage src={source} alt={alt} width={width} height={height} sizes={sizes}
    style={{ aspectRatio: "auto" }}
    className={className} aria-hidden={decorative || undefined} />
}
