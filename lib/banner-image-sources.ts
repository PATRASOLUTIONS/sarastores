export const BANNER_IMAGE_WIDTHS = [320, 480, 640, 800, 1080, 1280, 1920] as const

/** Only uploaded public Sara banners use our bounded resize endpoint. */
export function bannerImageSources(source: string, intrinsicWidth?: number) {
  let path = source
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source)
      if (url.protocol !== "https:" || !["sarastores.com", "www.sarastores.com"].includes(url.hostname) || url.port || url.username || url.password) return null
      path = url.pathname
    } catch { return null }
  }
  if (!/^\/api\/banner-images\/[a-f0-9]{32}$/.test(path)) return null
  const widths = BANNER_IMAGE_WIDTHS.filter(width => !intrinsicWidth || width <= intrinsicWidth)
  const defaultWidth = widths.filter(width => width <= 800).at(-1) || widths[0]
  const candidates = widths.map(width => `${path}?w=${width} ${width}w`)
  if (intrinsicWidth && !(BANNER_IMAGE_WIDTHS as readonly number[]).includes(intrinsicWidth)) candidates.push(`${path} ${intrinsicWidth}w`)
  return {
    src: defaultWidth ? `${path}?w=${defaultWidth}` : path,
    srcSet: candidates.join(", "),
  }
}
