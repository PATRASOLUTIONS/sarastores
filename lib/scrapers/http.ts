import axios, { type AxiosRequestConfig } from "axios"
import * as cheerio from "cheerio"
import { ScraperError, type ScraperSource } from "./types"
import { z } from "zod"

const offerSchema = z.object({ price: z.unknown().optional(), lowPrice: z.unknown().optional(), availability: z.unknown().optional() }).passthrough()
const reviewSchema = z.object({
  reviewRating: z.object({ ratingValue: z.unknown().optional() }).nullish(),
  name: z.unknown().optional(), reviewBody: z.unknown().optional(), description: z.unknown().optional(),
}).passthrough()

const jsonLdNodeSchema = z.object({
  "@type": z.union([z.string(), z.array(z.string())]).optional(),
  name: z.unknown().optional(),
  description: z.unknown().optional(),
  brand: z.union([z.string(), z.object({ name: z.unknown().optional() })]).nullish(),
  sku: z.unknown().optional(),
  productID: z.unknown().optional(),
  image: z.unknown().optional(),
  category: z.unknown().optional(),
  color: z.unknown().optional(),
  mpn: z.unknown().optional(),
  gtin: z.unknown().optional(),
  offers: z.union([offerSchema, z.array(offerSchema)]).nullish().transform((value) => Array.isArray(value) ? value[0] : value),
  aggregateRating: z.object({ ratingValue: z.unknown().optional(), reviewCount: z.unknown().optional(), ratingCount: z.unknown().optional() }).nullish(),
  review: z.union([reviewSchema, z.array(reviewSchema)]).nullish().transform((value) => value == null || Array.isArray(value) ? value : [value]),
  itemListElement: z.array(z.object({ name: z.unknown().optional(), item: z.union([z.string(), z.object({ name: z.unknown().optional() })]).nullish() })).nullish(),
  mainEntity: z.array(z.object({ name: z.unknown().optional(), acceptedAnswer: z.object({ text: z.unknown().optional() }).nullish() })).nullish(),
}).passthrough()

export type JsonLdNode = z.infer<typeof jsonLdNodeSchema>

function isDataRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function dataRecord(value: unknown): Record<string, unknown> {
  return isDataRecord(value) ? value : {}
}

/** Only these hosts are ever fetched server-side. */
const HOST_MAP: { hosts: string[]; source: ScraperSource }[] = [
  { hosts: ["amazon.in", "amazon.com", "amzn.in", "amzn.to"], source: "amazon" },
  { hosts: ["flipkart.com", "dl.flipkart.com", "fkrt.it"], source: "flipkart" },
  { hosts: ["paiinternational.in"], source: "pai" },
  { hosts: ["lg.com"], source: "lg" },
  { hosts: ["reliancedigital.in"], source: "reliance" },
  { hosts: ["vijaysales.com"], source: "vijaysales" },
  { hosts: ["bosch-home.in"], source: "bosch" },
]

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
]

const browserHeaders = () => ({
  "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
  "Sec-Ch-Ua": '"Chromium";v="121", "Not(A:Brand";v="24", "Google Chrome";v="121"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
})

/**
 * Resolves a URL to a known source by hostname. A substring check would let
 * `https://internal-host/amazon.in/` through and turn this into an SSRF.
 */
export function detectSource(rawUrl: string): ScraperSource | null {
  let parsed: URL
  try {
    parsed = new URL(String(rawUrl).trim())
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (parsed.username || parsed.password || parsed.port) return null

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  for (const entry of HOST_MAP) {
    if (entry.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return entry.source
  }
  return null
}

export async function fetchBoundedText(
  url: string,
  allowed: (url: string) => boolean,
  options: Pick<AxiosRequestConfig, "headers" | "timeout"> = {},
): Promise<{ html: string; finalUrl: string; status: number }> {
  let current = url
  const deadline = Date.now() + (options.timeout ?? 30000)
  for (let hop = 0; hop <= 5; hop++) {
    if (!allowed(current)) throw new ScraperError("Redirect destination is not permitted", 400)
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new ScraperError("Source request timed out", 504)
    const response = await axios.get<string>(current, {
      ...options,
      timeout: remaining,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
      maxBodyLength: 8 * 1024 * 1024,
      validateStatus: () => true,
      responseType: "text",
      transformResponse: [(value: string) => value],
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location: unknown = response.headers.location
      if (typeof location !== "string" || !location || hop === 5) {
        throw new ScraperError("Source returned an invalid redirect chain", 422)
      }
      try {
        current = new URL(location, current).toString()
      } catch {
        throw new ScraperError("Source returned an invalid redirect", 422)
      }
      const setCookie = response.headers["set-cookie"]
      const cookies = (Array.isArray(setCookie) ? setCookie : typeof setCookie === "string" ? [setCookie] : [])
        .map((value) => value.split(";")[0]?.trim())
        .filter((value): value is string => !!value)
      if (cookies.length) options = { ...options, headers: { ...options.headers, Cookie: cookies.join("; ") } }
      continue
    }
    if (typeof response.data !== "string") throw new ScraperError("Source did not return text", 422)
    return { html: response.data, finalUrl: current, status: response.status }
  }
  throw new ScraperError("Source returned too many redirects", 422)
}

export async function fetchHtml(url: string, timeout = 30000): Promise<{ html: string; finalUrl: string }> {
  if (!detectSource(url)) {
    throw new ScraperError("URL is not from a supported source", 400)
  }

  let lastStatus = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchBoundedText(url, candidate => detectSource(candidate) === detectSource(url), {
      headers: browserHeaders(),
      timeout,
    })
    lastStatus = res.status

    if (res.status === 200) {
      const html = res.html
      if (/captcha|are you a robot|automated access/i.test(html.slice(0, 4000))) {
        throw new ScraperError("The site served a bot check instead of the product page", 429, "Retry in a minute, or paste the details manually.")
      }
      return { html, finalUrl: res.finalUrl }
    }
    if (res.status === 403 || res.status === 429) break
    await new Promise((r) => setTimeout(r, 800 + attempt * 700))
  }

  if (lastStatus === 403 || lastStatus === 429) {
    throw new ScraperError(`The site refused the request (HTTP ${lastStatus})`, 429, "This source blocks automated fetches. Enter the details manually.")
  }
  throw new ScraperError(`Could not load the page (HTTP ${lastStatus})`, 422)
}

/**
 * Companion JSON endpoint on an already-validated host. Returns null instead of
 * throwing: every caller has an HTML fallback, so a flaky API must degrade the
 * result rather than fail the scrape.
 */
export async function fetchJson<T = unknown>(url: string, timeout = 20000): Promise<T | null> {
  if (!detectSource(url)) return null
  try {
    const res = await fetchBoundedText(url, candidate => detectSource(candidate) === detectSource(url), {
      headers: { ...browserHeaders(), Accept: "application/json, text/plain, */*" },
      timeout,
    })
    if (res.status !== 200) throw new ScraperError("Companion endpoint did not return success", 422)
    return JSON.parse(res.html)
  } catch (error) {
    console.warn("[Scraper] Companion JSON endpoint unavailable", error instanceof Error ? error.name : "UnknownError")
    return null
  }
}


export function isShortLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "fkrt.it") return true
    if (host === "dl.flipkart.com") return !/\/p\/[^/]+/i.test(parsed.pathname)
    return host.endsWith("flipkart.com") && /^\/s(?:\/|$)/.test(parsed.pathname)
  } catch {
    return false
  }
}

/** A Flipkart deep link that already identifies a product, even before the www hop. */
function canonicalFlipkartProduct(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (detectSource(parsed.toString()) !== "flipkart") return null
  const path = parsed.pathname.replace(/^\/dl(?=\/)/i, "")
  if (!/\/p\/[^/]+/i.test(path) && !parsed.searchParams.has("pid")) return null
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  if (host === "dl.flipkart.com" || host === "fkrt.it") {
    parsed.hostname = "www.flipkart.com"
    parsed.pathname = path
  }
  return parsed.toString()
}

/** A same-source product URL hidden in a short-link interstitial. */
function embeddedProductUrl(html: string, base: string, source: ScraperSource): string | null {
  const decoded = html.replace(/\\\//g, "/")
  const found = [
    ...decoded.matchAll(/https?:\/\/[^"'\\\s<>]+/gi),
    ...decoded.matchAll(/\burl=([^"'>\s]+)/gi),
    ...decoded.matchAll(/(?:href|content|location(?:\.href)?)\s*=\s*["']([^"']+)/gi),
  ].map((match) => match[1] || match[0])
  const products: string[] = []
  const others: string[] = []
  for (const candidate of found) {
    try {
      const next = new URL(decodeURIComponent(candidate), base).toString()
      const canonical = source === "flipkart" ? canonicalFlipkartProduct(next) : null
      if (canonical) products.push(canonical)
      else if (detectSource(next) === source && !isShortLink(next)) others.push(next)
    } catch {
      /* keep looking */
    }
  }
  return products[0] ?? others[0] ?? null
}

/** Follows a short link by reading the redirect header — far cheaper than downloading the page. */
export async function resolveRedirect(url: string): Promise<string> {
  const source = detectSource(url)
  if (!source) throw new ScraperError("Unsupported short link", 400)
  const res = await fetchBoundedText(url, candidate => detectSource(candidate) === source, {
    headers: browserHeaders(),
    timeout: 25000,
  })
  const landed = canonicalFlipkartProduct(res.finalUrl)
  if (landed && !isShortLink(res.finalUrl)) return res.status === 200 ? res.finalUrl : landed
  if (landed) return landed
  if (res.status !== 200) throw new ScraperError("Could not resolve short link", 422)
  if (!isShortLink(res.finalUrl)) return res.finalUrl
  const next = embeddedProductUrl(res.html, res.finalUrl, source)
  if (!next) return res.finalUrl
  const product = canonicalFlipkartProduct(next)
  if (product || !isShortLink(next)) return product || next
  const resolved = await fetchBoundedText(next, candidate => detectSource(candidate) === source, {
    headers: browserHeaders(),
    timeout: 25000,
  })
  if (resolved.status !== 200) throw new ScraperError("Could not resolve short link", 422)
  return isShortLink(resolved.finalUrl) ? next : resolved.finalUrl
}

/** Every JSON-LD node on the page, flattened through `@graph`. */
export function jsonLdNodes(html: string): JsonLdNode[] {
  const $ = cheerio.load(html)
  const nodes: JsonLdNode[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).contents().text())
      const graph = dataRecord(parsed)["@graph"]
      const arr: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(graph) ? graph : [parsed]
      for (const value of arr) {
        const node = jsonLdNodeSchema.safeParse(value)
        if (node.success) nodes.push(node.data)
        else console.warn("[Scraper] Ignoring invalid JSON-LD node")
      }
    } catch (error) {
      console.warn("[Scraper] Ignoring malformed JSON-LD block", error instanceof Error ? error.name : "UnknownError")
    }
  })
  return nodes
}

export function findLdType(html: string, type: string): JsonLdNode | null {
  const wanted = type.toLowerCase()
  return (
    jsonLdNodes(html).find((n) => {
      const t = n?.["@type"]
      const list = Array.isArray(t) ? t : [t]
      return list.some((x) => String(x ?? "").toLowerCase() === wanted)
    }) ?? null
  )
}

/** Next.js pages router embeds its server props here; often the richest source. */
export function nextData<T = unknown>(html: string): T | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/**
 * Reassembles the React server-component payload that the App Router streams as
 * `self.__next_f.push([1,"…"])` chunks. LG's entire product record lives here
 * and nowhere else in the served HTML.
 */
export function flightPayload(html: string): string {
  const chunks: string[] = []
  const re = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`))
    } catch {
      /* one bad chunk must not lose the rest of the stream */
    }
  }
  return chunks.join("")
}

/** Reads the balanced `{…}` / `[…]` literal that starts at `from`. */
function balancedSlice(text: string, from: number): string | null {
  const open = text[from]
  const close = open === "{" ? "}" : open === "[" ? "]" : ""
  if (!close) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return text.slice(from, i + 1)
    }
  }
  return null
}

/**
 * Pulls the value of `"key":` out of a raw JSON-ish blob. Used on payloads that
 * are too large and too deeply nested to parse wholesale.
 */
export function jsonAfterKey<T = unknown>(text: string, key: string, occurrence = 0): T | null {
  const needle = `"${key}":`
  let at = -1
  for (let i = 0; i <= occurrence; i++) {
    at = text.indexOf(needle, at + 1)
    if (at < 0) return null
  }
  let cursor = at + needle.length
  while (cursor < text.length && /\s/.test(text[cursor])) cursor++
  const raw = balancedSlice(text, cursor)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Like `jsonAfterKey`, but only matches where the value is an array. Bosch's
 * i18n bundle reuses keys such as `specifications` and `highlights` for label
 * objects, and those come first in the payload.
 */
export function jsonArrayAfterKey<T = unknown>(text: string, key: string): T[] {
  const re = new RegExp(`"${key}"\\s*:\\s*\\[`, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = balancedSlice(text, m.index + m[0].length - 1)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed as T[]
    } catch {
      /* keep looking */
    }
  }
  return []
}

/** Every value of `"key":` in the blob, in document order. */
export function allStringsAfterKey(text: string, key: string): string[] {
  const out: string[] = []
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    try {
      out.push(JSON.parse(`"${m[1]}"`))
    } catch {
      /* skip */
    }
  }
  return out
}

/**
 * Reads a `window.<name> = {…}` store out of served HTML. Flipkart and Reliance
 * Digital both hydrate from one, and it is the only place either publishes the
 * spec table. Single-quoted strings appear in these blobs, so brace counting
 * has to be quote-aware.
 */
export function windowState<T = unknown>(html: string, name = "__INITIAL_STATE__"): T | null {
  const at = html.indexOf(`window.${name}`)
  if (at < 0) return null
  const from = html.indexOf("{", at)
  if (from < 0) return null
  let depth = 0
  let inStr = false
  let quote = ""
  let esc = false
  for (let i = from; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === quote) inStr = false
      continue
    }
    if (c === '"' || c === "'") {
      inStr = true
      quote = c
      continue
    }
    if (c === "{") depth++
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(from, i + 1))
      } catch {
        return null
      }
    }
  }
  return null
}


export function toPrice(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.]/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim()
