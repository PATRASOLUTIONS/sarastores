// Shared by Next configuration and image components; keep the optimizer allowlist identical.
export const remoteImagePatterns = [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.gstatic.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "static.wixstatic.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.blob.core.windows.net" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.vercel-storage.com" },
      // Product-source CDNs the scrapers return URLs from. Without these,
      // next/image rejects every scraped image with a 400.
      { protocol: "https", hostname: "**.flixcart.com" },
      { protocol: "https", hostname: "**.jiostore.online" },
      { protocol: "https", hostname: "**.fynd.com" },
      { protocol: "https", hostname: "**.bsh-group.com" },
      { protocol: "https", hostname: "**.bosch-home.com" },
      { protocol: "https", hostname: "**.paiinternational.in" },
      { protocol: "https", hostname: "**.vijaysales.com" },
      { protocol: "https", hostname: "www.lg.com" },
      { protocol: "https", hostname: "electronicparadise.in", pathname: "/cdn/shop/**" },
    ]

/** @param {string} source */
export function canOptimizeImage(source) {
  if (source.startsWith('/') && !source.startsWith('//')) {
    let path
    try { path = decodeURIComponent(new URL(source, 'https://www.sarastores.com').pathname) } catch { return false }
    return !/^\/api(?:\/|$)/i.test(path) && !path.toLowerCase().endsWith('.svg')
  }
  try {
    const url = new URL(source)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname.toLowerCase().endsWith('.svg')) return false
    return remoteImagePatterns.some(pattern => {
      const suffix = pattern.hostname.startsWith('**.') ? pattern.hostname.slice(3) : null
      const hostMatches = suffix ? url.hostname.endsWith('.' + suffix) : url.hostname === pattern.hostname
      return hostMatches && (!pattern.pathname || url.pathname.startsWith(pattern.pathname.slice(0, -2)))
    })
  } catch {
    return false
  }
}
