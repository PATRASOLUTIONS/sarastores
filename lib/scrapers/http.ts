import axios from "axios"
import * as cheerio from "cheerio"
import { ScraperError, type ScraperSource } from "./types"

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

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  for (const entry of HOST_MAP) {
    if (entry.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return entry.source
  }
  return null
}

export async function fetchHtml(url: string, timeout = 30000): Promise<{ html: string; finalUrl: string }> {
  if (!detectSource(url)) {
    throw new ScraperError("URL is not from a supported source", 400)
  }

  let lastStatus = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await axios.get(url, {
      headers: browserHeaders(),
      timeout,
      maxRedirects: 5,
      validateStatus: () => true,
      responseType: "text",
      transformResponse: [(d) => d],
    })
    lastStatus = res.status

    if (res.status === 200) {
      const html = String(res.data ?? "")
      if (/captcha|are you a robot|automated access/i.test(html.slice(0, 4000))) {
        throw new ScraperError("The site served a bot check instead of the product page", 429, "Retry in a minute, or paste the details manually.")
      }
      return { html, finalUrl: res.request?.res?.responseUrl || url }
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
export async function fetchJson<T = any>(url: string, timeout = 20000): Promise<T | null> {
  if (!detectSource(url)) return null
  try {
    const res = await axios.get(url, {
      headers: { ...browserHeaders(), Accept: "application/json, text/plain, */*" },
      timeout,
      maxRedirects: 3,
      validateStatus: (s) => s === 200,
    })
    return res.data as T
  } catch {
    return null
  }
}


/** Follows a short link by reading the redirect header — far cheaper than downloading the page. */
export async function resolveRedirect(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: browserHeaders(),
    timeout: 25000,
    maxRedirects: 0,
    validateStatus: (s) => s < 400,
    responseType: "text",
    transformResponse: [(d) => d],
  })
  const location = res.headers?.location
  if (typeof location === "string" && location) {
    const absolute = new URL(location, url).toString()
    if (!detectSource(absolute)) throw new ScraperError("Short link redirected off the expected site", 400)
    return absolute
  }
  return res.request?.res?.responseUrl || url
}

/** Every JSON-LD node on the page, flattened through `@graph`. */
export function jsonLdNodes(html: string): any[] {
  const $ = cheerio.load(html)
  const nodes: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text())
      const arr = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed]
      nodes.push(...arr)
    } catch {
      /* a malformed block must not sink the whole scrape */
    }
  })
  return nodes
}

export function findLdType(html: string, type: string): any | null {
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
export function nextData(html: string): any | null {
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
export function jsonAfterKey<T = any>(text: string, key: string, occurrence = 0): T | null {
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
export function jsonArrayAfterKey<T = any>(text: string, key: string): T[] {
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
export function windowState(html: string, name = "__INITIAL_STATE__"): any | null {
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
