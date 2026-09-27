import { getDocumentProxy } from "unpdf"
import { ingestImage, type StoredImage } from "../media-ingest"
import { clean, toPrice } from "./http"
import { emptyProduct, ScraperError, type ScrapedProduct } from "./types"

/**
 * Vendor spec sheets and EDM flyers.
 *
 * A naive text dump loses the table structure that makes a spec sheet useful,
 * because PDF text is a bag of positioned glyph runs with no notion of rows or
 * columns. So every run is bucketed back into visual lines by its baseline, then
 * split into cells wherever the horizontal gap is wider than a space. That
 * reconstructs "label | value" tables, which is what the rest of this reads.
 */

interface Cell {
  x: number
  text: string
}

interface Line {
  page: number
  y: number
  size: number
  cells: Cell[]
}

/** Brands the catalogue already carries, longest first so "LG" can't shadow a longer match. */
const KNOWN_BRANDS = [
  "Bosch",
  "Samsung",
  "Whirlpool",
  "Godrej",
  "Panasonic",
  "Hitachi",
  "Electrolux",
  "Kelvinator",
  "Voltas Beko",
  "Voltas",
  "Haier",
  "Hisense",
  "Liebherr",
  "Siemens",
  "Sharp",
  "Blue Star",
  "Lloyd",
  "Daikin",
  "Carrier",
  "Realme",
  "Motorola",
  "Xiaomi",
  "Sony",
  "TCL",
  "Onida",
  "Croma",
  "Bajaj",
  "Havells",
  "Philips",
  "IFB",
  "LG",
].sort((a, b) => b.length - a.length)

/** Labels that introduce the manufacturer's model code. */
const MODEL_KEYS =
  /^(model(\s*(name|no\.?|number|code))?|art(icle)?\s*(no\.?|number)|e[\s-]?nr\.?|item\s*(code|no\.?)|product\s*code|sku)$/i

/** Rows that are page furniture rather than product data. */
const NOISE = /^(page\s*\d|www\.|https?:|©|copyright|all rights reserved|terms|disclaimer|e\s*&\s*oe)/i

/** Marketing bullets are prose, not specifications. */
const BULLET = /^[\u2022\u25aa\u25e6\u2023*\-\u2013\u2014]\s*/

async function readLines(bytes: Uint8Array): Promise<{ lines: Line[]; pages: number; chars: number; meta: string }> {
  let pdf: any
  try {
    // pdf.js takes ownership of the array it is handed and detaches it, which
    // would leave the caller holding an empty buffer for the image pass.
    pdf = await getDocumentProxy(new Uint8Array(bytes))
  } catch {
    throw new ScraperError("That file could not be opened as a PDF", 400)
  }

  const lines: Line[] = []
  let chars = 0
  const pages = Math.min(pdf.numPages, 20)

  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Bucket runs by baseline. Rounding to whole points is too strict — a run
    // that sits a fraction lower still belongs to the same visual row.
    const rows = new Map<number, { y: number; size: number; items: Cell[] }>()
    for (const item of content.items as any[]) {
      const text = String(item?.str ?? "")
      if (!text.trim()) continue
      chars += text.length
      const x = Number(item?.transform?.[4] ?? 0)
      const y = Number(item?.transform?.[5] ?? 0)
      const size = Math.abs(Number(item?.transform?.[3] ?? item?.height ?? 10)) || 10
      const key = Math.round(y / 3)
      const row = rows.get(key) ?? { y, size, items: [] }
      row.size = Math.max(row.size, size)
      row.items.push({ x, text })
      rows.set(key, row)
    }

    for (const row of rows.values()) {
      row.items.sort((a, b) => a.x - b.x)
      const cells: Cell[] = []
      let current: Cell | null = null
      let previousEnd = -Infinity
      for (const item of row.items) {
        // A gap wider than roughly one character is a column break, not a space.
        const gap = item.x - previousEnd
        if (!current || gap > row.size * 0.9) {
          current = { x: item.x, text: item.text }
          cells.push(current)
        } else {
          current.text += (gap > row.size * 0.15 ? " " : "") + item.text
        }
        previousEnd = item.x + item.text.length * row.size * 0.5
      }
      const cleaned = cells
        // Spec sheets pad label/value columns with leader dots; they are layout,
        // not content, and they otherwise swallow the value.
        .map((c) => ({ x: c.x, text: clean(c.text.replace(/\.{2,}/g, " ")) }))
        .filter((c) => c.text)
      if (cleaned.length) lines.push({ page: p, y: row.y, size: row.size, cells: cleaned })
    }
  }

  lines.sort((a, b) => a.page - b.page || b.y - a.y)

  // Vendor logos are usually artwork, so the brand often survives only here.
  let meta = ""
  try {
    const info = (await pdf.getMetadata())?.info ?? {}
    meta = [info.Title, info.Author, info.Subject, info.Keywords, info.Creator].filter(Boolean).join(" ")
  } catch {
    /* metadata is optional */
  }
  return { lines, pages, chars, meta }
}

/** Counts embedded raster images without decoding them. */
async function countImages(bytes: Uint8Array): Promise<number> {
  return (await embeddedImages(bytes)).length
}

/**
 * Pulls the raster images out of a PDF.
 *
 * `DCTDecode` streams are literally JPEG files, so their bytes can be lifted
 * straight out with no decoding step. Other filters (Flate, JPX) would need a
 * full raster decode and are skipped — vendor spec sheets use JPEG for
 * photography and Flate only for line art and logos, which we do not want.
 */
async function embeddedImages(bytes: Uint8Array): Promise<Uint8Array[]> {
  try {
    const { PDFDocument, PDFRawStream, PDFName } = await import("pdf-lib")
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    const out: Uint8Array[] = []
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue
      const dict = obj.dict
      if (dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue
      if (!/DCTDecode/.test(dict.get(PDFName.of("Filter"))?.toString() ?? "")) continue
      out.push(obj.getContents())
    }
    return out
  } catch (error) {
    console.error("[pdf] embedded image extraction failed:", error)
    return []
  }
}

export async function scrapePdf(bytes: Uint8Array, filename: string): Promise<ScrapedProduct> {
  const product = emptyProduct("pdf", filename)
  const { lines, pages, chars, meta } = await readLines(bytes)

  if (chars < 40) {
    const images = await countImages(bytes)
    throw new ScraperError(
      "This PDF has no text layer — it is a flattened image",
      422,
      images > 0
        ? `The file is ${images} image(s) with no selectable text, which is normal for EDM flyers. Ask the vendor for the spec sheet PDF, or type the details in manually.`
        : "Ask the vendor for a spec-sheet PDF rather than a flyer.",
    )
  }

  const allText = lines.map((l) => l.cells.map((c) => c.text).join(" ")).join("\n")

  // ---- specifications -------------------------------------------------
  const specs: Record<string, string> = {}
  const addSpec = (rawKey: string, rawValue: string) => {
    const key = clean(rawKey).replace(/[:\s]+$/, "")
    const value = clean(rawValue)
    if (!key || !value || key === value) return
    if (key.length < 2 || key.length > 60 || value.length > 400) return
    if (NOISE.test(key) || /^[\d.,%\s]+$/.test(key)) return
    if (!specs[key]) specs[key] = value
  }

  /** A wrapped title can land on the same baseline as the first spec row. When
   *  the value is itself a complete `Label: Value`, that inner pair is the real
   *  one and the prose to its left is layout. */
  const pair = (key: string, value: string) => {
    const inner = value.match(/^([A-Za-z][^:]{1,50}?):\s*(.{1,300})$/)
    if (inner && /,/.test(key)) return addSpec(inner[1], inner[2])
    addSpec(key, value)
  }

  for (const line of lines) {
    const joined = line.cells.map((c) => c.text).join(" ")
    if (BULLET.test(line.cells[0].text)) continue
    if (line.cells.length >= 2) {
      // Spec sheets often run two label/value pairs across one row.
      for (let i = 0; i + 1 < line.cells.length; i += 2) {
        pair(line.cells[i].text, line.cells[i + 1].text)
      }
      if (line.cells.length === 3) pair(line.cells[0].text, line.cells.slice(1).map((c) => c.text).join(" "))
    } else {
      const m = joined.match(/^(.{2,60}?)\s*[:\u2013]\s*(.{1,400})$/)
      if (m) addSpec(m[1], m[2])
    }
  }
  product.technicalDetails = specs

  // ---- identity -------------------------------------------------------
  const haystack = `${allText}\n${meta}\n${filename}`
  const brand = KNOWN_BRANDS.find((b) => new RegExp(`\\b${b.replace(/ /g, "\\s+")}\\b`, "i").test(haystack)) ?? ""
  product.sap.brand = brand

  const modelFromSpec = Object.entries(specs).find(([k]) => MODEL_KEYS.test(k))?.[1] ?? ""
  const modelPattern = /\b(?=[A-Z0-9-]{5,20}\b)(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z][A-Z0-9-]{4,19}\b/g
  let model = clean(modelFromSpec).split(/\s+/)[0] ?? ""
  if (!modelPattern.test(model)) {
    modelPattern.lastIndex = 0
    const counts = new Map<string, number>()
    for (const token of allText.match(modelPattern) ?? []) {
      if (/^(MODEL|SERIES|ENERGY|RATING|WARRANTY|PRODUCT|FEATURES?)$/i.test(token)) continue
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
    model = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
  }
  product.sap.charDesc = model
  product.externalId = model || null

  // The product name is the largest run of text on the first page. Long titles
  // wrap, so keep every line set in that size.
  const firstPage = lines.filter((l) => l.page === 1)
  const biggest = Math.max(0, ...firstPage.map((l) => l.size))
  const title = firstPage
    .filter((l) => l.size >= biggest - 0.5)
    .map((l) => l.cells.map((c) => c.text).join(" "))
    .filter((t) => t.length > 2 && !NOISE.test(t))
    .join(" ")
    .slice(0, 160)
  product.sap.name = clean(
    specs["Product name"] ?? specs["Product Name"] ?? title ?? [brand, model].filter(Boolean).join(" "),
  )

  // ---- money ----------------------------------------------------------
  const money = (label: RegExp) => {
    const hit = Object.entries(specs).find(([k]) => label.test(k))?.[1]
    if (hit) return toPrice(hit.replace(/[^\d.]/g, ""))
    // The label is an alternation, so it has to be grouped or the capture below
    // binds to its last branch only.
    const m = allText.match(new RegExp(`(?:${label.source})[^\\d₹]{0,20}[₹Rs.\\s]*([\\d,]{3,})`, "i"))
    return m?.[1] ? toPrice(m[1].replace(/,/g, "")) : null
  }
  product.mrp = money(/\bm\.?r\.?p\.?\b|maximum retail price|list price/i)
  product.sap.price = money(/\b(selling|net|offer|dealer|best)\s*price\b/i)
  if (product.mrp == null && product.sap.price == null) {
    const first = allText.match(/₹\s*([\d,]{3,})/)
    product.mrp = first ? toPrice(first[1].replace(/,/g, "")) : null
  }

  // ---- narrative ------------------------------------------------------
  const bullets = lines
    .filter((l) => BULLET.test(l.cells[0].text))
    .map((l) => clean(l.cells.map((c) => c.text).join(" ").replace(BULLET, "")))
    .filter((t) => t.length > 8 && t.length < 260 && !NOISE.test(t))
  product.features = [...new Set(bullets)].slice(0, 12)
  product.description = product.features.slice(0, 4).join(" ")

  for (const [k, v] of Object.entries(specs)) {
    if (/warranty/i.test(k) && !product.warranty) product.warranty = v
    if (/^(in the box|box contents|sales package|accessories included)$/i.test(k)) {
      product.whatsIncluded = v.split(/,|\r?\n/).map(clean).filter(Boolean)
    }
  }

  const embedded = await embeddedImages(bytes)
  const stored: StoredImage[] = []
  for (const raw of embedded.slice(0, 12)) {
    try {
      // Spec sheets embed the brand logo and icons alongside the product shot;
      // the size floor keeps those out of the gallery.
      stored.push(await ingestImage(raw, { minWidth: 300 }))
    } catch {
      /* a logo or an undecodable stream — skip it */
    }
  }
  // Widest first: the hero shot is almost always the largest asset in the file.
  stored.sort((a, b) => b.width * b.height - a.width * a.height)
  product.images = stored.map((s) => s.url)

  product.manufacturerInfo = [
    `Imported from ${filename} — ${pages} page(s), ${Object.keys(specs).length} specification rows.`,
    stored.length
      ? `${stored.length} image(s) imported from the PDF.`
      : embedded.length
        ? `${embedded.length} embedded image(s) were too small to use; add product photos separately.`
        : "",
  ]
    .filter(Boolean)
    .join("\n")

  if (Object.keys(specs).length === 0 && product.features.length === 0) {
    throw new ScraperError(
      "The PDF had readable text but no specification table",
      422,
      "It is probably a marketing flyer. Ask the vendor for the technical spec sheet.",
    )
  }
  return product
}
